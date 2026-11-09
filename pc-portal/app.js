import {isApproval,approvalProfile,approvalCategory,approvalAccount,readableTask,taskVersion,taskDecisionKey,taskBatchKey} from './m02-model.js?v=review-fix';
import {approvalState,approvalsView,approvalAction,selectApproval,rejectApprovalBatch} from './m02-views.js?v=review-fix';
import {attendancePages,isAttendance,loadAttendance,reserved as attendanceReserved} from './m04-model.js?v=f17-rectify';
import {attendanceView} from './m04-views.js?v=f17-rectify';
import {attendanceClick,attendanceSubmit,attendanceChange} from './m04-workflows.js?v=f17-rectify';
import {accessPages,isAccessPage,loadAccessData} from './m06-model.js';
import {accessView,accessClick,accessSubmit} from './m06-views.js';
import {visitPages,loadVisitData,readProfile} from './m01-model.js?v=list-maintenance-fix';
import {batchUI,batchView,batchClick,batchSubmit} from './m01-views.js?v=list-maintenance-fix';
import {pcShellContext,pageGroup} from './pc-navigation.js?v=m02-review-fix';
import {staffDetailView,approvalDetailView,handleDetailDecision} from './detail-views.js?v=m02-review-fix';
import {permissionsView, permissionClick, permissionSubmit, permissionChange, permissionKeydown, resetPermissions} from './permissions.js';
import {extendedView, handleExtendedClick, handleExtendedSubmit, prepareData, updateJobOptions, updateHireFields, showProfileInvalid, workflowNotice, canEditEmployeeProfile} from './organization-workflows.js?v=m06-org-grants';
import {filterBar, formField, actionButton, treeItem, tabDestination, escapeHtml as e, statusTag as tag, dataTable, paginate, pagination, tabList, stateView, unavailableAction} from './components.js';
import {loadPageData} from './data-adapter.js';
import {shellMarkup, routeUrl, routeKey} from './shell.js?v=m02-review-fix';
import {icon} from './icons.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const departments = ['全部部门','行政部','销售部','生产一部','生产二部','质量管理部','技术研发部','财务部'];
const defaultOrg = () => ({dept:'全部部门', keyword:'', status:'', treeSearch:'', page:1, size:10});
const approvalDecisions = new Map();
const ui = {collapsed:false, openGroup:'org', visited:[{page:'org',title:'员工管理'}], org:defaultOrg(), approvals:approvalState(), staffTab:'base'};
const batchStates = new Map();
const isBatch = () => Boolean(pageGroup(route.page));
const batchState = () => {
  if (!batchStates.has(route.page)) batchStates.set(route.page,batchUI());
  return batchStates.get(route.page);
};
let route = readRoute();
ui.openGroup = pageGroup(route.page) || (isApproval(route.page)?'approvals':'org');
let data = null;
let phase = 'loading';
let generation = 0;
let controller;
let accessConfig;
let f17Session;
let f17GrantKey;
const f17Pages=new Set(['attendance-shifts','attendance-groups','attendance-schedules']);
function saveF17(data) {
  const keys=['shifts','groups','locations','schedules','scheduleRules','batches','changes'];
  f17Session={key:f17GrantKey,teams:[...data.grant.teams],data:structuredClone(Object.fromEntries(keys.map(key=>[key,data[key]])))};
}
let modalTrigger;

