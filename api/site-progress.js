'use strict';
// Progressão independente da carteira Charlotte: nenhuma ação daqui cria Rúpias.
// O servidor valida identidade, origem social e limites antes de conceder XP.
const crypto = require('node:crypto');
const {authenticate, publicError, SiteError} = require('./site-wallet');
const DAY = 86400000;
const LIMITS = Object.freeze({post:5, comment:12, like:20, heartbeat:12, fish:8, mine:8, horse:10, car:10});
const XP = Object.freeze({post:20, comment:8, like:2, heartbeat:15, fish:8, mine:10, horse:5, car:5});
const FISH = ['Lambari','Tilápia','Traíra','Peixe-dourado','Carpa-lendária'];
const ORES = ['Pedra','Cobre','Ferro','Prata','Cristal raro'];
function integer(v,d=0){return Number.isSafeInteger(Number(v))?Number(v):d}
function level(xp){return 1+Math.floor(Math.sqrt(Math.max(0,xp)/100))}
function challengeDay(ts){return new Date(ts).toISOString().slice(0,10)}
function safeId(s){return /^[a-zA-Z0-9_-]{2,130}$/.test(String(s||''))}
function makeBase(){return{xp:0,level:1,createdAt:Date.now(),updatedAt:Date.now(),day:'',daily:{},achievements:{},totals:{},energy:{},inventory:{fish:{},ore:{}},lastAction:{},receipts:{}}}
function awards(row){
 const a={};if(row.xp>=100)a.firstSteps={title:'Primeiros passos',description:'Conquiste 100 XP',icon:'✦'};
 if(row.xp>=1000)a.explorer={title:'Aventureiro',description:'Conquiste 1.000 XP',icon:'✧'};
 if((row.totals.fish||0)>=10)a.fisher={title:'Pescador',description:'Pesque 10 vezes',icon:'🐟'};
 if((row.totals.mine||0)>=10)a.miner={title:'Minerador',description:'Minere 10 vezes',icon:'◆'};
 if((row.totals.post||0)>=5)a.author={title:'Criador',description:'Publique 5 vezes',icon:'✎'};
 return {...(row.achievements||{}),...a};
}
function energyState(row,kind,now,premium){const total=premium?8:6;let e={...(row.energy?.[kind]||{})};if(!e.startedAt||now-e.startedAt>=DAY)e={startedAt:now,used:0};return{...e,remaining:Math.max(0,total-integer(e.used)),max:total,refillAt:e.startedAt+DAY}}
function rollLoot(kind){const n=crypto.randomInt(100);if(kind==='fish'&&n<22)return null;if(kind==='fish')return{label:FISH[n<50?0:n<77?1:n<92?2:n<99?3:4],rarity:n<77?'common':n<99?'rare':'legendary'};return{label:ORES[n<50?0:n<77?1:n<92?2:n<99?3:4],rarity:n<77?'common':n<99?'rare':'legendary'}}
async function verifySocial(db,uid,kind,id){
 if(!safeId(id))throw new SiteError(400,'ITEM_INVALID','Publicação inválida.');
 let path;
 if(kind==='post')path=`communityPosts/${id}`;
 if(kind==='comment'){const [postId,commentId]=id.split('_comment_');if(!safeId(postId)||!safeId(commentId))throw new SiteError(400,'COMMENT_INVALID','Comentário inválido.');path=`communityComments/${postId}/${commentId}`}
 if(kind==='like'){const [postId]=id.split('_like_');if(!safeId(postId))throw new SiteError(400,'LIKE_INVALID','Curtida inválida.');const sn=await db.ref(`communityLikes/${postId}/${uid}`).once('value');if(sn.val()!==true)throw new SiteError(403,'LIKE_NOT_FOUND','A curtida não existe.');return;}
 const sn=await db.ref(path).once('value'),data=sn.val();
 if(!data||data.uid!==uid)throw new SiteError(403,'SOCIAL_NOT_YOURS','Esta atividade não pertence à sua conta.');
 if(Math.abs(Date.now()-Number(data.createdAt))>DAY)throw new SiteError(409,'OLD_ACTIVITY','Esta atividade não pode mais gerar XP.');
}
async function handleProgress(req,res,{readJsonBody,sendJson}){
 res.setHeader('Cache-Control','no-store');
 try{
  const {uid,db,body}=await authenticate(req,readJsonBody),kind=String(body.action||'status');
  if(kind==='status'){
   const row=(await db.ref(`siteProgress/${uid}`).once('value')).val()||makeBase();
   const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val(),now=Date.now();
   return sendJson(res,200,{ok:true,progress:{...row,level:level(row.xp)},energy:{fish:energyState(row,'fish',now,premium),mine:energyState(row,'mine',now,premium)}});
  }
  if(!Object.hasOwn(XP,kind))throw new SiteError(400,'ACTION_INVALID','Atividade inválida.');
  const ban=(await db.ref(`siteBans/${uid}`).once('value')).val();if(ban?.active===true&&(!Number(ban.expiresAt)||Number(ban.expiresAt)>Date.now()))throw new SiteError(403,'BANNED','Conta suspensa.');
  const id=String(body.itemId||'');if(['post','comment','like'].includes(kind))await verifySocial(db,uid,kind,id);
  const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val(),now=Date.now(),day=challengeDay(now);
  const loot=['fish','mine'].includes(kind)?rollLoot(kind):null;
  const raceWinner=['horse','car'].includes(kind)?crypto.randomInt(1,7):null;
  let error='',applied=false,result=null;
  const tx=await db.ref(`siteProgress/${uid}`).transaction(value=>{
   error='';applied=false;result=null;
   const row=value||makeBase();row.receipts=row.receipts||{};row.totals=row.totals||{};row.lastAction=row.lastAction||{};row.energy=row.energy||{};row.inventory=row.inventory||{fish:{},ore:{}};
   if(row.day!==day){row.day=day;row.daily={};row.receipts={};}
   row.daily=row.daily||{};const count=integer(row.daily[kind]);
   if(count>=LIMITS[kind]){error='Limite diário de XP atingido nesta atividade.';return;}
   if(['post','comment','like'].includes(kind)&&row.receipts[`${kind}:${id}`]){error='Você já recebeu XP por esta atividade.';return;}
   if(kind==='heartbeat'&&now-integer(row.lastAction.heartbeat)<300000){error='XP de presença disponível a cada 5 minutos.';return;}
   if(['horse','car'].includes(kind)&&now-integer(row.lastAction[kind])<60000){error='Aguarde um minuto antes da próxima corrida.';return;}
   if(kind==='fish'||kind==='mine'){const en=energyState(row,kind,now,premium);if(en.remaining<1){error='Energia esgotada. Sua energia volta 24 horas após o início da rodada.';return;}row.energy[kind]={startedAt:en.startedAt,used:en.used+1};const bucket=kind==='mine'?'ore':'fish';row.inventory[bucket]=row.inventory[bucket]||{};if(loot)row.inventory[bucket][loot.label]=integer(row.inventory[bucket][loot.label])+1;}
   const gained=XP[kind]*(premium?2:1);row.xp=integer(row.xp)+gained;row.level=level(row.xp);row.updatedAt=now;row.daily[kind]=count+1;row.totals[kind]=integer(row.totals[kind])+1;row.lastAction[kind]=now;
   if(['post','comment','like'].includes(kind))row.receipts[`${kind}:${id}`]=now;
   row.achievements=awards(row);applied=true;result={xp:gained,totalXp:row.xp,level:row.level,loot,raceWinner,energy:['fish','mine'].includes(kind)?energyState(row,kind,now,premium):null};return row;
  },undefined,false);
  if(!tx.committed||!applied)throw new SiteError(409,'XP_LIMIT',error||'Ação não confirmada. Tente novamente.');
  return sendJson(res,200,{ok:true,...result});
 }catch(e){const err=publicError(e,'SITE PROGRESS');return sendJson(res,err.status,{erro:err.erro,code:err.code})}
}
module.exports={handleProgress,level,energyState,rollLoot,makeBase};
