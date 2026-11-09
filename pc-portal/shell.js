import {isApproval} from './m02-model.js?v=review-fix';
import {escapeHtml as e} from './components.js';
import {icon} from './icons.js';
import {objectPages} from './m01-model.js';
import {pageGroup} from './pc-navigation.js?v=m02-review-fix';
export function routeUrl(route) {
  const params=new URLSearchParams({page:route.page});
  if(objectPages.includes(route.page)&&route.id) params.set('id',route.id);
  if(pageGroup(route.page)&&route.profile) params.set('profile',route.profile);
  if(isApproval(route.page)) {
    if(route.category&&route.category!=='all') params.set('category',route.category);
    if(route.approvalProfile&&route.approvalProfile!=='combined') params.set('approvalProfile',route.approvalProfile);
  }
  return '?'+params;
}
export const routeKey = route => objectPages.includes(route.page) ? `${route.page}:${route.id}` : route.page;
export function shellMarkup({route, collapsed, openGroup, visited, title, busy, navigation, group, breadcrumb='', actor, pinnedPages=[]}, content) {
  const nav = navigation.map(({glyph,label,target,children=[],collapsedLabel=label}) => {
    const active = group === target;
    if (!target) return `<button class="nav-item" disabled aria-label="${label}，暂未开放" title="${label}暂未开放">${icon(glyph)}<span>${label}</span></button>`;
    // The reference flattens a single-child group; only organization has a real submenu.
    if (!children.length || collapsed) return `<button class="nav-item ${active ? 'active' : ''}" data-route="${target}" aria-label="${e(collapsedLabel)}" title="${e(collapsedLabel)}" data-tooltip="${e(collapsedLabel)}" ${active ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></button>`;
    return `<button class="nav-item ${active ? 'active' : ''}" data-nav-group="${e(target)}" aria-label="${e(label)}" aria-expanded="${openGroup === target}" aria-controls="${e(target)}-submenu" title="${e(label)}">${icon(glyph)}<span>${label}</span><span class="arrow" aria-hidden="true">${openGroup === target ? '⌃' : '⌄'}</span></button><div class="subnav" id="${e(target)}-submenu" ${openGroup === target ? '' : 'hidden'}>${children.map(([key,label,category]) => `<a href="${e(routeUrl({page:key,profile:route.profile,category,approvalProfile:route.approvalProfile}))}" data-route="${key}" ${category?'data-approval-category="'+e(category)+'"':''} ${(route.page === key || route.parentPage === key)&&(!category||route.category===category) ? 'aria-current="page" class="current"' : ''}>${label}</a>`).join('')}</div>`;
  }).join('');
  const tags = visited.map(view => {
    const selected = routeKey(view) === routeKey(route);
    return `<div class="viewtab ${selected ? 'selected' : ''}"><a href="${routeUrl(view)}" data-route="${view.page}" ${view.category?'data-approval-category="'+e(view.category)+'"':''} ${view.id ? `data-id="${e(view.id)}"` : ''} ${selected ? 'aria-current="page"' : ''}>${e(view.title)}</a>${!pinnedPages.includes(view.page) ? `<button data-close-view="${e(routeKey(view))}" aria-label="关闭${e(view.title)}" title="关闭${e(view.title)}">×</button>` : ''}</div>`;
  }).join('');
  return `<div class="shell ${collapsed ? 'collapsed' : ''}"><aside class="sidebar"><div class="brand"><img src="assets/yadon-logo-white.svg" alt="YADON Powered by ANDRITZ Schuler"><div class="platform">工业园区综合管理平台</div></div><nav class="nav" aria-label="业务导航">${nav}</nav></aside><section class="main"><header class="topbar"><button class="icon-btn" id="collapse" aria-label="${collapsed ? '展开导航' : '折叠导航'}" aria-expanded="${!collapsed}" title="${collapsed ? '展开导航' : '折叠导航'}">${icon('menu')}</button><nav class="breadcrumb" aria-label="面包屑">${breadcrumb ? e(breadcrumb)+' <span class="crumb-separator" aria-hidden="true">/</span> ' : ''}<b>${e(title)}</b></nav><div class="top-right"><div class="user"><span class="avatar" aria-hidden="true">${e(actor?.name?.slice(0,1)||'—')}</span><div>${e(actor?.name||'—')}<small>${e(actor?.label||'')}</small></div></div></div></header><nav class="tabs" aria-label="访问页签"><div class="visited-list">${tags}</div><button class="icon-btn" id="refresh" aria-label="刷新当前页面" title="刷新当前页面" ${busy ? 'disabled' : ''}>${icon('refresh')}</button></nav><main class="content" id="main-content" aria-busy="${busy}">${content}</main></section></div>`;
}
