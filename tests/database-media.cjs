const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePromise=(async()=>{const source=fs.readFileSync(path.join(__dirname,'../assets/js/database-media.js'),'utf8').replace("import { deadline } from './upload-flow.js';","const deadline=promise=>Promise.resolve(promise);");return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))})();
test('compressed images stay outside feed metadata, with strict references and limits',async()=>{
 const m=await modulePromise,writes=[],jpeg='data:image/jpeg;base64,/9j/AAAA';
 const result=await m.saveDatabaseImage({}, {kind:'community',uid:'alice',id:'post',encode:async()=>jpeg,write:async(p,v)=>writes.push([p,v])});
 assert.equal(writes[0][0],'siteMedia/community/alice/post');assert.equal(writes[0][1].data,jpeg);assert.equal(m.mediaPath(result.reference),'community/alice/post');
 assert.equal(m.mediaPath(m.IMAGE_PREFIX+'../profiles/alice'),'');assert.equal(m.mediaPath('https://example.com'),'');
 await assert.rejects(m.saveDatabaseImage({}, {kind:'avatars',uid:'alice',id:'photo',encode:async()=>jpeg+'A'.repeat(m.AVATAR_LIMIT),write:async()=>assert.fail('oversize write')}));
 const controller=new AbortController();controller.abort();await assert.rejects(m.saveDatabaseImage({}, {kind:'community',uid:'alice',id:'post',signal:controller.signal,write:async()=>assert.fail('cancelled write')}),{code:'storage/canceled'});
});
test('media permissions reject overwrites, other owners and expired stories',()=>{
 const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.rules.production.json'))).rules.siteMedia.$kind.$uid.$mediaId;
 class Snap{constructor(v){this.v=v}child(k){return new Snap(this.v?.[k])}val(){return this.v??null}exists(){return this.v!=null}hasChildren(keys){return keys.every(k=>this.v?.[k]!=null)}isNumber(){return typeof this.v==='number'}isString(){return typeof this.v==='string'}}
 const now=Date.now(),auth={uid:'alice',token:{}},record={uid:'alice',data:'data:image/jpeg;base64,/9j/AAAA',createdAt:now};
 const run=(expression,{user=auth,old=null,next=record,kind='community',uid='alice'}={})=>new Function('auth','data','newData','root','$kind','$uid','now',`return !!(${expression.replaceAll('.matches(','.match(')})`)(user,new Snap(old),new Snap(next),new Snap({}),kind,uid,now);
 assert.equal(run(r['.write']),true);assert.equal(run(r['.write'],{uid:'bob'}),false);assert.equal(run(r['.write'],{old:record}),false);assert.equal(run(r['.validate']),true);
 assert.equal(run(r['.validate'],{next:{...record,data:'data:image/svg+xml;base64,AAAA'}}),false);
 assert.equal(run(r['.validate'],{kind:'avatars',next:{...record,data:record.data+'A'.repeat(24576)}}),false);
 assert.equal(run(r['.read'],{kind:'stories',old:{...record,expiresAt:now-1}}),false);
 assert.equal(run(r['.read'],{kind:'stories',old:{...record,expiresAt:now+1000}}),true);
});
