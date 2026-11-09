import {escapeHtml as e,statusTag,filterBar,formField,actionButton,dataTable,paginate,pagination,tabList,stateView,
  openDialog,dialogHead,dialogBody,dialogFoot,formError} from './components.js';
import {detailField as field,detailSection as section,detailStack,detailPanel} from './detail-primitives.js';
import {routeUrl} from './shell.js';
import {visitPages,visitScope,visitEvents,personFact,approvedForShift} from './m01-model.js?v=list-maintenance-fix';

const tones = new Map([
  ['已通过','success'],['有效','success'],['同意','success'],['在厂','success'],['已归还','success'],['已确认','success'],
  ['待审批','warning'],['待处理','warning'],['结果待确认','warning'],['部分离厂','warning'],['待归还','warning'],
  ['已驳回','danger'],['驳回','danger'],['陌生人告警','danger'],['未生效','neutral'],['整单结束','neutral'],
  ['已离厂','neutral'],['已结束','neutral'],['未入厂','neutral'],['已终止','neutral']
]);
const tag = label => statusTag(label,tones.get(label) || 'info');
const heading = (title,note='',actions='') => `<div class="page-head"><div><h1>${e(title)}</h1>${note ? `<p class="muted tiny">${e(note)}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
const link = (page,label,route,id) => `<a class="text" href="${e(routeUrl({page,id,profile:route.profile}))}" data-route="${page}"${id ? ` data-id="${e(id)}"` : ''}>${e(label)}</a>`;
const grid = fields => `<div class="compact-descriptions three">${fields.map(([label,value,extra]) => field(label,value,extra)).join('')}</div>`;
const td = value => `<td>${e(value ?? '—')}</td>`;
const cell = markup => `<td>${markup}</td>`;
const tr = (...cells) => `<tr>${cells.join('')}</tr>`;
const small = value => `<small class="cell-secondary">${e(value)}</small>`;
const stamp = (date,time) => !time || time === '—' ? '—' : `${date} ${time}`;
const windowText = row => `${row.date}　${row.start}–${row.end}`;
const modes = [['all','全部'],['ordinary','普通访客'],['freight','货运']];
const noticeTitles = ['入厂管理告知','安全环保告知'];
const sourceLabels = {DEVICE_PASS_EVENT:'设备通行',FACE_VERIFIED_ONLY:'刷脸核验',UNKNOWN:'结果待确认'};

