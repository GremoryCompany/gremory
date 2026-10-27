'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const walletPath=require.resolve('../api/site-wallet.js');
class SiteError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code}}
let fakeAuth;
require.cache[walletPath]={id:walletPath,filename:walletPath,loaded:true,exports:{SiteError,authenticate:(...a)=>fakeAuth(...a),publicError:e=>({status:e.status||503,code:e.code||'SERVER',erro:e.message})}};
const progress=require('../api/site-progress.js');
function fakeDb(seed={}){
 const store=structuredClone(seed),parts=p=>p.split('/').filter(Boolean);
 const get=p=>parts(p).reduce((v,k)=>v?.[k],store);
 const put=(p,v)=>{const keys=parts(p),end=keys.pop();let root=store;for(const k of keys)root=root[k]??={};if(v==null)delete root[end];else root[end]=v};
 return{store,ref:p=>({once:async()=>({val:()=>get(p)||null}),transaction:async fn=>{const v=fn(get(p));if(v===undefined)return{committed:false};put(p,v);return{committed:true}}})};
}
function res(){return {statusCode:0,setHeader(){},end(txt){this.body=JSON.parse(txt)}}}
function request(db,body,uid='a'){fakeAuth=async()=>({db,uid,body});const response=res();return progress.handleProgress({method:'POST'},response,{readJsonBody:async()=>body,sendJson:(r,status,obj)=>{r.statusCode=status;r.body=obj;return obj}}).then(()=>response)}
test('progress level and daily 24h energy renewal',()=>{
 assert.equal(progress.level(0),1);assert.equal(progress.level(100),2);assert.equal(progress.level(400),3);
 const row=progress.makeBase(),a=progress.energyState(row,'fish',1_000_000,false);assert.equal(a.remaining,6);
 row.energy.fish={startedAt:1_000_000,used:6};assert.equal(progress.energyState(row,'fish',1_000_200,false).remaining,0);
 assert.equal(progress.energyState(row,'fish',1_000_000+86400000,false).remaining,6);
 assert.equal(progress.energyState(row,'fish',1_000_000+86400000,true).remaining,8);
});
test('site fishing/mining server-only energy and no wallet mutations',async()=>{
 const db=fakeDb();const a=await request(db,{action:'fish'});assert.equal(a.body.ok,true);
 assert.equal(db.store.siteProgress.a.inventory.fish[a.body.loot.label],1);
 const b=await request(db,{action:'mine'});assert.equal(b.body.ok,true);
 assert.equal(db.store.siteProgress.a.inventory.ore[b.body.loot.label],1);
 for(let i=0;i<5;i++)assert.equal((await request(db,{action:'fish'})).body.ok,true);
 const last=await request(db,{action:'fish'});assert.equal(last.statusCode,409);
 assert.equal(db.store.siteWallets,undefined);assert.equal(db.store.charlotteSync,undefined);
});
test('social XP requires existing owned post and cannot repeat same receipt',async()=>{
 const now=Date.now(),db=fakeDb({communityPosts:{post_abc123:{uid:'a',createdAt:now}}});
 const good=await request(db,{action:'post',itemId:'post_abc123'});assert.equal(good.body.xp,20);
 const duplicate=await request(db,{action:'post',itemId:'post_abc123'});assert.equal(duplicate.statusCode,409);
 const forged=await request(db,{action:'post',itemId:'post_missing'});assert.equal(forged.statusCode,403);
 const other=await request(db,{action:'post',itemId:'post_abc123'},'b');assert.equal(other.statusCode,403);
});
test('premium account doubles site XP and suspended accounts are blocked',async()=>{
 const db=fakeDb({charlotteSync:{a:{account:{premium:true}}}});
 const xp=await request(db,{action:'horse'});assert.equal(xp.body.xp,16);
 db.store.siteBans={a:{active:true,expiresAt:Date.now()+100000}};
 const blocked=await request(db,{action:'mine'});assert.equal(blocked.statusCode,403);
 db.store.siteBans.a.expiresAt=Date.now()-100;
 const unblocked=await request(db,{action:'mine'});assert.equal(unblocked.body.xp,24);
});
