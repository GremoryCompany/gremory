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
test('Slots stops animation and releases button when bridge rejects before debit',async()=>{
 let cleared=false,calls=0;const data=new Map(),node=id=>{if(!data.has(id))data.set(id,{value:'50',disabled:false,textContent:'',classList:{add(){},remove(){}}});return data.get(id)};
 const storage=new Map();const ctx={state:{user:{uid:'a'},charlotteSync:{account:{balance:1000}}},$:node,slotBusy:false,linkedCharlotte:()=>true,toast(){},accountSnapshot:()=>({balance:1000}),formatNumber:String,playGameSfx(){},startSlotSpinSound:()=>()=>{},setInterval:()=>1,clearInterval:()=>{cleared=true},setTimeout,clearTimeout,Date,crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},bridgeRequest:async()=>{calls++;throw Error('offline')},querySlotStatus:async()=>({status:'none'}),SLOT_SYMBOLS:['7'],console};
 vm.createContext(ctx);vm.runInContext(between('async function runSlotsSpin()','// Delegação'),ctx);
 await ctx.runSlotsSpin();assert.equal(cleared,true);assert.equal(node('slotsSpinBtn').disabled,false);assert.equal(calls,1);assert.equal(storage.size,0);
});
test('Firebase rules protect private balances and admin paths',()=>{
 const rules=JSON.parse(fs.readFileSync(root+'firebase.rules.production.json','utf8')).rules;
 assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);
 assert.equal(rules.siteProgress.$uid['.write'],false);
 assert.equal(rules.siteWalletOps.$uid['.write'],false);
 assert.equal(rules.siteWallets.$uid['.write'],false);
 for(const k of ['siteSlotsPending','siteSlotsSettlements']){
  const row=rules[k].$uid,canRead=new Function('auth','$uid','return '+row['.read']);
  assert.equal(canRead({uid:'a'},'a'),true);assert.equal(canRead({uid:'a'},'b'),false);assert.equal(row['.write'],false);
 }
 for(const k of ['siteBans','profiles','siteReports','supportChats']){
  assert.match(JSON.stringify(rules[k]),/email_verified/,k);
 }
 assert.match(rules.communityPosts.$post['.write'],/expiresAt/);
});
