import {loadAttendance,attendancePages} from './m04-model.js';
import {attendanceView} from './m04-views.js?v=f17-rectify';
import {attendanceClick,attendanceSubmit,attendanceChange} from './m04-workflows.js';
import {shellMarkup,routeUrl} from './shell.js';
import {stateView,tabDestination} from './components.js';

const app=document.querySelector('#app');
const dialog=document.querySelector('#dialog');
const defaultPage='attendance-schedules';
const children=['attendance-shifts',defaultPage,'attendance-groups'].map(page=>[page,attendancePages[page]]);
const navigation=[{glyph:'clock',label:'考勤排班',target:defaultPage,children}];
const getRoute=()=>({page:children.find(([page])=>page===new URLSearchParams(location.search).get('page'))?.[0]||defaultPage});
let route=getRoute(),data,failed=false,collapsed=false,openGroup=defaultPage;
const states=new Map();
const state=()=>{
  if(!states.has(route.page)) states.set(route.page,{tab:'',page:1,size:10,filters:{}});
  return states.get(route.page);
};
function render() {
  const title=attendancePages[route.page];
  const content=data?attendanceView(data,route,state()):failed?
    stateView('error',{title:'数据加载失败',description:'请检查连接后重试。',retry:true}):
    stateView('loading',{title:'正在加载',description:'请稍候…'});
  app.innerHTML=shellMarkup({route,title,collapsed,openGroup,group:defaultPage,breadcrumb:'考勤排班',busy:!data&&!failed,
    actor:{name:'排班管理员',label:'授权组织范围'},navigation,visited:[{...route,title}],pinnedPages:[route.page]},content);
  document.title=title+' · 扬锻工业园区综合管理平台';
}
async function load() {
  failed=false;
  render();
  try {data=await loadAttendance();}
  catch {failed=true;}
  render();
}
function switchTab(key) {
  Object.assign(state(),{tab:key,page:1,filters:{},calendarMode:'week',rulePreview:null});
  render();
  app.querySelector('[data-biz-tab="'+CSS.escape(key)+'"]')?.focus();
}
const context=()=>({data,route,ui:state(),dialog,render});
app.addEventListener('click',event=>{
  const control=event.target.closest('button,a');
  if(!control||control.disabled) return;
  if(control.dataset.route&&children.some(([page])=>page===control.dataset.route)) {
    event.preventDefault();
    if(dialog.open) dialog.close();
    route={page:control.dataset.route};
    history.pushState({},'',routeUrl(route));
    openGroup=defaultPage;
    render();
  } else if(control.id==='collapse') {
    collapsed=!collapsed;render();app.querySelector('#collapse').focus();
  } else if(control.dataset.navGroup) {
    openGroup=openGroup?'':defaultPage;render();app.querySelector('[data-nav-group]')?.focus();
  } else if(control.hasAttribute('data-retry')) load();
  else if(control.id==='refresh') render();
  else if(data&&attendanceClick(control,context())) return;
  else if(control.dataset.bizTab) switchTab(control.dataset.bizTab);
  else if(control.hasAttribute('data-reset')) {
    Object.assign(state(),{filters:{},page:1,notice:''});render();
    app.querySelector('.filters input,.filters select')?.focus();
  } else if(control.dataset.pageTo) {
    state().page=Number(control.dataset.pageTo);render();
  }
});
app.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id!=='m04-filter'&&!form.classList.contains('page-jump')) return;
  event.preventDefault();
  if(form.id==='m04-filter') {
    state().filters=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()]));
    state().page=1;
  } else state().page=Number(form.querySelector('input').value);
  render();
  app.querySelector('#m04-filter button[type=submit]')?.focus();
});
app.addEventListener('change',event=>{
  if(!event.target.hasAttribute('data-page-size')) return;
  Object.assign(state(),{size:Number(event.target.value),page:1});render();
  app.querySelector('[data-page-size]')?.focus();
});
app.addEventListener('keydown',event=>{
  const next=tabDestination(event);
  if(next) switchTab(next.dataset.bizTab);
});
dialog.addEventListener('change',event=>attendanceChange(event.target,context()));
dialog.addEventListener('submit',event=>{event.preventDefault();attendanceSubmit(event.target,context());});
dialog.addEventListener('click',event=>{
  if(event.target.closest('[data-dialog-close]')) dialog.close();
  const control=event.target.closest('[data-att-action]');
  if(control) attendanceClick(control,context());
});
window.addEventListener('popstate',()=>{
  if(dialog.open) dialog.close();
  route=getRoute();render();
});
load();
