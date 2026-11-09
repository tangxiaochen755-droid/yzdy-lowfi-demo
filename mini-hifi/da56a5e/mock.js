// All objects are fictional page snapshots. No cross-page store or persistence.
export const TODAY='2026-11-06';
export const actors={
 employee:{name:'周明',id:'YD0108',department:'销售部',position:'客户经理',attendance:true,tasks:false,guard:false,onDuty:false,departmentVoucher:false},
 approver:{name:'李静',id:'YD0216',department:'行政部',position:'部门负责人',attendance:true,tasks:true,guard:false,onDuty:false,departmentVoucher:true},
 guard:{name:'陈安',id:'YD0309',department:'安保处',position:'值守人员',attendance:false,tasks:false,guard:true,onDuty:true,point:'东门',departmentVoucher:false},
 hybrid:{name:'林川',id:'YD0312',department:'安保处',position:'部门负责人',attendance:true,tasks:true,guard:true,onDuty:true,point:'东门',departmentVoucher:true},
 offDuty:{name:'陈安',id:'YD0309',department:'安保处',position:'值守人员',attendance:false,tasks:false,guard:true,onDuty:false,departmentVoucher:false},
 exempt:{name:'许宁',id:'YD0418',department:'综合部',position:'外包员工',attendance:false,tasks:false,guard:false,onDuty:false,departmentVoucher:false},
 noSchedule:{name:'周明',id:'YD0108',department:'销售部',position:'客户经理',attendance:true,noSchedule:true,tasks:false,guard:false,onDuty:false,departmentVoucher:false}
};
export const pageRoutes=[
 {key:'home',path:'/mini/home',label:'内部员工首页',id:'HM-IN-01',external:false},
 {key:'booking',path:'/mini/external/booking',label:'外部预约首页',id:'HM-EX-01',external:true},
 {key:'work',path:'/mini/work',label:'工作',id:'HM-IN-02',external:false},
 {key:'canteen',path:'/mini/canteen',label:'食堂',id:'HM-IN-03',external:false},
 {key:'me',path:'/mini/me',label:'内部 · 我的',id:'HM-IN-04',external:false},
 {key:'requests',path:'/mini/external/requests',label:'外部 · 我的预约',id:'HM-EX-02',external:true},
 {key:'externalMe',path:'/mini/external/me',label:'外部 · 我的',id:'HM-EX-03',external:true}
];
// Fictional directory shared by the booking form and reservation snapshots.
export const visitDirectory=[
 {id:'YD0108',name:'周明',phone:'00000000001',department:'销售部',points:['东门']},
 {id:'YD0216',name:'李静',phone:'00000000002',department:'行政部',points:['东门','北门']},
 {name:'张敏',phone:'00000000003',department:'技术部',points:['北门']}
];
const visitProfiles={
 林远:{phone:'138****6802',identity:'32**************18',photo:true},
 方晴:{identity:'32**************26',photo:true},
 赵平:{identity:'32**************31',photo:true}
};
const reservations=[
 {id:'VIS-20261106-018',owner:'EXT-01',type:'ordinary',title:'商务交流',company:'远成机电',date:'2026-11-06',period:'14:00—16:00',purpose:'商务交流',noticeConsents:[true,true],hasVehicle:false,hosts:[visitDirectory[0]],people:2,status:'approved',statusLabel:'已通过',tone:'success',names:['林远','方晴'],evidence:[]},
 {id:'FRT-20261106-006',owner:'EXT-01',type:'freight',title:'零部件送货',company:'远成机电',purpose:'送货',plate:'苏K·A0B18',date:'2026-11-06',period:'09:00—11:00',hosts:[visitDirectory[1],visitDirectory[2]],materialPass:true,noticeConsents:[true,true],people:2,status:'in',statusLabel:'访问中',tone:'info',names:['林远','赵平'],evidence:[{name:'林远',text:'设备入厂 09:08 · 已离厂 10:25'},{name:'赵平',text:'设备入厂 09:10 · 尚无离厂记录'}]},
 {id:'VIS-20261109-012',owner:'EXT-01',type:'ordinary',title:'技术方案沟通',company:'远成机电',date:'2026-11-09',period:'09:00—11:00',purpose:'其他',visitReason:'技术方案沟通',hosts:[visitDirectory[1]],people:1,status:'pending',statusLabel:'待审批',tone:'warning',names:['林远'],evidence:[]},
 {id:'VIS-20261103-009',owner:'EXT-01',type:'ordinary',title:'项目交流',company:'远成机电',date:'2026-11-03',period:'14:00—16:00',purpose:'其他',visitReason:'项目交流',hosts:[visitDirectory[0]],people:1,status:'finished',statusLabel:'已结束',tone:'neutral',names:['林远'],evidence:[{name:'林远',text:'设备入厂 14:03 · 设备离厂 15:47'}]},
 {id:'FRT-20261102-003',owner:'EXT-01',type:'freight',title:'零部件发货',company:'远成机电',purpose:'发货',plate:'苏K·A0B18',date:'2026-11-02',period:'09:00—11:00',hosts:[visitDirectory[2]],people:1,status:'rejected',statusLabel:'未通过',tone:'danger',names:['林远'],reason:'本次预约信息需核实，申请未通过。',evidence:[]}
];
export function getPagePreset(key,actorKey,scenario='normal'){
 const actor={...(actors[actorKey]||actors.employee)};
 const requests=scenario==='empty'?[]:reservations.filter(x=>x.owner==='EXT-01').map(r=>({...r,
  participants:r.names.map(name=>({name,...visitProfiles[name]})),
  accessPoints:[...new Set(r.hosts.flatMap(host=>host.points))]
 }));
 return structuredClone({key,actor,scenario,externalUser:{name:'林远',id:'EXT-01',phone:'138****6802',company:'远成机电'},
 requests,
 hostVisits:key==='work'?requests.filter(r=>r.hosts.some(host=>host.id===actor.id)):[],
 approvalTasks:!actor.tasks||scenario==='empty'?[]:[
  {name:'林宁',type:'请假',title:'请假申请',date:'2026-11-06',summary:'2026-11-09 13:00—17:30'},
  {name:'方敏',type:'请假',title:'请假申请',date:'2026-11-05',summary:'2026-11-10 08:30—12:00'},
  {name:'许宁',type:'临时出门',title:'临时出门申请',date:'2026-11-06',summary:'2026-11-06 14:00—15:00'}
 ],
 guardVisitors:scenario==='empty'?[]:[{name:'林远',purpose:'商务交流',period:'11月06日 14:00—16:00'}],
 recent:scenario==='empty'?[]:[{id:'REQ-20261106-011',name:'请假申请',date:'11月06日',status:'审批中',tone:'warning',
  leave:{type:'事假',start:'2026-11-09 08:30',end:'2026-11-09 17:30',duration:'1 天',reason:'处理家庭事务',submittedAt:'11月06日 09:15',pendingNode:'部门负责人审批'}},
  {id:'REQ-20261105-007',name:'加班申请',date:'11月05日',status:'已通过',tone:'success'}],
 balance:'128.50',canteenMonthly:{subsidy:'100.00',spent:'72.50'},vouchers:scenario==='empty'?[]:[{id:'TKT-011',name:'员工餐券',status:'可用',tone:'success',channel:'人脸',holder:actor.name},{id:'TKT-008',name:'员工餐券',status:'已使用',tone:'neutral',channel:'人脸',holder:actor.name}],
 menu:[{name:'香菇炖鸡',category:'荤菜',price:'8.00'},{name:'番茄炒蛋',category:'家常菜',price:'5.00'},{name:'清炒时蔬',category:'素菜',price:'3.00'},{name:'米饭',category:'主食',price:'1.00'}],
 // Two clearly named demo fixtures, not a claim about real canteen names,
 // count, default selection, or production menu-access permissions.
 canteens:[
  {id:'demo-a',name:'食堂 A',publishedDays:[2,3,4,5,6],dishes:[{name:'香菇炖鸡',category:'荤菜',price:'8.00'},{name:'番茄炒蛋',category:'家常菜',price:'5.00'},{name:'清炒时蔬',category:'素菜',price:'3.00'},{name:'米饭',category:'主食',price:'1.00'}]},
  {id:'demo-b',name:'食堂 B',publishedDays:[2,3,5,6,7],dishes:[{name:'土豆炖牛肉',category:'荤菜',price:'8.00'},{name:'香干炒肉丝',category:'家常菜',price:'5.00'},{name:'蒜蓉青菜',category:'素菜',price:'3.00'},{name:'米饭',category:'主食',price:'1.00'}]}
 ]
 });
}
export function localAction(action,payload,{scenario,actor}){
 if(scenario==='forbidden')return {status:'forbidden',message:'当前账号无权执行此操作。'};
 if(scenario==='unknown')return {status:'unknown',message:'暂时无法确认提交结果，请先查询原申请，勿重复提交。'};
 if(action==='approval'&&!actor.tasks)return {status:'forbidden',message:'当前没有分派给您的有效审批任务。'};
 return {status:'success',message:'预约已提交，待审批。',payload};
}
