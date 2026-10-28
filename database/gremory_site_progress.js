'use strict';
// Progressão independente da carteira Charlotte: nenhuma ação daqui cria Rúpias.
// O servidor valida identidade, origem social e limites antes de conceder XP.
const crypto = require('node:crypto');
class SiteError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code}}
const DAY = 86400000;
const LIMITS = Object.freeze({post:5, comment:12, like:20, heartbeat:12, fish:8, mine:8, horse:10, car:10});
const XP = Object.freeze({post:20, comment:8, like:2, heartbeat:15, fish:8, mine:10, horse:5, car:5});
const FISH = ['Lambari','Tilápia','Traíra','Peixe-dourado','Carpa-lendária'];
const ORES = ['Pedra','Cobre','Ferro','Prata','Cristal raro'];
function integer(v,d=0){return Number.isSafeInteger(Number(v))?Number(v):d}
function level(xp){return 1+Math.floor(Math.sqrt(Math.max(0,xp)/100))}
function challengeDay(ts){return new Date(ts).toISOString().slice(0,10)}
function safeId(s){return /^[a-zA-Z0-9_-]{2,130}$/.test(String(s||''))}
function makeBase(){return{xp:0,level:1,createdAt:Date.now(),updatedAt:Date.now(),day:'',daily:{},achievements:{},totals:{},energy:{},inventory:{fish:{},ore:{}},lastAction:{},receipts:{},sales:{}}}
function awards(row){
 const a={};if(row.xp>=100)a.firstSteps={title:'Primeiros passos',description:'Conquiste 100 XP',icon:'✦'};
 if(row.xp>=1000)a.explorer={title:'Aventureiro',description:'Conquiste 1.000 XP',icon:'✧'};
 if((row.totals.fish||0)>=10)a.fisher={title:'Pescador',description:'Pesque 10 vezes',icon:'🐟'};
 if((row.totals.mine||0)>=10)a.miner={title:'Minerador',description:'Minere 10 vezes',icon:'◆'};
 if((row.totals.post||0)>=5)a.author={title:'Criador',description:'Publique 5 vezes',icon:'✎'};
 return {...(row.achievements||{}),...a};
}
function energyState(row,kind,now,premium){const total=premium?8:6;let e={...(row.energy?.[kind]||{})};if(!e.startedAt||now-e.startedAt>=DAY)e={startedAt:now,used:0};return{...e,remaining:Math.max(0,total-integer(e.used)),max:total,refillAt:e.startedAt+DAY}}
// Servidor é a única autoridade do sorteio. Pesca pode voltar vazia (~22%).
const VALUES=Object.freeze({fish:Object.freeze({'Lambari':2,'Tilápia':4,'Traíra':7,'Peixe-dourado':13,'Carpa-lendária':30}),ore:Object.freeze({'Pedra':1,'Cobre':3,'Ferro':5,'Prata':9,'Cristal raro':24})});
function rollLoot(kind){const n=crypto.randomInt(100);if(kind==='fish'&&n<22)return null;const v=kind==='fish'?n<63?0:n<83?1:n<94?2:n<99?3:4:n<50?0:n<77?1:n<92?2:n<99?3:4;return{label:(kind==='fish'?FISH:ORES)[v],rarity:v===4?'legendary':v>=2?'rare':'common'}}
function saleKind(raw){return raw==='fish'||raw==='ore'?raw:null}
function saleValue(kind,label){return VALUES[kind]?.[label]||0}
// O item é reservado por transação antes de creditar a carteira do bot.
// Uma queda deixa um registro pendente para auditoria, sem pagar duas vezes.
async function reserveSiteSale(db,uid,{kind,label,operationId}={}){
 if(!saleKind(kind)||!saleValue(kind,label)||!/^sale_[a-zA-Z0-9_-]{8,110}$/.test(String(operationId||'')))throw new SiteError(400,'SALE_INVALID','Item ou venda inválida.');
 let picked=null,problem='';
 const tx=await db.ref(`siteProgress/${uid}`).transaction(row=>{
  row=row||makeBase();row.sales=row.sales||{};row.inventory=row.inventory||{fish:{},ore:{}};
  const existing=row.sales[operationId];if(existing){if(existing.kind!==kind||existing.label!==label){problem='ID de venda utilizado com item diferente.';return;}picked=existing;return;}
  const qty=integer(row.inventory[kind]?.[label]);if(qty<1){problem='Você não possui esse item.';return;}
  row.inventory[kind][label]=qty-1;const record={kind,label,amount:saleValue(kind,label),status:'reserved',createdAt:Date.now()};row.sales[operationId]=record;picked=record;return row;
 },undefined,false);
 if(!picked||problem)throw new SiteError(409,'SALE_NOT_RESERVED',problem||'Venda não reservada.');
 return picked;
}
async function finishSiteSale(db,uid,operationId){await db.ref(`siteProgress/${uid}/sales/${operationId}/status`).set('paid')}

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
async function executeSiteProgress(db,uid,body={}){
 const kind=String(body.action||'status');
 try{
  if(kind==='status'){
   const row=(await db.ref(`siteProgress/${uid}`).once('value')).val()||makeBase();
   const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val(),now=Date.now();
   return {ok:true,progress:{...row,level:level(row.xp)},energy:{fish:energyState(row,'fish',now,premium),mine:energyState(row,'mine',now,premium)}};
  }
  if(!Object.hasOwn(XP,kind))throw new SiteError(400,'ACTION_INVALID','Atividade inválida.');
  const ban=(await db.ref(`siteBans/${uid}`).once('value')).val();if(ban?.active===true&&(!Number(ban.expiresAt)||Number(ban.expiresAt)>Date.now()))throw new SiteError(403,'BANNED','Conta suspensa.');
  const id=String(body.itemId||'');const requestId=/^[a-zA-Z0-9_-]{8,120}$/.test(String(body.requestId||''))?String(body.requestId):'';if(['post','comment','like'].includes(kind))await verifySocial(db,uid,kind,id);
  const premium=!!(await db.ref(`charlotteSync/${uid}/account/premium`).once('value')).val(),now=Date.now(),day=challengeDay(now);
  const loot=['fish','mine'].includes(kind)?rollLoot(kind):null;
  const raceWinner=['horse','car'].includes(kind)?crypto.randomInt(1,7):null;
  const selection=['horse','car'].includes(kind)?integer(body.choice,-1):0;
  if(raceWinner!==null&&(selection<1||selection>6))throw new SiteError(400,'CHOICE_INVALID','Escolha um dos seis participantes.');
  const prize=raceWinner!==null&&raceWinner===selection&&body.walletLinked===true?18:0;
  let error='',applied=false,result=null,replay=null;
  const tx=await db.ref(`siteProgress/${uid}`).transaction(value=>{
   error='';applied=false;result=null;replay=null;
   const row=value||makeBase();row.receipts=row.receipts||{};row.jobReceipts=row.jobReceipts||{};if(requestId&&row.jobReceipts[requestId]){replay=row.jobReceipts[requestId];return;}row.totals=row.totals||{};row.lastAction=row.lastAction||{};row.energy=row.energy||{};row.inventory=row.inventory||{fish:{},ore:{}};
   if(row.day!==day){row.day=day;row.daily={};row.receipts={};}
   row.daily=row.daily||{};const count=integer(row.daily[kind]);
   if(count>=LIMITS[kind]){error='Limite diário de XP atingido nesta atividade.';return;}
   if(['post','comment','like'].includes(kind)&&row.receipts[`${kind}:${id}`]){error='Você já recebeu XP por esta atividade.';return;}
   if(kind==='heartbeat'&&now-integer(row.lastAction.heartbeat)<300000){error='XP de presença disponível a cada 5 minutos.';return;}
   if(['horse','car'].includes(kind)&&now-integer(row.lastAction[kind])<60000){error='Aguarde um minuto antes da próxima corrida.';return;}
   if(kind==='fish'||kind==='mine'){const en=energyState(row,kind,now,premium);if(en.remaining<1){error='Energia esgotada. Sua energia volta 24 horas após o início da rodada.';return;}row.energy[kind]={startedAt:en.startedAt,used:en.used+1};if(loot){const bucket=kind==='mine'?'ore':'fish';row.inventory[bucket]=row.inventory[bucket]||{};row.inventory[bucket][loot.label]=integer(row.inventory[bucket][loot.label])+1;}}
   const gained=XP[kind]*(premium?2:1);row.xp=integer(row.xp)+gained;row.level=level(row.xp);row.updatedAt=now;row.daily[kind]=count+1;row.totals[kind]=integer(row.totals[kind])+1;row.lastAction[kind]=now;
   if(['post','comment','like'].includes(kind))row.receipts[`${kind}:${id}`]=now;
   row.achievements=awards(row);applied=true;result={xp:gained,totalXp:row.xp,level:row.level,loot,raceWinner,choice:selection,prize,energy:['fish','mine'].includes(kind)?energyState(row,kind,now,premium):null};if(requestId){row.jobReceipts[requestId]=result;const keys=Object.keys(row.jobReceipts);if(keys.length>120)for(const key of keys.slice(0,keys.length-120))delete row.jobReceipts[key];}return row;
  },undefined,false);
  if(!tx.committed||!applied){if(replay)return {ok:true,...replay};throw new SiteError(409,'XP_LIMIT',error||'Ação não confirmada. Tente novamente.');}
  return {ok:true,...result};
 }catch(e){throw e}
}
module.exports={executeSiteProgress,level,energyState,rollLoot,makeBase,reserveSiteSale,finishSiteSale,saleValue};
