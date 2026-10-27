'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function cleanJid(jid='') { return String(jid || '').replace(/:\d+@/, '@').trim(); }
function maskJid(jid='') {
  const raw = cleanJid(jid).split('@')[0].replace(/\D/g, '');
  if (raw.length < 7) return 'WhatsApp vinculado';
  return `${raw.slice(0, 4)}••••${raw.slice(-4)}`;
}
function sameUser(a,b){
  const aa=cleanJid(a),bb=cleanJid(b);if(aa===bb)return true;
  const na=aa.split('@')[0],nb=bb.split('@')[0];return !!na&&na===nb;
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, Number(n || 0))); }
function id(prefix='id'){ return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function randomLinkCode(len=6){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';for(let i=0;i<len;i++)out+=alphabet[crypto.randomInt(0,alphabet.length)];return out;}
function now(){ return new Date().toISOString(); }
function readJson(file,fallback){ try{return JSON.parse(fs.readFileSync(file,'utf8')||JSON.stringify(fallback));}catch{return JSON.parse(JSON.stringify(fallback));} }
function writeJson(file,data){ fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)); }
function safeRequire(name){ try{return require(name);}catch{return null;} }

const TYPE_PT={normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Veneno',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
const TYPE_EMOJI={normal:'⚪',fire:'🔥',water:'💧',electric:'⚡',grass:'🌿',ice:'❄️',fighting:'🥊',poison:'☠️',ground:'🌍',flying:'🪽',psychic:'🔮',bug:'🐛',rock:'🪨',ghost:'👻',dragon:'🐉',dark:'🌑',steel:'⚙️',fairy:'✨'};
function normalizePokeType(value='normal'){
  if(value&&typeof value==='object')value=value.name||value.type?.name||value.tipo||'normal';
  const raw=String(value||'normal').trim().toLowerCase();
  const aliases={'fogo':'fire','água':'water','agua':'water','elétrico':'electric','eletrico':'electric','planta':'grass','gelo':'ice','lutador':'fighting','veneno':'poison','terra':'ground','voador':'flying','psíquico':'psychic','psiquico':'psychic','inseto':'bug','pedra':'rock','fantasma':'ghost','dragão':'dragon','dragao':'dragon','sombrio':'dark','aço':'steel','aco':'steel','fada':'fairy'};
  return aliases[raw]||raw||'normal';
}
function normalizePokeTypes(mon={}){
  let raw=mon.types??mon.tipos??mon.tipo??mon.tipoTxt??mon.type??[];
  if(!Array.isArray(raw))raw=String(raw||'').split(/[\/,|+]/);
  raw=[...raw,mon.tipo1,mon.tipo2,mon.type1,mon.type2];
  return raw.map(normalizePokeType).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,2);
}
function typeName(type){const t=normalizePokeType(type);return `${TYPE_EMOJI[t]||'⚪'} ${TYPE_PT[t]||t}`;}
const TYPE_EFFECT={
 normal:{rock:.5,ghost:0,steel:.5},fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},ghost:{normal:0,psychic:2,ghost:2,dark:.5},dragon:{dragon:2,steel:.5,fairy:0},dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
function typeMultiplier(moveType,defenderTypes=[]){const mt=normalizePokeType(moveType);let mult=1;for(const dt of defenderTypes.map(normalizePokeType))mult*=Number(TYPE_EFFECT[mt]?.[dt]??1);return mult;}
function damageDetail(attacker,defender,move,{raid=false}={}){
  const a=publicMon(attacker),d=publicMon(defender),m=normalizeMove(move);
  const variance=crypto.randomInt(88,101)/100;
  const stab=a.types.includes(m.type)?1.2:1;
  const effectiveness=typeMultiplier(m.type,d.types);
  const crit=crypto.randomInt(1,101)<=10;
  const critMult=crit?1.5:1;
  const base=(((2*a.level/5+2)*m.power*(Math.max(1,a.attack)/Math.max(1,d.defense)))/50)+2;
  const pacing=raid?2.05:1.5;
  const dano=effectiveness===0?0:Math.max(1,Math.floor(base*variance*stab*effectiveness*critMult*pacing));
  const effectText=effectiveness===0?'Sem efeito':effectiveness>=4?'Extremamente efetivo':effectiveness>1?'Super efetivo':effectiveness<1?'Pouco efetivo':crit?'Crítico':'';
  return{dano,critico:crit,efetivo:effectiveness>1,fraco:effectiveness>0&&effectiveness<1,imune:effectiveness===0,multiplier:effectiveness,stab,moveType:m.type,effectText};
}

function stripOuterQuotes(value='') {
  let v = String(value || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v.trim();
}
function normalizePrivateKey(raw='') {
  let key = stripOuterQuotes(raw);
  if (!key) return '';
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  key = key.replace(/^private_key\s*=\s*/i, '').trim();
  key = stripOuterQuotes(key);
  return key.trim();
}
function decodeBase64Utf8(value='') {
  try { return Buffer.from(String(value || '').trim(), 'base64').toString('utf8').trim() || ''; } catch { return ''; }
}
function readServiceAccountEnv() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!rawJson) return null;
  let candidate = rawJson;
  if (!candidate.startsWith('{')) { const decoded = decodeBase64Utf8(candidate); if (decoded.startsWith('{')) candidate = decoded; }
  try {
    const obj = JSON.parse(candidate);
    return { projectId:String(obj.project_id || obj.projectId || '').trim(), clientEmail:String(obj.client_email || obj.clientEmail || '').trim(), privateKey:normalizePrivateKey(obj.private_key || obj.privateKey || '') };
  } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON existe, mas não é um JSON válido.'); }
}
function validatePrivateKey(key='') { return !!key && key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----'); }
function envStatus(name) { const value=typeof process.env[name]==='string'?process.env[name].trim():'';return value?`OK (${value.length} chars)`:'FALTANDO'; }
function logSafeEnvStatus() {
  const names=['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_DATABASE_URL','FIREBASE_PRIVATE_KEY','FIREBASE_PRIVATE_KEY_BASE64','FIREBASE_SERVICE_ACCOUNT_JSON','MP_ACCESS_TOKEN','MERCADO_PAGO_ACCESS_TOKEN'];
  const status={};for(const name of names)status[name]=envStatus(name);console.log('🔎 GREMORY ENV CHECK (valores ocultos):',status);
}
function createFirebaseAdmin() {
  const service=readServiceAccountEnv();
  const projectId=String(service?.projectId||process.env.FIREBASE_PROJECT_ID||'').trim();
  const clientEmail=String(service?.clientEmail||process.env.FIREBASE_CLIENT_EMAIL||'').trim();
  let privateKey=normalizePrivateKey(service?.privateKey||process.env.FIREBASE_PRIVATE_KEY||'');
  if(!privateKey&&process.env.FIREBASE_PRIVATE_KEY_BASE64)privateKey=normalizePrivateKey(decodeBase64Utf8(process.env.FIREBASE_PRIVATE_KEY_BASE64));
  const databaseURL=String(process.env.FIREBASE_DATABASE_URL||'').trim();
  if(!projectId||!clientEmail||!privateKey||!databaseURL)throw new Error('Firebase incompleto. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_DATABASE_URL e FIREBASE_PRIVATE_KEY (ou SERVICE_ACCOUNT_JSON).');
  if(!validatePrivateKey(privateKey))throw new Error('FIREBASE_PRIVATE_KEY inválida: a chave precisa conter BEGIN PRIVATE KEY e END PRIVATE KEY.');
  try{
    const appApi=require('firebase-admin/app');const databaseApi=require('firebase-admin/database');const authApi=require('firebase-admin/auth');
    if(typeof appApi.getApps==='function'&&typeof appApi.initializeApp==='function'&&typeof appApi.cert==='function'&&typeof databaseApi.getDatabase==='function'){
      if(appApi.getApps().length===0)appApi.initializeApp({credential:appApi.cert({projectId,clientEmail,privateKey}),databaseURL});
      const app=typeof appApi.getApp==='function'?appApi.getApp():appApi.getApps()[0];return{database:()=>databaseApi.getDatabase(app),auth:()=>authApi.getAuth(app)};
    }
  }catch(e){ if(String(e?.message||'').includes('Failed to parse private key'))throw e; }
  const admin=safeRequire('firebase-admin');if(!admin)throw new Error('Instale no bot: npm i firebase-admin');
  let hasApp=Array.isArray(admin.apps)&&admin.apps.length>0;if(!hasApp&&typeof admin.app==='function'){try{admin.app();hasApp=true}catch{}}
  if(!hasApp)admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey}),databaseURL});
  return admin;
}

function normalizeMove(move,i=0){ if(typeof move==='string')return{name:move,power:45,type:'normal'};move=move&&typeof move==='object'?move:{};return{name:move.name||move.nome||move.move?.name||`Golpe ${i+1}`,power:clamp(move.power||move.poder||move.damage||move.dano||45,20,160),type:normalizePokeType(move.type||move.tipo||move.move?.type||'normal')}; }
function publicMon(mon={}){
  const dex=Number(mon.dex||mon.id||mon.pokedexId||0);
  const maxHp=Math.max(1,Number(mon.maxHp||mon.hpMax||mon.hp||40));
  const hp=clamp(mon.hpAtual??mon.hp??maxHp,0,maxHp);
  const sprite=mon.sprite||mon.gif||mon.imagem||mon.image||(dex?`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${dex}.gif`:'');
  const rawMoves=Array.isArray(mon.moves)?mon.moves:[];
  return{uid:mon.uid||mon.id||`mon_${dex}_${String(mon.nome||mon.name||'').toLowerCase()}`,dex,name:mon.nome||mon.name||'Pokémon',level:Math.max(1,Number(mon.level||1)),shiny:!!mon.shiny,hp,maxHp,fainted:Boolean(mon.fainted)||hp<=0,attack:Math.max(20,Number(mon.attack||mon.ataque||mon.stats?.attack||80)),defense:Math.max(20,Number(mon.defense||mon.defesa||mon.stats?.defense||80)),sprite,types:normalizePokeTypes(mon),moves:rawMoves.slice(0,4).map(normalizeMove)};
}
function publicPokemonUser(user={}){
  const collection=Array.isArray(user.monsters)?user.monsters.map(publicMon):[];
  const byUid=new Map(collection.map(m=>[String(m.uid),m]));
  let team=[];
  if(Array.isArray(user.party)&&user.party.length){
    for(const item of user.party){const key=String(item?.uid||item||'');const mon=byUid.get(key);if(mon&&!team.some(x=>String(x.uid)===key))team.push(mon);}
  }
  const activeFromIndex=collection[Math.max(0,Number(user.active||0))];
  const activeUid=user.activeUid||activeFromIndex?.uid||null;
  if(!team.length&&activeUid){const active=byUid.get(String(activeUid));if(active)team=[active,...collection.filter(m=>String(m.uid)!==String(activeUid)).slice(0,5)];}
  if(!team.length)team=collection.slice(0,6);
  const rawItems=(user.items&&typeof user.items==='object'?user.items:(user.itens&&typeof user.itens==='object'?user.itens:{}))||{};
  const itemNumber=(...keys)=>{for(const key of keys){const n=Number(rawItems[key]);if(Number.isFinite(n)&&n>0)return Math.floor(n)}return 0};
  const items={
    pokebola:itemNumber('pokebola','pokeball','pokeBall'),
    greatball:itemNumber('greatball','greatBall'),
    ultraball:itemNumber('ultraball','ultraBall'),
    premierball:itemNumber('premierball','premierBall'),
    potion:itemNumber('potion','pocao','poção','potions'),
    berry:itemNumber('berry','fruta','berries')
  };
  return{collection,team:team.slice(0,6),activeUid:activeUid||team[0]?.uid||null,items};
}

const CUSTOMIZATION_CATALOG={
  frame_crimson:{name:'Carmesim',price:350,slot:'frame'},
  frame_obsidian:{name:'Obsidiana',price:1650,slot:'frame'},
  frame_royal:{name:'Imperial',price:3200,slot:'frame'},
  scale_dragon:{name:'Escamas Gremory',price:600,slot:'effect'},
  effect_stars:{name:'Estrelas Demoníacas',price:1450,slot:'effect'},
  effect_embers:{name:'Brasas Carmesim',price:2800,slot:'effect'},
  name_gold:{name:'Nome Dourado',price:900,slot:'name'},
  name_rose:{name:'Nome Rosa',price:1350,slot:'name'},
  name_ice:{name:'Nome Glacial',price:2100,slot:'name'},
  aura_rose:{name:'Rosa Demoníaca',price:1200,slot:'aura'},
  aura_void:{name:'Aura do Vazio',price:2600,slot:'aura'},
  badge_demon:{name:'Selo Demoníaco',price:4200,slot:'badge'},
  effect_petals:{name:'Pétalas Carmesim',price:1900,slot:'effect'},
  effect_snow:{name:'Neve Lunar',price:1750,slot:'effect'},
  theme_crimson:{name:'Carmesim Profundo',price:2400,slot:'theme'},
  theme_midnight:{name:'Meia-noite',price:2600,slot:'theme'},
  theme_neon:{name:'Neon Noturno',price:3100,slot:'theme'},
  effect_nebula:{name:'Nebulosa',price:2300,slot:'effect'},
  effect_scanline:{name:'Cyber Scan',price:2050,slot:'effect'},
  profile_motion_crimson:{name:'Motion Carmesim',price:3600,slot:'cover'},
  gif_profile_1:{name:'GIF Especial',price:3900,slot:'cover'},
  sprite_profile_1:{name:'Sprite Especial',price:4300,slot:'decor'}
};
const VIP_PLANS={
  '1':{nome:'💎 VIP 1 Dia',dias:1,valor:2},'7':{nome:'💎 VIP 7 Dias',dias:7,valor:5},'15':{nome:'👑 VIP 15 Dias',dias:15,valor:8},'30':{nome:'🔥 VIP 30 Dias',dias:30,valor:12}
};

const SITE_RAID_BOSSES=[
  {dex:6,name:'Charizard',types:['fire','flying']},{dex:9,name:'Blastoise',types:['water']},{dex:3,name:'Venusaur',types:['grass','poison']},{dex:94,name:'Gengar',types:['ghost','poison']},{dex:149,name:'Dragonite',types:['dragon','flying']},{dex:248,name:'Tyranitar',types:['rock','dark']},{dex:445,name:'Garchomp',types:['dragon','ground']},{dex:448,name:'Lucario',types:['fighting','steel']},{dex:282,name:'Gardevoir',types:['psychic','fairy']},{dex:376,name:'Metagross',types:['steel','psychic']}
];

