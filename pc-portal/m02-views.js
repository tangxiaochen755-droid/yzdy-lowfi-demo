import {escapeHtml as e,actionButton as button,statusTag as tag,formField,filterBar,tabList,dataTable,paginate,pagination,stateView,
  openDialog,dialogHead,dialogBody,dialogFoot,formError} from './components.js';
import {approvalAccount,approvalCategories,approvalMenus,approvalType,approvalTypes,readableTask,taskEligibility,taskVersion,taskBatchKey,decideTask,isUnknownTask,isVisitorApproval} from './m02-model.js?v=review-fix';

export const approvalState = () => ({tab:'pending',type:'',date:'',status:'',page:1,size:10,selected:new Map(),results:[]});
const allowedCategory=(account,route)=>approvalMenus(account).some(([key])=>key===route.category);
function filteredTasks(data,route,ui,tab=ui.tab) {
  const account=approvalAccount(route,data);
  const allowedTypes=approvalTypes(account,route.category).map(([key])=>key);
  return data.tasks.filter(task=>allowedTypes.includes(approvalType(task))&&
    (tab==='pending'?taskEligibility(account,task):readableTask(account,task)&&!task.reference&&
      (tab==='review'?isUnknownTask(task):task.status==='已处理'&&!isUnknownTask(task)))&&
    (!ui.type||ui.type===approvalType(task))&&(!ui.date||task.arrivedAt?.startsWith(ui.date))&&(!ui.status||task.status===ui.status));
}
function currentPage(data,route,ui) {
  return paginate(filteredTasks(data,route,ui),ui.page,ui.size);
}
const opt=(value,label,selected)=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(label)}</option>`;
const buttonFor=(label,action,disabled,variant='')=>button(label,{variant,attrs:`data-approval-action="${action}" ${disabled?'disabled':''}`});
function resultView(results) {
  if(!results.length) return '';
  const totals=['成功','失败','待核对'].map(status=>status+' '+results.filter(row=>row.status===status).length).join(' · ');
  return `<section class="card m02-results"><div class="card-head"><h2 id="approval-results" tabindex="-1">批量处理结果</h2><span role="status">${e(totals)}</span></div>${
    dataTable(['任务号','处理结果','说明','决定编号'],results.map(row=>`<tr><td>${e(row.id)}</td><td>${tag(row.status,row.status==='成功'?'success':row.status==='失败'?'danger':'warning')}</td><td>${e(row.reason)}</td><td>${e(row.decisionId||'—')}</td></tr>`),{caption:'逐任务处理结果'})
  }</section>`;
}
export function approvalsView(data,route,ui) {
  const account=approvalAccount(route,data);
  if(!allowedCategory(account,route)) return stateView('forbidden',{title:'暂无该分类审批权限'});
  const model=currentPage(data,route,ui);
  ui.page=model.page;
  const options=approvalTypes(account,route.category);
  const selectable=ui.tab==='pending'&&options.some(([key])=>key===ui.type)&&model.total>0;
  const chosen=[...ui.selected.values()][0];
  const sameGroup=model.rows.filter(task=>!chosen||taskBatchKey(task)===chosen.key);
  const tabs=[['pending','待我审批 '+filteredTasks(data,route,ui,'pending').length],['done','我已审批 '+filteredTasks(data,route,ui,'done').length],['review','待核对 '+filteredTasks(data,route,{...ui,status:''},'review').length]];
  const filters=filterBar(formField('业务类型',`<select id="business" name="type">${opt('','全部类型',ui.type)}${options.map(([key,label])=>opt(key,label,ui.type)).join('')}</select>`,{variant:'field'})+
    formField('到达日期',`<input id="arrival" name="date" type="text" inputmode="numeric" placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" value="${e(ui.date)}">`,{variant:'field'})+
    (ui.tab==='review'?'':formField('任务状态',`<select id="task-status" name="status">${['','待处理','已处理'].map(s=>opt(s,s||'全部状态',ui.status)).join('')}</select>`,{variant:'field'}))+
    button('查询',{type:'submit',variant:'primary'})+button('重置',{attrs:'data-reset'}),'id="approval-filter"');
  const batchAvailable=ui.tab==='pending'&&options.length>0&&model.total>0;
  const toolbar=batchAvailable?`<div class="m02-batch list-toolbar"><div class="actions">${selectable?
    `<span role="status">已选 ${ui.selected.size} 条</span>${buttonFor('选择本页同组任务','select',!sameGroup.length)}${buttonFor('清空选择','clear',!ui.selected.size)}${sameGroup.length<model.rows.length?'<span class="muted">不同节点或授权范围需分批处理</span>':''}`:
    `<strong id="task-heading">待处理任务</strong>${buttonFor('批量处理','choose-type',false)}<span class="muted">先选业务类型，再勾选同组任务</span>`
  }</div><div class="actions">${buttonFor('批量同意','approve',!ui.selected.size,'primary')}${buttonFor('批量驳回','reject',!ui.selected.size,'reject-button')}</div></div>`:
    `<div class="list-toolbar"><strong id="task-heading">${ui.tab==='review'?'待核对任务':ui.tab==='done'?'已处理记录':'待处理任务'}</strong></div>`;
  const headers=[...(selectable?['选择']:[]),'任务号','业务类型','申请人','申请 / 被访部门','当前审批节点','到达时间','状态','操作'];
  const rows=model.rows.map(task=>{
    const disabled=chosen&&chosen.key!==taskBatchKey(task);
    const selection=selectable?`<td><input type="checkbox" data-approval-select="${e(task.id)}" aria-label="选择${e(task.id)}" ${
      ui.selected.has(task.id)?'checked':''} ${disabled?'disabled title="不同节点或授权范围需分批处理"':''}></td>`:'';
    return `<tr>${selection}<td class="mono">${e(task.id)}</td><td>${e(task.type)}</td><td>${e(task.applicant)}</td><td>${e(isVisitorApproval(task)?task.approvalDepartment:task.dept)}</td><td>${e(task.node)}</td><td class="mono">${e(task.arrivedAt?.slice(5))}</td><td>${
      tag(isUnknownTask(task)?'结果待核对':task.status,isUnknownTask(task)||task.status==='待处理'?'warning':task.result==='同意'?'success':task.result==='驳回'?'danger':'neutral')}</td><td><button class="text" data-task="${e(task.id)}" aria-label="查看${e(task.id)}审批详情">${ui.tab==='pending'?'办理':'查看'}</button></td></tr>`;
  });
  return `<div class="page-head"><div><h1>${route.category==='all'?'统一审批':e(approvalCategories[route.category])}</h1><p class="muted tiny">查看本人待办任务与已处理记录</p></div>${tag('本人审批任务')}</div>${resultView(ui.results)}<section class="card m02-list">${
    tabList('approvals',tabs,ui.tab,{label:'审批任务分组'})}<div id="approvals-panel" role="tabpanel" aria-labelledby="approvals-tab-${ui.tab}" tabindex="0">${
    filters+toolbar+dataTable(headers,rows,{empty:ui.tab==='pending'&&!ui.type&&!ui.date&&!ui.status?'暂无待办，没有匹配的审批任务':'没有匹配的审批任务',caption:'本人审批任务',reset:true})+pagination(model)}</div></section>`;
}
export function selectApproval(id,checked,{data,route,ui,render}) {
  const task=currentPage(data,route,ui).rows.find(row=>row.id===id);
  const selected=[...ui.selected.values()][0];
  if(!checked) ui.selected.delete(id);
  else if(ui.tab==='pending'&&ui.type&&task&&(!selected||selected.key===taskBatchKey(task))) {
    ui.selected.set(id,{key:taskBatchKey(task),version:taskVersion(task)});
  }
  render();
  document.querySelector(`[data-approval-select="${CSS.escape(id)}"]`)?.focus();
}
function executeBatch(ctx,result,opinion) {
  const {data,route,ui,render,remember}=ctx;
  if(ui.tab!=='pending'||!ui.type||!ui.selected.size) return;
  const account=approvalAccount(route,data);
  const visible=new Set(currentPage(data,route,ui).rows.map(task=>task.id));
  const selected=[...ui.selected];
  ui.selected.clear();
  const batchKey=selected[0][1].key;
  ui.results=selected.map(([id,snapshot])=>{
    const task=data.tasks.find(task=>task.id===id);
    if(!task||!visible.has(id)||approvalType(task)!==ui.type||snapshot.key!==batchKey||taskBatchKey(task)!==batchKey)
      return {id,status:'失败',reason:'任务已不在当前审批范围'};
    const outcome=decideTask(account,task,snapshot.version,result,opinion);
    if(outcome.status!=='失败') remember(task,snapshot.version);
    return {id,...outcome};
  });
  render();
  document.querySelector('#approval-results')?.focus();
}
export function approvalAction(trigger,ctx) {
  const action=trigger.dataset.approvalAction;
  if(!action) return false;
  const {ui,data,route,dialog,render}=ctx;
  if(action==='choose-type') {
    const field=document.querySelector('#business');
    field?.focus();
    try { field?.showPicker?.(); } catch { /* The focused select remains keyboard accessible. */ }
    return true;
  }
  if(ui.tab!=='pending'||!ui.type) return true;
  if(action==='clear') {ui.selected.clear();render();}
  if(action==='select') {
    const tasks=currentPage(data,route,ui).rows;
    const key=[...ui.selected.values()][0]?.key||(tasks.length?taskBatchKey(tasks[0]):null);
    for(const task of tasks) if(taskBatchKey(task)===key) ui.selected.set(task.id,{key,version:taskVersion(task)});
    render();
  }
  if(action==='approve') executeBatch(ctx,'同意','');
  if(action==='reject'&&ui.selected.size) {
    openDialog(dialog,'<form id="approval-reject">'+dialogHead('统一驳回理由')+
      dialogBody(`<p>本次驳回 ${ui.selected.size} 条任务</p>${formField('驳回理由（必填）','<textarea name="reason" maxlength="500" required></textarea>')}${formError()}`)+
      dialogFoot(button('取消',{attrs:'data-dialog-close'})+button('确认驳回',{variant:'primary',type:'submit'}))+'</form>',
      {onClose:()=>trigger.isConnected&&trigger.focus()});
  }
  return true;
}
export function rejectApprovalBatch(form,ctx) {
  if(form.id!=='approval-reject') return false;
  const reason=String(new FormData(form).get('reason')||'').trim();
  if(!reason||reason.length>500) form.querySelector('[role=alert]').textContent='请填写驳回理由，最多 500 字。';
  else {ctx.dialog.close();executeBatch(ctx,'驳回',reason);}
  return true;
}
