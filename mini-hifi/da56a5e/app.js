import {icon} from './icons.js';
import {actors,pageRoutes,getPagePreset,localAction,TODAY,visitDirectory} from './mock.js?v=host-visits-1';
import {isPageAction,isAllowedPageAction,parentAction,captureView,pageKind} from './navigation.js?v=host-visits-1';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urlParams=new URLSearchParams(location.search);
let actorKey=actors[urlParams.get('actor')]?urlParams.get('actor'):'employee';
let scenario=['normal','empty','error','forbidden','unknown'].includes(urlParams.get('scenario'))?urlParams.get('scenario'):'normal';
let route,model,pageState={},lastFocus=null,toastTimer;
let currentPath='',contextKey='',secondaryAction='',renderingSecondary=false;
const viewCache=new Map();
const tag=(text,tone='neutral')=>`<span class="tag ${tone}">${esc(text)}</span>`;
const btn=(action,text,cls='text-link',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const chev=()=>icon('chevron','chevron');
const card=(title,body,action='',link='查看全部',cls='')=>`<section class="card ${cls}">${title?`<div class="card-head"><h2>${title}</h2>${action?btn(action,`${link}${chev()}`):''}</div>`:''}${body}</section>`;
const row=(name,sub,ico,action,tail='')=>btn(action,`<span class="leading-icon">${icon(ico)}</span><span class="row-main"><span class="row-title">${esc(name)}</span>${sub?`<span class="row-sub" style="display:block">${esc(sub)}</span>`:''}</span>${tail}${chev()}`,'list-row');
const quick=(name,ico,action)=>btn(action,`${icon(ico)}<span>${esc(name)}</span>`,'quick');
const kv=(name,value)=>`<div class="key-row"><span>${esc(name)}</span><b>${esc(value)}</b></div>`;
const choice=(name,description,ico,action,cta='去申请')=>btn(action,`<span class="choice-icon">${icon(ico)}</span><span class="choice-copy"><strong>${esc(name)}</strong><span>${esc(description)}</span></span><span class="choice-cta">${esc(cta)}${chev()}</span>`,'choice-card');
const recordItem=({title,action,meta=[],summary='',status=''})=>`<div class="record-item" role="listitem">${btn(action,`<span class="record-main"><span class="record-heading"><strong class="record-title">${esc(title)}</strong>${status}</span>${meta.length?`<span class="record-meta">${meta.map(([label,value])=>`<span><span class="record-label">${esc(label)}：</span>${esc(value)}</span>`).join('')}</span>`:''}${summary?`<span class="record-summary">${esc(summary)}</span>`:''}</span><span class="record-arrow" aria-hidden="true">${chev()}</span>`,'record-row')}</div>`;
const records=(items)=>`<div class="record-list" role="list">${items.join('')}</div>`;
const empty=(title,description='',ico='empty',retry=false)=>`<div class="empty">${icon(ico)}<h3>${esc(title)}</h3>${description?`<p>${esc(description)}</p>`:''}${retry?btn('retry','重新加载','secondary'):''}</div>`;

function systemBar(){return `<div class="statusbar" aria-hidden="true"><span>9:41</span><span class="status-icons">${icon('signal')}${icon('wifi')}<i class="battery"></i></span></div>`;}
function brandNav(){return `<div class="brand-nav"><img class="brand-logo" src="assets/yadon-logo-transparent.png" alt="YADON Powered by ANDRITZ Schuler"><div class="nav-capsule" aria-hidden="true"><span>•••</span><i></i><b></b></div></div>`;}
function heading(title,subtitle='',action=''){return `<header class="page-top">${systemBar()}${brandNav()}<div class="page-title"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action?btn(action,icon(action==='newBooking'?'plus':'bell'),'icon-button',`aria-label="${action==='newBooking'?'新建预约':'消息中心'}"`):''}</div></header>`;}
function hero(external=false){const a=model.actor;return `<header class="hero">${systemBar()}${brandNav()}<div class="hero-copy"><h1>${external?'欢迎使用':`您好，${esc(a.name)}`}</h1><p>${external?'扬锻园区预约服务':`${esc(a.department)} · ${esc(a.position)}`}</p><p class="date">11月06日　星期五</p></div><div class="slogan">装备世界<br>锻造未来</div></header>`;}
function attendance(){const a=model.actor;let body='';if(!a.attendance||a.noSchedule){body=`<div class="attendance-special">${icon(a.noSchedule?'calendar':'shield')}<div><h3>${a.noSchedule?'今日暂无排班':'免打卡'}</h3><p class="hint">${a.noSchedule?'请以已生效的排班为准':'无需日常打卡，不产生补卡催办'}</p></div></div>`;}else{body=`<div class="schedule"><span>今日班次　08:30—17:30</span><span>日班 · 设备考勤</span></div><div class="attendance-grid"><div class="attendance-cell"><span>上班</span><div class="attendance-time">08:25<small>✓ 已记录</small></div></div><div class="attendance-cell"><span>下班</span><div class="attendance-time">--:--<small class="wait">○ 待记录</small></div></div></div><p class="attendance-note">以指定考勤设备记录和实际排班为准</p>`;}return card('今日考勤 / 排班',body,'attendance','查看详情');}
function messageSummary(){return card('消息提醒',btn('messages',`<span class="leading-icon">${icon('file')}</span><span class="row-main"><span class="row-title">${route.external?'预约申请通知':'本人申请通知'}</span><span class="row-sub" style="display:block">${route.external?'您有一条预约相关通知，请查看':'您有一条新的申请通知，请查看'}</span></span><span class="red-dot"></span>`,'message-row'),'messages','全部消息');}
function renderHome(){const a=model.actor;let services=[quick('请假年休','calendar','leave'),quick('我的申请','list','myRequests'),quick('我的考勤','clock','attendance')];if(a.tasks)services.push(quick('待办已办','file','tasks'));if(a.guard&&a.onDuty)services.push(quick('安保现场','shield','guard'));return hero()+`<main class="content overlap">${attendance()}${scenario==='empty'?card('消息提醒',empty('暂无新消息','','bell')):messageSummary()}${card('常用服务',`<div class="quick-grid">${services.join('')}</div>`,'work','更多')}</main>`;}
const services=[['请假年休','calendar','leave'],['临时出门','out','door'],['出差申请','plane','trip'],['加班申请','overtime','overtime'],['排班考勤','clock','attendance'],['南园午餐','food','southLunch'],['部门用券','ticket','departmentVoucher'],['我的来访','users','relatedVisits'],['安保现场','shield','guard']];
function renderWork(){
 const recent=model.recent.length?model.recent.slice(0,2).map((r,i)=>btn(`request-${i}`,`<span class="leading-icon">${icon(i===0?'calendar':'overtime')}</span><span class="row-main"><span class="row-title">${esc(r.name)}</span><span class="row-sub">申请日期：${esc(r.date)}</span></span>${tag(r.status,r.tone)}${chev()}`,'list-row')).join(''):empty('暂无申请记录','发起的申请可在这里查看');
 const workIcons={trip:'workTrip',attendance:'workAttendance',southLunch:'workFood',departmentVoucher:'workTicket',guard:'workShield'};
 return heading('工作','员工事务与业务办理')+`<main class="content work-content"><div class="dual">${btn('tasks',`<span class="entry-icon">${icon('calendar')}</span><span class="work-entry-copy"><h2>待办已办</h2><p>查看本人待办</p></span>${chev()}`,'entry-card')}${btn('myRequests',`<span class="entry-icon">${icon('file')}</span><span class="work-entry-copy"><h2>我的申请</h2><p>查看申请记录</p></span>${chev()}`,'entry-card')}</div>${card('全部服务',`<div class="service-grid">${services.map(([name,ico,action])=>btn(action,`<i class="service-symbol">${icon(workIcons[action]||ico)}</i><span>${name}</span>`,'service')).join('')}</div>`,'','','work-services')}${card('最近申请',recent,'myRequests','全部','recent')}</main>`;
}
function renderBooking(){return hero(true)+`<main class="content overlap">${card('预约服务',btn('ordinary',`<span class="booking-art">${icon('users')}</span><span><strong>普通访客预约</strong><p>商务交流、参观与其他来访</p></span>${chev()}`,'booking-service')+btn('freight',`<span class="booking-art">${icon('truck')}</span><span><strong>货运预约</strong><p>发货、送货、发送货</p></span>${chev()}`,'booking-service freight'))}${scenario==='empty'?card('消息提醒',empty('暂无新消息','','bell')):messageSummary()}${card('入厂须知',row('访客须知','','file','visitorNotice')+row('货运须知','','truck','freightNotice'))}<p class="quiet-note">请按预约时间来访，并配合现场核验</p></main>`;}
function currentCanteen(){return model.canteens.find(c=>c.id===pageState.canteenId)||model.canteens[0];}
function renderCanteen(){
 const canteen=currentCanteen();
 return `<header class="page-top canteen-compact-top">${systemBar()}${brandNav()}<h1 class="visually-hidden">食堂</h1></header><main class="content canteen-content">
  <section class="balance-card canteen-balance" aria-label="本人统一食堂账户">
   <div class="balance-top">
    <span class="balance-wallet" aria-hidden="true">${icon('wallet')}</span>
    <div class="balance-owner"><h2>食堂账户</h2><p>本人账户 · ${esc(model.actor.name)}</p></div>
    ${btn('account',`<span>账户明细${chev()}</span>`,'text-link account-link')}
   </div>
   <div class="balance-amount" aria-label="账户余额"><strong>${model.balance}</strong><span>元</span></div>
   <dl class="balance-bottom">
    <div><dt>本月补贴</dt><dd>¥${model.canteenMonthly.subsidy}</dd></div>
    <div><dt>本月消费</dt><dd>¥${model.canteenMonthly.spent}</dd></div>
   </dl>
  </section>
  <div class="dual canteen-services">
   ${btn('vouchers',`<span class="entry-icon">${icon('ticket')}</span><span><h2>我的餐券</h2><p>查看持有的餐券</p></span>`,'entry-card')}
   ${btn('voucherApply',`<span class="entry-icon">${icon('file')}</span><span><h2>用券申请</h2><p>员工 / 部门用券</p></span>`,'entry-card')}
  </div>
  <section class="card canteen-menu"><div class="card-head"><h2>每周菜谱</h2>${btn('chooseCanteen',`${esc(canteen.name)}${icon('chevron')}`,'canteen-selector','aria-label="选择食堂"')}</div>
   <div class="week-strip">${['一','二','三','四','五','六','日'].map((x,i)=>btn(`day-${i+2}`,`<span>周${x}</span><b>${i+2}</b>`,'day-button'+(pageState.day===i+2?' active':''),`aria-pressed="${pageState.day===i+2}"`)).join('')}</div>
   <div id="menu-content">${menuContent()}</div>
  </section><p class="quiet-note">菜品与价格以所选食堂当日已发布内容为准</p>
 </main>`;
}
function menuContent(){const canteen=currentCanteen();const published=canteen.publishedDays.includes(pageState.day)&&scenario!=='empty';return `<div class="menu-date"><span>2026年11月${pageState.day}日</span>${published?tag('已发布','success'):tag('暂无发布')}</div>${published?canteen.dishes.map((d,i)=>`<div class="menu-dish"><span class="dish-symbol">${icon(i===3?'food':'leaf')}</span><div><h3>${d.name}</h3><p>${d.category}</p></div><span class="price">¥${d.price}</span></div>`).join(''):empty('该日期暂无已发布菜谱',`${canteen.name} · 可切换食堂或日期查看`,'food')}<p class="menu-foot">只读菜谱 · 不提供线上点餐</p>`;}
function renderMe(external=false){
 const a=external?model.externalUser:model.actor;
  const personalServices=external?[
   ['个人资料','查看我的基本信息','profileCard','profile'],
   ['我的预约','查看本人来访与货运预约','calendar','requests'],
   ['同行人维护','维护我的常用同行人信息','profilePeople','companions']
  ]:[
   ['个人资料','查看我的基本信息','profileCard','profile'],
   ['账号安全','修改登录密码、修改手机号','profileShield','security'],
   ['人脸与隐私','人脸采集与更新、隐私授权管理','profileFace','face']
  ];
  return `<header class="page-top me-compact-top">${systemBar()}${brandNav()}<h1 class="visually-hidden">我的</h1></header>
   <main class="content me-content">
    <section class="me-identity" aria-label="本人身份信息">
     <div class="identity-body"><div class="identity-avatar">${icon('user')}</div>
      <div class="identity-info"><div class="identity-heading"><h2>${esc(a.name)}</h2>${external?'':`<span class="identity-role">${icon('profileCard')}在职员工</span>`}</div><dl>${external?`<div><dt>身份</dt><dd>外部来访</dd></div><div><dt>手机</dt><dd>${esc(a.phone)}</dd></div><div><dt>单位</dt><dd>${esc(a.company)}</dd></div>`:`<div><dt>工号</dt><dd>${esc(a.id)}</dd></div><div><dt>部门</dt><dd>${esc(a.department)}</dd></div><div><dt>职位</dt><dd>${esc(a.position)}</dd></div>`}</dl></div>
     </div>
    </section>
    <div class="me-services" aria-label="个人服务">
     ${personalServices.map(([title,description,ico,action])=>btn(action,`<span class="me-service-icon">${icon(ico)}</span><span class="me-service-copy"><strong>${title}</strong></span>${action==='face'?`<span class="me-face-state">${icon('check')}已采集</span>`:''}${chev()}`,'me-service')).join('')}
    </div>
   </main>`;
}
function requestCard(r,detailAction){
 const freight=r.type==='freight';
 const hostNames=(r.hosts||[]).map(host=>host.name).join('、')||r.host||'未记录';
 const person=r.participants?.[0]?.name||r.names?.[0]||'未记录';
 const count=r.participants?r.participants.length-1:Math.max(0,(r.people||1)-1);
 return `<article class="card request-card"><div class="request-top"><span class="request-type">${icon(freight?'truck':'users')}${freight?'货运来访':'普通来访'}</span>${tag(r.statusLabel,r.tone)}</div>
  <h2>${esc(r.title)}</h2>${kv('预约时间',`${r.date} ${r.period}`)}
  ${kv(freight?'业务目的':'被访人',freight?r.purpose:hostNames)}
  ${kv(freight?'实际司机':'访客',`${person}${count?` · 同行 ${count} 人`:''}`)}
  <div class="request-bottom"><span>${esc(r.id)}</span>${btn(`${detailAction}-${r.id}`,`查看详情${chev()}`)}</div></article>`;
}
function filteredReservations(reservations){
 const query=pageState.search.trim().toLowerCase();
 return reservations.filter(r=>(pageState.status==='all'||r.status===pageState.status)&&
  (pageState.type==='all'||r.type===pageState.type)&&(!pageState.date||r.date===pageState.date)&&
  [r.id,r.title,r.purpose,r.host,r.company,r.plate,...(r.hosts||[]).map(host=>host.name)]
   .some(value=>String(value??'').toLowerCase().includes(query)));
}
function requestList(){
 const hostView=secondaryAction==='relatedVisits';
 const reservations=hostView?model.hostVisits:model.requests;
 const list=filteredReservations(reservations);
 if(list.length)return list.map(r=>requestCard(r,hostView?'relatedDetail':'bookingDetail')).join('');
 if(reservations.length)return card('',empty('没有找到匹配的预约','试试其他状态或筛选条件'));
 return card('',hostView?empty('暂无来访记录','','users'):empty('暂无预约记录','您提交的来访与货运预约将在这里展示'));
}
function renderRequestCollection(){
 const statuses=[['all','全部'],['pending','待审批'],['approved','已通过'],['in','访问中'],['finished','已结束'],['rejected','未通过']];
 return `<div class="filter-bar"><div class="status-tabs" role="group" aria-label="预约状态">${statuses.map(([key,name])=>
  btn(`status-${key}`,name,'status-tab'+(pageState.status===key?' active':''),`aria-pressed="${pageState.status===key}"`)).join('')}</div>
  <div class="search-line"><label class="search-box">${icon('search')}<input id="request-search" aria-label="搜索预约" placeholder="搜索目的、被访人、单号或车牌" value="${esc(pageState.search)}"></label>
  ${btn('filter',icon('filter'),'filter-button'+(pageState.type!=='all'||pageState.date?' applied':''),'aria-label="筛选预约"')}</div></div>
  <div class="content" id="request-list">${requestList()}</div>`;
}
function renderRequests(){
 return heading('我的预约','本人来访与货运记录','newBooking')+renderRequestCollection();
}
function refreshRequests(action){
 if(secondaryAction==='relatedVisits'){
  $('.host-visits').innerHTML=renderRequestCollection();
  $(`.host-visits [data-action="${action}"]`)?.focus({preventScroll:true});
 }else{
  $('#page').innerHTML=renderRequests();
 }
}

function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2600);}
function sheet(title,body){
 if(renderingSecondary){renderSecondary(title,body);return;}
 if($('#sheet-layer').hidden)lastFocus=document.activeElement;$('#sheet-title').textContent=title;$('#sheet-body').innerHTML=body;$('#sheet-layer').hidden=false;$('#scroll-area').style.overflow='hidden';$('#page').inert=true;$('#tabbar').inert=true;$('#sheet-layer .sheet').focus();
}
function renderSecondary(title,body){
 $('#page').innerHTML=`<header class="secondary-header">${systemBar()}<div class="secondary-nav">${btn('back',icon('chevron'),'back-button','aria-label="返回上一页"')}<h1 tabindex="-1">${esc(title)}</h1><div class="nav-capsule" aria-hidden="true"><span>•••</span><i></i><b></b></div></div></header><main class="secondary-content"><section class="card secondary-card" id="secondary-body">${body}</section></main>`;
 document.title=`${title} · YADON`;
}
function saveView(){
 if(!currentPath||!$('#page').firstElementChild||secondaryAction.startsWith('readNotice-')||secondaryAction.startsWith('approval'))return;
 if($('#booking-form')&&(pageState.bookingDiscarded||pageState.bookingSubmitted||pageState.bookingUnknown)){
  viewCache.delete(currentPath);return;
 }
 const active=document.activeElement?.closest('[data-action]')?.dataset.action;
 viewCache.set(currentPath,{html:captureView($('#page')),scroll:$('#scroll-area').scrollTop,title:document.title,focus:active});
}
function navigateAction(action){
 saveView();closeSheet();
 const path=`${route.path}/${action}`;
 if(action==='ordinary'||action==='freight')viewCache.delete(path);
 const suffix=action.startsWith('readNotice-')?`?kind=${pageState.bookingType||'ordinary'}`:'';
 if(path!==currentPath)history.pushState({miniPage:path,from:currentPath},'',`#${path}${suffix}`);
 render();
}
function backPage(){
 if(!secondaryAction)return;
 const state=history.state;
 if(state?.miniPage===currentPath&&state.from?.startsWith(route.path)){history.back();return;}
 const parent=parentAction(secondaryAction);
 history.replaceState(null,'',`#${route.path}${parent?'/'+parent:''}`);render();
}
function handleAction(action,el){
 if(action==='back'&&hasBookingDraft())return sheet('放弃本次填写？','<p class="detail-note">返回后，本次填写的内容将清除。</p>'+ `<div class="button-row">${btn('close','继续填写','secondary')}${btn('booking-discard','放弃填写','primary')}</div>`);
 if(action==='booking-discard'){pageState.bookingDiscarded=true;closeSheet();return backPage();}
 if(action==='back')return backPage();
 if(secondaryAction==='myRequests'&&action.startsWith('my-filter-'))return filterMyRequests(action,el);
 if(isPageAction(action))return navigateAction(action);
 if(secondaryAction==='tasks'&&(action.startsWith('task-')||['tasksPending','tasksHandled'].includes(action)))return handleTaskAction(action);
 dispatch(action,el);
}
function missingRecord(){return sheet('记录不可用',empty('未找到可查看的记录','请返回列表重新选择。','file'));}
function closeSheet(){$('#sheet-layer').hidden=true;$('#scroll-area').style.overflow='';$('#page').inert=false;$('#tabbar').inert=false;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;}
function notice(title,text){sheet(title,`<div class="notice-copy"><p>${text}</p></div>${btn('close','我知道了','primary full')}`);}
function pending(title,text='此服务暂未开放。'){sheet(title,`<div class="detail-note">${text}</div>${btn('close','返回','primary full')}`);}
const fields=rows=>`<dl>${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
const detailPanel=(title,body)=>`<section class="leave-panel"><h2>${esc(title)}</h2>${body}</section>`;
const detailSummary=(eyebrow,title,status='',note='')=>`<section class="leave-panel object-summary"><p>${esc(eyebrow)}</p><div><h2>${esc(title)}</h2>${status}</div>${note?`<p>${esc(note)}</p>`:''}</section>`;
const detailPage=(title,...sections)=>sheet(title,`<div class="leave-detail">${sections.join('')}</div>`);
function showLeaveRecord(r){
 const {leave}=r;
 sheet('请假申请详情',`<div class="leave-detail">
  <section class="leave-panel leave-summary" aria-label="申请状态"><p>${esc(r.name)}</p><h2>${esc(r.status)}</h2><p>申请日期：${esc(r.date)}</p></section>
  <section class="leave-panel"><h2>请假事项</h2>${fields([['请假类型',leave.type],['开始时间',leave.start],['结束时间',leave.end],['请假时长',leave.duration],['请假事由',leave.reason]])}</section>
  <section class="leave-panel"><h2>审批进展</h2><ol class="leave-timeline">
    <li><strong>已提交</strong><p>${esc(model.actor.name)} · ${esc(leave.submittedAt)}</p></li>
    <li aria-current="step"><strong>${esc(leave.pendingNode)}</strong><p>待处理</p></li>
  </ol></section>
  <section class="leave-panel"><h2>申报信息</h2>${fields([['申请人',model.actor.name],['所属部门',model.actor.department],['申请单号',r.id]])}</section>
 </div>`);
}
function showRecord(index){
 const r=model.recent[index];if(!r)return;if(r.leave)return showLeaveRecord(r);
 detailPage(r.name,detailSummary('本人申请',r.name,tag(r.status,r.tone),r.date),
  detailPanel('审批进展',`<ol class="leave-timeline"><li><strong>${esc(r.status)}</strong><p>${r.status==='已通过'?'实际考勤以设备记录为准。':'请关注后续审批结果。'}</p></li></ol>`),
  detailPanel('申报信息',fields([['申请人',model.actor.name],['所属部门',model.actor.department],['申请单号',r.id],['申请日期',r.date]])));
}
const myStatuses=['全部','审批中','已通过','已驳回'];
function myTypes(){return ['全部类型',...new Set(model.recent.map(r=>r.name))];}
function showMyRequests(){
 const {myStatus=0,myType=0}=pageState;
 const rows=model.recent.map((r,i)=>({r,i})).filter(({r})=>
  (!myStatus||r.status===myStatuses[myStatus]||(myStatus===3&&r.status==='拒绝'))&&
  (!myType||r.name===myTypes()[myType]));
 const list=rows.length?records(rows.map(({r,i})=>recordItem({title:r.name,action:`request-${i}`,
  meta:[['申请日期',r.date]],
  summary:r.leave?`${r.leave.start.slice(5,10).replace('-','月')}日 ${r.leave.start.slice(11)}–${r.leave.end.slice(11)} · ${r.leave.duration}`:'',
  status:tag(r.status,r.tone)}))):
  model.recent.length?`${empty('没有符合条件的申请')}${btn('my-filter-reset','清除筛选','secondary')}`:empty('暂无申请记录','您发起的申请将在这里展示');
 sheet('我的申请',`<div class="my-requests">
  <div class="my-requests-filters"><div class="my-requests-status" role="group" aria-label="申请状态">
  ${myStatuses.map((label,i)=>btn(`my-filter-status-${i}`,label,'my-status',`aria-pressed="${myStatus===i}"`)).join('')}</div>
  ${btn('my-filter-open',`<span>申请类型</span><span>${esc(myTypes()[myType])}${chev()}</span>`,'my-type','aria-haspopup="dialog"')}</div>
  <div class="my-requests-list">${list}</div>
 </div>`);
}
function filterMyRequests(action,el){
 if(action==='my-filter-open'){
  sheet('申请类型',`<div class="my-type-options" role="group" aria-label="申请类型">${myTypes().map((label,i)=>{
   const selected=(pageState.myType||0)===i;
   return btn(`my-filter-type-${i}`,`${esc(label)}${selected?icon('check'):''}`,'my-type-option',`aria-pressed="${selected}"`);
  }).join('')}</div>${btn('close','取消','my-type-cancel')}`);
  $('.my-type-option[aria-pressed="true"]')?.focus();return;
 }
 let focus=action;
 if(action==='my-filter-reset'){pageState.myStatus=0;pageState.myType=0;focus='my-filter-status-0';}
 else if(/^my-filter-status-[0-3]$/.test(action))pageState.myStatus=Number(action.at(-1));
 else if(/^my-filter-type-\d+$/.test(action)){
  const i=Number(action.slice('my-filter-type-'.length));if(!myTypes()[i])return;
  pageState.myType=i;closeSheet();focus='my-filter-open';
 }else return;
 renderingSecondary=true;try{showMyRequests();}finally{renderingSecondary=false;}
 $('#scroll-area').scrollTop=0;
 $(`[data-action="${focus}"]`)?.focus({preventScroll:true});
}
function showAttendance(){
 const a=model.actor;
 const scheduled=a.attendance&&!a.noSchedule;
 const shift=!a.attendance?'免打卡':a.noSchedule?'暂无排班':'日班 08:30—17:30';
 const text=!a.attendance?'您属于免打卡人员，无需提交补卡申请。':a.noSchedule?'当天暂无有效排班，不据此判定旷工或缺卡。':'下班时段尚未结束。';
 detailPage('我的排班与考勤',detailSummary('星期五',TODAY,'',shift),
  detailPanel('考勤记录',scheduled?`<ol class="leave-timeline"><li><strong>上班</strong><p>08:25 · 考勤设备</p></li><li><strong>下班</strong><p>${text}</p></li></ol>`:`<p>${text}</p>`),
  detailPanel('补卡服务',btn('punch','当天补卡','secondary full')));
}
const taskTypes=['访客预约','货运预约','请假','出差','临时出门','补卡','南园午餐','员工用券','部门用券'];
const taskResults={approve:'已同意',reject:'已拒绝'};
const taskAction=i=>i===0?'approval':`approval-${i}`;
const taskRows=()=>model.approvalTasks.map((task,i)=>({...task,i,result:pageState.taskResults.get(i)}));
function filteredTasks(){
 const handled=pageState.taskTab==='handled';
 const {type,from,to,result}=pageState.taskFilter;
 return taskRows().filter(t=>Boolean(t.result)===handled&&(!type||t.type===type)&&
  (!from||t.date>=from)&&(!to||t.date<=to)&&(!handled||!result||t.result.decision===result));
}
function showTasks(){
 if(!model.actor.tasks)return pending('暂不可查看','当前没有审批任务查看权限。');
 const handled=pageState.taskTab==='handled';
 const rows=filteredTasks();
 const selectable=rows.filter(t=>!pageState.taskUnknown.has(t.i));
 const selected=pageState.taskSelected;
 const batch=pageState.taskBatch&&!handled;
 const hasFilter=Object.entries(pageState.taskFilter).some(([k,v])=>v&&(k!=='result'||handled));
 const tabs=`<div class="my-requests-status task-status" role="group" aria-label="任务状态">${btn('tasksPending','待办','my-status',`aria-pressed="${!handled}"`)}${btn('tasksHandled','已办','my-status',`aria-pressed="${handled}"`)}</div>`;
 const toolbar=`<div class="task-toolbar">${btn('task-filter',hasFilter?'筛选 · 已设置':'筛选','secondary','aria-haspopup="dialog"')}<span>共 ${rows.length} 条</span>${!handled&&(batch||selectable.length)?btn('task-batch',batch?'取消批量':'批量审批','secondary'):''}</div>`;
 const list=rows.length?records(rows.map(t=>{
  const status=t.result?tag(taskResults[t.result.decision],t.result.decision==='approve'?'success':'danger'):
   pageState.taskUnknown.has(t.i)?tag('结果待确认','neutral'):tag('待审批','warning');
  const item=recordItem({title:`${t.name}的${t.title}`,action:taskAction(t.i),meta:[['提交日期',t.date]],summary:t.summary,status});
  if(!batch)return item;
  const select=btn(`task-pick-${t.i}`,selected.has(t.i)?icon('check'):'','task-check',
   `aria-label="选择${esc(t.name)}的${esc(t.title)}" aria-pressed="${selected.has(t.i)}" ${pageState.taskUnknown.has(t.i)?'disabled':''}`);
  return item.replace('role="listitem">','role="listitem">'+select);
 })):empty(hasFilter?'没有符合条件的任务':handled?'暂无已办记录':'暂无待办任务');
 const controls=batch?`<div class="task-batch-controls">${btn('task-all','全选当前结果','secondary',`aria-pressed="${Boolean(selectable.length)&&selectable.every(t=>selected.has(t.i))}" ${selectable.length?'':'disabled'}`)}<span role="status">已选 ${selected.size} 条</span><div class="button-row approval-actions">${btn('task-confirm-reject','批量拒绝','secondary',selected.size?'':'disabled')}${btn('task-confirm-approve','批量同意','primary',selected.size?'':'disabled')}</div></div>`:'';
 sheet('待办与已办',tabs+toolbar+list+controls);
}
function redrawTasks(focus){
 renderingSecondary=true;try{showTasks();}finally{renderingSecondary=false;}
 ($(`[data-action="${focus}"]:not(:disabled)`)||$('.task-toolbar button'))?.focus({preventScroll:true});
}
function showTaskFilter(){
 const {type,from,to,result}=pageState.taskFilter;
 const options=(pairs,active)=>pairs.map(([key,label])=>`<option value="${esc(key)}" ${key===active?'selected':''}>${esc(label)}</option>`).join('');
 sheet('筛选审批任务',`<label class="form-field">业务类型<select id="task-type">${options([['','全部类型'],...taskTypes.map(t=>[t,t])],type)}</select></label>
  <label class="form-field">提交日期起<input id="task-from" type="date" value="${esc(from)}"></label>
  <label class="form-field">提交日期止<input id="task-to" type="date" value="${esc(to)}"></label>
  ${pageState.taskTab==='handled'?`<label class="form-field">处理结果<select id="task-result">${options([['','全部结果'],...Object.entries(taskResults)],result)}</select></label>`:''}
  <p id="task-filter-error" class="form-error" role="alert"></p>
  <div class="button-row">${btn('task-reset','重置','secondary')}${btn('task-apply','确认筛选','primary')}</div>`);
}
function handleTaskAction(action){
 if(!model.actor.tasks||scenario==='forbidden'||scenario==='error')return;
 const selected=pageState.taskSelected;
 if(action==='task-filter')return showTaskFilter();
 if(action==='task-apply'||action==='task-reset'){
  if($('#sheet-layer').hidden||!$('#task-type'))return;
  const next=action==='task-reset'?{type:'',from:'',to:'',result:''}:
   {type:$('#task-type').value,from:$('#task-from').value,to:$('#task-to').value,result:$('#task-result')?.value||''};
  if(next.from&&next.to&&next.from>next.to){$('#task-filter-error').textContent='结束日期不能早于开始日期。';return;}
  pageState.taskFilter=next;selected.clear();closeSheet();redrawTasks('task-filter');return;
 }
 if(action==='tasksPending'||action==='tasksHandled'){
  pageState.taskTab=action==='tasksHandled'?'handled':'pending';
  pageState.taskBatch=false;selected.clear();redrawTasks(action);return;
 }
 if(pageState.taskTab==='handled')return;
 if(action==='task-batch'){
  pageState.taskBatch=!pageState.taskBatch;selected.clear();redrawTasks(action);return;
 }
 if(!pageState.taskBatch)return;
 const valid=filteredTasks().filter(t=>!pageState.taskUnknown.has(t.i)).map(t=>t.i);
 if(action==='task-all'){
  if(valid.every(i=>selected.has(i)))selected.clear();else valid.forEach(i=>selected.add(i));
  redrawTasks(action);return;
 }
 if(action.startsWith('task-pick-')){
  const i=Number(action.slice(10));if(!valid.includes(i))return;
  if(selected.has(i))selected.delete(i);else selected.add(i);
  redrawTasks(action);return;
 }
 const match=/^task-(confirm|submit)-(approve|reject)$/.exec(action);
 if(!match)return;
 const [,step,decision]=match;
 const ids=valid.filter(i=>selected.has(i));
 if(!ids.length)return;
 if(step==='confirm'){
  sheet(decision==='approve'?'确认批量同意':'确认批量拒绝',`<p class="detail-note">将处理已选的 ${ids.length} 条待办任务。</p>
   <label class="form-field">审批意见<textarea id="task-batch-note" placeholder="填写审批意见（选填）"></textarea></label>
   <div class="button-row">${btn('close','取消','secondary')}${btn(`task-submit-${decision}`,'确认处理','primary')}</div>`);
  return;
 }
 const note=$('#task-batch-note');if(!note||$('#sheet-layer').hidden)return;
 submitTaskDecision(ids,decision,note.value,true);
}
function showApproval(i=0){
 if(!model.actor.tasks)return pending('暂不可处理','当前没有分派给您的有效任务。');
 const t=taskRows()[i];if(!t)return missingRecord();
 const unknown=pageState.taskUnknown.has(i);
 const status=t.result?tag(taskResults[t.result.decision],t.result.decision==='approve'?'success':'danger'):unknown?tag('结果待确认','neutral'):tag('待审批','warning');
 detailPage('审批详情',detailSummary(t.result?'已办任务':'待办任务',`${t.name}的${t.title}`,status),
  detailPanel('申请信息',fields([['申请人',t.name],['所属部门',model.actor.department],['提交日期',t.date],['申请时段',t.summary]])),
  detailPanel('审批进展',`<ol class="leave-timeline"><li ${t.result?'':'aria-current="step"'}><strong>部门负责人</strong><p>${t.result?taskResults[t.result.decision]:unknown?'结果待确认':'待处理'} · ${esc(model.actor.name)}</p></li></ol>`),
  t.result?(t.result.note?detailPanel('审批意见',`<p>${esc(t.result.note)}</p>`):''):unknown?detailPanel('处理结果','<p>暂时无法确认提交结果，请勿重复处理。</p>'):
   detailPanel('处理任务',`<label class="form-field"><span>审批意见</span><textarea id="approval-note" placeholder="填写审批意见（选填）"></textarea></label><div class="button-row approval-actions">${btn('reject','拒绝','secondary')}${btn('approve','同意','primary')}</div>`));
}
function submitTaskDecision(ids,decision,note,batch=false){
 if(!model.actor.tasks||!ids.length||ids.some(i=>!model.approvalTasks[i]||pageState.taskResults.has(i)||pageState.taskUnknown.has(i)))return;
 const result=localAction('approval',{decision,ids,note},{scenario,actor:model.actor});
 if(result.status==='unknown')ids.forEach(i=>pageState.taskUnknown.add(i));
 if(result.status==='success')ids.forEach(i=>pageState.taskResults.set(i,{decision,note}));
 if(result.status==='success'||result.status==='unknown')ids.forEach(i=>pageState.taskSelected.delete(i));
 viewCache.delete(`${route.path}/tasks`);
 if(batch){
  closeSheet();pageState.taskSelected.clear();pageState.taskBatch=false;redrawTasks('task-filter');
 }else if(result.status==='success'||result.status==='unknown'){
  renderingSecondary=true;try{showApproval(ids[0]);}finally{renderingSecondary=false;}
  $('#page h1')?.focus();
 }
 if(result.status!=='success')return pending(result.status==='unknown'?'结果待确认':'暂不可处理',result.message);
 const label=decision==='approve'?'已同意':'已拒绝';
 sheet('处理结果',`<div class="result"><div class="success-symbol">${icon('check')}</div><h3>${batch?`${label} ${ids.length} 条任务`:`${label}申请`}</h3><p>处理结果已更新。</p>${btn('close','完成','primary full')}</div>`);
}
function showBookingDetail(id){
 const r=model.requests.find(x=>x.id===id&&x.owner===model.externalUser.id);
 if(!r)return pending('无法查看','当前账号无权查看此预约。');
 showVisitDetail(r,'预约详情');
}
function showVisitDetail(r,title){
 const freight=r.type==='freight';
 const passage=r.evidence.length?`<ol class="leave-timeline">${r.evidence.map(x=>`<li><strong>${esc(x.name)}</strong><p>${esc(x.text)}</p></li>`).join('')}</ol>`:'<p>尚无设备实际入厂记录。</p>';
 const [person,...companions]=r.participants??(r.names||[]).map(name=>({name}));
 const hosts=r.hosts?.map(host=>[host.name,`${host.department} · ${host.phone}`])??[['被访人',r.host||'未记录']];
 const driverFields=[
  ['姓名',person?.name||'未记录'],['手机号',person?.phone||'未记录'],
  ['身份证',person?.identity||'未记录'],['照片',person?.photo?'已提供':'未记录']
 ];
 detailPage(title,
  detailSummary(freight?'货运来访':'普通来访',r.title,tag(r.statusLabel,r.tone),`${r.date} · ${r.period}`),
  detailPanel('预约信息',fields([['预约编号',r.id],[freight?'预约日期':'拜访日期',r.date],
   [freight?'预约时段':'拜访时段',r.period],...(!freight?[['拜访目的',r.purpose||r.title]]:[]),
   ...(r.visitReason?[['具体目的',r.visitReason]]:[])])),
  detailPanel(freight?'驾驶人信息':'访客信息',fields(driverFields)),
  detailPanel('被访人信息',fields(hosts)+`<div class="visit-points-panel"><strong>${icon('shield')}通行点范围</strong><span>${esc(r.accessPoints?.join('、')||'未记录')}</span></div>`),
  detailPanel(`同行人 · ${companions.length} 人`,companions.length?companions.map(c=>
   `<div class="request-companion">${fields([['姓名',c.name],['身份证',c.identity||'未记录'],['照片',c.photo?'已提供':'未记录']])}</div>`).join(''):'<p>无同行人</p>'),
  freight?detailPanel('车辆与货物',fields([['业务目的',r.purpose],['车牌号',r.plate],
   ['物资出门证',r.materialPass?'已提供':'未记录']])):detailPanel('车辆信息',fields([['是否驾车',r.plate?'有车':r.hasVehicle===false?'无车':'未记录'],
   ...(r.plate?[['车牌号',r.plate]]:[])])),
  detailPanel('补充信息',fields([['备注',r.remarks||'未填写'],...(!freight?[['相关图片',r.attachments?'已提供':'未记录']]:[])])),
  detailPanel('入厂告知',fields(bookingNotices.map(({title},i)=>[title,r.noticeConsents?.[i]===true?'已同意':'未记录']))),
  r.reason?detailPanel('审批结果',`<p>${esc(r.reason)}</p>`):'',
  detailPanel('通行记录',passage+(r.status==='in'?'<p class="object-note">部分人员已离厂，整单仍未结束。</p>':r.status==='finished'?'<p class="object-note">本次访问已结束，再次来访需重新申请。</p>':'')));
}
function showMessages(){const a=model.actor;let list=route.external?[['预约即将到访','您的普通来访预约为11月06日14:00—16:00，请按时来访。'],['访客申请获批','您的普通访客预约已获批，可查看预约详情。']]:[['本人申请通过','您的加班申请已通过，请在本人申请记录中查看。'],['相关访客即将到访','与您相关的访客预约即将开始，请在「我的来访」中查看。']];if(!route.external&&a.tasks)list.push(['当前任务待审','有一条当前合法审批任务待您处理。']);if(!route.external&&a.guard&&a.onDuty)list.push(['东门陌生人预警','当前当班负责点位有待核实预警。'],['访客刷脸核验成功','该记录仅表示刷脸核验成功，尚不代表设备实际入厂。']);pageState.messages=list;sheet('消息中心',scenario==='empty'?empty('暂无消息','','bell'):`<div class="notice-list">${records(list.map(([name,sub],i)=>recordItem({title:name,summary:sub,action:`message-${i}`})))}<\/div>`);}
function showFilter(){pageState.draftType=pageState.type;sheet('筛选预约',`<h3 class="detail-label">预约类型</h3><div class="chip-group" id="type-chips">${[['all','全部'],['ordinary','普通来访'],['freight','货运来访']].map(([v,n])=>btn(`type-${v}`,n,'chip'+(v===pageState.type?' active':''))).join('')}</div><label class="form-field"><span>预约日期</span><input id="filter-date" type="date" value="${esc(pageState.date)}"></label><div class="button-row">${btn('filterReset','重置','secondary')}${btn('filterApply','确认筛选','primary')}</div>`);}
const bookingNotices=[
 {title:'入厂管理告知',summary:'预约、入厂核验与厂区通行',paragraphs:[
  ['入厂核验','请按获批的预约时段到访，并配合现场工作人员核验来访人员和车辆信息。'],
  ['厂区通行','请按现场指引通行，在预约范围内活动。离厂时请配合现场核验。']
 ]},
 {title:'安全环保告知',summary:'现场安全与环境保护',paragraphs:[
  ['现场安全','请遵守厂区安全标识和现场管理要求，未经许可不得进入生产作业区域或操作设备。'],
  ['环境保护','请维护厂区环境，发现异常时及时告知现场工作人员，并按指引处置。']
 ]}
];
function bookingField(label,name,placeholder,required=false,type='text'){
 return `<label class="form-field"><span>${label}${required?'<b class="booking-required" aria-hidden="true">*</b>':''}</span><input name="${name}" type="${type}" placeholder="${placeholder}" ${type==='date'?`value="${TODAY}" min="${TODAY}"`:''} ${required?'required':''} autocomplete="off"></label>`;
}
const visitCompanionHistory=[{name:'方晴',identity:'DEMO-COMPANION-01'},{name:'赵平',identity:'DEMO-COMPANION-02'}];
function visitPhoto(label,id,required=true){
 return `<div class="booking-photo visit-uploader"><span>${label}${required?'<b class="booking-required" aria-hidden="true">*</b>':''}</span>
  <div class="visit-photo-grid" data-photo-id="${id}">${btn(`visit-photo-${id}`,icon('plus'),'visit-photo-tile','type="button" aria-label="添加'+label+'" aria-haspopup="dialog"')}</div>
  <input type="hidden" name="photo-${id}"><span class="visually-hidden" role="status"></span></div>`;
}
function updateVisitPhoto(id,added){
 const grid=$(`[data-photo-id="${id}"]`);
 if(!grid)return;
 const photo=grid.closest('.booking-photo');
 if(added&&grid.querySelector('[aria-invalid=true]'))$('#booking-error').textContent='';
 photo.querySelector('input').value=added?'added':'';
 photo.querySelector('[role="status"]').textContent=added?'图片已添加':'图片已移除';
 grid.innerHTML=added?`<div class="visit-photo-preview">${icon('user')}<span>已添加</span>${btn(`visit-delete-${id}`,'×','visit-photo-delete','type="button" aria-label="移除图片"')}</div>`:
  btn(`visit-photo-${id}`,icon('plus'),'visit-photo-tile','type="button" aria-label="添加图片" aria-haspopup="dialog"');
}
function visitPicker(label,name,options){
 return `<label class="form-field"><span>${label}<b class="booking-required" aria-hidden="true">*</b></span>
  <select name="${name}" required><option value="">请选择${label}</option>
  ${options.map(value=>`<option>${value}</option>`).join('')}</select></label>`;
}
function updateVisitCompanionCount(){
 $('#visit-companion-count').textContent=$('#visit-companions').childElementCount;
}
function addVisitCompanion(history){
 const id=++pageState.visitCompanionId;
 const list=$('#visit-companions');
 list.insertAdjacentHTML('beforeend',`<div class="visit-companion">
  <details ${history?'':'open'}><summary><span class="visit-companion-name">${history?esc(history.name):'新同行人'}</span>
   <span class="visit-row-action">资料 ${chev()}</span></summary>
   <div class="visit-companion-fields">
    ${bookingField('姓名',`companion-name-${id}`,'请输入姓名',true)}
    ${bookingField('身份证',`companion-id-${id}`,'请输入身份证号码',true)}
    ${visitPhoto('同行人照片',`companion-${id}`)}</div></details>
  ${btn('visit-companion-remove','删除','visit-companion-delete','type="button" aria-label="删除同行人"')}</div>`);
 const row=list.lastElementChild;
 if(history){
  row.dataset.historyName=history.name;
  row.querySelector(`[name="companion-name-${id}"]`).value=history.name;
  row.querySelector(`[name="companion-id-${id}"]`).value=history.identity;
  updateVisitPhoto(`companion-${id}`,true);
 }
 updateVisitCompanionCount();
 row.querySelector(history?'summary':'input').focus();
}
function drawVisitHosts(){
 const hosts=pageState.visitHosts.map(i=>visitDirectory[i]);
 $('#visit-hosts').innerHTML=hosts.map((host,i)=>`<div class="visit-host"><span><strong>${host.name}</strong><small>${host.department} · ${host.phone}</small></span>
  ${btn(`visit-host-remove-${i}`,'移除','visit-row-remove',`type="button" aria-label="移除${host.name}"`)}</div>`).join('');
 $('#visit-points').textContent=[...new Set(hosts.flatMap(host=>host.points))].join('、')||'选择被访人后自动带出';
}
function searchVisitHosts(query){
 const matches=visitDirectory.map((host,i)=>({host,i})).filter(({host,i})=>
  !pageState.visitHosts.includes(i)&&(host.name.includes(query)||host.phone.includes(query)));
 $('#visit-host-results').innerHTML=!query?'':matches.length?matches.map(({host,i})=>
  btn(`visit-host-select-${i}`,`<span><strong>${host.name}</strong><small>${host.department}</small></span><span class="visit-row-action">${icon('plus')}添加</span>`,'picker-option visit-search-result')).join(''):
  '<p class="hint">没有可添加的匹配人员。</p>';
}
function handleVisitAction(action,el){
 if(action.startsWith('visit-host-select-')){
  const index=Number(action.slice('visit-host-select-'.length));
  if(visitDirectory[index]&&!pageState.visitHosts.includes(index))pageState.visitHosts.push(index);
  drawVisitHosts();$('#visit-host-query').value='';searchVisitHosts('');$('#visit-host-query').focus();return;
 }
 if(action.startsWith('visit-host-remove-')){
  pageState.visitHosts.splice(Number(action.slice('visit-host-remove-'.length)),1);
  drawVisitHosts();$('#visit-host-query').focus();return;
 }
 if(action==='visit-companion-add')return addVisitCompanion();
 if(action==='visit-companion-history'){
  const added=[...document.querySelectorAll('.visit-companion[data-history-name]')].map(row=>row.dataset.historyName);
  sheet('选择历史同行人',`<div class="picker-options">${visitCompanionHistory.map((person,i)=>
   btn(`visit-companion-use-${i}`,`<span>${person.name}</span>${chev()}`,'picker-option',added.includes(person.name)?'disabled':'')).join('')}</div>`);
  return;
 }
 if(action.startsWith('visit-companion-use-')){
  const person=visitCompanionHistory[Number(action.slice('visit-companion-use-'.length))];
  closeSheet();if(person)addVisitCompanion(person);return;
 }
 if(action==='visit-companion-remove'){
  const row=el.closest('.visit-companion');
  if(row.contains($('#booking-error')))$('.booking-submit').prepend($('#booking-error'));
  row.remove();updateVisitCompanionCount();$('[data-action="visit-companion-add"]').focus();return;
 }
 if(action.startsWith('visit-photo-')){
  const id=action.slice('visit-photo-'.length);
  sheet('添加图片',`<div class="visit-photo-actions">
   ${btn(`visit-camera-${id}`,'拍照','visit-action-cell')}${btn(`visit-upload-${id}`,'从相册选择','visit-action-cell')}${btn('close','取消','visit-action-cell')}</div>`);
  return;
 }
 const photoAction=/^visit-(camera|upload|delete)-(.+)$/.exec(action);
 if(photoAction){
  const [,mode,id]=photoAction;
  if(mode!=='delete')closeSheet();
  updateVisitPhoto(id,mode!=='delete');
  $(`[data-action="visit-${mode==='delete'?'photo':'delete'}-${id}"]`)?.focus();
 }
}
function showBookingForm(type){
 Object.assign(pageState,{bookingSubmitted:false,bookingUnknown:false,bookingDiscarded:false,bookingType:type,visitHosts:[],visitCompanionId:0,visitNoticeRead:[false,false]});
 const freight=type==='freight';
 const history=!freight&&model.requests.some(r=>r.type==='ordinary'&&r.owner===model.externalUser.id);
 const historyLink=history?btn('booking-history','参考历史预约','secondary','type="button" aria-haspopup="dialog"'):'';
 const personLabel=freight?'司机':'访客';
 const person=detailPanel(freight?'驾驶人信息':'访客信息',
  bookingField(freight?'实际司机姓名':'访客姓名','name','请输入姓名',true)+
  bookingField(personLabel+'手机号','phone','请输入手机号',true,'tel')+
  bookingField(personLabel+'身份证','identity','请输入身份证号码',true)+
  '<p class="visit-id-note">拜访的时候请携带身份证件(您的身份证信息需要在拜访时核验，未经授权不会向第三方提供。)</p>'+
  visitPhoto(personLabel+'照片','visitor'));
 const business=freight?detailPanel('车辆与货物',visitPicker('业务目的','purpose',['发货','送货','发送货'])+
  bookingField('车牌号','plate','请输入实际到厂车辆车牌',true)+visitPhoto('物资出门证','material-pass')):'';
 const hosts=detailPanel('被访人信息',`<div class="visit-host-section">
   <label class="visit-searchbar">${icon('search')}<input id="visit-host-query" type="search" placeholder="搜索姓名或手机号" aria-label="搜索被访人姓名或手机号" autocomplete="off"></label>
   <div id="visit-host-results"></div><div id="visit-hosts"></div>
   <div class="visit-points-panel"><strong>${icon('shield')}通行点范围</strong><span id="visit-points" aria-live="polite">选择被访人后自动带出</span></div></div>`);
 const schedule=detailPanel(freight?'预约时间':'拜访安排',bookingField(freight?'预约日期':'拜访日期','date','',true,'date')+
  visitPicker(freight?'预约时段':'拜访时段','period',['09:00—11:00','14:00—16:00'])+
  (freight?'':visitPicker('拜访目的','visitPurpose',['商务交流','其他'])+
   `<div id="visit-other" hidden>${bookingField('具体拜访目的','reason','请填写具体目的',true)}</div>`));
 const optional=detailPanel('补充信息（选填）',
  (freight?'':`<fieldset class="visit-vehicle"><legend>车辆信息</legend>
   <label><input type="radio" name="visitVehicle" value="无">无车</label>
   <label><input type="radio" name="visitVehicle" value="有">有车</label>
   </fieldset><div id="visit-plate" hidden>${bookingField('车牌号','plate','请输入车牌号',true)}</div>`)+
  bookingField('备注','remarks','请输入备注')+(freight?'':visitPhoto('相关图片','attachments',false)));
 const notices=`<div class="visit-agreements" id="notice-flags">${bookingNotices.map((n,i)=>
   `<div class="visit-agree"><input type="checkbox" id="visit-agree-${i}" name="visitAgree-${i}" aria-label="同意${n.title}" disabled>
    <label for="visit-agree-${i}">我已阅读并同意</label>${btn('readNotice-'+i,'《'+n.title+'》','visit-notice-link','type="button"')}
    <small class="visit-notice-status" aria-live="polite"></small></div>`).join('')}</div>`;
 const companions=detailPanel('同行人（选填）',`<p class="visit-companion-total" role="status">同行人数 <strong id="visit-companion-count">0</strong> 人</p><div id="visit-companions"></div>
  ${btn('visit-companion-add',icon('plus')+'新增同行人','visit-add-cell','type="button"')}
  ${btn('visit-companion-history','选择历史同行人'+chev(),'visit-add-cell','type="button" aria-haspopup="dialog"')}`);

 sheet(freight?'货运预约':'普通访客预约',`<form id="booking-form" class="leave-detail" novalidate>
  <section class="leave-panel booking-intro"><div><p>入厂预约</p><h2>${freight?'货运来访':'普通来访'}</h2><p>${freight?'一车一单，请登记实际到厂人员及车辆。':'填写来访信息，提交后等待审批。'}</p></div>${historyLink}</section>
  ${person}${business}${schedule}${hosts}${companions}${optional}${notices}
  <div class="booking-submit"><p class="form-error" id="booking-error" role="alert"></p>${btn('submitBooking','提交预约','primary full','type="submit"')}</div>
 </form>`);
}
function showBookingHistory(){
 const list=model.requests.filter(r=>r.type==='ordinary'&&r.owner===model.externalUser.id);
 sheet('参考历史预约',`<p class="hint">仅带入历史事由作为本次具体目的，请重新选择被访人。</p><div class="picker-options">${list.map((r,i)=>btn(`booking-reuse-${i}`,`<span>${esc(r.title)} · ${esc(r.date)}</span>${chev()}`,'picker-option')).join('')}</div>`);
}
function restoreBookingForm(){closeSheet();backPage();}
function hasBookingDraft(){
 const form=$('#booking-form');
 if(!form||pageState.bookingSubmitted||pageState.bookingUnknown)return false;
 return [...new FormData(form)].some(([name,value])=>name==='date'?value!==TODAY:value.trim())||
  Boolean(pageState.visitHosts.length||$('#visit-companions .visit-companion'));
}
function readBookingNotice(index){
 const {title,summary,paragraphs}=bookingNotices[index];
 const mustRead=!pageState.visitNoticeRead[index];
 sheet(title,`<article class="booking-reading"><header><p>入厂告知 · ${index+1}/2</p><h2>${summary}</h2></header>
  ${paragraphs.map(([heading,body])=>detailPanel(heading,`<p>${body}</p>`)).join('')}
  <div class="booking-reading-actions">
   <p class="hint" id="visit-reading-status" role="status">${mustRead?'请阅读 5 秒，返回后可勾选同意。':'已完成阅读，返回后可勾选同意。'}</p>
   ${btn('returnBooking','返回预约','primary full')}</div></article>`);
 if(mustRead){
  const status=$('#visit-reading-status');
  const deadline=performance.now()+5000;
  const timer=setInterval(()=>{
   if(!status.isConnected){clearInterval(timer);return;}
   const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));
   if(seconds){status.textContent=`请继续阅读 ${seconds} 秒。`;return;}
   clearInterval(timer);
   pageState.visitNoticeRead[index]=true;
   status.textContent='已完成阅读，返回后可勾选同意。';
  },200);
 }

}
function submitBooking(){
 if(pageState.bookingSubmitted||pageState.bookingUnknown)return;
 const form=$('#booking-form');if(!form)return;
 const data=Object.fromEntries(new FormData(form));
 const freight=pageState.bookingType==='freight';
 const error=$('#booking-error');
 const invalid=(message,selector)=>{
  error.textContent=message;
  const control=form.querySelector(selector);
  const group=control?.closest('.form-field,.booking-choices,.booking-photo,.visit-host-section,#notice-flags');
  group?.insertAdjacentElement('afterend',error);
  control?.setAttribute('aria-invalid','true');control?.setAttribute('aria-describedby',error.id);control?.focus();
 };
 error.textContent='';
 form.querySelectorAll('[aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});
 if(!data.name?.trim()||!data.date)return invalid('请填写姓名与预约日期。',data.name?.trim()?'[name="date"]':'[name="name"]');
 if(data.date<TODAY)return invalid('预约日期不能早于今天。','[name="date"]');
 const personLabel=freight?'司机':'访客';
 if(!data.phone.trim())return invalid(`请填写${personLabel}手机号。`,'[name="phone"]');
 if(!data.identity.trim())return invalid(`请填写${personLabel}身份证。`,'[name="identity"]');
 if(!data['photo-visitor'])return invalid(`请添加${personLabel}照片。`,'[data-action="visit-photo-visitor"]');
 if(freight){
  if(!data.purpose)return invalid('请选择货运业务目的。','[name="purpose"]');
  if(!data.plate.trim())return invalid('请输入车牌号。','[name="plate"]');
  if(!data['photo-material-pass'])return invalid('请添加物资出门证。','[data-action="visit-photo-material-pass"]');
 }
 if(!data.period)return invalid(freight?'请选择预约时段。':'请选择拜访时段。','[name="period"]');
 if(!freight){
  if(!data.visitPurpose)return invalid('请选择拜访目的。','[name="visitPurpose"]');
  if(data.visitPurpose==='其他'&&!data.reason.trim())return invalid('请填写具体拜访目的。','[name="reason"]');
  if(data.visitVehicle==='有'&&!data.plate.trim())return invalid('请输入车牌号。','[name="plate"]');
 }
 if(!pageState.visitHosts.length)return invalid('请至少添加一名被访人。','#visit-host-query');
 const companions=form.querySelectorAll('#visit-companions .visit-companion');
 for(const companion of companions){
  const missing=[...companion.querySelectorAll('input')].find(input=>!input.value.trim());
  if(missing){
   companion.querySelector('details').open=true;
   return invalid('请补齐同行人姓名、身份证和照片。',missing.type==='hidden'?
    `[data-action="visit-${missing.name}"]`:`[name="${missing.name}"]`);
  }
 }
 data.companionCount=companions.length;
 data.hosts=pageState.visitHosts.map(i=>visitDirectory[i].name);
 const unreadIndex=bookingNotices.findIndex((_,i)=>!pageState.visitNoticeRead[i]||!data[`visitAgree-${i}`]);
 if(unreadIndex!==-1){
  const read=pageState.visitNoticeRead[unreadIndex];
  return invalid(read?'请分别勾选同意两份告知。':'请分别阅读两份告知满 5 秒。',read?
   `#visit-agree-${unreadIndex}`:`[data-action="readNotice-${unreadIndex}"]`);
 }
 const result=localAction('booking',data,{scenario,actor:model.actor});
 pageState.bookingSubmitted=result.status==='success';
 pageState.bookingUnknown=result.status==='unknown';
 if(pageState.bookingSubmitted||pageState.bookingUnknown)$('[data-action="submitBooking"]').disabled=true;
 if(!pageState.bookingSubmitted)return pending(pageState.bookingUnknown?'结果待确认':'暂不可提交',result.message);
 sheet('提交反馈',`<div class="result"><div class="success-symbol">${icon('check')}</div><h3>预约已提交</h3><p>预约正在等待审批。</p>${btn('close','完成','primary full')}</div>`);
}

