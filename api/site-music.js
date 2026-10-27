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
  if(room.musicPlan?.active)return sendJson(res,200,{ok:true,alreadyActive:true,cost:0,plan:room.musicPlan});
  if(!(await linked(db,uid)))throw new SiteError(409,'CHARLOTTE_NOT_LINKED','Vincule a Charlotte para ativar a música.');
  await wallet(db,uid);
  const lock=db.ref(`watchRooms/${roomCode}/musicActivationLock`),opId=`music_${roomCode}`;
  const claim=await lock.transaction(v=>v?undefined:{status:'processing',opId,uid,startedAt:Date.now()},undefined,false);
  if(!claim.committed){
   const current=claim.snapshot.val()||{};
   const refreshed=(await r.child('musicPlan').once('value')).val();
   if(refreshed?.active)return sendJson(res,200,{ok:true,alreadyActive:true,cost:0,plan:refreshed});
   if(current.opId!==opId||current.uid!==uid)throw new SiteError(409,'MUSIC_ACTIVATION_PENDING','A sala já tem uma ativação em andamento. Aguarde a confirmação, sem pagar novamente.');
   // A mesma pessoa pode recuperar a publicação de uma ativação já debitada.
  }
  let paid;
  try{paid=await applyWallet(db,uid,opId,-50,'music_activation',{roomCode,cost:50});}
  catch(e){if(['INSUFFICIENT_BALANCE','WALLET_NOT_READY'].includes(e.code))await lock.transaction(v=>v?.uid===uid&&v?.status==='processing'?null:undefined,undefined,false);throw e;}
  const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val();
  const plan={active:true,activatedBy:uid,activatedAt:Date.now(),activationCost:50,used:0,premiumAtActivation:premium,premium};
  await r.transaction(value=>{
   if(!value?.members?.[uid])return;
   if(value.musicPlan?.active)return value;
   value.musicAccess=value.musicAccess||{};
   value.musicAccess[uid]={active:true,activatedAt:plan.activatedAt,activationCost:50,used:0,premiumAtActivation:premium};
   value.musicPlan=plan;value.musicActivationLock={opId,uid,status:'done',finishedAt:Date.now()};return value;
  },undefined,false);
  return sendJson(res,200,{ok:true,alreadyActive:false,cost:50,plan,balance:paid.balance});
 }catch(e){const err=publicError(e,'SITE MUSIC');return sendJson(res,err.status,{erro:err.erro,code:err.code});}
}


