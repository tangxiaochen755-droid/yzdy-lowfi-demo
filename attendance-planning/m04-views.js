import {escapeHtml as e,statusTag as tag,filterBar,formField,actionButton as button,dataTable,paginate,pagination,tabList,stateView,unavailableAction} from './components.js';
import {attendancePages,reserved,scopeFor,shiftHours,overtimeHours,available,categories,overtimeTypes,groupLocationIds,locationNames,punchWindow,validDate} from './m04-model.js?v=f17-rectify';

export const cmd=(action,label,id='',primary=false,extra='')=>button(label,{variant:primary?'primary':'text',attrs:`data-att-action="${action}" data-att-id="${e(id)}" ${extra}`});
export const input=(name,value='',type='text',extra='')=>`<input name="${name}" type="${type}" value="${e(value??'')}" ${extra}>`;
export const select=(name,items,value='',blank='全部')=>`<select name="${name}" ${blank==='请选择'?'required':''}>${blank?`<option value="">${blank}</option>`:''}${items.map(item=>{const [key,label]=Array.isArray(item)?item:[item,item];return `<option value="${e(key)}" ${String(key)===value?'selected':''}>${e(label)}</option>`;}).join('')}</select>`;
export const options=(items,key='name')=>items.map(item=>[item.id,item[key]]);
export const row=(...cells)=>`<tr>${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`;
export const textRow=(...cells)=>row(...cells.map(e));
export const table=(title,headers,rows)=>dataTable(headers,rows,{caption:title});
const results=(title,headers,rows,ui)=>{
 const pg=paginate(rows,ui.page,ui.size);ui.page=pg.page;
 return dataTable(headers,pg.rows,{caption:title,reset:true})+pagination(pg);
};
const card=(title,body,actions='')=>`<section class="card att-card"><div class="card-head"><h2>${e(title)}</h2><div class="actions">${actions}</div></div>${body}</section>`;
const field=(label,ctrl)=>formField(label,ctrl,{variant:'field',separator:' '});
const filter=fields=>filterBar(fields.join('')+button('查询',{variant:'primary',type:'submit'})+button('重置',{attrs:'data-reset'}),'id="m04-filter"');
const meta=value=>`<span class="mono">${e(value)}</span>`;
const note=value=>`<p class="att-note muted">${e(value)}</p>`;
const person=(s,id)=>s.people.find(p=>p.id===id)?.name||'—';
const group=(s,id)=>s.groups.find(g=>g.id===id)?.name||'—';
const shift=(s,id)=>s.shifts.find(x=>x.id===id);
const personLabel=(s,id)=>`${e(person(s,id))} <small class="cell-secondary">${e(id)}</small>`;
const match=(value,q)=>!q||String(value).includes(q);
const groupFilter=(s,f)=>field('班组',select('team',options(s.groups),f.team));
const memberFilter=f=>field('员工',input('person',f.person,'text','placeholder="姓名 / 工号"'));
const dateFilter=f=>[field('起始日期',input('from',f.from,'date')),field('结束日期',input('to',f.to,'date'))];
const visible=(r,s,f)=>(!f.team||f.team===r.team)&&(!f.department||s.people.find(p=>p.id===r.person)?.department===f.department)
 &&match(person(s,r.person)+' '+r.person,f.person)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to);
const stateTag=state=>tag(state,(['已生效','通过','已核算','正常','已修正','启用'].includes(state)?'success':
 ['拒绝','校验失败'].includes(state)?'danger':/待|缺|无有效/.test(state)?'warning':'neutral'));
const tabs=(id,items,current,content)=>tabList(id,items,current)+`<div id="${id}-panel" role="tabpanel" aria-labelledby="${id}-tab-${current}" tabindex="0">${content}</div>`;
const descriptions={
 'attendance-shifts':'维护班次模板、跨天时段及适用班组',
 'attendance-schedules':'按班组查看生效班表，核对调班、导入与版本历史',
 'attendance-groups':'维护组织范围内的班组、成员及考勤地点',
 'attendance-rules':'查询生效政策、适用班次与待确认的规则',
 'attendance-records':'查询原始设备事实、分类结果及补卡修订依据',
 'attendance-overtime':'核对加班资格与事实依据，维护月度工时分配',
 'attendance-reports':'按组织和日期查询考勤分类及修订依据',
 'attendance-quotas':'查看年休额度、待审批占用及历史变动'
};

