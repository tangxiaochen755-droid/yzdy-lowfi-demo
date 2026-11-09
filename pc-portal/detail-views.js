import {approvalAccount,readableTask,taskEligibility,taskVersion,decideTask,isVisitorApproval,isUnknownTask} from './m02-model.js?v=review-fix';
import {detailField as field, detailSection as section, detailStack, detailPanel, identitySummary, detailColumns, recentHistory} from './detail-primitives.js';
import {escapeHtml as e,statusTag as tag,dataTable,tabList} from './components.js';
const staffTabs=[['base','基础档案'],['jobs','任岗与异动'],['cadre','中层类别'],['face','人脸信息'],['audit','变更审计']];
const rejection=value=>/驳回|拒绝|不通过|不同意/.test(value||'');
// Presentation only. The existing decision/permission guards still own workflow truth.
const detailTones = new Map([
 ['同意','success'],['批准','success'],['通过','success'],['已批准','success'],['有效','success'],['已录入','success'],
 ['待处理','warning'],['待生效','warning'],['结果待确认','warning'],['未知','warning'],['UNKNOWN','warning'],
 ['驳回','danger'],['拒绝','danger'],['不通过','danger'],['不同意','danger'],['已驳回','danger'],
 ['已提交','info']
]);
const tone=value=>detailTones.get(value)||'neutral';
const stamp=value=>value||'未记录';
function assignments(rows,caption){return dataTable(['岗位 / 类型','所属部门','生效日期','结束日期','任职状态'],rows.map(a=>`<tr><td>${e(a.job)}<small class="cell-secondary">${e(a.kind||'主岗')}</small></td><td>${e(a.dept)}</td><td class="mono">${e(a.start)}</td><td class="mono">${e(a.end||'—')}</td><td>${tag(a.status,tone(a.status))}</td></tr>`),{caption,empty:'暂无任岗记录'});}
export function staffDetailView(row,selected,canEdit=false,canReadPersonal=false){
 const menu=row.status==='在职'?`<details class="detail-action-menu"><summary class="primary">人员异动 <span aria-hidden="true">⌄</span></summary><div class="detail-action-options"><button data-workflow="transfer">办理调岗</button><button data-workflow="assignment">新增兼岗</button><button class="danger" data-workflow="leave">办理离职</button></div></details>`:'';
 const profile=row.profile || {};
 const nature=profile.personnelNature ?? row.kind;
 const labels=[nature,...(row.personnelTags || [])].filter(Boolean).map(label=>tag(label,'neutral')).join('');
 const editProfile=canEdit?'<button data-workflow="employee-profile">编辑员工档案</button>':'<button disabled>编辑员工档案（只读）</button>';
 const maintenance=`<details class="detail-action-menu"><summary>档案维护 <span aria-hidden="true">⌄</span></summary><div class="detail-action-options">${editProfile}<button data-workflow="cadre" data-record="${e(row.id)}">维护中层类别</button></div></details>`;
 const pending=row.pendingChange?`<div class="pending-notice">${row.pendingChange.kind==='leave'?'离职':'调岗'}待生效 · ${e(row.pendingChange.date)}</div>`:'';
 const head=`<div class="page-head detail-page-head"><div class="actions"><a class="icon-btn" data-route="org" href="?page=org" aria-label="返回员工列表">←</a><h1>员工档案</h1><span class="detail-id">${e(row.id)}</span></div><div class="actions">${maintenance}${menu}</div></div>${pending}${identitySummary(`<div class="staff-avatar">${row.face?.photo?`<img src="${e(row.face.photo)}" alt="${e(row.name)}的档案头像">`:e(row.name[0])}</div><div><div class="actions"><h2>${e(row.name)}</h2>${tag(row.status,row.status==='在职'?'green':'grey')}${labels}</div><p>${e(row.dept)} <span> / </span> ${e(row.job)}</p></div>`,`${field('任岗生效',row.date)}${field('中层类别',row.cadre?.value||'未维护')}<div class="detail-field"><span>人脸状态</span><b>${tag(row.face?.status||'未录入',tone(row.face?.status))}</b></div>`)}`;
 const personalFields=canReadPersonal?[
  ['身份证号',profile.identityMasked],['出生日期',profile.birthDate],['籍贯',profile.nativePlace],
  ['学历',profile.education],['婚况',profile.maritalStatus],['民族',profile.ethnicity],['家庭地址',profile.homeAddress,'full detail-reason']
 ]:[];
 const profileFields=[
  ['姓名',row.name],['工号',row.id],['部门',row.dept],['职位',row.job],
  ['人员性质',nature],['人员标签',row.personnelTags?.join('、')||'未设置'],
  ['档案状态',row.status],['任岗生效日期',row.date],['干部类别来源',row.cadre?'人事人工维护':'暂无维护记录']
 ];
 const employmentFields=[
  ['建档日期',profile.recordDate],['聘用日期',profile.hiredAt],['转正日期',profile.confirmationDate],['成本中心',profile.costCenter]
 ];
 const profileGrid = fields => '<div class="compact-descriptions three">'+fields.map(args=>field(...args)).join('')+'</div>';
 let body;
 if(selected==='base'){
 const active=row.assignments.filter(a=>a.status==='有效');
 body=`<div class="employee-overview"><div class="detail-stack">${section(row.status==='已离职'?'最近任岗':'当前有效任岗',assignments(row.status==='已离职'?row.assignments.slice(0,1):active,'有效任岗'))}${section('基本信息',profileGrid(profileFields))}</div>${section('近期异动',row.changes.length?`${recentHistory(row.changes.slice(0,3).map(c=>({date:c.date,title:c.title,note:c.job})))}<button class="text history-jump" data-biz-tab="jobs">查看全部任岗记录 →</button>`:'<p class="compact-empty">暂无异动记录</p>','recent-block')}</div>${section('任职与聘用',profileGrid(employmentFields))}${personalFields.length?section('个人资料',profileGrid(personalFields)):''}`;
 }else if(selected==='jobs')body=section('任岗与异动记录',assignments(row.assignments,'任岗与异动记录'));
 else if(selected==='cadre')body=section('中层类别',`<div class="cadre-detail"><div class="compact-descriptions">${field('当前类别',row.cadre?.value||'未维护')}${field('维护人',row.cadre?.actor)}${field('最近维护时间',row.cadre?.at)}${field('业务依据',row.cadre?.basis)}</div><div class="cadre-maintenance"><p>由有权人事管理员人工维护，类别不自动授予管理权限。</p><button data-workflow="cadre" data-record="${e(row.id)}">维护中层类别</button></div></div>`,'fit-detail');
 else if(selected==='face')body=row.face?`<div class="face-object-layout">${row.face.photo?section('人脸照片',`<div class="compact-photo"><img src="${e(row.face.photo)}" alt="${e(row.name)}的人脸照片" width="140" height="187"></div>`):''}${section('录入信息',`<div class="compact-descriptions"><div class="detail-field"><span>人脸状态</span><b>${tag(row.face.status,tone(row.face.status))}</b></div>${field('录入时间',row.face.at)}${field('员工姓名',row.name)}${field('员工标识',row.id)}</div>`)}</div>`:section('人脸信息','<p class="compact-empty">暂无人脸采集记录</p>','fit-detail');
 else body=section('变更审计',dataTable(['变更事项','变更前','变更后','操作人 / 时间','业务依据'],row.audit.filter(a=>canReadPersonal || !['籍贯','学历','婚况','民族','家庭地址'].includes(a.item)).map(a=>`<tr><td>${e(a.item)}</td><td>${e(a.before)}</td><td>${e(a.after)}</td><td>${e(a.actor)}<small class="cell-secondary">${e(a.at)}</small></td><td class="detail-wrap">${e(a.basis||'未记录')}</td></tr>`),{caption:'变更审计',empty:'暂无变更审计记录'}));
 return `${head}<div class="detail-tab-strip">${tabList('staff',staffTabs,selected,{label:'员工档案分组'})}</div>${detailPanel('staff',selected,body)}`;
}
function taskMode(t){return isUnknownTask(t)?'unknown':t.canHandle===false||t.status==='已撤权'?'revoked':t.status==='已处理'?(rejection(t.result)?'rejected':'handled'):t.status==='待处理'?'pending':'readonly';}
function historyRows(t){return [
 `<tr><td>提交申请</td><td>${e(t.applicant)}</td><td class="mono">${e(stamp(t.submittedAt))}</td><td>${tag('已提交')}</td><td>—</td></tr>`,
 ...(t.history||[]).map(h=>`<tr><td class="detail-wrap">${e(h.node)}</td><td>${e(h.actor)}</td><td class="mono">${e(stamp(h.at))}</td><td>${tag(h.result,tone(h.result))}</td><td class="detail-wrap">${e(h.opinion||'—')}</td></tr>`),
 ...(t.status==='已处理'&&!isUnknownTask(t)?[`<tr><td class="detail-wrap">${e(t.node)}</td><td>${e(t.actualAssignee||t.assignee)}</td><td class="mono">${e(stamp(t.handledAt))}</td><td>${tag(t.result||'已办理',tone(t.result))}</td><td class="detail-wrap">${e(t.opinion||'未填写')}</td></tr>`]:[])];}
