/** Presentation primitives. No business state or permission policy lives here. */
export const escapeHtml = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Tone is supplied by the caller. A label never determines the result or its color.
const badgeVariants = Object.freeze({success:['success','green'],warning:['warning','amber'],danger:['danger','red'],info:['info',''],neutral:['neutral','grey']});
const badgeAliases = Object.freeze({green:'success',amber:'warning',red:'danger',grey:'neutral','':'info'});
export function statusTag(label, tone = 'info', {size='standard'}={}) {
  const key = Object.hasOwn(badgeAliases,tone) ? badgeAliases[tone] : tone;
  const [semantic,css] = Object.hasOwn(badgeVariants,key) ? badgeVariants[key] : badgeVariants.info;
  return `<span class="badge ${css}${size==='compact'?' badge-compact':''}" data-tone="${semantic}">${escapeHtml(label)}</span>`;
}
export function dataTable(headers, rows, {empty = '没有匹配的记录', caption = '查询结果', reset = false} = {}) {
  return `<div class="table-wrap"><table><caption class="sr-only">${escapeHtml(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="empty">${escapeHtml(empty)}${reset ? '<p><button class="text" data-reset>清除筛选</button></p>' : ''}</td></tr>`}</tbody></table></div>`;
}
export function paginate(rows, page, size) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  return {rows: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, pages, size};
}
export function pagination(model) {
  return `<nav class="pagination" aria-label="表格分页"><span class="count" role="status">共 ${model.total} 条记录</span><label class="page-size"><span class="sr-only">每页条数</span><select data-page-size aria-label="每页条数">${[5,10,20].map(n => `<option value="${n}" ${n === model.size ? 'selected' : ''}>${n} 条 / 页</option>`).join('')}</select></label><button data-page-to="${model.page - 1}" ${model.page === 1 ? 'disabled' : ''} aria-label="上一页">‹</button><button class="current" aria-current="page" aria-label="第${model.page}页">${model.page}</button><button data-page-to="${model.page + 1}" ${model.page === model.pages ? 'disabled' : ''} aria-label="下一页">›</button><span>共 ${model.pages} 页</span><form class="page-jump"><label>前往 <input aria-label="跳转页码" inputmode="numeric" type="number" min="1" max="${model.pages}" value="${model.page}" required> 页</label><button type="submit" class="text">确定</button></form></nav>`;
}
export function tabList(id, tabs, selected, {label='内容分组', eventAttr='data-biz-tab'}={}) {
  return `<div class="biz-tabs" role="tablist" aria-label="${escapeHtml(label)}">${tabs.map(([key,label]) => `<button id="${id}-tab-${key}" role="tab" type="button" aria-controls="${id}-panel" aria-selected="${key === selected}" tabindex="${key === selected ? 0 : -1}" class="${key === selected ? 'active' : ''}" ${eventAttr}="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}
export function stateView(kind, {title, description = '', retry = false, back = false} = {}) {
  return `<section class="card state-view" ${kind === 'loading' ? 'role="status" aria-live="polite"' : 'role="status"'}><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}${retry ? '<button class="primary" data-retry>重新加载</button>' : ''}${back ? `<a class="text" href="${escapeHtml(back.href)}" data-route="${escapeHtml(back.page)}">${escapeHtml(back.label)}</a>` : '' }</section>`;
}
export function unavailableAction(label, explanation, id) {
  return `<span class="unavailable-action" tabindex="0" role="group" aria-label="${escapeHtml(label)}，${escapeHtml(explanation)}" data-tooltip="${escapeHtml(explanation)}"><button id="${id}" disabled aria-describedby="${id}-reason">${escapeHtml(label)}</button><span id="${id}-reason" class="sr-only">${escapeHtml(explanation)}</span></span>`;
}

// Markup slots/attribute fragments are trusted developer HTML; labels are escaped.
export const filterBar = (controls, attrs = '') => `<form class="filters" ${attrs}>${controls}</form>`;
export const formField = (label, control, {variant='edit-field', separator=''}={}) =>
  `<label class="${escapeHtml(variant)}">${escapeHtml(label)}${separator}${control}</label>`;
export const actionButton = (label, {variant='', attrs='', type='button'}={}) =>
  `<button type="${escapeHtml(type)}"${variant?` class="${escapeHtml(variant)}"`:''}${attrs?' '+attrs:''}>${escapeHtml(label)}</button>`;
export const treeItem = (label,{active=false,hidden=false,attrs='',wrapped=false}={}) =>
  `<button class="tree-node ${active?'active':''}" ${attrs} aria-pressed="${active}" ${hidden?'hidden':''}>${wrapped?'<span>'+escapeHtml(label)+'</span>':escapeHtml(label)}</button>`;
export const dialogHead = title => `<div class="modal-head"><h2 id="dialog-title">${escapeHtml(title)}</h2><button type="button" class="icon-btn" data-dialog-close aria-label="关闭">×</button></div>`;
export const dialogBody = html => `<div class="modal-body">${html}</div>`;
export const dialogFoot = html => `<div class="modal-foot">${html}</div>`;
export const formError = () => '<p class="form-error" role="alert"></p>';
export function openDialog(dialog, markup, {drawer=false, onClose}={}) {
  dialog.classList.toggle('permission-drawer', drawer);
  dialog.innerHTML=markup;
  dialog.addEventListener('close', () => {
    dialog.classList.remove('permission-drawer');
    onClose?.();
  },{once:true});
  dialog.showModal();
}
export function tabDestination(event) {
  const tab=event.target.closest('[role="tab"]');
  if(!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return null;
  const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')];
  const index=tabs.indexOf(tab);
  event.preventDefault();
  return tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
}
export function compactPagination(model,{label='表格分页',sizeAttr='data-page-size',pageAttr='data-page-to'}={}) {
  return `<nav class="pagination" aria-label="${escapeHtml(label)}"><span class="count">共 ${model.total} 条记录</span><label><span class="sr-only">每页条数</span><select ${sizeAttr} aria-label="每页条数">${[5,10,20].map(n=>`<option value="${n}" ${n===model.size?'selected':''}>${n} 条 / 页</option>`).join('')}</select></label><button ${pageAttr}="${model.page-1}" ${model.page===1?'disabled':''} aria-label="上一页">‹</button><span aria-current="page">${model.page} / ${model.pages}</span><button ${pageAttr}="${model.page+1}" ${model.page===model.pages?'disabled':''} aria-label="下一页">›</button></nav>`;
}