function shifts(s,ui) {
 const f=ui.filters;
 const shifts=s.shifts.filter(x=>match(x.name+' '+x.id,f.keyword)&&(!f.type||x.type===f.type)&&(!f.status||String(x.enabled)===f.status));
 return card('班次模板',filter([field('班次',input('keyword',f.keyword,'text','placeholder="名称 / 编码"')),field('班制',select('type',['白班','夜班','内保轮班','休息'],f.type)),
  field('状态',select('status',[['true','启用'],['false','停用']],f.status))])+results('班次模板',['班次名称','班制','起止时段','上班有效窗口','下班有效窗口','适用班组','规则版本','状态','操作'],shifts.map(x=>row(
  `${e(x.name)} <small class="cell-secondary">${e(x.id)}</small>`,e(x.type),meta(shiftHours(x)),e(punchWindow(x,'punchIn')),e(punchWindow(x,'punchOut')),e(x.teams.filter(id=>s.groups.some(g=>g.id===id)).map(id=>group(s,id)).join('、')),e(x.rule+' / '+x.version),stateTag(x.enabled?'启用':'停用'),
  cmd('shift-view','查看',x.id)+(s.can('shift-edit')&&x.teams.every(id=>s.groups.some(g=>g.id===id))?cmd('shift-edit','编辑',x.id):''))),ui),
  s.can('shift-edit')&&s.groups.length?cmd('shift-edit','新增班次','',true):'');
}
const dayName=['日','一','二','三','四','五','六'];
const offset=(date,days)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
function scheduleGrid(data,s,f,mode) {
 if(!s.groups.length) return stateView('empty',{title:'暂无可排班的班组',description:'请先建立班组并维护成员与有效班次。'});
 const anchor=f.date||'2026-11-06';
 if(!validDate(anchor)||!s.inDate(anchor)) return stateView('empty',{title:'日期不在授权范围'});
 const start=mode==='month'?anchor.slice(0,7)+'-01':offset(anchor,-((new Date(anchor).getUTCDay()+6)%7));
 const length=mode==='month'?new Date(Date.UTC(+anchor.slice(0,4),+anchor.slice(5,7),0)).getUTCDate():7;
 const dates=Array.from({length},(_,i)=>offset(start,i));
 const members=s.groups.filter(g=>(!f.team||g.id===f.team)&&(!f.department||g.department===f.department)).flatMap(g=>g.members.map(id=>({team:g.id,person:id}))).filter(r=>match(person(s,r.person)+' '+r.person,f.person)&&s.people.some(p=>p.id===r.person&&p.active));
 if(!members.length) return stateView('empty',{title:'没有匹配的班组成员'});
 const dayLabel=date=>date.slice(5)+' 周'+dayName[new Date(date).getUTCDay()];
 const cellContent=(m,date)=>{
   const r=s.schedules.find(x=>x.team===m.team&&x.person===m.person&&x.date===date);
   if(!r) return s.inDate(date)?'<span class="muted">未排班</span>':'<span class="muted">—</span>';
   const sh=shift(s,r.shift);
   return sh?cmd('schedule-view',sh.name,[m.team,m.person,date].join('|'),false,`aria-label="${e(person(s,m.person)+' '+date+' '+sh.name)}"`)+
    (sh.overnight?'<small class="cell-secondary">跨天</small>':'')+(r.source==='临时调整'?'<small class="cell-secondary">已调整</small>':''):stateTag('无有效班次');
 };
 if(mode==='month') {
   if(!f.person||members.length!==1) return stateView('empty',{title:'请选择一名员工查看月排班',description:'按姓名或工号查询，必要时同时选择班组。'});
   return `<div class="att-month" aria-label="月排班">${dates.map(date=>`<div><strong>${e(dayLabel(date))}</strong>
     <small class="cell-secondary">${e(data.calendar?.[date]?.label||'日历待确认')}</small>${cellContent(members[0],date)}</div>`).join('')}</div>`;
 }
 return `<div class="att-calendar">${table('周排班',['成员 / 班组',...dates.map(d=>dayLabel(d)+' · '+(data.calendar?.[d]?.label||'—'))],
   members.map(m=>row(`<strong>${e(person(s,m.person))}</strong><small class="cell-secondary">${e(group(s,m.team))}</small>`,
   ...dates.map(date=>cellContent(m,date)))))}</div>`;
}
function schedules(data,s,ui) {
 const f=ui.filters,mode=['cycle','calendar','history'].includes(ui.tab)?ui.tab:'fixed';
 const scopedGroups=s.groups.filter(g=>(!f.team||g.id===f.team)&&(!f.department||g.department===f.department));
 const department=field('部门',select('department',s.grant.departments,f.department));
 const groupFields=[department,groupFilter(s,f)];
 const active=(data.scheduleRules||[]).filter(r=>scopedGroups.some(g=>g.id===r.team)&&s.inDate(r.from)&&s.inDate(r.to));
 let content='';
 if(mode==='history') {
   const inRange=(from,to)=>(!f.from||to>=f.from)&&(!f.to||from<=f.to);
   const inGroup=id=>scopedGroups.some(g=>g.id===id);
   const batches=data.batches.filter(b=>s.inDate(b.date)&&b.teams?.every(id=>s.groups.some(g=>g.id===id))&&b.teams.some(inGroup)&&
    inRange(b.from||b.date,b.to||b.date)&&(!f.source||(b.source||'已有班表')===f.source)&&(!f.person||
     s.schedules.some(r=>r.version===b.version&&match(person(s,r.person)+' '+r.person,f.person))));
   const changes=data.changes.filter(r=>visible(r,s,f)&&s.inDate(r.date)&&(!f.source||f.source==='临时调整'));
   content=filter([...groupFields,memberFilter(f),...dateFilter(f),field('来源',select('source',['已有班表','固定班次','周期轮班','Excel 导入','临时调整'],f.source))])+
    card('Excel 批次校验',table('Excel 批次校验',['批次编号','文件','行数','操作'],s.can('schedule-import')?data.imports.filter(b=>
     (!f.source||f.source==='Excel 导入')&&b.rows.every(r=>s.groups.some(g=>g.id===r.team)&&s.inDate(r.date))&&
     b.rows.some(r=>inGroup(r.team)&&inRange(r.date,r.date)&&match(person(s,r.person)+' '+r.person,f.person))).map(b=>
      row(e(b.id),e(b.name),e(b.rows.length),cmd('import-preview','预览校验',b.id))):[]))+
    card('已生效批次',table('生效批次',['批次号','状态','生效版本','日期范围','来源','班组 / 人数','操作人 / 时间','排班数'],batches.map(b=>
     row(meta(b.id),stateTag(b.status),meta(b.version),meta(b.from?b.from+' 至 '+b.to:b.date),e(b.source||'已有班表'),e(b.teams.map(id=>group(s,id)).join('、')+' / '+(b.people??new Set(s.schedules.filter(r=>r.version===b.version).map(r=>r.person)).size)+' 人'),e(b.actor)+(b.at?`<small class="cell-secondary">${e(b.at)}</small>`:''),e(b.count)))))+
    card('排班修订',table('调班修订',['员工','班组','日期','原班次 / 版本','调整后 / 版本','操作人','原因','操作时间'],changes.map(r=>
     textRow(person(s,r.person),group(s,r.team),r.date,r.before,r.after,r.actor,r.reason,r.at))));
 } else if(mode==='cycle') {
   const rules=[...active.filter(r=>r.mode==='cycle'),...data.cycle.filter(r=>scopedGroups.some(g=>g.id===r.team))];
   content=filter(groupFields)+table('周期轮班',['班组','轮班顺序','轮换组 / 偏移','起始日期','版本','状态','操作'],rules.map(r=>row(
    e(group(s,r.team)),e(r.sequence.map(id=>shift(s,id)?.name||'—').join(' → ')),
    e(r.rotation?.map((entry,index)=>'组 '+(index+1)+' · '+entry.members.map(id=>person(s,id)).join('、')+' · 偏移 '+entry.offset).join('；')||'—'),
    meta(r.from||r.start),meta(r.version),stateTag('已生效'),s.can('schedule-configure')?cmd('cycle-config','变更',r.team):'—')))+
    note('内保餐补按当月有效排班天数核对。')+(s.can('schedule-configure')&&s.groups.length?note('各轮换组沿用同一序列，从各自的起点开始。'):'');
 } else if(mode==='calendar') {
   content=filter([...groupFields,memberFilter(f),field('所在日期',input('date',f.date||'2026-11-06','date'))])+
    `<div class="list-toolbar"><span>排班视图</span><div class="actions">${cmd('calendar-mode','周排班','week',false,`aria-pressed="${ui.calendarMode!=='month'}"`)}${cmd('calendar-mode','月排班','month',false,`aria-pressed="${ui.calendarMode==='month'}"`)}</div></div>`+
    scheduleGrid(data,s,f,ui.calendarMode==='month'?'month':'week')+note('未排班的日期可通过固定班次或周期轮班配置。');
 } else {
   content=(s.groups.length?'':note('请先建立班组并维护成员与有效班次。'))+filter(groupFields)+table('固定班次',['部门','班组','默认班次','人数','员工例外','日历方式','有效日期','操作'],scopedGroups.map(g=>{
    const r=active.filter(r=>r.team===g.id&&r.mode==='fixed').at(-1);
    return row(e(g.department),e(g.name),e(r?shift(s,r.shift)?.name:'未配置'),e(g.members.length),
     e(r?.exceptionPerson?'1 人 · '+person(s,r.exceptionPerson):'0 人'),e('跟随企业工作日历'),e(r?r.from+' 至 '+r.to:'—'),
     s.can('schedule-configure')?cmd('fixed-config',r?'变更':'配置固定班次',g.id):'—');
   }));
 }
 return card('排班管理',tabs('att-schedule',[['fixed','固定班次'],['cycle','周期轮班'],['calendar','排班日历'],['history','批次与修订']],mode,content),
  mode==='cycle'&&s.can('schedule-configure')&&s.groups.length?cmd('cycle-config','配置周期轮班','',true):
  mode==='history'&&s.can('schedule-import')?cmd('import-list','导入排班预览','',true):'');
}

