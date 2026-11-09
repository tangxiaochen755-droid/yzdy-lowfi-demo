import {loadFixture} from './data-adapter.js';

export const visitPages = {
  visits:'访客申请列表', visit:'访客申请详情', presence:'访客出入及在场记录',
  'visit-lists':'黑白名单',
  guard:'保安工作台', 'guard-approved':'已审批待核验记录', 'guard-fact':'入离厂核验详情',
  'guard-materials':'工牌证件及物资领还', 'guard-events':'出入及异常记录'
};
export const objectPages = ['staff','approval','visit','guard-fact'];
export const isGuardPage = page => Object.hasOwn(visitPages,page) && page.startsWith('guard');
export const batchGroup = page => isGuardPage(page) ? 'guard' : Object.hasOwn(visitPages,page) ? 'visits' : null;
const departmentScope = ['行政部','销售部'];
const profiles = ['off-duty','other-point','denied'];
export const readProfile = key => profiles.includes(key) ? key : '';

export function loadVisitData(signal) {
  return loadFixture(new URL('./m01-fixtures.json',import.meta.url),{
    signal,
    validate: data => Boolean(data?.shift && data?.points) &&
      ['visits','lists','materials','incidents'].every(key => Array.isArray(data[key])) &&
      data.visits.every(row => Array.isArray(row.allowedAccessPointIds) && Array.isArray(row.people) && Array.isArray(row.hosts))
  });
}

export function visitScope(data,route) {
  const guard = isGuardPage(route.page);
  const shift = data.shift;
  const point = guard ? (route.profile==='other-point'?'P02':shift.point) : null;
  const onDuty = shift.onDuty && route.profile!=='off-duty';
  const denied = route.profile==='denied' || (guard && (!onDuty || point!==shift.point));
  const atPoint = row => row.point === point;
  const visits = denied ? [] : data.visits.filter(row => guard ? row.allowedAccessPointIds.includes(point) : departmentScope.includes(row.dept));
  const listEditDepartments = denied || route.page!=='visit-lists' ? [] :
    departmentScope.filter(dept=>data.listMaintenance?.departments?.includes(dept));
  return {
    listEditDepartments,
    denied, point, pointName:data.points[point], shift, visits,
    lists:denied || guard ? [] : data.lists.filter(row => departmentScope.includes(row.dept)),
    materials:denied || !guard ? [] : data.materials.filter(atPoint),
    incidents:denied || !guard ? [] : data.incidents.filter(atPoint),
    points: data.points
  };
}

export function visitEvents(row,point) {
  const unique = new Map();
  for (const event of row.events || []) {
    if ((!point || event.point === point) && !unique.has(event.id)) unique.set(event.id,event);
  }
  return [...unique.values()];
}

export function personFact(row,person,point) {
  const passes = visitEvents(row,point).filter(event => event.person === person && event.source === 'DEVICE_PASS_EVENT')
    .sort((a,b) => a.time.localeCompare(b.time));
  return {
    enter:passes.find(event => event.direction === '入厂')?.time,
    exit:passes.find(event => event.direction === '离厂')?.time
  };
}

export function approvedForShift(row,scope) {
  return row.approval === '已通过' && row.qualification === '有效' &&
    row.date === scope.shift.date && row.start <= scope.shift.asOf && scope.shift.asOf < row.end &&
    row.people.some(person => !personFact(row,person.name,scope.point).enter);
}
