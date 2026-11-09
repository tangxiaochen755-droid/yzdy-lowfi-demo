import {loadFixture} from './data-adapter.js';

export const accessPages = Object.freeze({
  'access-places':'场所与通行点',
  'access-devices':'设备管理',
  'access-events':'通行事件流水'
});
export const isAccessPage = page => Object.hasOwn(accessPages,page);

export function loadAccessData(signal) {
  return loadFixture(new URL('./m06-fixtures.json',import.meta.url),{
    signal,
    validate:data=>Boolean(data?.scope) &&
      ['places','points','devices','grants','events'].every(key=>Array.isArray(data[key])) &&
      ['pages','placeIds','pointIds','deviceIds','departmentIds'].every(key=>Array.isArray(data.scope[key]))
  });
}

export function accessScope(data,route) {
  const allowed = data.scope.pointIds;
  const points = data.points.filter(point=>allowed.includes(point.id));
  return {
    denied:route.profile==='denied' || !data.scope.pages.includes(route.page),
    canManage:data.scope.manage === true,
    places:data.places.filter(place=>data.scope.placeIds.includes(place.id)),
    points,
    devices:data.devices.filter(device=>data.scope.deviceIds.includes(device.id)),
    events:data.events.filter(event=>allowed.includes(event.pointId))
  };
}

export const directions = [['entry','进厂'],['exit','离厂']];
export function pointReadiness(point,devices) {
  if(!point.enabled) return '已停用';
  if(directions.some(([key])=>!point[key].length)) return '进出设备待补齐';
  const unavailable = directions.filter(([key])=>
    !devices.some(device=>point[key].includes(device.id) && device.enabled && device.online));
  if(unavailable.some(([key])=>point[key].every(id=>devices.some(device=>device.id===id)))) return '设备不可用';
  if(unavailable.length) return '设备状态待确认';
  return '可用';
}

export function uniqueEvents(events) {
  const byId = new Map();
  for(const event of events) {
    if(!byId.has(event.id)) byId.set(event.id,event);
  }
  return [...byId.values()].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
}
