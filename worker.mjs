// Dedicated path only: the existing iD editor and OAuth callback stay untouched.
const ROOT='/fotoshi2osm';
export default { async fetch(request) {
  const u=new URL(request.url);
  if(u.pathname===ROOT)return Response.redirect(u.origin+ROOT+'/'+u.search,302);
  if(!u.pathname.startsWith(ROOT+'/'))return new Response('Not found',{status:404});
  if(request.method!=='GET' && request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const path=u.pathname.slice(ROOT.length);
  if(path==='/api/places'){
    const bbox=(u.searchParams.get('bbox') || '').split(',').map(Number);
    if(bbox.length!==4 || !bbox.every(Number.isFinite) || bbox[0]<-180 || bbox[2]>180 || bbox[1]<-90 || bbox[3]>90 || bbox[0]>=bbox[2] || bbox[1]>=bbox[3] || bbox[2]-bbox[0]>.1 || bbox[3]-bbox[1]>.1)return Response.json({error:'Invalid review area'},{status:400});
    try {
      const upstream=await fetch('https://api.fotoshi.com/v1/places?'+new URLSearchParams({bbox:bbox.join(','),limit:'36'}),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
      return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
    }catch{return Response.json({error:'Photo service unavailable'},{status:502});}
  }
  if(path.startsWith('/api/'))return new Response('Not found',{status:404});
  const target=new URL('https://fotoshi2osm.pages.dev');
  target.pathname=path;
  target.search=u.search;
  const r=await fetch(target,{method:request.method});
  const headers=new Headers(r.headers);headers.set('x-content-type-options','nosniff');
  headers.set('cache-control',path==='/' || path.endsWith('.html')?'no-store':'public, max-age=300');
  return new Response(request.method==='HEAD'?null:r.body,{status:r.status,headers});
}};
