const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const root=path.resolve(__dirname,'..');const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');const bridge=fs.readFileSync(path.join(root,'database/gremory_site_bridge.js'),'utf8');
function between(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)))}
test('Drive resource key is retained; non-Drive and invalid IDs rejected',()=>{const ctx={URL};vm.createContext(ctx);vm.runInContext(between(app,'function googleDriveFileId','function watchMediaPosition'),ctx);assert.equal(ctx.googleDriveEmbed('https://drive.google.com/file/d/abcdefghijklmnop/view?resourcekey=0-abc'),'https://drive.google.com/file/d/abcdefghijklmnop/preview?resourcekey=0-abc');assert.equal(ctx.googleDriveEmbed('https://drive.google.com.evil.test/file/d/abcdefghijklmnop/view'),'');assert.equal(ctx.googleDriveEmbed('https://drive.google.com/open?id=abc%2Fdef'),'')});
test('Bot jobs finish in order without waiting on their own queue',async()=>{const completed=[],userQueues=new Map();let handler;const ctx={userQueues,watchedUsers:new Set(),watchedRefs:new Map(),logger:{log(){}},processJobNow:async(uid,id)=>{await new Promise(r=>setTimeout(r,5));completed.push(id)},rtdb:{ref:()=>({on:(_,h)=>{handler=h}})}};vm.createContext(ctx);vm.runInContext(between(bridge,'  function processJob(','  function start()'),ctx);ctx.watchUserJobs('alice');handler({key:'a',val:()=>({})});handler({key:'b',val:()=>({})});await Promise.race([userQueues.get('alice'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Queue deadlock')),300))]);assert.deepEqual(completed,['a','b']);assert.equal(userQueues.size,0)});
class Snap{constructor(v){this.v=v}child(k){return new Snap(this.v?.[k])}exists(){return this.v!==undefined&&this.v!==null}val(){return this.v??null}isString(){return typeof this.v==='string'}}
const rules=JSON.parse(fs.readFileSync(path.join(root,'firebase.rules.production.json'))).rules;
function validJob(type,admin=false,extra={}){const expression=rules.siteBridgeJobs.$uid.$jobId['.validate'];return new Function('newData','auth',`return ${expression}`)(new Snap({type,...extra}),{uid:'a',token:{email:admin?'losermodder@gmail.com':'user@example.test',email_verified:true}})}
test('Implemented client jobs allowed; privileged jobs and injected processing locks rejected',()=>{assert.equal(validJob('slots_spin'),false);assert.equal(validJob('admin_store_upsert'),false);assert.equal(validJob('admin_store_upsert',true),true);assert.equal(validJob('equip_achievement'),true);assert.equal(validJob('slots_spin',false,{__processingBy:'attacker'}),false);assert.equal(validJob('anything_else'),false)});
test('All explicitly configured sound files exist',()=>{const ctx={};vm.createContext(ctx);vm.runInContext(between(app,'const CUSTOM_GAME_SOUND_FILES','function customGameSoundUrls')+';this.files=CUSTOM_GAME_SOUND_FILES',ctx);for(const [kind,files] of Object.entries(ctx.files)){assert.ok(files.some(file=>fs.existsSync(path.join(root,'assets/audio',['notification','victory'].includes(kind)?'':'custom',file))),kind)}});
test('No stale immutable asset caching',()=>{const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json')));const row=config.headers.find(x=>x.source==='/assets/(.*)');assert.ok(!row.headers[0].value.includes('immutable'))});
test('New community and YouTube controls have matching HTML IDs',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const source=fs.readFileSync(path.join(root,'assets/js/community.js'),'utf8');for(const match of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${match[1]}"`),match[1]);for(const id of ['watchYoutubeSearch','watchYoutubeQuery','watchYoutubeResults','adminVerifyEmail'])assert.ok(html.includes(`id="${id}"`),id)});
test('YouTube search reports missing key and returns only mapped public fields',async()=>{const handler=require('../api/main.js'),oldKey=process.env.YOUTUBE_API_KEY,oldFetch=global.fetch;const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}});try{delete process.env.YOUTUBE_API_KEY;let res=response();await handler({method:'GET',url:'/?action=youtube_search&q=test',headers:{}},res);assert.equal(res.statusCode,503);process.env.YOUTUBE_API_KEY='test-key';global.fetch=async url=>{assert.equal(url.hostname,'www.googleapis.com');return {ok:true,json:async()=>({items:[{id:{videoId:'abc123'},snippet:{title:'Teste',thumbnails:{medium:{url:'https://example.test/img'}}}}]})}};res=response();await handler({method:'GET',url:'/?action=youtube_search&q=test',headers:{}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body.items,[{id:'abc123',title:'Teste',thumbnail:'https://example.test/img'}]);assert.ok(!JSON.stringify(res.body).includes('test-key'))}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=oldKey}});


test('Slots: browser cannot settle or trigger a second spin directly',()=>{
  assert.equal(validJob('slots_settle'),false);
  assert.equal(validJob('slots_spin'),false);
  const src=fs.readFileSync(path.join(root,'api/slots.js'),'utf8');
  assert.match(src,/handleSlotsStatus/);
  assert.match(src,/authenticate/);
  assert.match(fs.readFileSync(path.join(root,'api/site-wallet.js'),'utf8'),/verifyIdToken/);
  assert.match(app,/querySlotStatus/);
  assert.doesNotMatch(between(app,'async function runSlotsSpin(', '// Delegação também funciona no mobile.'),/bridgeRequest\('slots_spin'/);
});
test('21 private hands and nightmare powers never execute in browser',()=>{
  const rr=rules.blackjackPrivate.$gameId.$uid;
  assert.match(rr['.read'],/auth\.uid === \$uid/);
  assert.equal(rr['.write'],false);
  assert.equal(rules.gameSecrets['.read'],false);
  assert.match(bridge,/function bjScore/);
  for(const ability of ['shield','omen','order','lock','swap'])assert.ok(bridge.includes(`special==='${ability}'`),ability);
  assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('id="blackjackNightmareCards"'));
});
test('Watch voice is confirmed by Firebase before the UI reports music availability',()=>{
  const voice=between(app,'async function joinWatchVoice(', 'function toggleWatchMic()');
  assert.ok(voice.indexOf('await update(ref(db,`watchVoice/')>=0);
  assert.ok(voice.indexOf('await update(ref(db,`watchVoice/')<voice.indexOf('state.watchRtc.audioJoined=true;'));
  assert.match(bridge,/musicActivationLock/);
  assert.match(bridge,/musicPaidJobs/);
  assert.match(bridge,/processWatchMusicActivate/);
});


test('Site wallet: only owner reads and no browser can write; game engine stays server-only',()=>{
  assert.equal(rules.siteWallets.$uid['.write'], false);
  assert.match(rules.siteWallets.$uid['.read'], /auth.uid === \$uid/);
  assert.equal(rules.siteGameEngine['.read'],false);
  assert.equal(rules.siteGameEngine['.write'],false);
  for(const action of ['ttt_create','ttt_move','blackjack_move','hangman_guess','watch_music_activate'])assert.equal(validJob(action),false,action);
  assert.equal(validJob('watch_music_add'),true);
});

test('Slots: receipts remain available for idempotent replay and balance cannot go negative',()=>{
  const source=fs.readFileSync(path.join(root,'api/site-wallet.js'),'utf8');
  assert.doesNotMatch(source,/keys.length>80/);
  const extracted=source.slice(source.indexOf('function applyEntry('),source.indexOf('async function applyWallet('));
  const f=new Function('validMoney',extracted+';return applyEntry;')(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e12);
  const w={balance:1000,receipts:{},version:0};
  const first=f(w,'spin_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',-100,'slot',{bet:100});
  assert.equal(first.balance,900);
  const retry=f(first,'spin_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',-100,'slot',{bet:100});
  assert.equal(retry.balance,900);
  assert.equal(retry.version,1);
  assert.equal(f({balance:5,receipts:{},version:0},'entry_abc12345',-10,'game_entry'),undefined);
});

test('Game invite validates wager from real bet property, not obsolete wager key',()=>{
  const expr=rules.siteGameChallenges.$targetUid.$challengeId['.validate'];
  assert.match(expr,/newData.child\('bet'\)/);
  assert.doesNotMatch(expr,/newData.child\('wager'\)/);
  assert.match(expr,/newData.child\('mode'\)/);
});
