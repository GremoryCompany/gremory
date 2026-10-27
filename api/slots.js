'use strict';
// Sorteio, débito e crédito acontecem em UMA transação do Firebase, do lado do site.
// O bridge apenas sincroniza o novo saldo com a Charlotte, sem bloquear o giro.
const crypto=require('crypto');
const {authenticate,publicError,linked,applyWallet,SiteError,MAX_BALANCE,wallet}=require('./site-wallet');
const ITEMS=[
 {symbol:'✦',weight:28,mult:3},{symbol:'♥',weight:22,mult:4},
 {symbol:'☾',weight:18,mult:5},{symbol:'◆',weight:14,mult:6},
 {symbol:'⚡',weight:9,mult:8},{symbol:'♛',weight:6,mult:12},{symbol:'7',weight:3,mult:25}
];
function pick(){const n=crypto.randomInt(100);let total=0;for(const item of ITEMS){total+=item.weight;if(n<total)return item}return ITEMS[0]}
function newSpin(uid,bet,requestId){const items=[pick(),pick(),pick()],symbols=items.map(i=>i.symbol),triple=symbols.every(x=>x===symbols[0]);const payout=triple?bet*items[0].mult:new Set(symbols).size===2?Math.floor(bet*1.2):0;return{spinId:requestId,uid,bet,payout,symbols,jackpot:triple&&symbols[0]==='7',label:triple?`Trinca ${symbols[0]}`:payout?'Dupla':'Sem prêmio',createdAt:Date.now()}}
function publicSpin(spin,balance,receipt){return{ok:true,spinId:spin.spinId,bet:spin.bet,payout:spin.payout,symbols:spin.symbols,jackpot:!!spin.jackpot,label:spin.label,balance,settlement:'done',syncedToCharlotte:false,receiptId:spin.spinId,version:receipt?.version}}
async function handleSlotsSpin(req,res,{readJsonBody,sendJson}){
 res.setHeader('Cache-Control','no-store');
 try{
  const {uid,db,body}=await authenticate(req,readJsonBody);
  const bet=Number(body.bet),requestId=String(body.requestId||'');
  if(!/^spin_[a-f0-9]{32}$/.test(requestId))throw new SiteError(400,'SPIN_ID_INVALID','Identificador de giro inválido. Atualize a página.');
  if(!Number.isSafeInteger(bet)||bet<10||bet>Math.floor(MAX_BALANCE/25))throw new SiteError(400,'BET_INVALID','A aposta deve ser de pelo menos ₹10 e não pode exceder o limite seguro da carteira.');
  if(!(await linked(db,uid)))throw new SiteError(409,'CHARLOTTE_NOT_LINKED','Vincule sua carteira Charlotte antes de apostar.');
  const oldPending=(await db.ref(`siteSlotsPending/${uid}`).once('value')).val();
  if(oldPending)throw new SiteError(409,'LEGACY_SPIN_PENDING','Existe uma aposta da versão anterior ainda pendente. Verifique o extrato antes de iniciar outra.');
  const before=await wallet(db,uid),oldReceipt=before.receipts?.[requestId];
  if(oldReceipt){if(oldReceipt.kind!=='slot'||oldReceipt.bet!==bet)throw new SiteError(409,'SPIN_REPLAY_MISMATCH','Essa operação já foi utilizada para outra aposta.');return sendJson(res,200,publicSpin(oldReceipt.spin,oldReceipt.balance,{version:before.version}));}
  if(before.balance<bet)throw new SiteError(409,'INSUFFICIENT_BALANCE',`Saldo insuficiente: ₹${before.balance}.`);
  const spin=newSpin(uid,bet,requestId);
  const result=await applyWallet(db,uid,requestId,spin.payout-spin.bet,'slot',{bet,spin});
  if(result.receipt?.kind!=='slot'||result.receipt?.bet!==bet)throw new SiteError(409,'SPIN_REPLAY_MISMATCH','Aposta já registrada com dados diferentes.');
  return sendJson(res,200,publicSpin(result.receipt.spin,result.balance,{version:result.version}));
 }catch(e){const err=publicError(e,'SITE SLOTS');return sendJson(res,err.status,{erro:err.erro,code:err.code});}
}
async function handleSlotsStatus(req,res,{readJsonBody,sendJson}){
 res.setHeader('Cache-Control','no-store');
 try{
  const {uid,db,body}=await authenticate(req,readJsonBody);
  const spinId=String(body.spinId||'');if(spinId&&!/^spin_[a-f0-9]{32}$/.test(spinId))throw new SiteError(400,'SPIN_ID_INVALID','Giro inválido.');
  const w=await wallet(db,uid),receipt=spinId?w.receipts?.[spinId]:null;
  if(receipt?.kind==='slot')return sendJson(res,200,{ok:true,status:'done',spinId,bet:receipt.bet,balance:receipt.balance,spin:receipt.spin});
  const pending=(await db.ref(`siteSlotsPending/${uid}`).once('value')).val();
  return sendJson(res,200,{ok:true,status:pending?'legacy_pending':'none',spinId:spinId||null,pending:!!pending,jobId:pending?.jobId||null,balance:w.balance});
 }catch(e){const err=publicError(e,'SITE SLOTS STATUS');return sendJson(res,err.status,{erro:err.erro,code:err.code});}
}
module.exports={handleSlotsSpin,handleSlotsStatus,pick,newSpin,publicSpin};
