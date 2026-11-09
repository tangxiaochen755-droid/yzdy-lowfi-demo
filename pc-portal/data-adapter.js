/** Independent fixture reads; consumers own cancellation, state and validation policy. */
export async function loadFixture(url,{signal,validate=()=>true}={}) {
  const response = await fetch(url,{cache:'no-store',signal});
  if(!response.ok)throw new Error('DATA_UNAVAILABLE');
  const data=await response.json();
  if(!validate(data))throw new Error('INVALID_DATA');
  return data;
}
export function loadPageData(signal) {
  return loadFixture(new URL('./fixtures.json', import.meta.url),{
    signal,
    validate:data=>Boolean(data.access)&&Array.isArray(data.employees)&&Array.isArray(data.tasks)
  });
}
