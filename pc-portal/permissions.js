import {filterBar, formField, actionButton, compactPagination, tabList, tabDestination, dialogHead, openDialog, formError, escapeHtml as e,statusTag as tag,dataTable,paginate} from './components.js';
const roles=[
 {id:'SP-HR',name:'人事组织管理',scope:'department',scopeLabel:'部门',capabilities:'组织人员、任岗异动及合规人脸材料管理',boundary:'员工导入需单独授权；不包含系统角色授撤。'},
 {id:'SP-ATT',name:'考勤排班管理',scope:'team',scopeLabel:'班组',capabilities:'班次、排班、考勤查询与报表',boundary:'排班导入等子能力独立受控；不包含人事导入或人工补签。'},
 {id:'SP-GUARD',name:'安保值守',scope:'point',scopeLabel:'值守点位',capabilities:'当班点位内关联业务查询与现场核验',boundary:'仍需当班及业务关联；不生成或改写设备通行事实。'},
 {id:'SP-VIS-ACCESS',name:'访客门禁管理',scope:'place',scopeLabel:'场所',capabilities:'预约政策、门禁场所点位及设备管理',boundary:'不代替合法审批人，不扩大敏感名单数据范围。'},
 {id:'SP-CAN-OPS',name:'食堂运营管理',scope:'canteen',scopeLabel:'食堂',capabilities:'菜品、套餐与周菜单运营',boundary:'不包含账户调账、资金操作、敏感导出或终端核销。'}
];
const tabs=[['grants','人员专项授权'],['inherited','岗位继承职责'],['audit','授权审计']];
const ui={tab:'grants',keyword:'',role:'',status:'',page:1,size:5,notice:''};
const today=()=>new Date().toLocaleDateString('sv-SE');
const now=()=>`${today()} ${new Date().toTimeString().slice(0,5)}`;
const roleOf=id=>roles.find(r=>r.id===id);
const person=(data,id)=>data.employees.find(r=>r.id===id);
const canWrite=data=>data.access.permissions===true && data.permissions?.actor?.designatedAdmin===true && data.permissions.actor.readOnly!==true;
const stateOf=g=>g.state==='revoked'?'已撤销':g.end&&g.end<today()?'已过期':g.start>today()?'未生效':'有效';
const kv=(label,value)=>`<div><span>${e(label)}</span><b>${e(value)}</b></div>`;
const opts=(rows,value)=>rows.map(([id,label])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(label)}</option>`).join('');
export function resetPermissions(){ui.notice='';}
function listRows(data){
 const p=data.permissions;
 const rows=ui.tab==='grants'?p.grants:ui.tab==='inherited'?p.inherited:p.audit;
 return rows.filter(r=>{const employee=person(data,r.employeeId);return (!ui.keyword || `${employee?.name||''}${r.employeeId}${employee?.dept||''}`.includes(ui.keyword)) && (!ui.role||r.role===ui.role) && (!ui.status||(ui.tab==='grants'?stateOf(r):r.action)===ui.status);});
}
const pager=model=>compactPagination(model,{label:'权限记录分页',sizeAttr:'data-perm-size',pageAttr:'data-perm-page'});
export function permissionsView(data){
 if(!data.permissions) return '<section class="card state-view"><h2>权限信息暂不可用</h2><button data-retry>重新加载</button></section>';
 const writable=canWrite(data),model=paginate(listRows(data),ui.page,ui.size);ui.page=model.page;
 let headers,rows;
 if(ui.tab==='grants'){
 headers=['授权人员','专项角色','数据范围','有效期','状态','操作'];
 rows=model.rows.map(g=>{const p=person(data,g.employeeId),s=stateOf(g);return `<tr><td><strong>${e(p?.name||g.employeeId)}</strong><small class="cell-secondary">${e(g.employeeId)} · ${e(p?.dept||'—')}</small></td><td>${e(roleOf(g.role)?.name||g.role)}</td><td class="permission-scope-cell">${e(g.scope.join('、'))}</td><td class="mono">${e(g.start)}<small class="cell-secondary">${g.end?'至 '+e(g.end):'长期有效'}</small></td><td>${tag(s,s==='有效'?'green':'grey')}</td><td><div class="permission-row-actions"><button class="text" data-perm-view="${e(g.id)}">查看</button>${s==='有效'&&writable?`<button class="text" data-perm-edit="${e(g.id)}">调整范围</button><button class="text danger" data-perm-revoke="${e(g.id)}">撤销</button>`:''}</div></td></tr>`;});
 }else if(ui.tab==='inherited'){
 headers=['员工','任职职责','所属部门','生效日期','继承职责','数据范围'];
 rows=model.rows.map(r=>`<tr><td>${e(person(data,r.employeeId)?.name||r.employeeId)}<small class="cell-secondary">${e(r.employeeId)}</small></td><td>${e(r.duty)}</td><td>${e(r.department)}</td><td class="mono">${e(r.start)}</td><td class="permission-scope-cell">${e(r.capabilities)}</td><td class="permission-scope-cell">${e(r.scope)}</td></tr>`);
 }else{
 headers=['操作时间','操作人','被授权人','专项角色 / 操作','变更前 → 变更后','操作理由'];
 rows=model.rows.map(r=>`<tr><td class="mono">${e(r.at)}</td><td>${e(r.actor)}</td><td>${e(person(data,r.employeeId)?.name||r.employeeId)}</td><td>${e(roleOf(r.role)?.name||r.role)}<small class="cell-secondary">${e(r.action)}</small></td><td class="permission-scope-cell">${e(r.before)}<br>→ ${e(r.after)}</td><td class="permission-scope-cell">${e(r.reason)}</td></tr>`);
 }
 const guidance=ui.tab==='grants'?'每条授权独立绑定角色与数据范围；PC与小程序共用同一授权。':ui.tab==='inherited'?'职责来自有效任职，只读查看；请在组织架构或员工异动中维护来源。':'保留授权、范围调整和撤销记录，历史记录不可删除。';
 return `<div class="page-head"><div><h1>岗位角色与数据权限</h1><p class="muted tiny">查询职责来源，维护专项角色与对应数据范围</p></div><button class="primary" data-perm-new ${!writable?'disabled title="仅指定系统权限管理员可授撤"':''}>＋ 新增授权</button></div>${ui.notice?`<div class="save-notice" role="status">${e(ui.notice)}</div>`:''}${!writable?'<div class="permission-readonly" role="status">当前账号仅可查看，授予、调整及撤销需由指定系统权限管理员操作。</div>':''}<section class="card permission-card">${tabList('permission',tabs,ui.tab,{label:'权限管理分组',eventAttr:'data-perm-tab'})}${filterBar(`${formField('关键词',`<input name="keyword" value="${e(ui.keyword)}" placeholder="姓名 / 员工标识 / 部门" maxlength="80">`,{variant:'field'})}${ui.tab!=='inherited'?`<label class="field">专项角色<select name="role"><option value="">全部角色</option>${opts(roles.map(r=>[r.id,r.name]),ui.role)}</select></label><label class="field">${ui.tab==='grants'?'授权状态':'操作类型'}<select name="status"><option value="">全部</option>${opts((ui.tab==='grants'?['有效','已过期','已撤销','未生效']:['新增授权','调整范围','撤销授权']).map(v=>[v,v]),ui.status)}</select></label>`:''}${actionButton('查询',{variant:'primary',type:'submit'})}<button type="button" data-perm-reset>重置</button>`, 'id="permission-filter"')}<div class="permission-guidance">${guidance}</div><div id="permission-panel" role="tabpanel" aria-labelledby="permission-tab-${ui.tab}" tabindex="0">${dataTable(headers,rows,{empty:'没有符合条件的记录',caption:tabs.find(t=>t[0]===ui.tab)[1]})}${pager(model)}</div></section>`;
}
function show(ctx,html,{drawer=false,trigger}={}) {
 openDialog(ctx.dialog,html,{drawer,onClose:()=>{
   if(trigger?.isConnected)trigger.focus();
   else document.querySelector('[data-perm-new]')?.focus();
 }});
}
const head=dialogHead;
function scopeFields(data,role,selected=[]){const r=roleOf(role);return `<fieldset class="scope-fieldset"><legend>授权${e(r.scopeLabel)} <span>（必选）</span></legend><div class="scope-options">${(data.permissions.resources[r.scope]||[]).map(value=>`<label><input type="checkbox" name="scope" value="${e(value)}" ${selected.includes(value)?'checked':''}>${e(value)}</label>`).join('')}</div></fieldset><div class="permission-capability"><h3>角色职责</h3><p>${e(r.capabilities)}</p><p class="muted">${e(r.boundary)}</p></div>`;}
function grantForm(ctx,g,trigger){
 const employees=ctx.data.employees.filter(r=>r.status==='在职'&&r.id!==ctx.data.permissions.actor.id);
 const role=g?.role||roles[0].id;
 show(ctx,`<form data-perm-form="grant" data-grant-id="${e(g?.id||'')}">${head(g?'调整授权范围':'新增专项授权')}<div class="modal-body"><div class="permission-form-section"><h3>授权对象</h3><label class="edit-field">员工${g?`<input readonly value="${e(person(ctx.data,g.employeeId)?.name||g.employeeId)} / ${e(g.employeeId)}"><input type="hidden" name="employeeId" value="${e(g.employeeId)}">`:`<select name="employeeId" required><option value="">请选择在职员工</option>${opts(employees.map(p=>[p.id,`${p.name} / ${p.dept} / ${p.id}`]),'')}</select>`}</label><label class="edit-field">专项角色${g?`<input readonly value="${e(roleOf(role).name)}"><input type="hidden" name="role" value="${e(role)}">`:`<select name="role">${opts(roles.map(r=>[r.id,r.name]),role)}</select>`}</label></div><div class="permission-form-section"><h3>数据范围</h3><div id="permission-scope-fields">${scopeFields(ctx.data,role,g?.scope||[])}</div></div><div class="permission-form-section"><h3>有效期与依据</h3><div class="edit-grid"><label class="edit-field">生效日期<input name="start" readonly value="${e(g?.start||today())}"></label><label class="edit-field">截止日期（选填）<input name="end" placeholder="YYYY-MM-DD，留空为长期" value="${e(g?.end||'')}" maxlength="10"></label><label class="edit-field full">${g?'调整理由':'授权理由'}<textarea name="reason" rows="3" required maxlength="300" placeholder="请填写岗位职责安排或工作依据"></textarea></label></div></div>${formError()}</div><div class="modal-foot"><button type="button" data-dialog-close>取消</button><button class="primary" type="submit">${g?'确认调整':'确认授权'}</button></div></form>`,{drawer:true,trigger});
}
export function permissionClick(button,ctx){
 if(button.dataset.permTab){ui.tab=button.dataset.permTab;ui.role='';ui.status='';ui.page=1;ctx.render();document.getElementById('permission-tab-'+ui.tab)?.focus();return true;}
 if(button.hasAttribute('data-perm-reset')){Object.assign(ui,{keyword:'',role:'',status:'',page:1});ctx.render();return true;}
 if(button.hasAttribute('data-perm-page')){ui.page=Number(button.dataset.permPage);ctx.render();return true;}
 const p=ctx.data?.permissions;if(!p||ctx.data.access.permissions===false)return false;
 const g=p.grants.find(r=>r.id===(button.dataset.permView||button.dataset.permEdit||button.dataset.permRevoke));
 if(button.dataset.permView&&g){show(ctx,`${head('授权详情')}<div class="modal-body"><div class="kv">${kv('授权人员',person(ctx.data,g.employeeId)?.name||g.employeeId)}${kv('专项角色',roleOf(g.role)?.name||g.role)}${kv('数据范围',g.scope.join('、'))}${kv('授权状态',stateOf(g))}${kv('生效日期',g.start)}${kv('截止日期',g.end||'长期有效')}${kv('授权人',g.actor)}${kv('授权时间',g.at)}${kv('授权依据',g.reason)}</div><div class="permission-capability"><h3>角色职责</h3><p>${e(roleOf(g.role)?.capabilities)}</p><p class="muted">${e(roleOf(g.role)?.boundary)}</p></div></div><div class="modal-foot"><button data-dialog-close>关闭</button></div>`,{trigger:button});return true;}
 if(button.hasAttribute('data-perm-new')||button.dataset.permEdit||button.dataset.permRevoke){
 if(!canWrite(ctx.data)){ui.notice='当前账号没有授撤权限';ctx.render();return true;}
 if(button.hasAttribute('data-perm-new')){grantForm(ctx,null,button);return true;}
 if(!g||stateOf(g)!=='有效')return true;
 if(button.dataset.permEdit){grantForm(ctx,g,button);return true;}
 show(ctx,`<form data-perm-form="revoke" data-grant-id="${e(g.id)}">${head('撤销专项授权')}<div class="modal-body"><div class="edit-context">${e(person(ctx.data,g.employeeId)?.name||g.employeeId)} / ${e(roleOf(g.role)?.name)}<br>数据范围：${e(g.scope.join('、'))}</div><p class="permission-revoke-note">撤销后，该专项角色及其数据范围失效，历史业务和审计记录保留。岗位继承职责不受本次操作影响。</p><label class="edit-field">撤销理由<textarea name="reason" required maxlength="300" placeholder="请填写撤销依据"></textarea></label>${formError()}</div><div class="modal-foot"><button type="button" data-dialog-close>取消</button><button class="primary" type="submit">确认撤销</button></div></form>`,{trigger:button});return true;
 }
 return false;
}
export function permissionSubmit(form,ctx){
 if(form.id==='permission-filter'){const f=new FormData(form);Object.assign(ui,{keyword:String(f.get('keyword')||'').trim(),role:f.get('role')||'',status:f.get('status')||'',page:1});ctx.render();return true;}
 const kind=form.dataset.permForm;if(!kind)return false;
 const fail=text=>{form.querySelector('.form-error').textContent=text;return true;};
 if(!ctx.data?.permissions||!canWrite(ctx.data))return fail('当前账号无授撤权限，请关闭后联系指定系统权限管理员。');
 const p=ctx.data.permissions,f=new FormData(form),reason=String(f.get('reason')||'').trim();if(!reason)return fail('请填写操作理由');
 const existing=p.grants.find(g=>g.id===form.dataset.grantId);let action,before,after,record;
 if(kind==='revoke'){
 if(!existing||stateOf(existing)!=='有效')return fail('授权已失效或状态已变化，请刷新核对');
 action='撤销授权';before=existing.scope.join('、');after='已撤销';record=existing;existing.state='revoked';existing.revokedAt=now();
 }else{
 const employeeId=f.get('employeeId'),role=f.get('role'),scope=f.getAll('scope'),template=roleOf(role),employee=person(ctx.data,employeeId),end=String(f.get('end')||'').trim();
 if(!employee||employee.status!=='在职'||employeeId===p.actor.id)return fail('请选择有权维护的在职员工');
 if(!template)return fail('请选择预置专项角色');
 if(!scope.length)return fail('请至少选择一个数据范围');
 if(scope.some(s=>!(p.resources[template.scope]||[]).includes(s)))return fail('数据范围与当前角色不匹配，请重新选择');
 if(end&&(!/^\d{4}-\d{2}-\d{2}$/.test(end)||isNaN(Date.parse(end))||new Date(end).toISOString().slice(0,10)!==end||end<today()))return fail('截止日期须为今天或之后的有效日期，格式YYYY-MM-DD');
 if(existing){if(stateOf(existing)!=='有效'||existing.employeeId!==employeeId||existing.role!==role)return fail('授权状态或对象已变化，请刷新核对');if(existing.scope.slice().sort().join('|')===scope.slice().sort().join('|')&&existing.end===end)return fail('授权范围及有效期未发生变化');}
 else if(p.grants.some(g=>g.employeeId===employeeId&&g.role===role&&stateOf(g)==='有效'))return fail('该员工已有此角色的有效授权，请在原记录中调整范围');
 action=existing?'调整范围':'新增授权';before=existing?`${existing.scope.join('、')}；截止：${existing.end||'长期'}`:'无';after=`${scope.join('、')}；截止：${end||'长期'}`;
 record=existing||{id:'GR'+Date.now(),employeeId,role,start:today(),state:'active',actor:p.actor.name,at:now(),reason};Object.assign(record,{scope:[...new Set(scope)],end});if(!existing)p.grants.unshift(record);
 }
 p.audit.unshift({id:'AU'+Date.now(),employeeId:record.employeeId,role:record.role,action,before,after,actor:p.actor.name,at:now(),reason});
 ui.notice=action==='撤销授权'?'授权已撤销，历史记录已保留':action==='调整范围'?'授权范围已调整，操作已记录':'专项授权已保存，操作已记录';ctx.dialog.close();ctx.render();return true;
}
export function permissionChange(target,ctx){
 if(target.hasAttribute('data-perm-size')){ui.size=Number(target.value);ui.page=1;ctx.render();return true;}
 if(target.name==='role'&&target.closest('[data-perm-form="grant"]')){document.querySelector('#permission-scope-fields').innerHTML=scopeFields(ctx.data,target.value,[]);return true;}
 return false;
}
export function permissionKeydown(event,ctx){
 const next=tabDestination(event);
 if(!next?.dataset.permTab)return false;
 permissionClick(next,ctx);return true;
}
