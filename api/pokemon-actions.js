'use strict';

const crypto = require('crypto');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

function normalizedPrivateKey(v=''){
  return String(v||'').replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n').replace(/\\r/g,'\n').trim();
}
function serviceAccount(){
  let raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();
  if(raw){
    if(!raw.startsWith('{'))raw=Buffer.from(raw,'base64').toString('utf8');
    const s=JSON.parse(raw);
    return{projectId:s.project_id||s.projectId,clientEmail:s.client_email||s.clientEmail,privateKey:normalizedPrivateKey(s.private_key||s.privateKey)};
  }
  return{projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:normalizedPrivateKey(process.env.FIREBASE_PRIVATE_KEY||Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64||'','base64').toString('utf8'))};
}
function getAdmin(){
  const a=serviceAccount(),databaseURL=String(process.env.FIREBASE_DATABASE_URL||'https://gremory-e4313-default-rtdb.firebaseio.com').trim();
  if(!a.projectId||!a.clientEmail||!a.privateKey)throw new Error('Configure FIREBASE_SERVICE_ACCOUNT_JSON no servidor da Vercel.');
  const app=getApps().find(x=>x.name==='gremory-pokemon-actions')||initializeApp({credential:cert(a),databaseURL},'gremory-pokemon-actions');
  return{auth:getAuth(app),db:getDatabase(app)};
}
function clamp(n,min,max){return Math.max(min,Math.min(max,Number(n||0)))}
function rows(v){return Array.isArray(v)?v:Object.values(v||{})}
function id(prefix='id'){return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`}
function normalizeType(value='normal'){
  if(value&&typeof value==='object')value=value.name||value.type?.name||value.tipo||'normal';
  const raw=String(value||'normal').trim().toLowerCase();
  const aliases={'fogo':'fire','água':'water','agua':'water','elétrico':'electric','eletrico':'electric','planta':'grass','gelo':'ice','lutador':'fighting','veneno':'poison','terra':'ground','voador':'flying','psíquico':'psychic','psiquico':'psychic','inseto':'bug','pedra':'rock','fantasma':'ghost','dragão':'dragon','dragao':'dragon','sombrio':'dark','aço':'steel','aco':'steel','fada':'fairy'};
  return aliases[raw]||raw||'normal';
}
function normalizeTypes(mon={}){
  let raw=mon.types??mon.tipos??mon.tipo??mon.tipoTxt??mon.type??[];
  if(!Array.isArray(raw))raw=String(raw||'').split(/[\/,|+]/);
  raw=[...raw,mon.tipo1,mon.tipo2,mon.type1,mon.type2];
  return raw.map(normalizeType).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,2);
}
function normalizeMove(move,i=0){
  if(typeof move==='string')return{name:move,power:45,type:'normal'};
  move=move&&typeof move==='object'?move:{};
  return{name:move.name||move.nome||move.move?.name||`Golpe ${i+1}`,power:clamp(move.power||move.poder||move.damage||move.dano||45,20,160),type:normalizeType(move.type||move.tipo||move.move?.type||'normal')};
}
function normalizeMon(mon={}){
  const maxHp=Math.max(1,Number(mon.maxHp||mon.hpMax||mon.hp||40));
  const hp=clamp(mon.hpAtual??mon.hp??maxHp,0,maxHp);
  return{...mon,uid:String(mon.uid||mon.id||''),name:mon.name||mon.nome||'Pokémon',level:Math.max(1,Number(mon.level||1)),hp,maxHp,fainted:!!mon.fainted||hp<=0,attack:Math.max(20,Number(mon.attack||mon.ataque||mon.stats?.attack||80)),defense:Math.max(20,Number(mon.defense||mon.defesa||mon.stats?.defense||80)),types:normalizeTypes(mon),moves:(Array.isArray(mon.moves)?mon.moves:[]).slice(0,4).map(normalizeMove)};
}
const TYPE_EFFECT={
 normal:{rock:.5,ghost:0,steel:.5},fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},ghost:{normal:0,psychic:2,ghost:2,dark:.5},dragon:{dragon:2,steel:.5,fairy:0},dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
function typeMultiplier(moveType,defenderTypes=[]){let mult=1;for(const dt of defenderTypes.map(normalizeType))mult*=Number(TYPE_EFFECT[normalizeType(moveType)]?.[dt]??1);return mult}
function damageDetail(attacker,defender,move,{raid=false,variance=.94,crit=false}={}){
  const a=normalizeMon(attacker),d=normalizeMon(defender),m=normalizeMove(move),stab=a.types.includes(m.type)?1.2:1,effectiveness=typeMultiplier(m.type,d.types),critMult=crit?1.5:1;
  const base=(((2*a.level/5+2)*m.power*(Math.max(1,a.attack)/Math.max(1,d.defense)))/50)+2,pacing=raid?2.05:1.5;
  const dano=effectiveness===0?0:Math.max(1,Math.floor(base*variance*stab*effectiveness*critMult*pacing));
  const effectText=effectiveness===0?'Sem efeito':effectiveness>=4?'Extremamente efetivo':effectiveness>1?'Super efetivo':effectiveness<1?'Pouco efetivo':crit?'Crítico':'';
  return{dano,effectText,multiplier:effectiveness,critico:crit};
}
async function authenticated(req,readJsonBody){
  const body=await readJsonBody(req),token=String(body?.idToken||'');
  if(!token||token.length>10000){const e=new Error('Entre na conta do site.');e.status=401;throw e}
  const{auth,db}=getAdmin();let decoded;
  try{decoded=await auth.verifyIdToken(token)}catch{const e=new Error('Sessão expirada. Entre novamente.');e.status=401;throw e}
  const uid=String(decoded.uid||'');if(!uid){const e=new Error('Usuário inválido.');e.status=401;throw e}
  return{uid,body,db};
}
function safeTeam(pokemon={}){return rows(pokemon.team).slice(0,6).map(normalizeMon).filter(x=>x.uid)}
function nextHealthy(team,start=0){for(let n=0;n<team.length;n++){const i=(start+n)%team.length,m=team[i];if(m&&!m.fainted&&Number(m.hp)>0)return i}return-1}
async function queuePokemonCommit(db,uid,{team=[],activeUid='',reason='',encounterId='',reward=null,capture=null}={}){
  const syncId=id('pksync'),jobId=id('pkjob'),payload={syncId,uid,team:team.map(m=>({uid:String(m.uid),hp:Number(m.hp||0),maxHp:Number(m.maxHp||1),fainted:!!m.fainted})),activeUid:String(activeUid||''),reason:String(reason||''),encounterId:String(encounterId||''),reward:reward||null,capture:capture||null,createdAt:Date.now()};
  const patch={};patch[`pokemonSiteSyncPending/${uid}/${syncId}`]=payload;patch[`siteBridgeJobs/${uid}/${jobId}`]={type:'pokemon_site_commit',syncId,createdAt:new Date().toISOString()};await db.ref().update(patch);return syncId;
}
async function queueRaidFinalize(db,uid,raidId){const jobId=id('raidfinal');await db.ref(`siteBridgeJobs/${uid}/${jobId}`).set({type:'site_raid_finalize',raidId:String(raidId||''),createdAt:new Date().toISOString()});}

async function handleWildMove(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{
    const{uid,body,db}=await authenticated(req,readJsonBody),moveIndex=Math.max(0,Math.min(3,Math.floor(Number(body?.moveIndex||0)))),now=Date.now();
    const[linkedSn,syncSn]=await Promise.all([db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value'),db.ref(`charlotteSync/${uid}`).once('value')]);
    if(!linkedSn.val())return sendJson(res,400,{erro:'Vincule a Charlotte primeiro.'});
    const sync=syncSn.val()||{},fallbackTeam=safeTeam(sync.pokemon||{});if(!fallbackTeam.length)return sendJson(res,409,{erro:'Monte uma equipe Pokémon saudável primeiro.'});
    const playerVariance=crypto.randomInt(88,101)/100,playerCrit=crypto.randomInt(1,101)<=10,counterVariance=crypto.randomInt(88,101)/100,counterCrit=crypto.randomInt(1,101)<=10,rewardRupias=Math.floor(crypto.randomInt(45,121)*(sync.account?.premium?1.25:1)),rewardXp=crypto.randomInt(20,46),logId=id('log');
    let response=null,syncReason='',syncReward=null;
    const er=db.ref(`pokemonSiteEncounter/${uid}`),tx=await er.transaction(current=>{
      if(!current||current.status!=='battle'||Number(current.expiresAt||0)<=now)return;
      if(now-Number(current.lastActionAt||0)<450)return;
      const team=rows(current.team).length?rows(current.team).map(normalizeMon):fallbackTeam.map(x=>({...x}));
      let activeIndex=team.findIndex(m=>String(m.uid)===String(current.activeUid||current.player?.uid||''));if(activeIndex<0||team[activeIndex]?.fainted||Number(team[activeIndex]?.hp)<=0)activeIndex=nextHealthy(team,0);if(activeIndex<0)return;
      const mine=team[activeIndex],wild=normalizeMon(current.mon||{}),moves=mine.moves.length?mine.moves:[{name:'Ataque rápido',power:40,type:'normal'},{name:'Investida',power:45,type:'normal'}],move=moves[Math.min(moveIndex,moves.length-1)]||moves[0],hit=damageDetail(mine,wild,move,{variance:playerVariance,crit:playerCrit});
      wild.hp=Math.max(0,wild.hp-hit.dano);wild.fainted=wild.hp<=0;let text=`${mine.name} usou ${move.name} e causou ${hit.dano}${hit.effectText?` • ${hit.effectText}`:''}.`,counterDamage=0;
      current.lastActionAt=now;current.updatedAt=new Date(now).toISOString();current.mon={...current.mon,...wild};current.team=team;current.activeUid=mine.uid;current.player={...current.player,...mine};current.log=current.log||{};
      if(wild.fainted){current.status='finished';current.result='victory';current.finishedAt=new Date(now).toISOString();current.expiresAt=now+60000;current.reward={rupias:rewardRupias,pokemonXp:rewardXp,pending:true};text+=` ${wild.name} desmaiou.`;syncReason='victory';syncReward={rupias:rewardRupias,pokemonXp:rewardXp,monUid:mine.uid};}
      else{
        const wildMoves=wild.moves.length?wild.moves:[{name:'Investida',power:40,type:'normal'}],wm=wildMoves[crypto.randomInt(0,wildMoves.length)]||wildMoves[0],counter=damageDetail(wild,mine,wm,{variance:counterVariance,crit:counterCrit});counterDamage=counter.dano;mine.hp=Math.max(0,mine.hp-counterDamage);mine.fainted=mine.hp<=0;team[activeIndex]=mine;text+=` ${wild.name} usou ${wm.name} e causou ${counterDamage}${counter.effectText?` • ${counter.effectText}`:''}.`;
        if(mine.fainted){text+=` ${mine.name} desmaiou.`;const next=nextHealthy(team,activeIndex+1);syncReason='faint';if(next<0){current.status='finished';current.result='defeat';current.finishedAt=new Date(now).toISOString();current.expiresAt=now+60000;current.activeUid='';current.player={...mine};text+=' Sua equipe inteira desmaiou.';syncReason='defeat';}else{current.activeUid=team[next].uid;current.player={...team[next]};text+=` Você enviou ${team[next].name}.`;}}
        else current.player={...mine};
        current.team=team;
      }
      current.log[logId]={text,at:new Date(now).toISOString()};response={encounter:current,damage:hit.dano,counterDamage,effectText:hit.effectText};return current;
    },undefined,false);
    if(!tx.committed){const latest=(await er.once('value')).val();if(latest?.status==='finished')return sendJson(res,409,{erro:'Esse encontro terminou.',encounter:latest});return sendJson(res,429,{erro:'Aguarde um instante antes do próximo golpe.'});}
    const encounter=tx.snapshot.val();if(syncReason)queuePokemonCommit(db,uid,{team:rows(encounter.team),activeUid:encounter.activeUid,reason:syncReason,encounterId:encounter.id,reward:syncReward}).catch(e=>console.error('[POKEMON SYNC QUEUE]',e.message));
    return sendJson(res,200,{ok:true,...response,encounter});
  }catch(e){console.error('[SITE WILD MOVE]',e?.message||e);return sendJson(res,e.status||503,{erro:e.message||'Não foi possível registrar o golpe.'});}
}
async function handleWildCapture(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{
    const{uid,body,db}=await authenticated(req,readJsonBody),ball=String(body?.ball||'pokebola').toLowerCase(),allowed=new Set(['pokebola','greatball','ultraball','premierball']);if(!allowed.has(ball))return sendJson(res,400,{erro:'Pokébola inválida.'});
    const syncSn=await db.ref(`charlotteSync/${uid}/pokemon`).once('value'),items=syncSn.val()?.items||{},owned=Math.max(0,Number(items[ball]||0));if(owned<1)return sendJson(res,409,{erro:`Você não possui ${ball}.`});
    const er=db.ref(`pokemonSiteEncounter/${uid}`),now=Date.now(),roll=crypto.randomInt(1,101);let outcome=null;
    const tx=await er.transaction(current=>{
      if(!current||current.status!=='battle'||Number(current.expiresAt||0)<=now)return;
      if(now-Number(current.lastCaptureAt||0)<650)return;
      current.ballUses=current.ballUses||{};const used=Math.max(0,Number(current.ballUses[ball]||0));if(used>=owned)return;
      const wild=normalizeMon(current.mon||{}),hpRate=wild.hp/Math.max(1,wild.maxHp),base=32+Math.round((1-hpRate)*38),bonus=ball==='greatball'?15:ball==='ultraball'?30:ball==='premierball'?38:0,chance=Math.max(5,Math.min(92,base+bonus)),captured=roll<=chance;
      current.ballUses[ball]=used+1;current.lastCaptureAt=now;current.updatedAt=new Date(now).toISOString();current.log=current.log||{};current.log[id('log')]={text:captured?`${wild.name} foi capturado!`:`A ${ball} falhou. ${wild.name} escapou.`,at:new Date(now).toISOString()};
      if(captured){current.status='finished';current.result='captured';current.finishedAt=new Date(now).toISOString();current.expiresAt=now+60000}
      outcome={captured,chance,wild,current};return current;
    },undefined,false);
    if(!tx.committed){const latest=(await er.once('value')).val();if(latest?.status==='finished')return sendJson(res,409,{erro:'Esse encontro terminou.',encounter:latest});return sendJson(res,429,{erro:owned<1?`Você não possui ${ball}.`:'Aguarde um instante antes de tentar outra Pokébola.'});}
    const encounter=tx.snapshot.val(),wild=normalizeMon(outcome.wild),captureMon=outcome.captured?{uid:id('pk'),dex:wild.dex||wild.id,name:wild.name,nome:wild.name,level:wild.level,shiny:!!wild.shiny,maxHp:wild.maxHp,hp:wild.maxHp,attack:wild.attack,defense:wild.defense,sprite:wild.sprite,types:wild.types,moves:wild.moves}:null;
    await queuePokemonCommit(db,uid,{team:rows(encounter.team),activeUid:encounter.activeUid||encounter.player?.uid,reason:outcome.captured?'capture':'capture_fail',encounterId:encounter.id,capture:{ball,captured:outcome.captured,mon:captureMon}});
    return sendJson(res,200,{ok:true,captured:outcome.captured,chance:outcome.chance,pokemon:outcome.captured?wild:null,encounter});
  }catch(e){console.error('[SITE WILD CAPTURE]',e?.message||e);return sendJson(res,e.status||503,{erro:e.message||'Não foi possível lançar a Pokébola.'});}
}
async function handleWildExit(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{const{uid,db}=await authenticated(req,readJsonBody),er=db.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())return sendJson(res,200,{ok:true,left:true});const e=sn.val()||{};if(e.status!=='finished'){e.status='finished';e.result='escaped';e.finishedAt=new Date().toISOString();e.expiresAt=Date.now()+15000;e.updatedAt=new Date().toISOString();e.log=e.log||{};e.log[id('log')]={text:'Você fugiu do encontro selvagem.',at:new Date().toISOString()};await er.set(e)}queuePokemonCommit(db,uid,{team:rows(e.team),activeUid:e.activeUid||e.player?.uid,reason:'escaped',encounterId:e.id}).catch(()=>{});return sendJson(res,200,{ok:true,left:true,encounter:e});}catch(e){console.error('[SITE WILD EXIT]',e?.message||e);return sendJson(res,e.status||503,{erro:e.message||'Não foi possível sair da batalha.'});}
}
async function currentRaid(db){const sn=await db.ref('pokemonSiteRaid/current').once('value');const raid=sn.val();if(!raid||raid.status!=='active'||Number(raid.expiresAt||0)<=Date.now())return null;return raid}
async function handleRaidEnter(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{const{uid,db}=await authenticated(req,readJsonBody),[raid,linkedSn,syncSn]=await Promise.all([currentRaid(db),db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value'),db.ref(`charlotteSync/${uid}/pokemon`).once('value')]);if(!raid)return sendJson(res,409,{erro:'Nenhuma Raid ativa.'});if(!linkedSn.val())return sendJson(res,400,{erro:'Vincule a Charlotte primeiro.'});const team=safeTeam(syncSn.val()||{});if(!team.length)return sendJson(res,409,{erro:'Monte sua equipe Pokémon antes de entrar na Raid.'});const idx=nextHealthy(team,0),battle={raidId:raid.id,uid,status:idx>=0?'active':'team_defeated',activeUid:idx>=0?team[idx].uid:'',team,healCost:Math.max(1,team.length)*100,enteredAt:Date.now(),updatedAt:Date.now()};await db.ref(`pokemonSiteRaidBattles/${raid.id}/${uid}`).set(battle);return sendJson(res,200,{ok:true,battle});}catch(e){return sendJson(res,e.status||503,{erro:e.message||'Não foi possível entrar na Raid.'});}
}
async function handleRaidSwitch(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{const{uid,body,db}=await authenticated(req,readJsonBody),raid=await currentRaid(db);if(!raid)return sendJson(res,409,{erro:'Essa Raid terminou.'});const monUid=String(body?.monUid||''),br=db.ref(`pokemonSiteRaidBattles/${raid.id}/${uid}`);let battle=null;const tx=await br.transaction(cur=>{if(!cur||cur.status!=='active')return;const team=rows(cur.team).map(normalizeMon),mon=team.find(x=>String(x.uid)===monUid);if(!mon||mon.fainted||mon.hp<=0)return;cur.activeUid=mon.uid;cur.team=team;cur.updatedAt=Date.now();battle=cur;return cur},undefined,false);if(!tx.committed)return sendJson(res,409,{erro:'Esse Pokémon não pode entrar agora.'});return sendJson(res,200,{ok:true,battle:tx.snapshot.val()});}catch(e){return sendJson(res,e.status||503,{erro:e.message||'Não foi possível trocar o Pokémon.'});}
}
async function handleRaidAttack(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{
    const{uid,body,db}=await authenticated(req,readJsonBody),raid=await currentRaid(db);if(!raid)return sendJson(res,409,{erro:'Essa Raid terminou.'});if(body?.raidId&&String(body.raidId)!==String(raid.id))return sendJson(res,409,{erro:'Entre novamente na Raid atual.'});
    const br=db.ref(`pokemonSiteRaidBattles/${raid.id}/${uid}`),battleSn=await br.once('value'),battle=battleSn.val();if(!battle)return sendJson(res,409,{erro:'Clique em Entrar na batalha primeiro.'});if(battle.status!=='active')return sendJson(res,409,{erro:'Sua equipe foi derrotada. Cure todos ou saia para trocar a equipe.',battle});
    const team=rows(battle.team).map(normalizeMon);let ai=team.findIndex(m=>String(m.uid)===String(battle.activeUid));if(ai<0||team[ai].fainted||team[ai].hp<=0)ai=nextHealthy(team,0);if(ai<0)return sendJson(res,409,{erro:'Sua equipe foi derrotada.',battle:{...battle,status:'team_defeated',activeUid:''}});
    const active=team[ai],moves=active.moves.length?active.moves:[{name:'Ataque rápido',power:40,type:'normal'}],move=moves[Math.max(0,Math.min(moves.length-1,Math.floor(Number(body?.moveIndex||0))))]||moves[0],playerHit=damageDetail(active,raid.boss,move,{raid:true,variance:crypto.randomInt(88,101)/100,crit:crypto.randomInt(1,101)<=10}),now=Date.now();
    const dir=(await db.ref(`directory/${uid}`).once('value').catch(()=>null))?.val?.()||{},trainerName=String(dir.nome||'Treinador').slice(0,50);let raidAfter=null,raidDefeated=false;
    const rr=db.ref('pokemonSiteRaid/current'),rtx=await rr.transaction(cur=>{if(!cur||String(cur.id)!==String(raid.id)||cur.status!=='active'||Number(cur.expiresAt||0)<=now)return;cur.participants=cur.participants||{};const prev=cur.participants[uid]||{};if(now-Number(prev.lastAttackAt||0)<1200)return;const dmg=Math.min(Number(cur.hp||0),playerHit.dano);cur.hp=Math.max(0,Number(cur.hp||0)-dmg);cur.participants[uid]={uid,name:trainerName,damage:Number(prev.damage||0)+dmg,attacks:Number(prev.attacks||0)+1,lastAttackAt:now};cur.log=cur.log||{};cur.log[id('hit')]={uid,text:`${active.name} usou ${move.name} e causou ${dmg}${playerHit.effectText?` • ${playerHit.effectText}`:''}.`,at:new Date(now).toISOString()};if(cur.hp<=0){cur.status='defeated';cur.defeatedAt=now;raidDefeated=true}raidAfter=cur;return cur},undefined,false);
    if(!rtx.committed){const latest=(await rr.once('value')).val();if(latest&&latest.status!=='active')return sendJson(res,200,{ok:true,raidFinished:true,bossHp:Number(latest.hp||0),battle});return sendJson(res,429,{erro:'Aguarde um instante antes do próximo ataque.'});}
    let counterDamage=0,nextBattle={...battle,team};
    if(!raidDefeated){const boss=normalizeMon(raidAfter.boss||raid.boss||{}),bossMoves=boss.moves.length?boss.moves:[{name:'Investida',power:55,type:boss.types[0]||'normal'}],wm=bossMoves[crypto.randomInt(0,bossMoves.length)]||bossMoves[0],counter=damageDetail(boss,active,wm,{variance:crypto.randomInt(88,101)/100,crit:crypto.randomInt(1,101)<=10});counterDamage=counter.dano;active.hp=Math.max(0,active.hp-counterDamage);active.fainted=active.hp<=0;team[ai]=active;let syncReason='';if(active.fainted){const next=nextHealthy(team,ai+1);syncReason=next<0?'raid_team_defeated':'raid_faint';nextBattle.status=next<0?'team_defeated':'active';nextBattle.activeUid=next<0?'':team[next].uid}else nextBattle.activeUid=active.uid;nextBattle.team=team;nextBattle.updatedAt=Date.now();await br.set(nextBattle);if(syncReason)queuePokemonCommit(db,uid,{team,activeUid:nextBattle.activeUid,reason:syncReason,encounterId:raid.id}).catch(()=>{});}else{nextBattle.updatedAt=Date.now();await br.set(nextBattle);queueRaidFinalize(db,uid,raid.id).catch(()=>{});}
    return sendJson(res,200,{ok:true,damage:playerHit.dano,counterDamage,effectText:playerHit.effectText,bossHp:Number(rtx.snapshot.val()?.hp||0),battle:nextBattle,raidFinished:raidDefeated});
  }catch(e){console.error('[SITE RAID ATTACK]',e?.message||e);return sendJson(res,e.status||503,{erro:e.message||'Não foi possível registrar o ataque.'});}
}
async function handleRaidExit(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});res.setHeader('Cache-Control','no-store');
  try{const{uid,body,db}=await authenticated(req,readJsonBody),raidId=String(body?.raidId||''),rid=raidId||String((await db.ref('pokemonSiteRaid/current/id').once('value')).val()||'');if(!rid)return sendJson(res,200,{ok:true,exited:true});const br=db.ref(`pokemonSiteRaidBattles/${rid}/${uid}`),sn=await br.once('value'),battle=sn.val();if(battle)await queuePokemonCommit(db,uid,{team:rows(battle.team),activeUid:battle.activeUid,reason:'raid_exit',encounterId:rid});await br.remove();return sendJson(res,200,{ok:true,exited:true});}catch(e){return sendJson(res,e.status||503,{erro:e.message||'Não foi possível sair da Raid.'});}
}

module.exports={handleWildMove,handleWildCapture,handleWildExit,handleRaidEnter,handleRaidSwitch,handleRaidAttack,handleRaidExit,damageDetail};
