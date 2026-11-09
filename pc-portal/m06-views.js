import {escapeHtml as e,statusTag,filterBar,formField,actionButton,dataTable,paginate,pagination,stateView,
  openDialog,dialogHead,dialogBody,dialogFoot,formError} from './components.js';
import {detailField,detailSection} from './detail-primitives.js';
import {accessPages,accessScope,directions,pointReadiness,uniqueEvents} from './m06-model.js';

const status = enabled => enabled?'启用':'停用';
const onlineStatus = device => device.online==null?'未连接':device.online?'在线':'离线';
const tones = new Map([['启用','success'],['在线','success'],['可用','success'],['停用','neutral'],
  ['已停用','neutral'],['离线','warning'],['离线补传','warning'],['待补传','warning'],
  ['设备状态待确认','warning'],['设备不可用','danger'],['进出设备待补齐','warning'],['结果待确认','warning']]);
const tag = label => statusTag(label,tones.get(label)||'info');
const sourceLabels = {DEVICE_PASS_EVENT:'设备通行',FACE_VERIFIED_ONLY:'仅刷脸核验',UNKNOWN:'结果待确认'};
const deviceReady = (point,scope) => pointReadiness(point,scope.devices);
const names = (items,ids) => items.filter(item=>ids.includes(item.id)).map(item=>item.name).join('、') || '—';
const matches = (value,query) => !query || String(value).toLowerCase().includes(query.toLowerCase());
const row = (...cells) => `<tr>${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`;
const columns = fields => `<div class="compact-descriptions three">${fields.map(([label,value])=>detailField(label,value)).join('')}</div>`;
const command = (kind,label,id='',primary=false) => actionButton(label,{
  variant:primary?'primary':'text',attrs:`data-acs-action="${kind}" data-acs-id="${e(id)}"`
});
const textInput = (name,value='',attrs='') => `<input name="${name}" value="${e(value)}" ${attrs}>`;
const select = (name,items,value='',all=true) => `<select name="${name}">${all?'<option value="">全部</option>':''}${items.map(([key,label])=>
  `<option value="${e(key)}" ${key===value?'selected':''}>${e(label)}</option>`).join('')}</select>`;
const lookup = (label,input) => formField(label,input,{variant:'field',separator:' '});
const filter = fields => filterBar(fields.join('')+actionButton('查询',{type:'submit',variant:'primary'})+
  actionButton('重置',{attrs:'data-reset'}),'id="m06-filter"');
const pointOptions = scope => scope.points.map(point=>[point.id,point.name]);
const table = (title,headers,rows) => dataTable(headers,rows,{caption:title,empty:'没有匹配的记录'});
const card = (title,body,action='') => `<section class="card acs-card"><div class="card-head"><h2>${e(title)}</h2>${action}</div>${body}</section>`;

function listing(title,headers,rows,ui) {
  const model=paginate(rows,ui.page,ui.size);
  ui.page=model.page;
  return table(title,headers,model.rows)+pagination(model);
}

function placesView(scope,ui) {
  const f=ui.filters;
  const places=scope.places.filter(place=>matches(place.id+' '+place.name,f.keyword) && (!f.status || status(place.enabled)===f.status));
  const selected=places.find(place=>place.id===ui.place);
  const points=scope.points.filter(point=>selected?point.placeIds.includes(selected.id):
    !f.keyword && !f.status || point.placeIds.some(id=>places.some(place=>place.id===id)));
  return card('场所列表',
    filter([lookup('场所名称 / 编码',textInput('keyword',f.keyword,'placeholder="请输入关键词"')),
      lookup('状态',select('status',[['启用','启用'],['停用','停用']],f.status))])+
    table('场所列表',['场所编码','场所名称','位置','关联点位','状态','操作'],places.map(place=>
      row(e(place.id),`<button type="button" class="text" data-acs-action="pick-place" data-acs-id="${e(place.id)}" aria-pressed="${selected?.id===place.id}">${e(place.name)}</button>`,
        e(place.address||'—'),e(scope.points.filter(point=>point.placeIds.includes(place.id)).length),tag(status(place.enabled)),
        command('show-place','查看',place.id)+(scope.canManage?command('edit-place','编辑',place.id):'')))),
    scope.canManage?command('edit-place','新增场所','',true):'')+
    card('通行点列表',`<div class="list-toolbar"><span>${selected?'当前场所 · '+e(selected.name):'全部授权点位'}</span>${selected?command('pick-place','查看全部点位'):''}</div>`+
      table('通行点列表',['点位编码','点位名称','关联场所','进向设备','出向设备','状态','操作'],points.map(point=>
        row(e(point.id),e(point.name),e(names(scope.places,point.placeIds)),e(names(scope.devices,point.entry)),
          e(names(scope.devices,point.exit)),tag(deviceReady(point,scope)),
          command('show-point','查看',point.id)+(scope.canManage?command('edit-point','编辑',point.id):'')))),
      scope.canManage?command('edit-point','新增通行点','',true):'');
}

