'use strict';

// O site decide o resultado do Slots no SERVIDOR, nunca no navegador ou no bot.
// O servidor agenda somente a liquidação no bridge já existente.
const crypto = require('crypto');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const ITEMS=[
  {symbol:'✦',weight:28,mult:3},
  {symbol:'♥',weight:22,mult:4},
  {symbol:'☾',weight:18,mult:5},
  {symbol:'◆',weight:14,mult:6},
  {symbol:'⚡',weight:9,mult:8},
  {symbol:'♛',weight:6,mult:12},
  {symbol:'7',weight:3,mult:25}
];

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
  const a=serviceAccount(), databaseURL=String(process.env.FIREBASE_DATABASE_URL||'https://gremory-e4313-default-rtdb.firebaseio.com').trim();
  if(!a.projectId||!a.clientEmail||!a.privateKey)throw new Error('Configure FIREBASE_SERVICE_ACCOUNT_JSON no servidor da Vercel.');
  const app=getApps().find(x=>x.name==='gremory-slots-admin')||initializeApp({credential:cert(a),databaseURL},'gremory-slots-admin');
  return{auth:getAuth(app),db:getDatabase(app)};
}
function pick(){
  const n=crypto.randomInt(100);
  let c=0;
  for(const x of ITEMS){c+=x.weight;if(n<c)return x;}
  return ITEMS[0];
}
function newSpin(uid,bet){
  const items=[pick(),pick(),pick()],symbols=items.map(x=>x.symbol);
  const triple=symbols[0]===symbols[1]&&symbols[1]===symbols[2];
  const payout=triple?bet*items[0].mult:new Set(symbols).size===2?Math.floor(bet*1.2):0;
  return{spinId:'spin_'+crypto.randomUUID().replace(/-/g,''),jobId:'slot_'+crypto.randomUUID().replace(/-/g,''),uid,bet,
    payout,symbols,jackpot:triple&&symbols[0]==='7',label:triple?`Trinca ${symbols[0]}`:payout?'Dupla':'Sem prêmio',createdAt:Date.now()};
}
function publicSpin(s){return{ok:true,spinId:s.spinId,jobId:s.jobId,bet:s.bet,payout:s.payout,symbols:s.symbols,jackpot:s.jackpot,label:s.label,settlement:'pending'};}

async function handleSlotsSpin(req,res,{readJsonBody,sendJson}){
  if(req.method!=='POST')return sendJson(res,405,{erro:'Método inválido.'});
  res.setHeader('Cache-Control','no-store');
  try{
    const body=await readJsonBody(req);
    const token=String(body?.idToken||'');
    if(!token||token.length>10000)return sendJson(res,401,{erro:'Entre na conta do site.'});
    const {auth,db}=getAdmin();
    let decoded;
    try{decoded=await auth.verifyIdToken(token)}catch{return sendJson(res,401,{erro:'Sessão expirada. Entre novamente.'});}
    const uid=String(decoded.uid||'');
    if(!uid)return sendJson(res,401,{erro:'Usuário inválido.'});
    const bet=Number(body?.bet);
    if(!Number.isSafeInteger(bet)||bet<10||bet>5000)return sendJson(res,400,{erro:'A aposta deve ficar entre ₹10 e ₹5.000.'});
    const [linkedSn,accSn]=await Promise.all([
      db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value'),
      db.ref(`charlotteSync/${uid}/account`).once('value')
    ]);
    if(!linkedSn.val())return sendJson(res,400,{erro:'Vincule sua conta à Charlotte para usar a carteira de rúpias.'});
    const acc=accSn.val()||{};
    if(acc.registered===false)return sendJson(res,400,{erro:'Use /reg na Charlotte antes de jogar Slots.'});
    if(!Number.isFinite(Number(acc.balance))||Number(acc.balance)<bet)return sendJson(res,409,{erro:'Saldo sincronizado insuficiente para essa aposta.'});

    // O lock é criado ANTES da resposta. Somente o servidor pode gravá-lo:
    // ninguém pode descartar apostas perdedoras ou forjar prêmios no console.
    const spin=newSpin(uid,bet);
    const pendingRef=db.ref(`siteSlotsPending/${uid}`);
    const tx=await pendingRef.transaction(current=>current?undefined:spin,undefined,false);
    if(!tx.committed){
      const prior=tx.snapshot.val()||{};
      return sendJson(res,409,{erro:'O giro anterior ainda está sendo creditado ou debitado. Aguarde a atualização do saldo.',pending:true,jobId:String(prior.jobId||'')});
    }
    try{
      // Acesso administrativo do servidor. O navegador não pode criar slots_settle.
      await db.ref(`siteBridgeJobs/${uid}/${spin.jobId}`).set({type:'slots_settle',spinId:spin.spinId,createdAt:new Date().toISOString()});
    }catch(e){
      await pendingRef.transaction(v=>v?.spinId===spin.spinId?null:undefined,undefined,false).catch(()=>{});
      throw e;
    }
    return sendJson(res,200,publicSpin(spin));
  }catch(e){
    console.error('[SITE SLOTS]',e?.message||e);
    return sendJson(res,503,{erro:'Não foi possível registrar a aposta no servidor. Nenhum resultado foi confirmado.'});
  }
}
module.exports={handleSlotsSpin,pick,newSpin,publicSpin};
