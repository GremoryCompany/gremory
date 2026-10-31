const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'..'),app=fs.readFileSync(repo+'/assets/js/app.js','utf8');
const policy=JSON.parse(fs.readFileSync(repo+'/vercel.json')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
const directives=Object.fromEntries(policy.split(';').map(s=>s.trim().split(/\s+/)).filter(s=>s[0]).map(([key,...sources])=>[key,sources]));
function allows(directive,url){const target=new URL(url);return directives[directive].some(source=>{if(source==="'self'")return target.origin==='https://gremory2.vercel.app';if(!source.includes('://'))return false;const trusted=new URL(source.replace('*','wildcard'));return trusted.protocol===target.protocol&&(source.includes('*.')?target.hostname.endsWith('.'+trusted.hostname.replace('wildcard.','')):target.hostname===trusted.hostname);});}
test('CSP permits Firebase WebSocket and HTTP long-poll scripts/frames, including redirected shard hosts',()=>{
 for(const host of ['gremory-e4313-default-rtdb.firebaseio.com','s-usc1c-nss-fixture.firebaseio.com']){
  assert.equal(allows('connect-src',`wss://${host}/.ws?v=5`),true);assert.equal(allows('connect-src',`https://${host}/.lp?start=t`),true);assert.equal(allows('script-src',`https://${host}/.lp?start=t`),true);assert.equal(allows('frame-src',`https://${host}/.lp?dframe=t`),true);
 }
 assert.equal(allows('frame-src','https://gremory2.vercel.app/'),true);assert.equal(allows('script-src','https://firebaseio.com.evil.example/inject.js'),false);assert.equal(directives['script-src'].includes("'unsafe-inline'"),false);assert.equal(directives['script-src'].includes("'unsafe-eval'"),false);
});
function fixture(set){const nodes=new Map(),getNode=id=>{if(!nodes.has(id))nodes.set(id,{textContent:id==='createLinkCodeBtn'?'Gerar código':'',hidden:true,disabled:false,addEventListener(){},classList:{remove(){},toggle(){}}});return nodes.get(id)},state={user:{uid:'alice'}},toasts=[];
 const context={state,$:getNode,randomCode:()=>String(Math.random()),nowIso:()=>'',Date,db:{},ref:(_db,p)=>p,set,withTimeout:(promise,ms,code)=>{assert.equal(ms,10000);assert.equal(code,'DB_TIMEOUT');return promise},toast:message=>toasts.push(message),profileDataError:error=>error.message};
 const source=app.slice(app.indexOf('let charlotteLinkPending=null;'),app.indexOf("$('openCharlotteLinkBtn').addEventListener"))+'\n({createCharlotteLinkCode})';return{...vm.runInNewContext(source,context),nodes,state,toasts,getNode};}
test('Charlotte linking blocks double taps and never shows an unacknowledged code',async()=>{
 let complete;const writes=[],x=fixture((p,v)=>{writes.push({p,v});return new Promise(resolve=>complete=resolve)}),first=x.createCharlotteLinkCode();
 assert.equal(x.getNode('createLinkCodeBtn').disabled,true);await x.createCharlotteLinkCode();assert.equal(writes.length,1);assert.equal(x.getNode('linkCodeBox').hidden,true);complete();await first;assert.equal(x.getNode('linkCodeValue').textContent,writes[0].v.code);assert.equal(x.getNode('createLinkCodeBtn').disabled,false);
});
test('timed-out Charlotte request reuses its code and stale account completion cannot reveal it',async()=>{
 let count=0,release;const writes=[],x=fixture((p,v)=>{writes.push(v);return ++count===1?Promise.reject(Error('DB_TIMEOUT')):new Promise(resolve=>release=resolve)});
 await x.createCharlotteLinkCode();assert.equal(x.getNode('createLinkCodeBtn').disabled,false);assert.equal(x.getNode('linkCodeBox').hidden,true);
 const retry=x.createCharlotteLinkCode();assert.equal(writes[0].code,writes[1].code);x.state.user={uid:'bob'};release();await retry;assert.equal(x.getNode('linkCodeBox').hidden,true);
});
test('Charlotte status distinguishes pending reads and denied reads from a confirmed missing link',()=>{
 const nodes=new Map(),getNode=id=>{if(!nodes.has(id))nodes.set(id,{classList:{remove(){},toggle(){}}});return nodes.get(id)},state={charlottePublicState:'loading'},context={state,$:getNode,loadPendingLinkCode(){}};
 vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function renderCharlotteStatus(){'),app.indexOf('async function loadPendingLinkCode()')),context);
 context.renderCharlotteStatus();assert.equal(getNode('homeCharlotteText').textContent,'Verificando vínculo…');state.charlottePublicState='error';state.charlottePublicError='Permissão negada';context.renderCharlotteStatus();assert.equal(getNode('linkStatusText').textContent,'Permissão negada');state.charlottePublicState='ready';context.renderCharlotteStatus();assert.equal(getNode('homeCharlotteText').textContent,'Não vinculada');
});
