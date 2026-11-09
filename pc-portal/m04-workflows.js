import {escapeHtml as e,formField,actionButton as button,openDialog,dialogHead,dialogBody,dialogFoot,formError,statusTag as tag} from './components.js';
import {detailField,detailSection} from './detail-primitives.js';
import {scopeFor,shiftTypes,shiftHours,overtimeHours,available,validateSchedule,batchErrors,groupLocationIds,locationNames,punchWindow,generateRoster,adjacentConflict,hasAttendanceFact} from './m04-model.js?v=f17-rectify';
import {cmd,input,select,options,row,textRow,table,allocationTotal} from './m04-views.js?v=f17-rectify';

const name=(s,id)=>s.people.find(p=>p.id===id)?.name;
const group=(s,id)=>s.groups.find(g=>g.id===id);
const shift=(s,id)=>s.shifts.find(x=>x.id===id);
const code=(label,id)=>e(label||id);
const field=(label,html)=>formField(label,html);
const details=(title,pairs)=>detailSection(title,`<div class="compact-descriptions two">${pairs.map(([k,v])=>detailField(k,v)).join('')}</div>`);
const reason=()=>field('原因（必填）','<textarea name="reason" maxlength="120" required></textarea>');
const actions=new Map([
 ['shift-edit',['attendance-shifts','shift-edit']],['shift-view',['attendance-shifts']],
 ['group-edit',['attendance-groups','group-edit']],['group-view',['attendance-groups']],['location-edit',['attendance-groups','group-edit']],
 ['fixed-config',['attendance-schedules','schedule-configure']],['cycle-config',['attendance-schedules','schedule-configure']],
 ['rule-preview',['attendance-schedules','schedule-configure']],['rule-activate',['attendance-schedules','schedule-activate']],['calendar-mode',['attendance-schedules']],
 ['schedule-view',['attendance-schedules']],['schedule-revisions',['attendance-schedules']],['schedule-adjust',['attendance-schedules','schedule-adjust']],
 ['import-list',['attendance-schedules','schedule-import']],['import-preview',['attendance-schedules','schedule-import']],['activate',['attendance-schedules','schedule-activate']],
 ['record-view',['attendance-records']],['overtime-view',['attendance-overtime']],['allocate',['attendance-overtime','overtime-allocate']],
 ['revision-view',['attendance-reports']],['quota-view',['attendance-quotas','quota-read']]
]);
function allowed(context,action) {
 const spec=actions.get(action);
 const s=context.data&&scopeFor(context.data,context.route);
 return s&&spec?.[0]===context.route.page&&(!spec[1]||s.can(spec[1]))?s:null;
}
function dialog(context,title,body,{action='',id='',submit='保存',drawer=false}={}) {
 const markup=dialogHead(title)+dialogBody(body+(action?formError():''))+dialogFoot(
  button(action?'取消':'关闭',{attrs:'data-dialog-close'})+
  (action?button(submit,{type:'submit',variant:'primary'}):''));
 openDialog(context.dialog,action?`<form data-att-form="${action}" data-att-id="${e(id)}">${markup}</form>`:markup,{drawer,onClose:()=>{
  if(!context.dialog.open) context.trigger?.isConnected&&context.trigger.focus();
 }});
}
const checkbox=(name,key,label,on)=>`<label><input type="checkbox" name="${name}" value="${e(key)}" ${on?'checked':''}>${e(label)}</label>`;
const checkGroup=(label,controls)=>`<fieldset class="att-options"><legend>${e(label)}</legend><div>${controls.join('')}</div></fieldset>`;
const readonly=(label,values)=>details(label,values);
function showShift(c,s,id,edit) {
 const sh=shift(s,id);
 if(id&&!sh) return;
 if(!edit) return sh&&dialog(c,'班次详情',details('班次信息',[['班次编码',sh.id],['班次名称',sh.name],['班制',sh.type],['起止时段',shiftHours(sh)],['上班有效打卡窗口',punchWindow(sh,'punchIn')],['下班有效打卡窗口',punchWindow(sh,'punchOut')],['适用班组',sh.teams.map(id=>group(s,id)?.name).filter(Boolean).join('、')],['状态',sh.enabled?'启用':'停用'],['版本',sh.version],['关联规则',sh.rule]]));
 if(sh?.teams.some(id=>!group(s,id))||!s.groups.length) return;
 const grid=`<div class="att-edit-grid">${field('班次编码（必填）',input('code',sh?.id,'text',sh?'readonly':'required maxlength="20"'))}
  ${field('班次名称（必填）',input('name',sh?.name,'text','required maxlength="30"'))}
  ${field('班制（必填）',select('type',shiftTypes,sh?.type,'请选择'))}
  ${field('状态',select('enabled',[['true','启用'],['false','停用']],String(sh?.enabled??true),''))}
  ${field('开始时间',input('start',sh?.start,'time'))}${field('结束时间',input('end',sh?.end,'time'))}
  ${field('关联规则',select('rule',[['—','无'],['ATT-R01','设备出勤与补卡'],['ATT-R02','内保轮班'],['ATT-R03','特定白班加班']],sh?.rule||'—',''))}
  <label class="att-inline"><input type="checkbox" name="overnight" ${sh?.overnight?'checked':''}> 结束时间为次日</label></div>`;
 const windows=`<fieldset class="att-options"><legend>有效打卡窗口</legend><div>
  ${[['inFrom','上班窗口起点','punchIn',0],['inTo','上班窗口终点','punchIn',1],
     ['outFrom','下班窗口起点','punchOut',0],['outTo','下班窗口终点','punchOut',1]].map(([name,label,key,index])=>field(label,input(name,sh?.[key]?.[index],'time'))).join('')}</div>
  <p>跨天班次的下班窗口属于次日。有效打卡窗口与准时出勤分别判断。休息班无需设置窗口。</p></fieldset>`;
 const referenced=sh&&shiftReferenced(c.data,sh.id);
 dialog(c,sh?'编辑班次':'新增班次',(referenced?'<p>该班次已有生效排班引用。请新增模板供后续排班使用。</p>':'')+grid+windows+checkGroup('适用班组（必填）',s.groups.map(g=>checkbox('teams',g.id,g.name,sh?.teams.includes(g.id)))),{action:'shift-edit',id,drawer:true});
}
function showGroup(c,s,id,edit) {
 const g=group(s,id);
 if(id&&!g) return;
 if(!edit) return g&&dialog(c,'班组成员',details('班组信息',[['班组',g.name],['组织',g.department],['考勤通行点',locationNames(s,g)]])+
  table('班组成员',['姓名','工号','所属部门'],s.people.filter(p=>p.department===g.department&&g.members.includes(p.id)).map(p=>textRow(p.name,p.id,p.department))),{drawer:true});
 const deps=s.grant.departments,department=g?.department||deps[0];
 if(!department) return;
 dialog(c,g?'编辑班组':'新增班组',`<div class="att-edit-grid">${field('班组名称（必填）',input('name',g?.name,'text','required maxlength="30"'))}
  ${field('所属部门',select('department',g?[department]:deps,department,''))}
  </div>`+groupPoints(s,department,g)+
  '<p>点位用于本班组考勤识别，调整会影响班组成员可识别的考勤地点。</p>'+
  checkGroup('班组成员（必填）',s.people.filter(p=>p.active&&p.department===department).map(p=>checkbox('members',p.id,p.name+' · '+p.id,g?.members.includes(p.id)))),{action:'group-edit',id,drawer:true});
}
function groupPoints(s,department,g) {
 return checkGroup('考勤通行点（可多选）',s.locations.filter(l=>l.department===department)
   .map(l=>checkbox('locations',l.id,l.name,groupLocationIds(g).includes(l.id))));
}
export function attendanceChange(target,c) {
 if(target.name==='team'&&target.form?.dataset.attForm==='rule-preview') {
   const s=allowed(c,'rule-preview');
   const g=s&&group(s,target.value);
   if(g) target.form.querySelector('[data-rule-team]').innerHTML=ruleTeamFields(s,g,target.form.dataset.attId);
   return true;
 }
 if(target.name!=='department'||target.form?.dataset.attForm!=='group-edit'||target.form.dataset.attId) return false;
 const s=allowed(c,'group-edit');
 if(!s?.grant.departments.includes(target.value)) return true;
 const form=target.form,dep=target.value;
 const [points,members]=form.querySelectorAll('fieldset');
 points.outerHTML=groupPoints(s,dep);
 members.outerHTML=checkGroup('班组成员（必填）',s.people.filter(p=>p.active&&p.department===dep).map(p=>checkbox('members',p.id,p.name+' · '+p.id,false)));
 return true;
}
function showLocation(c,s,id) {
 const l=s.locations.find(x=>x.id===id);
 if(id&&!l||!s.grant.departments.length) return;
 dialog(c,l?'编辑考勤地点':'新增考勤地点',`<div class="att-edit-grid">${field('地点名称（必填）',input('name',l?.name,'text','required maxlength="40"'))}
  ${field('所属部门',select('department',l?[l.department]:s.grant.departments,l?.department,''))}</div>`,{action:'location-edit',id});
}
const scheduleByKey=(s,id)=>s.schedules.find(r=>[r.team,r.person,r.date].join('|')===id);
function showSchedule(c,s,id) {
 const r=scheduleByKey(s,id),sh=r&&shift(s,r.shift);
 if(!r) return;
 dialog(c,'生效排班',details('排班信息',[['员工',name(s,r.person)],['班组',group(s,r.team)?.name],['日期',r.date],['生效版本',r.version],['班次',sh?.name],['班次时段',shiftHours(sh)],['上班有效打卡窗口',punchWindow(sh,'punchIn')],['下班有效打卡窗口',punchWindow(sh,'punchOut')],['考勤通行点',locationNames(s,group(s,r.team))],['来源',r.source||'已有班表'],['规则编号',r.ruleId]])+
  (r.source==='临时调整'?`<div class="att-dialog-actions">${cmd('schedule-revisions','查看修订记录',id)}</div>`:'')+
  (s.can('schedule-adjust')&&!hasAttendanceFact(c.data,r)?`<div class="att-dialog-actions">${cmd('schedule-adjust','临时调班',id,true)}</div>`:hasAttendanceFact(c.data,r)?'<p>该日已发生考勤，不能调整生效排班。</p>':''),{drawer:true});
}
function adjustSchedule(c,s,id) {
 const r=scheduleByKey(s,id);
 if(!r||hasAttendanceFact(c.data,r)) return;
 dialog(c,'临时调班',readonly('当前生效安排',[['员工',name(s,r.person)],['日期',r.date],['班次 / 版本',shift(s,r.shift)?.name+' / '+r.version]])+
  field('调整后班次（必填）',select('shift',options(s.shifts.filter(sh=>sh.enabled&&sh.teams.includes(r.team)&&sh.id!==r.shift)),'','请选择'))+
  input('version',r.version,'hidden')+reason(),{action:'schedule-adjust',id,submit:'确认调班'});
}
function canReviewBatch(s,b) {
 return b?.rows?.length&&b.rows.every(r=>group(s,r.team)&&s.people.some(p=>p.id===r.person&&p.department===group(s,r.team).department)&&s.inDate(r.date));
}
function importList(c,s) {
 const list=c.data.imports.filter(b=>canReviewBatch(s,b));
 dialog(c,'导入排班预览',table('待核对批次',['批次编号','文件名','排班数','操作'],list.map(b=>row(e(b.id),e(b.name),e(b.rows.length),cmd('import-preview','预览校验',b.id))))+
  '<p class="att-note">正式文件格式待确认，暂不支持上传新文件。</p>',{drawer:true});
}
const importErrors=(data,scope,rows)=>batchErrors({...scope,schedules:data.schedules},rows)
 .map((error,i)=>error||(hasAttendanceFact(data,rows[i])?'该日已发生考勤，不能导入排班':'')||adjacentConflict(scope,[...rows,...data.schedules],rows[i]));