// Toda a fila roda na API do site. Recibos e reservas sobrevivem a respostas perdidas.
const crypto=require('node:crypto');
function ordered(room){return Object.entries(room.musicQueue||{}).sort((a,b)=>Number(a[1].createdAt)-Number(b[1].createdAt)||a[0].localeCompare(b[0]));}
async function resolveTrack(query){
 let videoId='';
 try{const u=new URL(query);const host=u.hostname.toLowerCase();
  if(host==='youtu.be')videoId=u.pathname.slice(1).split('/')[0];
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host))videoId=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]||'';
 }catch{}
 if(/^[a-zA-Z0-9_-]{11}$/.test(videoId))return{videoId,title:'YouTube · '+videoId,durationSec:0};
 const key=process.env.YOUTUBE_API_KEY;
 if(!key)throw new SiteError(400,'MUSIC_LINK_REQUIRED','Cole o link do YouTube. A busca por nome requer YOUTUBE_API_KEY na Vercel.');
 const url=new URL('https://www.googleapis.com/youtube/v3/search');
 for(const [k,v]of Object.entries({part:'snippet',type:'video',maxResults:'1',q:query,key}))url.searchParams.set(k,v);
 const response=await fetch(url,{signal:AbortSignal.timeout(8000)}),data=await response.json();
 const item=data.items?.[0];if(!response.ok||!item?.id?.videoId)throw new SiteError(400,'MUSIC_NOT_FOUND','Não foi possível localizar a música. Tente um link do YouTube.');
 return{videoId:item.id.videoId,title:String(item.snippet.title).slice(0,180),durationSec:0};
}
async function handleQueue(req,res,{readJsonBody,sendJson}){
 res.setHeader('Cache-Control','no-store');
 try{
  const {uid,db,body}=await authenticate(req,readJsonBody);
  const roomCode=String(body.roomCode||'').trim().toUpperCase();
  if(!/^[A-Z0-9_-]{4,32}$/.test(roomCode))throw new SiteError(400,'ROOM_INVALID','Sala inválida.');
  const ref=db.ref(`watchRooms/${roomCode}`),room=(await ref.once('value')).val();
  if(!room?.members?.[uid])throw new SiteError(403,'NOT_MEMBER','Entre na sala primeiro.');
  if(['skip','advance'].includes(body.type)){
   if(body.type==='skip'&&room.meta?.ownerUid!==uid)throw new SiteError(403,'HOST_REQUIRED','Somente o host pode pular.');
   let changed=false;
   await ref.transaction(v=>{
    changed=false;if(!v?.members?.[uid]||(body.type==='skip'&&v.meta?.ownerUid!==uid))return;
    const rows=ordered(v),id=v.musicPlayback?.currentId&&v.musicQueue?.[v.musicPlayback.currentId]?v.musicPlayback.currentId:rows[0]?.[0];
    if(!id||id!==body.currentId)return;
    delete v.musicQueue[id];const next=ordered(v)[0];
    if(next){v.musicQueue[next[0]].startedAt=Date.now();v.musicPlayback={currentId:next[0],startedAt:Date.now()};}else delete v.musicPlayback;
    changed=true;return v;
   },undefined,false);
   return sendJson(res,200,{ok:true,skipped:changed,advanced:changed});
  }
  if(body.type!=='add'||!/^track_[a-f0-9]{32}$/.test(String(body.requestId||'')))throw new SiteError(400,'MUSIC_REQUEST_INVALID','Pedido inválido.');
  const query=String(body.query||'').trim().slice(0,500);if(!query)throw new SiteError(400,'QUERY_REQUIRED','Informe a música.');
  const opId='musicq_'+crypto.createHash('sha256').update(roomCode+'|'+uid+'|'+body.requestId).digest('hex');
  let operation=room.musicOperations?.[opId];
  if(operation&&operation.query!==query)throw new SiteError(409,'MUSIC_REPLAY_PENDING','Conclua o pedido anterior antes de adicionar outra música.');
  if(operation?.status==='done')return sendJson(res,200,{ok:true,...operation.result});
  if(!operation){
   const track=await resolveTrack(query);
   const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val();
   const tx=await ref.transaction(v=>{
    if(!v?.members?.[uid]||!v.musicPlan?.active)return;
    if(v.musicOperations?.[opId])return v;
    if(v.musicQueueLock)return;
    const used=Number(v.musicPlan.used||0),cost=(premium||v.musicPlan.premium||used<10)?0:5;
    v.musicOperations=v.musicOperations||{};
    v.musicOperations[opId]={uid,query,track,cost,status:'pending',createdAt:Date.now()};v.musicQueueLock=opId;return v;
   },undefined,false);
   if(!tx.committed)throw new SiteError(409,'MUSIC_QUEUE_PENDING','Ative a música na sala ou aguarde a conclusão do pedido em andamento.');
   operation=tx.snapshot.val().musicOperations[opId];
  }
  if(operation.query!==query)throw new SiteError(409,'MUSIC_REPLAY_PENDING','Conclua o pedido anterior.');
  if(operation.status==='done')return sendJson(res,200,{ok:true,...operation.result});
  if(operation.cost){
   try{await applyWallet(db,uid,opId,-operation.cost,'music_track',{roomCode,cost:operation.cost});}
   catch(e){if(e.code==='INSUFFICIENT_BALANCE'||e.code==='WALLET_NOT_READY')await ref.transaction(v=>{if(v?.musicQueueLock!==opId)return;delete v.musicQueueLock;delete v.musicOperations[opId];return v;},undefined,false);throw e;}
  }
  const tx=await ref.transaction(v=>{
   if(!v||!v.musicOperations?.[opId])return;
   if(v.musicOperations[opId].status==='done')return v;
   if(v.musicQueueLock!==opId)return;
   const started=ordered(v).length===0,at=Date.now();v.musicQueue=v.musicQueue||{};
   v.musicQueue[opId]={id:opId,...operation.track,url:'https://www.youtube.com/watch?v='+operation.track.videoId,requestedBy:uid,requestedName:String(v.members?.[uid]?.name||'Usuário'),createdAt:at,startedAt:started?at:0,cost:operation.cost,included:operation.cost===0};
   if(started)v.musicPlayback={currentId:opId,startedAt:at};
   v.musicPlan.used=Number(v.musicPlan.used||0)+1;
   v.musicOperations[opId].status='done';v.musicOperations[opId].result={cost:operation.cost,started,id:opId};delete v.musicQueueLock;return v;
  },undefined,false);
  if(!tx.committed)throw new SiteError(409,'MUSIC_QUEUE_PENDING','Pedido pendente. Repita a mesma música para recuperar sem nova cobrança.');
  return sendJson(res,200,{ok:true,...tx.snapshot.val().musicOperations[opId].result});
 }catch(e){const err=publicError(e,'SITE MUSIC QUEUE');return sendJson(res,err.status,{erro:err.erro,code:err.code});}
}
module.exports={handleActivate,handleQueue,resolveTrack};
