import {isApproval,approvalAccount,approvalMenus} from './m02-model.js?v=review-fix';
import {attendancePages,isAttendance} from './m04-model.js';
import {batchGroup,visitPages} from './m01-model.js';
import {accessPages,isAccessPage} from './m06-model.js';

export const pageGroup = page => isAttendance(page)?'attendance-shifts':isAccessPage(page)?'access-places':batchGroup(page);

const visitChildren=['visits','presence','visit-lists'];
const guardChildren=['guard-approved','guard-fact','guard-materials','guard-events'];
const children=pages=>pages.map(page=>[page,visitPages[page]]);
// Product navigation and identity stay outside the shared layout.
export function pcShellContext(route,permissionActor,approvalData) {
 if(isApproval(route.page)) {
   const account=approvalAccount(route,approvalData);
   const children=(approvalData?approvalMenus(account):[['all','全部待办']]).map(([key,label])=>['approvals',label,key]);
   return {group:'approvals', breadcrumb:route.page==='approval'?'统一审批':route.category==='all'?'':'统一审批',
     actor:{name:account.name,label:account.label},pinnedPages:['org'],
     navigation:NAV.map(item=>item.target==='approvals'?{...item,children}:item)};
 }
 if(isAttendance(route.page)) return {
   group:'attendance-shifts', breadcrumb:'考勤排班',
   actor:{name:'苏文宜',label:'考勤排班 · 授权组织范围'}, pinnedPages:['org'], navigation:NAV
 };
 if(isAccessPage(route.page)) return {
   group:'access-places', breadcrumb:'门禁通行',
   actor:{name:'沈晓宜',label:'门禁管理员 · 授权范围'},
   pinnedPages:['org'], navigation:NAV
 };
 const batch=batchGroup(route.page);
 if (batch) return {
   group:batch, breadcrumb:batch==='guard'?'安保值守':'访客与货运',
   actor:batch==='guard'?{name:'何辰宜',label:'安保值守'}:{name:'丁明宜',label:'访客业务 · 授权范围'},
   pinnedPages:['org'], navigation:NAV
 };
 const isOrg=!['approvals','approval'].includes(route.page);
 return {
   group:isOrg?'org':'approvals',
   breadcrumb:isOrg?'组织权限':route.page==='approval'?'统一审批':'',
   actor:permissionActor||{name:'丁明宜',label:isOrg?'人事管理员 · 授权组织范围':'行政部 · 本人有效审批任务'},
   pinnedPages:['org'],
   navigation:NAV
 };
}
const NAV=[
    ['visit','访客与货运','visits'],['list','统一审批','approvals'],['clock','考勤排班','attendance-shifts'],
    ['access','门禁通行','access-places'],['food','智慧食堂',null],['guard','安保值守','guard'],['org','组织权限','org']
  ].map(([glyph,label,target])=>({glyph,label,target,children:target==='attendance-shifts'?Object.entries(attendancePages):target==='access-places'?Object.entries(accessPages):target==='visits'?children(visitChildren):target==='guard'?children(['guard',...guardChildren.filter(page=>page!=='guard-fact')]):target==='org'?[["organization","组织架构"],["org","员工管理"],["cadres","中层领导名单"],["permissions","岗位角色与数据权限"]]:[],collapsedLabel:label}));
