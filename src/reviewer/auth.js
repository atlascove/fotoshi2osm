// Reuse the registered Fotoshi iD public client and its unchanged callback.
// Session-only reviewer tokens never overwrite iD's localStorage keys.
const CLIENT_ID='ip4PKNR8gERMk1ymjQzqFTiq_nOKduKcgWJhrknw_os';
const TOKEN_KEY='fotoshi2osm.osm-token';
export function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
export function logout() { sessionStorage.removeItem(TOKEN_KEY); }
export async function getUser(token=getToken()) {
  if(!token) return null;
  const r=await fetch('https://api.openstreetmap.org/api/0.6/user/details.json',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!r.ok) { logout(); throw Error('OSM session expired. Sign in again.'); }
  return (await r.json()).user;
}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function login() {
  if(location.origin!=='https://osm.fotoshi.com') throw Error('OSM sign-in is available on osm.fotoshi.com.');
  const popup=window.open('about:blank','fotoshi2osm-osm-login','width=640,height=720');
  if(!popup) throw Error('Allow the OSM sign-in popup, then try again.');
  const redirect=location.origin+'/land.html';
  const verifier=b64(crypto.getRandomValues(new Uint8Array(48)));
  const state=b64(crypto.getRandomValues(new Uint8Array(24)));
  const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const params=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'read_prefs write_api',state,code_challenge:challenge,code_challenge_method:'S256'});
  return new Promise((resolve,reject)=>{
    const channel=new BroadcastChannel('osm-api-auth-complete');
    const finish=(error,user)=>{clearInterval(poll);clearTimeout(timeout);channel.close();popup.close();error?reject(error):resolve(user);};
    let completing=false;
    const poll=setInterval(()=>{if(popup.closed && !completing)finish(Error('OSM sign-in was cancelled.'));},500);
    const timeout=setTimeout(()=>finish(Error('OSM sign-in timed out.')),180000);
    channel.onmessage=async event=>{
      let url;try{url=new URL(event.data);}catch{return;}
      if(url.origin!==location.origin || url.pathname!=='/land.html' || url.searchParams.get('state')!==state)return;
      completing=true;
      if(url.searchParams.has('error') || !url.searchParams.get('code'))return finish(Error('OSM authorization was declined.'));
      try {
        const r=await fetch('https://www.openstreetmap.org/oauth2/token',{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',client_id:CLIENT_ID,redirect_uri:redirect,code_verifier:verifier,code:url.searchParams.get('code')})});
        if(!r.ok)throw Error('OSM sign-in failed. Please retry.');
        const data=await r.json();if(typeof data.access_token!=='string' || !data.access_token)throw Error('OSM returned no access token.');
        sessionStorage.setItem(TOKEN_KEY,data.access_token);
        finish(null,await getUser(data.access_token));
      }catch(error){finish(error);}
    };
    popup.location.href='https://www.openstreetmap.org/oauth2/authorize?'+params;
  });
}