function readRoute() {
  const params = new URLSearchParams(location.search);
  const page = params.get('page') || 'org';
  return {page,id:params.get('id') || (page==='staff'?'YD9001':''),profile:readProfile(params.get('profile')),category:approvalCategory(params.get('category')),approvalProfile:approvalProfile(params.get('approvalProfile'))};
}
function employeeById(id) { return data?.employees?.find(row => row.id === id); }
function employee() { return employeeById(route.id); }
function pageTitle() { return (isAttendance(route.page)?(attendancePages[route.page]||'人工补签'):isAccessPage(route.page)?accessPages[route.page]:isBatch()?visitPages[route.page]:'') || ({organization:'组织架构',cadres:'中层领导名单',approval:'审批详情',permissions:'岗位角色与数据权限'})[route.page] || (route.page === 'org' ? '员工管理' : route.page === 'staff' ? '员工档案' : route.page === 'approvals' ? '统一审批' : '页面不存在'); }
function rememberView() {
  if(route.page===attendanceReserved) return;
  if (!isBatch() && !['org','staff','approvals','organization','cadres','approval','permissions'].includes(route.page)) return;
  const key = routeKey(route);
  const readableStaff = phase === 'ready' && data?.access.staff !== false ? employee() : null;
  const title = route.page === 'staff' ? `员工档案${readableStaff ? ' · ' + readableStaff.name : ''}` : route.page === 'org' ? '员工管理' : route.page === 'approval' ? '审批详情 · '+route.id : pageTitle();
  const old = ui.visited.find(view => routeKey(view) === key);
  if (old) Object.assign(old,route,{title});
  else ui.visited.push({...route, title});
}
function navigate(next, {replace = false} = {}) {
  const createdEmployee = route.page==='org' && next.page==='staff' && data?.createdEmployeeIds?.has(next.id)
    ? employeeById(next.id) : null;
  if (dialog.open) dialog.close();
  const sameEmployee = next.page === 'staff' && next.id === route.id;
  const category=approvalCategory(next.category??(isApproval(route.page)?route.category:'all'));
  if(isApproval(next.page)&&category!==route.category) ui.approvals={...approvalState(),size:ui.approvals.size};
  else ui.approvals.selected.clear();
  route = {category,approvalProfile:route.approvalProfile,page:next.page,id:next.id || (next.page==='staff'?'YD9001':''),profile:pageGroup(next.page)?route.profile:''};
  if (!sameEmployee) ui.staffTab = 'base';
  ui.openGroup = pageGroup(route.page) || (isApproval(route.page)?'approvals':'org');
  history[replace ? 'replaceState' : 'pushState']({}, '', routeUrl(route));
  loadCurrentPage(createdEmployee);
}
async function loadCurrentPage(createdEmployee = null) {
  const focusId = app.contains(document.activeElement) ? document.activeElement.id : null;
  const current = ++generation;
  controller?.abort();
  controller = new AbortController();
  phase = 'loading';
  data = null;
  rememberView();
  render();
  try {
    const signal=controller.signal;
    const accessPage=isAccessPage(route.page);
    const organization=route.page==='organization';
    const accessRequest=(accessPage || organization)
      ? accessConfig ?? loadAccessData(signal)
      : null;
    const loaded = isAttendance(route.page) ? await loadAttendance(signal) : accessPage ? await accessRequest : await (
      organization
        ? Promise.all([loadPageData(signal),Promise.resolve(accessRequest).catch(()=>null)])
        : (isBatch()?loadVisitData:loadPageData)(signal)
    );
    if (current !== generation) return;
    if(accessPage) accessConfig=loaded;
    if(organization) {
      const [organizationData,config]=loaded;
      data=organizationData;
      if(config) {
        accessConfig=config;
        data.accessConfig=config;
      }
    } else data=loaded;
    if (isBatch()) {
      if(f17Pages.has(route.page)) {
        f17GrantKey=JSON.stringify(data.grant);
        if(f17Session?.key===f17GrantKey&&route.profile!=='denied') {
          Object.assign(data,structuredClone(f17Session.data));
          data.grant.teams=[...f17Session.teams];
        }
      }
      if(route.page==='visit-lists') data.lists=[...(batchState().listDrafts??[]),...data.lists];
      if(isAccessPage(route.page)||isAttendance(route.page)) batchState().notice='';
      phase='ready'; render();
      if (focusId) document.getElementById(focusId)?.focus();
      return;
    }
    if(isApproval(route.page)) {
      ui.approvals.selected.clear();
      const account=approvalAccount(route,data);
      for(const task of data.tasks) {
        if(!readableTask(account,task)||task.status!=='待处理') continue;
        const key=taskDecisionKey(task);
        const saved=approvalDecisions.get(key);
        if(saved?.version===taskVersion(task)&&saved.scope===taskBatchKey(task)) Object.assign(task,saved.fields);
        try {
          const marker=JSON.stringify([taskVersion(task),taskBatchKey(task)]);
          if(task.status==='待处理'&&sessionStorage.getItem('m02:unknown:'+key)===marker) task.resultState='UNKNOWN';
        } catch { /* Current in-page state remains available when browser storage is blocked. */ }
      }
    }
    if (createdEmployee && data.access.staff === true && !employeeById(route.id)) data.employees.push(createdEmployee);
    prepareData(data); resetPermissions();
    if (data.access.staff === false) ui.visited.forEach(view => { if (view.page === 'staff') view.title = '员工档案'; });
    phase = (route.page === 'permissions' && data.access.permissions !== true) || data.access[({organization:'org',cadres:'staff',approval:'approvals'})[route.page] || route.page] === false ? 'forbidden' : 'ready';
  } catch (error) {
    if (current !== generation || error.name === 'AbortError') return;
    phase = 'error';
  }
  rememberView();
  render();
  if (focusId) document.getElementById(focusId)?.focus();
}
function pageBody() {
  if (!isBatch() && !['org','staff','approvals','organization','cadres','approval','permissions'].includes(route.page)) return stateView('missing',{title:'页面不存在',back:{href:'?page=org',page:'org',label:'返回员工列表'}});
  if (phase === 'loading') return stateView('loading',{title:'正在加载',description:'请稍候…'});
  if (phase === 'error') return stateView('error',{title:'数据加载失败',description:'请检查连接后重试。',retry:true});
  if (phase === 'forbidden') return stateView('forbidden',{title:'暂无访问权限',description:'如需查看，请联系系统权限管理员。'});
  if (isAttendance(route.page)) return attendanceView(data,route,batchState());
  if (isAccessPage(route.page)) return accessView(data,route,batchState());
  if (isBatch()) return batchView(data,route,batchState());
  if (route.page === 'permissions') return permissionsView(data);
  if (route.page === 'staff') return employee() ? workflowNotice()+staffDetailView(employee(),ui.staffTab,canEditEmployeeProfile(data,employee()),data.access.employeeProfileEdit===true) : stateView('missing',{title:'记录不存在或无权查看',back:{href:'?page=org',page:'org',label:'返回员工列表'}});
  if (route.page === 'approval') return approvalDetailView(data.tasks.find(t=>t.id===route.id),{
    account:approvalAccount(route,data),back:routeUrl({...route,page:'approvals',id:''})
  });
  const extended = extendedView(route,data); if (extended !== null) return extended;
  if (route.page === 'org') return orgView();
  return approvalsView(data,route,ui.approvals);
}
function render() {
  const focused = app.contains(document.activeElement) ? document.activeElement : null;
  const focusId = focused?.id;
  app.innerHTML = shellMarkup({route:{...route,parentPage:({staff:'org',visit:'visits',approval:'approvals','guard-fact':'guard-approved'})[route.page]}, ...ui, ...pcShellContext(route,route.page === 'permissions' && phase === 'ready' ? data?.permissions?.actor : null,phase==='ready'&&isApproval(route.page)?data:null), title:pageTitle(), busy:phase === 'loading'}, pageBody());
  document.title = `${pageTitle()} · 扬锻工业园区综合管理平台`;
  if (focusId) document.getElementById(focusId)?.focus();
}
function orgResults() {
  return data.employees.filter(row => (ui.org.dept === '全部部门' || row.dept === ui.org.dept) && (!ui.org.keyword || (row.name + row.id).includes(ui.org.keyword)) && (!ui.org.status || row.status === ui.org.status));
}
function orgView() {
  const model = paginate(orgResults(),ui.org.page,ui.org.size);
  ui.org.page = model.page;
  return `<div class="page-head"><div><h1>员工管理</h1><p class="muted tiny">查询组织员工，查看有效任岗与在离职情况</p></div><div class="actions">${unavailableAction('导入员工','当前账号无员工导入权限','import')}<button class="primary" data-workflow="hire">＋ 入职建档</button></div></div><div class="org-grid"><aside class="card tree"><input id="tree-search" value="${e(ui.org.treeSearch)}" placeholder="搜索部门" aria-label="搜索部门"><button class="tree-title" id="tree-toggle" aria-expanded="true" aria-controls="department-list"><span aria-hidden="true">⌄</span>　扬州锻压机床有限公司</button><div id="department-list" role="group" aria-label="部门">${departments.map(dept => treeItem('　'+dept,{active:dept===ui.org.dept,hidden:!dept.includes(ui.org.treeSearch),attrs:`data-dept="${e(dept)}"`,wrapped:true})).join('')}</div><p class="tree-empty" ${departments.some(d => d.includes(ui.org.treeSearch)) ? 'hidden' : ''}>没有匹配的部门</p></aside><section class="card"><div class="card-head"><h2 id="dept-title">${ui.org.dept === '全部部门' ? '全部员工' : e(ui.org.dept)}</h2><span class="muted tiny">人事管理范围</span></div>${filterBar(`${formField('关键词',`<input id="keyword" name="keyword" value="${e(ui.org.keyword)}" placeholder="姓名 / 员工标识">`,{variant:"field",separator:' '})}${formField('在离职',`<select id="employment" name="status">${['','在职','已离职'].map(s => `<option value="${s}" ${s === ui.org.status ? 'selected' : ''}>${s || '全部状态'}</option>`).join('')}</select>`,{variant:"field",separator:' '})}${actionButton('查询',{variant:'primary',type:'submit'})}<button type="button" data-reset>重置</button>`, 'id="org-filter"')}<div class="list-toolbar"><span>员工列表</span><span class="muted">任岗信息按有效日期展示</span></div>${dataTable(['员工','员工标识','所属部门','当前有效岗位','任岗生效日期','状态','操作'],model.rows.map(row => `<tr><td><div class="person-cell"><span class="avatar" aria-hidden="true">${e(row.name.slice(-2))}</span><span>${e(row.name)}</span></div></td><td class="mono">${e(row.id)}</td><td>${e(row.dept)}</td><td>${e(row.job)}</td><td class="mono">${e(row.date)}</td><td>${tag(row.status,row.status === '在职' ? 'green' : 'grey')}</td><td><a class="text" href="?page=staff&id=${encodeURIComponent(row.id)}" data-route="staff" data-id="${e(row.id)}" aria-label="查看${e(row.name)}的员工档案">查看详情</a></td></tr>`),{empty:'没有匹配的员工',caption:'员工列表',reset:true})}${pagination(model)}</section></div>`;
}
function rememberApproval(task,version) {
  const fields=Object.fromEntries(['status','result','opinion','decisionId','version','handledAt','actualAssignee','actualAssigneeId','resultState']
    .filter(key=>Object.hasOwn(task,key)).map(key=>[key,task[key]]));
  const key=taskDecisionKey(task),scope=taskBatchKey(task);
  approvalDecisions.set(key,{version,scope,fields});
  if(task.resultState==='UNKNOWN') {
    try { sessionStorage.setItem('m02:unknown:'+key,JSON.stringify([version,scope])); }
    catch { /* Retain the marker in approvalDecisions for this page session. */ }
  }
}
const approvalContext=()=>({data,route,ui:ui.approvals,render,dialog,remember:rememberApproval});
function resetCurrentFilters() {
  if (isBatch()) Object.assign(batchState(),{filters:{},page:1,place:'',notice:''});
  if (route.page === 'org') ui.org = {...defaultOrg(),size:ui.org.size};
  if (route.page === 'approvals') ui.approvals = {...approvalState(),tab:ui.approvals.tab,size:ui.approvals.size};
  render();
}
function activateTab(key,{focus = false} = {}) {
  if (isBatch()) Object.assign(batchState(),{tab:key,page:1,filters:{},...(route.page==='attendance-schedules'?{calendarMode:'week',rulePreview:null}:{})});
  if (route.page === 'staff') ui.staffTab = key;
  if (route.page === 'approvals') {ui.approvals.tab = key; ui.approvals.status = ''; ui.approvals.page = 1; ui.approvals.selected.clear();}
  render();
  if (focus) document.querySelector(`[data-biz-tab="${CSS.escape(key)}"]`)?.focus();
}
app.addEventListener('click',event => {
  const button = event.target.closest('button,a,[data-route]');
  if (!button || button.disabled) return;
  if (route.page==='approvals'&&data&&approvalAction(button,approvalContext())) return;
  if (route.page === 'permissions' && permissionClick(button,{data,render,dialog})) return;
  if (isAccessPage(route.page) && accessClick(button,{data,route,dialog,ui:batchState(),render})) return;
  if (isAttendance(route.page) && attendanceClick(button,{data,route,dialog,ui:batchState(),render})) return;
  if (isBatch() && !isAttendance(route.page) && !isAccessPage(route.page) && batchClick(button,{data,route,dialog})) return;
  if (!isBatch() && handleExtendedClick(button,{data,route,render,dialog,navigate})) return;
  if (button.dataset.route && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
    event.preventDefault(); navigate({page:button.dataset.route,id:button.dataset.id,category:button.dataset.approvalCategory}); return;
  }
  if (button.id === 'collapse') {
    ui.collapsed = !ui.collapsed; render(); document.querySelector('#collapse').focus(); return;
  }
  if (button.dataset.navGroup) {const group=button.dataset.navGroup;ui.openGroup=ui.openGroup===group?null:group;render();document.querySelector(`[data-nav-group="${group}"]`)?.focus();return;}
  if (button.id === 'refresh' || button.hasAttribute('data-retry')) {if (dialog.open) dialog.close();loadCurrentPage();return;}
  if (button.dataset.closeView) {
    const index = ui.visited.findIndex(view => routeKey(view) === button.dataset.closeView);
    if (index < 0) return;
    const active = routeKey(route) === button.dataset.closeView;
    ui.visited.splice(index,1);
    if (active) navigate(ui.visited[Math.max(0,index - 1)] || {page:'org'}, {replace:true});
    else render();
    return;
  }
  if (button.id === 'tree-toggle') {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded',String(!expanded));
    document.querySelector('#department-list').hidden = expanded;
    return;
  }
  if (button.dataset.dept) {
    const form = document.querySelector('#org-filter');
    ui.org = {...ui.org,dept:button.dataset.dept,keyword:form.keyword.value.trim(),status:form.status.value,page:1};
    render();document.querySelector(`[data-dept="${CSS.escape(ui.org.dept)}"]`)?.focus();return;
  }
  if (button.hasAttribute('data-reset')) {resetCurrentFilters();document.querySelector('.filters input,.filters select')?.focus();return;}
  if (button.dataset.bizTab) {activateTab(button.dataset.bizTab,{focus:true});return;}
  if (button.dataset.task) {navigate({page:'approval',id:button.dataset.task});return;}
  if (button.hasAttribute('data-page-to')) {const state = isBatch()?batchState():route.page === 'org' ? ui.org : ui.approvals;state.page = Number(button.dataset.pageTo);state.selected?.clear();render();}
});
app.addEventListener('submit',event => {
  event.preventDefault();const form = event.target;
  if (route.page === 'permissions' && permissionSubmit(form,{data,render,dialog})) return;
  if (route.page==='approval'&&handleDetailDecision(form,{...approvalContext(),submitter:event.submitter})) return;
  if (form.id==='m01-filter' || form.id==='m06-filter' || form.id==='m04-filter') {
    Object.assign(batchState(),{filters:Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()])),page:1,place:'',notice:''});
    render(); document.getElementById(form.id)?.querySelector('button[type=submit]')?.focus(); return;
  }
  if (!isBatch() && handleExtendedSubmit(form,{data,route,render,dialog,navigate,submitter:event.submitter})) return;
  if (form.id === 'org-filter') {ui.org = {...ui.org,keyword:form.keyword.value.trim(),status:form.status.value,page:1};render();}
  if (form.id === 'approval-filter') {ui.approvals = {...ui.approvals,type:form.type.value,date:form.date.value,status:form.status?.value||'',page:1,selected:new Map(),results:[]};render();}
  if (form.classList.contains('page-jump')) {const state = isBatch()?batchState():route.page === 'org' ? ui.org : ui.approvals;state.page = Number(form.querySelector('input').value);state.selected?.clear();render();}
});
app.addEventListener('reset',event=>{if(event.target.id==='cadre-filter') setTimeout(()=>event.target.requestSubmit(),0);});
app.addEventListener('change',event => {
  if(route.page==='approvals'&&data&&event.target.dataset.approvalSelect) {
    selectApproval(event.target.dataset.approvalSelect,event.target.checked,approvalContext());return;
  }
  if(route.page==='approvals'&&data&&event.target.id==='business') {
    event.target.form.requestSubmit();return;
  }
  if (route.page === 'permissions' && permissionChange(event.target,{data,render,dialog})) return;
  if (event.target.hasAttribute('data-page-size')) {const state = isBatch()?batchState():route.page === 'org' ? ui.org : ui.approvals;state.size = Number(event.target.value);state.page = 1;state.selected?.clear();render();document.querySelector('[data-page-size]')?.focus();}
});
app.addEventListener('input',event => {
  if (event.target.id === 'structure-search') {document.querySelectorAll('.structure-tree [data-structure]').forEach(button=>{button.hidden=!button.textContent.includes(event.target.value.trim());});return;}
  if (event.target.id !== 'tree-search') return;
  ui.org.treeSearch = event.target.value.trim();
  document.querySelectorAll('[data-dept]').forEach(button => {button.hidden = !button.dataset.dept.includes(ui.org.treeSearch);});
  document.querySelector('.tree-empty').hidden = departments.some(dept => dept.includes(ui.org.treeSearch));
});
app.addEventListener('keydown',event => {
  if (route.page === 'permissions' && permissionKeydown(event,{data,render,dialog})) return;
  const next = tabDestination(event);
  if (next) activateTab(next.dataset.bizTab,{focus:true});
});
dialog.addEventListener('invalid',showProfileInvalid,true);
dialog.addEventListener('input',event=>updateHireFields(event.target));
dialog.addEventListener('change',event=>{if(isAttendance(route.page)&&attendanceChange(event.target,{data,route}))return;if(route.page==='permissions')permissionChange(event.target,{data,render,dialog});else updateJobOptions(event.target);});
dialog.addEventListener('submit',event => { event.preventDefault();if(route.page==='approvals'&&data&&rejectApprovalBatch(event.target,approvalContext()))return;if(route.page==='visit-lists'&&data&&batchSubmit(event.target,{data,route,dialog,ui:batchState(),render}))return;if(isAttendance(route.page)&&attendanceSubmit(event.target,{data,route,dialog,ui:batchState(),render,saveF17}))return;if(route.page==='permissions' && permissionSubmit(event.target,{data,render,dialog}))return;if(isAccessPage(route.page) && accessSubmit(event.target,{data,route,dialog,ui:batchState(),render}))return;handleExtendedSubmit(event.target,{data,route,render,dialog,navigate,submitter:event.submitter}); });
dialog.addEventListener('click',event => {
 const close=event.target.closest('[data-dialog-close]');
 if(close) {dialog.close();return;}
 const button=event.target.closest('button[data-att-action]');
 if(button&&isAttendance(route.page)) attendanceClick(button,{data,route,dialog,ui:batchState(),render});
});
dialog.addEventListener('close',() => {modalTrigger?.isConnected && modalTrigger.focus();});
window.addEventListener('popstate',() => {if(dialog.open)dialog.close();const next=readRoute();if(next.category!==route.category||next.approvalProfile!==route.approvalProfile)ui.approvals=approvalState();route=next;ui.staffTab = 'base';ui.openGroup = pageGroup(route.page) || (isApproval(route.page)?'approvals':'org');loadCurrentPage();});
loadCurrentPage();
// Native disclosure groups keep the four existing actions at two hierarchy levels.
let detailMenuReturn;
document.addEventListener('click',event=>{
 const menu=event.target.closest('.detail-action-menu');
 document.querySelectorAll('.detail-action-menu[open]').forEach(open=>{if(open!==menu)open.open=false;});
 if(event.target.closest('.detail-action-options button')){detailMenuReturn=menu?.querySelector('summary');if(menu)menu.open=false;}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open){const menu=document.querySelector('.detail-action-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();}}});
dialog.addEventListener('close',()=>{if(detailMenuReturn?.isConnected)detailMenuReturn.focus();detailMenuReturn=null;});