export const batchUI = () => ({filters:{},tab:'all',page:1,size:10});
const input = (name,value='',placeholder='',type='text') => `<input name="${name}" type="${type}" value="${e(value)}" placeholder="${e(placeholder)}">`;
const select = (name,values,value) => `<select name="${name}">${values.map(([key,label]) => `<option value="${e(key)}"${key===value?' selected':''}>${e(label)}</option>`).join('')}</select>`;
const choice = (name,items,selected) => select(name,[['','全部'],...items.map(item => [item,item])],selected);
const queryField = (label,control) => formField(label,control,{variant:'field',separator:' '});
const query = fields => filterBar(fields.join('')+actionButton('查询',{variant:'primary',type:'submit'})+actionButton('重置',{attrs:'data-reset'}),'id="m01-filter"');
function listTable(headers,rows,ui,title) {
  const model = paginate(rows,ui.page,ui.size);
  ui.page = model.page;
  return dataTable(headers,model.rows,{caption:title,empty:'没有匹配的记录',reset:true})+pagination(model);
}
const bookingPerson = row => row.people.find(person=>person.role===(row.kind==='货运'?'驾驶人':'来访人'))?.name;
const bookingPurpose = row => row.kind==='货运'?row.purpose:(row.visitPurpose||row.reason);
const bookingVehicle = row => row.plate || (row.hasVehicle===false?'无车':'—');
function visitList(scope,route,ui,guard=false) {
  const f = ui.filters;
  const candidates = guard ? scope.visits.filter(row => approvedForShift(row,scope)) : scope.visits;
  const rows = candidates.filter(row => (ui.tab==='all' || row.kind===modes.find(([key])=>key===ui.tab)?.[1]) &&
    (!f.keyword || row.id.toLowerCase().includes(f.keyword.toLowerCase()) || (!guard && bookingPerson(row)?.includes(f.keyword)) || (guard && (row.plate.includes(f.keyword) || row.people.some(person=>person.name.includes(f.keyword))))) &&
    (!f.date || row.date===f.date) && (!f.status || row.state===f.status) && (!f.dept || row.dept===f.dept) &&
    (!f.host || row.hosts.some(host=>host.name.includes(f.host))) && (!f.purpose || (guard?row.purpose:bookingPurpose(row))===f.purpose));
  const filters = [queryField(guard?'预约号 / 人员 / 车牌':'预约编号 / 姓名',input('keyword',f.keyword,'请输入关键词')),
    queryField(!guard&&ui.tab==='ordinary'?'拜访日期':'预约日期',input('date',f.date,'','date'))];
  if (!guard) filters.push(queryField('访问状态',choice('status',['待入厂','部分离厂','整单结束','未入厂'],f.status)),
    queryField('被访部门',choice('dept',[...new Set(candidates.map(row=>row.dept))],f.dept)),
    queryField('被访人',input('host',f.host,'请输入姓名')));
  if (ui.tab === 'freight') filters.push(queryField(guard?'货运目的':'业务目的',choice('purpose',['发货','送货','发送货'],f.purpose)));
  if (!guard && ui.tab === 'ordinary') filters.push(queryField('拜访目的',choice('purpose',['商务交流','其他'],f.purpose)));
  const rendered = rows.map(row => guard ? tr(
    cell(`<strong class="mono">${e(row.id)}</strong>${small(row.kind+(row.purpose?' · '+row.purpose:''))}`),
    td(windowText(row)),td(row.people.map(person=>person.name).join('、')),td(row.plate||'—'),td(row.cargo||'—'),
    cell(tag(row.qualification)),cell(link('guard-fact','查看详情',route,row.id))
  ) : tr(
    cell(`<strong class="mono">${e(row.id)}</strong>${ui.tab==='all'?small(row.kind):''}`),
    cell(e(bookingPerson(row)||'—')+small('同行 '+Math.max(0,row.people.length-(bookingPerson(row)?1:0))+' 人')),
    cell(e(row.date)+small(row.start+'–'+row.end)),
    cell(e(row.hosts.map(host=>host.name).join('、')||'—')+small(row.dept)),
    `<td class="m01-booking-purpose">${e(bookingPurpose(row)||'—')}</td>`,
    td(bookingVehicle(row)),cell(tag(row.approval)+'<div class="m01-access-status">'+tag(row.state)+'</div>'),cell(link('visit','查看详情',route,row.id))
  ));
  const headers = guard ? ['预约单号 / 类型','计划时段','核验人员','车牌','货物摘要','通行资格','操作'] :
    ['预约编号',ui.tab==='ordinary'?'访客姓名':ui.tab==='freight'?'实际司机姓名':'访客 / 司机',
      ui.tab==='ordinary'?'拜访日期 / 时段':'预约日期 / 时段','被访人 / 部门',
      ui.tab==='ordinary'?'拜访目的':ui.tab==='freight'?'业务目的':'拜访 / 业务目的','车辆信息','审批 / 访问状态','操作'];
  return heading(visitPages[route.page],guard?scope.pointName+' · 当前班次':'按预约日期、访客姓名或被访人查询') +
    `<section class="card m01-table${guard?'':' m01-booking-list'}">${tabList('m01',modes,ui.tab,{label:'预约类型'})}${detailPanel('m01',ui.tab,
      query(filters)+listTable(headers,rendered,ui,visitPages[route.page]))}</section>`;
}

function peopleTable(row,point,includeApplication=false) {
  const headers = ['人员','身份','实际入厂','实际离厂','当前状态'];
  if (includeApplication) headers.splice(2,0,'手机号','身份证号','申请照片');
  const rows = row.people.map(person => {
    const {enter,exit} = personFact(row,person.name,point);
    return tr(td(person.name),td(person.role),...(includeApplication?[td(person.phoneMasked),td(person.identityMasked),cell(tag(person.photoStatus||'未记录'))]:[]),td(stamp(row.date,enter)),
      td(stamp(row.date,exit)),cell(tag(exit?'已离厂':enter?'在厂':'未入厂')));
  });
  return dataTable(headers,rows,{caption:'人员与实际通行',empty:'暂无人员记录'});
}

