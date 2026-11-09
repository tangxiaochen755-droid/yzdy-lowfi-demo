import {filterBar, formField, actionButton, treeItem, dialogHead, dialogBody, dialogFoot, formError, openDialog, escapeHtml as e,statusTag as tag,dataTable} from './components.js';
const today = () => new Date().toLocaleDateString('sv-SE');
const now = () => `${today()} ${new Date().toTimeString().slice(0,5)}`;
let selected = 'ROOT', notice = '';
const departments = [
 {id:'D01',name:'行政部',parent:'ROOT',order:10,status:'启用'},
 {id:'D02',name:'销售部',parent:'ROOT',order:20,status:'启用'},
 {id:'D03',name:'生产一部',parent:'ROOT',order:30,status:'启用'},
 {id:'D04',name:'生产二部',parent:'ROOT',order:40,status:'启用'},
 {id:'D05',name:'质量管理部',parent:'ROOT',order:50,status:'启用'},
 {id:'D06',name:'技术研发部',parent:'ROOT',order:60,status:'启用'},
 {id:'D07',name:'财务部',parent:'ROOT',order:70,status:'启用'}
];
let positions = [{id:'P01',dept:'D01',name:'部门负责人',superior:'',status:'启用'},{id:'P02',dept:'D01',name:'人事专员',superior:'P01',status:'启用'},{id:'P03',dept:'D01',name:'行政专员',superior:'P01',status:'启用'},{id:'P04',dept:'D03',name:'班组长',superior:'',status:'启用'},{id:'P05',dept:'D03',name:'操作工',superior:'P04',status:'启用'},{id:'P06',dept:'D05',name:'质量工程师',superior:'',status:'启用'},{id:'P07',dept:'D05',name:'检验员',superior:'P06',status:'启用'}];
const approvalDuties=['部门负责人','分管领导','二级考勤员'];
let dutyAssignments=[{dept:'D01',duty:'部门负责人',employee:'YD9003',at:'2026-10-08 10:30',effective:'2026-10-08',basis:'人事任职确认',actor:'丁明宜'}], dutyAudit=[];
// Page-scoped sessions deliberately do not synchronize business writes across pages.
const initialDepartments=structuredClone(departments), initialPositions=structuredClone(positions);
export function prepareData(data) { notice='';dutyAssignments=[{dept:'D01',duty:'部门负责人',employee:'YD9003',at:'2026-10-08 10:30',effective:'2026-10-08',basis:'人事任职确认',actor:'丁明宜'}];dutyAudit=[];departments.splice(0,departments.length,...structuredClone(initialDepartments));positions=structuredClone(initialPositions); }
const kv = (label,value) => `<div><span>${e(label)}</span><b>${e(value)}</b></div>`;
const options = (rows,value) => rows.map(([key,label])=>`<option value="${e(key)}" ${key === value ? 'selected' : ''}>${e(label)}</option>`).join('');
const deptOptions = value => options(departments.filter(d=>d.status==='启用').map(d=>[d.name,d.name]),value);
const input = (label,name,value='',extra='') => formField(label,`<input name="${name}" value="${e(value)}" ${extra}>`);
const select = (label,name,content) => formField(label,`<select name="${name}">${content}</select>`);
const personnelTag = '老年人';
const optionalProfileFields = [
 ['籍贯','nativePlace'],['学历','education'],['婚况','maritalStatus'],['民族','ethnicity'],['家庭地址','homeAddress']
];
const profileSection = title => '<h3 class="full profile-form-section">'+e(title)+'</h3>';
const dateInput = (label,key,value='',readOnly=false) => input(label,key,value,readOnly?
 (label.includes('自动带出')?'readonly placeholder="自动带出"':'readonly placeholder="未记录"'):
 'required placeholder="YYYY-MM-DD" inputmode="numeric" maxlength="10"');
const profileExtras = row => optionalProfileFields.map(([label,key])=>
 input(label,key,row?.profile?.[key] || '', 'maxlength="120"')).join('');
const employeeNameInput = row => input('姓名','name',row?.name || '','required maxlength="20"');
const employeeIdInput = row => input('工号','employeeId',row?.id || '',row?'readonly':'required maxlength="20" pattern="[A-Za-z0-9_-]+"');
const tagInput = (row,required) => formField('人员标签','<select name="personnelTag" '+(required?'required':'')+'>'+
 options([['',required?'请选择':'未设置'],[personnelTag,personnelTag]],row?.personnelTags?.[0] || '')+'</select>');
