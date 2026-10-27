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
function healthyTeam(pokemon={},healing={}){
  const team=rows(pokemon.team).slice(0,6);
  return team.find(mon=>mon&&Number(mon.hp||0)>0&&!mon.fainted&&Number(healing?.[mon.uid]?.readyAt||0)<=Date.now())||null;
}
function queuePrefetch(db,uid){
  const jobId=`prefetch_${crypto.randomUUID().replace(/-/g,'')}`;
  return db.ref(`siteBridgeJobs/${uid}/${jobId}`).set({type:'pokemon_explore_prefetch',createdAt:new Date().toISOString()}).catch(()=>{});
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
    const ready=readySn.val()||null;
    if(!ready?.mon||Number(ready.expiresAt||0)<=now){queuePrefetch(db,uid);return sendJson(res,409,{erro:'Preparando o próximo encontro. Tente novamente em instantes.',prefetching:true})}
    const player=healthyTeam(sync.pokemon||{},healingSn.val()||{});if(!player)return sendJson(res,409,{erro:'Sua equipe está toda desmaiada. Use o Hospital Pokémon.'});

    // Reserva o cooldown primeiro para impedir dois cliques simultâneos de criarem
    // dois encontros diferentes.
    const metaRef=db.ref(`pokemonSiteMeta/${uid}/lastExplore`);
    const claim=await metaRef.transaction(current=>now-Number(current||0)>=cooldown?now:undefined,undefined,false);
    if(!claim.committed){
      const current=(await db.ref(`pokemonSiteEncounter/${uid}`).once('value')).val()||null;
      if(current&&current.status!=='finished'&&Number(current.expiresAt||0)>Date.now())return sendJson(res,200,{ok:true,encounter:current,reused:true});
      return sendJson(res,429,{erro:'Aguarde alguns segundos para explorar de novo.'});
    }
    const mon={...ready.mon,hp:Number(ready.mon.maxHp||ready.mon.hp||1),fainted:false};
    const encounter={id:`enc_${crypto.randomUUID().replace(/-/g,'')}`,status:'battle',mon,player,createdAt:new Date().toISOString(),expiresAt:now+10*60*1000,log:{}};
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