function eventTable(events,scope,includeLink=false,route,ui) {
  const headers = ['事件编号','人员 / 点位','证据来源','方向','发生时间','上传时间','上报状态'];
  if(includeLink) headers.push('预约');
  const rows = events.map(event => tr(cell(`<span class="mono">${e(event.id)}</span>`),
    cell(e(event.person)+small(scope.points[event.point])),cell(tag(sourceLabels[event.source]||event.source)),
    td(event.direction),td(stamp(event.date||scope.shift.date,event.time)),td(stamp(event.date||scope.shift.date,event.upload)),cell(tag(event.sync)),
    ...(includeLink?[cell(event.visit?link('guard-fact',event.visit,route,event.visit):'—')]:[])));
  return ui?listTable(headers,rows,ui,'通行证据'):dataTable(headers,rows,{caption:'通行证据',empty:'暂无通行证据'});
}

function visitDetail(scope,route,guard=false) {
  const row = scope.visits.find(item => item.id === route.id);
  const parent = guard?'guard-approved':'visits';
  if (!row) return heading(visitPages[route.page])+stateView('missing',{
    title:'记录不存在或无权查看',back:{page:parent,href:routeUrl({page:parent,profile:route.profile}),label:'返回预约列表'}
  });
  const freight = row.kind==='货运';
  const overview = section('预约概况',grid([
    [guard?'预约单号':'预约编号',row.id],['业务类型',row.kind+(row.purpose?' · '+row.purpose:'')],
    ...(guard?[['计划时段',windowText(row)]]:[[freight?'预约日期':'拜访日期',row.date],[freight?'预约时段':'拜访时段',row.start+'–'+row.end]]),
    ['通行资格',row.qualification],
    ...(!guard?[['申请人',row.applicant],['提交时间',row.submitted],['被访人',row.hosts.map(host=>host.name).join('、')],['被访部门',row.dept]]:[])
  ]));
  const freightSection = freight ? section('车辆与货物',grid([
    [guard?'登记车牌':'车牌号',row.plate],[guard?'货运目的':'业务目的',row.purpose],
    ...(!guard?[['物资出门证',row.materialPass===true?'已提供':null]]:[]),['货物描述',row.cargo,'full detail-reason']
  ])) : '';
  const ordinarySection = !freight && !guard ? section('拜访安排',grid([
    ['拜访目的',bookingPurpose(row)],
    ...(row.visitPurpose==='其他'&&row.reason?[['具体拜访目的',row.reason,'full detail-reason']]:[]),
    ['车辆信息',row.plate?'有车':row.hasVehicle===false?'无车':null],...(row.plate?[['车牌号',row.plate]]:[])
  ])) : '';
  const bookingExtras = !guard ? section('补充信息',grid([
    ['备注',row.remarks||(!freight&&row.visitPurpose==='商务交流'?row.reason:null)],...(!freight?[['相关图片',row.attachments===true?'已提供':null]]:[])
  ]))+section('入厂告知',grid(noticeTitles.map((label,i)=>[label,row.notices?.[i]]))) : '';
  const approvals = !guard ? section('审批记录',freight ? grid([['审批状态',row.approval],['业务目的',row.purpose],['节点记录','未提供']])+(row.id==='VIS-261108-06'?'<p class="m01-inline-action"><a class="text" href="?page=approval&amp;id=TK-M01-07" data-route="approval" data-id="TK-M01-07">查看审批记录</a></p>':'') :
    dataTable(['被访人','审批结果','办理时间'],row.hosts.map(host=>tr(td(host.name),cell(tag(host.result)),td(host.at||'—'))),
    {caption:'被访人审批记录',empty:'暂无审批记录'})) : '';
  const qualification = section('通行资格',grid([
    ['审批状态',row.approval],['资格状态',row.qualification],
    ['申请点位快照',(guard?row.allowedAccessPointIds.filter(point=>point===scope.point):row.allowedAccessPointIds).map(point=>scope.points[point]).join('、')||'未生成']
  ]));
  const events = section('核验与设备证据',eventTable(visitEvents(row,scope.point).map(event=>({...event,date:row.date})),scope));
  const people = section(freight?'驾驶人及随行人员':'来访人员',peopleTable(row,scope.point,!guard));
  return heading(guard?'入离厂核验详情':row.kind+'申请详情',row.id,
    tag(row.state)+link(parent,'返回列表',route))+detailStack(overview+freightSection+ordinarySection+(!guard?people:'')+approvals+qualification+(guard?people:'')+bookingExtras+events);
}