function importPreview(c,s,id) {
 const b=c.data.imports.find(b=>b.id===id);
 if(!canReviewBatch(s,b)) return;
 const errs=importErrors(c.data,s,b.rows),done=c.data.batches.some(x=>x.id===id);
 const status=done?'已生效':errs.some(Boolean)?'校验失败':'校验通过';
 dialog(c,'排班批次校验',details('批次信息',[['批次编号',id],['文件名',b.name],['校验结果',status],['总行数',b.rows.length],['通过行数',done?b.rows.length:errs.filter(x=>!x).length],['失败行数',done?0:errs.filter(Boolean).length]])+
  table('校验明细',['员工','排班日期','班次','校验结果'],b.rows.map((r,i)=>row(e(name(s,r.person)),e(r.date),code(shift(s,r.shift)?.name,r.shift),errs[i]&&!done?tag(errs[i],'danger'):tag('通过','success'))))+
  (status==='校验失败'?'<p class="att-note">本批次未生效，原排班保持不变。</p>':''),
  status==='校验通过'&&s.can('schedule-activate')?{action:'activate',id,submit:'确认生效',drawer:true}:{drawer:true});
}
function recordDetails(c,s,r,fromReport=false) {
 const correction=r.correction;
 const task=correction?.taskLink&&s.can('task-read')&&correction.task==='TK261106004'&&r.person==='YD9004'&&r.date==='2026-11-06';
 const orig=table('原始设备事件',['事件编号','发生时间','设备编号','来源'],r.events.map(ev=>textRow(ev.id,ev.occurredAt,ev.deviceId,ev.source)));
 let correctionBody='';
 if(correction) correctionBody=details('本人补卡与修订依据',[['申请单号',correction.id],['缺卡时段',correction.missing],
  ['审批岗位','部门负责人'],['审批结果',correction.status],['审批任务编号',correction.task],['修订编号',correction.status==='通过'?correction.revision:null],
  ['追加修正',correction.status==='通过'?correction.adjusted:null],['操作角色',correction.actor]])+
  (correction.paused?'<p class="att-note">部门负责人暂停接新任务，申请仍待处理。</p>':'')+
  (task&&!fromReport?`<div class="att-dialog-actions"><a class="text" href="?page=approval&amp;id=${e(correction.task)}">查看统一审批任务</a></div>`:'');
 dialog(c,fromReport?'报表修订依据':'出勤记录详情',details('考勤结果',[['员工',name(s,r.person)],['日期',r.date],['班组',group(s,r.team)?.name],['生效班次',shift(s,r.shift)?.name],['生效版本',r.version],['考勤状态',r.state],['分类',r.category]])+
  detailSection('原始设备记录（只读）',orig)+correctionBody,{drawer:true});
}
function overtimeDetails(c,s,r) {
 const hours=overtimeHours(r);
 const rule=r.category==='平日厂内'&&r.shiftStart==='08:00'&&r.shiftEnd==='17:00'?'17:30 起算，每半小时向下取整':
 ['休日出差','节日出差'].includes(r.category)?'已生效出差按每天 8 小时':null;
 dialog(c,'加班认定详情',details('申请与资格',[['申请单号',r.id],['员工',name(s,r.person)],['日期',r.date],['加班类别',r.category],['资格编号',r.qualificationId],['资格结果',r.qualification]])+
  details('事实与工时',[['事实类型',r.factType],['事实编号',r.fact],['事实核对',r.evidence],['班次',r.shiftStart&&r.shiftStart+'–'+r.shiftEnd],['结束时间',r.exit],['核算口径',rule],['认定工时',hours==null?'未认定':hours+' 小时'],['本人加班券资格',hours>0&&r.voucher?'满足发券资格 · 由食堂账户查询':'未确认']]),{drawer:true});
}
function showAllocation(c,s,id) {
 const [person,month]=id.split('|'),total=allocationTotal(s,person,month);
 if(!s.people.some(p=>p.id===person&&p.active)||!s.canAllocate(person,month)||total<=0) return;
 const a=c.data.allocations.filter(x=>x.person===person&&x.month===month).at(-1);
 dialog(c,'月度工时分配',details('工时依据',[['员工',name(s,person)],['月份',month],['认定工时',total+' 小时']])+
  `<div class="att-edit-grid">${field('调休工时（必填）',input('rest',a?.rest,'number',`required min="0" max="${total}" step="any"`))}
  ${field('加班费对应工时（必填）',input('pay',a?.pay,'number',`required min="0" max="${total}" step="any"`))}</div>`+reason(),{action:'allocate',id});
}
function quotaDetails(c,s,q) {
 dialog(c,'年休额度明细',details('额度信息',[['员工',name(s,q.person)],['核算周期',q.period],['累计工龄',q.years],['总额度',q.total+' 天'],['已用',q.used+' 天'],['待审批占用',q.reserved+' 天'],['可用',available(q)+' 天']])+
  table('额度变动记录',['流水号','业务状态','额度变化'],q.history.map(x=>textRow(...x)))+
  '<p class="att-note">离职折算由 HR 离职业务触发，折算方式待确认。</p>',{drawer:true});
}
export function attendanceClick(trigger,c) {
 const action=trigger.dataset.attAction,id=trigger.dataset.attId||'';
 if(!action) return false;
 const s=allowed(c,action);
 if(!s) return true;
 c.trigger=c.dialog.open?c.dialog.attTrigger||trigger:trigger;
 c.dialog.attTrigger=c.trigger;
 if(c.dialog.open) {
  c.dialog.addEventListener('close',()=>dispatch(c,s,action,id),{once:true});
  c.dialog.close();
 } else dispatch(c,s,action,id);
 return true;
}
function dispatch(c,s,action,id) {
 if(action==='calendar-mode'&&['week','month'].includes(id)) {c.ui.calendarMode=id;c.render();return;}
 if(action==='fixed-config'||action==='cycle-config') showRule(c,s,id,action==='fixed-config'?'fixed':'cycle');
 if(action.startsWith('shift-')) showShift(c,s,id,action==='shift-edit');
 if(action.startsWith('group-')) showGroup(c,s,id,action==='group-edit');
 if(action==='location-edit') showLocation(c,s,id);
 if(action==='schedule-view') showSchedule(c,s,id);
 if(action==='schedule-revisions') {
   const roster=scheduleByKey(s,id);
   if(roster) dialog(c,'排班修订记录',table('该日修订',['原班次 / 版本','调整后 / 版本','原因','操作人','时间'],
    c.data.changes.filter(row=>row.team===roster.team&&row.person===roster.person&&row.date===roster.date)
      .map(row=>textRow(row.before,row.after,row.reason,row.actor,row.at))),{drawer:true});
 }
 if(action==='schedule-adjust') adjustSchedule(c,s,id);
 if(action==='import-list') importList(c,s);
 if(action==='import-preview') importPreview(c,s,id);
 if(action==='record-view') {const r=s.records.find(r=>r.id===id);if(r)recordDetails(c,s,r);}
 if(action==='revision-view') {
  const rp=s.reports.find(r=>r.id===id),r=rp?.revision&&s.records.find(r=>r.person===rp.person&&r.date===rp.date&&r.correction?.revision===rp.revision&&r.correction.status==='通过');
  if(r) recordDetails(c,s,r,true);
 }
 if(action==='overtime-view') {const r=s.overtime.find(r=>r.id===id);if(r)overtimeDetails(c,s,r);}
 if(action==='allocate') showAllocation(c,s,id);
 if(action==='quota-view') {const r=s.quotas.find(r=>r.id===id);if(r)quotaDetails(c,s,r);}
}
const nextVersion=v=>'V'+((Number(v?.slice(1))||0)+1);
const shiftReferenced=(data,id)=>data.schedules.some(row=>row.shift===id)||
 (data.scheduleRules||[]).some(rule=>[rule.shift,rule.rest,rule.exceptionShift,...(rule.sequence||[])].includes(id));
