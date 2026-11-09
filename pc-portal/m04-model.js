export const attendancePages={
 'attendance-shifts':'班次管理','attendance-schedules':'排班管理','attendance-groups':'班组和考勤地点',
 'attendance-rules':'考勤和加班规则','attendance-records':'出勤记录','attendance-overtime':'加班申请台账',
 'attendance-reports':'出勤报表','attendance-quotas':'假期额度管理'
};
export const reserved='attendance-manual-sign-reserved';
export const isAttendance=page=>Object.hasOwn(attendancePages,page)||page===reserved;
export async function loadAttendance(signal) {
 const response=await fetch(new URL('./m04-fixtures.json',import.meta.url),{signal,cache:'no-store'});
 if(!response.ok) throw new Error('Attendance data unavailable');
 return response.json();
}
export const leaveTypes=['事假','病假','工伤','产假','婚假','丧假','陪产假','哺乳假','调休'];
export const overtimeTypes=['平日厂内','休日厂内','休日出差','节日厂内','节日出差'];
export const categories=['正常工时','年休',...leaveTypes,'厂外出差',...overtimeTypes];
export const shiftTypes=['白班','夜班','内保轮班','休息'];
export function scopeFor(data,route) {
 const grant=data.grant;
 if(route.profile==='denied'||grant?.read!==true) return null;
 const groups=data.groups.filter(g=>grant.teams.includes(g.id)&&grant.departments.includes(g.department));
 const people=data.people.filter(p=>grant.departments.includes(p.department));
 const groupIds=new Set(groups.map(g=>g.id));
 const safeGroups=groups.map(g=>({...g,members:g.members.filter(id=>people.some(p=>p.id===id&&p.department===g.department))}));
 const visible=r=>groupIds.has(r.team)&&people.some(p=>p.id===r.person&&p.department===groups.find(g=>g.id===r.team)?.department);
 const inDate=date=>typeof date==='string'&&date>=grant.from&&date<=grant.to;
 return {grant,groups:safeGroups,people,locations:data.locations.filter(l=>grant.departments.includes(l.department)),
   shifts:data.shifts.filter(s=>s.teams.some(id=>groupIds.has(id))),
   schedules:data.schedules.filter(r=>visible(r)&&inDate(r.date)),
   records:data.records.filter(r=>visible(r)&&inDate(r.date)),
   overtime:data.overtime.filter(r=>visible(r)&&inDate(r.date)),
   reports:data.reports.filter(r=>visible(r)&&inDate(r.date)),
   quotas:grant.actions.includes('quota-read')?data.quotas.filter(visible):[],
   can:action=>grant.actions.includes(action),
   canAllocate:(person,month)=>grant.actions.includes('overtime-allocate')&&grant.allocation?.staff.includes(person)&&grant.allocation?.months.includes(month),inDate};
}
export function shiftHours(s) {
 if(!s||s.type==='休息') return '—';
 return s.start+' – '+(s.overnight?'次日 ':'')+s.end;
}
export function overtimeHours(r) {
 if(r.qualification!=='通过'||r.evidence!=='匹配'||!r.fact) return null;
 if(['休日出差','节日出差'].includes(r.category)) return r.factType==='已生效出差'&&Number.isInteger(r.days)&&r.days>0?r.days*8:null;
 if(r.factType!=='设备记录') return null;
 if(r.category==='平日厂内') {
   if(r.shiftStart!=='08:00'||r.shiftEnd!=='17:00'||!/^\d{2}:\d{2}$/.test(r.exit||'')) return null;
   const [h,m]=r.exit.split(':').map(Number);
   if(h>23||m>59) return null;
   return Math.max(0,Math.floor((h*60+m-1050)/30)/2);
 }
 return ['休日厂内','节日厂内'].includes(r.category)&&Number.isFinite(r.recognized)&&r.recognized>=0?r.recognized:null;
}
export const available=q=>q.total-q.used-q.reserved;
export const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function validateSchedule(scope,r,{existing=false}={}) {
 const g=scope.groups.find(g=>g.id===r.team);
 if(!g||!g.members.includes(r.person)||!scope.people.some(p=>p.id===r.person&&p.active&&p.department===g.department)) return '未建立有效班组或成员不在授权范围';
 if(!validDate(r.date)||!scope.inDate(r.date)) return '日期不在有效授权范围';
 const shift=scope.shifts.find(s=>s.id===r.shift&&s.enabled&&s.teams.includes(g.id));
 if(!shift) return '没有适用的有效班次';
 if(!existing&&scope.schedules.some(s=>s.person===r.person&&s.date===r.date)) return '与已生效排班冲突';
 return '';
}
export function batchErrors(scope,rows) {
 const keys=rows.map(r=>[r.person,r.date].join('/'));
 return rows.map((r,i)=>validateSchedule(scope,r)|| (keys.indexOf(keys[i])!==keys.lastIndexOf(keys[i])?'批次内重复排班':''));
}