function dispatch(action,el){
 if(action==='close'){if($('#sheet-layer').hidden&&secondaryAction)backPage();else closeSheet();return;}
 if(action==='retry'){scenario='normal';updateParams();render();return;}
 if(action==='work'||action==='requests'||action==='newBooking'){go(action==='work'?'work':action==='requests'?'requests':'booking');return;}
 if(scenario==='forbidden')return pending('访问受限','当前账号无权执行此操作。');
 if(action==='messages')return showMessages();
 if(action==='myRequests')return showMyRequests();
 if(action==='attendance')return showAttendance();
 if(action==='tasks')return showTasks();
 if(action==='approval'||action.startsWith('approval-'))return showApproval(action==='approval'?0:Number(action.slice(9)));
 if((action==='approve'||action==='reject')&&$('#approval-note'))return submitTaskDecision(
  [secondaryAction==='approval'?0:Number(secondaryAction.slice(9))],action,$('#approval-note').value);
 if(action.startsWith('request-'))return showRecord(Number(action.slice(8)));
 if(action==='guard')return model.actor.guard&&model.actor.onDuty?sheet('安保现场',`<div class="selection-intro"><h2>当班现场服务</h2><p>${esc(model.actor.point)} · 08:00—17:30</p></div><div class="choice-options">${choice('当班预约名单','查看当前负责点位的预约人员','users','guardList','查看名单')}</div>`):pending('暂不可进入',model.actor.guard?'当前非当班时段，不能查阅或操作现场数据。':'此入口需要安保授权和当前负责点位。');
 if(action==='guardList')return model.actor.guard&&model.actor.onDuty?sheet('当班预约名单',
  `<div class="point-context"><strong>${esc(model.actor.point)}</strong><span>当前负责点位</span></div>`+
  (model.guardVisitors.length?records(model.guardVisitors.map((v,i)=>recordItem({title:v.name,action:`guardVisitor-${i}`,meta:[['预约时段',v.period],['来访事由',v.purpose]],status:tag('待核验','warning')}))):empty('当前暂无待核验人员','','users'))):pending('无权查看','当前未满足当班及点位授权条件。');
 if(action.startsWith('guardVisitor-')){
  if(!model.actor.guard||!model.actor.onDuty)return pending('无权查看','当前未满足当班及点位授权条件。');
  const visitor=model.guardVisitors[Number(action.slice(13))];
  return visitor?detailPage('预约人员信息',
   detailSummary(model.actor.point,visitor.name,tag('待核验','warning'),visitor.period),
   detailPanel('预约信息',fields([['来访事由',visitor.purpose],['预约时段',visitor.period],['负责点位',model.actor.point]])),
   detailPanel('现场记录','<p>尚未产生本次核验或设备实际入厂记录。</p>')):missingRecord();
 }
 if(action==='departmentVoucher')return model.actor.departmentVoucher?pending('部门用券申请','部门用券由合法发起人提交，需部门负责人一审与不同合法行政人员二审。暂不可提交。'):pending('部门用券申请','当前账号没有部门用券发起资格。');
 if(action==='southLunch')return pending('南园午餐申请','这是独立的南园午餐申请，由部门负责人在PC审批后汇总人数。暂不可提交。');
 if(action==='relatedVisits')return sheet('我的来访',`<div class="host-visits">${renderRequestCollection()}</div>`);
 if(action==='relatedDetail'||action.startsWith('relatedDetail-')){
  const visit=action==='relatedDetail'?model.hostVisits[0]:model.hostVisits.find(r=>r.id===action.slice('relatedDetail-'.length));
  return visit?showVisitDetail(visit,'来访详情'):missingRecord();
 }
 if(action==='leave')return sheet('请假年休',`<div class="selection-intro"><h2>请选择申请类型</h2><p>选择后填写对应申请信息</p></div><div class="choice-options">${choice('请假申请','填写请假时段与事由','calendar','leaveForm')}${choice('年休申请','查看年休额度并填写申请','leaf','annualForm')}</div>`);
 if(['leaveForm','annualForm','trip','door','overtime'].includes(action))return showEmployeeForm(action);
 if(action==='punch')return pending('当天补卡',!model.actor.attendance?'免打卡人员无需提交补卡申请。':model.actor.noSchedule?'今日没有有效排班，不能据此产生补卡申请。':'今日没有可补卡的缺卡记录。');
 if(action==='account'){
  const ledger=[['午餐消费','2026-11-06','11:42','−12.00'],['午餐消费','2026-11-05','11:38','−10.00'],['账户充值','2026-11-02','09:00','+180.00']];
  return detailPage('账户明细',
   `<section class="leave-panel account-summary"><h2>账户余额（元）</h2><strong>${model.balance}</strong><span>${esc(model.actor.name)} · 本人账户</span></section>`,
   detailPanel('收支记录',scenario==='empty'?empty('暂无收支记录','消费与充值记录将在这里展示','file'):`<div class="ledger-days">${ledger.map(([name,date,time,amount])=>`<section><h3>${date}</h3><div class="ledger"><div><strong>${name}</strong><p>${time}</p></div><b class="${amount.startsWith('+')?'ledger-credit':''}">${amount} <small>元</small></b></div></section>`).join('')}</div>`));
 }
 if(action==='vouchers')return sheet('我的餐券',model.vouchers.length?`<div class="voucher-list">${records(model.vouchers.map((v,i)=>recordItem({
  title:v.name,action:`voucher-${i}`,meta:[['核销方式',v.channel],['持券人',v.holder]],status:tag(v.status,v.tone)})))}</div>`:empty('暂无餐券','','ticket'));
 if(action.startsWith('voucher-')){
  const v=model.vouchers[Number(action.slice(8))];
  return v?detailPage('餐券详情',detailSummary('餐券权益',v.name,tag(v.status,v.tone)),
   detailPanel('持券信息',fields([['持券人',v.holder],['餐券编号',v.id]])),
   detailPanel('核销方式',fields([['核销渠道',v.channel]])+(v.status==='可用'?'<p class="object-note">请在食堂消费终端使用。</p>':''))):missingRecord();
 }
 if(action==='selfVoucher')return pending('员工本人用券申请','仅可为本人申请，固定人脸核销，由所属部门负责人一级审批。暂不可提交。');
 if(action==='voucherApply')return sheet('用券申请',`<div class="choice-options">${choice('员工用券','为本人申请 · 固定人脸核销','user','selfVoucher')}${choice('部门用券','合法部门发起 · 支持多人','users','departmentVoucher',model.actor.departmentVoucher?'去申请':'查看资格')}</div>`);
 if(action==='chooseCanteen')return sheet('选择食堂',`<p class="hint">选择食堂，查看对应日期的已发布菜谱。</p><div class="picker-options" role="radiogroup" aria-label="食堂">${model.canteens.map(c=>btn(`canteen-${c.id}`,`<span>${esc(c.name)}</span><i class="picker-check">${c.id===pageState.canteenId?icon('check'):''}</i>`,'picker-option',`role="radio" aria-checked="${c.id===pageState.canteenId}"`)).join('')}</div>`);
 if(action.startsWith('canteen-')){const id=action.slice(8);if(!model.canteens.some(c=>c.id===id))return toast('当前食堂不可查看。');pageState.canteenId=id;closeSheet();$('#page').innerHTML=renderCanteen();return;}
 if(action.startsWith('day-')){pageState.day=Number(action.slice(4));$('#page').innerHTML=renderCanteen();return;}
 if(action==='profile'){
  const a=route.external?model.externalUser:model.actor;
  return detailPage('个人资料',detailSummary(route.external?'外部来访':'员工',a.name),
   detailPanel(route.external?'联系资料':'任职信息',fields(route.external?[['手机号',a.phone],['单位',a.company]]:[['工号',a.id],['部门',a.department],['职位',a.position]])));
 }
 if(action==='security')return sheet('账号安全',`<div class="selection-intro"><h2>账号设置</h2><p>选择需要修改的账号信息</p></div><div class="choice-options">${choice('修改密码','修改账号登录密码','lock','changePassword','去修改')}${choice('修改手机号','更换账号绑定手机号','phone','changePhone','去修改')}</div>`);
 if(action==='changePassword'||action==='changePhone')return pending(action==='changePassword'?'修改密码':'修改手机号','暂不支持在线修改。');
 if(action==='companions'){if(!route.external)return pending('暂不可访问','同行人维护仅面向外部来访账号。');return sheet('同行人维护',`${scenario==='empty'?empty('暂无常用同行人','您维护的常用同行人将在这里展示','users'):records([recordItem({title:'方晴',summary:'常用同行人',action:'companionDetail'})])}<div class="detail-note">暂不支持在线编辑同行人资料。</div>`);}
 if(action==='companionDetail'){
  if(!route.external)return pending('暂不可访问','同行人资料仅面向外部来访账号。');
  return detailPage('同行人资料',detailSummary('常用同行人','方晴'),
   detailPanel('预约登记','<p>请在每次预约时登记本次来访的同行人员。</p>'));
 }
 if(action==='face')return sheet('人脸与隐私',`<div class="face-outline">${icon('scan')}</div><div class="privacy-state"><span>人脸状态</span>${tag('已生效','success')}</div><div class="privacy-state"><span>隐私授权</span><span>已授权</span></div>${btn('faceUpdate','录入 / 更新人脸','primary full')}`);
 if(action==='faceUpdate')return pending('录入 / 更新人脸','暂不支持在线更新。');
 if(action==='visitorNotice')return notice('访客须知','请提前提交预约，按批准时段来访，并配合现场人员身份核验。审批通过与实际入厂分别记录。');
 if(action==='freightNotice')return notice('货运须知','货运预约按发货、送货、发送货分类，人、车、货分别登记。司机及随行人员均需配合现场核验。');
 if(action==='ordinary'||action==='freight')return showBookingForm(action);
 if(action==='submitBooking')return submitBooking();
 if(action==='booking-history')return showBookingHistory();
 if(action.startsWith('booking-reuse-')){
  const item=model.requests.filter(r=>r.type==='ordinary'&&r.owner===model.externalUser.id)[Number(action.slice(14))];
  if(item&&pageState.bookingType==='ordinary'){
   const picker=$('[name="visitPurpose"]');
   picker.value='其他';picker.dispatchEvent(new Event('change',{bubbles:true}));
   $('#booking-form [name="reason"]').value=item.title;
   pageState.visitHosts=[];drawVisitHosts();$('#visit-host-query').value='';searchVisitHosts('');
  }
  closeSheet();return;
 }
 if(action.startsWith('visit-'))return handleVisitAction(action,el);
 if(action.startsWith('readNotice-'))return readBookingNotice(Number(action.slice(11)));
 if(action==='returnBooking')return restoreBookingForm();
 if(action.startsWith('bookingDetail-'))return showBookingDetail(action.slice(14));
 if(action==='filter')return showFilter();
 if(action.startsWith('type-')){pageState.draftType=action.slice(5);$('#type-chips').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===el));return;}
 if(action==='filterReset'){pageState.draftType='all';$('#filter-date').value='';$('#type-chips').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.action==='type-all'));return;}
 if(action==='filterApply'){pageState.type=pageState.draftType;pageState.date=$('#filter-date').value;closeSheet();refreshRequests('filter');return;}
 if(action.startsWith('status-')){pageState.status=action.slice(7);refreshRequests(action);return;}
 if(action.startsWith('message-')){
  const item=pageState.messages?.[Number(action.slice(8))];if(!item)return;
  const target=route.external?'requests':({'本人申请通过':'myRequests','当前任务待审':'tasks'})[item[0]];
  return sheet('消息详情',`<article class="message-article"><p class="article-kind">消息通知</p><h2>${esc(item[0])}</h2><p>${esc(item[1])}</p>${target?btn(target,'查看相关业务','secondary full'):''}</article>`);
 }
 if(action==='submitEmployee')return submitEmployee();
}