function saveShift(data,s,id,v,f) {
 const sh=shift(s,id),teams=[...new Set(f.getAll('teams'))];
 if(id&&(!sh||sh.teams.some(id=>!group(s,id)))) return '班次不在授权范围';
 if(id&&shiftReferenced(data,id)) return '班次已有生效排班引用，不能修改或停用。请新增模板。';
 if(!v.name||!shiftTypes.includes(v.type)||!teams.length||teams.some(id=>!group(s,id))) return '请填写班次名称、班制及适用班组';
 if(!id&&(!/^[A-Za-z0-9-]{1,20}$/.test(v.code)||data.shifts.some(x=>x.id===v.code))) return '班次编码无效或已存在';
 const rest=v.type==='休息',overnight=!rest&&f.has('overnight');
 const time=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 if(!rest&&(!time(v.start)||!time(v.end)||(overnight?v.start<=v.end:v.start>=v.end))) return '请核对班次时间及是否跨天';
 if(!['—','ATT-R01','ATT-R02','ATT-R03'].includes(v.rule)||!['true','false'].includes(v.enabled)) return '请核对规则及状态';
 if(v.rule==='ATT-R03'&&(rest||overnight||v.start!=='08:00'||v.end!=='17:00')) return '特定白班加班规则只适用于 08:00–17:00 班次';
 if(v.rule==='ATT-R02'&&(v.type!=='内保轮班')) return '内保轮班规则仅适用于内保轮班组';
 const punchIn=rest?null:[v.inFrom,v.inTo],punchOut=rest?null:[v.outFrom,v.outTo];
 if(!rest&&[punchIn,punchOut].some(([from,to])=>!time(from)||!time(to)||from>=to)) return '请填写上下班有效打卡窗口，并核对区间顺序';
 const saved={punchIn,punchOut,id:id||v.code,name:v.name,type:v.type,start:rest?'':v.start,end:rest?'':v.end,overnight,teams,enabled:v.enabled==='true',version:nextVersion(sh?.version),rule:rest?'—':v.rule};
 if(sh) Object.assign(sh,saved); else data.shifts.push(saved);
 return '';
}
function saveGroup(data,s,id,v,f) {
 const g=group(s,id),members=[...new Set(f.getAll('members'))];
 const locations=[...new Set(f.getAll('locations'))];
 if(id&&(!g||g.department!==v.department)) return '班组不在授权范围';
 if(!v.name||!s.grant.departments.includes(v.department)||(!locations.length||locations.some(id=>!s.locations.some(l=>l.id===id&&l.department===v.department)))) return '请填写班组名称并选择同部门考勤地点';
 if(!members.length||members.some(id=>!s.people.some(p=>p.id===id&&p.active&&p.department===v.department))) return '请选择同部门在职成员';
 if(g&&data.schedules.some(r=>r.team===id&&!members.includes(r.person))) return '成员仍有生效排班，请先核对排班';
 const saved={name:v.name,department:v.department,locations,members};
 if(g) Object.assign(data.groups.find(x=>x.id===id),saved);else {
  const next='G-'+String(data.groups.length+1).padStart(2,'0');
  data.groups.push({id:next,...saved});
  data.grant.teams.push(next);
 }
 return '';
}
function saveLocation(data,s,id,v) {
 const l=s.locations.find(x=>x.id===id);
 if(id&&(!l||l.department!==v.department)) return '考勤地点不在授权范围';
 if(!v.name||!s.grant.departments.includes(v.department)) return '请填写授权组织内的考勤地点';
 if(l) l.name=v.name;else data.locations.push({id:'L-'+String(data.locations.length+1).padStart(2,'0'),name:v.name,department:v.department});
 return '';
}
function saveAdjustment(data,s,id,v) {
 const r=scheduleByKey(s,id);
 if(r&&hasAttendanceFact(data,r)) return '该日已发生考勤，不能调整生效排班';
 if(!r||v.version!==r.version) return '生效版本已变化，请重新打开排班';
 const next={...r,shift:v.shift,source:'临时调整'};
 const error=validateSchedule(s,next,{existing:true})||adjacentConflict(s,data.schedules,next);
 if(error) return error;
 if(r.shift===v.shift||!v.reason) return '请选择不同班次并填写原因';
 next.version='PB-ADJ-'+String(data.changes.length+1).padStart(3,'0');
 data.changes.push({...next,before:shift(s,r.shift)?.name+' / '+r.version,after:shift(s,v.shift)?.name+' / '+next.version,actor:s.grant.actor,reason:v.reason,at:new Date().toLocaleString('sv-SE')});
 Object.assign(r,next);
 return '';
}
function activateBatch(data,s,id) {
 const b=data.imports.find(b=>b.id===id);
 if(!canReviewBatch(s,b)||!s.can('schedule-import')||data.batches.some(x=>x.id===id)) return '批次不可生效或已处理';
 if(importErrors(data,s,b.rows).some(Boolean)) return '批次存在校验冲突，原排班未修改';
 const version=id+'-V1';
 data.schedules.push(...b.rows.map(r=>({...r,version,source:'Excel 导入'})));
 data.batches.push({id,version,status:'已生效',date:b.rows[0].date,from:b.rows.map(r=>r.date).sort()[0],to:b.rows.map(r=>r.date).sort().at(-1),source:'Excel 导入',actor:s.grant.actor,at:new Date().toLocaleString('sv-SE'),people:new Set(b.rows.map(r=>r.person)).size,count:b.rows.length,teams:[...new Set(b.rows.map(r=>r.team))]});
 return '';
}
function allocate(data,s,id,v) {
 const [person,month]=id.split('|'),total=allocationTotal(s,person,month),rest=Number(v.rest),pay=Number(v.pay);
 if(!s.people.some(p=>p.id===person&&p.active)||!/^\d{4}-\d{2}$/.test(month)||!s.canAllocate(person,month)||total<=0) return '没有可分配的已认定工时';
 if(!v.rest||!v.pay||!Number.isFinite(rest)||!Number.isFinite(pay)||rest<0||pay<0||rest+pay>total||!v.reason) return '请核对分配工时，合计不得超过已认定工时，并填写原因';
 const prev=data.allocations.filter(a=>a.person===person&&a.month===month).at(-1);
 if((prev?.rest??0)===rest&&(prev?.pay??0)===pay) return '分配结果未变化';
 data.allocations.push({id:'OA-'+(data.allocations.length+1),person,month,rest,pay,before:prev?prev.rest+' / '+prev.pay:'未分配',actor:s.grant.actor,reason:v.reason});
 return '';
}
export function attendanceSubmit(form,c) {
 const action=form.dataset.attForm,id=form.dataset.attId||'';
 if(!action) return false;
 const s=allowed(c,action);
 const f=new FormData(form),v=Object.fromEntries([...f].map(([k,v])=>[k,v.trim()]));
 let error='暂无操作权限';
 if(s&&action==='rule-preview') return previewRule(c,s,id,v,f,form);
 if(s) {
  const handlers={'shift-edit':saveShift,'group-edit':saveGroup,'location-edit':saveLocation,'schedule-adjust':saveAdjustment,activate:activateBatch,'rule-activate':()=>activateRule(c,s,id),allocate};
  error=handlers[action]?.(c.data,s,id,v,f)??error;
 }
 if(error) {const message=form.querySelector('[role=alert]');if(message) message.textContent=error;return true;}
 if(c.route.page!=='attendance-overtime') c.saveF17?.(c.data);
 c.dialog.close();
 c.ui.notice=({'schedule-adjust':'调班已生效',activate:'排班批次已生效','rule-activate':'排班规则及日期班表已生效',allocate:'月度分配已保存'})[action]||'保存成功';
 c.render();
 document.querySelector('.att-result')?.setAttribute('tabindex','-1');
 document.querySelector('.att-result')?.focus();
 return true;
}

