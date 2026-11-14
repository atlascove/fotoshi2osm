// Direct, single-object OSM edits: retain original geometry and version.
export const OSM_API='https://api.openstreetmap.org';
export function validRef(ref) { return /^(node|way|relation)\/[1-9]\d{0,15}$/.test(ref || ''); }
export function diffTags(tags, edits) {
  return Object.entries(edits).filter(([k,v]) => (tags[k] || '') !== (v || '')).map(([key,value])=>({key,before:tags[key] || '',after:value || ''}));
}
export function validateEdits(tags, edits) {
  const diff=diffTags(tags,edits);
  if(!diff.length) throw Error('No tag changes to save.');
  for(const {key,after} of diff) {
    if(!key.trim() || key.length>255 || after.length>255 || /[\u0000-\u001f]/.test(key+after)) throw Error('Tags must use valid keys and values of at most 255 characters.');
  }
  return diff;
}
export function escapeXml(v) { return String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
export function changesetXml(comment, overture=false) {
  const tags={created_by:'Fotoshi2OSM 0.1',comment:comment.trim(),source:'streetlevel imagery;fotoshi'+(overture?';Overture Maps':''),imagery_used:'Fotoshi'};
  return '<osm><changeset>'+Object.entries(tags).map(([k,v])=>`<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`).join('')+'</changeset></osm>';
}
export function parseElement(xml, ref) {
  if(!validRef(ref)) throw Error('Unsupported OSM object');
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  if(doc.querySelector('parsererror')) throw Error('Invalid OSM response');
  const [type,id]=ref.split('/'), el=doc.querySelector(`osm > ${type}`);
  if(!el || el.getAttribute('id')!==id || el.getAttribute('visible')==='false') throw Error('OSM object is unavailable or deleted.');
  const version=Number(el.getAttribute('version'));
  if(!Number.isSafeInteger(version) || version<1) throw Error('OSM version is missing.');
  return {ref,xml,version,tags:Object.fromEntries([...el.querySelectorAll('tag')].map(t=>[t.getAttribute('k'),t.getAttribute('v')]))};
}
export async function loadElement(ref,signal) {
  if(!validRef(ref)) throw Error('Unsupported OSM object');
  const r=await fetch(`${OSM_API}/api/0.6/${ref}`,{signal,cache:'no-store',headers:{Accept:'application/xml'}});
  if(!r.ok) throw Error(`OSM object unavailable (${r.status}).`);
  return parseElement(await r.text(),ref);
}
export function elementXml(base,edits,changeset) {
  validateEdits(base.tags,edits);
  const parsed=new DOMParser().parseFromString(base.xml,'text/xml');
  const el=parsed.querySelector('osm > '+base.ref.split('/')[0]);
  el.setAttribute('changeset',String(changeset));
  for(const attr of ['user','uid','timestamp']) el.removeAttribute(attr);
  for(const [key,value] of Object.entries(edits)) {
    [...el.querySelectorAll('tag')].filter(t=>t.getAttribute('k')===key).forEach(t=>t.remove());
    if(value) { const t=parsed.createElement('tag');t.setAttribute('k',key);t.setAttribute('v',value);el.appendChild(t); }
  }
  return `<osm version="0.6" generator="Fotoshi2OSM">${new XMLSerializer().serializeToString(el)}</osm>`;
}
async function write(path, token, body) {
  const r=await fetch(OSM_API+'/api/0.6/'+path,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'text/xml'},body});
  if(!r.ok) { const error=Error(r.status===409?'This object changed. Reload before editing again.':`OSM rejected the request (${r.status}).`);error.status=r.status;throw error; }
  return r.text();
}
export async function saveEdit({base,edits,comment,overture,token}) {
  if(!token) throw Error('Sign in with OpenStreetMap first.');
  if(comment.trim().length<3 || comment.length>255) throw Error('Add a changeset comment (3–255 characters).');
  validateEdits(base.tags,edits);
  const live=await loadElement(base.ref);
  if(live.version!==base.version) throw Error('This object changed. Reload before editing again.');
  const id=(await write('changeset/create',token,changesetXml(comment,overture))).trim();
  if(!/^[1-9]\d*$/.test(id)) throw Error('OSM returned an invalid changeset ID.');
  let uploaded=false;
  try {
    const version=await write(base.ref,token,elementXml(live,edits,id));
    if(!/^[1-9]\d*$/.test(version.trim())) throw Error('Unexpected upload response.');
    uploaded=true;
  } catch(error) {
    error.changeset=id;
    if(!error.status) error.message='Upload outcome unknown. Check the changeset before retrying.';
    throw error;
  } finally {
    try { await write(`changeset/${id}/close`,token,''); } catch(error) { if(uploaded) return {id,warning:'Saved. The changeset could not be closed; check it on OSM.'}; }
  }
  return {id};
}
