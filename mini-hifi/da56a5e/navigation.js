// Presentation navigation only. No shared business store or persistence.
const pageActions=new Set(['account','vouchers','messages','myRequests','attendance',
 'tasks','approval','guard','guardList','relatedVisits','relatedDetail','leave',
 'leaveForm','annualForm','trip','door','overtime','profile','security','companions',
 'companionDetail','face','visitorNotice','freightNotice','ordinary','freight']);
export function isPageAction(action){return pageActions.has(action)||/^(approval-\d+|voucher-\d+|request-\d+|message-\d+|guardVisitor-\d+|bookingDetail-[\w-]+|relatedDetail-[\w-]+|readNotice-[01])$/.test(action);}
// Presentation-only parent-route allowlist. Does not authorize business operations.
const pageOwners={
 home:['messages','attendance','leave','leaveForm','annualForm','myRequests','tasks','approval','guard','guardList'],
 work:['myRequests','attendance','tasks','approval','guard','guardList','relatedVisits','relatedDetail','leave','leaveForm','annualForm','trip','door','overtime'],
 canteen:['account','vouchers'],
 me:['profile','security','face'],
 booking:['messages','ordinary','freight','visitorNotice','freightNotice'],
 requests:[],
 externalMe:['profile','companions','companionDetail']
};
export function isAllowedPageAction(key,action){
 if(!isPageAction(action))return false;
 if(pageOwners[key]?.includes(action))return true;
 if(/^approval-\d+$/.test(action))return key==='home'||key==='work';
 if(/^message-\d+$/.test(action))return key==='home'||key==='booking';
 if(/^request-\d+$/.test(action))return key==='work'||key==='home';
 if(/^guardVisitor-\d+$/.test(action))return key==='work'||key==='home';
 if(/^voucher-\d+$/.test(action))return key==='canteen';
 if(/^relatedDetail-[\w-]+$/.test(action))return key==='work';
 if(/^bookingDetail-[\w-]+$/.test(action))return key==='requests';
 if(/^readNotice-[01]$/.test(action))return key==='booking';
 return false;
}
// Every surface has an explicit semantic class; not a two-page CSS exception.
export function pageKind(action,key){
 if(!action)return {work:'directory',booking:'directory',requests:'record-list',home:'overview',canteen:'overview',me:'account-menu',externalMe:'account-menu'}[key]||'content';
 if(['leave','security','guard'].includes(action))return 'selection';
 if(['messages','tasks','myRequests','relatedVisits','guardList','vouchers','companions'].includes(action))return 'record-list';
 if(action==='account')return 'ledger-list';
 if(['leaveForm','annualForm','door','trip','overtime','ordinary','freight'].includes(action))return 'form';
 if(['visitorNotice','freightNotice'].includes(action)||action.startsWith('readNotice-'))return 'reading';
 return 'detail';
}
export function parentAction(action){
 if(action.startsWith('relatedDetail-'))return 'relatedVisits';
 if(action.startsWith('approval-'))return 'tasks';
 if(action.startsWith('voucher-'))return 'vouchers';
 if(action.startsWith('request-'))return 'myRequests';
 if(action.startsWith('message-'))return 'messages';
 if(action.startsWith('guardVisitor-'))return 'guardList';
 return {companionDetail:'companions',approval:'tasks',guardList:'guard',relatedDetail:'relatedVisits',leaveForm:'leave',annualForm:'leave'}[action]||'';
}
export function captureView(element){
 const copy=element.cloneNode(true);
 const fields=element.querySelectorAll('input,textarea,select');
 copy.querySelectorAll('input,textarea,select').forEach((field,i)=>{
  const original=fields[i];
  if(field.tagName==='TEXTAREA')field.textContent=original.value;
  else if(field.tagName==='SELECT')Array.from(field.options).forEach((option,j)=>option.toggleAttribute('selected',original.options[j].selected));
  else{field.setAttribute('value',original.value);field.toggleAttribute('checked',original.checked);}
 });
 return copy.innerHTML;
}