function ruleTeamFields(scope,group,mode) {
 const shifts=scope.shifts.filter(shift=>shift.enabled&&shift.teams.includes(group.id));
 const members=scope.people.filter(person=>person.active&&group.members.includes(person.id));
 if(mode==='fixed') return '<div class="att-edit-grid">'+
  field('默认班次',select('shift',options(shifts.filter(shift=>shift.type!=='休息')),'','请选择'))+
  field('非工作日班次',select('rest',options(shifts.filter(shift=>shift.type==='休息')),'','请选择'))+
  field('例外员工',select('exceptionPerson',options(members),'','无例外'))+
  field('例外班次',select('exceptionShift',options(shifts),'','请选择班次'))+'</div>'+
  '<p>跟随企业工作日历。例外仅影响所选员工在本规则范围内的工作日。</p>';
 return '<div class="att-edit-grid">'+[1,2,3,4].map(i=>field('序列第 '+i+' 天',select('step'+i,options(shifts),'',i<3?'请选择':'不设置'))).join('')+
  field('A 组偏移',input('offsetA',0,'number','min="0" max="3" required'))+
  field('B 组偏移',input('offsetB',1,'number','min="0" max="3" required'))+'</div>'+
  checkGroup('B 组成员',members.map(person=>checkbox('rotationB',person.id,person.name,false)))+
  '<p>未勾选的成员属于 A 组。每人仅属于一个轮换组，按相同序列从各自起点轮换。</p>';
}
function showRule(c,scope,id,mode) {
 const g=group(scope,id)||(!id?scope.groups[0]:null);
 if(!g) return;
 const previous=(c.data.scheduleRules||[]).filter(rule=>rule.team===g.id&&rule.mode===mode).at(-1);
 const summary=previous?details('现行规则',[['版本',previous.version],['覆盖日期',previous.from+' 至 '+previous.to],
   ['班次',previous.mode==='fixed'?shift(scope,previous.shift)?.name:previous.sequence.map(id=>shift(scope,id)?.name).join(' → ')]]):'';
 dialog(c,mode==='fixed'?'配置固定班次':'配置周期轮班',summary+field('班组',select('team',options(id?[g]:scope.groups),g.id,''))+
  '<div class="att-edit-grid">'+field('起始生效日期',input('from','','date','required'))+
  field('生成截止日期',input('to','','date','required'))+'</div>'+
  '<div data-rule-team>'+ruleTeamFields(scope,g,mode)+'</div>',{action:'rule-preview',id:mode,submit:'预览并校验',drawer:true});
}
function previewRule(c,scope,mode,v,f,form) {
 const g=group(scope,v.team);
 const error=message=>{form.querySelector('[role=alert]').textContent=message;return true;};
 if(!g||!['fixed','cycle'].includes(mode)) return error('班组或规则不在授权范围');
 const {from,to}=v;
 const rule={mode,team:g.id,from,to};
 if(mode==='fixed') {
   if(!v.shift||shift(scope,v.shift)?.type==='休息'||shift(scope,v.rest)?.type!=='休息'||Boolean(v.exceptionPerson)!==Boolean(v.exceptionShift))
     return error('请核对默认班次、休息班次及例外设置');
   Object.assign(rule,{shift:v.shift,rest:v.rest,exceptionPerson:v.exceptionPerson,exceptionShift:v.exceptionShift});
 } else {
   const sequence=[v.step1,v.step2,v.step3,v.step4];
   if(!v.step1||!v.step2||!v.step3&&v.step4) return error('请选择连续的轮班序列');
   const b=f.getAll('rotationB');
   const a=g.members.filter(id=>!b.includes(id)&&scope.people.some(person=>person.id===id&&person.active));
   if(!a.length||b.length&&(!v.offsetB||v.offsetB===v.offsetA)||!v.offsetA) return error('请为轮换组设置不同的有效偏移');
   Object.assign(rule,{sequence:sequence.filter(Boolean),rotation:[{members:a,offset:Number(v.offsetA)},...(b.length?[{members:b,offset:Number(v.offsetB)}]:[])]});
 }
 const preview=generateRoster(c.data,scope,rule);
 if(preview.error) return error(preview.error);
 c.ui.rulePreview=rule;
 const blocked=preview.errors.filter(Boolean).length;
 const body=details('规则与影响范围',[['班组',g.name],['日期',from+' 至 '+to],
   ['影响员工',new Set(preview.rows.map(row=>row.person)).size+' 人'],
   ['班次规则',mode==='fixed'?shift(scope,rule.shift)?.name:rule.sequence.map(id=>shift(scope,id)?.name).join(' → ')],
   ['生成结果',preview.rows.length+' 行，通过 '+(preview.rows.length-blocked)+' 行，失败 '+blocked+' 行']])+
   table('日期班表校验',['员工','日期','班次','来源','校验结果'],preview.rows.map((row,i)=>textRow(name(scope,row.person),row.date,
     shift(scope,row.shift)?.name,row.source,preview.errors[i]||'通过')))+
   (blocked?'<p>存在冲突，本次排班不能生效。</p>':'');
 c.dialog.addEventListener('close',()=>dialog(c,'日期班表预览',body,blocked||!scope.can('schedule-activate')?
  {drawer:true}:{action:'rule-activate',id:mode,submit:'确认生效',drawer:true}),{once:true});
 c.dialog.close();
 return true;
}
function activateRule(c,scope,id) {
 const rule=c.ui.rulePreview;
 if(!scope.can('schedule-configure')||!rule||rule.mode!==id) return '排班预览已失效或无配置权限';
 const preview=generateRoster(c.data,scope,rule);
 if(preview.error||preview.errors.some(Boolean)) return preview.error||'校验存在冲突，本次排班不能生效';
 const data=c.data;
 data.scheduleRules??=[];
 const ruleId='SR-'+String(data.scheduleRules.length+1).padStart(3,'0');
 const version=ruleId+'-V1';
 const source=id==='fixed'?'固定班次':'周期轮班';
 data.scheduleRules.push({...rule,id:ruleId,version});
 data.schedules.push(...preview.rows.map(row=>({...row,ruleId,version})));
 data.batches.push({id:ruleId,version,source,status:'已生效',date:rule.from,from:rule.from,to:rule.to,actor:scope.grant.actor,at:new Date().toLocaleString('sv-SE'),
  teams:[rule.team],people:new Set(preview.rows.map(row=>row.person)).size,count:preview.rows.length});
 c.ui.rulePreview=null;
 return '';
}