function groups(s,ui) {
 const f=ui.filters,mode=ui.tab==='locations'?'locations':'groups';
 const search=filter([field('组织',select('department',s.grant.departments,f.department)),field(mode==='groups'?'班组':'地点',input('keyword',f.keyword,'text','placeholder="名称 / 编码"'))]);
 const loc=s.locations.filter(x=>(!f.department||x.department===f.department)&&match(x.name+' '+x.id,f.keyword));
 const gr=s.groups.filter(x=>(!f.department||x.department===f.department)&&match(x.name+' '+x.id,f.keyword));
 const content=mode==='locations'?results('考勤地点',['地点编号','考勤地点','关联通行点','所属部门','适用班组','操作'],loc.map(l=>row(meta(l.id),e(l.name),e(l.pointId||'—'),e(l.department),e(s.groups.filter(g=>groupLocationIds(g).includes(l.id)).map(g=>g.name).join('、')||'—'),s.can('group-edit')?cmd('location-edit','编辑',l.id):'—')),ui):
  results('班组列表',['班组名称','所属部门','考勤地点','成员数','操作'],gr.map(g=>row(`${e(g.name)} <small class="cell-secondary">${e(g.id)}</small>`,e(g.department),e(groupLocationIds(g).filter(id=>s.locations.some(l=>l.id===id)).length+' 个 · '+locationNames(s,g)),e(g.members.filter(id=>s.people.some(p=>p.id===id)).length),cmd('group-view','查看成员',g.id)+(s.can('group-edit')?cmd('group-edit','编辑',g.id):''))),ui);
 return card('班组与地点',tabs('att-group',[['groups','班组列表'],['locations','考勤地点']],mode,search+content),
  s.can('group-edit')?cmd(mode==='groups'?'group-edit':'location-edit',mode==='groups'?'新增班组':'新增地点','',true):'');
}
function rules(s) {
 const policies=[
  ['ATT-R01','设备出勤与补卡','需打卡人员按当天生效班次核对设备事实；免打卡不产生缺卡，仍须遵守门禁核验。无有效班次转排班核对。','有权考勤范围'],
  ['ATT-R02','内保轮班','内保按生效轮班认定排班天数，作为餐补核对依据。','内保轮班组'],
  ['ATT-R03','特定白班加班','08:00–17:00 班次的平日厂内加班从 17:30 起算，按半小时向下取整。','适用白班'],
  ['ATT-R04','休日及节日出差','资格与已生效出差事实匹配后，每天计 8 小时。','授权组织']];
 return card('生效规则',`<div class="list-toolbar"><span>生效版本 · ATT-POL-V1</span>${tag('只读','neutral')}</div>`+
  table('生效规则',['规则编号','规则名称','规则摘要','适用范围'],policies.filter(p=>p[0]!=='ATT-R02'||s.shifts.some(sh=>sh.type==='内保轮班')).map(x=>textRow(...x))))+
  card('待确认规则',table('待确认规则',['事项','处理方式','状态'],[
    ['跨天换班及补卡边界','按生效班次展示，暂不设置计算参数'],['加班审批岗位及补审权限','查看现有资格与事实，不开放审批配置'],['月度分配比例及调整规则','暂不设置默认比例或工资规则']
   ].map(x=>row(...x.map(e),tag('待确认','warning')))));
}
function records(s,ui) {
 const f=ui.filters,mode=['result','facts','correction'].includes(ui.tab)?ui.tab:'result';
 const records=s.records.filter(r=>visible(r,s,f)&&(!f.state||r.state===f.state));
 let body;
 if(mode==='facts') body=results('设备原始事实',['事件编号','员工','发生时间','设备编号','来源','操作'],records.flatMap(r=>r.events.map(ev=>row(meta(ev.id),personLabel(s,r.person),meta(ev.occurredAt),meta(ev.deviceId),e(ev.source),cmd('record-view','查看',r.id)))),ui);
 else if(mode==='correction') body=results('缺卡与修订',['员工','日期','缺卡时段','申请单号','审批结果','修订编号','操作'],records.filter(r=>r.correction).map(r=>row(personLabel(s,r.person),meta(r.date),e(r.correction.missing),meta(r.correction.id),stateTag(r.correction.status),meta(r.correction.revision),cmd('record-view','查看依据',r.id))),ui);
 else body=results('出勤结果',['员工','日期','班组','班次 / 版本','考勤分类','状态','操作'],records.map(r=>row(personLabel(s,r.person),meta(r.date),e(group(s,r.team)),e(shift(s,r.shift)?.name||'—')+`<small class="cell-secondary">${e(r.version)}</small>`,e(r.category),stateTag(r.state),cmd('record-view','查看',r.id))),ui);
 return card('出勤台账',tabs('att-record',[['result','考勤结果'],['facts','设备原始记录'],['correction','缺卡与修订']],mode,
  filter([groupFilter(s,f),memberFilter(f),...dateFilter(f),field('状态',select('state',['正常','已修正','缺上班卡','缺下班卡','免打卡','无有效排班'],f.state))])+body));
}
function overtime(data,s,ui) {
 const f=ui.filters,mode=ui.tab==='allocations'?'allocations':'ledger';
 const ledger=s.overtime.filter(r=>visible(r,s,f)&&(!f.category||r.category===f.category)&&(!f.qualification||r.qualification===f.qualification));
 const body=mode==='ledger'?filter([groupFilter(s,f),memberFilter(f),field('加班类别',select('category',overtimeTypes,f.category)),field('资格',select('qualification',['通过','拒绝','结果待确认'],f.qualification))])+results('加班申请',['申请单号','员工','日期','类别','资格','事实核对','认定工时','操作'],ledger.map(r=>{
  const h=overtimeHours(r);
  return row(meta(r.id),personLabel(s,r.person),meta(r.date),e(r.category),stateTag(r.qualification),r.evidence==='匹配'?tag('匹配','info'):tag('待确认','warning'),h==null?'—':meta(h+' 小时'),cmd('overtime-view','查看',r.id));
 }),ui):allocationList(data,s,ui);
 return card('加班台账',tabs('att-overtime',[['ledger','加班申请'],['allocations','月度分配']],mode,body));
}
export function allocationTotal(s,personId,month) {
 return s.overtime.filter(r=>r.person===personId&&r.date.startsWith(month+'-')).reduce((n,r)=>n+(overtimeHours(r)||0),0);
}
function allocationList(data,s,ui) {
 const f=ui.filters,month=f.month||'2026-11';
 const people=s.people.filter(p=>match(p.name+' '+p.id,f.person)&&p.active&&allocationTotal(s,p.id,month)>0);
 return filter([memberFilter(f),field('月份',input('month',month,'month'))])+table('月度工时',['员工','月份','认定工时','调休分配','加班费分配','未分配','操作'],people.map(p=>{
  const a=data.allocations.filter(x=>x.person===p.id&&x.month===month).at(-1), total=allocationTotal(s,p.id,month);
  return row(personLabel(s,p.id),meta(month),e(total+' 小时'),e(a?.rest??'—'),e(a?.pay??'—'),e(total-(a?.rest||0)-(a?.pay||0)+' 小时'),
   s.canAllocate(p.id,month)?cmd('allocate',a?'调整分配':'分配',p.id+'|'+month):'—');
 }))+note('分配仅记录调休和加班费所对应的工时。')+
 table('分配流水',['员工','月份','原分配（调休 / 加班费）','本次分配（调休 / 加班费）','操作人','原因'],data.allocations.filter(a=>people.some(p=>p.id===a.person)&&a.month===month).map(a=>textRow(person(s,a.person),a.month,a.before,a.rest+' / '+a.pay,a.actor,a.reason)));
}
function reports(s,ui) {
 const f=ui.filters, rows=[...new Map(s.reports.filter(r=>visible(r,s,f)&&(!f.category||r.category===f.category)&&(!f.state||r.state===f.state)).map(r=>[r.id,r])).values()];
 const summary=categories.filter(c=>!f.category||f.category===c).map(c=>[c,rows.filter(r=>r.category===c).reduce((n,r)=>n+(r.amount||0),0)]);
 return card('出勤分类统计',filter([field('部门',select('department',s.grant.departments,f.department)),groupFilter(s,f),memberFilter(f),...dateFilter(f),
   field('分类',select('category',[...categories,'待排班'],f.category)),field('结果',select('state',['已核算','待排班'],f.state))])+
  `<div class="att-metrics" aria-label="分类汇总">${summary.map(([c,n])=>`<span>${e(c)} <strong>${e(n)}</strong> 小时</span>`).join('')}</div>`+
  results('出勤报表',['员工','日期','班组','分类','时数','结果','依据'],rows.map(r=>row(personLabel(s,r.person),meta(r.date),e(group(s,r.team)),e(r.category),r.amount==null?'—':meta(r.amount+' '+r.unit),stateTag(r.state),r.revision&&s.records.some(x=>x.person===r.person&&x.date===r.date&&x.correction?.revision===r.revision&&x.correction.status==='通过')?cmd('revision-view',r.revision,r.id):'—')),ui),
  unavailableAction('导出报表','需要专项导出权限','att-export'));
}
function quotas(s,ui) {
 const f=ui.filters;
 const q=s.quotas.filter(r=>visible(r,s,f)&&(!f.period||r.period===f.period));
 return card('年休额度',filter([groupFilter(s,f),memberFilter(f),field('核算年度',select('period',[...new Set(s.quotas.map(q=>q.period))],f.period))])+
  results('年休额度',['员工','核算周期','总额度（天）','已用（天）','待审批占用（天）','可用（天）','状态','操作'],q.map(r=>row(personLabel(s,r.person),meta(r.period),e(r.total),e(r.used),e(r.reserved),`<strong>${e(available(r))}</strong>`,stateTag(r.status),cmd('quota-view','额度明细',r.id))),ui)+
  note('每年 4 月 1 日至次年 3 月 31 日。累计工龄满 20 年最高 15 天；离职折算由 HR 离职业务触发。'));
}
export function attendanceView(data,route,ui) {
 const s=scopeFor(data,route);
 if(!s||(route.page==='attendance-quotas'&&!s.can('quota-read'))) return stateView('forbidden',{title:'暂无访问权限',description:'如需查看，请联系系统权限管理员。'});
 if(route.page===reserved) return stateView('neutral',{title:'人工补签暂未开放'});
 const views={shifts:()=>shifts(s,ui),schedules:()=>schedules(data,s,ui),groups:()=>groups(s,ui),rules:()=>rules(s),records:()=>records(s,ui),overtime:()=>overtime(data,s,ui),reports:()=>reports(s,ui),quotas:()=>quotas(s,ui)};
 return `<div class="page-head"><div><h1>${e(attendancePages[route.page])}</h1><p class="muted tiny">${e(descriptions[route.page])}</p></div></div><div class="att-stack">${ui.notice?`<p class="att-result" role="status">${e(ui.notice)}</p>`:''}${views[route.page.slice(11)]()}</div>`;
}