function presence(scope,route,ui) {
  const f = ui.filters;
  const rows = scope.visits.filter(row=>visitEvents(row).length && (!f.keyword || row.id.includes(f.keyword) ||
    row.people.some(person=>person.name.includes(f.keyword))) && (!f.status || row.state===f.status));
  const records = rows.flatMap(row=>row.people.map(person=>{
    const {enter,exit}=personFact(row,person.name);
    const events=visitEvents(row).filter(event=>event.person===person.name);
    const late=events.find(event=>event.sync==='离线补传');
    return tr(cell(link('visit',row.id,route,row.id)),td(person.name),td(stamp(row.date,enter)),td(stamp(row.date,exit)),
      td(late?stamp(row.date,late.upload):'—'),cell(tag(exit?'已离厂':enter?'在厂':'未入厂')),cell(tag(row.state)));
  }));
  return heading(visitPages.presence,'按人员查看设备记录与整单访问状态')+`<section class="card m01-table">${query([
    queryField('预约号 / 人员',input('keyword',f.keyword,'请输入关键词')),queryField('整单状态',choice('status',['部分离厂','整单结束','待入厂'],f.status))
  ])}${listTable(['预约单号','人员','实际入厂','实际离厂','补传时间','人员状态','整单状态'],records,ui,'在场与出入记录')}</section>`;
}

const listKinds = ['黑名单','预约自动审批','免普通预约现场刷脸'];
const listAction = (label,action,id='',variant='text') => actionButton(label,{
  variant,attrs:`data-list-action="${action}" data-list-id="${e(id)}"`
});
function policyLists(scope,ui) {
  const {listEditDepartments=[]}=scope;
  const f=ui.filters;
  const rows=scope.lists.filter(row=>(!f.kind||row.kind===f.kind)&&(!f.status||row.status===f.status)&&(!f.keyword||row.name.includes(f.keyword)||row.id.includes(f.keyword)));
  return heading(visitPages['visit-lists'],listEditDepartments.length?'查看名单资格并维护变更草稿':'查看当前授权范围内的名单资格',
    listEditDepartments.length?listAction('新增名单','add','','primary'):'')+detailStack(
    section('名单适用规则',`<div class="m01-facts">${[
      ['黑名单优先','命中有效黑名单时阻断。'],['预约自动审批','普通访客仍需预约，现场须刷脸。'],
      ['免普通预约现场刷脸','仍须在授权点位刷脸；两种白名单均不豁免货运审批。']
    ].map(([title,note])=>`<div><strong>${e(title)}</strong><p>${e(note)}</p></div>`).join('')}</div>`)+
    section('名单记录',query([queryField('名单类型',choice('kind',listKinds,f.kind)),
      queryField('状态',choice('status',['有效','草稿'],f.status)),
      queryField('对象 / 编号',input('keyword',f.keyword,'请输入关键词'))])+listTable(
      ['名单编号','对象','模式','适用范围','有效期','状态','最近审计','操作'],
      rows.map(row=>tr(td(row.id),td(row.name),td(row.kind),td(row.dept+' · '+row.scope),td(row.period),cell(tag(row.status)),td(row.audit),
        cell(!listEditDepartments.includes(row.dept)?'—':row.status==='草稿'?
          listAction('编辑','edit',row.id)+listAction('撤销草稿','discard',row.id):
          row.status==='有效'?listAction('变更','revise',row.id):'—'))),ui,'名单记录'),'m01-list-maintenance'));
}