export const canEditEmployeeProfile = (data,row) => data?.access.staff === true && data.access.employeeProfileEdit === true &&
 !!row && ['在职','待入职'].includes(row.status);
const activeJobs = dept => positions.filter(p=>p.status==='启用'&&departments.find(d=>d.id===p.dept)?.name===dept);
const jobOptions=(dept,value)=>'<option value="">请选择岗位</option>'+options(activeJobs(dept).map(p=>[p.name,p.name]),value);
const hireJobOptions=dept=>options([['员工','员工'],...activeJobs(dept).map(p=>[p.name,p.name])],'员工');
const jobSelect=(dept,value='')=>select('任职岗位','job',jobOptions(dept,value));

function validDate(value) {
 const date = new Date(value);
 return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===value;
}
function birthFromId(value) {
 const id = value.trim();
 if(!/^\d{17}[\dXx]$/.test(id)) return '';
 const date = [id.slice(6,10),id.slice(10,12),id.slice(12,14)].join('-');
 return validDate(date) && date<=today() ? date : '';
}
function defaultConfirmationDate(hiredAt) {
 if(!validDate(hiredAt)) return '';
 const date = new Date(hiredAt);
 const day = date.getUTCDate();
 date.setUTCDate(1);
 date.setUTCMonth(date.getUTCMonth()+3);
 const last = new Date(date);
 last.setUTCMonth(last.getUTCMonth()+1,0);
 date.setUTCDate(Math.min(day,last.getUTCDate()));
 return date.toISOString().slice(0,10);
}
function profileFieldError(control,message) {
 const label=control.closest('.edit-field');
 if(!label) return;
 let error=label.querySelector('.profile-field-error');
 if(message) {
  if(!error) {
   error=document.createElement('span');
   error.className='profile-field-error';
   error.id='profile-error-'+control.name;
   label.append(error);
  }
  error.textContent=message;
  control.setAttribute('aria-invalid','true');
  control.setAttribute('aria-describedby',error.id);
 } else if(error) {
  error.remove();
  control.removeAttribute('aria-invalid');
  control.removeAttribute('aria-describedby');
 }
}
export function showProfileInvalid(event) {
 const control=event.target;
 const form=control.closest('form[data-edit="hire"],form[data-edit="employee-profile"]');
 if(!form) return;
 event.preventDefault();
 const title=control.closest('.edit-field')?.firstChild?.textContent || '';
 const message=control.validity.customError?control.validationMessage:
  control.validity.valueMissing?(control.tagName==='SELECT'?'请选择':'请填写')+title:
  control.name==='employeeId'?'工号仅可包含字母、数字、下划线或连字符':'请检查'+title;
 profileFieldError(control,message);
 if(form.querySelector(':invalid')===control) control.focus();
}
export function updateHireFields(target) {
 if(target.closest('form[data-edit="hire"],form[data-edit="employee-profile"]')) profileFieldError(target,'');
 const form=target.closest('form[data-edit="hire"]');
 if(!form) return;
 if(target.name==='identityNumber') {
  const birth=birthFromId(target.value);
  form.elements.birthDate.value=birth;
  target.setCustomValidity(target.value && !birth?'请输入包含有效出生日期的18位身份证号':'');
 }
 if(target.name==='hiredAt') {
  const confirmation=form.elements.confirmationDate;
  if(!confirmation.value || confirmation.value===confirmation.dataset.defaultDate) {
   confirmation.value=defaultConfirmationDate(target.value);
   confirmation.dataset.defaultDate=confirmation.value;
  }
 }
}
export function updateJobOptions(target){
 const form=target.closest('form');
 const job=form?.elements.namedItem('job');
 if(target.name==='dept' && job?.tagName==='SELECT')
  job.innerHTML=form.dataset.edit==='hire'?hireJobOptions(target.value):jobOptions(target.value,'');
}
const reason = () => '<label class="edit-field full">业务依据<textarea name="reason" rows="3" maxlength="300" required placeholder="请填写调整原因或任免文件依据"></textarea></label>';
function modal(ctx,title,body,kind,id='') {
 openDialog(ctx.dialog,`<form data-edit="${kind}" data-record="${e(id)}">${dialogHead(title)}${dialogBody(`<div class="edit-grid">${body}</div>${formError()}`)}${dialogFoot(actionButton('取消',{attrs:'data-dialog-close'})+actionButton('确认保存',{variant:'primary',type:'submit'}))}</form>`);
}
export function workflowNotice(){return banner();}
function banner() { return notice ? `<div class="save-notice" role="status">${e(notice)}</div>` : ''; }
export function extendedView(route,data) {
 if(route.page==='organization') return organizationView(data);
 if(route.page==='cadres') return cadreView(data);
 return null;
}
function departmentPointAccess(data,department) {
 const config=data.accessConfig;
 if(!config || data.access.org!==true || !config.scope.departmentIds.includes(department.id)) return null;
 return {
  config,
  grant:config.grants.find(item=>item.id===department.id),
  points:config.points.filter(point=>config.scope.pointIds.includes(point.id)),
  canEdit:config.scope.manage===true && department.status==='启用'
 };
}
function departmentPointSection(data,department) {
 const access=departmentPointAccess(data,department);
 if(!access) return '';
 const granted=access.points.filter(point=>access.grant?.pointIds.includes(point.id));
 const chips=granted.map(point=>tag(point.name+(point.enabled?'':'（已停用）'),'neutral')).join(' ');
 return `<section class="department-access"><div class="list-toolbar"><strong>被访人通行点</strong>
  ${access.canEdit?`<button data-workflow="department-points" data-record="${e(department.id)}">维护通行点</button>`:''}</div>
  <div class="department-access-body"><div class="actions">${chips||'<span class="muted">尚未配置通行点</span>'}</div>
  <p class="muted tiny">新访客预约按被访人所属部门取通行点。已提交预约保留原点位范围。</p></div></section>`;
}
function organizationView(data) {
 const d=departments.find(x=>x.id===selected);
 const rows=d?approvalDuties.map((duty,index)=>{
 const assignment=dutyAssignments.find(a=>a.dept===d.id&&a.duty===duty);
 const holder=data.employees.find(r=>r.id===assignment?.employee);
 return `<tr><td>${e(duty)}</td><td>${holder?e(holder.name):'未配置'}</td><td>${holder?e(holder.dept):'—'}</td><td>${e(assignment?.effective||'—')}</td><td>${tag(holder?'已配置':'待配置',holder?'green':'grey')}</td><td><button class="text" data-workflow="position-assignment" data-record="${index}">维护审批人员</button></td></tr>`;
 }):departments.slice().sort((a,b)=>a.order-b.order).map(x=>`<tr><td><button class="text" data-structure="${x.id}">${e(x.name)}</button></td><td>${e(x.id)}</td><td>${data.employees.filter(r=>r.dept===x.name&&r.status==='在职').length}</td><td>${dutyAssignments.filter(a=>a.dept===x.id&&a.employee).length} / 3</td><td>${tag(x.status,x.status==='启用'?'green':'grey')}</td><td><button class="text" data-workflow="department" data-record="${x.id}">修改</button> <button class="text" data-structure="${x.id}">审批人员</button></td></tr>`);
 return `${banner()}<div class="page-head"><div><h1>组织架构</h1><p class="muted tiny">维护公司部门、审批人员与被访人通行点</p></div><button class="primary" data-workflow="department">＋ 新增部门</button></div><div class="org-grid"><aside class="card tree"><button class="structure-root" data-structure="ROOT">扬州锻压机床有限公司</button><label class="sr-only" for="structure-search">搜索部门</label><input id="structure-search" placeholder="搜索部门"><div class="structure-tree">${departments.slice().sort((a,b)=>a.order-b.order).map(x=>treeItem(x.name+(x.status==='停用'?'（停用）':''),{active:x.id===selected,attrs:`data-structure="${x.id}"`})).join('')}</div></aside><section class="card"><div class="card-head"><h2>${e(d?.name||'部门管理')}</h2>${d?`<button data-workflow="department" data-record="${d.id}">修改部门</button>`:''}</div>${d?`<div class="kv structure-info">${kv('部门编码',d.id)}${kv('所属公司','扬州锻压机床有限公司')}${kv('状态',d.status)}${kv('显示顺序',d.order)}</div><div class="list-toolbar"><strong>部门审批人员</strong><div class="actions"><button data-workflow="position-history">调整记录</button></div></div>`:'<div class="list-toolbar department-description"><span class="muted">选择部门，维护部门负责人、分管领导和二级考勤员</span></div>'}${dataTable(d?['审批职责','审批人员','人员所属部门','生效日期','配置状态','操作']:['部门名称','部门编码','在职员工','审批人员配置','状态','操作'],rows,{empty:'暂无部门',caption:d?'部门审批人员':'公司部门'})}<div class="structure-note">${d?'部门固定设置三类审批职责，维护对应人员；中层类别仍由人事单独维护。':`共 ${departments.length} 个部门` }</div>${d?departmentPointSection(data,d):''}</section></div>`;
}
function cadreView(data) {
 const members=data.employees.filter(r=>r.cadre?.value==='中层领导');
 return `${banner()}<div class="page-head"><div><h1>中层领导名单</h1><p class="muted tiny">按人事确认的中层类别维护，不根据部门负责人岗位自动归类</p></div><button class="primary" data-workflow="cadre">＋ 维护名单</button></div><section class="card">${filterBar(`<label class="field">关键词<input name="keyword" placeholder="姓名 / 员工标识"></label><label class="field">所属部门<select name="dept"><option value="">全部部门</option>${deptOptions('')}</select></label><button class="primary">查询</button><button type="reset">重置</button>`, 'id="cadre-filter"')}<div class="list-toolbar"><strong>中层领导名单</strong><span class="muted">共 ${members.length} 人</span></div><div id="cadre-results">${cadreTable(members)}</div></section><section class="card governance-note"><h3>维护规则</h3><p>仅由已授权的人事管理员维护，并记录变更前后值、操作人、操作时间和业务依据。类别用于本人请假、出差等申请的审批路径判定，不自动授予管理权限。</p></section>`;
}
function cadreTable(rows) {return dataTable(['员工','员工标识','部门','岗位','干部类别','最近维护时间','操作'],rows.map(r=>`<tr><td>${e(r.name)}</td><td>${e(r.id)}</td><td>${e(r.dept)}</td><td>${e(r.job)}</td><td>${tag('中层领导')}</td><td>${e(r.cadre.at)}</td><td><button class="text" data-workflow="cadre" data-record="${r.id}">维护类别</button></td></tr>`),{empty:'暂无符合条件的中层领导',caption:'中层领导名单'});}
export function handleExtendedClick(button,ctx) {
 const {data,route,render}=ctx;
 if(button.dataset.structure) { selected=button.dataset.structure;render();return true; }
 const kind=button.dataset.workflow; if(!kind) return false;
 if(!data || data.access[route.page==='cadres'?'staff':route.page==='organization'?'org':route.page]===false) return true;
 notice='';
 const row=data.employees.find(r=>r.id===(button.dataset.record||(route.page==='staff'?route.id:null)));
 if(kind==='department-points') {
  const department=departments.find(item=>item.id===button.dataset.record);
  const access=route.page==='organization' && department?.id===selected && departmentPointAccess(data,department);
  if(!access?.canEdit) return true;
  const current=access.grant?.pointIds || [];
  const choices=access.points.filter(point=>point.enabled || current.includes(point.id)).map(point=>{
   const places=access.config.places.filter(place=>access.config.scope.placeIds.includes(place.id) && point.placeIds.includes(place.id));
   return `<label><input type="checkbox" name="pointId" value="${e(point.id)}" ${current.includes(point.id)?'checked':''}>
    <span>${e(point.name)}${point.enabled?'':'（已停用）'}<small class="cell-secondary">${e([point.id,...places.map(place=>place.name)].join(' · '))}</small></span></label>`;
  }).join('');
  modal(ctx,'维护被访人通行点',`<div class="edit-context full">${e(department.name)}<br>选择本部门被访人可用于新预约的通行点。</div>
   <fieldset class="acs-options full"><legend>通行点</legend><div>${choices||'<span class="muted">暂无可选通行点</span>'}</div></fieldset>`,kind,department.id);
  return true;
 }
 if(kind==='department') {
  const d=departments.find(d=>d.id===button.dataset.record);
  modal(ctx,d?'修改部门':'新增部门',input('部门名称','name',d?.name||'','required maxlength="40"')+'<input type="hidden" name="parent" value="ROOT">'+input('显示顺序','order',d?.order||10,'type="number" min="0" required')+select('部门状态','status',options([['启用','启用'],['停用','停用']],d?.status||'启用')),kind,d?.id);return true;
 }
 if(kind==='position-history') {
 const records=dutyAudit.filter(a=>a.dept===selected);
 ctx.dialog.innerHTML=`<div class="modal-head"><h2 id="dialog-title">审批人员调整记录</h2><button class="icon-btn" data-dialog-close aria-label="关闭">×</button></div><div class="modal-body">${dataTable(['审批职责','调整前','调整后','生效日期','操作人','业务依据'],records.map(a=>`<tr><td>${e(a.duty)}</td><td>${e(a.before)}</td><td>${e(a.after)}</td><td>${e(a.effective)}</td><td>${e(a.actor)}</td><td>${e(a.basis)}</td></tr>`),{caption:'审批人员调整记录',empty:'暂无调整记录'})}</div>`;ctx.dialog.showModal();return true;
 }
 if(kind==='position-assignment') {
 const duty=approvalDuties[Number(button.dataset.record)];if(!duty)return true;
 const dept=departments.find(d=>d.id===selected);if(!dept)return true;
 const current=dutyAssignments.find(a=>a.dept===selected&&a.duty===duty);
 modal(ctx,'维护审批人员',`<div class="edit-context full">${e(dept.name)} / ${e(duty)}</div>`+select('审批人员','employee',options([['','暂不配置'],...data.employees.filter(r=>r.status==='在职').map(r=>[r.id,`${r.name} / ${r.dept} / ${r.id}`])],current?.employee||''))+input('生效日期','effective',today(),'required pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" placeholder="YYYY-MM-DD"')+reason(),kind,String(approvalDuties.indexOf(duty)));return true;
 }
 if(kind==='cadre') {
  modal(ctx,'维护中层类别',(row?input('员工','employeeName',`${row.name} / ${row.id}`,'readonly')+`<input type="hidden" name="employee" value="${e(row.id)}">`:select('选择员工','employee',options(data.employees.filter(r=>r.status==='在职').map(r=>[r.id,`${r.name} / ${r.dept} / ${r.id}`]),'')))+select('干部类别','category',options([['普通员工','普通员工'],['中层领导','中层领导']],row?.cadre?.value||'中层领导'))+reason()+'<p class="muted full">本次维护仅调整人员类别；不授予管理权限，也不重算在途审批任务。</p>',kind,row?.id);
  return true;
 }
 if(kind==='hire' && route.page==='org') {
  modal(ctx,'入职建档',profileSection('基本信息')+employeeNameInput()+
   input('身份证号','identityNumber','','required maxlength="18" autocomplete="off"')+
   dateInput('出生日期（自动带出）','birthDate','',true)+employeeIdInput()+
   input('人员性质','personnelNature','','required maxlength="40" placeholder="例如 正式员工"')+tagInput(null,true)+
   profileSection('任职与聘用')+
   formField('部门','<select name="dept" required>'+deptOptions('行政部')+'</select>')+
   formField('职位','<select name="job" required>'+hireJobOptions('行政部')+'</select>')+
   input('成本中心','costCenter','','required maxlength="40" placeholder="例如 XZ00080"')+
   dateInput('建档日期（自动带出）','recordDate',today(),true)+dateInput('聘用日期','hiredAt')+
   dateInput('转正日期','confirmationDate')+reason()+
   profileSection('补充信息（选填）')+profileExtras(),kind);
  return true;
 }
 if(kind==='employee-profile') {
  if(route.page==='staff' && row?.id===route.id && canEditEmployeeProfile(data,row)) {
   const profile=row.profile || {};
   modal(ctx,'编辑员工档案',profileSection('基本信息')+employeeNameInput(row)+
    input('身份证号','identityMasked',profile.identityMasked || '','readonly placeholder="未记录"')+
    dateInput('出生日期（自动带出）','birthDate',profile.birthDate || '',true)+employeeIdInput(row)+
    input('人员性质','personnelNature',profile.personnelNature ?? row.kind ?? '',
     'maxlength="40" placeholder="例如 正式员工"'+(profile.personnelNature || row.kind?' required':''))+
    tagInput(row,Boolean(row.personnelTags?.length))+
    profileSection('任职与聘用')+
    input('部门','dept',row.dept,'readonly')+input('职位','job',row.job,'readonly')+
    input('成本中心','costCenter',profile.costCenter || '','readonly placeholder="未记录"')+
    dateInput('建档日期','recordDate',profile.recordDate || '',true)+dateInput('聘用日期','hiredAt',profile.hiredAt || '',true)+
    dateInput('转正日期','confirmationDate',profile.confirmationDate || '',true)+reason()+
    profileSection('补充信息（选填）')+profileExtras(row),kind,row.id);
  }
  return true;
 }
 if(!row || row.status!=='在职') return true;
 const content = ['transfer','assignment'].includes(kind)?select('调入部门','dept',deptOptions(row.dept))+jobSelect(row.dept,row.job):'';
 modal(ctx,kind==='leave'?'办理离职':kind==='assignment'?'新增兼岗':'办理调岗',`<div class="edit-context full">${e(row.name)} · ${e(row.id)}<br>当前任岗：${e(row.dept)} / ${e(row.job)}</div>`+content+input('生效日期','effective',today(),'required pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" placeholder="YYYY-MM-DD"')+reason()+`<p class="muted full">${kind==='leave'?'离职不删除历史档案和业务记录。':'原部门和岗位保留在任岗历史中。'}在途任务的迁移规则待业务确认，不自动重新派单。</p>`,kind,row.id); return true;
}
export function handleExtendedSubmit(form,ctx) {
 const {data,route,render,dialog}=ctx;
 if(form.id==='cadre-filter') {const f=new FormData(form);document.querySelector('#cadre-results').innerHTML=cadreTable(data.employees.filter(r=>r.cadre?.value==='中层领导' && (!f.get('keyword') || (r.name+r.id).includes(f.get('keyword').trim())) && (!f.get('dept') || r.dept===f.get('dept'))));return true;}
 const kind=form.dataset.edit;if(!['department','department-points','position-assignment','cadre','hire','transfer','assignment','leave','employee-profile'].includes(kind))return false;
 if(!data || data.access[({organization:'org',cadres:'staff',approval:'approvals'})[route.page]||route.page]===false)return true;
 if(kind==='department-points') {
  const department=departments.find(item=>item.id===form.dataset.record);
  const access=route.page==='organization' && department?.id===selected && departmentPointAccess(data,department);
  if(!access?.canEdit) return true;
  const current=access.grant?.pointIds || [];
  const pointIds=[...new Set(new FormData(form).getAll('pointId'))];
  if(pointIds.some(id=>!access.points.some(point=>point.id===id && (point.enabled || current.includes(id))))) {
   form.querySelector('.form-error').textContent='请选择授权范围内的通行点。';
   return true;
  }
  const next=[...current.filter(id=>!access.points.some(point=>point.id===id)),...pointIds];
  if(access.grant) access.grant.pointIds=next;
  else access.config.grants.push({id:department.id,name:department.name,pointIds:next});
  notice='被访人通行点已保存';
  dialog.close();
  render();
  document.querySelector('[data-workflow="department-points"]')?.focus();
  return true;
 }
 const f=Object.fromEntries(new FormData(form));const error=(message,key)=>{
  const control=key && form.elements.namedItem(key);
  if(control && ['hire','employee-profile'].includes(kind)) {
   profileFieldError(control,message);
   control.focus();
  } else form.querySelector('.form-error').textContent=message;
  return true;
 };
 const row=data.employees.find(r=>r.id===(f.employee||form.dataset.record));
 if(['hire','transfer','leave','assignment','cadre','position-assignment','employee-profile'].includes(kind) && !f.reason?.trim())return error('请填写业务依据','reason');
 if(kind==='hire' || kind==='employee-profile') {
  if(!f.name?.trim() || f.name.trim().length>20) return error('请输入 1 至 20 个字符的员工姓名','name');
  if(f.personnelTag!==personnelTag && (kind==='hire' || row?.personnelTags?.length || f.personnelTag!=='')) return error('请选择有效的人员标签','personnelTag');
 }
 if(kind==='employee-profile') {
  if(route.page!=='staff' || row?.id!==route.id || !canEditEmployeeProfile(data,row)) return error('当前档案不可编辑');
  if(row.profileSaveState==='UNKNOWN') return error('保存结果待确认，请刷新档案核对后再操作。');
  const name=f.name.trim(), label=f.personnelTag, oldLabel=row.personnelTags?.[0] || '';
  const profile=row.profile || {};
  const nature=f.personnelNature?.trim() || '';
  const oldNature=profile.personnelNature ?? row.kind ?? '';
  if((oldNature && !nature) || nature.length>40) return error('请输入有效的人员性质','personnelNature');
  const changes=[];
  const nextProfile={...profile,personnelNature:nature};
  if(nature!==oldNature) changes.push(['人员性质',oldNature||'未记录',nature]);
  for(const [title,key] of optionalProfileFields) {
   const value=f[key]?.trim() || '';
   if(value.length>120) return error(title+'最多填写 120 个字符',key);
   if(value!==(profile[key]||'')) changes.push([title,profile[key]||'未记录',value||'未记录']);
   nextProfile[key]=value;
  }
  if(name!==row.name) changes.push(['员工姓名',row.name,name]);
  if(label!==oldLabel) changes.push(['人员标签',oldLabel||'未设置',label||'未设置']);
  if(!changes.length) return error('档案信息未发生变化');
  row.name=name;
  row.profile=nextProfile;
  row.personnelTags=label?[label]:[];
  row.audit.unshift(...changes.map(([item,before,after])=>({item,before,after,actor:'丁明宜',at:now(),basis:f.reason.trim()})));
 }

 if(f.effective && (!/^\d{4}-\d{2}-\d{2}$/.test(f.effective) || isNaN(Date.parse(f.effective)) || new Date(f.effective).toISOString().slice(0,10)!==f.effective))return error('请输入有效日期，格式为 YYYY-MM-DD');
 if(kind==='department') {
  const d=departments.find(d=>d.id===form.dataset.record);
  if(!f.name.trim())return error('请输入部门名称');
  if(departments.some(x=>x.id!==d?.id && x.parent===f.parent && x.name===f.name.trim()))return error('同级部门名称已存在');
  if(f.status==='停用' && (dutyAssignments.some(x=>x.dept===d?.id && x.employee) || data.employees.some(r=>r.dept===d?.name && r.status==='在职')))return error('该部门存在已配置审批人员或在职员工，请先调整后停用');
  if(d && d.name!==f.name.trim()) {const before=d.name;data.employees.forEach(r=>{if(r.dept===before)r.dept=f.name.trim();r.assignments.filter(a=>a.status==='有效'&&a.dept===before).forEach(a=>a.dept=f.name.trim());});}
  if(d)Object.assign(d,{name:f.name.trim(),parent:f.parent,order:Number(f.order),status:f.status});else departments.push({id:`D${String(departments.length+1).padStart(2,'0')}`,name:f.name.trim(),parent:f.parent,order:Number(f.order),status:f.status});
 }
 if(kind==='position-assignment') {
 const duty=approvalDuties[Number(form.dataset.record)];if(!duty||!departments.some(d=>d.id===selected))return error('审批职责不存在');
 if(f.employee&&(!row||row.status!=='在职'))return error('请选择有效在职人员');
 if(f.effective>today())return error('未来生效的审批人员变更规则尚待确认，请于生效时维护');
 const previous=dutyAssignments.find(a=>a.dept===selected&&a.duty===duty);
 if((previous?.employee||'')===f.employee)return error('审批人员未发生变化');
 const before=data.employees.find(r=>r.id===previous?.employee)?.name||'未配置';
 dutyAssignments=dutyAssignments.filter(a=>!(a.dept===selected&&a.duty===duty));
 if(f.employee)dutyAssignments.push({dept:selected,duty,employee:f.employee,effective:f.effective,actor:'丁明宜',at:now(),basis:f.reason});
 dutyAudit.unshift({dept:selected,duty,before,after:row?.name||'未配置',effective:f.effective,actor:'丁明宜',at:now(),basis:f.reason});
 }
 if(kind==='cadre') {
  if(!row)return error('请选择有效员工');
  const before=row.cadre?.value||'未维护';
  if(before===f.category)return error('干部类别未发生变化');
  row.cadre={value:f.category,at:now(),actor:'丁明宜',basis:f.reason};
  row.audit.unshift({item:'中层类别维护',before,after:f.category,actor:'丁明宜',at:now(),basis:f.reason});
 }
 if(['transfer','assignment'].includes(kind) && !activeJobs(f.dept).some(p=>p.name===f.job?.trim()))
  return error('请选择所属部门已维护且启用的岗位');
 if(kind==='hire') {
  if(route.page!=='org') return true;
  const id=f.employeeId?.trim() || '';
  if(!/^[A-Za-z0-9_-]{1,20}$/.test(id)) return error('请输入有效的工号');
  if(data.employees.some(r=>r.id===id)) return error('工号已存在','employeeId');
  if(!departments.some(dept=>dept.status==='启用' && dept.name===f.dept) ||
    (f.job!=='员工' && !activeJobs(f.dept).some(p=>p.name===f.job))) return error('请选择所属部门已维护且启用的岗位');
  const identityNumber=f.identityNumber?.trim() || '';
  const birthDate=birthFromId(identityNumber);
  if(!birthDate) return error('请输入包含有效出生日期的18位身份证号','identityNumber');
  if(!validDate(f.hiredAt)) return error('请输入有效的聘用日期，格式为 YYYY-MM-DD','hiredAt');
  if(!validDate(f.confirmationDate) || f.confirmationDate<f.hiredAt)
   return error('请输入有效的转正日期，且不得早于聘用日期','confirmationDate');
  const costCenter=f.costCenter?.trim(), personnelNature=f.personnelNature?.trim();
  if(!costCenter) return error('请填写成本中心','costCenter');
  if(!personnelNature) return error('请填写人员性质','personnelNature');
  const date=f.hiredAt, recordDate=today(), future=date>recordDate;
  const profile=Object.fromEntries(optionalProfileFields.map(([,key])=>[key,f[key]?.trim() || '']));
  data.employees.push({
   id,name:f.name.trim(),dept:f.dept,job:f.job,date,status:future?'待入职':'在职',cadre:null,face:null,
   personnelTags:[f.personnelTag],
   profile:{...profile,identityMasked:'••••••••••••••'+identityNumber.slice(-4),birthDate,recordDate,hiredAt:date,
    confirmationDate:f.confirmationDate,costCenter,personnelNature},
   assignments:[{dept:f.dept,job:f.job,start:date,end:null,status:future?'待生效':'有效'}],
   changes:[{title:'入职建档',job:f.job,date}],
   audit:[{item:'入职建档',before:'—',after:[f.dept,f.job].join(' / '),actor:'丁明宜',at:now(),basis:f.reason}]
  });
  (data.createdEmployeeIds ??= new Set()).add(id);
 }
 if(kind==='transfer'||kind==='leave'||kind==='assignment') {
  if(!row||row.status!=='在职')return error('当前员工状态不允许办理此项异动');
  if(row.pendingChange)return error('已有待生效异动，请先核对现有记录');
  if(f.effective<row.date)return error('生效日期不得早于当前任岗日期');
  if(['transfer','assignment'].includes(kind)&&f.dept===row.dept&&f.job.trim()===row.job)return error('调入部门或岗位须发生变化');
  const before=`${row.dept} / ${row.job}`;const future=f.effective>today();
  if(kind==='assignment') {
   if(row.assignments.some(a=>a.status!=='已结束' && a.dept===f.dept && a.job===f.job.trim()))return error('已存在相同兼岗');
   row.assignments.unshift({dept:f.dept,job:f.job.trim(),start:f.effective,end:null,status:future?'待生效':'有效',kind:'兼岗'});
  } else if(future)row.pendingChange={kind,dept:f.dept,job:f.job,date:f.effective};
  else {
   row.assignments.filter(a=>a.status==='有效'&&(kind==='leave'||a.kind!=='兼岗')).forEach(a=>{a.status='已结束';a.end=f.effective;});
   if(kind==='leave')row.status='已离职';
   else {row.dept=f.dept;row.job=f.job.trim();row.date=f.effective;row.assignments.unshift({job:row.job,dept:row.dept,start:f.effective,end:null,status:'有效'});}
  }
  row.changes.unshift({title:`${kind==='leave'?'离职':kind==='assignment'?'兼岗':'调岗'}${future?'（待生效）':''}`,job:kind==='leave'?row.job:f.job,date:f.effective});
  row.audit.unshift({item:kind==='leave'?'离职登记':kind==='assignment'?'新增兼岗':'任岗调整',before,after:kind==='leave'?'离职':`${f.dept} / ${f.job}${future?'（待生效）':''}`,actor:'丁明宜',at:now(),basis:f.reason});
 }

 notice=(['hire','transfer','leave','assignment'].includes(kind)?'人员异动已登记，历史记录已保留':'保存成功');
 if(dialog.open)dialog.close();render();return true;
}
