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
  const app=getApps().find(x=>x.name==='gremory-explore-admin')||initializeApp({credential:cert(a),databaseURL},'gremory-explore-admin');
  return{auth:getAuth(app),db:getDatabase(app)};
}
function rows(v){return Array.isArray(v)?v:Object.values(v||{})}
function teamSnapshot(pokemon={}){
  return rows(pokemon.team).slice(0,6).filter(Boolean).map(mon=>({
    ...mon,
    uid:String(mon.uid||''),
    hp:Math.max(0,Number(mon.hp??mon.hpAtual??0)),
    maxHp:Math.max(1,Number(mon.maxHp||mon.hpMax||mon.hp||1)),
    fainted:!!mon.fainted||Number(mon.hp??mon.hpAtual??0)<=0
  })).filter(mon=>mon.uid);
}
function healthyTeam(pokemon={},healing={}){
  return teamSnapshot(pokemon).find(mon=>Number(mon.hp||0)>0&&!mon.fainted&&Number(healing?.[mon.uid]?.readyAt||0)<=Date.now())||null;
}
function queuePrefetch(db,uid){
  const jobId=`prefetch_${crypto.randomUUID().replace(/-/g,'')}`;
  return db.ref(`siteBridgeJobs/${uid}/${jobId}`).set({type:'pokemon_explore_prefetch',createdAt:new Date().toISOString()}).catch(()=>{});
}
const FALLBACK_WILD=[
  {dex:25,name:'Pikachu',type:'electric',move:'Choque do Trovão'}, {dex:4,name:'Charmander',type:'fire',move:'Brasas'},
  {dex:7,name:'Squirtle',type:'water',move:'Jato d’Água'}, {dex:1,name:'Bulbasaur',type:'grass',move:'Chicote de Vinha'},
  {dex:133,name:'Eevee',type:'normal',move:'Ataque Rápido'}, {dex:92,name:'Gastly',type:'ghost',move:'Lamber'},
  {dex:147,name:'Dratini',type:'dragon',move:'Sopro do Dragão'}, {dex:66,name:'Machop',type:'fighting',move:'Golpe de Karatê'},
  {dex:74,name:'Geodude',type:'rock',move:'Lançamento de Rocha'}, {dex:63,name:'Abra',type:'psychic',move:'Confusão'},
  {dex:58,name:'Growlithe',type:'fire',move:'Presa de Fogo'}, {dex:54,name:'Psyduck',type:'water',move:'Pistola d’Água'},
  {dex:81,name:'Magnemite',type:'electric',move:'Faísca'}, {dex:41,name:'Zubat',type:'flying',move:'Ataque de Asa'},
  {dex:27,name:'Sandshrew',type:'ground',move:'Tapa de Lama'}, {dex:37,name:'Vulpix',type:'fire',move:'Brasas'},
  {dex:280,name:'Ralts',type:'psychic',move:'Confusão'}, {dex:447,name:'Riolu',type:'fighting',move:'Golpe Rápido'}
];
function fallbackWild(player={}){
  const base=FALLBACK_WILD[crypto.randomInt(0,FALLBACK_WILD.length)],playerLevel=Math.max(1,Number(player.level||1)),level=Math.max(3,Math.min(55,playerLevel+crypto.randomInt(-3,7))),maxHp=Math.max(35,50+level*4+crypto.randomInt(0,26));
  return{uid:`wild_${crypto.randomUUID().replace(/-/g,'')}`,dex:base.dex,name:base.name,level,shiny:crypto.randomInt(1,201)===1,maxHp,hp:maxHp,fainted:false,attack:55+level*2,defense:50+level*2,sprite:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${base.dex}.gif`,types:[base.type],moves:[{name:base.move,power:48,type:base.type},{name:'Investida',power:42,type:'normal'}]};
}
async function handlePokemonExplore(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});
  res.setHeader('Cache-Control','no-store');
  try{
    const body=await readJsonBody(req),token=String(body?.idToken||'');
    if(!token||token.length>10000)return sendJson(res,401,{erro:'Entre na conta do site.'});
    const{auth,db}=getAdmin();let decoded;
    try{decoded=await auth.verifyIdToken(token)}catch{return sendJson(res,401,{erro:'Sessão expirada. Entre novamente.'})}
    const uid=String(decoded.uid||'');if(!uid)return sendJson(res,401,{erro:'Usuário inválido.'});
    const now=Date.now();
    const[linkedSn,readySn,encSn,metaSn,syncSn,healingSn]=await Promise.all([
      db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value'),
      db.ref(`pokemonSiteExploreReady/${uid}`).once('value'),
      db.ref(`pokemonSiteEncounter/${uid}`).once('value'),
      db.ref(`pokemonSiteMeta/${uid}/lastExplore`).once('value'),
      db.ref(`charlotteSync/${uid}`).once('value'),
      db.ref(`pokemonHealing/${uid}`).once('value')
    ]);
    if(!linkedSn.val())return sendJson(res,400,{erro:'Vincule a Charlotte primeiro.'});
    const old=encSn.val()||null;
    if(old&&old.status!=='finished'&&Number(old.expiresAt||0)>now)return sendJson(res,200,{ok:true,encounter:old,reused:true});
    const sync=syncSn.val()||{},premium=!!sync.account?.premium,cooldown=premium?8000:15000,last=Number(metaSn.val()||0);
    if(now-last<cooldown)return sendJson(res,429,{erro:'Aguarde alguns segundos para explorar de novo.',cooldownMs:cooldown-(now-last)});
    const ready=readySn.val()||null,team=teamSnapshot(sync.pokemon||{}),player=healthyTeam(sync.pokemon||{},healingSn.val()||{});if(!player)return sendJson(res,409,{erro:'Sua equipe está toda desmaiada. Use o Hospital Pokémon.'});
    const hasPrepared=!!ready?.mon&&Number(ready.expiresAt||0)>now,prepared=hasPrepared?ready.mon:fallbackWild(player);if(!hasPrepared)queuePrefetch(db,uid);

    // Reserva o cooldown primeiro para impedir dois cliques simultâneos de criarem
    // dois encontros diferentes.
    const metaRef=db.ref(`pokemonSiteMeta/${uid}/lastExplore`);
    const claim=await metaRef.transaction(current=>now-Number(current||0)>=cooldown?now:undefined,undefined,false);
    if(!claim.committed){
      const current=(await db.ref(`pokemonSiteEncounter/${uid}`).once('value')).val()||null;
      if(current&&current.status!=='finished'&&Number(current.expiresAt||0)>Date.now())return sendJson(res,200,{ok:true,encounter:current,reused:true});
      return sendJson(res,429,{erro:'Aguarde alguns segundos para explorar de novo.'});
    }
    const mon={...prepared,hp:Number(prepared.maxHp||prepared.hp||1),fainted:false};
    const encounter={id:`enc_${crypto.randomUUID().replace(/-/g,'')}`,status:'battle',mon,player,team,activeUid:player.uid,createdAt:new Date().toISOString(),expiresAt:now+10*60*1000,log:{}};
    const jobId=`prefetch_${crypto.randomUUID().replace(/-/g,'')}`,patch={};
    patch[`pokemonSiteEncounter/${uid}`]=encounter;
    patch[`pokemonSiteExploreReady/${uid}`]=null;
    patch[`siteBridgeJobs/${uid}/${jobId}`]={type:'pokemon_explore_prefetch',createdAt:new Date().toISOString()};
    await db.ref().update(patch);
    return sendJson(res,200,{ok:true,encounter,source:'site-prefetch'});
  }catch(e){
    console.error('[SITE EXPLORE]',e?.message||e);
    return sendJson(res,503,{erro:'Não foi possível iniciar a exploração agora.'});
  }
}
module.exports={handlePokemonExplore};
