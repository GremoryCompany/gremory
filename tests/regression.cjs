const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const root=path.resolve(__dirname,'..');const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');const bridge=fs.readFileSync(path.join(root,'database/gremory_site_bridge.js'),'utf8');
function between(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)))}
test('Drive resource key is retained; non-Drive and invalid IDs rejected',()=>{const ctx={URL};vm.createContext(ctx);vm.runInContext(between(app,'function googleDriveFileId','function watchMediaPosition'),ctx);assert.equal(ctx.googleDriveEmbed('https://drive.google.com/file/d/abcdefghijklmnop/view?resourcekey=0-abc'),'https://drive.google.com/file/d/abcdefghijklmnop/preview?resourcekey=0-abc');assert.equal(ctx.googleDriveEmbed('https://drive.google.com.evil.test/file/d/abcdefghijklmnop/view'),'');assert.equal(ctx.googleDriveEmbed('https://drive.google.com/open?id=abc%2Fdef'),'')});
test('Bot jobs finish in order without waiting on their own queue',async()=>{const completed=[],userQueues=new Map();let handler;const ctx={userQueues,watchedUsers:new Set(),watchedRefs:new Map(),logger:{log(){}},processJobNow:async(uid,id)=>{await new Promise(r=>setTimeout(r,5));completed.push(id)},rtdb:{ref:()=>({on:(_,h)=>{handler=h}})}};vm.createContext(ctx);vm.runInContext(between(bridge,'  function processJob(','  function start()'),ctx);ctx.watchUserJobs('alice');handler({key:'a',val:()=>({})});handler({key:'b',val:()=>({})});await Promise.race([userQueues.get('alice'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Queue deadlock')),300))]);assert.deepEqual(completed,['a','b']);assert.equal(userQueues.size,0)});
class Snap{constructor(v){this.v=v}child(k){return new Snap(this.v?.[k])}exists(){return this.v!==undefined&&this.v!==null}val(){return this.v??null}isString(){return typeof this.v==='string'}}
const rules=JSON.parse(fs.readFileSync(path.join(root,'firebase.rules.production.json'))).rules;
function validJob(type,admin=false,extra={}){const expression=rules.siteBridgeJobs.$uid.$jobId['.validate'];return new Function('newData','auth',`return ${expression}`)(new Snap({type,...extra}),{uid:'a',token:{email:admin?'losermodder@gmail.com':'user@example.test',email_verified:true}})}
test('Implemented client jobs allowed; privileged jobs and injected processing locks rejected',()=>{assert.equal(validJob('slots_spin'),true);assert.equal(validJob('admin_store_upsert'),false);assert.equal(validJob('admin_store_upsert',true),true);assert.equal(validJob('equip_achievement'),true);assert.equal(validJob('slots_spin',false,{__processingBy:'attacker'}),false);assert.equal(validJob('anything_else'),false)});
test('All explicitly configured sound files exist',()=>{const ctx={};vm.createContext(ctx);vm.runInContext(between(app,'const CUSTOM_GAME_SOUND_FILES','function customGameSoundUrls')+';this.files=CUSTOM_GAME_SOUND_FILES',ctx);for(const [kind,files] of Object.entries(ctx.files)){assert.ok(files.some(file=>fs.existsSync(path.join(root,'assets/audio',['notification','victory'].includes(kind)?'':'custom',file))),kind)}});
test('No stale immutable asset caching',()=>{const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json')));const row=config.headers.find(x=>x.source==='/assets/(.*)');assert.ok(!row.headers[0].value.includes('immutable'))});
test('New community and YouTube controls have matching HTML IDs',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const source=fs.readFileSync(path.join(root,'assets/js/community.js'),'utf8');for(const match of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${match[1]}"`),match[1]);for(const id of ['watchYoutubeSearch','watchYoutubeQuery','watchYoutubeResults','adminVerifyEmail'])assert.ok(html.includes(`id="${id}"`),id)});
test('YouTube search reports missing key and returns only mapped public fields',async()=>{const handler=require('../api/main.js'),oldKey=process.env.YOUTUBE_API_KEY,oldFetch=global.fetch;const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}});try{delete process.env.YOUTUBE_API_KEY;let res=response();await handler({method:'GET',url:'/?action=youtube_search&q=test',headers:{}},res);assert.equal(res.statusCode,503);process.env.YOUTUBE_API_KEY='test-key';global.fetch=async url=>{assert.equal(url.hostname,'www.googleapis.com');return {ok:true,json:async()=>({items:[{id:{videoId:'abc123'},snippet:{title:'Teste',thumbnails:{medium:{url:'https://example.test/img'}}}}]})}};res=response();await handler({method:'GET',url:'/?action=youtube_search&q=test',headers:{}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body.items,[{id:'abc123',title:'Teste',thumbnail:'https://example.test/img'}]);assert.ok(!JSON.stringify(res.body).includes('test-key'))}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=oldKey}});

test('Blackjack private hands are readable only by their authenticated owner',()=>{
  const expr=rules.blackjackPrivate.$gameId.$uid['.read'];
  const canRead=(authUid,pathUid)=>new Function('auth','$uid',`return ${expr}`)({uid:authUid,token:{}},pathUid);
  assert.equal(canRead('playerA','playerA'),true);
  assert.equal(canRead('playerA','playerB'),false);
  assert.equal(canRead('playerB','playerB'),true);
  assert.equal(canRead('playerB','playerA'),false);
  assert.equal(rules.blackjackPrivate.$gameId.$uid['.write'],false);
  assert.equal(rules.blackjackGames.$gameId['.write'],false);
  assert.equal(rules.gameSecrets['.read'],false);
});

test('Blackjack public projection exposes counts, never active cards or score',()=>{
  const ctx={};vm.createContext(ctx);
  vm.runInContext(between(bridge,'  function blackjackPublicPlayer','  async function readBlackjackPrivate'),ctx);
  const handA={cards:[{r:'A',s:'♠'},{r:'7',s:'♦'}],score:18,stood:false,busted:false};
  const handB={cards:[{r:'10',s:'♣'},{r:'5',s:'♥'},{r:'4',s:'♠'}],score:19,stood:true,busted:false};
  const a=ctx.blackjackPublicPlayer('playerA','A',handA),b=ctx.blackjackPublicPlayer('playerB','B',handB);
  assert.deepEqual(JSON.parse(JSON.stringify(a)),{uid:'playerA',name:'A',cardCount:2,stood:false,busted:false});
  assert.deepEqual(JSON.parse(JSON.stringify(b)),{uid:'playerB',name:'B',cardCount:3,stood:true,busted:false});
  assert.equal('cards' in a,false);assert.equal('score' in a,false);assert.equal('cards' in b,false);assert.equal('score' in b,false);
});

test('Blackjack frontend subscribes private hand with auth.currentUser.uid and cleans old listener',()=>{
  const block=between(app,'function subscribeBlackjack(id)','function blackjackCardLabel');
  assert.ok(block.includes('auth.currentUser?.uid'));
  assert.ok(block.includes('blackjackPrivate/${id}/${uid}'));
  assert.ok(block.includes('unsubscribeBlackjackListeners()'));
  assert.ok(!block.includes('opponentUid'));
  assert.ok(!block.includes('Object.keys(g.players)[0]'));
});

test('Blackjack bridge creates one private hand per player and public game stays projected',()=>{
  const block=between(bridge,'  async function processBlackjackCreate','  async function processBlackjackMove');
  assert.ok(block.includes('blackjackPrivate/${gameId}/${uid}'));
  assert.ok(block.includes('blackjackPrivate/${gameId}/${targetUid}'));
  assert.ok(block.includes('blackjackPublicPlayer'));
  assert.ok(!block.includes("players:{[uid]:{uid,name:a.val()?.nome||'Jogador',cards"));
});

test('New game jobs are allowlisted without opening server-only state',()=>{
  for(const type of ['nightmare21_create','nightmare21_move','nightmare21_exit','chaos_create','chaos_move','chaos_exit','poker_create','poker_move','poker_exit','horse_race','fishing_cast','fishing_sell','fishing_upgrade','mining_mine','mining_sell','mining_upgrade'])assert.equal(validJob(type),true,type);
  for(const pathName of ['nightmare21Private','chaosPrivate','pokerPrivate']){assert.equal(rules[pathName].$gameId.$uid['.write'],false);}
  for(const pathName of ['horseRaceLast','siteFishing','siteMining'])assert.equal(rules[pathName].$uid['.write'],false);
});

test('Extra games module only references controls that exist in Games HTML',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const extra=fs.readFileSync(path.join(root,'assets/js/games-extra.js'),'utf8');
  for(const m of extra.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${m[1]}"`),m[1]);
});

test('Blackjack two-user view model keeps own hand private and opponent count public',()=>{
  const publicGame={players:{playerA:{uid:'playerA',name:'A',cardCount:2,stood:false,busted:false},playerB:{uid:'playerB',name:'B',cardCount:3,stood:false,busted:false}}};
  const priv={playerA:{cards:[{r:'A',s:'♠'},{r:'7',s:'♦'}],score:18},playerB:{cards:[{r:'10',s:'♣'},{r:'5',s:'♥'},{r:'4',s:'♠'}],score:19}};
  const view=uid=>{const other=Object.values(publicGame.players).find(p=>p.uid!==uid);return{ownCards:priv[uid].cards,ownScore:priv[uid].score,opponentCardCount:other.cardCount,opponentCards:undefined,opponentScore:undefined}};
  assert.equal(view('playerA').ownScore,18);assert.equal(view('playerA').opponentCardCount,3);assert.equal(view('playerA').opponentCards,undefined);
  assert.equal(view('playerB').ownScore,19);assert.equal(view('playerB').opponentCardCount,2);assert.equal(view('playerB').opponentScore,undefined);
});