function showEmployeeForm(type){pageState.formType=type;pageState.employeeSubmitted=false;const names={leaveForm:'请假申请',annualForm:'年休申请',trip:'出差申请',door:'临时出门',overtime:'加班申请'};sheet(names[type],`${kv('申请人',model.actor.name)}${kv('所属部门',model.actor.department)}${type==='annualForm'?`<div class="detail-note">年度：2026-04-01 至 2027-03-31<br>总额度 10 天 · 已用 2 天 · 待批占用 1 天 · 可用 7 天</div>`:''}<form id="employee-form" novalidate><label class="form-field"><span>开始时间</span><input name="start" type="datetime-local"></label><label class="form-field"><span>结束时间</span><input name="end" type="datetime-local"></label>${type==='annualForm'?'<label class="form-field"><span>申请天数</span><input name="days" type="number" min="0" step="any" placeholder="请输入本次申请天数"></label>':''}<label class="form-field"><span>申请事由</span><textarea name="reason" placeholder="请填写申请事由"></textarea></label><div class="form-error" id="employee-error" role="alert"></div>${btn('submitEmployee','确认提交','primary full')}</form>`);}
function submitEmployee(){if(pageState.employeeSubmitted)return toast('本页已提交，请勿重复提交。');const data=Object.fromEntries(new FormData($('#employee-form')));const err=$('#employee-error');if(!data.start||!data.end)return err.textContent='请选择开始与结束时间。';if(data.end<=data.start)return err.textContent='结束时间须晚于开始时间。';if(pageState.formType==='annualForm'){const days=Number(data.days);if(!Number.isFinite(days)||days<=0)return err.textContent='请填写大于零的申请天数。';if(days>7)return err.textContent='申请天数超过当前可用额度，请核对。';if(data.start.slice(0,10)<'2026-04-01'||data.end.slice(0,10)>'2027-03-31')return err.textContent='所选时段超出当前年休年度，请核对。';}const result=localAction('employeeRequest',data,{scenario,actor:model.actor});if(result.status!=='success')return pending('结果待确认',result.message);pageState.employeeSubmitted=true;sheet('提交反馈',`<div class="result"><div class="success-symbol">${icon('check')}</div><h3>申请已提交</h3><p>申请等待审批，请留意处理结果。</p>${btn('close','完成','primary full')}</div>`);}