export const groupLocationIds = group=>group?.locations??(group?.location?[group.location]:[]);
export const locationNames = (scope,group)=>groupLocationIds(group).map(id=>scope.locations.find(location=>location.id===id)?.name).filter(Boolean).join('、')||'—';
export const punchWindow = (shift,key)=>shift?.type==='休息'?'无需打卡':(shift?.[key]?(shift.overnight&&key==='punchOut'?'次日 ':'')+shift[key].join('–'):'未配置');
export const hasAttendanceFact = (data,row)=>data.records.some(record=>record.person===row.person&&record.date===row.date&&record.events?.length);
export const addDay = (date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export const spanDays = (from,to)=>(Date.parse(to)-Date.parse(from))/86400000;
const minutes = time=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
export function adjacentConflict(scope,rows,row) {
 const own=scope.shifts.find(shift=>shift.id===row.shift);
 if(!own||own.type==='休息') return '';
 for(const delta of [-1,1]) {
   const neighborDate=addDay(row.date,delta);
   const neighbor=rows.find(item=>item.person===row.person&&item.date===neighborDate);
   const other=neighbor&&scope.shifts.find(shift=>shift.id===neighbor.shift);
   if(!neighbor) continue;
   const [first,second]=delta===1?[own,other]:[other,own];
   if(!first||!second) return '相邻班次规则待确认，不能生效';
   if(second.type!=='休息'&&first.overnight&&(!first.end||!second.start||minutes(first.end)>minutes(second.start)))
     return '跨天班次重叠规则待确认，不能生效';
 }
 return '';
}
export function generateRoster(data,scope,rule) {
 const group=scope.groups.find(group=>group.id===rule.team);
 const {from,to}=rule;
 if(!group||!validDate(from)||!validDate(to)||!scope.inDate(from)||!scope.inDate(to)||spanDays(from,to)<0||spanDays(from,to)>30)
   return {error:'请选择授权范围内的班组及不超过 31 天的日期范围'};
 const members=group.members.filter(id=>scope.people.some(person=>person.id===id&&person.active));
 if(!members.length||!groupLocationIds(group).some(id=>scope.locations.some(location=>location.id===id)))
   return {error:'请先维护在职班组成员及考勤通行点'};
 if(rule.mode==='cycle'&&(!rule.sequence?.length||!rule.rotation.length||rule.rotation.some(entry=>
   !Number.isInteger(entry.offset)||entry.offset<0||entry.offset>=rule.sequence.length||
   entry.members.some(id=>!members.includes(id)))||members.some(id=>rule.rotation.filter(entry=>entry.members.includes(id)).length!==1)))
   return {error:'请核对轮换组成员、序列及起始偏移'};
 if(rule.mode==='fixed'&&rule.exceptionPerson&&!members.includes(rule.exceptionPerson)) return {error:'例外员工须为本班组在职成员'};
 if(data.scheduleRules?.some(previous=>previous.team===rule.team&&previous.from<=to&&previous.to>=from))
   return {error:'与已生效班组规则覆盖日期重叠，不能生效'};
 const dates=Array.from({length:spanDays(from,to)+1},(_,i)=>addDay(from,i));
 if(rule.mode==='fixed'&&dates.some(date=>!data.calendar?.[date])) return {error:'该日期工作日历待确认，不能生效'};
 const rows=dates.flatMap((date,index)=>members.map(person=>{
   const rotation=rule.mode==='cycle'?rule.rotation.find(entry=>entry.members.includes(person)):null;
   const exception=rule.mode==='fixed'&&data.calendar[date].working&&rule.exceptionPerson===person;
   const shift=rotation?rule.sequence[(index+rotation.offset)%rule.sequence.length]:
     !data.calendar[date].working?rule.rest:exception?rule.exceptionShift:rule.shift;
   return {team:group.id,person,date,shift,source:rotation?'周期轮班':exception?'员工例外':'固定班次'};
 }));
 const errors=batchErrors({...scope,schedules:data.schedules},rows);
 for(const [i,row] of rows.entries()) {
   const template=scope.shifts.find(shift=>shift.id===row.shift);
   if(!errors[i]&&hasAttendanceFact(data,row)) errors[i]='该日已发生考勤，不能生成排班';
   if(!errors[i]&&template?.type!=='休息'&&(!template?.punchIn||!template.punchOut)) errors[i]='班次打卡窗口未配置';
   if(!errors[i]) errors[i]=adjacentConflict(scope,[...rows,...data.schedules],row);
 }
 return {rows,errors};
}