function openListEditor(button,{route,data,dialog}) {
  const {listAction:action,listId:id}=button.dataset;
  const scope=visitScope(data,route);
  const {listEditDepartments=[]}=scope;
  const row=scope.lists.find(item=>item.id===id&&listEditDepartments.includes(item.dept));
  if (!listEditDepartments.length ||
      (action==='add'?id:(action==='revise'?row?.status!=='有效':row?.status!=='草稿'))) return;
  const title={add:'新增名单',edit:'编辑名单草稿',revise:'变更名单',discard:'撤销名单草稿'}[action];
  if(!title) return;
  const [start,end]=(row?.period||'').split(' 至 ');
  const value=(key,value,type='text',attributes='')=>`<input name="${key}" type="${type}" value="${e(value??'')}" required ${attributes}>`;
  const body=action==='discard'?'<p>撤销后，该草稿将从名单记录中移除。</p>':
    formField('名单对象名称',value('name',row?.name,'text','maxlength="24"'))+
    formField('所属部门',select('dept',(row?[row.dept]:listEditDepartments).map(dept=>[dept,dept]),row?.dept))+
    formField('名单模式',select('kind',listKinds.map(kind=>[kind,kind]),row?.kind))+
    '<div class="m01-list-dates">'+formField('生效日期',value('start',start,'date'))+
    formField('截止日期',value('end',end,'date'))+'</div>'+
    formField('维护原因',value('reason',row?.reason,'text','maxlength="40"'))+
    '<p>保存为草稿，发布前不改变现行资格。</p>';
  openDialog(dialog,`<form data-list-form="${action}" data-list-id="${e(id)}">`+dialogHead(title)+dialogBody(body+formError())+
    dialogFoot(actionButton('取消',{attrs:'data-dialog-close'})+
      actionButton(action==='discard'?'确认撤销':'保存草稿',{type:'submit',variant:'primary'}))+'</form>',
    {onClose:()=>button.isConnected&&button.focus()});
}

export function batchSubmit(form,{route,data,dialog,ui,render}) {
  const action=form.dataset.listForm;
  if(route.page!=='visit-lists'||!action) return false;
  const scope=visitScope(data,route);
  const {listEditDepartments=[]}=scope;
  const id=form.dataset.listId;
  const row=scope.lists.find(item=>item.id===id&&listEditDepartments.includes(item.dept));
  const error=message=>{const alert=form.querySelector('[role=alert]');if(alert) alert.textContent=message;return true;};
  if(!listEditDepartments.length ||
      (action==='add'?id:!['revise','edit','discard'].includes(action)||row?.status!==(action==='revise'?'有效':'草稿'))) return error('暂无维护权限。');
  if(action==='discard') {
    data.lists.splice(data.lists.indexOf(row),1);
  } else {
    const {name,dept,kind,start,end,reason}=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()]));
    if(!name||name.length>24||!reason||reason.length>40||!start||!end||start>end) return error('请填写对象与维护原因，并核对有效期。');
    if(!listEditDepartments.includes(dept)||(row&&row.dept!==dept)||!listKinds.includes(kind)) return error('请核对所属部门和名单模式。');
    if(action==='revise'&&data.lists.some(item=>item.sourceId===id&&item.status==='草稿')) return error('该名单已有变更草稿，请在列表中编辑。');
    const draft={name,dept,kind,scope:kind==='黑名单'?'访客与货运':'普通访客',period:start+' 至 '+end,
      status:'草稿',reason,audit:(action==='edit'?'编辑草稿':'新增草稿')+' · '+reason};
    if(action==='edit') Object.assign(row,draft);
    else {
      let next=1;
      while(data.lists.some(item=>item.id==='LD-'+next)) next++;
      data.lists.unshift({id:'LD-'+next,...draft,...(action==='revise'?{sourceId:id}:{})});
    }
  }
  Object.assign(ui,{filters:{},page:1,listDrafts:data.lists.filter(item=>item.status==='草稿')});
  dialog.close();
  render();
  document.querySelector('[data-list-action="add"]')?.focus();
  return true;
}