function createGremorySiteBridge({sock,getGremonDB,getGremonUser,gremonAtivo,logger=console}={}){
  logSafeEnvStatus();
  if(!sock)throw new Error('sock é obrigatório no Gremory Site Bridge.');
  if(typeof getGremonDB!=='function'||typeof getGremonUser!=='function')throw new Error('Passe getGremonDB e getGremonUser ao bridge.');

  const admin=createFirebaseAdmin();
  const rtdb=admin.database();
  const economy=safeRequire('../settings/Grupo/Js/reg.js')||{};
  const mining=safeRequire('../Games/Js/mining.js')||{};
  const achievements=safeRequire('./conquistas')||{};
  const premiumLib=safeRequire('../fuction/premium.js')||{};
  const pokemonSystem=safeRequire('./sistemas.js')||{};
  const saveGremonDB=typeof pokemonSystem.saveGremonDB==='function'?pokemonSystem.saveGremonDB:(typeof global.saveGremonDB==='function'?global.saveGremonDB:null);
  const garantirHp=typeof pokemonSystem.garantirHpPokemon==='function'?pokemonSystem.garantirHpPokemon:null;
  const curarTotal=typeof pokemonSystem.curarPokemonTotal==='function'?pokemonSystem.curarPokemonTotal:null;
  const sortearSelvagem=typeof pokemonSystem.sortearPokemonSelvagem==='function'?pokemonSystem.sortearPokemonSelvagem:null;
  const levelPath=path.join(__dirname,'..','db','json','level.json');
  const premiumPath=path.join(__dirname,'..','db','json','premium.json');
  const ordersPath=path.join(__dirname,'mercadopago','mp_orders.json');
  const healingPath=path.join(__dirname,'pokemon','site_healing_jobs.json');
  const tttRewardPath=path.join(__dirname,'tictactoe','site_rewards.json');
  const tinderPath=path.join(__dirname,'tinder.json');
  const pokemonModePath=path.join(__dirname,'pokemon','pokemon_mode.json');
  const rootDir=path.join(__dirname,'..');
  const downloadDir=path.join(rootDir,'Gremory','downloads');
  const siteOrigin=String(process.env.GREMORY_SITE_ORIGIN||'https://gremory2.vercel.app').replace(/\/+$/,'').replace(/#.*$/,'');
  const backupSecret=String(process.env.GREMORY_BACKUP_SECRET||'').trim();
  const backupInFlight=new Map();
  const HEAL_COST=100;
  const HEAL_MS_FREE=5*60*1000;
  const HEAL_MS_PREMIUM=2*60*1000;
  const watchedUsers=new Set(),watchedRefs=new Map(),userQueues=new Map();
  const bridgeInstanceId=`bridge_${process.pid}_${crypto.randomBytes(6).toString('hex')}`;
  let rootWatcher=null,healingTimer=null,syncTimer=null,raidTimer=null,backupTimer=null,premiumGroupTimer=null,syncingLinked=false,backupRunning=false,restoreRunning=false,backupRecoveryRequired=false,backupRestartRequired=false,backupAssessmentDone=false,backupRuntimeStarted=false;

  function savePokemonDb(db){if(typeof saveGremonDB!=='function')throw new Error('saveGremonDB não está disponível no bot.');saveGremonDB(db);}
  function ensureMon(mon){if(!mon)return null;if(garantirHp){try{garantirHp(mon)}catch{}}if(!mon.uid)mon.uid=id('pk');if(!mon.maxHp)mon.maxHp=Math.max(1,Number(mon.hp||100));if(mon.hpAtual==null)mon.hpAtual=mon.maxHp;if(Number(mon.hpAtual)<=0){mon.hpAtual=0;mon.fainted=true;}return mon;}
  function pokemonState(jid){const db=getGremonDB(),user=getGremonUser(db,cleanJid(jid));if(!user)throw new Error('Treinador Pokémon não encontrado no bot.');user.monsters=Array.isArray(user.monsters)?user.monsters:[];user.monsters.forEach(ensureMon);return{db,user};}
  function findMon(user,uid){return(user.monsters||[]).find(m=>String(m.uid||m.id)===String(uid||''))||null;}
  function orderedTeamRaw(user){const mons=user.monsters||[],by=new Map(mons.map(m=>[String(m.uid),m]));const out=[];if(Array.isArray(user.party))for(const item of user.party){const m=by.get(String(item?.uid||item||''));if(m&&!out.includes(m))out.push(m)}if(!out.length){const active=mons[Math.max(0,Number(user.active||0))];if(active)out.push(active);for(const m of mons)if(!out.includes(m)&&out.length<6)out.push(m)}return out.slice(0,6);}
  function firstHealthy(user){return orderedTeamRaw(user).find(m=>{ensureMon(m);return !m.fainted&&Number(m.hpAtual||0)>0&&Number(m.healingUntil||0)<=Date.now()})||null;}
  function faintRaw(mon,reason='batalha'){ensureMon(mon);mon.hpAtual=0;mon.fainted=true;mon.faintedAt=Date.now();mon.faintedReason=reason;}
  function healRaw(mon){ensureMon(mon);if(curarTotal){try{curarTotal(mon);return}catch{}}mon.hpAtual=mon.maxHp;mon.fainted=false;mon.faintedAt=null;mon.faintedReason=null;mon.healingUntil=null;}

  async function linkedUidByJid(jid){const snap=await rtdb.ref('charlottePrivate').orderByChild('whatsappJid').equalTo(cleanJid(jid)).once('value');const val=snap.val()||{};return Object.keys(val)[0]||null;}
  async function linkedJidByUid(uid){const snap=await rtdb.ref(`charlottePrivate/${uid}/whatsappJid`).once('value');return cleanJid(snap.val()||'');}
  async function syncLinkedAccounts(){
    if(backupRestartRequired)return;
    if(syncingLinked)return;
    syncingLinked=true;
    try{
      const snap=await rtdb.ref('charlottePrivate').once('value');
      const rows=Object.entries(snap.val()||{});
      for(const[uid,data]of rows){
        const jid=cleanJid(data?.whatsappJid||'');
        if(!jid)continue;
        try{await syncAccount(uid,jid)}catch(e){logger.log('[SITE BRIDGE] auto sync:',e.message)}
        await new Promise(r=>setTimeout(r,120));
      }
    }finally{syncingLinked=false}
  }
  async function sendWhats(jid,text){if(!jid)return;try{await sock.sendMessage(jid,{text});}catch(e){logger.log('[SITE BRIDGE] send:',e.message);}}
  function readLevel(jid){const rows=readJson(levelPath,[]);if(!Array.isArray(rows))return{level:0,xp:0,messages:0};const u=rows.find(x=>sameUser(x.id,jid));return{level:Number(u?.level||0),xp:Number(u?.xp||0),messages:Number(u?.msg||0)};}
  function readPremium(jid){const db=readJson(premiumPath,[]);let active=false;try{if(typeof premiumLib.checkPremiumUser==='function')active=!!premiumLib.checkPremiumUser(jid,db);}catch{}return{active};}
  function readAchievements(jid){try{if(!achievements.getConquistasDB||!achievements.getUserConquista)return{unlockedCount:0,total:Object.keys(achievements.CONQUISTAS||{}).length,unlocked:[],badge:''};const db=achievements.getConquistasDB(),user=achievements.getUserConquista(db,jid),defs=achievements.CONQUISTAS||{},unlocked=(user.unlocked||[]).map(k=>({id:k,emoji:defs[k]?.emoji||'🏆',name:defs[k]?.nome||k,description:defs[k]?.desc||'',badge:defs[k]?.badge||''}));let badge='';if(user.badgeAtual&&defs[user.badgeAtual])badge=`${defs[user.badgeAtual].emoji||''} ${defs[user.badgeAtual].badge||defs[user.badgeAtual].nome}`.trim();return{unlockedCount:unlocked.length,total:Object.keys(defs).length,unlocked,badge,stats:user.stats||{}};}catch{return{unlockedCount:0,total:0,unlocked:[],badge:''};}}
  async function equipCommunityAchievement(uid,jid,achievementId){
    const ach=readAchievements(jid).unlocked.find(x=>String(x.id)===String(achievementId));
    if(!ach)throw new Error('Essa conquista ainda não foi desbloqueada.');
    const key='achievement_'+crypto.createHash('sha256').update(String(ach.id)).digest('hex').slice(0,24);
    await rtdb.ref(`profileBadges/${uid}/${key}`).set({name:String(ach.name||ach.id).slice(0,60),icon:String(ach.emoji||'🏆').slice(0,8)});
    await rtdb.ref(`profileEquippedBadge/${uid}`).set(key);return{equipped:key};
  }

  function balanceFor(jid){try{return Number(typeof economy.MoneyOfSender==='function'?economy.MoneyOfSender(jid):0)||0}catch{return 0}}
  function registeredFor(jid){try{return typeof economy.checkOfReg==='function'?!!economy.checkOfReg(jid):true}catch{return true}}


  const RUPIA_PREMIUM_PRICE=200000;
  const RUPIA_PREMIUM_DAYS=7;
  const GAME_BET_MIN=10;
  const GAME_BET_MAX=100000;
  function normalizeGameBet(value){const n=Math.floor(Number(value||0));if(!Number.isFinite(n)||n<=0)return 0;if(n<GAME_BET_MIN||n>GAME_BET_MAX)throw new Error(`A aposta deve ficar entre ₹${GAME_BET_MIN} e ₹${GAME_BET_MAX}.`);return n}
  function whatsappInviteCode(link=''){const raw=String(link||'').trim();if(!raw)return'';try{const u=new URL(raw);if(!/(^|\.)chat\.whatsapp\.com$/i.test(u.hostname))return'';return String(u.pathname.split('/').filter(Boolean)[0]||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,128)}catch{return''}}
  async function joinPremiumGroup(uid,jid,link,expiresAt=0){
    const code=whatsappInviteCode(link);if(!code)throw new Error('Link de grupo inválido. Use um link https://chat.whatsapp.com/...');
    if(typeof sock?.groupAcceptInvite!=='function')throw new Error('A Charlotte atual não suporta entrada por convite.');
    const groupJid=await sock.groupAcceptInvite(code);if(!groupJid)throw new Error('Não consegui entrar no grupo informado.');
    let subject='Grupo Premium';try{subject=(await sock.groupMetadata(groupJid))?.subject||subject}catch{}
    const row={uid,whatsappJid:cleanJid(jid),groupJid:String(groupJid),groupName:String(subject).slice(0,100),startedAt:Date.now(),expiresAt:Number(expiresAt||0),active:true};
    await rtdb.ref(`premiumGroupMemberships/${uid}`).set(row);return row
  }
  async function leavePremiumGroup(uid,row,reason='premium_expired'){
    if(!row?.groupJid)return false;try{await sock.groupLeave(String(row.groupJid))}catch(e){logger.log('[PREMIUM GROUP] saída:',e.message)}
    await rtdb.ref(`premiumGroupMemberships/${uid}`).update({active:false,leftAt:Date.now(),leaveReason:reason}).catch(()=>{});return true
  }
  async function checkPremiumGroups(){
    const sn=await rtdb.ref('premiumGroupMemberships').once('value').catch(()=>null),all=sn?.val?.()||{};
    for(const[uid,row]of Object.entries(all)){if(!row?.active||!row.groupJid)continue;const jid=cleanJid(row.whatsappJid||await linkedJidByUid(uid));const active=jid?readPremium(jid).active:false;if(!active||Number(row.expiresAt||0)>0&&Date.now()>=Number(row.expiresAt||0))await leavePremiumGroup(uid,row,'premium_expired')}
  }
  async function processPremiumRupiasBuy(uid,jid,data){
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de comprar Premium.');
    if(typeof economy.delkoin!=='function')throw new Error('Sistema de Rúpias indisponível.');
    if(readPremium(jid).active)throw new Error('Você já possui Premium ativo. Use o grupo atual ou aguarde o vencimento.');
    const link=String(data.groupLink||'').trim();
    if(link&&!whatsappInviteCode(link))throw new Error('Link de grupo inválido. Use um link https://chat.whatsapp.com/...');
    const balance=balanceFor(jid);
    if(balance<RUPIA_PREMIUM_PRICE)throw new Error(`Saldo insuficiente. Você precisa de ₹${RUPIA_PREMIUM_PRICE}.`);
    await economy.delkoin(jid,RUPIA_PREMIUM_PRICE);
    let premiumAdded=false,group=null,groupError='';
    try{
      const db=readJson(premiumPath,[]);
      if(typeof premiumLib.addPremiumUser!=='function')throw new Error('Sistema Premium indisponível.');
      premiumLib.addPremiumUser(jid,`${RUPIA_PREMIUM_DAYS}d`,db);
      writeJson(premiumPath,db);
      premiumAdded=true;
      const expiresAt=Date.now()+RUPIA_PREMIUM_DAYS*86400000;
      if(link){try{group=await joinPremiumGroup(uid,jid,link,0)}catch(e){groupError=String(e?.message||e).slice(0,180)}}
      await rtdb.ref(`premiumPurchases/${uid}`).push({source:'rupias',price:RUPIA_PREMIUM_PRICE,days:RUPIA_PREMIUM_DAYS,groupJid:group?.groupJid||'',groupError,createdAt:Date.now(),expiresAt});
      await syncAccount(uid,jid).catch(()=>{});
      await notifySite(uid,{type:'premium',title:'Premium ativado',text:`Premium por ${RUPIA_PREMIUM_DAYS} dias ativado por ₹${RUPIA_PREMIUM_PRICE}.${groupError?' O grupo não pôde ser vinculado; tente novamente em Premium.':''}`,link:'#premium'}).catch(()=>{});
      return{active:true,days:RUPIA_PREMIUM_DAYS,price:RUPIA_PREMIUM_PRICE,balance:balanceFor(jid),expiresAt,group,groupError};
    }catch(e){
      if(!premiumAdded&&typeof economy.addkoin==='function')await economy.addkoin(jid,RUPIA_PREMIUM_PRICE).catch?.(()=>{});
      throw e
    }
  }
  async function processPremiumGroupSet(uid,jid,data){
    if(!readPremium(jid).active)throw new Error('Você precisa estar com Premium ativo para vincular um grupo.');
    const link=String(data.groupLink||'').trim();if(!whatsappInviteCode(link))throw new Error('Link de grupo inválido.');
    const current=(await rtdb.ref(`premiumGroupMemberships/${uid}`).once('value').catch(()=>null))?.val?.();
    if(current?.active&&current.groupJid){
      if(!data.replace)throw new Error('Já existe um grupo Premium ativo para esta conta.');
      await leavePremiumGroup(uid,current,'group_replaced').catch(()=>{});
    }
    return{group:await joinPremiumGroup(uid,jid,link,0)}
  }
  async function processAdminPremiumGroupSet(uid,data){
    if(!await siteAdmin(uid))throw new Error('Apenas o host pode alterar grupo Premium.');
    const targetUid=String(data.targetUid||'').trim(),groupLink=String(data.groupLink||'').trim();
    if(!targetUid||!groupLink)throw new Error('Selecione o usuário e informe o link do grupo.');
    const jid=await linkedJidByUid(targetUid);if(!jid)throw new Error('Esse usuário ainda não vinculou a Charlotte.');
    if(!readPremium(jid).active)throw new Error('Esse usuário não possui Premium ativo.');
    return processPremiumGroupSet(targetUid,jid,{groupLink,replace:true});
  }
  // Serialização por identidade da carteira (não apenas por UID do site).
  // Dois desafiantes diferentes podem tentar debitar o mesmo adversário.
  const walletLocks=new Map(),gameActionLocks=new Map();
  async function withExclusiveKeys(table,keys,action){
    const releases=[];
    for(const key of [...new Set(keys.map(String))].sort()){
      const previous=table.get(key)||Promise.resolve();
      let unlock;
      const owned=new Promise(resolve=>{unlock=resolve});
      const tail=previous.catch(()=>{}).then(()=>owned);
      table.set(key,tail);
      await previous.catch(()=>{});
      releases.push(()=>{unlock();if(table.get(key)===tail)table.delete(key)});
    }
    try{return await action()}finally{releases.reverse().forEach(release=>release())}
  }
  async function prepareGameWager(gameId,playerUids,bet){
    bet=normalizeGameBet(bet);
    if(!bet)return{amount:0,pot:0,settled:true};
    if(!Array.isArray(playerUids)||playerUids.length!==2||new Set(playerUids).size!==2)throw new Error('Aposta inválida.');
    const jids=[];
    for(const uid of playerUids){const jid=await linkedJidByUid(uid);if(!jid)throw new Error('Os dois jogadores precisam vincular a Charlotte para apostar.');jids.push(jid)}
    if(new Set(jids).size!==2)throw new Error('Uma carteira não pode apostar contra si mesma.');
    if(typeof economy.delkoin!=='function'||typeof economy.addkoin!=='function')throw new Error('Sistema de Rúpias indisponível.');
    return withExclusiveKeys(walletLocks,jids,async()=>{
      for(const jid of jids)if(balanceFor(jid)<bet)throw new Error('Um dos jogadores não possui saldo suficiente para essa aposta.');
      const wr=rtdb.ref(`gameWagers/${gameId}`);
      const initial={amount:bet,pot:bet*2,players:{[playerUids[0]]:true,[playerUids[1]]:true},settled:false,status:'preparing',createdAt:Date.now(),debits:{}};
      const claim=await wr.transaction(current=>current?undefined:initial,undefined,false);
      if(!claim.committed)throw new Error('Essa aposta já existe; verifique a liquidação antes de repetir.');
      for(let i=0;i<2;i++){
        const uid=playerUids[i],jid=jids[i];
        // Gravado ANTES de mexer no JSON financeiro: reinício não repete o débito.
        await wr.child(`debits/${uid}`).set({status:'processing',at:Date.now()});
        try{await economy.delkoin(jid,bet)}catch(e){
          await wr.update({status:'review',error:'Falha ao debitar carteira; reconciliação manual obrigatória.',reviewAt:Date.now()}).catch(()=>{});
          throw new Error('Aposta em análise financeira. Nenhum novo débito deve ser tentado.');
        }
        await wr.child(`debits/${uid}`).update({status:'done',finishedAt:Date.now()}).catch(e=>{
          throw new Error(`Débito aplicado, mas registro pendente: ${e.message}`);
        });
      }
      await wr.update({status:'active',preparedAt:Date.now()});
      return{amount:bet,pot:bet*2,settled:false};
    });
  }
  async function settleGameWager(gameId,winnerUid=null){
    const wr=rtdb.ref(`gameWagers/${gameId}`),snapshot=(await wr.once('value')).val();
    if(!snapshot)return null;
    const uids=Object.keys(snapshot.players||{}),amount=Number(snapshot.amount||0);
    if(winnerUid&&!uids.includes(winnerUid))throw new Error('Vencedor não pertence à partida.');
    if(!amount)return snapshot;
    if(snapshot.status!=='active'){
      if(snapshot.status==='done'||snapshot.settled)return snapshot;
      throw new Error('Liquidação dessa aposta exige conferência financeira.');
    }
    const jids={};for(const uid of uids){jids[uid]=await linkedJidByUid(uid);if(!jids[uid])throw new Error('A carteira de um jogador foi desvinculada; requer conferência.');}
    return withExclusiveKeys(walletLocks,Object.values(jids),async()=>{
      const claim=await wr.transaction(v=>{
        if(!v||v.status!=='active'||v.settled)return;
        return{...v,status:'settling',winnerUid:winnerUid||null,settlementStartedAt:Date.now()};
      },undefined,false);
      if(!claim.committed)return null;
      const payouts=winnerUid?[[winnerUid,amount*2]]:uids.map(uid=>[uid,amount]);
      for(const [uid,value] of payouts){
        // A liquidação só é concluída DEPOIS de pagar; no caso de queda,
        // permanece bloqueada para reconciliação e nunca paga duas vezes.
        await wr.child(`payouts/${uid}`).set({status:'processing',value,at:Date.now()});
        try{await economy.addkoin(jids[uid],value)}catch(e){
          await wr.update({status:'review',reviewAt:Date.now(),error:'Falha durante pagamento; verificar a carteira.'}).catch(()=>{});
          throw new Error('Prêmio em análise. Não repetir pagamento automaticamente.');
        }
        await wr.child(`payouts/${uid}`).update({status:'done',finishedAt:Date.now()});
      }
      await wr.update({status:'done',settled:true,settledAt:Date.now()});
      for(const uid of uids)await syncAccount(uid,jids[uid]).catch(()=>{});
      return{...claim.snapshot.val(),status:'done',settled:true};
    });
  }

  async function resolveCustomizationItem(itemId){
    const clean=String(itemId||'').trim().toLowerCase();
    if(!clean)return null;
    if(CUSTOMIZATION_CATALOG[clean])return{id:clean,...CUSTOMIZATION_CATALOG[clean],source:'static'};
    const sn=await rtdb.ref(`siteStoreCatalog/${clean}`).once('value').catch(()=>null),raw=sn?.val?.();
    if(!raw||typeof raw!=='object'||raw.active===false)return null;
    const slot=['cover','decor','frame','effect','name','aura','badge','theme'].includes(String(raw.slot||''))?String(raw.slot):'';
    const price=Math.max(0,Math.floor(Number(raw.price||0)));
    if(!slot||!String(raw.name||'').trim())return null;
    return{id:clean,name:String(raw.name).trim().slice(0,60),price,slot,mediaUrl:String(raw.mediaUrl||'').trim().slice(0,1200),mediaKind:String(raw.mediaKind||'').trim().slice(0,20),source:'remote'};
  }

  async function maybeForwardSiteNoticeToWhatsApp(uid,{type='info',title='Gremory',text='',link=''}={}){
    try{
      // Raids já possuem preferência e fluxo próprios para evitar aviso duplicado.
      if(String(type||'')==='pokemon_raid')return false;
      const profile=(await rtdb.ref(`profiles/${uid}`).once('value').catch(()=>null))?.val?.()||{};
      if(profile.whatsappSiteNotify===false)return false;
      const jid=await linkedJidByUid(uid);if(!jid)return false;
      const rawLink=String(link||'').trim();
      const finalLink=rawLink.startsWith('#')?`${siteOrigin}/${rawLink}`:(/^https?:\/\//i.test(rawLink)?rawLink:'');
      const body=[`🔔 *${String(title||'Gremory').slice(0,80)}*`,String(text||'').slice(0,700),finalLink].filter(Boolean).join('\n\n');
      await sendWhats(jid,body);return true;
    }catch(e){logger.log('[SITE BRIDGE] aviso WhatsApp:',e.message);return false}
  }

  async function notifySite(uid,{type='info',title='Gremory',text='',link='',sound=true,imageUrl=''}={}){
    if(!uid)return null;
    const cleanType=String(type||'info').slice(0,60),cleanTitle=String(title||'Gremory').slice(0,80),cleanText=String(text||'').slice(0,800),cleanLink=String(link||'').slice(0,300),cleanImage=String(imageUrl||'').trim().slice(0,1000),createdAt=Date.now();
    // Evita gravar a mesma notificação duas vezes quando dois fluxos concluem quase juntos.
    try{
      const recent=await rtdb.ref(`siteNotifications/${uid}`).orderByChild('createdAt').startAt(createdAt-30000).once('value');
      for(const [key,value] of Object.entries(recent.val()||{})){
        if(String(value?.type||'')===cleanType&&String(value?.title||'')===cleanTitle&&String(value?.text||'')===cleanText&&String(value?.link||'')===cleanLink&&String(value?.imageUrl||'')===cleanImage)return key;
      }
    }catch{}
    const nref=rtdb.ref(`siteNotifications/${uid}`).push();
    await nref.set({id:nref.key,type:cleanType,title:cleanTitle,text:cleanText,link:cleanLink,imageUrl:cleanImage,sound:!!sound,createdAt});
    await maybeForwardSiteNoticeToWhatsApp(uid,{type:cleanType,title:cleanTitle,text:cleanText,link:cleanLink}).catch(()=>{});
    return nref.key;
  }
  async function siteUserUids(){
    const [profilesSnap,directorySnap]=await Promise.all([
      rtdb.ref('profiles').once('value').catch(()=>null),
      rtdb.ref('directory').once('value').catch(()=>null)
    ]);
    return [...new Set([
      ...Object.keys(profilesSnap?.val?.()||{}),
      ...Object.keys(directorySnap?.val?.()||{})
    ].filter(Boolean))];
  }

  async function notifyAllSiteUsers({title='Aviso da Gremory',text='',imageUrl='',type='admin_notice',link='',postId='',notificationId=''}={}){
    const cleanText=String(text||'').trim().slice(0,800);
    const cleanImage=String(imageUrl||'').trim().slice(0,1000);
    if(!cleanText&&!cleanImage)throw new Error('Escreva o texto da notificação ou envie uma imagem.');

    const uids=await siteUserUids();
    if(!uids.length)throw new Error('Nenhum usuário cadastrado no site foi encontrado.');

    const broadcastId=String(notificationId||'').trim()||id('notice');
    const createdAt=Date.now();
    const payloadBase={
      type:String(type||'admin_notice').slice(0,60),
      title:String(title||'Aviso da Gremory').slice(0,80),
      text:cleanText||'Novo aviso da Gremory.',
      imageUrl:cleanImage,
      link:String(link||'').trim().slice(0,300),
      postId:String(postId||'').trim().slice(0,160),
      sound:true,
      createdAt
    };

    // Grava em lotes para não fazer uma requisição separada por usuário.
    let sent=0;
    for(let i=0;i<uids.length;i+=150){
      const patch={};
      for(const uid of uids.slice(i,i+150)){
        patch[`siteNotifications/${uid}/${broadcastId}`]={id:broadcastId,...payloadBase};
        sent++;
      }
      await rtdb.ref().update(patch);
    }
    // Usuários que ativaram "avisos do site no WhatsApp" recebem o mesmo broadcast pela Charlotte.
    let whatsappSent=0;
    for(const uid of uids){
      if(await maybeForwardSiteNoticeToWhatsApp(uid,payloadBase).catch(()=>false))whatsappSent++;
      if(whatsappSent&&whatsappSent%20===0)await new Promise(r=>setTimeout(r,250));
    }
    return{sent,broadcastId,whatsappSent};
  }

  function addPokemonXpRaw(mon,amount){
    ensureMon(mon);let gained=Math.max(0,Math.floor(Number(amount||0))),levels=0;mon.xp=Math.max(0,Number(mon.xp||0))+gained;
    const need=lvl=>Math.max(80,Number(lvl||1)*100);
    while(mon.xp>=need(mon.level)&&Number(mon.level||1)<100){
      mon.xp-=need(mon.level);mon.level=Number(mon.level||1)+1;levels++;
      mon.maxHp=Number(mon.maxHp||1)+5;mon.hpAtual=Math.min(mon.maxHp,Number(mon.hpAtual||mon.maxHp)+5);
      mon.attack=Number(mon.attack||mon.ataque||80)+2;mon.ataque=mon.attack;
      mon.defense=Number(mon.defense||mon.defesa||80)+2;mon.defesa=mon.defense;
    }
    return{gained,levels};
  }
  async function uploadImageFromMessage(info){
    const direct=info?.message?.imageMessage;
    const quoted=info?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const imageMessage=direct||quoted;if(!imageMessage)return'';
    try{
      const baileys=safeRequire('baileys')||safeRequire('@whiskeysockets/baileys');
      if(!baileys?.downloadContentFromMessage)return'';
      const stream=await baileys.downloadContentFromMessage(imageMessage,'image');let buffer=Buffer.alloc(0);
      for await(const chunk of stream)buffer=Buffer.concat([buffer,chunk]);
      if(!buffer.length)return'';
      const FormData=safeRequire('form-data'),axiosMod=safeRequire('axios');if(!FormData||!axiosMod)return'';
      const axios=axiosMod.default||axiosMod,form=new FormData();form.append('reqtype','fileupload');form.append('fileToUpload',buffer,{filename:`gremory_${Date.now()}.jpg`,contentType:'image/jpeg'});
      const response=await axios.post('https://catbox.moe/user/api.php',form,{headers:form.getHeaders(),timeout:30000,maxBodyLength:12*1024*1024});
      const url=String(response.data||'').trim();return /^https?:\/\//i.test(url)?url:'';
    }catch(e){logger.log('[SITE BRIDGE] imagem da atualização:',e.message);return''}
  }
  async function announceCommunityPost(uid,postId){
    if(uid&&!await siteAdmin(uid))throw new Error('Apenas o dono pode avisar os grupos.');
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(String(postId||'')))throw new Error('Publicação inválida.');
    const post=(await rtdb.ref(`communityPosts/${postId}`).once('value')).val();if(!post)throw new Error('Publicação não encontrada.');
    const groups=[...new Set(String(process.env.GREMORY_FEED_GROUPS||'').split(',').map(x=>x.trim()).filter(x=>/^[0-9-]+@g\.us$/.test(x)))];
    if(!groups.length)throw new Error('Configure GREMORY_FEED_GROUPS no bot com os grupos autorizados.');
    const receipt=rtdb.ref(`communityAnnouncements/${postId}`);
    const claim=await receipt.transaction(v=>v?undefined:{startedAt:Date.now()});if(!claim.committed)throw new Error('Este aviso já foi iniciado. Consulte o registro antes de reenviar.');
    let sent=0,failed=[];for(const jid of groups){try{await sock.sendMessage(jid,{text:`📰 Nova publicação na Gremory

${String(post.text||'Foto ou vídeo publicado.').slice(0,1000)}

${siteOrigin}/#feed`});sent++;await receipt.child('sent').child(jid.replace(/[^a-zA-Z0-9_-]/g,'_')).set(true)}catch(e){failed.push(jid);logger.log('[FEED] envio:',e.message)}}
    await receipt.update({finishedAt:Date.now(),count:sent,failed});return{sent,failed};
  }
  async function publishUpdate({text='',imageUrl='',author='Charlotte'}={}){
    const clean=String(text||'').trim();if(!clean&&!imageUrl)throw new Error('Escreva o texto da atualização.');
    const uref=rtdb.ref('siteUpdates').push();const payload={id:uref.key,text:clean.slice(0,1800),imageUrl:String(imageUrl||'').trim().slice(0,1000),author:String(author||'Charlotte').slice(0,80),createdAt:Date.now()};
    await uref.set(payload);return payload;
  }

  async function processDueHealingJobs(){
    const jobs=readJson(healingPath,{});let changed=false;const syncAfter=[];
    for(const[jid,byMon]of Object.entries(jobs||{}))for(const[monUid,job]of Object.entries(byMon||{})){
      if(Number(job.readyAt||0)>Date.now())continue;
      try{const{db,user}=pokemonState(jid),mon=findMon(user,monUid);if(mon){healRaw(mon);savePokemonDb(db)}const uid=job.siteUid||await linkedUidByJid(jid).catch(()=>null);if(uid){await rtdb.ref(`pokemonHealing/${uid}/${monUid}`).remove().catch(()=>{});syncAfter.push([uid,jid])}delete jobs[jid][monUid];if(!Object.keys(jobs[jid]||{}).length)delete jobs[jid];changed=true;}catch(e){logger.log('[SITE BRIDGE] cura:',e.message)}
    }
    if(changed)writeJson(healingPath,jobs);
    for(const[uid,jid]of syncAfter)await syncAccount(uid,jid).catch(()=>{});
  }
  async function syncPokemon(uid,jid){await processDueHealingJobs().catch(()=>{});const{user}=pokemonState(jid);const pokemon=publicPokemonUser(user);await rtdb.ref(`charlotteSync/${uid}`).update({pokemon,updatedAt:now()});return pokemon;}
  function safeEconomyRaw(jid){
    try{
      if(typeof economy.getRegUser==='function'){
        const raw=economy.getRegUser(cleanJid(jid));
        return raw&&typeof raw==='object'?JSON.parse(JSON.stringify(raw)):null
      }
    }catch{}
    return null
  }
  async function backupAccountSnapshot(uid,jid,account,force=false){
    if(backupRecoveryRequired)return null;
    if(!uid||!jid||!account)return null;
    if(backupInFlight.has(uid))return backupInFlight.get(uid);
    const task=(async()=>{
      const dir=(await rtdb.ref(`directory/${uid}`).once('value').catch(()=>null))?.val?.()||{};
      const snapshot={version:1,uid,whatsappJid:cleanJid(jid),identity:{name:String(dir.nome||'').slice(0,60),username:String(dir.username||'').slice(0,30)},account:{registered:!!account.registered,balance:Number(account.balance||0),level:Number(account.level||0),xp:Number(account.xp||0),messages:Number(account.messages||0),premium:!!account.premium},economyRaw:safeEconomyRaw(jid),backedAt:now()};
      const hash=crypto.createHash('sha256').update(JSON.stringify({identity:snapshot.identity,account:snapshot.account,economyRaw:snapshot.economyRaw})).digest('hex');
      const refBackup=rtdb.ref(`economyBackups/${uid}`),prevSn=await refBackup.once('value').catch(()=>null),prev=prevSn?.val?.()||{};
      const changed=prev.hash!==hash,lastBlobAt=Number(prev.lastBlobAt||0),blobDue=Date.now()-lastBlobAt>24*60*60*1000;
      if(changed||force)await refBackup.update({hash,snapshot,updatedAt:Date.now()});
      if(backupSecret&&(changed||blobDue||force)){
        try{
          const resp=await fetch(`${siteOrigin}/api/main?action=account_backup_put`,{method:'POST',headers:{'content-type':'application/json','x-gremory-backup-secret':backupSecret},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(12000)});
          if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
          await refBackup.update({lastBlobAt:Date.now(),blobOk:true});
        }catch(e){await refBackup.update({blobOk:false,blobError:String(e.message||e).slice(0,160)}).catch(()=>{});logger.log('[ACCOUNT BACKUP]',e.message)}
      }
      return snapshot
    })().finally(()=>backupInFlight.delete(uid));backupInFlight.set(uid,task);return task
  }
  async function fetchAccountBackup(uid){
    if(backupSecret){
      try{
        const r=await fetch(`${siteOrigin}/api/main?action=account_backup_get&uid=${encodeURIComponent(uid)}`,{headers:{'x-gremory-backup-secret':backupSecret},signal:AbortSignal.timeout(12000)});
        if(r.ok){const j=await r.json();if(j?.snapshot)return j.snapshot}
      }catch(e){logger.log('[ACCOUNT BACKUP GET]',e.message)}
    }
    const sn=await rtdb.ref(`economyBackups/${uid}/snapshot`).once('value');return sn.val()||null
  }
  async function syncIdentity(uid,jid,data){
    const name=String(data.name||'').trim().slice(0,60),username=String(data.username||'').trim().toLowerCase().replace(/^@+/,'').slice(0,30);
    await rtdb.ref(`charlotteSync/${uid}/identity`).set({name,username,updatedAt:now()});
    // Mantém o nome do Tinder alinhado se já existir.
    const rows=readJson(tinderPath,[]);if(Array.isArray(rows)){const i=rows.findIndex(p=>sameUser(p?.jid,jid));if(i>=0){rows[i].nome=name||rows[i].nome;writeJson(tinderPath,rows)}}
    const account={registered:registeredFor(jid),balance:balanceFor(jid),...readLevel(jid),premium:readPremium(jid).active};
    await backupAccountSnapshot(uid,jid,account,true).catch(()=>{});return{identity:{name,username},account}
  }
  async function syncAccount(uid,jid){if(backupRestartRequired)throw new Error('Backup restaurado; reinicie a Charlotte para carregar os JSONs.');const pokemon=await syncPokemon(uid,jid).catch(()=>null),lvl=readLevel(jid),prem=readPremium(jid),ach=readAchievements(jid),account={registered:registeredFor(jid),balance:balanceFor(jid),level:lvl.level,xp:lvl.xp,messages:lvl.messages,premium:prem.active};const patch={account,achievements:ach,updatedAt:now()};if(pokemon)patch.pokemon=pokemon;await rtdb.ref(`charlotteSync/${uid}`).update(patch);backupAccountSnapshot(uid,jid,account,false).catch(()=>{});return{account,achievements:ach,pokemon};}
  async function findLinkCode(code){const snap=await rtdb.ref('charlotteLinkRequests').orderByChild('code').equalTo(String(code||'').trim().toUpperCase()).once('value');for(const[uid,req]of Object.entries(snap.val()||{}))if(Number(req.expiresAt||0)>=Date.now())return{uid,req};return null;}
  async function linkAccount(code,sender){
    const found=await findLinkCode(code);if(!found)throw new Error('Código inválido ou expirado. Gere outro no site.');
    const jid=cleanJid(sender);
    // Um WhatsApp só pode apontar para uma conta do site. Ao confirmar um novo
    // código pelo próprio número, removemos vínculos antigos duplicados sem
    // tocar em economiaBackups nem nos arquivos reais da Charlotte.
    const dupSn=await rtdb.ref('charlottePrivate').orderByChild('whatsappJid').equalTo(jid).once('value').catch(()=>null);
    for(const otherUid of Object.keys(dupSn?.val?.()||{})){
      if(otherUid===found.uid)continue;
      await Promise.all([
        rtdb.ref(`charlottePrivate/${otherUid}`).remove().catch(()=>{}),
        rtdb.ref(`charlottePublic/${otherUid}`).set({status:'unlinked',unlinkedAt:now(),reason:'relinked_elsewhere'}).catch(()=>{}),
        rtdb.ref(`charlotteSync/${otherUid}`).remove().catch(()=>{}),
        rtdb.ref(`charlotteLinkRequests/${otherUid}`).remove().catch(()=>{})
      ]);
    }
    await rtdb.ref(`charlottePrivate/${found.uid}`).set({whatsappJid:jid,linkedAt:now()});
    await rtdb.ref(`charlottePublic/${found.uid}`).set({status:'linked',whatsappMasked:maskJid(jid),linkedAt:now()});
    await rtdb.ref(`charlotteLinkRequests/${found.uid}`).remove();
    try{await syncAccount(found.uid,jid)}catch(e){logger.log('[SITE BRIDGE] sync inicial:',e.message)}
    return found.uid;
  }
  async function reciprocalFriends(a,b){const[x,y]=await Promise.all([rtdb.ref(`friends/${a}/${b}`).once('value'),rtdb.ref(`friends/${b}/${a}`).once('value')]);return x.exists()&&y.exists();}

  async function startHealing(uid,jid,monUid){
    await processDueHealingJobs().catch(()=>{});
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes do hospital.');
    const{db,user}=pokemonState(jid),mon=findMon(user,monUid);if(!mon)throw new Error('Pokémon não encontrado.');
    ensureMon(mon);if(Number(mon.hpAtual||0)>=Number(mon.maxHp||1))throw new Error('Esse Pokémon já está com o HP completo.');
    const jobs=readJson(healingPath,{});jobs[jid]=jobs[jid]||{};const existing=jobs[jid][mon.uid];
    if(existing&&Number(existing.readyAt)>Date.now())return{alreadyHealing:true,cost:Number(existing.cost||HEAL_COST),readyAt:existing.readyAt,name:mon.nome||mon.name||'Pokémon',premium:!!existing.premium};
    const balance=balanceFor(jid);if(balance<HEAL_COST)throw new Error(`Você precisa de ₹${HEAL_COST}. Saldo: ₹${balance}.`);
    if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
    await economy.delkoin(jid,HEAL_COST);
    const premium=readPremium(jid).active,durationMs=premium?HEAL_MS_PREMIUM:HEAL_MS_FREE,readyAt=Date.now()+durationMs;
    mon.healingUntil=readyAt;savePokemonDb(db);
    const job={jid,siteUid:uid||null,monUid:mon.uid,name:mon.nome||mon.name||'Pokémon',cost:HEAL_COST,premium,durationMs,startedAt:Date.now(),readyAt};
    jobs[jid][mon.uid]=job;writeJson(healingPath,jobs);
    if(uid)await rtdb.ref(`pokemonHealing/${uid}/${mon.uid}`).set(job);
    if(uid)await syncAccount(uid,jid).catch(()=>{});
    return{alreadyHealing:false,cost:HEAL_COST,readyAt,name:job.name,premium,durationMs};
  }
  async function processHealStart(uid,jid,data){return startHealing(uid,jid,String(data.monUid||''));}
  async function processPokemonUsePotion(uid,jid,data){
    const monUid=String(data.monUid||'').trim();if(!monUid)throw new Error('Pokémon inválido.');
    const{db,user}=pokemonState(jid),mon=findMon(user,monUid);if(!mon)throw new Error('Pokémon não encontrado.');ensureMon(mon);
    if(Number(mon.healingUntil||0)>Date.now())throw new Error('Esse Pokémon está no Hospital.');
    if(mon.fainted||Number(mon.hpAtual||0)<=0)throw new Error('Pokémon desmaiado precisa do Hospital.');
    if(Number(mon.hpAtual||0)>=Number(mon.maxHp||1))throw new Error('Esse Pokémon já está com o HP completo.');
    user.items=user.items&&typeof user.items==='object'?user.items:{};
    const qty=Math.max(0,Number(user.items.potion||user.items.pocao||0));if(qty<1)throw new Error('Você não possui Poções.');
    if(user.items.potion==null&&user.items.pocao!=null)user.items.potion=Number(user.items.pocao||0);
    user.items.potion=Math.max(0,Number(user.items.potion||0)-1);if(user.items.pocao!=null)user.items.pocao=user.items.potion;
    const before=Number(mon.hpAtual||0),heal=Math.max(30,Math.floor(Number(mon.maxHp||1)*0.35));mon.hpAtual=Math.min(Number(mon.maxHp||1),before+heal);mon.fainted=false;
    savePokemonDb(db);await syncAccount(uid,jid).catch(()=>{});
    return{name:mon.nome||mon.name||'Pokémon',healed:Math.max(0,Number(mon.hpAtual)-before),hp:Number(mon.hpAtual),maxHp:Number(mon.maxHp),potions:Number(user.items.potion||0)};
  }
  async function processPokemonBuyPotion(uid,jid,data){
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de comprar itens.');
    const qty=Math.max(1,Math.min(25,Math.floor(Number(data.quantity||1)))),unitPrice=80,total=qty*unitPrice,balance=balanceFor(jid);
    if(balance<total)throw new Error(`Saldo insuficiente. ${qty} Poção${qty===1?'':'ões'} custa ₹${total}.`);
    if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');await economy.delkoin(jid,total);
    const{db,user}=pokemonState(jid);user.items=user.items&&typeof user.items==='object'?user.items:{};user.items.potion=Math.max(0,Number(user.items.potion||user.items.pocao||0))+qty;if(user.items.pocao!=null)user.items.pocao=user.items.potion;savePokemonDb(db);
    try{await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_gasto',qtd:total})}catch{}
    await syncAccount(uid,jid).catch(()=>{});return{quantity:qty,unitPrice,total,potions:Number(user.items.potion||0),balance:balanceFor(jid)};
  }
  async function processSetTeam(uid,jid,data){const ids=[...new Set((Array.isArray(data.teamUids)?data.teamUids:[]).map(String).filter(Boolean))].slice(0,6);if(!ids.length)throw new Error('Escolha pelo menos um Pokémon.');const{db,user}=pokemonState(jid),all=new Map(user.monsters.map(m=>[String(m.uid),m]));for(const x of ids)if(!all.has(x))throw new Error('Um Pokémon da equipe não existe mais.');user.party=ids;user.activeUid=ids[0];user.active=Math.max(0,user.monsters.findIndex(m=>String(m.uid)===ids[0]));savePokemonDb(db);return{pokemon:await syncPokemon(uid,jid),teamUids:ids};}

  async function processExplore(uid,jid){await processDueHealingJobs().catch(()=>{});const old=await rtdb.ref(`pokemonSiteEncounter/${uid}`).once('value');if(old.exists()&&Number(old.val()?.expiresAt||0)>Date.now()&&old.val()?.status!=='finished')return{encounter:old.val(),reused:true};const meta=await rtdb.ref(`pokemonSiteMeta/${uid}/lastExplore`).once('value');const exploreCooldown=readPremium(jid).active?8000:15000;if(Date.now()-Number(meta.val()||0)<exploreCooldown)throw new Error('Aguarde alguns segundos para explorar de novo.');const{user}=pokemonState(jid),mine=firstHealthy(user);if(!mine)throw new Error('Sua equipe está toda desmaiada. Use o Hospital Pokémon.');if(!sortearSelvagem)throw new Error('Sistema de exploração Pokémon não disponível.');const raw=await sortearSelvagem(true),wild=publicMon(raw||{});if(!wild.uid)wild.uid=id('wild');wild.hp=wild.maxHp;wild.fainted=false;const encounter={id:id('enc'),status:'battle',mon:wild,player:publicMon(mine),createdAt:now(),expiresAt:Date.now()+10*60*1000,log:{}};await Promise.all([rtdb.ref(`pokemonSiteEncounter/${uid}`).set(encounter),rtdb.ref(`pokemonSiteMeta/${uid}/lastExplore`).set(Date.now())]);return{encounter};}
  function calcDamage(attacker,defender,move){return damageDetail(attacker,defender,move).dano;}
  function calcDamageDetailed(attacker,defender,move,opts={}){return damageDetail(attacker,defender,move,opts);}
  async function processWildMove(uid,jid,data){const er=rtdb.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())throw new Error('Explore primeiro.');const e=sn.val();if(e.status!=='battle'||Number(e.expiresAt||0)<Date.now())throw new Error('Esse encontro terminou.');const{db,user}=pokemonState(jid);let mine=findMon(user,e.player?.uid);if(!mine||mine.fainted||Number(mine.hpAtual)<=0)mine=firstHealthy(user);if(!mine)throw new Error('Sua equipe está desmaiada.');let minePub=publicMon(mine),wild={...e.mon};const moves=minePub.moves.length?minePub.moves:[{name:'Ataque rápido',power:40},{name:'Investida',power:45}],move=moves[clamp(data.moveIndex,0,moves.length-1)]||moves[0],hit=calcDamageDetailed(minePub,wild,move),damage=hit.dano;wild.hp=Math.max(0,Number(wild.hp||wild.maxHp)-damage);let text=`${minePub.name} usou ${move.name} (${typeName(move.type)}) e causou ${damage} de dano${hit.effectText?` • ${hit.effectText}`:''}.`;let reward=0;if(wild.hp<=0){wild.fainted=true;reward=crypto.randomInt(45,121);if(readPremium(jid).active)reward=Math.floor(reward*1.25);if(typeof economy.addkoin==='function')await economy.addkoin(jid,reward);const xpReward=crypto.randomInt(20,46);addPokemonXpRaw(mine,xpReward);e.reward={rupias:reward,pokemonXp:xpReward,premium:readPremium(jid).active};e.status='finished';e.result='victory';e.finishedAt=now();text+=` ${wild.name} desmaiou. +₹${reward}.`;e.expiresAt=Date.now()+60000;}else{const wildMoves=wild.moves?.length?wild.moves:[{name:'Investida',power:40}],wm=wildMoves[crypto.randomInt(0,wildMoves.length)],counterHit=calcDamageDetailed(wild,minePub,wm),counter=counterHit.dano;mine.hpAtual=Math.max(0,Number(mine.hpAtual||mine.maxHp)-counter);if(mine.hpAtual<=0){faintRaw(mine,'selvagem');text+=` ${wild.name} usou ${wm.name} (${typeName(wm.type)}) e causou ${counter}${counterHit.effectText?` • ${counterHit.effectText}`:''}. ${minePub.name} desmaiou.`;const next=firstHealthy(user);if(next){mine=next;minePub=publicMon(next);text+=` Você enviou ${minePub.name}.`;await setBotActive(jid,next.uid)}else{e.status='finished';e.result='defeat';e.finishedAt=now();e.expiresAt=Date.now()+60000;text+=' Sua equipe inteira desmaiou.'}}else{text+=` ${wild.name} usou ${wm.name} (${typeName(wm.type)}) e causou ${counter}${counterHit.effectText?` • ${counterHit.effectText}`:''}.`;}}savePokemonDb(db);e.mon=wild;e.player=publicMon(mine);e.updatedAt=now();e.log=e.log||{};e.log[id('log')]={text,at:now()};await er.set(e);await syncAccount(uid,jid).catch(()=>{});return{encounter:e,reward};}
  async function processWildExit(uid){const er=rtdb.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())return{left:true};const e=sn.val()||{};e.status='finished';e.result='escaped';e.finishedAt=now();e.expiresAt=Date.now()+15000;e.updatedAt=now();e.log=e.log||{};e.log[id('log')]={text:'Você fugiu do encontro selvagem.',at:now()};await er.set(e);return{left:true};}
  async function processCapture(uid,jid,data){const er=rtdb.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())throw new Error('Explore primeiro.');const e=sn.val();if(Number(e.expiresAt||0)<Date.now()||e.status==='finished')throw new Error('Esse encontro terminou.');const ball=String(data.ball||'pokebola').toLowerCase(),allowed=new Set(['pokebola','greatball','ultraball','premierball']);if(!allowed.has(ball))throw new Error('Pokébola inválida.');const{db,user}=pokemonState(jid);user.items=user.items||{};if(Number(user.items[ball]||0)<=0)throw new Error(`Você não possui ${ball}.`);user.items[ball]=Number(user.items[ball])-1;const wild=e.mon||{},hpRate=Number(wild.hp||wild.maxHp)/Math.max(1,Number(wild.maxHp||1)),base=32+Math.round((1-hpRate)*38),bonus=ball==='greatball'?15:ball==='ultraball'?30:ball==='premierball'?38:0,chance=Math.max(5,Math.min(92,base+bonus)),captured=crypto.randomInt(1,101)<=chance;if(captured){const mon={uid:id('pk'),dex:wild.dex,nome:wild.name,level:wild.level,shiny:!!wild.shiny,maxHp:wild.maxHp,hpAtual:wild.maxHp,fainted:false,attack:wild.attack,defense:wild.defense,sprite:wild.sprite,types:wild.types,moves:wild.moves};user.monsters.push(mon);if(!Array.isArray(user.party)||user.party.length<6){user.party=Array.isArray(user.party)?user.party:[];user.party.push(mon.uid)}await er.remove();}else{e.updatedAt=now();e.log=e.log||{};e.log[id('log')]={text:`A ${ball} falhou. ${wild.name} escapou.`,at:now()};await er.set(e)}savePokemonDb(db);await syncAccount(uid,jid).catch(()=>{});return{captured,chance,pokemon:captured?wild:null};}

  function teamForJid(jid){const{user}=pokemonState(jid);return orderedTeamRaw(user).map(publicMon);}
  function currentDuelMon(player){const team=Array.isArray(player.team)?player.team:[];return team.find(m=>String(m.uid)===String(player.currentUid))||team[Math.max(0,Number(player.activeIndex||0))]||team[0]||null;}
  async function persistMonState(jid,pub){const{db,user}=pokemonState(jid),mon=findMon(user,pub.uid);if(mon){ensureMon(mon);mon.hpAtual=clamp(pub.hp,0,mon.maxHp);if(mon.hpAtual<=0)faintRaw(mon,'duelo_site');else{mon.fainted=false;mon.faintedAt=null;mon.faintedReason=null;}savePokemonDb(db)}}
  async function setBotActive(jid,monUid){const{db,user}=pokemonState(jid),idx=user.monsters.findIndex(m=>String(m.uid)===String(monUid));if(idx>=0){user.active=idx;user.activeUid=user.monsters[idx].uid;savePokemonDb(db)}}
  async function processChallenge(uid,data){const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Amigo inválido.');if(!(await reciprocalFriends(uid,targetUid)))throw new Error('O duelo só pode ser enviado para um amigo confirmado.');const[fromJid,targetJid,fromDir,targetDir]=await Promise.all([linkedJidByUid(uid),linkedJidByUid(targetUid),rtdb.ref(`directory/${uid}`).once('value'),rtdb.ref(`directory/${targetUid}`).once('value')]);if(!fromJid)throw new Error('Sua Charlotte não está vinculada.');if(!targetJid)throw new Error('Seu amigo ainda não vinculou a Charlotte.');if(!teamForJid(fromJid).some(m=>m.hp>0&&!m.fainted))throw new Error('Sua equipe está desmaiada.');if(!teamForJid(targetJid).some(m=>m.hp>0&&!m.fainted))throw new Error('A equipe do seu amigo está desmaiada.');const challengeId=id('duel'),fromName=fromDir.val()?.nome||'Treinador';await rtdb.ref(`pokemonSiteChallenges/${targetUid}/${challengeId}`).set({id:challengeId,fromUid:uid,fromName,createdAt:now()});await notifySite(targetUid,{type:'pokemon_duel',title:'Novo desafio Pokémon',text:`${fromName} te desafiou para uma batalha 6x6.`,link:'#pokemon'}).catch(()=>{});await sendWhats(targetJid,`⚔️ ${fromName} te desafiou para uma batalha Pokémon 6x6 no site Gremory.`);await sendWhats(fromJid,`⚔️ Desafio enviado para ${targetDir.val()?.nome||'seu amigo'}.`);return{challengeId};}
  async function processAccept(uid,data){const challengeId=String(data.challengeId||''),cr=rtdb.ref(`pokemonSiteChallenges/${uid}/${challengeId}`),sn=await cr.once('value');if(!sn.exists())throw new Error('Esse desafio não existe mais.');const c=sn.val(),fromUid=c.fromUid;if(!(await reciprocalFriends(uid,fromUid)))throw new Error('Amizade não confirmada.');const[fromJid,toJid,fromDir,toDir]=await Promise.all([linkedJidByUid(fromUid),linkedJidByUid(uid),rtdb.ref(`directory/${fromUid}`).once('value'),rtdb.ref(`directory/${uid}`).once('value')]);if(!fromJid||!toJid)throw new Error('Os dois jogadores precisam vincular a Charlotte.');const teamA=teamForJid(fromJid),teamB=teamForJid(toJid),firstA=teamA.find(x=>x.hp>0&&!x.fainted),firstB=teamB.find(x=>x.hp>0&&!x.fainted);if(!firstA||!firstB)throw new Error('Os dois jogadores precisam ter Pokémon saudáveis.');const duelId=id('webduel'),first=crypto.randomInt(0,2)===0?fromUid:uid,createdAt=now(),duel={id:duelId,status:'active',createdAt,updatedAt:createdAt,turnUid:first,players:{[fromUid]:{uid:fromUid,jid:fromJid,name:fromDir.val()?.nome||'Treinador',team:teamA,currentUid:firstA.uid,activeIndex:teamA.findIndex(x=>x.uid===firstA.uid)},[uid]:{uid,jid:toJid,name:toDir.val()?.nome||'Treinador',team:teamB,currentUid:firstB.uid,activeIndex:teamB.findIndex(x=>x.uid===firstB.uid)}},log:{}};await rtdb.ref(`pokemonSiteDuels/${duelId}`).set(duel);await Promise.all([rtdb.ref(`pokemonSiteDuelIndex/${fromUid}/${duelId}`).set({status:'active',createdAt,updatedAt:createdAt}),rtdb.ref(`pokemonSiteDuelIndex/${uid}/${duelId}`).set({status:'active',createdAt,updatedAt:createdAt}),cr.remove()]);await Promise.all([setBotActive(fromJid,firstA.uid),setBotActive(toJid,firstB.uid)]);return{duelId};}
  async function processDecline(uid,data){const challengeId=String(data.challengeId||''),r=rtdb.ref(`pokemonSiteChallenges/${uid}/${challengeId}`),sn=await r.once('value');if(!sn.exists())return{};const c=sn.val(),fromJid=await linkedJidByUid(c.fromUid);await r.remove();await sendWhats(fromJid,'⚔️ Seu desafio não foi aceito.');return{};}
  async function finishDuel(duelRef,duel,winnerUid,reason='fim'){
    const loserUid=Object.keys(duel.players||{}).find(x=>x!==winnerUid),updatedAt=now();
    let reward=null;
    // Vitória por nocaute recebe recompensa. Desistência não paga para evitar farm.
    if(winnerUid&&reason==='todos_desmaiados'){
      const winnerJid=duel.players?.[winnerUid]?.jid||await linkedJidByUid(winnerUid);
      const premium=readPremium(winnerJid).active,rupias=premium?90:65,trainerXp=premium?55:40,pokemonXp=premium?65:45;
      if(typeof economy.addkoin==='function')await economy.addkoin(winnerJid,rupias);
      if(typeof economy.addXp==='function')await economy.addXp(winnerJid,trainerXp);
      try{
        const{db,user}=pokemonState(winnerJid),active=currentDuelMon(duel.players?.[winnerUid]||{}),mon=findMon(user,active?.uid);
        if(mon){addPokemonXpRaw(mon,pokemonXp);savePokemonDb(db)}
      }catch{}
      reward={rupias,trainerXp,pokemonXp,premium};
      try{await achievements.registrarEventoConquista?.({sender:winnerJid,evento:'pokemon_vitoria',qtd:1})}catch{}
    }
    await duelRef.update({status:'finished',winnerUid,loserUid,finishedAt:updatedAt,updatedAt,finishReason:reason,turnUid:null,reward});
    await Promise.all(Object.keys(duel.players||{}).map(uid=>rtdb.ref(`pokemonSiteDuelIndex/${uid}/${duel.id}`).update({status:'finished',winnerUid,updatedAt,reward:uid===winnerUid?reward:null})));
    for(const uid of Object.keys(duel.players||{})){const jid=duel.players[uid]?.jid||await linkedJidByUid(uid);await syncAccount(uid,jid).catch(()=>{});await notifySite(uid,{type:'pokemon_duel',title:uid===winnerUid?'Vitória Pokémon':'Batalha encerrada',text:uid===winnerUid?(reward?`Você venceu e recebeu ₹${reward.rupias}, ${reward.trainerXp} XP e ${reward.pokemonXp} XP Pokémon.`:'Você venceu a batalha.'):'A batalha Pokémon foi encerrada.',link:'#pokemon'}).catch(()=>{})}
    return{winnerUid,loserUid,reward};
  }
  async function processMove(uid,data){const duelId=String(data.duelId||''),duelRef=rtdb.ref(`pokemonSiteDuels/${duelId}`),sn=await duelRef.once('value');if(!sn.exists())throw new Error('Duelo não encontrado.');const duel={id:duelId,...sn.val()};if(duel.status!=='active')throw new Error('Esse duelo já terminou.');if(duel.turnUid!==uid)throw new Error('Ainda não é sua vez.');const me=duel.players?.[uid];if(!me)throw new Error('Você não participa desse duelo.');const targetUid=Object.keys(duel.players).find(x=>x!==uid),enemy=duel.players[targetUid],attacker=currentDuelMon(me),defender=currentDuelMon(enemy);if(!attacker||attacker.hp<=0||attacker.fainted)throw new Error('Seu Pokémon atual está desmaiado. Troque de Pokémon.');if(!defender)throw new Error('Pokémon adversário inválido.');const moves=attacker.moves?.length?attacker.moves:[{name:'Ataque rápido',power:40},{name:'Investida',power:45}],move=moves[clamp(data.moveIndex,0,moves.length-1)]||moves[0],hit=calcDamageDetailed(attacker,defender,move),damage=hit.dano,nextHp=Math.max(0,Number(defender.hp||defender.maxHp)-damage);defender.hp=nextHp;defender.fainted=nextHp<=0;const patch={updatedAt:now()};const defIndex=enemy.team.findIndex(x=>String(x.uid)===String(defender.uid));patch[`players/${targetUid}/team/${defIndex}/hp`]=nextHp;patch[`players/${targetUid}/team/${defIndex}/fainted`]=defender.fainted;let text=`${me.name}: ${attacker.name} usou ${move.name} (${typeName(move.type)}) e causou ${damage} de dano${hit.effectText?` • ${hit.effectText}`:''}.`;await persistMonState(enemy.jid||await linkedJidByUid(targetUid),defender);if(defender.fainted){text+=` ${defender.name} desmaiou.`;const nextIndex=enemy.team.findIndex(x=>Number(x.hp)>0&&!x.fainted&&String(x.uid)!==String(defender.uid));if(nextIndex<0){patch[`log/${id('log')}`]={text,at:now()};await duelRef.update(patch);await finishDuel(duelRef,duel,uid,'todos_desmaiados');return{damage,nextHp,winnerUid:uid};}patch[`players/${targetUid}/currentUid`]=enemy.team[nextIndex].uid;patch[`players/${targetUid}/activeIndex`]=nextIndex;text+=` ${enemy.name} enviou ${enemy.team[nextIndex].name}.`;await setBotActive(enemy.jid||await linkedJidByUid(targetUid),enemy.team[nextIndex].uid)}patch.turnUid=targetUid;patch[`log/${id('log')}`]={text,at:now()};await duelRef.update(patch);return{damage,nextHp};}
  async function processDuelSwitch(uid,data){const duelId=String(data.duelId||''),dr=rtdb.ref(`pokemonSiteDuels/${duelId}`),sn=await dr.once('value');if(!sn.exists())throw new Error('Duelo não encontrado.');const duel={id:duelId,...sn.val()};if(duel.status!=='active'||duel.turnUid!==uid)throw new Error('Você só pode trocar na sua vez.');const me=duel.players?.[uid],target=me?.team?.find(x=>String(x.uid)===String(data.monUid));if(!target||target.fainted||Number(target.hp)<=0)throw new Error('Escolha um Pokémon saudável.');const targetUid=Object.keys(duel.players).find(x=>x!==uid),idx=me.team.findIndex(x=>String(x.uid)===String(target.uid));await dr.update({[`players/${uid}/currentUid`]:target.uid,[`players/${uid}/activeIndex`]:idx,turnUid:targetUid,updatedAt:now(),[`log/${id('log')}`]:{text:`${me.name} trocou para ${target.name}.`,at:now()}});await setBotActive(me.jid||await linkedJidByUid(uid),target.uid);return{currentUid:target.uid};}
  async function processDuelExit(uid,data){const duelId=String(data.duelId||''),dr=rtdb.ref(`pokemonSiteDuels/${duelId}`),sn=await dr.once('value');if(!sn.exists())return{};const duel={id:duelId,...sn.val()};if(duel.status!=='active')return{};if(!duel.players?.[uid])throw new Error('Você não participa desse duelo.');const winnerUid=Object.keys(duel.players).find(x=>x!==uid);await dr.update({[`log/${id('log')}`]:{text:`${duel.players[uid].name} desistiu da batalha.`,at:now()}});return finishDuel(dr,duel,winnerUid,'desistencia');}

  async function processDaily(uid,jid){if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de coletar o Daily pelo site.');if(typeof mining.checkDayli!=='function'||typeof mining.addDayli!=='function')throw new Error('Sistema Daily não disponível no bot.');if(mining.checkDayli(jid)){const release=Number(mining.timeDayli?.(jid)||Date.now());return{claimed:false,cooldownMs:Math.max(0,release-Date.now()),message:'Você já coletou o Daily. Volte quando o cooldown terminar.'};}await mining.addDayli(jid,24*60*60*1000);const sorte=Math.random()*100;let rupias,rewardName;if(sorte<3){rupias=crypto.randomInt(700,1001);rewardName='JACKPOT DIÁRIO';}else if(sorte<15){rupias=crypto.randomInt(400,601);rewardName='Recompensa de Ouro';}else if(sorte<45){rupias=crypto.randomInt(300,451);rewardName='Recompensa de Prata';}else{rupias=crypto.randomInt(200,301);rewardName='Recompensa Diária';}const xp=crypto.randomInt(20,61);await economy.addkoin(jid,rupias);await economy.addXp(jid,xp);try{await achievements.registrarEventoConquista?.({sender:jid,evento:'daily',qtd:1});await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_ganho',qtd:rupias});}catch{}const balance=balanceFor(jid);await syncAccount(uid,jid).catch(()=>{});return{claimed:true,rewardName,rupias,xp,balance};}
  async function processBuyCustomization(uid,jid,data){
    const itemId=String(data.itemId||'').trim().toLowerCase(),item=await resolveCustomizationItem(itemId);if(!item)throw new Error('Personalização inválida.');
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de usar rúpias no site.');
    const invRef=rtdb.ref(`siteInventory/${uid}/items/${itemId}`),owned=await invRef.once('value');
    if(!owned.exists()){
      const balance=balanceFor(jid);if(balance<item.price)throw new Error(`Saldo insuficiente. Você possui ₹${balance}.`);
      if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
      await economy.delkoin(jid,item.price);try{await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_gasto',qtd:item.price});}catch{}
      await invRef.set({id:itemId,name:item.name,price:item.price,slot:item.slot,mediaUrl:item.mediaUrl||'',mediaKind:item.mediaKind||'',purchasedAt:now()});
    }
    await rtdb.ref(`siteCustomization/${uid}`).update({[`equipped/${item.slot}`]:itemId,active:itemId,updatedAt:now()});
    await syncAccount(uid,jid).catch(()=>{});
    return{itemId,slot:item.slot,price:item.price,balance:balanceFor(jid),alreadyOwned:owned.exists()};
  }
  async function processEquipCustomization(uid,data){
    const itemId=String(data.itemId||'').trim().toLowerCase(),item=await resolveCustomizationItem(itemId);if(!item)throw new Error('Personalização inválida.');
    const owned=await rtdb.ref(`siteInventory/${uid}/items/${itemId}`).once('value');if(!owned.exists())throw new Error('Você ainda não possui essa personalização.');
    await rtdb.ref(`siteCustomization/${uid}`).update({[`equipped/${item.slot}`]:itemId,active:itemId,updatedAt:now()});
    return{itemId,slot:item.slot};
  }
  async function processPremiumCheckout(uid,jid,data){const plan=VIP_PLANS[String(data.plan||'')];if(!plan)throw new Error('Plano Premium inválido.');if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de comprar Premium.');const token=String(process.env.MP_ACCESS_TOKEN||process.env.MERCADO_PAGO_ACCESS_TOKEN||'').trim();if(!token)throw new Error('Mercado Pago não está configurado no bot.');let MercadoPagoConfig,Preference;try{({MercadoPagoConfig,Preference}=require('mercadopago'))}catch{throw new Error('Pacote mercadopago não está instalado no bot.');}const client=new MercadoPagoConfig({accessToken:token}),preference=new Preference(client),orderId=`sitevip_${Date.now()}_${crypto.randomInt(100000,999999)}`,pref=await preference.create({body:{items:[{title:plan.nome,quantity:1,currency_id:'BRL',unit_price:Number(plan.valor)}],external_reference:orderId}}),checkoutUrl=pref?.init_point||pref?.sandbox_init_point;if(!checkoutUrl)throw new Error('Mercado Pago não retornou o link de pagamento.');const orders=readJson(ordersPath,{});orders[cleanJid(jid)]={orderId,sender:cleanJid(jid),plano:String(data.plan),dias:Number(plan.dias),valor:Number(plan.valor),pago:false,status:'pending',criadoEm:Date.now(),origem:'site',siteUid:uid};writeJson(ordersPath,orders);await sendWhats(jid,`💎 Pagamento Premium criado pelo site Gremory.\n${plan.nome} • R$ ${Number(plan.valor).toFixed(2).replace('.',',')}`);return{checkoutUrl,orderId,plan:{days:plan.dias,value:plan.valor,name:plan.nome}};}
  async function processSendDownload(uid,jid,data){
    let url;try{url=new URL(String(data.url||''))}catch{throw new Error('Link de download inválido.')}
    if(!['https:','http:'].includes(url.protocol))throw new Error('Link de download inválido.');
    const title=String(data.title||'Download Gremory').replace(/[\r\n]+/g,' ').slice(0,120);
    const service=String(data.service||'').toLowerCase();
    const requestedName=String(data.filename||'').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,140);
    const requestedMime=String(data.mimetype||'').trim().slice(0,100);
    const audioService=service==='spotify'||service.includes('audio');
    const fallbackExt=service==='apk'?'.apk':audioService?'.m4a':'.mp4';
    const fallbackMime=service==='apk'?'application/vnd.android.package-archive':audioService?'audio/mp4':'video/mp4';
    const safeTitle=title.replace(/[^a-zA-Z0-9._ -]+/g,'').trim()||'gremory-download';
    const fileName=requestedName||`${safeTitle}${safeTitle.includes('.')?'':fallbackExt}`;
    const mime=requestedMime||fallbackMime;

    // O WhatsApp precisa receber a mídia, não a URL temporária da API.
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
    let resp;
    try{
      resp=await fetch(url.toString(),{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0'}});
      if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
      const len=Number(resp.headers.get('content-length')||0);
      if(len>65*1024*1024)throw new Error('Arquivo maior que 65 MB.');
      const ab=await resp.arrayBuffer();const buffer=Buffer.from(ab);
      if(!buffer.length)throw new Error('A mídia veio vazia.');
      if(buffer.length>65*1024*1024)throw new Error('Arquivo maior que 65 MB.');

      if(service==='tiktok'||service==='instagram'||service==='facebook'||mime.startsWith('video/')){
        await sock.sendMessage(jid,{video:buffer,mimetype:mime.startsWith('video/')?mime:'video/mp4',caption:`✅ ${title}`});
      }else if(audioService||mime.startsWith('audio/')){
        await sock.sendMessage(jid,{audio:buffer,mimetype:mime.startsWith('audio/')?mime:'audio/mp4',fileName});
      }else{
        await sock.sendMessage(jid,{document:buffer,fileName,mimetype:mime,caption:`📥 ${title}`});
      }
    }catch(e){
      throw new Error(`Não consegui enviar a mídia no WhatsApp: ${e.name==='AbortError'?'tempo esgotado':e.message}`);
    }finally{clearTimeout(timer)}
    try{
      const evento=service==='apk'?'download_app':audioService?'download_audio':'download_video';
      await achievements.registrarEventoConquista?.({sender:jid,evento,qtd:1})
    }catch{}
    return{sent:true,sentAsFile:true,fileName,mimetype:mime};
  }

  async function processYoutubeDownload(uid,jid,data){
    const input=String(data.input||'').trim();
    const mode=String(data.mode||'video').toLowerCase()==='audio'?'audio':'video';
    if(!input)throw new Error('Nome ou link do YouTube obrigatório.');

    fs.mkdirSync(downloadDir,{recursive:true});
    const {execFile}=require('child_process');
    const target=/^https?:\/\//i.test(input)?input:`ytsearch1:${input}`;
    const stamp=`site_${Date.now()}_${crypto.randomInt(1000,9999)}`;
    const template=path.join(downloadDir,`${stamp}.%(ext)s`);

    const mediaArgs = mode==='audio'
      ? ['-x','--audio-format','mp3','--audio-quality','0']
      : ['-f','bv*[ext=mp4][vcodec^=avc1][height<=720]+ba[ext=m4a]/b[ext=mp4][height<=720]/best[height<=720]','--merge-output-format','mp4','--recode-video','mp4'];

    const common=['--no-playlist','--js-runtimes','node','--remote-components','ejs:github'];
    const run=(args)=>new Promise(resolve=>execFile('yt-dlp',args,{maxBuffer:1024*1024*30,timeout:180000,windowsHide:true},(err,stdout,stderr)=>resolve({err,stdout:String(stdout||''),stderr:String(stderr||'')})));

    // Tenta público sem cookies primeiro. Isso evita "The page needs to be reloaded"
    // causado por alguns clientes autenticados do YouTube.
    let result=await run([...common,...mediaArgs,'-o',template,target]);

    const cookies=path.join(rootDir,'cookies.txt');
    if(result.err && fs.existsSync(cookies)){
      result=await run([
        ...common,
        '--cookies',cookies,
        '--extractor-args','youtube:player_client=default,web_embedded',
        ...mediaArgs,
        '-o',template,
        target
      ]);
    }

    if(result.err){
      const msg=String(result.stderr||result.err.message||'');
      const low=msg.toLowerCase();
      if(low.includes('remote component challenge solver')||low.includes('challenge solving failed')){
        throw new Error('Não consegui preparar esse vídeo agora. Tente novamente em alguns instantes.');
      }
      if(low.includes('sign in'))throw new Error('Esse vídeo exige acesso adicional e não pôde ser baixado agora.');
      throw new Error('Não consegui concluir o download desse vídeo agora.');
    }

    const files=fs.readdirSync(downloadDir).filter(f=>f.startsWith(stamp)).map(f=>path.join(downloadDir,f));
    if(!files.length)throw new Error('Download terminou, mas o arquivo não foi encontrado.');
    const file=files.find(f=>mode==='audio'?f.toLowerCase().endsWith('.mp3'):f.toLowerCase().endsWith('.mp4'))||files[0];
    const stat=fs.statSync(file),name=path.basename(file);
    try{
      if(mode==='audio')await sock.sendMessage(jid,{audio:fs.readFileSync(file),mimetype:'audio/mpeg',fileName:name});
      else if(stat.size<=60*1024*1024)await sock.sendMessage(jid,{video:fs.readFileSync(file),caption:'✅ YouTube baixado pelo site Gremory.'});
      else await sock.sendMessage(jid,{document:fs.readFileSync(file),fileName:name,mimetype:'video/mp4',caption:'✅ YouTube baixado pelo site Gremory.'});
    }finally{
      try{fs.unlinkSync(file)}catch{}
    }
    try{await achievements.registrarEventoConquista?.({sender:jid,evento:mode==='audio'?'download_audio':'download_video',qtd:1})}catch{}
    return{sent:true,title:name,message:'Arquivo enviado no WhatsApp pela Charlotte.'};
  }

  async function processTttCreate(uid,data){
    const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Amigo inválido.');if(!(await reciprocalFriends(uid,targetUid)))throw new Error('Jogue apenas com amigos confirmados.');await ensureNoActiveGame('ticTacToeIndex',[uid,targetUid]);
    const[a,b]=await Promise.all([rtdb.ref(`directory/${uid}`).once('value'),rtdb.ref(`directory/${targetUid}`).once('value')]),gameId=id('ttt'),first=crypto.randomInt(0,2)===0?uid:targetUid,createdAt=Date.now(),wager=await prepareGameWager(gameId,[uid,targetUid],data.bet),game={id:gameId,status:'active',createdAt,updatedAt:createdAt,turnUid:first,board:['','','','','','','','',''],wager,players:{[uid]:{uid,name:a.val()?.nome||'Jogador',symbol:'X'},[targetUid]:{uid:targetUid,name:b.val()?.nome||'Jogador',symbol:'O'}},log:{}};
    await rtdb.ref(`ticTacToeGames/${gameId}`).set(game);await Promise.all([rtdb.ref(`ticTacToeIndex/${uid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt,opponentUid:targetUid}),rtdb.ref(`ticTacToeIndex/${targetUid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt,opponentUid:uid})]);return{gameId,wager};
  }
  function tttWinner(board){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const[a,b,c]of lines)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return null;}
  async function grantTttReward(uid){
    const jid=await linkedJidByUid(uid);if(!jid||typeof economy.addkoin!=='function')return{rupias:0,limitReached:false};const db=readJson(tttRewardPath,{}),day=new Date().toISOString().slice(0,10),row=db[jid]||{};if(row.day!==day){row.day=day;row.wins=0}const premium=readPremium(jid).active,limit=premium?8:5;if(Number(row.wins||0)>=limit){db[jid]=row;writeJson(tttRewardPath,db);return{rupias:0,limitReached:true,limit,premium}}const rupias=premium?40:30;await economy.addkoin(jid,rupias);row.wins=Number(row.wins||0)+1;db[jid]=row;writeJson(tttRewardPath,db);return{rupias,limitReached:false,limit,premium,wins:row.wins};
  }
  async function processTttMove(uid,data){
    const gameId=String(data.gameId||''),gr=rtdb.ref(`ticTacToeGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())throw new Error('Partida não encontrada.');const g={id:gameId,...sn.val()};if(g.status!=='active'||g.turnUid!==uid)throw new Error('Ainda não é sua vez.');const idx=Number(data.index);if(!Number.isInteger(idx)||idx<0||idx>8)throw new Error('Jogada inválida.');const board=Array.isArray(g.board)?g.board.slice():Array.from({length:9},(_,i)=>g.board?.[i]||'');if(board[idx])throw new Error('Essa casa já foi usada.');const me=g.players?.[uid],otherUid=Object.keys(g.players||{}).find(x=>x!==uid);board[idx]=me.symbol;const winner=tttWinner(board),draw=!winner&&board.every(Boolean),patch={board,updatedAt:Date.now(),[`log/${id('log')}`]:{text:`${me.name} marcou ${me.symbol}.`,at:now()}};let reward=null;if(winner||draw){patch.status='finished';patch.winnerUid=winner?uid:null;patch.finishedAt=Date.now();patch.turnUid=null;if(winner)reward=await grantTttReward(uid);patch.reward=reward}else patch.turnUid=otherUid;await gr.update(patch);if(winner||draw){await settleGameWager(gameId,winner?uid:null);const up=Date.now();await Promise.all(Object.keys(g.players).map(x=>rtdb.ref(`ticTacToeIndex/${x}/${gameId}`).update({status:'finished',winnerUid:winner?uid:null,updatedAt:up,reward:x===uid?reward:null})));}return{winnerUid:winner?uid:null,draw,reward};
  }
  async function processTttExit(uid,data){const gameId=String(data.gameId||''),gr=rtdb.ref(`ticTacToeGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())return{};const g={id:gameId,...sn.val()};if(g.status!=='active'||!g.players?.[uid])return{};const winnerUid=Object.keys(g.players).find(x=>x!==uid),up=Date.now();await gr.update({status:'finished',winnerUid,leftUid:uid,finishReason:'exit',finishedAt:up,updatedAt:up,turnUid:null,[`log/${id('log')}`]:{text:`${g.players[uid].name} saiu da partida.`,at:now()}});await settleGameWager(gameId,winnerUid);await Promise.all(Object.keys(g.players).map(x=>rtdb.ref(`ticTacToeIndex/${x}/${gameId}`).update({status:'finished',winnerUid,updatedAt:up})));return{winnerUid};}

  // ======================================================
  // 21 PVP — mãos privadas; o adversário não recebe suas cartas.
  // ======================================================
  const BJ_SUITS=['♠','♥','♦','♣'],BJ_RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  function bjDeck(){const deck=BJ_SUITS.flatMap(s=>BJ_RANKS.map(r=>({s,r})));for(let i=deck.length-1;i>0;i--){const j=crypto.randomInt(0,i+1);[deck[i],deck[j]]=[deck[j],deck[i]]}return deck}
  function bjScore(cards=[]){let total=cards.reduce((n,c)=>n+(c.r==='A'?11:['J','Q','K'].includes(c.r)?10:Number(c.r||0)),0),aces=cards.filter(c=>c.r==='A').length;while(total>21&&aces-->0)total-=10;return total}
  async function ensureNoActiveGame(indexRoot,uids=[]){for(const playerUid of uids){const sn=await rtdb.ref(`${indexRoot}/${playerUid}`).once('value');if(Object.values(sn.val()||{}).some(x=>x?.status==='active'))throw new Error('Um dos jogadores já está em uma partida desse jogo.')}}
  function blackjackWinnerFromHands(hands={}){const rows=Object.entries(hands).map(([uid,h])=>({uid,score:Number(h?.score||0),busted:!!h?.busted})),valid=rows.filter(p=>!p.busted&&p.score<=21);if(!valid.length)return null;if(valid.length===1)return valid[0].uid;if(valid[0].score===valid[1].score)return null;return valid[0].score>valid[1].score?valid[0].uid:valid[1].uid}
  async function blackjackHands(gameId,uids){const out={};for(const uid of uids){out[uid]=(await rtdb.ref(`blackjackPrivate/${gameId}/${uid}`).once('value')).val()||{cards:[],score:0,stood:false,busted:false}}return out}
  async function finishBlackjack(gr,g,winnerUid,reason='Partida encerrada.'){
    const uids=Object.keys(g.players||{}),hands=await blackjackHands(g.id,uids),finishedAt=Date.now();g.status='finished';g.winnerUid=winnerUid||null;g.turnUid=null;g.finishedAt=finishedAt;g.updatedAt=finishedAt;g.revealedHands=hands;g.log=g.log||{};g.log[id('log')]={text:reason,at:now()};await gr.set(g);await settleGameWager(g.id,winnerUid||null);await rtdb.ref(`gameSecrets/blackjack/${g.id}`).remove().catch(()=>{});await rtdb.ref(`blackjackPrivate/${g.id}`).remove().catch(()=>{});await Promise.all(uids.map(x=>rtdb.ref(`blackjackIndex/${x}/${g.id}`).update({status:'finished',winnerUid:winnerUid||null,updatedAt:finishedAt})));return{winnerUid:winnerUid||null,draw:!winnerUid}
  }
  async function processBlackjackCreate(uid,data){
    const mode=data.mode==='nightmare'?'nightmare':'classic';
    const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Amigo inválido.');if(!(await reciprocalFriends(uid,targetUid)))throw new Error('Jogue apenas com amigos confirmados.');await ensureNoActiveGame('blackjackIndex',[uid,targetUid]);const[a,b]=await Promise.all([rtdb.ref(`directory/${uid}`).once('value'),rtdb.ref(`directory/${targetUid}`).once('value')]),gameId=id('bj'),deck=bjDeck(),cardsA=[deck.pop(),deck.pop()],cardsB=[deck.pop(),deck.pop()],first=crypto.randomInt(0,2)===0?uid:targetUid,createdAt=Date.now(),wager=await prepareGameWager(gameId,[uid,targetUid],data.bet);const hA={cards:cardsA,score:bjScore(cardsA),stood:false,busted:false},hB={cards:cardsB,score:bjScore(cardsB),stood:false,busted:false};const game={id:gameId,mode,status:'active',createdAt,updatedAt:createdAt,turnUid:first,wager,players:{[uid]:{uid,name:a.val()?.nome||'Jogador',cardCount:2,stood:false,busted:false},[targetUid]:{uid:targetUid,name:b.val()?.nome||'Jogador',cardCount:2,stood:false,busted:false}},log:{}};await Promise.all([rtdb.ref(`gameSecrets/blackjack/${gameId}`).set({deck}),rtdb.ref(`blackjackPrivate/${gameId}/${uid}`).set(hA),rtdb.ref(`blackjackPrivate/${gameId}/${targetUid}`).set(hB),rtdb.ref(`blackjackGames/${gameId}`).set(game),rtdb.ref(`blackjackIndex/${uid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt,opponentUid:targetUid}),rtdb.ref(`blackjackIndex/${targetUid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt,opponentUid:uid})]);return{gameId,wager};
  }
  // 21 Pesadelo: cartas especiais originais. O baralho e os resultados das
  // ações são exclusivamente calculados no bridge; mãos em blackjackPrivate.
  async function processBlackjackMove(uid,data){
    const gameId=String(data.gameId||''),action=String(data.action||'').toLowerCase(),
      gr=rtdb.ref(`blackjackGames/${gameId}`),sn=await gr.once('value');
    if(!sn.exists())throw new Error('Partida não encontrada.');
    const g={id:gameId,...sn.val()};
    if(g.status!=='active'||!g.players?.[uid])throw new Error('Partida encerrada.');
    if(g.turnUid!==uid)throw new Error('Ainda não é sua vez.');
    const uids=Object.keys(g.players),otherUid=uids.find(x=>x!==uid);
    const hr=rtdb.ref(`blackjackPrivate/${gameId}/${uid}`),me=(await hr.once('value')).val()||{};
    if(me.stood||me.busted)throw new Error('Sua jogada já terminou.');
    const privateRef=id=>rtdb.ref(`blackjackPrivate/${gameId}/${id}`);
    const secretRef=rtdb.ref(`gameSecrets/blackjack/${gameId}`);
    let deck=null,other=null,deckChanged=false,otherChanged=false;
    const getDeck=async()=>{
      if(deck===null){const obj=(await secretRef.once('value')).val()||{};deck=Array.isArray(obj.deck)?obj.deck:[];}
      if(!deck.length)throw new Error('O baralho acabou.');
      return deck;
    };
    const draw=async hand=>{
      const cards=await getDeck(),card=cards.pop();deckChanged=true;
      hand.cards=Array.isArray(hand.cards)?hand.cards:[];
      hand.cards.push(card);hand.score=bjScore(hand.cards);
      if(hand.score>21&&hand.shield){
        hand.cards.pop();hand.score=bjScore(hand.cards);hand.shield=false;hand.shieldSaved=true;
      }else if(hand.score>=21){hand.stood=true;hand.busted=hand.score>21;}
    };
    g.log=g.log||{};
    let message='';
    if(action==='hit'){
      await draw(me);if(me.lockStand)me.lockStand=false;
      message=`${g.players[uid].name} pediu carta${me.shieldSaved?' (escudo protegeu a mão).':me.busted?' e estourou.':me.score===21?' e fez 21!':'.'}`;
      me.shieldSaved=false;
    }else if(action==='stand'){
      if(me.lockStand)throw new Error('A carta Trava exige que você compre uma carta antes de parar.');
      me.stood=true;message=`${g.players[uid].name} parou.`;
    }else if(action==='special'){
      if(g.mode!=='nightmare')throw new Error('Cartas especiais disponíveis apenas no Modo Pesadelo.');
      const special=String(data.special||'').toLowerCase();
      if(!['shield','omen','order','lock','swap'].includes(special))throw new Error('Carta especial inválida.');
      me.specialsUsed=me.specialsUsed||{};
      if(me.specialsUsed[special])throw new Error('Você já usou essa carta nesta partida.');
      if(special==='shield'){
        if(me.shield)throw new Error('Você já possui um Escudo ativo.');
        me.shield=true;message=`${g.players[uid].name} ativou Escudo.`;
      }else if(special==='omen'){
        const cards=await getDeck(),top=cards[cards.length-1];
        const points=top.r==='A'?11:['J','Q','K'].includes(top.r)?10:Number(top.r||0);
        me.omen=points<=5?'Carta baixa (2–5)':points<=9?'Carta média (6–9)':'Carta alta (10 ou Ás)';
        message=`${g.players[uid].name} consultou o Presságio.`;
      }else if(special==='order'){
        other=(await privateRef(otherUid).once('value')).val()||{};
        if(other.stood||other.busted)throw new Error('O adversário já encerrou sua mão.');
        await draw(other);otherChanged=true;
        message=`${g.players[uid].name} usou Ordem: o rival comprou uma carta.`;
      }else if(special==='lock'){
        other=(await privateRef(otherUid).once('value')).val()||{};
        if(other.stood||other.busted)throw new Error('O adversário já encerrou sua mão.');
        other.lockStand=true;otherChanged=true;
        message=`${g.players[uid].name} usou Trava: o rival precisa comprar carta.`;
      }else if(special==='swap'){
        if(!Array.isArray(me.cards)||me.cards.length<3)throw new Error('Compre uma carta antes de usar Troca.');
        await getDeck();me.cards.pop(); // A troca descarta a última carta antes de comprar outra.
        const card=deck.pop();me.cards.push(card);deckChanged=true;
        me.score=bjScore(me.cards);
        if(me.score>=21){me.stood=true;me.busted=me.score>21;}
        message=`${g.players[uid].name} usou Troca em sua última carta.`;
      }
      me.specialsUsed[special]=true;
    }else throw new Error('Jogada inválida.');
    if(deckChanged)await secretRef.set({deck});
    await hr.set(me);
    if(otherChanged)await privateRef(otherUid).set(other);
    g.players[uid].cardCount=Array.isArray(me.cards)?me.cards.length:0;
    g.players[uid].stood=!!me.stood;g.players[uid].busted=!!me.busted;
    if(otherChanged){g.players[otherUid].cardCount=Array.isArray(other.cards)?other.cards.length:0;g.players[otherUid].stood=!!other.stood;g.players[otherUid].busted=!!other.busted;}
    g.log[id('log')]={text:message,at:now()};
    const hands=await blackjackHands(gameId,uids),done=uids.every(x=>hands[x].stood||hands[x].busted);
    if(done){const winnerUid=blackjackWinnerFromHands(hands);return finishBlackjack(gr,g,winnerUid,winnerUid?`${g.players[winnerUid].name} venceu a partida de 21.`:'A partida terminou empatada.');}
    g.turnUid=otherUid&&!hands[otherUid].stood&&!hands[otherUid].busted?otherUid:uid;
    g.updatedAt=Date.now();await gr.set(g);
    return{turnUid:g.turnUid,score:me.score,busted:!!me.busted};
  }
  async function processBlackjackExit(uid,data){const gameId=String(data.gameId||''),gr=rtdb.ref(`blackjackGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())return{};const g={id:gameId,...sn.val()};if(g.status!=='active'||!g.players?.[uid])return{};const winnerUid=Object.keys(g.players).find(x=>x!==uid);g.leftUid=uid;g.finishReason='exit';return finishBlackjack(gr,g,winnerUid,`${g.players[uid].name} saiu da partida.`)}

  // ======================================================
  // FORCA PVP — palavra secreta só no bridge
  // ======================================================
  const HANGMAN_WORDS=['CHARLOTTE','POKEMON','GREMORY','DRAGAO','MAGIA','ANIME','AVENTURA','MISTERIO','AMIZADE','BATALHA','ESTRELA','VITORIA','CASTELO','DEMONIO','TREINADOR','FANTASIA','GUERREIRO','IMPERIO','LENDARIO','RAIO','RUPIAS','GINASIO','MESTRE','CRISTAL','GALAXIA','ESPADA','CORAGEM','TEMPLO','PORTAL','SOMBRA'];
  function normalizeGameLetter(v=''){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,1)}
  function hangmanMask(word,guessed={}){return [...word].map(ch=>guessed[ch]==='hit'?ch:'_').join('')}
  function hangmanWinner(players={}){const rows=Object.values(players);if(rows.length<2)return rows[0]?.uid||null;const [a,b]=rows,sa=Number(a.score||0),sb=Number(b.score||0);return sa===sb?null:(sa>sb?a.uid:b.uid)}
  async function finishHangman(gr,g,winnerUid,answer,reason='Partida encerrada.'){
    const finishedAt=Date.now();g.status='finished';g.winnerUid=winnerUid||null;g.answer=answer;g.turnUid=null;g.finishedAt=finishedAt;g.updatedAt=finishedAt;g.log=g.log||{};g.log[id('log')]={text:reason,at:now()};await gr.set(g);await settleGameWager(g.id,winnerUid||null);await rtdb.ref(`gameSecrets/hangman/${g.id}`).remove().catch(()=>{});await Promise.all(Object.keys(g.players||{}).map(x=>rtdb.ref(`hangmanIndex/${x}/${g.id}`).update({status:'finished',winnerUid:winnerUid||null,updatedAt:finishedAt})));return{winnerUid:winnerUid||null,draw:!winnerUid,answer};
  }
  async function processHangmanCreate(uid,data){
    const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Amigo inválido.');if(!(await reciprocalFriends(uid,targetUid)))throw new Error('Jogue apenas com amigos confirmados.');await ensureNoActiveGame('hangmanIndex',[uid,targetUid]);const[a,b]=await Promise.all([rtdb.ref(`directory/${uid}`).once('value'),rtdb.ref(`directory/${targetUid}`).once('value')]),gameId=id('hang'),word=HANGMAN_WORDS[crypto.randomInt(0,HANGMAN_WORDS.length)],first=crypto.randomInt(0,2)===0?uid:targetUid,createdAt=Date.now(),wager=await prepareGameWager(gameId,[uid,targetUid],data.bet),players={[uid]:{uid,name:a.val()?.nome||'Jogador',score:0},[targetUid]:{uid:targetUid,name:b.val()?.nome||'Jogador',score:0}},game={id:gameId,status:'active',createdAt,updatedAt:createdAt,turnUid:first,wager,mask:'_'.repeat(word.length),guessed:{},misses:[],maxMisses:6,players,log:{}};await Promise.all([rtdb.ref(`gameSecrets/hangman/${gameId}`).set({word}),rtdb.ref(`hangmanGames/${gameId}`).set(game),rtdb.ref(`hangmanIndex/${uid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt,opponentUid:targetUid}),rtdb.ref(`hangmanIndex/${targetUid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt,opponentUid:uid})]);return{gameId,wager};
  }
  async function processHangmanGuess(uid,data){const gameId=String(data.gameId||''),letter=normalizeGameLetter(data.letter),gr=rtdb.ref(`hangmanGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())throw new Error('Partida não encontrada.');const g={id:gameId,...sn.val()};if(g.status!=='active'||!g.players?.[uid])throw new Error('Partida encerrada.');if(g.turnUid!==uid)throw new Error('Ainda não é sua vez.');if(!letter)throw new Error('Letra inválida.');g.guessed=g.guessed||{};if(g.guessed[letter])throw new Error('Essa letra já foi usada.');const secret=(await rtdb.ref(`gameSecrets/hangman/${gameId}`).once('value')).val()||{},word=String(secret.word||'');if(!word)throw new Error('Palavra secreta indisponível.');const hits=[...word].filter(ch=>ch===letter).length;g.log=g.log||{};g.misses=Array.isArray(g.misses)?g.misses:[];if(hits){g.guessed[letter]='hit';g.players[uid].score=Number(g.players[uid].score||0)+hits;g.log[id('log')]={text:`${g.players[uid].name} acertou ${letter} (+${hits}).`,at:now()};}else{g.guessed[letter]='miss';g.misses.push(letter);g.log[id('log')]={text:`${g.players[uid].name} errou ${letter}.`,at:now()};}g.mask=hangmanMask(word,g.guessed);const completed=!g.mask.includes('_'),failed=g.misses.length>=Number(g.maxMisses||6);if(completed){g.players[uid].score=Number(g.players[uid].score||0)+2;const winnerUid=hangmanWinner(g.players);return finishHangman(gr,g,winnerUid,word,`${g.players[uid].name} completou a palavra ${word}.`)}if(failed){const winnerUid=hangmanWinner(g.players);return finishHangman(gr,g,winnerUid,word,`A forca chegou ao limite. A palavra era ${word}.`)}const otherUid=Object.keys(g.players).find(x=>x!==uid);g.turnUid=otherUid;g.updatedAt=Date.now();await gr.set(g);return{turnUid:otherUid,hits,mask:g.mask};}
  async function processHangmanExit(uid,data){const gameId=String(data.gameId||''),gr=rtdb.ref(`hangmanGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())return{};const g={id:gameId,...sn.val()};if(g.status!=='active'||!g.players?.[uid])return{};const secret=(await rtdb.ref(`gameSecrets/hangman/${gameId}`).once('value').catch(()=>null))?.val?.()||{},winnerUid=Object.keys(g.players).find(x=>x!==uid);g.leftUid=uid;g.finishReason='exit';return finishHangman(gr,g,winnerUid,String(secret.word||''),`${g.players[uid].name} saiu da partida.`)}

  // ======================================================
  // SLOTS SOLO — o SITE sorteia; bot só liquida a carteira.
  // A fonte do resultado é siteSlotsPending (escrita exclusivamente pelo
  // servidor via Firebase Admin). Um navegador não pode indicar prêmios.
  // ======================================================
  const SLOT_ITEMS=[{symbol:'✦',weight:28,mult:3},{symbol:'♥',weight:22,mult:4},{symbol:'☾',weight:18,mult:5},{symbol:'◆',weight:14,mult:6},{symbol:'⚡',weight:9,mult:8},{symbol:'♛',weight:6,mult:12},{symbol:'7',weight:3,mult:25}];
  function slotPayout(items,bet){const syms=items.map(x=>x.symbol);if(syms[0]===syms[1]&&syms[1]===syms[2])return{payout:Math.floor(bet*items[0].mult),jackpot:syms[0]==='7',label:`Trinca ${syms[0]}`};if(new Set(syms).size===2)return{payout:Math.floor(bet*1.2),jackpot:false,label:'Dupla'};return{payout:0,jackpot:false,label:'Sem prêmio'};}
  function pickSlotItem(){const total=SLOT_ITEMS.reduce((n,x)=>n+Number(x.weight||0),0),roll=crypto.randomInt(Math.max(1,total));let acc=0;for(const item of SLOT_ITEMS){acc+=Number(item.weight||0);if(roll<acc)return item}return SLOT_ITEMS[0];}
  async function processSlotsSpin(uid,jid,data){
    const bet=Number(data.bet);if(!Number.isSafeInteger(bet)||bet<10||bet>5000)throw new Error('A aposta deve ficar entre ₹10 e ₹5.000.');
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de jogar Slots.');
    if(typeof economy.delkoin!=='function'||typeof economy.addkoin!=='function')throw new Error('Sistema de rúpias indisponível.');
    const previousBalance=balanceFor(jid);if(previousBalance<bet)throw new Error(`Saldo insuficiente. Você possui ₹${previousBalance}.`);
    const items=[pickSlotItem(),pickSlotItem(),pickSlotItem()],symbols=items.map(x=>x.symbol),result=slotPayout(items,bet),net=result.payout-bet;
    if(net<0)await economy.delkoin(jid,-net);else if(net>0)await economy.addkoin(jid,net);
    const balance=balanceFor(jid);try{if(net>0)await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_ganho',qtd:net})}catch{}
    await syncAccount(uid,jid).catch(()=>{});return{bet,payout:result.payout,net,balance,symbols,jackpot:result.jackpot,label:result.label,settlement:'done'};
  }

  async function processSlotsSettle(uid,jid,data,jobId){
    const spinId=String(data.spinId||'');
    if(!/^spin_[a-f0-9]{32}$/.test(spinId))throw new Error('Identificador da aposta inválido.');
    const receiptRef=rtdb.ref(`siteSlotsSettlements/${uid}/${spinId}`);
    const prior=(await receiptRef.once('value')).val()||null;
    if(prior?.status==='done')return{bet:prior.bet,payout:prior.payout,balance:prior.balance,spinId};
    if(prior)throw new Error('Essa aposta está em análise; nenhum débito adicional será feito.');
    const pendingRef=rtdb.ref(`siteSlotsPending/${uid}`);
    const pending=(await pendingRef.once('value')).val()||null;
    if(!pending||String(pending.spinId)!==spinId||String(pending.jobId)!==String(jobId)||String(pending.uid)!==uid)throw new Error('Aposta não autorizada pelo servidor do site.');
    const bet=Number(pending.bet),payout=Number(pending.payout),symbols=pending.symbols;
    if(!Number.isSafeInteger(bet)||bet<10||bet>5000||!Number.isSafeInteger(payout)||!Array.isArray(symbols)||symbols.length!==3)throw new Error('Aposta inválida.');
    const items=symbols.map(x=>SLOT_ITEMS.find(k=>k.symbol===x));
    if(items.some(x=>!x))throw new Error('Símbolos inválidos.');
    const valid=slotPayout(items,bet);
    if(payout!==valid.payout||!!pending.jackpot!==valid.jackpot)throw new Error('Prêmio não confere com os símbolos.');
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de jogar Slots.');
    if(typeof economy.delkoin!=='function'||typeof economy.addkoin!=='function')throw new Error('Sistema de rúpias indisponível.');
    const previousBalance=balanceFor(jid);
    if(previousBalance<bet)throw new Error(`Saldo insuficiente. Você possui ₹${previousBalance}.`);
    // Um recibo processing funciona como trava de idempotência: numa falha ou
    // reinício durante a operação, não repetimos o débito automaticamente.
    const claim=await receiptRef.transaction(current=>current?undefined:{status:'processing',spinId,jobId,bet,payout,previousBalance,startedAt:Date.now()},undefined,false);
    if(!claim.committed)throw new Error('Aposta já reservada para liquidação.');
    try{
      const net=payout-bet;
      // Uma única alteração líquida para reduzir a janela de falha e manter a
      // carteira da Charlotte como autoridade do saldo.
      if(net<0)await economy.delkoin(jid,-net);
      else if(net>0)await economy.addkoin(jid,net);
      const balance=balanceFor(jid);
      await receiptRef.update({status:'done',balance,finishedAt:Date.now()});
      await pendingRef.transaction(current=>current?.spinId===spinId?null:undefined,undefined,false);
      try{if(net>0)await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_ganho',qtd:net})}catch{}
      await syncAccount(uid,jid).catch(()=>{});
      return{bet,payout,net,balance,spinId,symbols,jackpot:valid.jackpot,label:valid.label};
    }catch(e){
      // Falha após reservar a carteira: nunca cobrar duas vezes automaticamente.
      await receiptRef.update({status:'review',error:String(e?.message||e).slice(0,250),reviewAt:Date.now()}).catch(()=>{});
      throw new Error('Liquidação em análise: verifique o extrato antes de liberar outro giro.');
    }
  }
  async function releaseFailedSlotReservation(uid,data,jobId){
    const spinId=String(data?.spinId||'');if(!/^spin_[a-f0-9]{32}$/.test(spinId))return;
    const receipt=(await rtdb.ref(`siteSlotsSettlements/${uid}/${spinId}`).once('value').catch(()=>null))?.val?.();
    if(receipt)return; // pode ter ocorrido uma alteração financeira; manter bloqueado.
    await rtdb.ref(`siteSlotsPending/${uid}`).transaction(current=>current?.spinId===spinId&&current?.jobId===jobId?null:undefined,undefined,false).catch(()=>{});
  }

  function tinderNormalizeProfile(p={}){
    return{...p,jid:cleanJid(p.jid||''),nome:String(p.nome||'Usuário').slice(0,60),idade:String(p.idade||''),bio:String(p.bio||'').slice(0,300),likes:Number(p.likes||0),matches:Number(p.matches||0),likedBy:Array.isArray(p.likedBy)?p.likedBy:[],matchedWith:Array.isArray(p.matchedWith)?p.matchedWith:[],ativo:p.ativo!==false};
  }
  async function mirrorTinderProfile(uid,profile){
    if(!uid||!profile)return;const p=tinderNormalizeProfile(profile);
    await rtdb.ref(`siteTinderProfiles/${uid}`).set({uid,nome:p.nome,idade:Number(p.idade||0),bio:p.bio,foto:String(p.foto||''),ativo:p.ativo!==false,likes:Number(p.likes||0),matches:Number(p.matches||0),updatedAt:now()});
    await rtdb.ref(`tinderBackups/${uid}`).set({jid:cleanJid(p.jid||''),nome:p.nome,idade:String(p.idade||''),bio:p.bio,foto:String(p.foto||''),wa:String(p.wa||''),ativo:p.ativo!==false,likes:Number(p.likes||0),matches:Number(p.matches||0),likedBy:p.likedBy||[],matchedWith:p.matchedWith||[],updatedAt:now()})
  }
  async function restoreTinderFromFirebase(){
    const [pubSn,privateSn,links]=await Promise.all([rtdb.ref('siteTinderProfiles').once('value').catch(()=>null),rtdb.ref('tinderBackups').once('value').catch(()=>null),rtdb.ref('charlottePrivate').once('value').catch(()=>null)]),mirrors=pubSn?.val?.()||{},privateMirrors=privateSn?.val?.()||{};if(!Object.keys(mirrors).length&&!Object.keys(privateMirrors).length)return;
    const rows=readJson(tinderPath,[]);if(!Array.isArray(rows))return;const privateRows=links?.val?.()||{};let changed=false;const uids=new Set([...Object.keys(mirrors),...Object.keys(privateMirrors)]);
    for(const uid of uids){const p={...(mirrors[uid]||{}),...(privateMirrors[uid]||{})},jid=cleanJid(p.jid||privateRows?.[uid]?.whatsappJid||'');if(!jid)continue;let i=rows.findIndex(x=>sameUser(x?.jid,jid));if(i<0){rows.push(tinderNormalizeProfile({...p,jid}));changed=true}else{rows[i]={...rows[i],...tinderNormalizeProfile({...rows[i],...p,jid})};changed=true}}
    if(changed)writeJson(tinderPath,rows)
  }
  async function processTinderProfileGet(uid,jid){
    let rows=readJson(tinderPath,[]);let local=Array.isArray(rows)?rows.find(p=>sameUser(p?.jid,jid)):null;
    if(!local){const sn=await rtdb.ref(`siteTinderProfiles/${uid}`).once('value');if(sn.exists()){const p=sn.val();local=tinderNormalizeProfile({jid,nome:p.nome,idade:p.idade,bio:p.bio,foto:p.foto,ativo:p.ativo,likes:p.likes,matches:p.matches});rows=Array.isArray(rows)?rows:[];rows.push(local);writeJson(tinderPath,rows)}}
    if(!local)return{profile:null};const p=tinderNormalizeProfile(local);return{profile:{nome:p.nome,idade:Number(p.idade||0),bio:p.bio,photo:await tinderPhoto(p),foto:p.foto||'',ativo:p.ativo,likes:p.likes,matches:p.matches}}
  }
  async function processTinderProfileSave(uid,jid,data){
    const idade=Number(data.idade||0);if(idade<18||idade>99)throw new Error('O Tinder é somente para maiores de 18 anos.');
    const rows=readJson(tinderPath,[]);if(!Array.isArray(rows))throw new Error('Tinder indisponível.');const i=rows.findIndex(p=>sameUser(p?.jid,jid)),old=i>=0?tinderNormalizeProfile(rows[i]):tinderNormalizeProfile({jid});
    const profile={...old,jid:cleanJid(jid),nome:String(data.nome||old.nome||'Usuário').trim().slice(0,60),idade:String(idade),bio:String(data.bio||'').trim().slice(0,300),foto:String(data.foto||'').trim().slice(0,1000),wa:old.wa||cleanJid(jid).split('@')[0],ativo:data.ativo!==false};
    if(i>=0)rows[i]=profile;else rows.push(profile);writeJson(tinderPath,rows);await mirrorTinderProfile(uid,profile);
    return{profile:{nome:profile.nome,idade, bio:profile.bio,photo:profile.foto||await tinderPhoto(profile),foto:profile.foto||'',ativo:profile.ativo,likes:profile.likes,matches:profile.matches}}
  }
  async function siteUidMapByJid(){
    const sn=await rtdb.ref('charlottePrivate').once('value'),map=new Map();
    for(const[uid,v]of Object.entries(sn.val()||{})){const jid=cleanJid(v?.whatsappJid||'');if(jid)map.set(jid,uid)}
    return map;
  }
  async function tinderPhoto(profile){
    if(/^https?:\/\//i.test(String(profile?.foto||'')))return String(profile.foto);
    try{
      const p=await Promise.race([sock.profilePictureUrl(profile.jid,'image'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),1800))]);
      return String(p||'');
    }catch{return''}
  }
  async function processTinderFeed(uid,jid,data){
    const rows=readJson(tinderPath,[]);if(!Array.isArray(rows))throw new Error('Tinder indisponível.');
    let me=rows.find(p=>sameUser(p?.jid,jid));if(!me){await processTinderProfileGet(uid,jid);const fresh=readJson(tinderPath,[]);me=Array.isArray(fresh)?fresh.find(p=>sameUser(p?.jid,jid)):null}if(!me)throw new Error('Crie seu perfil do Tinder pelo site ou pela Charlotte.');
    const links=await siteUidMapByJid(),skip=new Set((Array.isArray(data.skipUids)?data.skipUids:[]).map(String));
    const candidates=[];
    for(const raw of rows){
      const p=tinderNormalizeProfile(raw);if(!p.ativo||sameUser(p.jid,jid))continue;
      const targetUid=links.get(cleanJid(p.jid));if(!targetUid||skip.has(targetUid))continue;
      candidates.push({targetUid,profile:p});
    }
    if(!candidates.length)return{profile:null};
    const pick=candidates[crypto.randomInt(0,candidates.length)],p=pick.profile;
    return{profile:{uid:pick.targetUid,nome:p.nome,idade:p.idade,bio:p.bio,photo:await tinderPhoto(p),likes:p.likes,matches:p.matches}};
  }
  async function processTinderLike(uid,jid,data){
    const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Perfil inválido.');
    const targetJid=await linkedJidByUid(targetUid);if(!targetJid)throw new Error('Esse perfil não está disponível.');
    const rows=readJson(tinderPath,[]);if(!Array.isArray(rows))throw new Error('Tinder indisponível.');
    const myIndex=rows.findIndex(p=>sameUser(p?.jid,jid)),targetIndex=rows.findIndex(p=>sameUser(p?.jid,targetJid));
    if(myIndex<0)throw new Error('Crie seu perfil do Tinder pelo site ou pela Charlotte.');if(targetIndex<0)throw new Error('Esse perfil não existe mais.');
    const me=tinderNormalizeProfile(rows[myIndex]),target=tinderNormalizeProfile(rows[targetIndex]);
    if(!target.likedBy.some(x=>sameUser(x,jid)))target.likedBy.push(jid);target.likes=target.likedBy.length;
    const match=me.likedBy.some(x=>sameUser(x,targetJid));
    if(match){
      if(!me.matchedWith.some(x=>sameUser(x,targetJid)))me.matchedWith.push(targetJid);
      if(!target.matchedWith.some(x=>sameUser(x,jid)))target.matchedWith.push(jid);
      me.matches=me.matchedWith.length;target.matches=target.matchedWith.length;
    }
    rows[myIndex]=me;rows[targetIndex]=target;writeJson(tinderPath,rows);await mirrorTinderProfile(uid,me).catch(()=>{});await mirrorTinderProfile(targetUid,target).catch(()=>{});
    if(match){
      await notifySite(uid,{type:'tinder_match',title:'Deu match 💘',text:`Você e ${target.nome} curtiram um ao outro.`,link:'#tinder'}).catch(()=>{});
      await notifySite(targetUid,{type:'tinder_match',title:'Deu match 💘',text:`Você e ${me.nome} curtiram um ao outro.`,link:'#tinder'}).catch(()=>{});
      await sendWhats(targetJid,`💘 Deu match com ${me.nome}! Abra o Tinder no site ou use /tinder.`);
    }
    return{liked:true,match,contact:match?(target.wa||''):''};
  }
  function compactWatchMusicRows(queueObj={}){
    const rows=Object.entries(queueObj||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
    const keep=[],removeIds=[],lastByTrack=new Map();
    for(const row of rows){
      const key=`${String(row.videoId||row.url||row.title||'')}|${String(row.requestedBy||'')}`;
      const created=Number(row.createdAt||0),last=lastByTrack.get(key);
      if(last&&Math.abs(created-last.created)<=15000){
        removeIds.push(row.id);
        continue;
      }
      lastByTrack.set(key,{created,id:row.id});
      keep.push(row);
    }
    return{keep,removeIds};
  }
  async function compactWatchMusicQueue(roomCode,queueObj={}){
    const compacted=compactWatchMusicRows(queueObj);
    if(compacted.removeIds.length){
      const patch={};
      for(const id of compacted.removeIds)patch[`watchRooms/${roomCode}/musicQueue/${id}`]=null;
      await rtdb.ref().update(patch);
      logger.log(`[WATCH MUSIC] removidas ${compacted.removeIds.length} duplicata(s) da fila ${roomCode}.`);
    }
    return compacted.keep;
  }

  async function watchMusicRoomState(roomCode,uid){
    const roomSn=await rtdb.ref(`watchRooms/${roomCode}`).once('value');
    if(!roomSn.exists())throw new Error('Sala não encontrada.');
    const room=roomSn.val()||{};
    if(!room.members?.[uid])throw new Error('Entre na sala antes de usar música.');
    const voiceSn=await rtdb.ref(`watchVoice/${roomCode}/${uid}/audio`).once('value');
    if(voiceSn.val()!==true)throw new Error('Entre na chamada de voz para usar a música da sala.');
    return room;
  }
  function watchMusicRoomPlanFromRoom(room={}){
    if(room.musicPlan?.active)return{...room.musicPlan,active:true};
    const legacy=Object.entries(room.musicAccess||{}).find(([,v])=>v?.active);
    if(!legacy)return null;
    const [activatedBy,row]=legacy;
    return{
      active:true,
      activatedBy,
      activatedAt:Number(row?.activatedAt||Date.now()),
      activationCost:Number(row?.activationCost||50),
      premiumAtActivation:!!row?.premiumAtActivation,
      premium:!!row?.premiumAtActivation,
      used:Math.max(0,Number(row?.used||0)),
      migratedFromLegacy:true
    };
  }
  async function ensureWatchMusicRoomPlan(roomCode,room={}){
    const plan=watchMusicRoomPlanFromRoom(room);
    if(!plan)return null;
    if(!room.musicPlan?.active){
      await rtdb.ref(`watchRooms/${roomCode}/musicPlan`).set(plan);
      room.musicPlan=plan;
    }
    return plan;
  }
  async function processWatchMusicActivate(uid,jid,data,jobId=''){
    const roomCode=String(data.roomCode||'').trim().toUpperCase();
    if(!roomCode)throw new Error('Sala inválida.');
    const room=await watchMusicRoomState(roomCode,uid);
    const existingPlan=await ensureWatchMusicRoomPlan(roomCode,room);
    if(existingPlan?.active)return{alreadyActive:true,cost:0,plan:existingPlan,premium:!!existingPlan.premiumAtActivation};
    if(!jid)throw new Error('Vincule sua conta à Charlotte para ativar a música da sala.');

    const cost=50,balance=balanceFor(jid);
    if(balance<cost)throw new Error(`Você precisa de ₹${cost} para ativar a música nesta sala. Saldo: ₹${balance}.`);
    if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
    // Uma trava na sala é registrada ANTES do débito. Em caso de reinício
    // durante a cobrança, a operação passa por revisão: NUNCA debitar duas vezes.
    const lock=rtdb.ref(`watchRooms/${roomCode}/musicActivationLock`);
    const claim=await lock.transaction(current=>current?undefined:{status:'processing',jobId,uid,startedAt:Date.now()},undefined,false);
    if(!claim.committed)throw new Error('Ativação pendente de confirmação. Não pague novamente.');
    const premium=readPremium(jid).active,activatedAt=Date.now();
    const access={active:true,activatedAt,activationCost:cost,used:0,premiumAtActivation:premium};
    const plan={active:true,activatedBy:uid,activatedAt,activationCost:cost,used:0,premiumAtActivation:premium,premium};
    try{
      await economy.delkoin(jid,cost);
      await rtdb.ref().update({
        [`watchRooms/${roomCode}/musicAccess/${uid}`]:access,
        [`watchRooms/${roomCode}/musicPlan`]:plan,
        [`watchRooms/${roomCode}/musicActivationLock/status`]:'done',
        [`watchRooms/${roomCode}/musicActivationLock/finishedAt`]:Date.now()
      });
    }catch(e){
      await lock.update({status:'review',reviewAt:Date.now(),error:'Conferir cobrança e ativação'}).catch(()=>{});
      throw new Error('Ativação em verificação; confira a sala antes de solicitar outra cobrança.');
    }
    // O estado da sala já está publicado. A sincronização da carteira não
    // deve prolongar a resposta do botão de música.
    syncAccount(uid,jid).catch(e=>logger.log('[WATCH MUSIC] atualização de saldo:',e.message));
    return{alreadyActive:false,cost,access,plan,premium};
  }
  async function processWatchMusicAdd(uid,jid,data,jobId=''){
    const roomCode=String(data.roomCode||'').trim().toUpperCase(),query=String(data.query||'').trim().slice(0,160);
    if(!roomCode||!query)throw new Error('Informe a sala e a música.');
    const room=await watchMusicRoomState(roomCode,uid);
    const plan=await ensureWatchMusicRoomPlan(roomCode,room);
    if(!plan?.active)throw new Error('A Charlotte Music ainda não foi ativada nesta sala. Qualquer participante pode ativar por ₹50.');

    let video=null;
    const ytId=(()=>{
      try{
        if(!/^https?:\/\//i.test(query))return'';
        const u=new URL(query);
        if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0]||'';
        if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/]+)/)?.[1]||'';
      }catch{}
      return'';
    })();
    // Link direto funciona sem serviço de pesquisa externo nem travar o bot.
    if(ytId&&/^[A-Za-z0-9_-]{11}$/.test(ytId)){
      video={videoId:ytId,title:'Vídeo do YouTube',url:`https://www.youtube.com/watch?v=${ytId}`,seconds:0};
    }else{
      const yts=safeRequire('yt-search');if(!yts)throw new Error('Busca de música indisponível no bot. Use um link do YouTube.');
      let timeout;
      try{
        const found=await Promise.race([
          Promise.resolve().then(()=>yts(query)),
          new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Busca demorou demais. Use o link da música no YouTube.')),9000);timeout.unref?.()})
        ]);
        video=found?.videos?.[0];
      }finally{clearTimeout(timeout)}
    }
    if(!video?.videoId)throw new Error('Música não encontrada.');

    const premium=!!plan.premiumAtActivation,used=Math.max(0,Number(plan.used||0));
    const cost=premium?0:(used<10?0:5);
    if(cost>0){
      if(!jid)throw new Error(`As 10 músicas inclusas da sala acabaram. Vincule a Charlotte para pagar ₹${cost} por esta faixa.`);
      const balance=balanceFor(jid);
      if(balance<cost)throw new Error(`As 10 músicas inclusas da sala acabaram. Você precisa de ₹${cost} para adicionar esta faixa.`);
      if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
      const receiptRef=rtdb.ref(`watchRooms/${roomCode}/musicPaidJobs/${jobId}`);
      const claim=await receiptRef.transaction(v=>v?undefined:{uid,cost,status:'processing',at:Date.now()},undefined,false);
      if(!claim.committed)throw new Error('Esta música já tem uma cobrança pendente; verifique a fila.');
      try{await economy.delkoin(jid,cost)}catch(e){
        await receiptRef.update({status:'review',at:Date.now()}).catch(()=>{});
        throw new Error('Cobrança da música em verificação. Não tente novamente até conferir o saldo.');
      }
    }

    const queueRows=await compactWatchMusicQueue(roomCode,room.musicQueue||{});const queueEntries=queueRows.map(x=>[x.id,x]);
    const qref=rtdb.ref(`watchRooms/${roomCode}/musicQueue`).push(),createdAt=Date.now();
    const item={
      id:qref.key,
      title:String(video.title||query).slice(0,120),
      videoId:video.videoId,
      url:video.url||`https://youtube.com/watch?v=${video.videoId}`,
      requestedBy:uid,
      requestedName:(await rtdb.ref(`directory/${uid}/nome`).once('value')).val()||'Participante',
      createdAt,
      startedAt:queueEntries.length?null:createdAt,
      durationSec:Math.max(0,Number(video.seconds||0)),
      cost,
      included:cost===0,
      sourceJobId:String(jobId||'')
    };
    const patch={};
    patch[`watchRooms/${roomCode}/musicQueue/${qref.key}`]=item;
    patch[`watchRooms/${roomCode}/musicPlan/used`]=used+1;
    patch[`watchRooms/${roomCode}/musicPlan/lastAddedAt`]=createdAt;
    patch[`watchRooms/${roomCode}/musicPlan/lastAddedBy`]=uid;
    try{
      if(cost>0)patch[`watchRooms/${roomCode}/musicPaidJobs/${jobId}/status`]='done';
      await rtdb.ref().update(patch);
    }catch(e){
      if(cost>0)await rtdb.ref(`watchRooms/${roomCode}/musicPaidJobs/${jobId}`).update({status:'review',at:Date.now()}).catch(()=>{});
      throw new Error('Música aguardando confirmação de gravação; não repita cobrança.');
    }
    if(jid)syncAccount(uid,jid).catch(e=>logger.log('[WATCH MUSIC] atualização de saldo:',e.message));
    return{item,cost,premium,used:used+1,includedRemaining:premium?null:Math.max(0,10-(used+1)),roomWide:true};
  }
  async function startNextWatchMusic(roomCode,room){
    const entries=Object.entries(room?.musicQueue||{}).sort((a,b)=>Number(a[1]?.createdAt||0)-Number(b[1]?.createdAt||0));
    if(!entries.length)return null;
    const [nextId,next]=entries[0];
    if(!Number(next?.startedAt||0))await rtdb.ref(`watchRooms/${roomCode}/musicQueue/${nextId}/startedAt`).set(Date.now());
    return nextId;
  }
  async function processWatchMusicSkip(uid,data){
    const roomCode=String(data.roomCode||'').trim().toUpperCase();
    const roomSn=await rtdb.ref(`watchRooms/${roomCode}`).once('value');if(!roomSn.exists())throw new Error('Sala não encontrada.');
    const room=roomSn.val();if(room.meta?.ownerUid!==uid)throw new Error('Somente o host pode pular a música.');
    const entries=(await compactWatchMusicQueue(roomCode,room.musicQueue||{})).map(x=>[x.id,x]);
    if(!entries.length)return{skipped:false};
    const currentId=entries[0][0];
    await rtdb.ref(`watchRooms/${roomCode}/musicQueue/${currentId}`).remove();
    const fresh=(await rtdb.ref(`watchRooms/${roomCode}`).once('value')).val()||{};
    const nextId=await startNextWatchMusic(roomCode,fresh);
    return{skipped:true,currentId,nextId};
  }
  async function processWatchMusicAdvance(uid,data){
    const roomCode=String(data.roomCode||'').trim().toUpperCase(),currentId=String(data.currentId||'').trim();
    if(!roomCode||!currentId)return{advanced:false};
    const room=await watchMusicRoomState(roomCode,uid);
    const entries=(await compactWatchMusicQueue(roomCode,room.musicQueue||{})).map(x=>[x.id,x]);
    if(!entries.length||entries[0][0]!==currentId)return{advanced:false};
    await rtdb.ref(`watchRooms/${roomCode}/musicQueue/${currentId}`).remove();
    const fresh=(await rtdb.ref(`watchRooms/${roomCode}`).once('value')).val()||{};
    const nextId=await startNextWatchMusic(roomCode,fresh);
    return{advanced:true,nextId};
  }


  function sanitizeStoreItem(raw={}){
    const idValue=String(raw.id||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(idValue))throw new Error('ID inválido. Use letras, números, _ ou -.');
    const name=String(raw.name||'').trim().slice(0,60);if(!name)throw new Error('Informe o nome do item.');
    const price=Math.max(0,Math.min(10000000,Math.floor(Number(raw.price||0))));
    const slot=String(raw.slot||'').trim().toLowerCase();if(!['cover','decor','frame','effect','name','aura','badge','theme'].includes(slot))throw new Error('Tipo de personalização inválido.');
    const mediaUrl=String(raw.mediaUrl||'').trim().slice(0,1200);if(['cover','decor'].includes(slot)&&!/^https:\/\//i.test(mediaUrl))throw new Error('Use uma URL HTTPS para o GIF ou sprite.');
    const mediaKind=String(raw.mediaKind||(['decor'].includes(slot)?'sprite':'gif')).trim().toLowerCase().slice(0,20);
    return{id:idValue,name,price,slot,mediaUrl,mediaKind,active:true,updatedAt:Date.now()};
  }
  async function processAdminStoreUpsert(uid,data){if(!await siteAdmin(uid))throw new Error('Apenas o host pode editar a loja.');const item=sanitizeStoreItem(data.item||{});if(CUSTOMIZATION_CATALOG[item.id])throw new Error('Esse ID já pertence a um item fixo da loja.');await rtdb.ref(`siteStoreCatalog/${item.id}`).set(item);return{item};}
  async function processAdminStoreDelete(uid,data){if(!await siteAdmin(uid))throw new Error('Apenas o host pode editar a loja.');const itemId=String(data.itemId||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(itemId))throw new Error('Item inválido.');await rtdb.ref(`siteStoreCatalog/${itemId}`).remove();return{itemId};}
  async function processAdminGrantCurrency(uid,data){
    if(!await siteAdmin(uid))throw new Error('Apenas o host pode alterar rúpias.');const targetUid=String(data.targetUid||'').trim(),amount=Math.trunc(Number(data.amount||0));if(!targetUid||!amount||Math.abs(amount)>10000000)throw new Error('Valor inválido.');const jid=await linkedJidByUid(targetUid);if(!jid)throw new Error('Esse usuário ainda não vinculou a Charlotte.');
    if(amount>0){if(typeof economy.addkoin!=='function')throw new Error('Sistema de rúpias indisponível.');await economy.addkoin(jid,amount)}else{if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias indisponível.');await economy.delkoin(jid,Math.min(Math.abs(amount),balanceFor(jid)))}
    const balance=balanceFor(jid);await syncAccount(targetUid,jid).catch(()=>{});await notifySite(targetUid,{type:'admin_economy',title:'Saldo atualizado',text:`Seu saldo na Gremory foi atualizado para ₹${balance}.`,link:'#home'}).catch(()=>{});return{targetUid,balance};
  }
  async function processAdminGrantPremium(uid,data){
    if(!await siteAdmin(uid))throw new Error('Apenas o host pode conceder Premium.');const targetUid=String(data.targetUid||'').trim(),days=Math.max(1,Math.min(3650,Math.floor(Number(data.days||0))));if(!targetUid)throw new Error('Usuário inválido.');const jid=await linkedJidByUid(targetUid);if(!jid)throw new Error('Esse usuário ainda não vinculou a Charlotte.');if(typeof premiumLib.addPremiumUser!=='function')throw new Error('Sistema Premium indisponível.');
    const db=readJson(premiumPath,[]);premiumLib.addPremiumUser(jid,`${days}d`,db);writeJson(premiumPath,db);await syncAccount(targetUid,jid).catch(()=>{});await notifySite(targetUid,{type:'premium',title:'Premium ativado',text:`Seu Premium foi ativado por ${days} dia${days===1?'':'s'}.`,link:'#premium'}).catch(()=>{});await sendWhats(jid,`💎 Seu Premium Gremory foi ativado por ${days} dia${days===1?'':'s'}.`).catch(()=>{});return{targetUid,days,active:true};
  }

  const MAX_BACKUP_JSON_BYTES=8*1024*1024;
  const PROJECT_BACKUP_ROOTS=['database','db/json','settings/Grupo/Json','settings/Privado','Games/Json'];
  function backupFileKey(rel,scope='project'){return crypto.createHash('sha256').update(`${scope}:${String(rel).replace(/\\/g,'/')}`).digest('hex').slice(0,32)}
  function backupDataDir(){const raw=String(process.env.GREMORY_DATA_DIR||'').trim();return raw?path.resolve(raw):''}
  function normalizedBackupRel(rel=''){return String(rel||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/, '');}
  function safeProjectBackupRel(rel=''){
    const clean=normalizedBackupRel(rel);if(!clean||clean.includes('\0')||clean.split('/').includes('..')||!clean.toLowerCase().endsWith('.json'))return false;
    return PROJECT_BACKUP_ROOTS.some(root=>clean===root||clean.startsWith(root+'/'));
  }
  function safeDataBackupRel(rel=''){
    const clean=normalizedBackupRel(rel);if(!clean||clean.includes('\0')||clean.split('/').includes('..')||!clean.toLowerCase().endsWith('.json'))return false;
    const parts=clean.toLowerCase().split('/');return !parts.some(x=>['node_modules','session','sessions','tmp','.git'].includes(x));
  }
  function backupTargetPath(scope,rel){
    const clean=normalizedBackupRel(rel),kind=String(scope||'project')==='data'?'data':'project';
    if(kind==='project'){if(!safeProjectBackupRel(clean))throw new Error(`Caminho de backup inválido: ${clean}`);const target=path.resolve(rootDir,clean);if(!target.startsWith(path.resolve(rootDir)+path.sep))throw new Error('Destino de backup fora do projeto.');return target;}
    const base=backupDataDir();if(!base)throw new Error('GREMORY_DATA_DIR não está configurado para restaurar os dados persistentes.');if(!safeDataBackupRel(clean))throw new Error(`Caminho de dados inválido: ${clean}`);const target=path.resolve(base,clean);if(target!==base&&!target.startsWith(base+path.sep))throw new Error('Destino de backup fora de GREMORY_DATA_DIR.');return target;
  }
  function collectOperationalJsonFiles(){
    const files=[],seenFull=new Set();
    const addTree=(base,scope,relBase='')=>{
      if(!base||!fs.existsSync(base))return;
      const walk=(dir)=>{let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return}for(const e of entries){if(['node_modules','session','sessions','tmp','.git'].includes(e.name))continue;const full=path.join(dir,e.name);if(e.isDirectory()){walk(full);continue}if(!(e.isFile()||e.isSymbolicLink())||!e.name.toLowerCase().endsWith('.json'))continue;try{if(!fs.statSync(full).isFile())continue}catch{continue}let real;try{real=fs.realpathSync(full)}catch{real=path.resolve(full)}if(seenFull.has(real))continue;seenFull.add(real);const rel=normalizedBackupRel(path.relative(base,full));const storedRel=scope==='project'?normalizedBackupRel(path.posix.join(relBase.replace(/\\/g,'/'),rel)):rel;if(scope==='project'&&!safeProjectBackupRel(storedRel))continue;if(scope==='data'&&!safeDataBackupRel(storedRel))continue;files.push({full,rel:storedRel,scope,key:backupFileKey(storedRel,scope)})}};walk(base);
    };
    for(const root of PROJECT_BACKUP_ROOTS)addTree(path.join(rootDir,root),'project',root);
    const dataDir=backupDataDir();if(dataDir)addTree(dataDir,'data','');
    return files.sort((a,b)=>`${a.scope}:${a.rel}`.localeCompare(`${b.scope}:${b.rel}`));
  }
  async function assessOperationalBackupState(){
    try{
      const manifest=(await rtdb.ref('botJsonBackups/manifest').once('value').catch(()=>null))?.val?.()||{},remote=Object.entries(manifest);backupAssessmentDone=true;
      if(!remote.length){backupRecoveryRequired=false;await rtdb.ref('botBackupStatus').update({recoveryRequired:false,autoBackupPaused:false,restartRequired:false,assessmentAt:Date.now()}).catch(()=>{});return{recoveryRequired:false,remoteFiles:0,matched:0}}
      const local=collectOperationalJsonFiles(),byId=new Map();
      for(const f of local){try{const raw=fs.readFileSync(f.full),hash=crypto.createHash('sha256').update(raw).digest('hex');byId.set(`${f.scope}:${f.rel}`,hash)}catch{}}
      let matched=0,missing=0,mismatch=0;
      for(const[,m]of remote){const scope=String(m?.scope||'project')==='data'?'data':'project',rel=normalizedBackupRel(m?.path||''),localHash=byId.get(`${scope}:${rel}`);if(!localHash)missing++;else if(String(localHash)===String(m?.hash||''))matched++;else mismatch++;}
      backupRecoveryRequired=missing>0||mismatch>0;
      await rtdb.ref('botBackupStatus').update({recoveryRequired:backupRecoveryRequired,autoBackupPaused:backupRecoveryRequired,restartRequired:false,assessmentAt:Date.now(),remoteFiles:remote.length,matchedFiles:matched,missingFiles:missing,mismatchedFiles:mismatch}).catch(()=>{});
      return{recoveryRequired:backupRecoveryRequired,remoteFiles:remote.length,matched,missing,mismatch};
    }catch(e){backupAssessmentDone=true;backupRecoveryRequired=true;await rtdb.ref('botBackupStatus').update({recoveryRequired:true,autoBackupPaused:true,assessmentAt:Date.now(),lastError:`Falha ao verificar backup: ${String(e.message||e).slice(0,300)}`}).catch(()=>{});return{recoveryRequired:true,error:e.message}}
  }
  async function backupOperationalJsons(force=false,{allowRecoveryOverwrite=false}={}){
    if(backupRecoveryRequired&&!allowRecoveryOverwrite)throw new Error('Backup remoto protegido: esta instalação precisa restaurar o Firebase ou confirmar explicitamente a substituição do backup.');
    if(backupRunning)return{busy:true};backupRunning=true;const startedAt=Date.now();let files=0,changed=0,skipped=0,totalBytes=0;
    try{
      const previous=(await rtdb.ref('botJsonBackups/hashes').once('value').catch(()=>null))?.val?.()||{},hashPatch={},manifest={};
      for(const f of collectOperationalJsonFiles()){
        try{
          const stat=fs.statSync(f.full);if(stat.size>MAX_BACKUP_JSON_BYTES){skipped++;logger.log('[FIREBASE BACKUP] ignorado por tamanho:',f.rel,stat.size);continue}const raw=fs.readFileSync(f.full);JSON.parse(raw.toString('utf8'));const hash=crypto.createHash('sha256').update(raw).digest('hex'),key=f.key;files++;totalBytes+=raw.length;manifest[key]={path:f.rel,scope:f.scope,size:raw.length,hash,updatedAt:stat.mtimeMs||Date.now()};hashPatch[key]=hash;
          if(force||previous[key]!==hash){const gz=zlib.gzipSync(raw,{level:6}).toString('base64');await rtdb.ref(`botJsonBackups/files/${key}`).set({path:f.rel,scope:f.scope,hash,size:raw.length,encoding:'gzip-base64',data:gz,updatedAt:Date.now()});changed++}
        }catch(e){skipped++;logger.log('[FIREBASE BACKUP] arquivo:',f.rel,e.message)}
      }
      await rtdb.ref('botJsonBackups/hashes').set(hashPatch);await rtdb.ref('botJsonBackups/manifest').set(manifest);backupRecoveryRequired=false;const status={lastSuccessAt:Date.now(),startedAt,files,changed,skipped,totalBytes,recoveryRequired:false,autoBackupPaused:false,restartRequired:false};await rtdb.ref('botBackupStatus').set(status);logger.log(`✅ FIREBASE JSON BACKUP: ${files} arquivo(s), ${changed} alterado(s), ${skipped} ignorado(s)`);return status;
    }catch(e){await rtdb.ref('botBackupStatus').update({lastErrorAt:Date.now(),lastError:String(e.message||e).slice(0,400)}).catch(()=>{});throw e}finally{backupRunning=false}
  }
  async function restoreOperationalJsons(){
    if(restoreRunning)throw new Error('Já existe uma restauração em andamento.');if(backupRunning)throw new Error('Aguarde o backup em andamento terminar.');restoreRunning=true;const startedAt=Date.now();
    try{
      const manifest=(await rtdb.ref('botJsonBackups/manifest').once('value').catch(()=>null))?.val?.()||{},entries=Object.entries(manifest);if(!entries.length)throw new Error('Nenhum backup completo encontrado no Firebase.');
      const staged=[];let totalBytes=0;
      for(const[key,m]of entries){const scope=String(m?.scope||'project')==='data'?'data':'project',rel=normalizedBackupRel(m?.path||'');const target=backupTargetPath(scope,rel),sn=await rtdb.ref(`botJsonBackups/files/${key}`).once('value'),blob=sn.val();if(!blob?.data)throw new Error(`Backup ausente para ${rel}.`);if(String(blob.encoding||'')!=='gzip-base64')throw new Error(`Formato de backup inválido em ${rel}.`);let raw;try{raw=zlib.gunzipSync(Buffer.from(String(blob.data),'base64'))}catch{throw new Error(`Não consegui descompactar ${rel}.`)}if(raw.length>MAX_BACKUP_JSON_BYTES)throw new Error(`Arquivo ${rel} excede o limite de restauração.`);const hash=crypto.createHash('sha256').update(raw).digest('hex');if(String(hash)!==String(m.hash||blob.hash||''))throw new Error(`Integridade inválida em ${rel}.`);try{JSON.parse(raw.toString('utf8'))}catch{throw new Error(`JSON inválido no backup: ${rel}.`)}staged.push({target,raw,rel,scope});totalBytes+=raw.length;}
      for(const item of staged){fs.mkdirSync(path.dirname(item.target),{recursive:true});const tmp=`${item.target}.restore-${process.pid}-${Date.now()}.tmp`;fs.writeFileSync(tmp,item.raw);fs.renameSync(tmp,item.target);}
      backupRecoveryRequired=true;backupRestartRequired=true;const status={lastRestoreAt:Date.now(),restoreStartedAt:startedAt,restoredFiles:staged.length,restoredBytes:totalBytes,recoveryRequired:false,autoBackupPaused:true,restartRequired:true,lastError:null};await rtdb.ref('botBackupStatus').update(status);logger.log(`✅ FIREBASE JSON RESTORE: ${staged.length} arquivo(s). REINICIE A CHARLOTTE.`);return status;
    }catch(e){await rtdb.ref('botBackupStatus').update({lastRestoreErrorAt:Date.now(),lastRestoreError:String(e.message||e).slice(0,400)}).catch(()=>{});throw e}finally{restoreRunning=false}
  }
  async function processAdminBackupNow(uid,data={}){if(!await siteAdmin(uid))throw new Error('Apenas o host pode iniciar o backup.');return backupOperationalJsons(true,{allowRecoveryOverwrite:data?.confirmReplace===true})}
  async function processAdminRestoreBackup(uid){if(!await siteAdmin(uid))throw new Error('Apenas o host pode restaurar a Charlotte.');return restoreOperationalJsons()}
  async function createUniqueLinkCode(){for(let i=0;i<12;i++){const code=randomLinkCode(6),sn=await rtdb.ref('charlotteLinkRequests').orderByChild('code').equalTo(code).once('value');if(!sn.exists())return code}throw new Error('Não consegui gerar um código único. Tente novamente.')}
  async function processAdminCreateLinkCode(uid,data){if(!await siteAdmin(uid))throw new Error('Apenas o host pode gerar códigos de vínculo.');const targetUid=String(data?.targetUid||'').trim();if(!targetUid)throw new Error('Usuário inválido.');try{await admin.auth?.().getUser?.(targetUid)}catch{}const code=await createUniqueLinkCode(),createdAt=Date.now(),expiresAt=createdAt+10*60*1000;await rtdb.ref(`charlotteLinkRequests/${targetUid}`).set({uid:targetUid,code,createdAt,expiresAt,createdByAdmin:uid});return{targetUid,code,expiresAt}}

  async function processAdminResetCharlotteLink(uid,data){
    if(!await siteAdmin(uid))throw new Error('Apenas o host pode resetar vínculos.');
    const targetUid=String(data?.targetUid||'').trim();if(!targetUid)throw new Error('Usuário inválido.');
    const current=await rtdb.ref(`charlottePrivate/${targetUid}`).once('value').catch(()=>null),old=current?.val?.()||{},oldJid=cleanJid(old.whatsappJid||'');
    // NÃO apaga economyBackups, perfil, amigos, inventário, Pokémon nem a
    // economia local da Charlotte. Limpa somente o pareamento e caches do site.
    await Promise.all([
      rtdb.ref(`charlottePrivate/${targetUid}`).remove(),
      rtdb.ref(`charlottePublic/${targetUid}`).set({status:'unlinked',unlinkedAt:now(),resetBy:uid}),
      rtdb.ref(`charlotteLinkRequests/${targetUid}`).remove(),
      rtdb.ref(`charlotteSync/${targetUid}`).remove(),
      rtdb.ref(`siteBridgeJobs/${targetUid}`).remove(),
      rtdb.ref(`siteBridgeResults/${targetUid}`).remove()
    ]);
    return{targetUid,hadLink:!!oldJid,whatsappMasked:oldJid?maskJid(oldJid):''};
  }

  async function siteAdmin(uid){
    try{const user=await admin.auth?.().getUser?.(uid);if(String(user?.email||'').trim().toLowerCase()==='losermodder@gmail.com')return true}catch{}
    const sn=await rtdb.ref(`profiles/${uid}`).once('value').catch(()=>null);
    return String(sn?.val?.()?.email||'').trim().toLowerCase()==='losermodder@gmail.com';
  }
  function raidBossFromPool(){
    const base={...SITE_RAID_BOSSES[crypto.randomInt(0,SITE_RAID_BOSSES.length)]};
    const tier=crypto.randomInt(1,6),level=20+tier*10+crypto.randomInt(0,8),maxHp={1:1600,2:2400,3:3300,4:4400,5:5800}[tier];
    return{tier,boss:{uid:`raid_${base.dex}`,dex:base.dex,name:base.name,level,types:base.types,maxHp,hp:maxHp,attack:80+level*2,defense:65+level*1.7,sprite:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${base.dex}.png`,moves:[{name:'Investida',power:55,type:base.types[0]}]},maxHp};
  }
  function pokemonModeGroups(){
    const raw=readJson(pokemonModePath,{groups:{}}),groups=(raw&&raw.groups&&typeof raw.groups==='object')?raw.groups:raw;if(!groups||typeof groups!=='object')return[];
    return Object.entries(groups).filter(([jid,cfg])=>String(jid).endsWith('@g.us')&&(cfg===true||cfg?.ativo===true||cfg?.active===true||cfg?.enabled===true)).map(([jid])=>jid);
  }
  async function notifyRaidPokemonGroups(raid){
    const groups=pokemonModeGroups();if(!groups.length)return{sent:0};let sent=0;
    const caption=`⚔️ *RAID GLOBAL GREMORY*\n\n${raid.boss.name} • Tier ${raid.tier}\n${raid.boss.types.map(typeName).join(' / ')}\n❤️ ${raid.maxHp} HP\n⏳ 30 minutos\n\nEntre no site para lutar com a comunidade:\n${siteOrigin}/#pokemon`;
    for(const jid of groups){try{await sock.groupMetadata(jid).catch(()=>null);if(raid.boss.sprite)await sock.sendMessage(jid,{image:{url:raid.boss.sprite},caption});else await sock.sendMessage(jid,{text:caption});sent++}catch(e){logger.log('[SITE RAID] grupo:',jid,e.message)}await new Promise(r=>setTimeout(r,220))}return{sent};
  }
  async function notifyRaidStarted(raid){
    await notifyAllSiteUsers({title:'⚔️ Raid Pokémon iniciada!',text:`${raid.boss.name} apareceu. Entre no Centro Pokémon para lutar com todos.`,type:'pokemon_raid',link:'#pokemon'}).catch(()=>{});
    notifyRaidPokemonGroups(raid).catch(e=>logger.log('[SITE RAID] anúncio nos grupos:',e.message));
    const ps=await rtdb.ref('profiles').once('value').catch(()=>null);const profiles=ps?.val?.()||{};
    for(const[uid,p]of Object.entries(profiles)){
      if(!p?.raidWhatsappNotify)continue;const jid=await linkedJidByUid(uid).catch(()=>null);if(jid)await sendWhats(jid,`⚔️ *RAID GLOBAL GREMORY*\n${raid.boss.name} (${raid.boss.types.map(typeName).join(' / ')}) apareceu no site!\n\nEntre em ${siteOrigin}/#pokemon para atacar.`);await new Promise(r=>setTimeout(r,80));
    }
  }
  async function startSiteRaid({by='auto',force=false}={}){
    const rr=rtdb.ref('pokemonSiteRaid/current'),sn=await rr.once('value'),existing=sn.val();
    if(existing?.status==='active'&&Number(existing.expiresAt||0)>Date.now()&&!force)throw new Error('Já existe uma raid ativa.');
    const pick=raidBossFromPool(),startedAt=Date.now(),raid={id:id('sraid'),status:'active',tier:pick.tier,boss:pick.boss,hp:pick.maxHp,maxHp:pick.maxHp,startedAt,expiresAt:startedAt+30*60*1000,startedBy:by,participants:{},log:{}};
    await rr.set(raid);await rtdb.ref('pokemonSiteRaidConfig').update({lastStartedAt:startedAt,lastAutoAt:by==='auto'?startedAt:((await rtdb.ref('pokemonSiteRaidConfig/lastAutoAt').once('value')).val()||0)}).catch(()=>{});await notifyRaidStarted(raid);return raid;
  }
  async function finishSiteRaidRewards(raidId){
    const rr=rtdb.ref('pokemonSiteRaid/current');let claimed=null;
    const tx=await rr.transaction(cur=>{if(!cur||cur.id!==raidId||cur.status!=='defeated'||cur.rewardsClaimed)return;cur.status='finished';cur.finishedAt=Date.now();cur.rewardsClaimed=true;return cur},undefined,false);
    if(!tx?.committed)return;claimed=tx.snapshot.val();const rows=Object.entries(claimed.participants||{}).sort((a,b)=>Number(b[1].damage||0)-Number(a[1].damage||0));
    const teamBonus=Math.min(5,Math.floor(rows.length/2));
    for(let i=0;i<rows.length;i++){const[uid,row]=rows[i],jid=await linkedJidByUid(uid).catch(()=>null);if(!jid)continue;const reward=150+(i===0?150:i===1?80:i===2?40:0),premier=3+Number(claimed.tier||1)+teamBonus+(i===0?2:i===1?1:0);if(typeof economy.addkoin==='function')await economy.addkoin(jid,reward);try{const{db,user}=pokemonState(jid);user.items=user.items&&typeof user.items==='object'?user.items:{};user.items.premierball=Math.max(0,Number(user.items.premierball||user.items.premierBall||0))+premier;if(user.items.premierBall!=null)user.items.premierBall=user.items.premierball;savePokemonDb(db)}catch(e){logger.log('[SITE RAID] Premier Ball:',e.message)}await syncAccount(uid,jid).catch(()=>{});await notifySite(uid,{type:'pokemon_raid',title:i===0?'🏆 Raid vencida • maior dano':'🏆 Raid vencida',text:`${claimed.boss.name} foi derrotado. Você causou ${row.damage||0} de dano, recebeu ₹${reward} e ${premier} Premier Ball${premier===1?'':'s'}${teamBonus?` • bônus de equipe +${teamBonus}`:''}.`,link:'#pokemon'}).catch(()=>{});}
    await notifyAllSiteUsers({title:'🏆 Raid concluída!',text:`${claimed.boss.name} foi derrotado por ${rows.length} treinador(es).`,type:'pokemon_raid',link:'#pokemon'}).catch(()=>{});
  }
  async function processSiteRaidAttack(uid,jid,data){
    const rr=rtdb.ref('pokemonSiteRaid/current'),sn=await rr.once('value');if(!sn.exists())throw new Error('Nenhuma raid ativa.');const raid=sn.val();if(raid.status!=='active'||Number(raid.expiresAt||0)<=Date.now())throw new Error('Essa raid terminou.');
    const{db,user}=pokemonState(jid);let mon=firstHealthy(user);if(!mon)throw new Error('Sua equipe está desmaiada.');const pub=publicMon(mon),moves=pub.moves.length?pub.moves:[{name:'Ataque rápido',power:40,type:'normal'}],move=moves[clamp(data.moveIndex,0,moves.length-1)]||moves[0],hit=calcDamageDetailed(pub,raid.boss,move,{raid:true}),stamp=Date.now();let cooldown=false,defeated=false;
    const dirSnap=await rtdb.ref(`directory/${uid}`).once('value').catch(()=>null);const trainerName=stateSafeName(dirSnap?.val?.()?.nome)||'Treinador';
    const tx=await rr.transaction(cur=>{if(!cur||cur.id!==raid.id||cur.status!=='active'||Number(cur.expiresAt||0)<=stamp)return;cur.participants=cur.participants||{};const prev=cur.participants[uid]||{};if(stamp-Number(prev.lastAttackAt||0)<8000){cooldown=true;return;}const dmg=Math.min(Number(cur.hp||0),hit.dano);cur.hp=Math.max(0,Number(cur.hp||0)-dmg);cur.participants[uid]={uid,name:trainerName,damage:Number(prev.damage||0)+dmg,attacks:Number(prev.attacks||0)+1,lastAttackAt:stamp};cur.log=cur.log||{};cur.log[id('hit')]={uid,text:`${pub.name} usou ${move.name} e causou ${dmg}${hit.effectText?` • ${hit.effectText}`:''}.`,at:stamp};if(cur.hp<=0){cur.status='defeated';cur.defeatedAt=stamp;defeated=true}return cur},undefined,false);
    if(cooldown)throw new Error('Espere 8 segundos antes do próximo ataque.');if(!tx?.committed)throw new Error('A raid mudou. Tente novamente.');
    if(defeated)finishSiteRaidRewards(raid.id).catch(e=>logger.log('[SITE RAID] recompensa:',e.message));
    return{damage:hit.dano,effectText:hit.effectText,multiplier:hit.multiplier,critico:hit.critico,bossHp:tx.snapshot.val()?.hp||0};
  }
  function stateSafeName(value){return String(value||'').trim().slice(0,50);}
  async function processSiteRaidStart(uid){if(!await siteAdmin(uid))throw new Error('Apenas o host pode iniciar raid manualmente.');return{raid:await startSiteRaid({by:`site:${uid}`})};}
  async function processSiteRaidAuto(uid,data){if(!await siteAdmin(uid))throw new Error('Apenas o host pode alterar raids automáticas.');const enabled=!!data.enabled;await rtdb.ref('pokemonSiteRaidConfig').update({auto:enabled,intervalMs:3600000,updatedAt:Date.now()});if(enabled)await maybeAutoSiteRaid();return{enabled};}
  async function maybeAutoSiteRaid(){
    const cfg=(await rtdb.ref('pokemonSiteRaidConfig').once('value').catch(()=>null))?.val?.()||{};const raid=(await rtdb.ref('pokemonSiteRaid/current').once('value').catch(()=>null))?.val?.()||null;const t=Date.now();
    if(raid?.status==='active'&&Number(raid.expiresAt||0)<=t){await rtdb.ref('pokemonSiteRaid/current').update({status:'expired',finishedAt:t}).catch(()=>{});await notifyAllSiteUsers({title:'Raid encerrada',text:`${raid.boss?.name||'O boss'} escapou.`,type:'pokemon_raid',link:'#pokemon'}).catch(()=>{});}
    if(!cfg.auto)return;const fresh=(await rtdb.ref('pokemonSiteRaid/current').once('value').catch(()=>null))?.val?.()||null;if(fresh?.status==='active'&&Number(fresh.expiresAt||0)>t)return;const last=Number(cfg.lastAutoAt||cfg.lastStartedAt||0);if(!last||t-last>=3600000)await startSiteRaid({by:'auto'}).catch(e=>logger.log('[SITE RAID] auto:',e.message));
  }

  async function writeResult(uid,jobId,type,payload){const rr=rtdb.ref(`siteBridgeResults/${uid}/${jobId}`);await rr.set({ok:true,type,createdAt:now(),...payload});const timer=setTimeout(()=>rr.remove().catch(()=>{}),10*60*1000);timer.unref?.();}
  async function writeError(uid,jobId,type,e){const msg=String(e?.message||'Erro no bridge');await rtdb.ref(`siteBridgeResults/${uid}/${jobId}`).set({ok:false,type,error:msg,createdAt:now()}).catch(()=>{});await rtdb.ref(`charlottePublic/${uid}/lastError`).set(msg).catch(()=>{});}
  async function claimSiteBridgeJob(uid,jobId){
    const jobRef=rtdb.ref(`siteBridgeJobs/${uid}/${jobId}`);
    const startedAt=Date.now();
    const tx=await jobRef.transaction(current=>{
      if(!current||typeof current!=='object')return;
      const owner=String(current.__processingBy||'');
      const lockedAt=Number(current.__processingAt||0);
      // Um job em andamento não pode ser executado por outro listener/instância.
      // Locks antigos podem ser retomados depois de 2 minutos, caso um processo morra.
      if(owner&&Date.now()-lockedAt<120000)return;
      return{...current,__processingBy:bridgeInstanceId,__processingAt:startedAt};
    },undefined,false);
    const value=tx?.snapshot?.val?.()||null;
    return{claimed:!!tx?.committed&&value?.__processingBy===bridgeInstanceId,data:value};
  }
  async function processJobNow(uid,jobId,data){
    const claim=await claimSiteBridgeJob(uid,jobId).catch(e=>{logger.log('[SITE BRIDGE] claim:',e.message);return{claimed:false,data:null}});
    if(!claim.claimed){
      const lockedAt=Number(claim.data?.__processingAt||0);
      if(lockedAt&&Date.now()-lockedAt<120000){
        const delay=Math.max(1000,120500-(Date.now()-lockedAt));
        const retry=setTimeout(()=>processJob(uid,jobId,data),delay);retry.unref?.();
      }
      return;
    }
    data=claim.data||data;
    const type=String(data?.type||'');
    try{
      if(!data||typeof data!=='object')return;
      let payload={};const recoveryAllowed=new Set(['admin_restore_backup','admin_backup_now','admin_reset_charlotte_link','admin_create_link_code']);if(backupRestartRequired&&!recoveryAllowed.has(type))throw new Error('Backup restaurado. Reinicie a Charlotte para carregar os JSONs restaurados antes de continuar.');const jid=await linkedJidByUid(uid);const noLink=new Set(['ttt_create','ttt_move','ttt_exit','blackjack_create','blackjack_move','blackjack_exit','hangman_create','hangman_guess','hangman_exit','site_raid_start','site_raid_auto','watch_music_add','watch_music_skip','watch_music_advance','admin_grant_currency','admin_grant_premium','admin_premium_group_set','admin_store_upsert','admin_store_delete','admin_backup_now','admin_restore_backup','admin_reset_charlotte_link','admin_create_link_code','admin_feed_announce']);if(!jid&&!noLink.has(type))throw new Error('Conta não vinculada.');
      if(type==='sync_pokemon')payload={pokemon:await syncPokemon(uid,jid)};
      else if(type==='sync_account')payload=await syncAccount(uid,jid);
      else if(type==='daily_claim')payload=await processDaily(uid,jid);
      else if(type==='buy_customization')payload=await processBuyCustomization(uid,jid,data);
      else if(type==='equip_customization')payload=await processEquipCustomization(uid,data);
      else if(type==='premium_checkout')payload=await processPremiumCheckout(uid,jid,data);
      else if(type==='premium_rupias_buy')payload=await processPremiumRupiasBuy(uid,jid,data);
      else if(type==='premium_group_set')payload=await processPremiumGroupSet(uid,jid,data);
      else if(type==='send_download_link')payload=await processSendDownload(uid,jid,data);
      else if(type==='youtube_bot_download')payload=await processYoutubeDownload(uid,jid,data);
      else if(type==='pokemon_set_team')payload=await processSetTeam(uid,jid,data);
      else if(type==='pokemon_explore')payload=await processExplore(uid,jid);
      else if(type==='pokemon_wild_move')payload=await processWildMove(uid,jid,data);
      else if(type==='pokemon_wild_exit')payload=await processWildExit(uid);
      else if(type==='pokemon_capture')payload=await processCapture(uid,jid,data);
      else if(type==='pokemon_heal_start')payload=await processHealStart(uid,jid,data);
      else if(type==='pokemon_use_potion')payload=await processPokemonUsePotion(uid,jid,data);
      else if(type==='pokemon_buy_potion')payload=await processPokemonBuyPotion(uid,jid,data);
      else if(type==='duel_challenge')payload=await processChallenge(uid,data);
      else if(type==='duel_accept')payload=await processAccept(uid,data);
      else if(type==='duel_decline')payload=await processDecline(uid,data);
      else if(type==='duel_move')payload=await processMove(uid,data);
      else if(type==='duel_switch')payload=await processDuelSwitch(uid,data);
      else if(type==='duel_exit')payload=await processDuelExit(uid,data);
      else if(type==='site_raid_start')payload=await processSiteRaidStart(uid);
      else if(type==='site_raid_auto')payload=await processSiteRaidAuto(uid,data);
      else if(type==='site_raid_attack')payload=await processSiteRaidAttack(uid,jid,data);
      else if(type==='equip_achievement')payload=await equipCommunityAchievement(uid,jid,data.achievementId);
      else if(type==='admin_grant_currency')payload=await processAdminGrantCurrency(uid,data);
      else if(type==='admin_grant_premium')payload=await processAdminGrantPremium(uid,data);
      else if(type==='admin_premium_group_set')payload=await processAdminPremiumGroupSet(uid,data);
      else if(type==='admin_feed_announce')payload=await announceCommunityPost(uid,data.postId);
      else if(type==='admin_store_upsert')payload=await processAdminStoreUpsert(uid,data);
      else if(type==='admin_store_delete')payload=await processAdminStoreDelete(uid,data);
      else if(type==='admin_backup_now')payload=await processAdminBackupNow(uid,data);
      else if(type==='admin_restore_backup')payload=await processAdminRestoreBackup(uid);
      else if(type==='admin_create_link_code')payload=await processAdminCreateLinkCode(uid,data);
      else if(type==='admin_reset_charlotte_link')payload=await processAdminResetCharlotteLink(uid,data);
      else if(type==='ttt_create')payload=await processTttCreate(uid,data);
      else if(type==='ttt_move')payload=await withExclusiveKeys(gameActionLocks,['ttt:'+String(data.gameId||'')],()=>processTttMove(uid,data));
      else if(type==='ttt_exit')payload=await withExclusiveKeys(gameActionLocks,['ttt:'+String(data.gameId||'')],()=>processTttExit(uid,data));
      else if(type==='blackjack_create')payload=await processBlackjackCreate(uid,data);
      else if(type==='blackjack_move')payload=await withExclusiveKeys(gameActionLocks,['blackjack:'+String(data.gameId||'')],()=>processBlackjackMove(uid,data));
      else if(type==='blackjack_exit')payload=await withExclusiveKeys(gameActionLocks,['blackjack:'+String(data.gameId||'')],()=>processBlackjackExit(uid,data));
      else if(type==='hangman_create')payload=await processHangmanCreate(uid,data);
      else if(type==='hangman_guess')payload=await withExclusiveKeys(gameActionLocks,['hangman:'+String(data.gameId||'')],()=>processHangmanGuess(uid,data));
      else if(type==='hangman_exit')payload=await withExclusiveKeys(gameActionLocks,['hangman:'+String(data.gameId||'')],()=>processHangmanExit(uid,data));
      else if(type==='slots_spin')payload=await withExclusiveKeys(walletLocks,[jid],()=>processSlotsSpin(uid,jid,data));
      else if(type==='slots_settle')payload=await withExclusiveKeys(walletLocks,[jid],()=>processSlotsSettle(uid,jid,data,jobId));
      else if(type==='sync_identity')payload=await syncIdentity(uid,jid,data);
      else if(type==='tinder_profile_get')payload=await processTinderProfileGet(uid,jid);
      else if(type==='tinder_profile_save')payload=await processTinderProfileSave(uid,jid,data);
      else if(type==='tinder_feed')payload=await processTinderFeed(uid,jid,data);
      else if(type==='tinder_like')payload=await processTinderLike(uid,jid,data);
      else if(type==='watch_music_activate')payload=await withExclusiveKeys(gameActionLocks,['watchMusic:'+String(data.roomCode||'').toUpperCase()],()=>withExclusiveKeys(walletLocks,[jid],()=>processWatchMusicActivate(uid,jid,data,jobId)));
      else if(type==='watch_music_add')payload=await withExclusiveKeys(gameActionLocks,['watchMusic:'+String(data.roomCode||'').toUpperCase()],()=>withExclusiveKeys(walletLocks,[jid||'free:'+uid],()=>processWatchMusicAdd(uid,jid,data,jobId)));
      else if(type==='watch_music_skip')payload=await processWatchMusicSkip(uid,data);
      else if(type==='watch_music_advance')payload=await processWatchMusicAdvance(uid,data);
      else throw new Error('Ação do site não permitida.');
      await rtdb.ref(`charlottePublic/${uid}/lastError`).remove().catch(()=>{});await writeResult(uid,jobId,type,payload||{});
    }catch(e){logger.log(`[SITE BRIDGE] job ${type}:`,e.message);if(type==='slots_settle')await releaseFailedSlotReservation(uid,data,jobId).catch(()=>{});await writeError(uid,jobId,type,e)}finally{await rtdb.ref(`siteBridgeJobs/${uid}/${jobId}`).remove().catch(()=>{})}
  }
  function processJob(uid,jobId,data){
    // Enfileira cada pedido UMA VEZ. O listener não deve criar uma segunda fila,
    // pois isso faria a Promise do job aguardar a si mesma e bloquear o Slots.
    const prev=userQueues.get(uid)||Promise.resolve();
    const job=prev.catch(()=>{}).then(()=>processJobNow(uid,jobId,data));
    const tracked=job.catch(e=>logger.log('[SITE BRIDGE] fila:',e.message)).finally(()=>{
      if(userQueues.get(uid)===tracked)userQueues.delete(uid);
    });
    userQueues.set(uid,tracked);
    return tracked;
  }
  function watchUserJobs(uid){
    if(watchedUsers.has(uid))return;
    watchedUsers.add(uid);
    const userRef=rtdb.ref(`siteBridgeJobs/${uid}`);
    // Uma fila por usuário: impede giros simultâneos de lerem o mesmo saldo.
    const handler=sn=>{processJob(uid,sn.key,sn.val());};
    userRef.on('child_added',handler);
    watchedRefs.set(uid,{userRef,handler});
  }
  function startOperationalRuntime({allowAutoBackup=true}={}){if(backupRuntimeStarted)return;backupRuntimeStarted=true;processDueHealingJobs().catch(()=>{});healingTimer=setInterval(()=>processDueHealingJobs().catch(()=>{}),30000);healingTimer.unref?.();setTimeout(()=>syncLinkedAccounts().catch(()=>{}),600).unref?.();setTimeout(()=>restoreTinderFromFirebase().catch(()=>{}),900).unref?.();setTimeout(()=>maybeAutoSiteRaid().catch(()=>{}),1200).unref?.();setTimeout(()=>checkPremiumGroups().catch(()=>{}),1500).unref?.();syncTimer=setInterval(()=>syncLinkedAccounts().catch(()=>{}),180000);syncTimer.unref?.();raidTimer=setInterval(()=>maybeAutoSiteRaid().catch(()=>{}),30000);raidTimer.unref?.();premiumGroupTimer=setInterval(()=>checkPremiumGroups().catch(()=>{}),30000);premiumGroupTimer.unref?.();if(allowAutoBackup){setTimeout(()=>backupOperationalJsons(false).catch(e=>logger.log('[FIREBASE BACKUP] inicial:',e.message)),10000).unref?.();backupTimer=setInterval(()=>backupOperationalJsons(false).catch(e=>logger.log('[FIREBASE BACKUP] ciclo:',e.message)),10*60*1000);backupTimer.unref?.();}else logger.log('🛡️ BACKUP REMOTO PROTEGIDO: backup automático pausado, mas Slots/Raid/sync e demais funções continuam ativas.');}
  async function initializeOperationalRuntime(){const state=await assessOperationalBackupState();backupRestartRequired=false;if(state.recoveryRequired)logger.log(`🛟 BACKUP REMOTO DIFERENTE: ${state.remoteFiles||0} arquivo(s) no Firebase. O backup automático ficará pausado até restaurar ou confirmar substituição; a Charlotte continuará funcionando normalmente.`);startOperationalRuntime({allowAutoBackup:!state.recoveryRequired})}
  function start(){if(rootWatcher)return;rootWatcher=rtdb.ref('siteBridgeJobs');rootWatcher.on('child_added',sn=>watchUserJobs(sn.key));const timer=setTimeout(()=>initializeOperationalRuntime().catch(e=>logger.log('[FIREBASE BACKUP] avaliação:',e.message)),1500);timer.unref?.();logger.log('✅ GREMORY SITE BRIDGE ATIVO');}
  function stop(){try{if(rootWatcher)rootWatcher.off()}catch{}for(const{userRef,handler}of watchedRefs.values()){try{userRef.off('child_added',handler)}catch{}}watchedRefs.clear();watchedUsers.clear();userQueues.clear();walletLocks.clear();gameActionLocks.clear();rootWatcher=null;if(healingTimer){clearInterval(healingTimer);healingTimer=null;}if(syncTimer){clearInterval(syncTimer);syncTimer=null;}if(raidTimer){clearInterval(raidTimer);raidTimer=null;}if(premiumGroupTimer){clearInterval(premiumGroupTimer);premiumGroupTimer=null;}if(backupTimer){clearInterval(backupTimer);backupTimer=null;}syncingLinked=false;backupRuntimeStarted=false;}
  function rawIncomingText(info){
    return String(
      info?.message?.conversation||
      info?.message?.extendedTextMessage?.text||
      info?.message?.imageMessage?.caption||
      info?.message?.videoMessage?.caption||
      ''
    );
  }
  function rawCommandPayload(info,{dropFirstArg=false,fallback=''}={}){
    let raw=rawIncomingText(info);
    if(!raw)return String(fallback||'').trim();
    raw=raw.replace(/^\s*(?:\.#|\.\/|\/|\.|\?)?\S+[ \t]*/,'');
    if(dropFirstArg)raw=raw.replace(/^[ \t]*(?:site|web)\b[ \t]*/i,'');
    return raw.replace(/^\r?\n/,'').trim();
  }
  async function publishAndNotify({text='',imageUrl='',author='Gremory'}={}){
    const post=await publishUpdate({text,imageUrl,author});
    const noticeId=`update_${post.id}`;
    const notice=await notifyAllSiteUsers({
      title:'Nova atualização da Gremory',
      text:post.text||'Uma nova publicação foi adicionada.',
      imageUrl:post.imageUrl||'',
      type:'site_update',
      link:'#updates',
      postId:post.id,
      notificationId:noticeId
    }).catch(e=>({sent:0,error:e.message}));
    return{post,notice}
  }
  async function deletePublishedUpdate(postId){
    const id=String(postId||'').trim();
    if(!id)throw new Error('Informe o ID da publicação.');
    const sn=await rtdb.ref(`siteUpdates/${id}`).once('value');
    if(!sn.exists())throw new Error('Publicação não encontrada.');
    const uids=await siteUserUids();
    const patch={[`siteUpdates/${id}`]:null};
    for(const uid of uids)patch[`siteNotifications/${uid}/update_${id}`]=null;
    await rtdb.ref().update(patch);
    return{id,notificationsRemoved:uids.length};
  }

  async function handleCommand({comando,args=[],q='',sender,enviar,isOwner=false,pushname='',info=null,from=''}={}){
    const cmd=String(comando||'').toLowerCase();
    if(cmd==='vincular'||cmd==='vincularsite'){
      const code=String(args[0]||q||'').trim().toUpperCase();
      if(!code){await enviar('Use: /vincular CODIGO');return true}
      try{await linkAccount(code,sender);await enviar('✅ Conta vinculada. Seu perfil e seus sistemas já podem sincronizar com o site.')}catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(cmd==='syncsite'||cmd==='sincronizarsite'){
      try{const uid=await linkedUidByJid(sender);if(!uid)throw new Error('Vincule primeiro pelo site.');await syncAccount(uid,sender);await enviar('✅ Site sincronizado.')}catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(cmd==='hospitalpokemon'||cmd==='hospitalpoke'){
      try{
        const{user}=pokemonState(sender);const n=Math.max(1,Number(args[0]||Number(user.active||0)+1)),mon=user.monsters[n-1];if(!mon)throw new Error('Pokémon não encontrado. Use /hospitalpokemon número.');
        const uid=await linkedUidByJid(sender).catch(()=>null),r=await startHealing(uid,sender,mon.uid);const mins=Math.max(1,Math.ceil((Number(r.readyAt)-Date.now())/60000));
        await enviar(r.alreadyHealing?`🏥 ${r.name} já está no hospital.\n⏳ Cerca de ${mins} min restantes.`:`🏥 ${r.name} entrou no hospital.\n💰 Custo: ₹${r.cost}\n⏳ Recuperação: cerca de ${mins} min${r.premium?' • Premium':''}.`)
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(['raidsite','siteraid'].includes(cmd)){
      if(!isOwner){await enviar('❌ Apenas o dono pode controlar a raid global do site.');return true}
      try{const sub=String(args[0]||'').toLowerCase();if(sub==='status'){const raid=(await rtdb.ref('pokemonSiteRaid/current').once('value')).val();if(!raid||raid.status!=='active')await enviar('⚔️ Nenhuma raid global ativa.');else await enviar(`⚔️ *RAID GLOBAL*\n${raid.boss.name} • ${raid.boss.types.map(typeName).join(' / ')}\n❤️ ${raid.hp}/${raid.maxHp}\n👥 ${Object.keys(raid.participants||{}).length} participante(s)`);return true}const raid=await startSiteRaid({by:`whatsapp:${cleanJid(sender)}`});await enviar(`✅ Raid global iniciada!\n${raid.boss.name} • Tier ${raid.tier}\n❤️ ${raid.maxHp} HP\n\nOs usuários do site foram notificados.`)}catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(['raidsiteauto','siteraidauto'].includes(cmd)){
      if(!isOwner){await enviar('❌ Apenas o dono pode alterar raids automáticas.');return true}const enabled=['on','1','sim','ativar'].includes(String(args[0]||'').toLowerCase());const disabled=['off','0','nao','não','desativar'].includes(String(args[0]||'').toLowerCase());if(!enabled&&!disabled){await enviar('Use: /raidsiteauto on ou /raidsiteauto off');return true}await rtdb.ref('pokemonSiteRaidConfig').update({auto:enabled,intervalMs:3600000,updatedAt:Date.now()});if(enabled)await maybeAutoSiteRaid();await enviar(enabled?'✅ Raid automática ativada: até 1 nova raid por hora.':'✅ Raid automática desativada.');return true
    }
    if(['notificar','notificartodos','avisosite'].includes(cmd)){
      if(!isOwner){await enviar('❌ Apenas o dono pode enviar notificações gerais do site.');return true}
      if(String(from||'').endsWith('@g.us')){await enviar('📩 Use esse comando no privado da Charlotte.');return true}
      try{
        const imageUrl=await uploadImageFromMessage(info);
        const result=await notifyAllSiteUsers({
          title:'Aviso da Gremory',
          text:rawCommandPayload(info,{fallback:q}),
          imageUrl,
          type:'admin_notice'
        });
        await enviar(`✅ Notificação enviada para ${result.sent} usuário${result.sent===1?'':'s'} do site.\n\nEla ficará salva no sininho e aparecerá quando a pessoa entrar na conta.`);
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }

    const anuncioSiteExplicito=
      cmd==='anunciosite'||
      cmd==='siteanuncio'||
      (cmd==='anuncio'&&['site','web'].includes(String(args[0]||'').toLowerCase()));

    if(anuncioSiteExplicito){
      if(!isOwner){await enviar('❌ Apenas o dono pode publicar anúncios no site.');return true}
      if(String(from||'').endsWith('@g.us')){await enviar('📰 Use /anuncio site no privado da Charlotte para publicar no feed.');return true}
      try{
        const textoPost=rawCommandPayload(info,{dropFirstArg:cmd==='anuncio',fallback:cmd==='anuncio'?args.slice(1).join(' '):q});
        const imageUrl=await uploadImageFromMessage(info);
        const {post,notice}=await publishAndNotify({text:textoPost,imageUrl,author:pushname||'Gremory'});
        await enviar(`✅ Anúncio publicado e notificação enviada para ${Number(notice?.sent||0)} usuário${Number(notice?.sent||0)===1?'':'s'}.\nID: ${post.id}`);
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }

    if((cmd==='atualizacao'||cmd==='siteupdate')&&isOwner){
      try{
        const imageUrl=await uploadImageFromMessage(info);const textoPost=rawCommandPayload(info,{fallback:q});const {post,notice}=await publishAndNotify({text:textoPost,imageUrl,author:pushname||'Gremory'});
        await enviar(`✅ Atualização publicada e notificação enviada para ${Number(notice?.sent||0)} usuário${Number(notice?.sent||0)===1?'':'s'}.\nID: ${post.id}`);
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    // /anuncio normal permanece como anúncio de grupo.
    // Para o site use /anunciosite ou /anuncio site.
    if(cmd==='anuncio'&&isOwner)return false;
    if(['apagarpublicacao','apagaranuncio','deleteupdate','deletarupdate'].includes(cmd)&&isOwner){
      try{
        const postId=String(args[0]||q||'').trim();
        const result=await deletePublishedUpdate(postId);
        await enviar(`✅ Publicação apagada.\nID: ${result.id}\nAs notificações vinculadas também foram removidas.`)
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(['premiumbeneficios','beneficiospremium'].includes(cmd)){
      await enviar(`💎 *GREMORY PREMIUM*\n\n• 7 dias por ₹${RUPIA_PREMIUM_PRICE}\n• Charlotte no seu grupo durante o Premium (opcional)\n• Charlotte Music ilimitada quando o Premium ativa a sala\n• Hospital Pokémon acelerado\n• Limites ampliados em recompensas e recursos Premium\n• Badge e recursos exclusivos no site\n\nUse /comprarpremium ou compre na aba Premium do site.`);return true
    }
    if(['comprarpremium','premiumrupias'].includes(cmd)){
      try{const uid=await linkedUidByJid(sender);if(!uid)throw new Error('Vincule sua conta ao site primeiro.');const r=await processPremiumRupiasBuy(uid,sender,{groupLink:String(args[0]||'').trim()});await enviar(`✅ Premium ativado por ${r.days} dias.\n💰 Pago: ₹${r.price}\nSaldo: ₹${r.balance}${r.group?.groupName?`\n🤖 Grupo: ${r.group.groupName}`:'\n🤖 Nenhum grupo vinculado. Você pode informar depois pelo site ou /premiumgrupo LINK.'}`)}catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(cmd==='premiumgrupo'){
      try{const uid=await linkedUidByJid(sender);if(!uid)throw new Error('Vincule sua conta ao site primeiro.');const link=String(args[0]||q||'').trim();if(!link)throw new Error('Use: /premiumgrupo LINK_DO_GRUPO');const r=await processPremiumGroupSet(uid,sender,{groupLink:link});await enviar(`✅ Grupo Premium vinculado: ${r.group?.groupName||'grupo'}. A Charlotte sairá quando seu Premium terminar.`)}catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(cmd==='backupjson'&&isOwner){
      try{const confirmReplace=String(args[0]||'').toLowerCase()==='confirmar';const r=await backupOperationalJsons(true,{allowRecoveryOverwrite:confirmReplace});await enviar(`✅ Backup completo da Charlotte salvo no Firebase.\nArquivos: ${r.files||0}\nIgnorados: ${r.skipped||0}`)}catch(e){await enviar(`❌ ${e.message}${backupRecoveryRequired?'\nSe você REALMENTE quiser substituir o backup remoto pelos arquivos atuais, use /backupjson confirmar.':''}`)}return true
    }
    if(cmd==='restaurarbackup'&&isOwner){
      try{const confirm=String(args[0]||'').toLowerCase()==='confirmar';if(!confirm)throw new Error('Por segurança use: /restaurarbackup confirmar');const r=await restoreOperationalJsons();await enviar(`✅ Backup completo restaurado do Firebase.\nArquivos: ${r.restoredFiles||0}\n\n⚠️ Reinicie a Charlotte agora para todos os módulos recarregarem os JSONs restaurados.`)}catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(cmd==='backupconta'&&isOwner){
      try{const uid=String(args[0]||q||'').trim();if(!uid)throw new Error('Use: /backupconta UID');const jid=await linkedJidByUid(uid);if(!jid)throw new Error('UID não está vinculado à Charlotte.');const r=await syncAccount(uid,jid);await backupAccountSnapshot(uid,jid,r.account,true);await enviar(`✅ Backup atualizado.\nUID: ${uid}\nSaldo: ₹${r.account.balance}\nRegistro: ${r.account.registered?'sim':'não'}`)}catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(cmd==='backupcontas'&&isOwner){
      try{await syncLinkedAccounts();await enviar('✅ Backup das contas vinculadas atualizado no Firebase e, quando configurado, no Vercel Blob.')}catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(cmd==='restaurarconta'&&isOwner){
      try{
        const uid=String(args[0]||'').trim(),confirm=String(args[1]||'').toLowerCase()==='confirmar';if(!uid)throw new Error('Use: /restaurarconta UID confirmar');if(!confirm)throw new Error('Por segurança use: /restaurarconta UID confirmar');
        const jid=await linkedJidByUid(uid);if(!jid)throw new Error('UID não está vinculado.');const b=await fetchAccountBackup(uid);if(!b?.account)throw new Error('Nenhum backup encontrado.');
        const currentRegistered=registeredFor(jid),currentBalance=balanceFor(jid);if(currentRegistered&&currentBalance>0)throw new Error(`A conta atual ainda possui registro e ₹${currentBalance}. Não restaure por cima de uma conta ativa.`);
        if(b.account.registered&&!currentRegistered&&typeof economy.AddReg==='function'){let ok=false;for(const a of [[jid,b.identity?.name||'Usuário'],[jid]]){try{await economy.AddReg(...a);if(registeredFor(jid)){ok=true;break}}catch{}}if(!ok)throw new Error('Não consegui recriar o registro automaticamente.')}
        const target=Math.max(0,Number(b.account.balance||0)),nowBal=balanceFor(jid),delta=target-nowBal;if(delta>0&&typeof economy.addkoin==='function')await economy.addkoin(jid,delta);if(delta<0&&typeof economy.delkoin==='function')await economy.delkoin(jid,Math.abs(delta));await syncAccount(uid,jid);await enviar(`✅ Conta restaurada do backup.\nSaldo: ₹${balanceFor(jid)}\nRegistro: ${registeredFor(jid)?'sim':'não'}`)
      }catch(e){await enviar(`❌ ${e.message}`)}return true
    }
    if(cmd==='siteban'&&isOwner){
      const uid=String(args[0]||'').trim(),reason=args.slice(1).join(' ').trim()||'Violação das regras';if(!uid){await enviar('Use: /siteban UID motivo');return true}
      await rtdb.ref(`siteBans/${uid}`).set({uid,reason,by:cleanJid(sender),createdAt:Date.now()});await notifySite(uid,{type:'moderation',title:'Conta suspensa',text:reason,sound:false}).catch(()=>{});await enviar(`✅ Conta ${uid} suspensa no site.`);return true
    }
    if(cmd==='siteunban'&&isOwner){
      const uid=String(args[0]||'').trim();if(!uid){await enviar('Use: /siteunban UID');return true}await rtdb.ref(`siteBans/${uid}`).remove();await enviar(`✅ Banimento removido de ${uid}.`);return true
    }
    if(cmd==='sitereports'&&isOwner){
      const sn=await rtdb.ref('siteReports').once('value'),all=Object.entries(sn.val()||{}).map(([id,v])=>({id,...v})).filter(x=>x.status!=='closed').sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
      if(!all.length){await enviar('✅ Nenhuma denúncia aberta.');return true}
      const counts={};for(const x of all)counts[x.targetUid]=Number(counts[x.targetUid]||0)+1;
      const rows=all.slice(0,10);await enviar('🚨 *DENÚNCIAS DO SITE*\n\n'+rows.map(x=>`ID: ${x.id}\nUsuário: ${x.targetUid} (${counts[x.targetUid]} denúncia${counts[x.targetUid]===1?'':'s'})\nCategoria: ${x.category}\nDetalhes: ${String(x.details||'—').slice(0,160)}`).join('\n\n')+'\n\n⚠️ Denúncias recorrentes ficam destacadas para revisão; o banimento continua manual com /siteban.');return true
    }
    return false;
  }
  return{start,stop,handleCommand,syncPokemon,syncAccount,linkAccount,publishUpdate,notifySite,notifyAllSiteUsers,deletePublishedUpdate};
}
module.exports={createGremorySiteBridge};