export function approvalDetailView(t,{account,back='?page=approvals'}){
 if(!readableTask(account,t)) {
   const revoked=t?.assigneeId===account.id&&account.grants.length&&(t.status==='已撤权'||t.canHandle===false);
   return '<section class="card state-view"><h2>'+(revoked?'处理权限已失效':'任务不存在或无权查看')+'</h2>'+
     (revoked?'<div class="approval-handling"><button data-retry>刷新任务状态</button></div>':'')+
     '<a class="text" href="'+e(back)+'" data-route="approvals">返回审批列表</a></section>';
 }
 const mode=t.status==='待处理'&&taskMode(t)==='pending'&&!taskEligibility(account,t)?'readonly':taskMode(t),label={pending:'待处理',handled:'已办理',rejected:'已驳回',unknown:'结果待确认',revoked:'处理权限已失效',readonly:'只读'}[mode];
 const aggregate=mode==='unknown'?'结果待确认':t.result==='驳回'?'申请已驳回':t.result==='同意'&&t.peerDecision==='同意'?'被访人审批均已同意':t.result==='同意'?'仍有其他被访人待审批':'';
 const fields=(t.details||[]).map(([label,value])=>field(label,value,/事由|原因|说明/.test(label)?'full detail-reason':'')).join('')||'<p class="compact-empty">暂无申请明细</p>';
 const application=section('申请事项',`<div class="request-meta">${field('申请人',t.applicant)}${field(isVisitorApproval(t)?'被访部门':'申请部门',isVisitorApproval(t)?t.approvalDepartment:t.dept)}${field('提交时间',stamp(t.submittedAt))}</div><div class="compact-descriptions request-fields">${isVisitorApproval(t)&&t.visitingCompany?field('来访单位',t.visitingCompany):''}${fields}</div>`);
 const flow=section('审批流转',`<div class="flow-current"><span>当前节点</span><strong>${e(t.nodeLabel||t.node)}</strong>${tag(label,tone(label))}</div><div class="compact-descriptions three">${field('原定审批岗位',t.originalNode||t.node)}${field('原定审批人',t.originalAssignee)}${field('实际办理人',mode==='unknown'?'待核对':t.status==='已处理'?(t.actualAssignee||t.assignee):'待办理')}</div>`);
 const m01Flow=t.m01 && !t.reference?section('整单审批',`<div class="compact-descriptions three">${field('其他被访人',t.peerDecision||'待核对')}${field('整单结论',aggregate||(mode==='unknown'?'结果待确认':'审批中'))}</div>`):'';
 const history=section('审批历史',dataTable(['节点','办理人','办理时间','结果','审批意见'],historyRows(t),{caption:'审批历史'}),'approval-history-block');
 let handling;
 if(t.reference)handling='<div class="task-result-state"><strong>审批记录待核对</strong><p>当前无可办理的审批任务。</p></div>';
 else if(mode==='pending')handling=`<div class="handling-node"><span>当前办理节点</span><strong>${e(t.nodeLabel||t.node)}</strong><small>办理人：${e(t.assignee)}</small></div><form data-edit="decision" data-record="${e(t.id)}" data-version="${e(taskVersion(t))}"><label class="edit-field">审批意见<textarea name="opinion" maxlength="500" placeholder="请输入审批意见"></textarea></label><p class="form-error" role="alert"></p><div class="decision-buttons"><button class="primary" name="result" value="同意">同意</button><button class="reject-button" name="result" value="驳回">驳回</button></div></form>`;
 else if(mode==='unknown')handling='<div class="task-result-state"><strong>处理结果待确认</strong><p>请刷新查询结果，确认前请勿重复提交。</p><button data-retry>刷新任务状态</button></div>';
 else if(mode==='revoked')handling='<div class="task-result-state"><strong>当前任务不可办理</strong><p>处理权限已失效，请刷新核对。</p><button data-retry>刷新任务状态</button></div>';
 else handling=`<div class="task-result-state">${tag(label,tone(label))}<div class="compact-descriptions">${field('办理人',t.actualAssignee||t.assignee)}${field('办理时间',stamp(t.handledAt))}${t.decisionId?field('决定编号',t.decisionId):''}</div><div class="result-opinion"><span>审批意见</span><p>${e(t.opinion||'未填写')}</p></div></div>`;
 return `<div class="page-head detail-page-head"><div class="actions"><a class="icon-btn" data-route="approvals" href="${e(back)}" aria-label="返回审批列表">←</a><h1>${e(t.type)}</h1>${tag(label,tone(label))}</div><span class="detail-id">${e(t.id)}</span></div>${detailColumns('approval-detail-layout',detailStack(application+flow+m01Flow+history),section(mode==='pending'?'审批办理':'处理状态',handling,'approval-handling'))}`;
}
export function handleDetailDecision(form,ctx){
 if(form.dataset.edit!=='decision')return false;
 const task=ctx.data?.tasks?.find(t=>t.id===form.dataset.record);
 const result=ctx.submitter?.value;
 if(!task||task.id!==ctx.route.id||!['同意','驳回'].includes(result))return true;
 const version=Number(form.dataset.version);
 const outcome=decideTask(approvalAccount(ctx.route,ctx.data),task,version,result,String(new FormData(form).get('opinion')||'').trim());
 if(outcome.status==='失败') {
   const error=form.querySelector('.form-error');
   if(error) error.textContent=outcome.reason;
 } else {
   ctx.remember(task,version);
   ctx.render();
 }
 return true;
}
