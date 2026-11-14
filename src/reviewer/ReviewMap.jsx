import React,{useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import osmtogeojson from 'osmtogeojson';
import 'maplibre-gl/dist/maplibre-gl.css';
maplibregl.setWorkerUrl(new URL('./maplibre-worker.mjs',location.href).href);
const styles={satellite:'https://tiles.fotoshi.com/styles/mobile-satellite.json',vector:'https://tiles.fotoshi.com/styles/mobile-vector.json'};
export default function ReviewMap({place,photoIndex,onPhoto}) {
  const container=useRef(), map=useRef(), markers=useRef([]), geometry=useRef(null);
  const [basemap,setBasemap]=useState('satellite'), [error,setError]=useState('');
  const callbacks=useRef({onPhoto});callbacks.current={onPhoto};
  useEffect(()=>{
    const m=new maplibregl.Map({container:container.current,style:{version:8,sources:{},layers:[]},center:place.loc,zoom:18,maxZoom:22,attributionControl:false});
    map.current=m;m.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
    m.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{resize.disconnect();markers.current.forEach(x=>x.remove());m.remove();map.current=null;};
  },[]);
  function drawGeometry() {
    const m=map.current;if(!m || !m.isStyleLoaded() || !geometry.current)return;
    if(m.getSource('review-object'))m.getSource('review-object').setData(geometry.current);
    else {
      m.addSource('review-object',{type:'geojson',data:geometry.current});
      m.addLayer({id:'review-area',type:'fill',source:'review-object',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#f24e1e','fill-opacity':.12}});
      m.addLayer({id:'review-outline',type:'line',source:'review-object',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#ff6e00','line-width':4}});
      m.addLayer({id:'review-point',type:'circle',source:'review-object',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#feca57','circle-radius':8,'circle-stroke-width':2,'circle-stroke-color':'#f24e1e'}});
    }
  }
  useEffect(()=>{
    const abort=new AbortController();setError('');
    fetch(styles[basemap],{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(style=>{
      // Coverage is the reviewer's own layer; retain the canonical basemap.
      style.layers=style.layers.filter(l=>!l.source?.startsWith('coverage'));
      for(const source of Object.keys(style.sources))if(source.startsWith('coverage'))delete style.sources[source];
      map.current?.setStyle(style);map.current?.once('style.load',drawGeometry);
    }).catch(e=>{if(e.name!=='AbortError')setError('Basemap unavailable.');});
    return()=>abort.abort();
  },[basemap]);
  useEffect(()=>{
    const m=map.current,abort=new AbortController();
    geometry.current={type:'Feature',geometry:{type:'Point',coordinates:place.loc},properties:{}};
    drawGeometry();m?.easeTo({center:place.loc,zoom:18,duration:250});
    markers.current.forEach(x=>x.remove());
    markers.current=place.photos.map((photo,i)=>{
      const el=document.createElement('button');el.type='button';el.className='camera-location'+(i===photoIndex?' selected':'');el.title=`Photo ${i+1}`;el.setAttribute('aria-label',`Show photo ${i+1}`);el.textContent=String(i+1);el.onclick=()=>callbacks.current.onPhoto(i);
      return new maplibregl.Marker({element:el}).setLngLat(photo.coordinates).addTo(m);
    });
    if(place.ref) fetch(`https://api.openstreetmap.org/api/0.6/${place.ref}${place.ref.startsWith('node/')?'':'/full'}.json`,{signal:abort.signal}).then(r=>r.ok?r.json():null).then(data=>{
      if(!data || abort.signal.aborted)return;
      const collection=osmtogeojson(data);const [type,id]=place.ref.split('/');
      const feature=collection.features.find(f=>f.id===`${type}/${id}`);
      if(feature){geometry.current=feature;drawGeometry();}
    }).catch(()=>{});
    return()=>abort.abort();
  },[place.fid,place.ref]);
  useEffect(()=>{markers.current.forEach((marker,i)=>marker.getElement().classList.toggle('selected',i===photoIndex));},[photoIndex]);
  return <div className="map-panel"><div className="map-canvas" ref={container}/><div className="map-switch" aria-label="Basemap">{Object.keys(styles).map(id=><button key={id} className={basemap===id?'active':''} aria-pressed={basemap===id} onClick={()=>setBasemap(id)}>{id==='satellite'?'Satellite':'Map'}</button>)}</div>{error&&<span className="map-error">{error}</span>}</div>;
}