function deviceBindings(scope,device) {
  return scope.points.flatMap(point=>directions.filter(([key])=>point[key].includes(device.id))
    .map(([key,label])=>({point,key,label})));
}

function devicesView(scope,ui) {
  const f=ui.filters;
  const rows=scope.devices.flatMap(device=>{
    const bindings=deviceBindings(scope,device);
    const visible=bindings.filter(({point,key})=>(!f.point || f.point===point.id)&&(!f.direction||f.direction===key));
    if((f.point==='unbound' && (bindings.length || f.direction)) ||
       (f.point!=='unbound' && (f.point || f.direction) && !visible.length) ||
       (f.enabled && status(device.enabled)!==f.enabled) || (f.online && (onlineStatus(device))!==f.online)) return [];
    return [row(e(device.id),e(device.name),e(visible.map(({point,label})=>point.name+' · '+label).join('、')||'范围内未绑定'),
      tag(status(device.enabled)),tag(onlineStatus(device)),tag(device.report),command('show-device','查看',device.id)+
      (scope.canManage?command('toggle-device',status(!device.enabled),device.id):''))];
  });
  return card('设备列表',filter([
    lookup('通行点',select('point',[...pointOptions(scope),['unbound','范围内未绑定']],f.point)),
    lookup('方向',select('direction',directions,f.direction)),
    lookup('启停状态',select('enabled',[['启用','启用'],['停用','停用']],f.enabled)),
    lookup('在线状态',select('online',[['在线','在线'],['离线','离线'],['未连接','未连接']],f.online))
  ])+listing('设备列表',['设备编号','设备名称','点位与方向','启停状态','在线状态','上报状态','操作'],rows,ui),scope.canManage?command('create-device','新增设备','',true):'')+
  card('点位设备配置',table('点位设备配置',['通行点','进向设备','出向设备','配置状态','操作'],scope.points.map(point=>
    row(e(point.name),e(names(scope.devices,point.entry)),e(names(scope.devices,point.exit)),tag(deviceReady(point,scope)),
      command('show-point','查看',point.id)+(scope.canManage?command('bind-point','维护绑定',point.id):'')))));
}

function eventsView(scope,ui) {
  const f=ui.filters;
  const rows=uniqueEvents(scope.events).filter(event=>matches(event.person,f.person) &&
    (!f.point || event.pointId===f.point) && (!f.direction || event.direction===f.direction) &&
    (!f.source || event.source===f.source) && (!f.date || event.occurredAt.startsWith(f.date)));
  return card('事件列表',filter([
    lookup('人员',textInput('person',f.person,'placeholder="请输入姓名"')),
    lookup('通行点',select('point',pointOptions(scope),f.point)),
    lookup('方向',select('direction',directions.map(([,label])=>[label,label]),f.direction)),
    lookup('发生日期',textInput('date',f.date,'placeholder="YYYY-MM-DD" inputmode="numeric" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"')),
    lookup('证据类型',select('source',Object.entries(sourceLabels),f.source))
  ])+listing('通行事件流水',['事件编号 / 人员','通行点','方向','证据类型','发生时间 / 上报时间','同步状态','操作'],rows.map(event=>
    row(`<span class="mono">${e(event.id)}</span><small class="cell-secondary">${e(event.person)}</small>`,
      `${e(names(scope.points,[event.pointId]))}<small class="cell-secondary">来源 ${e(names(scope.devices,[event.deviceId]))}</small>`,
      e(event.direction||'—'),tag(sourceLabels[event.source]),`${e(event.occurredAt)}<small class="cell-secondary">${e(event.reportedAt||'—')}</small>`,
      tag(event.sync),command('show-event','查看',event.id))),ui));
}

const views = {'access-places':placesView,'access-devices':devicesView,'access-events':eventsView};
export function accessView(data,route,ui) {
  const scope=accessScope(data,route);
  if(scope.denied) return stateView('forbidden',{title:'暂无访问权限',description:'请联系系统权限管理员。'});
  const notes = {
    'access-places':'维护场所及其关联通行点',
    'access-devices':'查看设备状态，按通行点维护进出设备',
    'access-events':'按通行点查询核验证据与设备通行记录'
  };
  return `<div class="page-head"><div><h1>${e(accessPages[route.page])}</h1><p class="muted tiny">${e(notes[route.page])}</p></div></div>
    <div class="detail-stack">${ui.notice?`<div class="save-notice" role="status">${e(ui.notice)}</div>`:''}${views[route.page](scope,ui)}</div>`;
}

