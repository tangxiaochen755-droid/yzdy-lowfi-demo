export const approvalCategories = {
  all:'全部待办', visits:'访客与货运', affairs:'员工事务', attendance:'考勤管理', canteen:'智慧食堂'
};
const types = {
  visitor:['visits','普通访客',['普通访客申请','普通访客预约']],
  freight:['visits','货运预约',['货运预约','货运申请']],
  leave:['affairs','请假申请',['请假申请']],
  annual:['affairs','年休申请',['年休申请','年休假申请']],
  trip:['affairs','出差申请',['出差申请']],
  exit:['affairs','临时出门证',['临时出门证']],
  correction:['attendance','当天补卡',['当天补卡']],
  lunch:['canteen','南园午餐申请',['南园午餐申请']],
  meal:['canteen','员工手工用券',['员工手工用券']],
  deptMeal:['canteen','部门用券申请',['部门用券申请']]
};
const head='部门负责人审批', host='被访人审批', second='行政部独立复核';
const duty=(type,node,...departments)=>({type,node,departments});
const departmentDuties=['leave','annual','trip','exit','correction','lunch','meal','deptMeal'].map(type=>duty(type,head,'行政部'));
const accounts={
  combined:{id:'PC-LJ',name:'丁明宜',label:'兼岗审批',grants:[
    ...departmentDuties,duty('visitor',host,'行政部','销售部'),duty('freight','审批记录待核对','销售部'),duty('deptMeal',second,'销售部')
  ]},
  host:{id:'PC-ZC',name:'唐知宜',label:'被访人审批',grants:[duty('visitor',host,'行政部')]},
  lead:{id:'PC-LJ',name:'丁明宜',label:'部门负责人',grants:departmentDuties},
  review:{id:'PC-LJ',name:'丁明宜',label:'行政独立复核',grants:[duty('deptMeal',second,'销售部')]},
  empty:{id:'PC-GWQ',name:'苏文宜',label:'部门负责人',grants:departmentDuties},
  revoked:{id:'PC-LJ',name:'丁明宜',label:'审批权限已失效',grants:[]}
};
export const isApproval = page=>page==='approvals'||page==='approval';
export const approvalProfile = key=>!key?'combined':Object.hasOwn(accounts,key)?key:'revoked';
export const approvalCategory = key=>Object.hasOwn(approvalCategories,key)?key:'all';
export const approvalAccount = (route,data)=>data?.access?.approvals===false?accounts.revoked:accounts[approvalProfile(route.approvalProfile)];
export function approvalTypes(account,category) {
  const authorized=new Set(account.grants.map(grant=>grant.type));
  return Object.entries(types).filter(([key,[group]])=>authorized.has(key)&&(category==='all'||category===group))
    .map(([key,[,label]])=>[key,label]);
}
export function approvalMenus(account) {
  return Object.entries(approvalCategories).filter(([key])=>key==='all'||approvalTypes(account,key).length);
}
export function approvalType(task) {
  return Object.entries(types).find(([,spec])=>spec[2].includes(task.type))?.[0];
}
export const isVisitorApproval = task=>['visitor','freight'].includes(approvalType(task));
const approvalDepartment = task=>isVisitorApproval(task)?task.approvalDepartment:task.dept;
export const isUnknownTask = task=>task.resultState==='UNKNOWN'||task.status==='UNKNOWN';
export const taskDecisionKey = task=>JSON.stringify([task.assigneeId,task.id]);
function taskGrant(account,task) {
  return task.assigneeId===account.id&&account.grants.find(grant=>
    grant.type===approvalType(task)&&grant.node===task.node&&grant.departments.includes(approvalDepartment(task)));
}
export function readableTask(account,task) {
  return Boolean(task&&taskGrant(account,task)&&task.status!=='已撤权'&&(!task.actualAssigneeId||task.actualAssigneeId===account.id)&&
    (task.status==='已处理'||(task.canHandle!==false&&task.assignmentActive!==false)));
}
export function taskEligibility(account,task) {
  if(!readableTask(account,task)||task.reference||task.status!=='待处理'||isUnknownTask(task)||
    task.prerequisitesMet===false) return false;
  if(approvalType(task)==='deptMeal'&&task.node===second) {
    const first=task.history?.find(entry=>entry.node===head&&entry.result==='同意'&&entry.actorId);
    if(!first||first.actorId===account.id) return false;
  }
  return true;
}
export const taskVersion = task=>task.version??1;
export const taskBatchKey = task=>JSON.stringify([approvalType(task),task.node,approvalDepartment(task),task.authorityId??'']);
export function decideTask(account,task,expectedVersion,result,opinion) {
  if(!taskEligibility(account,task)||taskVersion(task)!==expectedVersion||task.decisionId)
    return {status:'失败',reason:'权限、任务状态或版本已变化'};
  if(task.outcome==='failure') return {status:'失败',reason:'任务提交失败'};
  if(task.outcome==='unknown') {
    task.resultState='UNKNOWN';
    return {status:'待核对',reason:'处理结果待核对'};
  }
  const decisionId='DEC-'+task.id+'-'+expectedVersion;
  Object.assign(task,{status:'已处理',result,opinion,decisionId,version:expectedVersion+1,
    handledAt:new Date().toLocaleDateString('sv-SE')+' '+new Date().toTimeString().slice(0,5),actualAssignee:account.name,actualAssigneeId:account.id});
  return {status:'成功',reason:result,decisionId};
}
