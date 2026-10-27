'use strict';
const {authenticate,publicError,SiteError,wallet,applyWallet,linked}=require('./site-wallet');
async function handleActivate(req,res,{readJsonBody,sendJson}){
 res.setHeader('Cache-Control','no-store');
 try{
  const {uid,db,body}=await authenticate(req,readJsonBody);
  const roomCode=String(body.roomCode||'').toUpperCase().trim();
  if(!/^[A-Z0-9_-]{4,32}$/.test(roomCode))throw new SiteError(400,'ROOM_INVALID','Código da sala inválido.');
  const r=db.ref(`watchRooms/${roomCode}`),room=(await r.once('value')).val();
  if(!room?.members?.[uid])throw new SiteError(403,'NOT_MEMBER','Entre na sala antes de ativar música.');
  if((await db.ref(`watchVoice/${roomCode}/${uid}/audio`).once('value')).val()!==true)throw new SiteError(409,'VOICE_NOT_JOINED','Sua chamada de voz não foi confirmada no Firebase.');
  if(room.musicPlan?.active)return sendJson(res,200,{ok:true,alreadyActive:true,cost:0,plan:room.musicPlan});
  if(!(await linked(db,uid)))throw new SiteError(409,'CHARLOTTE_NOT_LINKED','Vincule a Charlotte para ativar a música.');
  const w=await wallet(db,uid);if(w.balance<50)throw new SiteError(409,'INSUFFICIENT_BALANCE',`Saldo insuficiente para ativar música: ₹${w.balance}.`);
  const lock=db.ref(`watchRooms/${roomCode}/musicActivationLock`),opId=`music_${roomCode}`;
  const claim=await lock.transaction(v=>v?undefined:{status:'processing',opId,uid,startedAt:Date.now()},undefined,false);
  if(!claim.committed){
   const current=claim.snapshot.val()||{};
   const refreshed=(await r.child('musicPlan').once('value')).val();
   if(refreshed?.active)return sendJson(res,200,{ok:true,alreadyActive:true,cost:0,plan:refreshed});
   if(current.opId!==opId||current.uid!==uid)throw new SiteError(409,'MUSIC_ACTIVATION_PENDING','A sala já tem uma ativação em andamento. Aguarde a confirmação, sem pagar novamente.');
   // A mesma pessoa pode recuperar a publicação de uma ativação já debitada.
  }
  const paid=await applyWallet(db,uid,opId,-50,'music_activation',{roomCode,cost:50});
  const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val();
  const plan={active:true,activatedBy:uid,activatedAt:Date.now(),activationCost:50,used:0,premiumAtActivation:premium,premium};
  await db.ref().update({
   [`watchRooms/${roomCode}/musicAccess/${uid}`]:{active:true,activatedAt:plan.activatedAt,activationCost:50,used:0,premiumAtActivation:premium},
   [`watchRooms/${roomCode}/musicPlan`]:plan,
   [`watchRooms/${roomCode}/musicActivationLock/status`]:'done',
   [`watchRooms/${roomCode}/musicActivationLock/finishedAt`]:Date.now()
  });
  return sendJson(res,200,{ok:true,alreadyActive:false,cost:50,plan,balance:paid.balance});
 }catch(e){const err=publicError(e,'SITE MUSIC');return sendJson(res,err.status,{erro:err.erro,code:err.code});}
}
module.exports={handleActivate};
