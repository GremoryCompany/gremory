const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/app.js'),'utf8');
const importUpload=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../assets/js/upload-flow.js'),'utf8')).toString('base64'));
const accountCode=source.slice(source.indexOf('function profileLoadStatus('),source.indexOf('\nfunction accountSnapshot('))+'\n({readUserData})';
const snap=v=>({exists:()=>v!=null,val:()=>v});
function profileFixture(read){const writes=[],state={user:{uid:'alice'},profile:null},ctx={state,$:()=>null,get:read,db:{},ref:(_db,p)=>p,withTimeout:p=>p,profileDetails:p=>p||{},normalizeUsername:s=>String(s).toLowerCase(),validUsername:s=>/^[a-z][a-z0-9_]{2,19}$/.test(s),nowIso:()=>'',renderAccount(){},publicProfile:p=>({uid:p.uid,nome:p.nome}),publicCustomizationIds:()=>[],runTransaction:(p,fn)=>{writes.push({path:p,value:fn(null)});return new Promise(()=>{})},set:(p,v)=>{writes.push({path:p,value:v});return new Promise(()=>{})},update:(p,v)=>{writes.push({path:p,value:v});return new Promise(()=>{})}};return{...vm.runInNewContext(accountCode,ctx),writes,state}}
test('saved account renders without awaiting optional directory writes or blocked legacy reads',async()=>{
 const calls=[],x=profileFixture(async p=>{calls.push(p);if(p==='users/alice')return new Promise(()=>{});return snap({uid:'alice',nome:'Alice',username:'alice',email:'a@example.invalid',whatsappSiteNotify:true,raidWhatsappNotify:true})});
 await x.readUserData({uid:'alice',email:'a@example.invalid'});assert.equal(x.state.profile.nome,'Alice');assert.deepEqual(calls,['profiles/alice','users/alice']);assert.equal(x.writes.length,1);
});
test('failed profile read never overwrites a saved account with fallback defaults',async()=>{
 const x=profileFixture(async()=>{throw Object.assign(Error('denied'),{code:'PERMISSION_DENIED'})});await assert.rejects(()=>x.readUserData({uid:'alice'}));assert.equal(x.writes.length,0);assert.equal(x.state.profile,null);
});
test('old account read finishing after switching users cannot replace the new account',async()=>{
 let resolve;const x=profileFixture(()=>new Promise(r=>resolve=r)),pending=x.readUserData({uid:'alice'});x.state.user={uid:'bob'};x.state.profile={uid:'bob',nome:'Bob'};resolve(snap({nome:'Alice'}));await pending;assert.equal(x.state.profile.uid,'bob');assert.equal(x.writes.length,0);
});
test('new account without reserved username omits empty username in the creation payload',async()=>{
 const x=profileFixture(async()=>snap(null));await x.readUserData({uid:'alice',email:'a@example.invalid'});const write=x.writes.find(w=>w.path==='profiles/alice');assert.ok(write);assert.equal('username' in write.value,false);
});
test('stalled uploads cancel instead of remaining at zero forever and unsubscribe callbacks',async()=>{
 const {waitForUpload}=await importUpload();let canceled=0,unsubscribed=0;
 const task={snapshot:{},on(_event,progress){progress({bytesTransferred:0,totalBytes:100});return()=>{unsubscribed++}},cancel(){canceled++}};
 await assert.rejects(()=>waitForUpload(task,{stallMs:15,totalMs:500}),{code:'upload/stalled'});assert.equal(canceled,1);assert.equal(unsubscribed,1);
});
test('upload progress does not finish until Storage acknowledges completion, then timers are cleared',async()=>{
 const {waitForUpload}=await importUpload();let callbacks,unsubscribed=0;const task={snapshot:{ref:'fixture'},on(_event,progress,error,complete){callbacks={progress,error,complete};return()=>{unsubscribed++}},cancel(){throw Error('must not cancel completed upload')}};
 const pending=waitForUpload(task,{stallMs:100,totalMs:500});callbacks.progress({bytesTransferred:100,totalBytes:100});callbacks.complete();assert.equal((await pending).ref,'fixture');assert.equal(unsubscribed,1);
});
test('Storage permission and bucket failures preserve actionable error messages',async()=>{
 const {waitForUpload,uploadMessage}=await importUpload();const error={code:'storage/unauthorized'};await assert.rejects(()=>waitForUpload({on(_e,_p,reject){reject(error);return()=>{}},cancel(){}},{stallMs:50,totalMs:100}),e=>e===error);assert.match(uploadMessage(error),/Storage negou/);assert.match(uploadMessage({code:'storage/bucket-not-found'}),/bucket/);
});
test('website rule regex accepts HTTPS and rejects arbitrary schemes after JSON decoding',()=>{
 const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'../firebase.rules.production.json'),'utf8')).rules;
 for(const key of ['profiles','directory']){const expression=rules[key].$uid.details.website['.validate'].replaceAll('.matches(','.match(');const evaluate=new Function('newData',`return !!(${expression})`);for(const [value,expected]of [['',true],['https://example.org/',true],['https://exa mple.org/',false],['javascript:alert(1)',false]])assert.equal(evaluate({isString:()=>true,val:()=>value}),expected);}
});
test('a late profile read cannot overwrite a profile explicitly saved during the same login',async()=>{
 let resolve;const x=profileFixture(()=>new Promise(r=>resolve=r)),pending=x.readUserData({uid:'alice'});x.state.profileRevision=1;x.state.profile={uid:'alice',nome:'New name',username:'alice'};resolve(snap({nome:'Old name'}));await pending;assert.equal(x.state.profile.nome,'New name');assert.equal(x.writes.length,0);
});