function go(key){const next=pageRoutes.find(p=>p.key===key);if(next)location.hash=next.path;}
function drawTabs(){const items=route.external?[['booking','calendar','预约'],['requests','list','我的预约'],['externalMe','user','我的']]:[['home','home','首页'],['work','work','工作'],['canteen','food','食堂'],['me','user','我的']];$('#tabbar').innerHTML=items.map(([key,ico,name])=>`<a href="#${pageRoutes.find(p=>p.key===key).path}" ${route.key===key?'aria-current="page"':''} class="${route.key===key?'active':''}">${icon(ico)}<span>${name}</span></a>`).join('');}
function render(reset=false){
 if(typeof reset!=='boolean')reset=false;
 const path=location.hash.slice(1).split('?')[0]||'/mini/home';
 if(!reset&&currentPath!==path)saveView();
 closeSheet();$('#toast').hidden=true;
 route=pageRoutes.find(p=>p.path===path||path.startsWith(p.path+'/'));
 document.body.classList.toggle('leave-detail-view',/^\/mini\/(home|work)\/request-0$/.test(path));
 $('#viewport').dataset.page=route?.key||'unknown';
 if(!route){$('#page').innerHTML=heading('页面不可用')+`<main class="content">${card('',empty('未找到该页面','请检查地址后重试。'))}</main>`;$('#tabbar').innerHTML='';return;}
 const nextContext=`${route.key}:${actorKey}:${scenario}`;
 if(reset||contextKey!==nextContext){
  viewCache.clear();model=getPagePreset(route.key,actorKey,scenario);
  pageState={day:6,canteenId:'demo-a',status:'all',type:'all',date:'',search:'',taskTab:'pending',taskFilter:{},taskSelected:new Set(),taskResults:new Map(),taskUnknown:new Set()};contextKey=nextContext;
 }
 currentPath=path;secondaryAction=path===route.path?'':path.slice(route.path.length+1);
 if(secondaryAction.startsWith('readNotice-')){
  if(!pageState.bookingType)pageState.bookingType=new URLSearchParams(location.hash.split('?')[1]||'').get('kind')==='freight'?'freight':'ordinary';
  pageState.visitNoticeRead??=[false,false];
 }
 $('#viewport').dataset.secondary=String(Boolean(secondaryAction));
 $('#viewport').dataset.pageKind=pageKind(secondaryAction,route.key);
 $('#viewport').dataset.listType=secondaryAction==='messages'?'messages':'';
 $('#tabbar').hidden=Boolean(secondaryAction);
 const renderers={home:renderHome,booking:renderBooking,work:renderWork,canteen:renderCanteen,me:()=>renderMe(false),externalMe:()=>renderMe(true),requests:renderRequests};
 const cached=viewCache.get(path);
 const allowed=isAllowedPageAction(route.key,secondaryAction);
 if(secondaryAction&&!allowed)renderSecondary('页面不可用',empty('无法访问该页面','请返回上一级，从有效入口进入。','lock'));
 else if(cached){$('#page').innerHTML=cached.html;document.title=cached.title;}
 else if(secondaryAction){
  renderingSecondary=true;
  try{
   if(scenario==='forbidden')renderSecondary('访问受限',empty('当前页面访问受限','请使用有合法访问资格的账号。','lock'));
   else if(scenario==='error')renderSecondary('加载失败',empty('加载暂未完成','请检查后重试。','alert',true));
   else{
    if(secondaryAction.startsWith('message-')&&!pageState.messages)showMessages();
    const missing=secondaryAction.startsWith('request-')&&!model.recent[Number(secondaryAction.slice(8))]
     ||secondaryAction.startsWith('voucher-')&&!model.vouchers[Number(secondaryAction.slice(8))]
     ||secondaryAction.startsWith('message-')&&(scenario==='empty'||!pageState.messages?.[Number(secondaryAction.slice(8))]);
    if(missing)missingRecord();else dispatch(secondaryAction);
   }
  }finally{renderingSecondary=false;}
 }else{
  $('#page').innerHTML=scenario==='forbidden'?heading(route.label)+`<main class="content">${card('',empty('当前页面访问受限','请使用有合法访问资格的账号。','lock'))}</main>`:scenario==='error'?heading(route.label)+`<main class="content">${card('',empty('加载暂未完成','请检查后重试。','alert',true))}</main>`:renderers[route.key]();
  document.title=`${route.label} · YADON`;
 }
 document.querySelectorAll('.visit-agree').forEach((row,i)=>{
  const read=pageState.visitNoticeRead[i];
  row.querySelector('input').disabled=!read;
  row.querySelector('.visit-notice-status').textContent=read?'':'阅读满 5 秒后可勾选';
 });
 drawTabs();$('#scroll-area').scrollTop=cached?.scroll||0;
 const restored=cached?.focus&&document.querySelector(`[data-action="${CSS.escape(cached.focus)}"]`);
 if(restored)restored.focus({preventScroll:true});
 else if(secondaryAction)$('#page h1')?.focus({preventScroll:true});
}

