import {escapeHtml as e} from './components.js';

// Structural slots only; page modules select the sections and map business states.
export const detailField = (label,value,extra='') => `<div class="detail-field ${e(extra)}"><span>${e(label)}</span><b>${e(value==null||value===''?'未记录':value)}</b></div>`;
export const detailSection = (title,body,extra='') => `<section class="card detail-block ${e(extra)}"><div class="detail-section-head"><h2>${e(title)}</h2></div>${body}</section>`;
export const detailStack = body => `<div class="detail-stack">${body}</div>`;
export const identitySummary = (identity,facts) => `<section class="card employee-identity"><div class="identity-person">${identity}</div><div class="identity-facts">${facts}</div></section>`;
export const detailPanel = (id,tab,body) => `<div id="${e(id)}-panel" role="tabpanel" aria-labelledby="${e(id)}-tab-${e(tab)}" tabindex="0">${body}</div>`;
export const detailColumns = (variant,main,aside) => `<div class="${e(variant)}">${main}${aside}</div>`;
export const recentHistory = entries => `<ol class="recent-changes">${entries.map(({date,title,note})=>`<li><time>${e(date)}</time><strong>${e(title)}</strong><p>${e(note)}</p></li>`).join('')}</ol>`;
