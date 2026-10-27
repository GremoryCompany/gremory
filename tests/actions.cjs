const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=require('node:path').resolve(__dirname,'..')+'/',app=fs.readFileSync(root+'assets/js/app.js','utf8');
const between=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
test('Room creation opens the room even when its discovery index is denied',async()=>{
 const opened=[],messages=[],button={disabled:false},nodes={watchCreateForm:{querySelector:()=>button,reset(){}},watchNameInput:{value:'Sala'},watchPrivacyInput:{value:'public'}};
 const ctx={state:{user:{uid:'a'}},$:id=>nodes[id],prewarmWatchMicrophone:async()=>{},uniqueWatchCode:async()=> 'ABCDEF',nowIso:()=> 'now',displayName:()=> 'Alice',avatarFor:()=>'',ref:(_,p)=>p,db:{},set:async p=>{if(p.startsWith('watchPublicRooms'))throw Error('denied')},closeModal(){},openWatchRoom:async c=>opened.push(c),toast:m=>messages.push(m),permissionMessage:()=> 'denied',console};
 vm.createContext(ctx);vm.runInContext(between('async function createWatchRoom(ev)','async function loadWatchRooms()'),ctx);
 await ctx.createWatchRoom({preventDefault(){}});await new Promise(r=>setImmediate(r));
 assert.deepEqual(opened,['ABCDEF']);assert.equal(button.disabled,false);assert.ok(messages.some(m=>m.includes('listagem')));
});
test('Realtime result listener is ready before the request is written',async()=>{
 let listener,order=[],unsubscribed=0;const ctx={state:{user:{uid:'a'}},linkedCharlotte:()=>true,db:{},ref:(_,p)=>p,push:()=>({key:'job'}),onValue:(_,fn)=>{order.push('listen');listener=fn;return()=>unsubscribed++},set:async()=>{order.push('write');listener({exists:()=>true,val:()=>({ok:true,answer:42})})},nowIso:()=>'',setTimeout,clearTimeout,permissionMessage:()=>'',console};
 vm.createContext(ctx);vm.runInContext(between('async function bridgeRequest(','async function requestAccountSync'),ctx);
 const result=await ctx.bridgeRequest('sync_account');assert.deepEqual(order,['listen','write']);assert.equal(result.answer,42);assert.equal(unsubscribed,1);
});
test('Request deadline includes writes which never finish',async()=>{
 const ctx={state:{user:{uid:'a'}},linkedCharlotte:()=>true,db:{},ref:(_,p)=>p,push:()=>({key:'job'}),onValue:()=>()=>{},set:()=>new Promise(()=>{}),nowIso:()=>'',setTimeout,clearTimeout,permissionMessage:()=>'',console};vm.createContext(ctx);vm.runInContext(between('async function bridgeRequest(','async function requestAccountSync'),ctx);
 await assert.rejects(ctx.bridgeRequest('sync_account',{},10),/ainda não confirmou/);
});
test('Slots stops animation even while the hosting endpoint has no response',async()=>{
 let rejectFetch,intervalCleared=false,bridgeCalls=0,visualTimer;const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'50',disabled:false,classList:{add(){},remove(){}}});return nodes.get(id)};
 const ctx={state:{user:{getIdToken:async()=> 'token'},charlotteSync:{account:{}}},$:node,slotBusy:false,linkedCharlotte:()=>true,toast(){},accountSnapshot:()=>({balance:1000}),formatNumber:String,playGameSfx(){},startSlotSpinSound:()=>()=>{},setInterval:()=>1,clearInterval:()=>intervalCleared=true,setTimeout:(fn,ms)=>{if(ms===4000)visualTimer=fn;return 2},clearTimeout(){},withTimeout:p=>p,AbortSignal,fetch:()=>new Promise((_,rej)=>rejectFetch=rej),bridgeRequest:()=>{bridgeCalls++;throw Error('unexpected')},SLOT_SYMBOLS:['7'],console};
 vm.createContext(ctx);vm.runInContext(between('async function runSlotsSpin()','// Delegação'),ctx);
 const running=ctx.runSlotsSpin();await new Promise(r=>setImmediate(r));visualTimer();assert.equal(intervalCleared,true);assert.equal(node('slotsStatus').textContent,'Confirmando aposta...');rejectFetch(Error('Sem resposta'));await running;assert.equal(ctx.slotBusy,false);assert.equal(node('slotsSpinBtn').disabled,false);assert.equal(bridgeCalls,0);
});
test('Current Firebase rules are preserved; slots receipts are owner-only and never writable',()=>{
 const old=JSON.parse(fs.readFileSync(__dirname+'/fixtures/firebase-rules-before.json','utf8')).rules,rules=JSON.parse(fs.readFileSync(root+'firebase.rules.production.json','utf8')).rules;
 for(const k of Object.keys(old)){if(['watchRooms','watchVoice','watchUserRooms','siteNotifications'].includes(k))continue;assert.deepEqual(rules[k],old[k],k)}
 assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);
 for(const k of ['siteSlotsPending','siteSlotsSettlements']){const row=rules[k].$uid,canRead=new Function('auth','$uid','return '+row['.read']);assert.equal(canRead({uid:'a'},'a'),true);assert.equal(canRead({uid:'a'},'b'),false);assert.equal(row['.write'],false)}
});