function updateParams(){const url=new URL(location.href);url.searchParams.set('actor',actorKey);url.searchParams.set('scenario',scenario);history.replaceState(null,'',url);}
document.addEventListener('click',e=>{const close=e.target.closest('[data-close-sheet]');if(close)return closeSheet();const el=e.target.closest('[data-action]');if(el&&!el.disabled){e.preventDefault();handleAction(el.dataset.action,el);}});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='booking-form')submitBooking();});
document.addEventListener('change',e=>{
 const conditions={visitPurpose:['#visit-other','其他'],visitVehicle:['#visit-plate','有']};
 const condition=conditions[e.target.name];
 if(!condition)return;
 const [selector,requiredValue]=condition;
 const group=$(selector);
 const input=group.querySelector('input');
 group.hidden=e.target.value!==requiredValue;input.disabled=group.hidden;
 if(group.hidden){
  input.value='';
  if(group.contains($('#booking-error'))){$('#booking-error').textContent='';$('.booking-submit').prepend($('#booking-error'));}
 }
});
document.addEventListener('input',e=>{if(e.target.name?.startsWith('companion-name-'))e.target.closest('.visit-companion').querySelector('.visit-companion-name').textContent=e.target.value.trim()||'新同行人';if(e.target.id==='visit-host-query')searchVisitHosts(e.target.value.trim());if(e.target.id==='request-search'){pageState.search=e.target.value;$('#request-list').innerHTML=requestList();}});
document.addEventListener('keydown',e=>{if($('#sheet-layer').hidden)return;if(e.key==='Escape'){closeSheet();return;}if(e.key==='Tab'){const nodes=[...$('#sheet-layer .sheet').querySelectorAll('button:not(:disabled),input,textarea,a[href],[tabindex="0"]')].filter(x=>x.offsetParent!==null);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('#sheet-layer .sheet'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!$('#sheet-layer .sheet').contains(document.activeElement))){e.preventDefault();first.focus();}}});
window.addEventListener('hashchange',render);
render();