function checks(label,items,selected,key) {
  return `<fieldset class="acs-options full"><legend>${e(label)}</legend><div>${items.map(item=>
    `<label><input type="checkbox" name="${key}" value="${e(item.id)}" ${selected.includes(item.id)?'checked':''}> ${e(item.name)}</label>`
  ).join('')||'<span class="muted">暂无可选记录</span>'}</div></fieldset>`;
}

const stateField = enabled => formField('启停状态',select('enabled',[['true','启用'],['false','停用']],String(enabled),false));
const codeField = id => formField('编码',textInput('code',id,'required maxlength="24" '+(id?'readonly':'pattern="[A-Za-z0-9_-]+"')));
const nameField = name => formField('名称',textInput('name',name,'required maxlength="60"'));
const availableDevices = (data,scope,point) => scope.devices.filter(device=>
  point.entry.includes(device.id) || point.exit.includes(device.id) ||
  !data.points.some(other=>other.id!==point.id && (other.entry.includes(device.id)||other.exit.includes(device.id))));
const pointFields = (scope,point) => [
  ['点位编码',point.id],['点位名称',point.name],['关联场所',names(scope.places,point.placeIds)],
  ['进向设备',names(scope.devices,point.entry)],['出向设备',names(scope.devices,point.exit)],['状态',deviceReady(point,scope)]
];

const actionsByPage = {
  'access-places':['pick-place','show-place','show-point','edit-place','edit-point'],
  'access-devices':['show-device','show-point','bind-point','create-device','toggle-device'],
  'access-events':['show-event']
};
export function accessClick(button,{data,route,dialog,ui,render}) {
  const action=button.dataset.acsAction;
  if(!action || !data) return false;
  const scope=accessScope(data,route);
  if(scope.denied || !actionsByPage[route.page]?.includes(action)) return true;
  const id=button.dataset.acsId;
  const place=scope.places.find(item=>item.id===id), point=scope.points.find(item=>item.id===id);
  const device=scope.devices.find(item=>item.id===id);
  const event=uniqueEvents(scope.events).find(item=>item.id===id);
  if(action==='pick-place') {
    ui.place=ui.place===id?'':id;
    render();
    [...document.querySelectorAll('[data-acs-action="pick-place"]')].find(item=>item.dataset.acsId===id)?.focus();
    return true;
  }
  const show = (title,body,edit=false,submitLabel='保存') => {
    const header=dialogHead(title);
    const fields=dialogBody(edit?`<div class="edit-grid">${body}</div>${formError()}`:body);
    const footer=dialogFoot(actionButton(edit?'取消':'关闭',{attrs:'data-dialog-close'})+
      (edit?actionButton(submitLabel,{variant:'primary',type:'submit'}):''));
    openDialog(dialog,edit?`<form data-acs-edit="${action}" data-acs-id="${e(id)}">${header}${fields}${footer}</form>`:header+fields+footer,{
      onClose:()=>{if(button.isConnected)button.focus();}
    });
  };
  if(action==='show-place' && place) show('场所详情',columns([
    ['场所编码',place.id],['场所名称',place.name],['位置',place.address],['状态',status(place.enabled)],
    ['关联点位',scope.points.filter(item=>item.placeIds.includes(id)).map(item=>item.name).join('、')||'—']
  ]));
  if(action==='show-point' && point) show('通行点详情',columns(pointFields(scope,point)));
  if(action==='show-device' && device) show('设备详情',columns([
    ['设备编号',device.id],['设备名称',device.name],['启停状态',status(device.enabled)],
    ['在线状态',onlineStatus(device)],['上报状态',device.report],
    ['点位与方向',deviceBindings(scope,device).map(({point,label})=>point.name+' · '+label).join('、')||'范围内未绑定']
  ]));
  if(action==='show-event' && event) show('通行事件详情',columns([
    ['事件编号',event.id],['人员',event.person],['通行点',names(scope.points,[event.pointId])],
    ['方向',event.direction||'—'],['来源设备',names(scope.devices,[event.deviceId])],['证据类型',sourceLabels[event.source]],
    ['发生时间',event.occurredAt],['上报时间',event.reportedAt],['同步状态',event.sync]
  ]));
  if(!scope.canManage) return true;
  if(action==='toggle-device' && device) {
    const enabled=!device.enabled;
    const label=status(enabled);
    const message=enabled?'设备启用后，点位仍需满足进出设备及在线条件。':'停用后，该设备将不再计入点位的可用设备。';
    show(label+'设备',`<p class="full">确认${label}设备「${e(device.name)}」？${message}</p>
      <input type="hidden" name="enabled" value="${enabled}">`,true,'确认'+label);
  }
  if(action==='create-device' && route.page==='access-devices')
    show('新增设备',formField('设备编号',textInput('code','','required maxlength="24" pattern="[A-Za-z0-9_\\-]+"'))+
      formField('设备名称',textInput('name','','required maxlength="60"'))+stateField(true),true);
  if(action==='edit-place' && route.page==='access-places' && (!id || place))
    show(place?'编辑场所':'新增场所',codeField(place?.id||'')+nameField(place?.name||'')+
      formField('位置',textInput('address',place?.address||'','maxlength="100"'))+stateField(place?.enabled??true),true);
  if(action==='edit-point' && route.page==='access-places' && (!id || point))
    show(point?'编辑通行点':'新增通行点',codeField(point?.id||'')+nameField(point?.name||'')+
      stateField(point?.enabled??true)+checks('关联场所',scope.places,point?.placeIds||[],'places'),true);
  if(action==='bind-point' && route.page==='access-devices' && point) {
    const devices=availableDevices(data,scope,point);
    show('维护设备绑定',`<p class="edit-context full">${e(point.name)} · 进、出方向各至少配置一台设备。</p>`+
      directions.map(([key,label])=>checks(label+'设备',devices,point[key],key)).join(''),true);
  }
  return true;
}