function guardHome(scope,route) {
  const pending = scope.visits.filter(row=>approvedForShift(row,scope)).length;
  return heading(visitPages.guard,'核对当前值守点位的预约、人员及通行记录',tag('当班'))+detailStack(
    section('当前值守',grid([['值守人员',scope.shift.actor],['当班点位',scope.pointName],
      ['值守时间',`${scope.shift.date}　${scope.shift.start}–${scope.shift.end}`]]))+
    `<div class="m01-facts m01-destinations">${[
      ['guard-approved','待核验预约',pending],['guard-materials','待归还工牌及物资',scope.materials.filter(row=>row.status==='待归还').length],
      ['guard-events','通行异常与待确认',scope.incidents.length]
    ].map(([page,title,count])=>`<section class="card"><h2>${e(title)}</h2><strong class="m01-metric">${count}</strong>${link(page,'查看记录',route)}</section>`).join('')}</div>`+
    section('最近异常',eventTable(scope.incidents,scope)));
}

function materials(scope,ui) {
  const f=ui.filters;
  const rows=scope.materials.filter(row=>(!f.keyword||[row.id,row.visit,row.holder].some(value=>value.includes(f.keyword)))&&(!f.status||row.status===f.status));
  return heading(visitPages['guard-materials'],scope.pointName+' · 当前班次')+`<section class="card m01-table">${query([
    queryField('编号 / 人员',input('keyword',f.keyword,'请输入关键词')),queryField('状态',choice('status',['待归还','已归还'],f.status))
  ])}${listTable(['领还编号','预约单号','物品','领用人','数量','领用时间','归还时间','状态','操作'],
    rows.map(row=>tr(td(row.id),td(row.visit),td(row.item),td(row.holder),td(row.count),td(row.out),td(row.back||'—'),cell(tag(row.status)),
      cell(actionButton('查看',{variant:'text',attrs:`data-material="${e(row.id)}"`})))),
  ui,'工牌及物资记录')}</section>`;
}

function guardEvents(scope,route,ui) {
  const f=ui.filters;
  const all = scope.visits.flatMap(row=>visitEvents(row,scope.point).map(event=>({...event,visit:row.id,date:row.date}))).concat(scope.incidents);
  const events = all.filter(event=>(!f.source || event.source===f.source) && (!f.keyword || [event.id,event.person,event.visit].some(value=>value?.includes(f.keyword))))
    .sort((a,b)=>(b.date||scope.shift.date).localeCompare(a.date||scope.shift.date)||b.time.localeCompare(a.time));
  return heading(visitPages['guard-events'],scope.pointName+' · 当前班次')+`<section class="card m01-table">${query([
    queryField('事件号 / 人员',input('keyword',f.keyword,'请输入关键词')),
    queryField('证据来源',select('source',[['','全部'],...Object.entries(sourceLabels),['陌生人告警','陌生人告警']],f.source))
  ])}${eventTable(events,scope,true,route,ui)}</section>`;
}

export function batchView(data,route,ui) {
  const scope = visitScope(data,route);
  if (scope.denied) return heading(visitPages[route.page])+stateView('forbidden',{
    title:'暂无访问权限',description:route.profile==='off-duty'?'当前不在值守班次。':route.profile==='other-point'?'当前点位不在授权范围内。':'请联系系统权限管理员。'
  });
  switch(route.page) {
    case 'visits': return visitList(scope,route,ui);
    case 'visit': return visitDetail(scope,route);
    case 'presence': return presence(scope,route,ui);
    case 'visit-lists': return policyLists(scope,ui);
    case 'guard': return guardHome(scope,route);
    case 'guard-approved': return visitList(scope,route,ui,true);
    case 'guard-fact': return visitDetail(scope,route,true);
    case 'guard-materials': return materials(scope,ui);
    case 'guard-events': return guardEvents(scope,route,ui);
  }
}

export function batchClick(button,{route,data,dialog}) {
  if (route.page==='visit-lists' && button.dataset.listAction && data) {
    openListEditor(button,{route,data,dialog});
  } else if (route.page==='guard-materials' && button.dataset.material) {
    const row=visitScope(data,route).materials.find(item=>item.id===button.dataset.material);
    if (row) openDialog(dialog,dialogHead('物资领还详情')+dialogBody(grid([
      ['领还编号',row.id],['预约单号',row.visit],['物品',row.item],['领用人',row.holder],['数量',row.count],
      ['领用时间',row.out],['归还时间',row.back],['状态',row.status]
    ]))+dialogFoot('<button type="button" data-dialog-close>关闭</button>'),{onClose:()=>button.focus()});
  } else return false;
  return true;
}
