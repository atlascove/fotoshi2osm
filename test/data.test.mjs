import test from 'node:test';import assert from 'node:assert/strict';
import {adaptPlace,osmRef} from '../src/reviewer/data.js';
test('normalizes OSM types without guessing arbitrary IDs',()=>{assert.equal(osmRef('n','123'),'node/123');assert.equal(osmRef('way','7'),'way/7');assert.equal(osmRef('relation','9'),'relation/9');assert.equal(osmRef('x','123'),null);assert.equal(osmRef('n','-1'),null);});
test('UGP origin remains distinct from GERS presence',()=>{const p=adaptPlace({fid:'place',loc:[8,47],created_source:'user',overture_id:'gers',images:[{oid:'photo',username:'mapper'}]});assert.equal(p.origin,'user');assert.equal(p.gers,'gers');assert.equal(p.photos[0].author,'@mapper');});
test('unknown photo bearing stays unknown and camera GPS is retained',()=>{const p=adaptPlace({fid:'place',geom:{x:8,y:47},images:[{oid:'photo',photo_longitude:8.1,photo_latitude:47.1}]});assert.equal(p.photos[0].direction,undefined);assert.deepEqual(p.photos[0].coordinates,[8.1,47.1]);});
test('invalid coordinates are rejected',()=>assert.equal(adaptPlace({fid:'place',loc:[NaN,47]}),null));