export function accessSubmit(form,{data,route,dialog,ui,render}) {
  const action=form.dataset.acsEdit;
  if(!action) return false;
  if(!data) return true;
  const scope=accessScope(data,route);
  if(scope.denied || !scope.canManage) return true;
  const id=form.dataset.acsId;
  const values=new FormData(form);
  const error=message=>{form.querySelector('.form-error').textContent=message;return true;};
  if(action==='toggle-device' && route.page==='access-devices') {
    const device=scope.devices.find(item=>item.id===id);
    const enabled=values.get('enabled');
    if(!device || !['true','false'].includes(enabled)) return true;
    device.enabled=enabled==='true';
  } else if(action==='create-device' && route.page==='access-devices' && !id) {
    const code=String(values.get('code')||'').trim(), name=String(values.get('name')||'').trim();
    if(!/^[A-Za-z0-9_-]{1,24}$/.test(code) || !name || name.length>60) return error('请填写有效的设备编号及名称。');
    if(data.devices.some(device=>device.id===code)) return error('设备编号已存在。');
    data.devices.unshift({id:code,name,enabled:values.get('enabled')==='true',online:null,report:'未上报'});
    data.scope.deviceIds.push(code);
    ui.filters={};
    ui.page=1;
  } else if(action==='bind-point' && route.page==='access-devices') {
    const point=scope.points.find(item=>item.id===id);
    if(!point) return true;
    const available=availableDevices(data,scope,point);
    const selected = key => [...point[key].filter(deviceId=>!scope.devices.some(device=>device.id===deviceId)),...values.getAll(key)];
    const entry=selected('entry'), exit=selected('exit');
    if([...values.getAll('entry'),...values.getAll('exit')].some(deviceId=>!available.some(device=>device.id===deviceId)))
      return error('请选择当前范围内可配置的设备。');
    if(new Set([...entry,...exit]).size!==entry.length+exit.length)
      return error('同一设备在此点位只能绑定一次，请检查进出方向。');
    if(!entry.length || !exit.length) return error('请为进向和出向各选择至少一台设备。');
    Object.assign(point,{entry,exit});
  } else if(route.page==='access-places' && ['edit-place','edit-point'].includes(action)) {
    const isPlace=action==='edit-place', collection=isPlace?data.places:data.points;
    const allowed=isPlace?scope.places:scope.points;
    const existing=allowed.find(item=>item.id===id);
    if(id && !existing) return true;
    const code=String(values.get('code')||'').trim(), name=String(values.get('name')||'').trim();
    if(!/^[A-Za-z0-9_-]{1,24}$/.test(code) || !name || name.length>60) return error('请填写有效的编码及名称。');
    if(!existing && collection.some(item=>item.id===code)) return error('编码不可用，请更换后重试。');
    const changes={name,enabled:values.get('enabled')==='true'};
    if(isPlace) changes.address=String(values.get('address')||'').trim().slice(0,100);
    else {
      const visible=values.getAll('places');
      if(visible.some(placeId=>!scope.places.some(place=>place.id===placeId))) return error('请选择授权范围内的场所。');
      const hidden=(existing?.placeIds||[]).filter(placeId=>!scope.places.some(place=>place.id===placeId));
      changes.placeIds=[...new Set([...hidden,...visible])];
      if(!changes.placeIds.length) return error('请选择至少一个关联场所。');
    }
    if(existing) Object.assign(existing,changes);
    else {
      collection.push({id:code,...(isPlace?{}:{entry:[],exit:[]}),...changes});
      (isPlace?data.scope.placeIds:data.scope.pointIds).push(code);
    }
  } else return true;
  ui.notice='已保存';
  dialog.close();
  render();
  const target=[...document.querySelectorAll('[data-acs-action]')].find(button=>button.dataset.acsAction===action && button.dataset.acsId===id);
  target?.focus();
  return true;
}
