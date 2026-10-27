const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),bridge=fs.readFileSync(path.join(root,'database/gremory_site_bridge.js'),'utf8');
const block=(a,b)=>{const x=bridge.indexOf(a),y=bridge.indexOf(b,x);assert.ok(x>=0&&y>x,`${a} / ${b}`);return bridge.slice(x,y)};
test('Raid gravada no Firebase responde sem esperar mensagens de WhatsApp',async()=>{
 let notified=false,active=null;
 const ctx={rtdb:{ref:p=>p==='pokemonSiteRaid/current'?{once:async()=>({val:()=>null}),transaction:async fn=>{active=fn(active);return{committed:true}}}:{once:async()=>({val:()=>0}),update:async()=>{}}},raidBossFromPool:()=>({tier:1,boss:{name:'Boss'},maxHp:100}),id:()=> 'raid-test',notifyRaidStarted:()=>{notified=true;return new Promise(()=>{})},logger:{log(){}},Date};
 vm.createContext(ctx);vm.runInContext(block('  async function startSiteRaid','  async function finishSiteRaidRewards'),ctx);
 const raid=await Promise.race([ctx.startSiteRaid(),new Promise((_,rej)=>setTimeout(()=>rej(Error('Raid waited WhatsApp')),100))]);
 assert.equal(raid.id,'raid-test');assert.equal(notified,true);assert.equal(active.status,'active');
});
test('Admin is identified by Firebase Auth and disabled accounts are rejected',async()=>{
 const ctx={admin:{auth:()=>({getUser:async()=>({email:'losermodder@gmail.com',disabled:false})})},logger:{log(){}}};vm.createContext(ctx);vm.runInContext(block('  async function siteAdmin','  function raidBossFromPool'),ctx);
 assert.equal(await ctx.siteAdmin('owner'),true);ctx.admin.auth=()=>({getUser:async()=>({email:'user@example.test'})});assert.equal(await ctx.siteAdmin('player'),false);
 ctx.admin.auth=()=>({getUser:async()=>({email:'losermodder@gmail.com',disabled:true})});assert.equal(await ctx.siteAdmin('disabled'),false);
});
test('Pending locked jobs are retried rather than silently dropped',async()=>{
 let retry,called=0;const now=Date.now();const ctx={claimSiteBridgeJob:async()=>({claimed:false,data:{__processingAt:now}}),setTimeout:(fn,ms)=>{retry=fn;assert.ok(ms>=1000);return{unref(){}}},processJob:()=>called++,Date,logger:{log(){}}};
 vm.createContext(ctx);vm.runInContext(block('  async function processJobNow','  function processJob('),ctx);
 await ctx.processJobNow('a','j',{});assert.equal(typeof retry,'function');retry();assert.equal(called,1);
});
test('Original backup and restore sections are preserved',()=>{
 const hashes=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/backup-hashes.json'),'utf8'));
 for(const row of hashes)assert.equal(crypto.createHash('sha256').update(block(row.start,row.end)).digest('hex'),row.hash,row.start);
});
function fakeDb(seed){
 const value=structuredClone(seed),parts=p=>p.split('/').filter(Boolean);
 const get=p=>parts(p).reduce((v,k)=>v?.[k],value)??null;
 const set=(p,v)=>{const keys=parts(p),last=keys.pop();let o=value;for(const k of keys)o=o[k]??={};if(v===null)delete o[last];else o[last]=v};
 const snap=v=>({val:()=>v,exists:()=>v!=null});
 return{value,ref:p=>({once:async()=>snap(get(p)),transaction:async fn=>{const v=fn(get(p));if(v===undefined)return{committed:false,snapshot:snap(get(p))};set(p,v);return{committed:true,snapshot:snap(v)}}})};
}
test('Finance ledger is idempotent, atomic and cannot go negative',async()=>{
 const db=fakeDb({siteWallets:{a:{balance:1000,version:0,syncedVersion:0,receipts:{}}}});
 const ctx={rtdb:db,siteWalletState:async()=>db.value.siteWallets.a,Date,Number};
 vm.createContext(ctx);vm.runInContext(block('  const SITE_MAX_BALANCE=','  function watchSiteWallet(uid){'),ctx);
 const x=await ctx.applySiteWalletEntry('a','jid','spin_'+'a'.repeat(32),-100,'slot',{bet:100});
 const y=await ctx.applySiteWalletEntry('a','jid','spin_'+'a'.repeat(32),-100,'slot',{bet:100});
 assert.equal(x.balance,900);assert.equal(y.balance,900);assert.equal(db.value.siteWallets.a.version,1);
 await assert.rejects(ctx.applySiteWalletEntry('a','jid','purchase_12345',-10000,'customization'),/Saldo insuficiente/);
 assert.equal(db.value.siteWallets.a.balance,900);
});
test('Game invite acceptance checks invitation and uses server-side bet only',()=>{
 assert.match(bridge,/async function processSiteGameAccept/);
 assert.match(bridge,/const bet=normalizeGameBet\(inv.bet\)/);
 assert.match(bridge,/reciprocalFriends\(uid,targetUid\)/);
 assert.match(bridge,/siteGameAccepts\/\$\{uid\}\/\$\{challengeId\}/);
 assert.match(bridge,/noLink=new Set\(\['site_game_accept'/);
});
test('Legacy slot reservations are not cleared or replayed on new spin',()=>{
 const src=block('  async function processSlotsSpin(uid,jid,data)','  async function processSlotsSettle(');
 assert.match(src,/siteSlotsPending/);assert.match(src,/if\(oldPending\)throw/);
 assert.match(src,/receipts\?\.\[requestId\]/);
});
