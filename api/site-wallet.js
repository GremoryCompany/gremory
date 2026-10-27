'use strict';
// Carteira primária do SITE. Somente Firebase Admin pode escrever.
const {initializeApp,getApps,cert}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase}=require('firebase-admin/database');
const MAX_BALANCE=1_000_000_000_000;
class SiteError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code}}
function normalizedKey(v=''){return String(v||'').replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n').trim()}
function getAdmin(){
 let a,raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();
 try{
  if(raw){if(!raw.startsWith('{'))raw=Buffer.from(raw,'base64').toString('utf8');const s=JSON.parse(raw);a={projectId:s.project_id||s.projectId,clientEmail:s.client_email||s.clientEmail,privateKey:normalizedKey(s.private_key||s.privateKey)}}
  else a={projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:normalizedKey(process.env.FIREBASE_PRIVATE_KEY||Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64||'','base64').toString('utf8'))};
 }catch{throw new SiteError(503,'FIREBASE_ADMIN_JSON_INVALID','A credencial Firebase Admin na Vercel está mal formatada.');}
 const url=String(process.env.FIREBASE_DATABASE_URL||'').trim();
 if(!a.projectId||!a.clientEmail||!a.privateKey||!url)throw new SiteError(503,'FIREBASE_ADMIN_MISSING','A Vercel não possui todas as variáveis Firebase Admin: FIREBASE_DATABASE_URL e FIREBASE_SERVICE_ACCOUNT_JSON (ou PROJECT_ID, CLIENT_EMAIL e PRIVATE_KEY).');
 try{
  const app=getApps().find(x=>x.name==='gremory-site-wallet')||initializeApp({credential:cert(a),databaseURL:url},'gremory-site-wallet');
  return{auth:getAuth(app),db:getDatabase(app)};
 }catch(e){throw new SiteError(503,'FIREBASE_ADMIN_INVALID','A credencial Firebase Admin configurada na Vercel foi rejeitada.');}
}
async function authenticate(req,readJsonBody){
 if(req.method!=='POST')throw new SiteError(405,'METHOD','Método inválido.');
 const body=await readJsonBody(req);const token=String(body?.idToken||'');
 if(!token||token.length>10000)throw new SiteError(401,'AUTH_REQUIRED','Faça login novamente.');
 const {auth,db}=getAdmin();
 let decoded;
 try{decoded=await auth.verifyIdToken(token)}catch{throw new SiteError(401,'AUTH_EXPIRED','Sessão expirada. Faça login novamente.');}
 if(!decoded?.uid)throw new SiteError(401,'AUTH_INVALID','Sua sessão é inválida.');
 return{uid:decoded.uid,db,body};
}
function publicError(err,tag='SITE API'){
 console.error(`[${tag}]`,err?.code||'',err?.message||err);
 if(err instanceof SiteError)return{status:err.status,code:err.code,erro:err.message};
 const msg=String(err?.message||'');
 if(/permission|credential|unauthorized|invalid_grant/i.test(msg))return{status:503,code:'FIREBASE_ADMIN_DENIED',erro:'A Vercel não conseguiu acessar o Firebase com sua credencial Admin. Confira o projeto, databaseURL e permissões.'};
 if(/timed out|timeout|network|ENOTFOUND|ECONN|socket/i.test(msg))return{status:503,code:'FIREBASE_NETWORK',erro:'A conexão da API do site com o Firebase falhou. Consulte o histórico antes de repetir.'};
 return{status:503,code:'SITE_DATABASE_ERROR',erro:'Falha ao salvar no banco do site. Consulte os logs da Vercel com o código SITE_DATABASE_ERROR.'};
}
async function linked(db,uid){const sn=await db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value');return!!sn.val()}
const validMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_BALANCE;
async function wallet(db,uid){const value=(await db.ref(`siteWallets/${uid}`).once('value')).val();if(!value||!validMoney(Number(value.balance)))throw new SiteError(409,'WALLET_NOT_READY','Sua carteira do site ainda não foi importada. Vincule a Charlotte e aguarde a sincronização inicial.');return value}
function applyEntry(current,opId,delta,kind,detail={}){
 if(!current||!validMoney(Number(current.balance)))return;
 current.receipts=current.receipts||{};
 if(current.receipts[opId])return current;
 const balance=Number(current.balance)+delta;
 if(!validMoney(balance))return;
 current.balance=balance;current.version=Number(current.version||0)+1;current.updatedAt=Date.now();
 current.receipts[opId]={at:Date.now(),delta,kind,...detail,balance};
 // Never evict a receipt without a permanent ledger: repeated operation IDs must remain idempotent.
 return current;
}
async function applyWallet(db,uid,opId,delta,kind,detail={}){
 if(!/^[-_a-zA-Z0-9]{8,110}$/.test(opId)||!Number.isSafeInteger(delta)||Math.abs(delta)>MAX_BALANCE)throw new SiteError(400,'WALLET_OPERATION_INVALID','Operação financeira inválida.');
 const ref=db.ref(`siteWallets/${uid}`),tx=await ref.transaction(v=>applyEntry(v,opId,delta,kind,detail),undefined,false);
 if(!tx.committed){const value=tx.snapshot.val();if(!value)throw new SiteError(409,'WALLET_NOT_READY','Carteira não sincronizada com a Charlotte.');throw new SiteError(409,'INSUFFICIENT_BALANCE','Saldo insuficiente ou limite financeiro excedido.');}
 const w=tx.snapshot.val();return{balance:w.balance,receipt:w.receipts?.[opId]||null,version:w.version};
}
async function getWalletBalance(db,uid){return(await wallet(db,uid)).balance}
module.exports={SiteError,getAdmin,authenticate,publicError,linked,wallet,applyWallet,applyEntry,validMoney,MAX_BALANCE,getWalletBalance};
