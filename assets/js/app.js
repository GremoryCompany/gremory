import { initCommunity } from './community.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, inMemoryPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut, updateProfile, sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, push, onValue, remove, onDisconnect, query, orderByChild, limitToLast, runTransaction
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAs0NwqCy8sDpzICUasrRGyh--PNq-RO84',
  authDomain: 'gremory-e4313.firebaseapp.com',
  databaseURL: 'https://gremory-e4313-default-rtdb.firebaseio.com',
  projectId: 'gremory-e4313',
  storageBucket: 'gremory-e4313.firebasestorage.app',
  messagingSenderId: '33477938304',
  appId: '1:33477938304:web:83f29ce0e35dc79ff06a65',
  measurementId: 'G-6Q9KFT1CC5'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const DEFAULT_AVATAR = '/assets/img/profile.jpg';
const WHATSAPP_NUMBER = '5521979325525';
const ADMIN_EMAIL = 'losermodder@gmail.com';
const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const CHARLOTTE_MUSIC_AVATAR = '/assets/img/profile.jpg';
let RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

const state = {
  user:null, profile:null, privateData:null, route:'home',
  webTeam:{}, charlottePublic:null, charlotteSync:null,
  friends:{}, requests:{}, directory:{},
  downloadService:'tiktok', lastDownloadInput:'',
  roomCode:null, room:null, roomUnsubs:[],
  userUnsubs:[], duel:null, duelUnsub:null,
  bridgeResults:{}, siteInventory:{}, siteCustomization:{}, storeCatalog:{},
  teamDraft:[], pokemonEncounter:null, pokemonHealing:{}, pokemonAudio:{encounterId:'',resultId:''}, siteRaid:null, siteRaidConfig:{},
  ttt:{game:null,unsub:null,index:{},lastResultId:'',seenActiveIds:new Set()},
  blackjack:{game:null,unsub:null,index:{},seenActiveIds:new Set()},
  hangman:{game:null,unsub:null,index:{},seenActiveIds:new Set()},
  siteGameChallenges:{},siteGameChallengeSeen:new Set(),
  duelSeenActiveIds:new Set(),
  notificationFilter:'team',
  browserNotificationLastAt:0,
  admin:{reports:{},updates:{},directory:{},bans:{},selectedUid:'',supportChats:{},supportSelectedUid:'',supportUnsub:null,backupStatus:{}},
  tinder:{current:null,seen:[]},updates:{},notifications:{},notificationDismissed:{},ban:null,supportChat:{messages:{}},
  watchCode:null,watchRoom:null,watchUnsubs:[],watchApplying:false,
  watchRtc:{joined:false,audioJoined:false,localStream:null,screenStream:null,screenSource:'',localFileVideo:null,localFileUrl:'',localFileName:'',localFileAudioCtx:null,localFileAudioSource:null,localFileAudioDest:null,fullscreenUiTimer:null,peers:new Map(),remoteStreams:new Map(),remoteVoiceStreams:new Map(),remoteScreenStreams:new Map(),processed:new Set(),pendingCandidates:new Map(),presenceUnsub:null,inboxUnsub:null,disconnectRef:null,micEnabled:true,activeScreenUid:null,screenSharers:new Set(),presence:{},screenRetry:new Map(),makingOffer:new Set(),screenSoundMuted:false},
  watchYoutube:{lastTime:0,lastState:-1,lastPublishAt:0},
  watchMusic:{currentId:'',volume:Number(localStorage.getItem('gremory:watchMusicVolume')||65),muted:localStorage.getItem('gremory:watchMusicMuted')==='1',engineReady:false,lastAdvanceId:'',adding:false,currentTime:0,lastClockSync:0,endedId:''},
  rtc:{joined:false,localStream:null,screenStream:null,peers:new Map(),remoteStreams:new Map(),processed:new Set(),presenceUnsub:null,inboxUnsub:null,disconnectRef:null,micEnabled:true},premiumPoll:null
};

function toast(message, ms=3300){
  const root=$('toastRoot'); if(!root) return;
  const el=document.createElement('div'); el.className='toast'; el.textContent=String(message||''); root.appendChild(el);
  setTimeout(()=>el.remove(),ms);
}
function openModal(id){const m=$(id);if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeModal(id){const m=$(id);if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')}
function setDrawer(open){const d=$('accountDrawer');if(!d)return;d.classList.toggle('open',!!open);d.setAttribute('aria-hidden',open?'false':'true')}
function escText(v){return String(v??'')}
function formatNumber(v){return new Intl.NumberFormat('pt-BR').format(Number(v||0))}
function displayName(){return state.profile?.nome||state.user?.displayName||state.user?.email?.split('@')[0]||'Usuário'}
function isSiteAdmin(){return String(state.user?.email||'').trim().toLowerCase()===ADMIN_EMAIL}
function normalizeUsername(v=''){return String(v||'').trim().toLowerCase().replace(/^@+/,'')}
function validUsername(v=''){return /^[a-z][a-z0-9_]{2,19}$/.test(normalizeUsername(v))}
function usernameLabel(p=state.profile){const u=normalizeUsername(p?.username||'');return u?`@${u}`:'@sem_usuario'}
function usernameCooldownRemaining(p=state.profile){
  const at=Number(p?.usernameChangedAt||0);if(!at)return 0;
  return Math.max(0,USERNAME_COOLDOWN_MS-(Date.now()-at));
}
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').then(reg=>reg.update().catch(()=>{})).catch(()=>{}),{once:true})}

function formatCooldown(ms){
  if(ms<=0)return'Você pode alterar agora.';
  const d=Math.ceil(ms/86400000);return `Você poderá trocar novamente em ${d} dia${d===1?'':'s'}.`;
}
function renderAdminAccess(){
  const ok=isSiteAdmin();
  if($('adminNavBtn'))$('adminNavBtn').hidden=!ok;
  if($('adminDrawerBtn'))$('adminDrawerBtn').hidden=!ok;
  if($('mobileAdminBtn'))$('mobileAdminBtn').hidden=!ok;
  if($('siteRaidAdmin'))$('siteRaidAdmin').hidden=!ok;
}

function avatarFor(p=state.profile){return p?.avatar||state.user?.photoURL||DEFAULT_AVATAR}
function nowIso(){return new Date().toISOString()}
function shortDate(v){try{return new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})}catch{return'—'}}
function shortDateTime(v){try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
function randomCode(len=6){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=new Uint8Array(len);crypto.getRandomValues(a);return [...a].map(x=>alphabet[x%alphabet.length]).join('')}
function wa(command){window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(command)}`,'_blank','noopener,noreferrer')}
function clearUnsubs(list){list.splice(0).forEach(fn=>{try{fn()}catch{}})}
function permissionMessage(err, fallback='Não foi possível concluir essa ação.'){
  const txt=String(err?.code||err?.message||err||'').toLowerCase();
  if(txt.includes('permission_denied')||txt.includes('permission denied')) return 'Não foi possível concluir essa ação agora.';
  return fallback;
}

function withTimeout(promise, ms=15000, code='TIMEOUT'){
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(()=>clearTimeout(timer)),
    new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(code);e.code=code;reject(e)},ms)})
  ]);
}
function authFlowError(err){
  const code=String(err?.code||err?.message||'');
  if(code==='AUTH_TIMEOUT'||code==='DB_TIMEOUT'||code==='PERSISTENCE_TIMEOUT')return 'A conexão demorou mais que o esperado. Tente novamente.';
  return authError(err);
}

const routeMeta={
  feed:['COMUNIDADE','Feed'],home:['GREMORY','Início'],charlotte:['CHARLOTTE','Charlotte'],pokemon:['POKÉMON','Centro Pokémon'],friends:['AMIGOS','Pessoas'],tinder:['TINDER','Descobrir pessoas'],updates:['ATUALIZAÇÕES','Novidades'],downloads:['DOWNLOADS','Downloads'],studio:['STUDIO','PDF & Canvas'],games:['JOGOS','Jogos'],watch:['WATCH PARTY','Assistir com amigos'],rpg:['RPG','Mesas'],premium:['PREMIUM','Gremory Premium'],personalize:['PERSONALIZAR','Loja de rúpias'],support:['SUPORTE','Gremory oficial'],admin:['ADMINISTRAÇÃO','Painel do host']
};
function navigate(route){
  if(route==='admin'&&!isSiteAdmin()){toast('Acesso restrito ao host.');route='home'}
  if(!routeMeta[route]) route='home'; state.route=route; document.body.classList.toggle('watch-performance',route==='watch');
  $$('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===route));
  $$('[data-route]').forEach(el=>el.classList.toggle('active',el.dataset.route===route));
  const [eye,title]=routeMeta[route]; $('pageEyebrow').textContent=eye; $('pageTitle').textContent=title;
  history.replaceState(null,'',`#${route}`); window.scrollTo({top:0,behavior:'auto'});
  if(route==='pokemon') {loadPokemonSources(); renderDuelFriendSelect();}
  if(route==='friends') loadDirectory();
  if(route==='tinder'){loadOwnTinderProfile();loadTinderProfile();}
  if(route==='updates') renderUpdates();
  if(route==='games') renderGameFriendSelects();
  if(route==='studio') initGremoryDesignStudio().catch(e=>toast(e.message||'Não foi possível abrir o Design Studio.'));
  if(route==='watch'&&state.user&&!state.watchCode) loadWatchRooms();
  if(route==='rpg'&&state.user&&!state.roomCode) loadMyRooms();
  if(route==='premium'&&state.user&&state.charlottePublic?.status==='linked') requestAccountSync().catch(()=>{});
  if(route==='personalize') renderStore();
  if(route==='support') renderSupportChat();
  if(route==='admin') loadAdminDashboard();
}
$$('[data-route]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
function setMobileMore(open){const sh=$('mobileMoreSheet');if(!sh)return;sh.classList.toggle('open',!!open);sh.setAttribute('aria-hidden',open?'false':'true')}
$('mobileMoreBtn')?.addEventListener('click',()=>setMobileMore(true));
$('mobileMoreBackdrop')?.addEventListener('click',()=>setMobileMore(false));
$('mobileMoreClose')?.addEventListener('click',()=>setMobileMore(false));
$('mobileMoreSheet')?.querySelectorAll('[data-route]')?.forEach(b=>b.addEventListener('click',()=>setMobileMore(false)));
$('mobileMoreSheet')?.querySelector('#mobileAccountBtn')?.addEventListener('click',()=>{setMobileMore(false);setDrawer(true)});

['topAccountBtn','mobileAccountBtn','homeProfileBtn','sideAccountBtn'].forEach(id=>$(id)?.addEventListener('click',()=>setDrawer(true)));
$('accountDrawerBackdrop')?.addEventListener('click',()=>setDrawer(false));
$('accountDrawerClose')?.addEventListener('click',()=>setDrawer(false));
$('adminDrawerBtn')?.addEventListener('click',()=>{setDrawer(false);navigate('admin')});
$$('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.closeModal)));

// Auth: sem "manter conectado", recarregar a página exige login novamente.
function authTab(mode){
  $$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===mode));
  $$('[data-auth-form]').forEach(f=>f.classList.toggle('active',f.dataset.authForm===mode));
  $('authHeading').textContent=mode==='login'?'Bem-vindo':'Criar conta'; $('authStatus').textContent='';
}
$$('[data-auth-tab]').forEach(b=>{
  b.addEventListener('click',()=>authTab(b.dataset.authTab));
  b.addEventListener('pointerup',ev=>{
    if(ev.pointerType==='touch')authTab(b.dataset.authTab)
  });
});
function authError(err){
  const code=String(err?.code||err?.message||'');
  const map={
    'auth/email-already-in-use':'Esse e-mail já está em uso.',
    'auth/invalid-email':'E-mail inválido.',
    'auth/weak-password':'Use uma senha com pelo menos 6 caracteres.',
    'auth/invalid-credential':'E-mail ou senha incorretos.',
    'auth/too-many-requests':'Muitas tentativas. Tente novamente mais tarde.',
    'auth/network-request-failed':'Falha de conexão com o Firebase. Verifique sua internet e tente novamente.',
    'auth/unauthorized-domain':'Este endereço do site ainda não está autorizado no Firebase Authentication.',
    'auth/operation-not-allowed':'O cadastro por e-mail/senha está desativado no Firebase Authentication.',
    'auth/web-storage-unsupported':'O navegador bloqueou o armazenamento local. O cadastro continuará sem manter a sessão salva.',
    'auth/configuration-not-found':'A configuração de autenticação do Firebase não foi encontrada.'
  };
  if(map[code])return map[code];
  console.warn('[GREMORY AUTH]',code,err);
  return code&&code.startsWith('auth/')?`Não foi possível concluir agora. (${code})`:'Não foi possível concluir agora.';
}
async function configurePersistence(remember){
  // Persistência do navegador é conveniência, não pode impedir login/cadastro.
  // Alguns WebViews/iOS/abas privadas bloqueiam IndexedDB/localStorage.
  try{
    await withTimeout(setPersistence(auth,remember?browserLocalPersistence:inMemoryPersistence),8000,'PERSISTENCE_TIMEOUT');
    try{if(remember)localStorage.setItem('gremory:remember','1');else localStorage.removeItem('gremory:remember')}catch{}
    return true;
  }catch(e){
    console.warn('[GREMORY AUTH] Persistência indisponível; continuando com sessão temporária.',e);
    try{await setPersistence(auth,inMemoryPersistence)}catch{}
    try{localStorage.removeItem('gremory:remember')}catch{}
    return false;
  }
}
async function initialAuthPolicy(){
  const remember=localStorage.getItem('gremory:remember')==='1';
  try{await setPersistence(auth,remember?browserLocalPersistence:inMemoryPersistence)}catch{}
  if(!remember&&auth.currentUser) await signOut(auth).catch(()=>{});
}
$('loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const form=ev.currentTarget,button=form.querySelector('button[type="submit"]');
  if(button?.disabled)return;
  if(button)button.disabled=true;
  $('authStatus').textContent='Entrando...';
  try{
    await configurePersistence($('loginRemember').checked);
    await withTimeout(signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value),20000,'AUTH_TIMEOUT');
    $('authStatus').textContent='Entrando na Gremory...';
  }catch(e){
    $('authStatus').textContent=authFlowError(e);
  }finally{
    if(button)button.disabled=false;
  }
});
$('registerForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const registerButton=ev.currentTarget.querySelector('button[type="submit"]');
  if(registerButton?.disabled)return;
  if(registerButton)registerButton.disabled=true;

  const name=$('registerName').value.trim();
  const username=normalizeUsername($('registerUsername').value);
  const email=$('registerEmail').value.trim();
  const pass=$('registerPassword').value;
  const pass2=$('registerPassword2').value;

  if(!name){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='Digite seu nome.';}
  if(!validUsername(username)){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='Nome de usuário inválido. Use 3–20 caracteres, começando por letra.';}
  if(pass.length<6){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='A senha precisa ter pelo menos 6 caracteres.';}
  if(pass!==pass2){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='As senhas não coincidem.';}

  $('authStatus').textContent='Criando conta...';
  try{
    await configurePersistence(Boolean($('registerRemember')?.checked));

    // O Firebase Auth é a etapa que cria a conta. Depois disso o usuário já pode
    // entrar no site, mesmo que o Realtime Database esteja momentaneamente lento.
    const cred=await withTimeout(createUserWithEmailAndPassword(auth,email,pass),20000,'AUTH_TIMEOUT');
    const stamp=Date.now();

    await updateProfile(cred.user,{displayName:name}).catch(()=>{});

    // A reserva do @ precisa ser feita depois do Auth, pois /usernames exige usuário autenticado.
    let usernameOk=true;
    try{
      const taken=await withTimeout(get(ref(db,`usernames/${username}`)),8000,'DB_TIMEOUT');
      if(taken?.exists()&&taken.val()?.uid!==cred.user.uid){
        usernameOk=false;
      }else{
        await withTimeout(set(ref(db,`usernames/${username}`),{uid:cred.user.uid,username,updatedAt:stamp}),8000,'DB_TIMEOUT');
      }
    }catch(e){
      if(String(e?.code||e?.message)==='DB_TIMEOUT'){
        console.warn('[GREMORY AUTH] Banco demorou ao reservar username. O perfil poderá ser concluído depois.');
      }else{
        console.warn('[GREMORY AUTH] Não foi possível reservar username:',e);
      }
    }

    const p={
      uid:cred.user.uid,
      nome:name,
      ...(usernameOk?{username,usernameChangedAt:stamp}:{}),
      avatar:'',bio:'',favoriteAnime:'',email:cred.user.email||email,
      whatsappSiteNotify:false,raidWhatsappNotify:false,createdAt:nowIso(),updatedAt:nowIso()
    };

    // Não bloqueia a entrada no site indefinidamente por causa do RTDB.
    Promise.allSettled([
      withTimeout(set(ref(db,`profiles/${cred.user.uid}`),p),10000,'DB_TIMEOUT'),
      usernameOk?withTimeout(set(ref(db,`directory/${cred.user.uid}`),publicProfile(p)),10000,'DB_TIMEOUT'):Promise.resolve()
    ]).then(results=>{
      if(results.some(r=>r.status==='rejected'))console.warn('[GREMORY AUTH] Perfil será sincronizado novamente após entrar.');
    });

    state.profile=p;
    $('authStatus').textContent=usernameOk?'Conta criada. Entrando...':'Conta criada. Escolha outro @ no seu perfil.';

    // onAuthStateChanged abre o app; este fallback impede a tela de cadastro de ficar presa.
    setTimeout(()=>{
      if(auth.currentUser){
        document.body.classList.remove('auth-loading');
        document.body.classList.add('authenticated');
        $('appShell')?.setAttribute('aria-hidden','false');
        if(!usernameOk)setTimeout(()=>setDrawer(true),300);
      }
    },250);

  }catch(e){
    $('authStatus').textContent=authFlowError(e);
  }finally{
    if(registerButton)registerButton.disabled=false;
  }
});
$('resetPasswordBtn').addEventListener('click',async()=>{const email=$('loginEmail').value.trim();if(!email)return $('authStatus').textContent='Digite seu e-mail primeiro.';try{await sendPasswordResetEmail(auth,email);$('authStatus').textContent='E-mail de recuperação enviado.'}catch(e){$('authStatus').textContent=authError(e)}});
$('logoutBtn').addEventListener('click',async()=>{localStorage.removeItem('gremory:remember');clearUserSubscriptions();await signOut(auth);setDrawer(false)});

function publicCustomizationIds(){
  try{return equippedCustomizationIds().map(String).filter(id=>/^[a-z0-9_-]{2,64}$/i.test(id)).slice(0,8)}catch{return[]}
}
function publicProfile(p,styleOverride=null){
  const style=Array.isArray(styleOverride)?styleOverride:publicCustomizationIds();
  return{uid:p.uid,nome:p.nome||'Usuário',username:normalizeUsername(p.username||''),avatar:p.avatar||'',bio:p.bio||'',favoriteAnime:p.favoriteAnime||'',style:style.map(String).filter(id=>/^[a-z0-9_-]{2,64}$/i.test(id)).slice(0,8),createdAt:p.createdAt||nowIso(),updatedAt:p.updatedAt||nowIso()}
}
async function syncPublicCustomization(){
  if(!state.user)return;
  try{await update(ref(db,`directory/${state.user.uid}`),{style:publicCustomizationIds(),updatedAt:nowIso()})}catch{}
}
async function readUserData(user){
  const [ps,old,dirSnap]=await Promise.all([get(ref(db,`profiles/${user.uid}`)).catch(()=>null),get(ref(db,`users/${user.uid}`)).catch(()=>null),get(ref(db,`directory/${user.uid}`)).catch(()=>null)]);
  const p=ps?.exists()?ps.val():{};const o=old?.exists()?old.val():{};const oldDirectory=dirSnap?.exists()?dirSnap.val():{};
  const merged={uid:user.uid,nome:p.nome||o.nome||user.displayName||'Usuário',username:normalizeUsername(p.username||o.username||''),usernameChangedAt:Number(p.usernameChangedAt||o.usernameChangedAt||0),avatar:p.avatar||o.avatar||user.photoURL||'',bio:p.bio||o.bio||'',favoriteAnime:p.favoriteAnime||o.favoriteAnime||o.animeFavorito||'',email:p.email||user.email||'',whatsappSiteNotify:Boolean(p.whatsappSiteNotify),raidWhatsappNotify:Boolean(p.raidWhatsappNotify),createdAt:p.createdAt||o.createdAt||user.metadata?.creationTime||nowIso()};
  if(!ps?.exists()) await set(ref(db,`profiles/${user.uid}`),{...merged,updatedAt:nowIso()}).catch(()=>{});
  else if((!p.email&&user.email)||p.raidWhatsappNotify==null||p.whatsappSiteNotify==null) await update(ref(db,`profiles/${user.uid}`),{email:user.email||p.email||'',whatsappSiteNotify:Boolean(p.whatsappSiteNotify),raidWhatsappNotify:Boolean(p.raidWhatsappNotify),updatedAt:nowIso()}).catch(()=>{});
  await set(ref(db,`directory/${user.uid}`),publicProfile(merged,publicCustomizationIds().length?publicCustomizationIds():(Array.isArray(oldDirectory?.style)?oldDirectory.style:[]))).catch(()=>{});
  state.profile=merged;state.privateData=o;renderAccount();
}
function accountSnapshot(){
  const synced=state.charlotteSync?.account||{};
  const legacy=state.privateData||{};
  return{
    premium:Boolean(synced.premium ?? legacy.premium ?? false),
    level:Number(synced.level ?? legacy.nivel ?? legacy.level ?? legacy.total ?? 0),
    xp:Number(synced.xp ?? legacy.xp ?? 0),
    balance:Number(synced.balance ?? legacy.saldo ?? legacy.dinero ?? 0),
    registered:synced.registered
  };
}
function renderAccount(){
  const p=state.profile||{};const avatar=avatarFor(p);const name=p.nome||'Usuário';const acc=accountSnapshot();const premium=acc.premium;const level=acc.level;const balance=acc.balance;
  ['sideAvatar','topAvatar','profileAvatarPreview'].forEach(id=>{if($(id))$(id).src=avatar});$('sideName').textContent=name;$('sideStatus').textContent=premium?'Premium':usernameLabel(p);$('profileNameView').textContent=name;if($('profileUsernameView'))$('profileUsernameView').textContent=usernameLabel(p);$('profilePlanView').textContent=premium?'Premium':'Padrão';$('profileName').value=name;if($('profileUsername'))$('profileUsername').value=normalizeUsername(p.username||'');if($('profileUsernameHint'))$('profileUsernameHint').textContent=formatCooldown(usernameCooldownRemaining(p));$('profileAvatar').value=p.avatar||'';$('profileBio').value=p.bio||'';$('profileFavoriteAnime').value=p.favoriteAnime||'';if($('profileWhatsappSiteNotify'))$('profileWhatsappSiteNotify').checked=Boolean(p.whatsappSiteNotify);if($('profileRaidWhatsapp'))$('profileRaidWhatsapp').checked=Boolean(p.raidWhatsappNotify);if($('profileBrowserNotify'))$('profileBrowserNotify').checked=browserNotificationsEnabled();if($('raidWhatsappNotify'))$('raidWhatsappNotify').checked=Boolean(p.raidWhatsappNotify);renderAdminAccess();$('profileLevel').textContent=formatNumber(level);$('profileBalance').textContent=`₹ ${formatNumber(balance)}`;$('homePlan').textContent=premium?'Premium':'Padrão';$('homeLevel').textContent=formatNumber(level);$('homeBalance').textContent=`₹ ${formatNumber(balance)}`;$('homeGreeting').textContent=`Olá, ${name}.`;
  if($('storeBalance'))$('storeBalance').textContent=`₹ ${formatNumber(balance)}`;
  if($('slotsBalance'))$('slotsBalance').textContent=`₹ ${formatNumber(balance)}`;
  if($('premiumStatusPill'))$('premiumStatusPill').textContent=premium?'Premium':'Padrão';
  if($('premiumStatusTitle'))$('premiumStatusTitle').textContent=premium?'Premium ativo':'Plano padrão';
  if($('premiumStatusText'))$('premiumStatusText').textContent=state.charlottePublic?.status==='linked'?(premium?'Seu Premium está sincronizado com a Charlotte.':'Escolha um plano abaixo. O pagamento é criado pelo bot com Mercado Pago.'):'Vincule a Charlotte para comprar e sincronizar o Premium pelo site.';
  applyOwnProfileCustomization();renderPokemonInventory();
}
$('profileAvatar').addEventListener('input',()=>{$('profileAvatarPreview').src=$('profileAvatar').value.trim()||DEFAULT_AVATAR});
$('profileForm').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!state.user)return;
  const oldProfile=state.profile||{},oldUsername=normalizeUsername(oldProfile.username||''),username=normalizeUsername($('profileUsername')?.value||'');
  if(!validUsername(username))return toast('Use um nome de usuário com 3–20 caracteres, começando por letra.');
  const changing=username!==oldUsername;
  if(changing&&oldUsername){
    const remaining=usernameCooldownRemaining(oldProfile);
    if(remaining>0)return toast(`Seu @usuário só pode mudar a cada 7 dias. ${formatCooldown(remaining)}`,5000);
  }
  let reservedNew=false;
  try{
    if(changing){
      const sn=await get(ref(db,`usernames/${username}`));
      if(sn.exists()&&sn.val()?.uid!==state.user.uid)throw new Error('Esse nome de usuário já está em uso.');
      await set(ref(db,`usernames/${username}`),{uid:state.user.uid,username,updatedAt:Date.now()});
      reservedNew=true;
    }
    const payload={uid:state.user.uid,nome:$('profileName').value.trim().slice(0,40)||'Usuário',username,usernameChangedAt:changing?Date.now():Number(oldProfile.usernameChangedAt||Date.now()),avatar:$('profileAvatar').value.trim(),bio:$('profileBio').value.trim().slice(0,500),favoriteAnime:$('profileFavoriteAnime').value.trim().slice(0,80),email:state.user.email||oldProfile.email||'',whatsappSiteNotify:Boolean($('profileWhatsappSiteNotify')?.checked),raidWhatsappNotify:Boolean($('profileRaidWhatsapp')?.checked),createdAt:oldProfile.createdAt||nowIso(),updatedAt:nowIso()};
    await set(ref(db,`profiles/${state.user.uid}`),payload);
    await set(ref(db,`directory/${state.user.uid}`),publicProfile(payload));
    if(changing&&oldUsername)await remove(ref(db,`usernames/${oldUsername}`)).catch(()=>{});
    if(state.user.displayName!==payload.nome)await updateProfile(state.user,{displayName:payload.nome});
    state.profile=payload;renderAccount();
    // O saldo continua preso à conta vinculada (UID <-> WhatsApp), não ao texto do @.
    // Sincronizamos a identidade no bridge para que backup, Tinder e saldo usem o novo nome imediatamente.
    if(linkedCharlotte()){
      bridgeRequest('sync_identity',{name:payload.nome,username:payload.username},20000).catch(()=>{});
      requestAccountSync().catch(()=>{});
    }
    toast('Perfil salvo. Seu saldo continua vinculado à mesma conta.');
  }catch(e){
    if(reservedNew&&changing)await remove(ref(db,`usernames/${username}`)).catch(()=>{});
    toast(permissionMessage(e,e.message||'Não foi possível salvar o perfil.'))
  }
});

function clearUserSubscriptions(){try{state.admin.supportUnsub?.()}catch{}state.admin.supportUnsub=null;if(state.premiumPoll){clearInterval(state.premiumPoll);state.premiumPoll=null}clearUnsubs(state.userUnsubs);if(state.duelUnsub){try{state.duelUnsub()}catch{}state.duelUnsub=null}if(state.ttt.unsub){try{state.ttt.unsub()}catch{}state.ttt.unsub=null}if(state.blackjack.unsub){try{state.blackjack.unsub()}catch{}state.blackjack.unsub=null}if(state.hangman.unsub){try{state.hangman.unsub()}catch{}state.hangman.unsub=null}leaveVoice(true).catch(()=>{});leaveWatchVoice(true).catch(()=>{});clearRoomSubscriptions();clearUnsubs(state.watchUnsubs);state.friends={};state.requests={};state.directory={};state.charlottePublic=null;state.charlotteSync=null;state.bridgeResults={};state.siteInventory={};state.siteCustomization={};state.storeCatalog={};state.duel=null;state.teamDraft=[];state.pokemonEncounter=null;state.pokemonAudio={encounterId:'',resultId:''};state.pokemonHealing={};state.siteRaid=null;state.siteRaidConfig={};state.ttt.game=null;state.ttt.index={};state.ttt.lastResultId='';state.ttt.seenActiveIds=new Set();state.blackjack.game=null;state.blackjack.index={};state.blackjack.seenActiveIds=new Set();state.hangman.game=null;state.hangman.index={};state.hangman.seenActiveIds=new Set();state.siteGameChallenges={};state.siteGameChallengeSeen=new Set();state.duelSeenActiveIds=new Set();state.tinder={current:null,seen:[]};state.updates={};state.notifications={};state.notificationDismissed={};state.ban=null;state.supportChat={messages:{}};state.watchCode=null;state.watchRoom=null}
function startUserSubscriptions(){
  clearUserSubscriptions();const uid=state.user.uid;
  state.userUnsubs.push(onValue(ref(db,`friends/${uid}`),s=>{state.friends=s.exists()?s.val():{};renderFriends();renderDuelFriendSelect();$('homeFriendsText').textContent=`${Object.keys(state.friends).length} amigo${Object.keys(state.friends).length===1?'':'s'}`}));
  state.userUnsubs.push(onValue(ref(db,`friendRequests/${uid}`),s=>{state.requests=s.exists()?s.val():{};renderFriendRequests()}));
  state.userUnsubs.push(onValue(ref(db,`charlottePublic/${uid}`),s=>{state.charlottePublic=s.exists()?s.val():null;renderCharlotteStatus()}));
  state.userUnsubs.push(onValue(ref(db,`charlotteSync/${uid}`),s=>{state.charlotteSync=s.exists()?s.val():null;renderCharlotteSync();renderAccount();loadPokemonSources();renderCollection();renderStore();renderPokemonInventory()}));
  state.userUnsubs.push(onValue(ref(db,`siteBridgeResults/${uid}`),s=>{state.bridgeResults=s.exists()?s.val():{}}));
  state.userUnsubs.push(onValue(ref(db,`siteInventory/${uid}`),s=>{state.siteInventory=s.exists()?s.val():{};renderStore()}));
  state.userUnsubs.push(onValue(ref(db,`siteCustomization/${uid}`),s=>{state.siteCustomization=s.exists()?s.val():{};applyCustomization();renderStore();syncPublicCustomization().catch(()=>{})}));
  state.userUnsubs.push(onValue(ref(db,'siteStoreCatalog'),sn=>{state.storeCatalog=sn.exists()?sn.val():{};mergeRemoteStoreCatalog(state.storeCatalog);renderStore();applyCustomization();}));
  state.userUnsubs.push(onValue(query(ref(db,`supportChats/${uid}/messages`),orderByChild('createdAt'),limitToLast(120)),sn=>{state.supportChat.messages=sn.exists()?sn.val():{};renderSupportChat()}));
  state.userUnsubs.push(onValue(ref(db,`pokemonSiteChallenges/${uid}`),s=>renderDuelInbox(s.exists()?s.val():{})));
  state.userUnsubs.push(onValue(ref(db,`pokemonSiteDuelIndex/${uid}`),s=>handleDuelIndex(s.exists()?s.val():{})));
  state.userUnsubs.push(onValue(ref(db,`pokemonSiteEncounter/${uid}`),s=>{state.pokemonEncounter=s.exists()?s.val():null;renderWildEncounter()}));
  state.userUnsubs.push(onValue(ref(db,`pokemonHealing/${uid}`),s=>{state.pokemonHealing=s.exists()?s.val():{};renderHealingList();renderCollection()}));
  state.userUnsubs.push(onValue(ref(db,'pokemonSiteRaid/current'),s=>{state.siteRaid=s.exists()?s.val():null;renderSiteRaid()}));
  state.userUnsubs.push(onValue(ref(db,'pokemonSiteRaidConfig'),s=>{state.siteRaidConfig=s.exists()?s.val():{};renderSiteRaid()}));

  state.userUnsubs.push(onValue(ref(db,`ticTacToeIndex/${uid}`),s=>{state.ttt.index=s.exists()?s.val():{};handleTttIndex(state.ttt.index)}));
  state.userUnsubs.push(onValue(ref(db,`blackjackIndex/${uid}`),s=>{state.blackjack.index=s.exists()?s.val():{};handleBlackjackIndex(state.blackjack.index)}));
  state.userUnsubs.push(onValue(ref(db,`hangmanIndex/${uid}`),s=>{state.hangman.index=s.exists()?s.val():{};handleHangmanIndex(state.hangman.index)}));
  state.userUnsubs.push(onValue(ref(db,`siteGameChallenges/${uid}`),s=>{state.siteGameChallenges=s.exists()?s.val():{};renderSiteGameChallenges();renderNotifications()}));
  state.userUnsubs.push(onValue(query(ref(db,'siteUpdates'),orderByChild('createdAt'),limitToLast(60)),s=>{state.updates=s.exists()?s.val():{};renderUpdates()}));
  state.userUnsubs.push(onValue(ref(db,`siteNotificationDismissed/${uid}`),s=>{state.notificationDismissed=s.exists()?s.val():{};renderNotifications()}));
  let notificationBoot=true,notificationNewestAt=0;
  state.userUnsubs.push(onValue(query(ref(db,`siteNotifications/${uid}`),orderByChild('createdAt'),limitToLast(100)),s=>{
    const previousNewest=notificationNewestAt;
    state.notifications=s.exists()?s.val():{};
    const rows=uniqueNotificationRows(state.notifications);
    notificationNewestAt=rows.reduce((m,n)=>Math.max(m,Number(n.createdAt||0)),0);
    renderNotifications();
    if(!notificationBoot){const fresh=rows.filter(n=>Number(n.createdAt||0)>previousNewest).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));if(fresh.length){playNotificationTone();showBrowserNotification(fresh.at(-1))}}
    notificationBoot=false;
  }));
  state.userUnsubs.push(onValue(ref(db,`siteBans/${uid}`),s=>{state.ban=s.exists()?s.val():null;applySiteBan()}));
}

await initialAuthPolicy();
onAuthStateChanged(auth,user=>{
  document.body.classList.remove('auth-loading');
  state.user=user||null;

  if(!user){
    document.body.classList.remove('authenticated');
    $('appShell').setAttribute('aria-hidden','true');
    const reason=sessionStorage.getItem('gremory:banReason');
    if(reason){$('authStatus').textContent=`Conta suspensa: ${reason}`;sessionStorage.removeItem('gremory:banReason')}
    clearUserSubscriptions();
    return;
  }

  // Abre o site imediatamente após o Auth. Dados complementares carregam em seguida.
  document.body.classList.add('authenticated');
  $('appShell').setAttribute('aria-hidden','false');
  setTimeout(()=>{const gif=$('authGif');if(gif)gif.removeAttribute('src')},250);

  if(!state.profile){
    state.profile={
      uid:user.uid,
      nome:user.displayName||user.email?.split('@')[0]||'Usuário',
      username:'',avatar:user.photoURL||'',bio:'',favoriteAnime:'',email:user.email||'',
      raidWhatsappNotify:false,createdAt:user.metadata?.creationTime||nowIso()
    };
  }
  renderAccount();
  renderAdminAccess();
  startUserSubscriptions();

  withTimeout(readUserData(user),12000,'DB_TIMEOUT').then(()=>{
    renderAccount();
    if(!state.profile?.username)setTimeout(()=>{toast('Escolha seu nome de usuário para completar a conta.',5000);setDrawer(true)},700);
  }).catch(e=>{
    console.warn('[GREMORY AUTH] Perfil ainda não sincronizado:',e);
    toast('Conta conectada. Algumas informações ainda estão sincronizando.',4000);
  });

  state.ttt.lastResultId=localStorage.getItem(`gremory:tttSeen:${user.uid}`)||'';
  loadPokemonSources().catch(()=>{});

  const params=new URLSearchParams(location.search);
  const watchInvite=params.get('watch');
  const rpgInvite=params.get('rpg');
  if(watchInvite){navigate('watch');joinWatchRoom(watchInvite.toUpperCase()).catch(()=>{})}
  else if(rpgInvite){navigate('rpg');joinRoom(rpgInvite.toUpperCase()).catch(()=>{})}
});

function generatedTone(freq=720,duration=.12){
  try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=freq;gain.gain.value=.035;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);setTimeout(()=>ctx.close().catch(()=>{}),Math.ceil((duration+.15)*1000))}catch{}
}
function playSiteSound(name,fallbackFreq=720){
  try{const audio=new Audio(`/assets/audio/${name}.mp3`);audio.volume=.35;audio.play().catch(()=>generatedTone(fallbackFreq))}catch{generatedTone(fallbackFreq)}
}

// Sons personalizados: os MP3 em /assets/audio/custom/ são carregados uma vez
// e ficam prontos no AudioContext depois da primeira interação. Isso evita o bloqueio
// de autoplay do mobile em sons disparados depois de Firebase/bridge (turno, Pokémon etc.).
const GAME_AUDIO_VERSION='20261022-v13-audio';
const CUSTOM_GAME_SOUND_FILES=Object.freeze({
  notification:['notification.mp3'],victory:['victory.mp3'],defeat:['defeat.mp3'],select:['select.mp3'],move:['move.mp3'],turn:['turn.mp3'],start:['start.mp3'],
  accept:['accept.mp3'],reject:['reject.mp3'],card:['select.mp3'],stand:['turn.mp3'],correct:['correct.mp3'],wrong:['wrong.mp3'],draw:['draw.mp3'],switch:['move.mp3'],
  reelStop:['select.mp3'],coins:['money-win.mp3'],debit:['wrong.mp3'],jackpot:['money-win.mp3'],purchase:['purchase-customization.mp3'],
  slotSpin:['slot-spin.mp3'],pokemonEncounter:['pokemon-encounter (2).mp3','pokemon-encounter.mp3'],pokemonHit:['pokemon-hit.mp3'],pokemonBall:['move.mp3'],pokemonCapture:['correct.mp3']
});
function customGameSoundUrls(kind){
  const files=CUSTOM_GAME_SOUND_FILES[kind]||[];
  return files.map(file=>`${['notification','victory'].includes(kind)?'/assets/audio/':'/assets/audio/custom/'}${encodeURIComponent(file)}?v=${GAME_AUDIO_VERSION}`);
}
function customGameSoundPath(kind){return customGameSoundUrls(kind)[0]||''}

let gameSfxCtx=null;
const customGameSoundBuffers=new Map();
const customGameSoundLoads=new Map();
function gameSfxContext(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!gameSfxCtx||gameSfxCtx.state==='closed')gameSfxCtx=new Ctx();
    if(gameSfxCtx.state==='suspended')gameSfxCtx.resume().catch(()=>{});
    return gameSfxCtx;
  }catch{return null}
}
async function preloadCustomGameSound(kind){
  if(customGameSoundBuffers.has(kind))return customGameSoundBuffers.get(kind);
  if(customGameSoundLoads.has(kind))return customGameSoundLoads.get(kind);
  const task=(async()=>{
    const ctx=gameSfxContext();if(!ctx)return null;
    for(const src of customGameSoundUrls(kind)){
      try{
        const response=await fetch(src,{cache:'no-store'});
        if(!response.ok)continue;
        const bytes=await response.arrayBuffer();
        const buffer=await ctx.decodeAudioData(bytes.slice(0));
        if(buffer){customGameSoundBuffers.set(kind,buffer);return buffer}
      }catch{}
    }
    return null;
  })().finally(()=>customGameSoundLoads.delete(kind));
  customGameSoundLoads.set(kind,task);return task;
}
function playDecodedGameSound(buffer,{volume=.38,loop=false}={}){
  try{
    const ctx=gameSfxContext();if(!ctx||!buffer)return null;
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=buffer;source.loop=!!loop;gain.gain.value=Math.max(0,Math.min(1,Number(volume)||.38));
    source.connect(gain);gain.connect(ctx.destination);source.start(0);
    let stopped=false;
    return{stop(){if(stopped)return;stopped=true;try{source.stop()}catch{}},pause(){this.stop()}};
  }catch{return null}
}
function tryCustomGameSound(kind,{volume=.38,loop=false,fallback=null}={}){
  let failed=false,controller=null,audio=null,stopped=false;
  const useFallback=()=>{if(failed||stopped)return;failed=true;if(typeof fallback==='function')fallback()};
  const cached=customGameSoundBuffers.get(kind);
  if(cached){controller=playDecodedGameSound(cached,{volume,loop});if(controller)return controller}

  // Prepara o buffer para sons assíncronos futuros e tenta tocar imediatamente em cliques diretos.
  preloadCustomGameSound(kind).catch(()=>{});
  const src=customGameSoundPath(kind);if(!src){useFallback();return null}
  try{
    audio=new Audio(src);audio.volume=Math.max(0,Math.min(1,Number(volume)||.38));audio.loop=!!loop;audio.preload='auto';
    audio.addEventListener('error',useFallback,{once:true});
    const promise=audio.play();
    if(promise?.catch)promise.catch(()=>{
      const ready=customGameSoundBuffers.get(kind);
      if(ready&&!stopped){controller=playDecodedGameSound(ready,{volume,loop});if(controller)return}
      useFallback();
    });
    return{
      pause(){stopped=true;try{audio?.pause?.()}catch{};try{controller?.stop?.()}catch{}},
      stop(){this.pause()}
    };
  }catch{useFallback();return null}
}
function playNotificationTone(){tryCustomGameSound('notification',{fallback:()=>playSiteSound('notification',720)})}
function playVictoryTone(){tryCustomGameSound('victory',{volume:.45,fallback:()=>playSiteSound('victory',920)})}
function playDefeatTone(){tryCustomGameSound('defeat',{volume:.45,fallback:()=>playSiteSound('defeat',190)})}

function gameSfxTone(freq,delay=0,duration=.07,volume=.028,type='sine'){
  try{
    const ctx=gameSfxContext();if(!ctx)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+Math.max(0,delay);
    osc.type=type;osc.frequency.setValueAtTime(Math.max(40,Number(freq||440)),t);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume),t+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.025,duration));
    osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+Math.max(.03,duration)+.02);
  }catch{}
}
function playGameSfx(kind){
  const patterns={
    select:[[520,0,.045,.018,'square'],[690,.045,.05,.016,'sine']],
    move:[[330,0,.05,.024,'square'],[470,.045,.065,.02,'triangle']],
    turn:[[620,0,.06,.022,'sine'],[820,.075,.08,.025,'sine']],
    start:[[430,0,.05,.02,'triangle'],[620,.07,.06,.024,'triangle'],[840,.145,.09,.026,'sine']],
    accept:[[560,0,.05,.02,'sine'],[760,.06,.08,.024,'sine']],
    reject:[[350,0,.055,.018,'square'],[240,.055,.08,.018,'triangle']],
    card:[[420,0,.04,.018,'triangle'],[540,.035,.045,.018,'triangle']],
    stand:[[520,0,.045,.018,'sine'],[390,.055,.08,.018,'sine']],
    correct:[[650,0,.05,.02,'sine'],[880,.055,.075,.025,'sine']],
    wrong:[[250,0,.07,.022,'sawtooth'],[180,.07,.09,.018,'triangle']],
    draw:[[440,0,.07,.018,'sine'],[440,.09,.07,.018,'sine']],
    switch:[[360,0,.045,.02,'triangle'],[610,.055,.075,.022,'triangle']],
    reelStop:[[300,0,.035,.025,'square'],[220,.035,.055,.018,'triangle']],
    coins:[[880,0,.045,.024,'sine'],[1080,.05,.045,.025,'sine'],[1320,.10,.055,.027,'sine'],[1640,.16,.08,.03,'sine']],
    debit:[[320,0,.05,.02,'square'],[230,.055,.075,.022,'triangle']],
    jackpot:[[740,0,.05,.026,'sine'],[980,.06,.05,.028,'sine'],[1240,.12,.06,.03,'sine'],[1560,.19,.09,.032,'sine']],
    purchase:[[520,0,.045,.02,'triangle'],[760,.055,.06,.024,'sine'],[1040,.12,.085,.028,'sine']]
  };
  if(kind==='victory'){playVictoryTone();return}
  if(kind==='defeat'){playDefeatTone();return}
  const fallback=()=>{(patterns[kind]||patterns.select).forEach(([f,d,du,v,t])=>gameSfxTone(f,d,du,v,t))};
  tryCustomGameSound(kind,{volume:['coins','jackpot','purchase'].includes(kind)?.44:.34,fallback});
}

let gameAudioPrimed=false;
function primeGameAudio(){
  try{gameSfxContext()?.resume?.().catch(()=>{})}catch{}
  if(gameAudioPrimed)return;gameAudioPrimed=true;
  // Estes são os MP3 que já existem na pasta custom enviada pelo usuário.
  ['select','move','turn','start','accept','reject','correct','wrong','draw','coins','purchase','slotSpin','pokemonEncounter','pokemonHit','defeat','notification','victory'].forEach(kind=>preloadCustomGameSound(kind).catch(()=>{}));
}
document.addEventListener('pointerdown',primeGameAudio,{capture:true,passive:true,once:true});
document.addEventListener('touchstart',primeGameAudio,{capture:true,passive:true,once:true});
document.addEventListener('keydown',primeGameAudio,{capture:true,once:true});

function startGeneratedSlotSpinSound(){
  let timer=null,step=0,stopped=false;
  const ctx=gameSfxContext();if(!ctx)return()=>{};
  const tick=()=>{
    if(stopped)return;
    try{
      const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime;
      osc.type='square';osc.frequency.value=190+(step%6)*34;
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.022,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+.055);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+.06);step++;
    }catch{}
  };
  tick();timer=setInterval(tick,82);
  return()=>{if(stopped)return;stopped=true;if(timer)clearInterval(timer)};
}
function startSlotSpinSound(){
  let stopped=false,fallbackStop=null,fallbackStarted=false;
  const startFallback=()=>{if(stopped||fallbackStarted)return;fallbackStarted=true;fallbackStop=startGeneratedSlotSpinSound()};
  const custom=tryCustomGameSound('slotSpin',{volume:.38,loop:true,fallback:startFallback});
  if(!custom)startFallback();
  return()=>{if(stopped)return;stopped=true;try{custom?.pause?.()}catch{};fallbackStop?.()};
}
function playPokemonSound(kind){
  const map={
    encounter:['pokemonEncounter','pokemon-encounter',620],
    hit:['pokemonHit','pokemon-hit',180],
    ball:['pokemonBall','pokemon-ball',520],
    capture:['pokemonCapture','pokemon-capture',920]
  };
  const row=map[kind];if(!row)return;
  tryCustomGameSound(row[0],{fallback:()=>playSiteSound(row[1],row[2])});
}

// ======================================================
// SLOTS — inicialização antecipada e independente do status visual de vínculo.
// A carteira continua sendo a mesma Rupia da Charlotte via siteBridgeJobs.
// ======================================================
const SLOT_SYMBOLS=['♛','✦','◆','♥','☾','⚡','7'];
let slotBusy=false;
const slotWait=ms=>new Promise(r=>setTimeout(r,ms));
async function runSlotsSpin(){
  if(slotBusy)return;
  const bet=Math.floor(Number($('slotsBetInput')?.value||0));
  if(!Number.isFinite(bet)||bet<10||bet>5000)return toast('A aposta deve ficar entre ₹10 e ₹5.000.');

  // Se já temos saldo sincronizado, validamos antes. Se o espelho ainda não carregou,
  // deixamos a Charlotte validar a carteira real em vez de bloquear o botão.
  const hasWalletSnapshot=!!state.charlotteSync?.account;
  const mirroredBalance=Number(accountSnapshot().balance||0);
  if(hasWalletSnapshot&&mirroredBalance<bet)return toast(`Saldo insuficiente. Você possui ₹${formatNumber(mirroredBalance)}.`);

  slotBusy=true;
  playGameSfx('start');
  const btn=$('slotsSpinBtn'),els=[$('slotReel1'),$('slotReel2'),$('slotReel3')];
  if(btn)btn.disabled=true;
  els.forEach(e=>e?.classList.add('spinning'));
  if($('slotsStatus'))$('slotsStatus').textContent='Girando...';
  if($('slotsLastWin'))$('slotsLastWin').textContent=`Apostando ₹${formatNumber(bet)}...`;

  const started=Date.now();
  const stopSpinSound=startSlotSpinSound();
  let timer=setInterval(()=>els.forEach(e=>{if(e)e.textContent=SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)]}),78);
  let visualStopped=false;
  const stopVisual=()=>{
    if(visualStopped)return;
    visualStopped=true;
    if(timer){clearInterval(timer);timer=null}
    try{stopSpinSound()}catch{}
    els.forEach(e=>e?.classList.remove('spinning'));
  };
  const visualSafety=setTimeout(()=>{
    stopVisual();
    if($('slotsStatus'))$('slotsStatus').textContent='Sincronizando Rupias...';
    if($('slotsLastWin'))$('slotsLastWin').textContent='O giro terminou. Confirmando a carteira...';
  },4200);

  try{
    // requireLink=false evita bloquear por um charlottePublic atrasado. O bridge é quem
    // valida o UID/JID real e usa delkoin/addkoin na carteira oficial.
    const r=await bridgeRequest('slots_spin',{bet},18000,false);
    await slotWait(Math.max(0,1550-(Date.now()-started)));
    clearTimeout(visualSafety);
    stopVisual();

    for(let i=0;i<6;i++){
      els.forEach(e=>{if(e)e.textContent=SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)]});
      await slotWait(48+i*14);
    }
    const symbols=Array.isArray(r.symbols)&&r.symbols.length===3?r.symbols:['✦','✦','✦'];
    for(let i=0;i<symbols.length;i++){
      if(els[i])els[i].textContent=symbols[i];
      playGameSfx('reelStop');
      if(i<symbols.length-1)await slotWait(105);
    }

    const payout=Number(r.payout||0),balance=Number(r.balance??accountSnapshot().balance??0),jackpot=!!r.jackpot;
    if($('slotsBalance'))$('slotsBalance').textContent=`₹ ${formatNumber(balance)}`;
    if($('slotsStatus'))$('slotsStatus').textContent=jackpot?'JACKPOT!':payout>0?'Você ganhou!':'Sem prêmio';
    if($('slotsLastWin'))$('slotsLastWin').textContent=payout>0
      ? `${symbols.join(' ')} • prêmio ₹${formatNumber(payout)} • saldo ₹${formatNumber(balance)}`
      : `${symbols.join(' ')} • perdeu ₹${formatNumber(bet)} • saldo ₹${formatNumber(balance)}`;

    if(jackpot){
      playGameSfx('jackpot');
      setTimeout(()=>playGameSfx('coins'),240);
      showGameResult({title:'JACKPOT!',text:`${symbols.join(' ')} • você ganhou ₹${formatNumber(payout)}. Saldo: ₹${formatNumber(balance)}.`,win:true,icon:'7'});
    }else if(payout>0){
      playVictoryTone();
      setTimeout(()=>playGameSfx('coins'),220);
    }else{
      playGameSfx('debit');
      setTimeout(()=>playDefeatTone(),180);
    }
    bridgeRequest('sync_account',{},25000,false).catch(()=>{});
  }catch(e){
    clearTimeout(visualSafety);
    stopVisual();
    if($('slotsStatus'))$('slotsStatus').textContent='Não concluído';
    if($('slotsLastWin'))$('slotsLastWin').textContent=String(e?.message||'Não foi possível confirmar a aposta.');
    bridgeRequest('sync_account',{},25000,false).catch(()=>{});
    toast(e?.message||'Não foi possível concluir o giro.',5500);
  }finally{
    slotBusy=false;
    if(btn)btn.disabled=false;
  }
}
// Delegação é instalada cedo. Mesmo se outro módulo secundário falhar mais abaixo,
// o botão do Slots e os presets continuam respondendo no mobile.
document.addEventListener('click',ev=>{
  const target=ev.target instanceof Element?ev.target:null;if(!target)return;
  const betBtn=target.closest('[data-slot-bet]');
  if(betBtn){playGameSfx('select');if($('slotsBetInput'))$('slotsBetInput').value=betBtn.dataset.slotBet||'50';return}
  if(target.closest('#slotsSpinBtn')){ev.preventDefault();runSlotsSpin().catch(e=>toast(e?.message||'Erro no Slots.'))}
},{passive:false});

function notificationStorageKey(suffix='seen'){
  return `gremory:notif:${suffix}:${state.user?.uid||'guest'}`
}
function notificationLastSeen(){return Number(localStorage.getItem(notificationStorageKey('seen'))||0)}
function notificationReadIds(){try{return new Set(JSON.parse(localStorage.getItem(notificationStorageKey('read'))||'[]'))}catch{return new Set()}}
function saveNotificationReadIds(set){localStorage.setItem(notificationStorageKey('read'),JSON.stringify([...set].slice(-300)))}
function notificationDismissedKeys(){try{return new Set(JSON.parse(localStorage.getItem(notificationStorageKey('dismissed'))||'[]'))}catch{return new Set()}}
function saveNotificationDismissedKeys(set){localStorage.setItem(notificationStorageKey('dismissed'),JSON.stringify([...set].slice(-500)))}
function notificationSignature(n){return [String(n?.type||''),String(n?.title||''),String(n?.text||''),String(n?.link||''),String(n?.imageUrl||'')].join('\u241f')}
function notificationPersistentKey(n){
  const type=String(n?.type||'');
  const source=type==='game_challenge'?`game:${n?.challengeId||n?.id||''}`:notificationSignature(n);
  let h=2166136261;
  for(let i=0;i<source.length;i++){h^=source.charCodeAt(i);h=Math.imul(h,16777619)}
  return `n_${(h>>>0).toString(16)}`
}
function notificationWasDismissed(n){
  if(!n)return false;
  const key=notificationPersistentKey(n);
  return Boolean(state.notificationDismissed?.[key])||notificationDismissedKeys().has(key)
}
function findNotificationById(id){
  if(!id)return null;
  const raw=state.notifications?.[id];
  if(raw)return{id,...raw};
  return siteGameChallengeNotificationRows().find(n=>String(n.id)===String(id))||null
}
async function persistNotificationDismissed(n){
  if(!state.user||!n)return;
  const key=notificationPersistentKey(n),local=notificationDismissedKeys();
  local.add(key);saveNotificationDismissedKeys(local);
  state.notificationDismissed={...(state.notificationDismissed||{}),[key]:{seenAt:Date.now(),notificationId:String(n.id||''),type:String(n.type||'')}};
  try{await set(ref(db,`siteNotificationDismissed/${state.user.uid}/${key}`),{seenAt:Date.now(),notificationId:String(n.id||''),type:String(n.type||'')})}catch{}
}
function markNotificationRead(target){
  const n=typeof target==='object'&&target?target:findNotificationById(target);
  const id=String(n?.id||target||'');if(!id)return;
  const setIds=notificationReadIds();setIds.add(id);saveNotificationReadIds(setIds);
  // Convites de jogo continuam visíveis até Aceitar/Recusar; só avisos comuns somem após abrir.
  if(n&&n.type!=='game_challenge')persistNotificationDismissed(n).finally(()=>renderNotifications());else renderNotifications()
}
function markAllNotificationsSeen(){localStorage.setItem(notificationStorageKey('seen'),String(Date.now()));localStorage.removeItem(notificationStorageKey('read'));renderNotifications()}
function isNotificationUnread(n){return !notificationWasDismissed(n)&&Number(n?.createdAt||0)>notificationLastSeen()&&!notificationReadIds().has(String(n?.id||''))}
function notificationCategory(n){
  const type=String(n?.type||'').toLowerCase();
  if(['friend_request','pokemon_duel','ttt','blackjack','hangman','game_challenge','tinder_match','friend','social'].includes(type))return'social';
  return'team';
}
function notificationCategoryLabel(n){return notificationCategory(n)==='social'?'Amigos':'Equipe'}
function browserNotificationsEnabled(){return typeof Notification!=='undefined'&&Notification.permission==='granted'&&localStorage.getItem('gremory:browserNotifications')==='1'}
async function setBrowserNotifications(enabled){
  if(!enabled){localStorage.setItem('gremory:browserNotifications','0');renderAccount();return false}
  if(typeof Notification==='undefined'){toast('Este navegador não oferece notificações do sistema.');renderAccount();return false}
  let permission=Notification.permission;
  if(permission!=='granted')permission=await Notification.requestPermission();
  const ok=permission==='granted';localStorage.setItem('gremory:browserNotifications',ok?'1':'0');renderAccount();
  toast(ok?'Notificações ativadas.':'As notificações não foram liberadas pelo navegador.');return ok
}
function showBrowserNotification(n){
  if(!browserNotificationsEnabled()||!n)return;
  try{
    const notice=new Notification(n.title||'Gremory',{body:String(n.text||'').slice(0,180),icon:'/assets/icons/icon-192.png',badge:'/assets/icons/icon-192.png',tag:`gremory-${n.id||n.createdAt||Date.now()}`,renotify:false});
    notice.onclick=()=>{window.focus();markNotificationRead(n);if(n.type==='game_challenge'){state.notificationFilter='social';renderNotifications();openModal('notificationModal')}else if(n.link?.startsWith('#'))navigate(n.link.slice(1));notice.close()}
  }catch{}
}
function siteGameChallengeNotificationRows(){
  return Object.entries(state.siteGameChallenges||{}).map(([challengeId,ch])=>{
    const meta=SITE_GAME_META[ch?.type]||{};
    return {
      id:`game_${challengeId}`,
      type:'game_challenge',
      gameType:ch?.type||'',
      challengeId,
      title:`Convite para ${meta.label||'jogo'}`,
      text:`${ch?.fromName||'Um amigo'} desafiou você para ${meta.label||'uma partida'}.`,
      link:'#friends',
      actorUid:ch?.fromUid||'',
      createdAt:Number(ch?.createdAt||0),
      sound:true,
      virtual:true
    };
  });
}
function uniqueNotificationRows(source=state.notifications){
  const rows=[
    ...Object.entries(source||{}).map(([id,v])=>({id,...(v||{})})),
    ...siteGameChallengeNotificationRows()
  ].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).filter(n=>!notificationWasDismissed(n));
  const latestBySignature=new Map(),unique=[];
  for(const n of rows){const sig=notificationSignature(n),created=Number(n.createdAt||0),latest=latestBySignature.get(sig);if(latest!=null&&Math.abs(latest-created)<=30000)continue;latestBySignature.set(sig,created);unique.push(n)}
  return unique;
}
function ensureNotificationDetailModal(){
  let modal=$('notificationDetailModal');if(modal)return modal;
  modal=document.createElement('div');modal.className='modal';modal.id='notificationDetailModal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<button class="modal-backdrop" type="button" aria-label="Fechar"></button><div class="modal-card notification-detail-card"><button class="modal-close" type="button" aria-label="Fechar">×</button><span class="tag">NOTIFICAÇÃO</span><h2 id="notificationDetailTitle">Aviso da Gremory</h2><img id="notificationDetailImage" alt="" class="notification-detail-image"><p id="notificationDetailText"></p><small id="notificationDetailTime"></small></div>`;
  document.body.appendChild(modal);modal.querySelector('.modal-backdrop')?.addEventListener('click',()=>closeModal('notificationDetailModal'));modal.querySelector('.modal-close')?.addEventListener('click',()=>closeModal('notificationDetailModal'));return modal
}
function openNotificationDetail(n){
  ensureNotificationDetailModal();markNotificationRead(n);$('notificationDetailTitle').textContent=n?.title||'Notificação';$('notificationDetailText').textContent=n?.text||'';$('notificationDetailTime').textContent=shortDateTime(n?.createdAt);const img=$('notificationDetailImage'),url=String(n?.imageUrl||'').trim();if(img){if(url){img.src=url;img.hidden=false}else{img.removeAttribute('src');img.hidden=true}}closeModal('notificationModal');openModal('notificationDetailModal')
}
async function deleteSiteNotification(id){if(!state.user||!id)return;const n=state.notifications?.[id]?{id,...state.notifications[id]}:null;try{if(n)await persistNotificationDismissed(n);await remove(ref(db,`siteNotifications/${state.user.uid}/${id}`));const read=notificationReadIds();read.delete(String(id));saveNotificationReadIds(read);renderNotifications();toast('Notificação apagada.')}catch(e){toast(permissionMessage(e,'Não foi possível apagar a notificação.'))}}
async function clearSiteNotifications(){if(!state.user)return;const rows=Object.entries(state.notifications||{}).map(([id,v])=>({id,...(v||{})})),ids=rows.map(n=>n.id);if(!ids.length)return toast('Sua caixa já está vazia.');try{await Promise.all(rows.map(n=>persistNotificationDismissed(n)));await Promise.all(ids.map(id=>remove(ref(db,`siteNotifications/${state.user.uid}/${id}`))));localStorage.removeItem(notificationStorageKey('read'));localStorage.setItem(notificationStorageKey('seen'),String(Date.now()));renderNotifications();toast('Notificações apagadas.')}catch(e){toast(permissionMessage(e,'Não foi possível limpar as notificações.'))}}
function renderNotifications(){
  const all=uniqueNotificationRows(),readIds=notificationReadIds();const unseen=all.filter(x=>Number(x.createdAt||0)>notificationLastSeen()&&!readIds.has(String(x.id))).length,badge=$('notificationBadge');
  if(badge){badge.hidden=!unseen;badge.textContent=String(Math.min(99,unseen))}
  const team=all.filter(x=>notificationCategory(x)==='team'),social=all.filter(x=>notificationCategory(x)==='social');if($('notificationTeamCount'))$('notificationTeamCount').textContent=String(team.length);if($('notificationSocialCount'))$('notificationSocialCount').textContent=String(social.length);$$('[data-notification-filter]').forEach(b=>b.classList.toggle('active',b.dataset.notificationFilter===state.notificationFilter));
  const rows=state.notificationFilter==='all'?all:state.notificationFilter==='social'?social:team;const box=$('notificationList');if(!box)return;box.innerHTML='';
  if(!rows.length){box.innerHTML=`<div class="empty-state small">${state.notificationFilter==='social'?'Nenhuma notificação de amigos ou jogos.':'Nenhum aviso da equipe.'}</div>`;return}
  rows.slice(0,60).forEach(n=>{
    const row=document.createElement('div');row.className='notification-row-wrap'+(isNotificationUnread(n)?' unread':'')+(n.type==='game_challenge'?' game-challenge':'');
    const d=document.createElement('button');d.type='button';d.className='notification-row';const head=document.createElement('div');head.className='notification-row-head';const st=document.createElement('strong');st.textContent=n.title||'Notificação';const kind=document.createElement('em');kind.textContent=notificationCategoryLabel(n);head.append(st,kind);const sm=document.createElement('span');sm.textContent=n.text||'';const time=document.createElement('small');time.textContent=shortDateTime(n.createdAt);d.append(head,sm,time);
    d.onclick=()=>{markNotificationRead(n);if(n.type==='game_challenge')return;if(n.imageUrl||n.type==='admin_notice'||n.type==='site_update'){openNotificationDetail(n);return}if(n.link?.startsWith('#')){closeModal('notificationModal');navigate(n.link.slice(1));return}openNotificationDetail(n)};
    row.appendChild(d);
    if(n.type==='game_challenge'&&n.challengeId){
      const actions=document.createElement('div');actions.className='notification-game-actions';
      const yes=document.createElement('button');yes.type='button';yes.className='btn primary';yes.textContent='Aceitar';
      yes.onclick=async ev=>{ev.stopPropagation();const ch=state.siteGameChallenges?.[n.challengeId];if(!ch)return toast('Esse convite não está mais disponível.');try{yes.disabled=true;no.disabled=true;markNotificationRead(n);await acceptSiteGameChallenge({id:n.challengeId,...ch});closeModal('notificationModal');navigate('games')}catch(e){toast(permissionMessage(e,e.message||'Não foi possível aceitar.'))}finally{yes.disabled=false;no.disabled=false}};
      const no=document.createElement('button');no.type='button';no.className='btn';no.textContent='Recusar';
      no.onclick=async ev=>{ev.stopPropagation();try{yes.disabled=true;no.disabled=true;markNotificationRead(n);await rejectSiteGameChallenge(n.challengeId)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível recusar.'))}finally{yes.disabled=false;no.disabled=false}};
      actions.append(yes,no);row.appendChild(actions);
    }else{
      const del=document.createElement('button');del.className='notification-delete';del.type='button';del.title='Apagar';del.textContent='×';del.onclick=ev=>{ev.stopPropagation();deleteSiteNotification(n.id)};row.appendChild(del)
    }
    box.appendChild(row)
  })
}
$$('[data-notification-filter]').forEach(btn=>btn.addEventListener('click',()=>{state.notificationFilter=btn.dataset.notificationFilter||'team';renderNotifications()}));
$('notificationBtn')?.addEventListener('click',()=>{const all=uniqueNotificationRows();const hasGameInvite=all.some(n=>n.type==='game_challenge');const hasUnreadSocial=all.some(n=>notificationCategory(n)==='social'&&isNotificationUnread(n));if(hasGameInvite||hasUnreadSocial)state.notificationFilter='social';markAllNotificationsSeen();renderNotifications();openModal('notificationModal')});
$('notificationMarkAllBtn')?.addEventListener('click',()=>{markAllNotificationsSeen();toast('Notificações marcadas como vistas.')});
$('notificationClearAllBtn')?.addEventListener('click',()=>clearSiteNotifications());
$('profileBrowserNotify')?.addEventListener('change',e=>setBrowserNotifications(e.target.checked));
function renderUpdates(){
  const box=$('updatesFeed');if(!box)return;
  const rows=Object.entries(state.updates||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="empty-state">Nenhuma atualização publicada.</div>';return}
  rows.slice(0,60).forEach(post=>{
    const art=document.createElement('article');art.className='panel update-card';
    if(post.imageUrl){
      const media=document.createElement('div');media.className='update-card-media';
      const img=document.createElement('img');img.src=post.imageUrl;img.alt='Imagem da atualização';img.loading='lazy';
      media.appendChild(img);art.appendChild(media)
    }
    const copy=document.createElement('div');copy.className='update-card-body';
    const meta=document.createElement('div');meta.className='update-card-meta';
    const small=document.createElement('small');small.textContent=`${post.author||'Gremory'} • ${shortDateTime(post.createdAt)}`;
    meta.appendChild(small);
    if(isSiteAdmin()){
      const idchip=document.createElement('button');idchip.type='button';idchip.className='update-id-chip';idchip.textContent=`ID ${post.id}`;
      idchip.onclick=async()=>{try{await navigator.clipboard.writeText(post.id);toast('ID copiado.')}catch{}};
      const del=document.createElement('button');del.type='button';del.className='mini-btn danger';del.textContent='Apagar';del.onclick=()=>adminDeletePublication(post.id);
      meta.append(idchip,del)
    }
    const text=document.createElement('p');text.className='update-card-text';text.textContent=post.text||'';
    copy.append(meta,text);art.appendChild(copy);box.appendChild(art)
  })
}
function applySiteBan(){
  if(!state.ban||!state.user)return;
  const reason=String(state.ban.reason||'Violação das regras');
  sessionStorage.setItem('gremory:banReason',reason);
  signOut(auth).catch(()=>{});
}
async function submitReport(ev){
  ev.preventDefault();if(!state.user||!currentPublicProfile)return;
  const targetUid=currentPublicProfile.uid;if(!targetUid||targetUid===state.user.uid)return toast('Você não pode denunciar seu próprio perfil.');
  const category=$('reportCategory').value,details=$('reportDetails').value.trim();
  try{
    const rr=push(ref(db,'siteReports'));
    await set(rr,{id:rr.key,reporterUid:state.user.uid,targetUid,category,details:details.slice(0,500),createdAt:Date.now(),status:'open'});
    closeModal('reportModal');$('reportForm').reset();toast('Denúncia enviada para análise.')
  }catch(e){toast(permissionMessage(e,'Não foi possível enviar a denúncia.'))}
}
$('reportForm')?.addEventListener('submit',submitReport);

// Administração do site — visível apenas para o e-mail host.
const REPORT_LABELS={harassment:'Assédio',minor_sexual_content:'Conteúdo sexual envolvendo menores',threats:'Ameaças',gore:'Gore / violência extrema',spam_fraud:'Spam ou fraude',other:'Outro'};

function supportMessagesArray(messages=state.supportChat?.messages||{}){
  return Object.entries(messages||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
}
function renderSupportMessages(targetId,messages,viewerUid=state.user?.uid){
  const box=$(targetId);if(!box)return;const rows=supportMessagesArray(messages);box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhuma mensagem.</div>';return}
  rows.slice(-120).forEach(m=>{const row=document.createElement('div');row.className='support-msg'+(String(m.senderUid||'')===String(viewerUid||'')?' mine':'')+(m.role==='admin'?' admin':'');const name=document.createElement('strong');name.textContent=m.role==='admin'?'Equipe Gremory':(m.senderName||'Usuário');const text=document.createElement('p');text.textContent=m.text||'';const time=document.createElement('small');time.textContent=shortDateTime(m.createdAt);row.append(name,text,time);box.appendChild(row)});box.scrollTop=box.scrollHeight;
}
function renderSupportChat(){renderSupportMessages('supportChatList',state.supportChat?.messages||{},state.user?.uid)}
$('supportChatForm')?.addEventListener('submit',async ev=>{ev.preventDefault();if(!state.user)return;const input=$('supportChatInput'),text=String(input?.value||'').trim().slice(0,500);if(!text)return;try{const mref=push(ref(db,`supportChats/${state.user.uid}/messages`));const createdAt=Date.now();await Promise.all([set(mref,{id:mref.key,senderUid:state.user.uid,senderName:displayName(),role:'user',text,createdAt}),update(ref(db,`supportChats/${state.user.uid}/meta`),{uid:state.user.uid,name:displayName(),username:normalizeUsername(state.profile?.username||''),updatedAt:createdAt,lastText:text.slice(0,120),status:'open'})]);input.value=''}catch(e){toast(permissionMessage(e,'Não foi possível enviar a mensagem.'))}});

async function resolveAdminUid(query){
  const raw=String(query||'').trim();if(!raw)return'';
  const user=normalizeUsername(raw);
  if(raw.startsWith('@')||validUsername(user)){
    const sn=await get(ref(db,`usernames/${user}`)).catch(()=>null);
    if(sn?.exists())return String(sn.val()?.uid||'')
  }
  return raw;
}
async function loadAdminDashboard(){
  if(!isSiteAdmin())return;
  try{
    const [reportsSnap,updatesSnap,directorySnap,bansSnap,supportSnap,backupSnap]=await Promise.all([
      get(ref(db,'siteReports')),get(ref(db,'siteUpdates')),get(ref(db,'directory')),get(ref(db,'siteBans')),get(ref(db,'supportChats')),get(ref(db,'botBackupStatus'))
    ]);
    state.admin.reports=reportsSnap.exists()?reportsSnap.val():{};
    state.admin.updates=updatesSnap.exists()?updatesSnap.val():{};
    state.admin.directory=directorySnap.exists()?directorySnap.val():{};
    state.admin.bans=bansSnap.exists()?bansSnap.val():{};
    state.admin.supportChats=supportSnap.exists()?supportSnap.val():{};
    state.admin.backupStatus=backupSnap.exists()?backupSnap.val():{};
    renderAdminDashboard();renderAdminSupportConversations();renderAdminBackupStatus()
  }catch(e){toast(permissionMessage(e,'Não foi possível carregar a administração.'),5500)}
}
function renderAdminDashboard(){
  if(!isSiteAdmin())return;
  const reports=Object.entries(state.admin.reports||{}).map(([id,v])=>({id,...v})).filter(x=>x.status!=='closed').sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const updates=Object.entries(state.admin.updates||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  if($('adminOpenReports'))$('adminOpenReports').textContent=String(reports.length);
  if($('adminUpdateCount'))$('adminUpdateCount').textContent=String(updates.length);
  if($('adminUserCount'))$('adminUserCount').textContent=String(Object.keys(state.admin.directory||{}).length);

  const reportBox=$('adminReportsList');if(reportBox){reportBox.innerHTML='';if(!reports.length)reportBox.innerHTML='<div class="empty-state small">Nenhuma denúncia aberta.</div>';
    const counts={};reports.forEach(r=>counts[r.targetUid]=(counts[r.targetUid]||0)+1);
    reports.slice(0,80).forEach(r=>{
      const p=state.admin.directory?.[r.targetUid]||{},row=document.createElement('article');row.className='admin-list-row';
      const copy=document.createElement('div');const h=document.createElement('strong');h.textContent=`${p.nome||'Usuário'}${p.username?' (@'+normalizeUsername(p.username)+')':''}`;
      const meta=document.createElement('small');meta.textContent=`${REPORT_LABELS[r.category]||r.category||'Outro'} • ${shortDateTime(r.createdAt)} • ${counts[r.targetUid]} denúncia${counts[r.targetUid]===1?'':'s'}`;
      const details=document.createElement('p');details.textContent=r.details||'Sem detalhes.';
      const idline=document.createElement('code');idline.textContent=`${r.id} • UID ${r.targetUid}`;
      copy.append(h,meta,details,idline);
      const acts=document.createElement('div');acts.className='admin-row-actions';
      const profile=document.createElement('button');profile.className='mini-btn';profile.textContent='Perfil';profile.onclick=()=>openPublicProfile(r.targetUid,p);
      const ban=document.createElement('button');ban.className='mini-btn danger';ban.textContent='Suspender';ban.onclick=()=>adminBanUid(r.targetUid,r.details||REPORT_LABELS[r.category]||'Violação das regras');
      const close=document.createElement('button');close.className='mini-btn';close.textContent='Fechar';close.onclick=()=>adminCloseReport(r.id);
      acts.append(profile,ban,close);row.append(copy,acts);reportBox.appendChild(row)
    })
  }

  const updateBox=$('adminUpdatesList');if(updateBox){updateBox.innerHTML='';if(!updates.length)updateBox.innerHTML='<div class="empty-state small">Nenhuma publicação.</div>';
    updates.slice(0,80).forEach(post=>{
      const row=document.createElement('article');row.className='admin-list-row';
      const copy=document.createElement('div');const h=document.createElement('strong');h.textContent=String(post.text||'Publicação').split(/\r?\n/)[0].slice(0,90)||'Publicação';
      const meta=document.createElement('small');meta.textContent=`${post.author||'Gremory'} • ${shortDateTime(post.createdAt)}`;
      const idline=document.createElement('code');idline.textContent=post.id;copy.append(h,meta,idline);
      const del=document.createElement('button');del.className='mini-btn danger';del.textContent='Apagar';del.onclick=()=>adminDeletePublication(post.id);
      row.append(copy,del);updateBox.appendChild(row)
    })
  }
}
async function adminDeletePublication(id){
  if(!isSiteAdmin()||!id)return;
  if(!confirm(`Apagar a publicação ${id}?`))return;
  try{
    const users=Object.keys(state.admin.directory||{});
    const patch={[`siteUpdates/${id}`]:null};
    for(const uid of users)patch[`siteNotifications/${uid}/update_${id}`]=null;
    await update(ref(db),patch);
    toast('Publicação apagada.');await loadAdminDashboard()
  }catch(e){toast(permissionMessage(e,e.message||'Não foi possível apagar a publicação.'),5500)}
}
async function adminCloseReport(id){
  if(!isSiteAdmin()||!id)return;
  try{await update(ref(db,`siteReports/${id}`),{status:'closed',closedAt:Date.now(),closedBy:state.user.uid});toast('Denúncia fechada.');await loadAdminDashboard()}catch(e){toast(permissionMessage(e),5500)}
}
async function adminBanUid(uid,reason='Violação das regras'){
  if(!isSiteAdmin()||!uid)return;
  try{await set(ref(db,`siteBans/${uid}`),{uid,reason:String(reason||'Violação das regras').slice(0,300),by:state.user.uid,createdAt:Date.now()});toast('Conta suspensa.');await loadAdminDashboard()}catch(e){toast(permissionMessage(e),5500)}
}
async function adminUnbanUid(uid){
  if(!isSiteAdmin()||!uid)return;
  try{await remove(ref(db,`siteBans/${uid}`));toast('Banimento removido.');await loadAdminDashboard()}catch(e){toast(permissionMessage(e),5500)}
}
async function adminLookupUser(ev){
  ev?.preventDefault?.();if(!isSiteAdmin())return;
  const uid=await resolveAdminUid($('adminUserQuery')?.value);
  state.admin.selectedUid=uid;
  const box=$('adminUserResult');if(!uid){if(box)box.textContent='Usuário não encontrado.';return}
  let p=state.admin.directory?.[uid];if(!p){const sn=await get(ref(db,`directory/${uid}`)).catch(()=>null);p=sn?.exists()?sn.val():null}
  if(box)box.innerHTML=p?`<strong>${escText(p.nome||'Usuário')}</strong><span>${p.username?'@'+escText(normalizeUsername(p.username))+' • ':''}${escText(uid)}</span>`:`<span>UID: ${escText(uid)}</span>`;
}
$('adminRefreshBtn')?.addEventListener('click',loadAdminDashboard);
$('adminDeletePostForm')?.addEventListener('submit',async ev=>{ev.preventDefault();await adminDeletePublication($('adminDeletePostId').value.trim())});
$('adminUserLookupForm')?.addEventListener('submit',adminLookupUser);
$('adminBanUserBtn')?.addEventListener('click',async()=>{if(!state.admin.selectedUid)await adminLookupUser();if(state.admin.selectedUid)await adminBanUid(state.admin.selectedUid,$('adminBanReason').value.trim()||'Violação das regras')});
$('adminUnbanUserBtn')?.addEventListener('click',async()=>{if(!state.admin.selectedUid)await adminLookupUser();if(state.admin.selectedUid)await adminUnbanUid(state.admin.selectedUid)});


function requireAdminSelectedUid(){const uid=String(state.admin.selectedUid||'').trim();if(!uid)throw new Error('Localize um usuário primeiro.');return uid}
async function adminGrantCurrency(sign=1){try{const targetUid=requireAdminSelectedUid(),amount=Math.max(1,Math.floor(Number($('adminCurrencyAmount')?.value||0)))*Math.sign(sign||1);const r=await bridgeRequest('admin_grant_currency',{targetUid,amount},25000,false);toast(`Saldo atualizado: ₹${formatNumber(r.balance||0)}.`);await loadAdminDashboard()}catch(e){toast(e.message)}}
async function adminGrantPremium(){try{const targetUid=requireAdminSelectedUid(),days=Math.max(1,Math.floor(Number($('adminPremiumDays')?.value||0)));const r=await bridgeRequest('admin_grant_premium',{targetUid,days},25000,false);toast(`Premium concedido por ${r.days||days} dias.`)}catch(e){toast(e.message)}}
$('adminGiveCurrencyBtn')?.addEventListener('click',()=>adminGrantCurrency(1));$('adminRemoveCurrencyBtn')?.addEventListener('click',()=>adminGrantCurrency(-1));$('adminGivePremiumBtn')?.addEventListener('click',adminGrantPremium);

$('adminNotificationForm')?.addEventListener('submit',async ev=>{ev.preventDefault();if(!isSiteAdmin())return;const target=$('adminNotificationTarget')?.value||'all',title=String($('adminNotificationTitle')?.value||'Aviso da Gremory').trim().slice(0,80),text=String($('adminNotificationText')?.value||'').trim().slice(0,800),link=String($('adminNotificationLink')?.value||'').trim().slice(0,300);if(!text)return toast('Escreva a mensagem.');try{let uids=target==='selected'?[requireAdminSelectedUid()]:Object.keys(state.admin.directory||{});if(!uids.length)throw new Error('Nenhum usuário encontrado.');const createdAt=Date.now(),patch={};for(const uid of uids){const id=`admin_${createdAt}_${Math.random().toString(36).slice(2,7)}`;patch[`siteNotifications/${uid}/${id}`]={id,type:'admin_notice',title,text,link,sound:true,createdAt}}await update(ref(db),patch);$('adminNotificationText').value='';toast(`Notificação enviada para ${uids.length} usuário${uids.length===1?'':'s'}.`)}catch(e){toast(permissionMessage(e,e.message))}});

$('adminStoreForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const itemId=String($('adminStoreId')?.value||'').trim().toLowerCase(),name=String($('adminStoreName')?.value||'').trim(),price=Number($('adminStorePrice')?.value||0),slot=$('adminStoreSlot')?.value||'cover',mediaUrl=String($('adminStoreMediaUrl')?.value||'').trim();await bridgeRequest('admin_store_upsert',{item:{id:itemId,name,price,slot,mediaUrl,mediaKind:slot==='decor'?'sprite':'gif'}},25000,false);toast('Personalização salva na loja.')}catch(e){toast(e.message)}});
$('adminStoreDeleteBtn')?.addEventListener('click',async()=>{try{const itemId=String($('adminStoreId')?.value||'').trim().toLowerCase();if(!itemId)throw new Error('Informe o ID do item.');await bridgeRequest('admin_store_delete',{itemId},20000,false);toast('Item removido da loja.')}catch(e){toast(e.message)}});

function renderAdminBackupStatus(){const b=state.admin.backupStatus||{};if($('adminBackupStatus'))$('adminBackupStatus').textContent=b.lastSuccessAt?'Ativo':'Aguardando';if($('adminBackupMeta'))$('adminBackupMeta').textContent=b.lastSuccessAt?`Última cópia: ${shortDateTime(b.lastSuccessAt)} • ${Number(b.files||0)} arquivo(s) • ${Number(b.skipped||0)} ignorado(s)`:'Aguardando a primeira cópia de segurança da Charlotte.'}
$('adminBackupNowBtn')?.addEventListener('click',async()=>{try{const btn=$('adminBackupNowBtn');btn.disabled=true;const r=await bridgeRequest('admin_backup_now',{},60000,false);toast(`Backup concluído: ${r.files||0} arquivo(s).`);await loadAdminDashboard();btn.disabled=false}catch(e){if($('adminBackupNowBtn'))$('adminBackupNowBtn').disabled=false;toast(e.message)}});

function renderAdminSupportConversations(){const box=$('adminSupportConversations');if(!box)return;const rows=Object.entries(state.admin.supportChats||{}).map(([uid,v])=>({uid,meta:v?.meta||{},messages:v?.messages||{}})).sort((a,b)=>Number(b.meta.updatedAt||0)-Number(a.meta.updatedAt||0));box.innerHTML='';if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhuma conversa.</div>';return}rows.slice(0,80).forEach(r=>{const b=document.createElement('button');b.type='button';b.className='admin-support-conversation'+(state.admin.supportSelectedUid===r.uid?' active':'');b.innerHTML=`<strong>${escText(r.meta.name||state.admin.directory?.[r.uid]?.nome||'Usuário')}</strong><span>${escText(r.meta.lastText||'Abrir conversa')}</span>`;b.onclick=()=>openAdminSupportChat(r.uid);box.appendChild(b)})}
function openAdminSupportChat(uid){state.admin.supportSelectedUid=String(uid||'');try{state.admin.supportUnsub?.()}catch{}state.admin.supportUnsub=null;renderAdminSupportConversations();if(!uid)return;state.admin.supportUnsub=onValue(query(ref(db,`supportChats/${uid}/messages`),orderByChild('createdAt'),limitToLast(150)),sn=>{renderSupportMessages('adminSupportChat',sn.exists()?sn.val():{},state.user?.uid)});if($('adminSupportReplyInput'))$('adminSupportReplyInput').disabled=false;if($('adminSupportReplyForm')?.querySelector('button'))$('adminSupportReplyForm').querySelector('button').disabled=false}
$('adminSupportRefreshBtn')?.addEventListener('click',loadAdminDashboard);
$('adminSupportReplyForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const uid=state.admin.supportSelectedUid,input=$('adminSupportReplyInput'),text=String(input?.value||'').trim().slice(0,500);if(!uid||!text)return;try{const mref=push(ref(db,`supportChats/${uid}/messages`)),createdAt=Date.now();await Promise.all([set(mref,{id:mref.key,senderUid:state.user.uid,senderName:'Equipe Gremory',role:'admin',text,createdAt}),update(ref(db,`supportChats/${uid}/meta`),{updatedAt:createdAt,lastText:text.slice(0,120),status:'open'})]);input.value='';await set(ref(db,`siteNotifications/${uid}/support_${createdAt}`),{id:`support_${createdAt}`,type:'support_chat',title:'Nova resposta da equipe',text:text.slice(0,160),link:'#support',sound:true,createdAt}).catch(()=>{})}catch(e){toast(permissionMessage(e,e.message))}});


// Tinder — cadastro no site + sincronização com a Charlotte/Firebase
function fillOwnTinderProfile(profile={}){
  if($('tinderProfileName'))$('tinderProfileName').value=profile.nome||state.profile?.nome||displayName();
  if($('tinderProfileAge'))$('tinderProfileAge').value=profile.idade||'';
  if($('tinderProfilePhoto'))$('tinderProfilePhoto').value=profile.foto||'';
  if($('tinderProfileBio'))$('tinderProfileBio').value=profile.bio||'';
  if($('tinderProfileActive'))$('tinderProfileActive').checked=profile.ativo!==false;
  if($('tinderOwnStatus'))$('tinderOwnStatus').textContent=profile.exists===false?'Não criado':'Salvo';
}
async function loadOwnTinderProfile(){
  if(!state.user)return;fillOwnTinderProfile({exists:false});
  if(!linkedCharlotte())return;
  try{const r=await bridgeRequest('tinder_profile_get',{},20000);fillOwnTinderProfile(r.profile?{...r.profile,exists:true}:{exists:false})}catch(e){console.warn('[TINDER PROFILE]',e)}
}
$('tinderProfileForm')?.addEventListener('submit',async ev=>{
  ev.preventDefault();if(!state.user)return;
  if(!linkedCharlotte())return toast('Vincule a Charlotte antes de salvar o Tinder.');
  const idade=Number($('tinderProfileAge').value||0);if(idade<18)return toast('O Tinder do site é somente para maiores de 18 anos.');
  const data={nome:$('tinderProfileName').value.trim().slice(0,60)||displayName(),idade,bio:$('tinderProfileBio').value.trim().slice(0,300),foto:$('tinderProfilePhoto').value.trim().slice(0,1000),ativo:$('tinderProfileActive').checked};
  try{const r=await bridgeRequest('tinder_profile_save',data,25000);fillOwnTinderProfile({...r.profile,exists:true});toast('Perfil do Tinder salvo no site e sincronizado com a Charlotte.');await loadTinderProfile()}catch(e){toast(e.message)}
});
function renderTinderCard(profile){
  const box=$('tinderSiteCard'),actions=$('tinderSiteActions');if(!box||!actions)return;box.innerHTML='';
  if(!profile){box.innerHTML='<div class="empty-state">Não encontrei outro perfil disponível agora.</div>';actions.hidden=true;return}
  const card=document.createElement('article');card.className='tinder-profile-card';const img=document.createElement('img');img.className='tinder-profile-photo';img.src=profile.photo||DEFAULT_AVATAR;img.alt='';img.loading='lazy';const copy=document.createElement('div');copy.className='tinder-profile-copy';const h=document.createElement('h3');h.textContent=`${profile.nome||'Usuário'}${profile.idade?`, ${profile.idade}`:''}`;const bio=document.createElement('p');bio.textContent=profile.bio||'Sem bio.';const stats=document.createElement('small');stats.textContent=`${profile.likes||0} curtidas • ${profile.matches||0} matches`;copy.append(h,bio,stats);card.append(img,copy);box.appendChild(card);actions.hidden=false
}
async function loadTinderProfile(){
  if(!state.user)return;const box=$('tinderSiteCard');if(box)box.innerHTML='<div class="loading-line">Procurando perfil...</div>';
  if(!linkedCharlotte()){renderTinderCard(null);if(box)box.innerHTML='<div class="empty-state">Vincule a Charlotte para usar o Tinder.</div>';return}
  try{const r=await bridgeRequest('tinder_feed',{skipUids:state.tinder.seen},25000);state.tinder.current=r.profile||null;if(r.profile&&!state.tinder.seen.includes(r.profile.uid))state.tinder.seen.push(r.profile.uid);renderTinderCard(state.tinder.current)}catch(e){if(box)box.innerHTML=`<div class="empty-state">${escText(e.message)}</div>`;$('tinderSiteActions').hidden=true}
}
$('tinderRefreshBtn')?.addEventListener('click',loadTinderProfile);$('tinderSkipBtn')?.addEventListener('click',loadTinderProfile);
$('tinderLikeBtn')?.addEventListener('click',async()=>{const p=state.tinder.current;if(!p)return;try{const r=await bridgeRequest('tinder_like',{targetUid:p.uid},25000);if(r.match){toast(r.contact?`Deu match! Contato: ${r.contact}`:'Deu match! Confira suas notificações.',5500);playNotificationTone()}else toast('Curtida enviada.');await loadTinderProfile()}catch(e){toast(e.message)}});

// Amigos
async function loadDirectory(){if(!state.user)return;const box=$('peopleSearchResults');box.innerHTML='<div class="loading-line">Carregando...</div>';try{const s=await get(ref(db,'directory'));state.directory=s.exists()?s.val():{};renderPeople('')}catch(e){box.innerHTML=`<div class="empty-state small">${permissionMessage(e)}</div>`}}
function renderPeople(q=''){
  const box=$('peopleSearchResults');box.innerHTML='';const term=String(q||'').trim().toLowerCase();const rows=Object.values(state.directory||{}).filter(p=>p.uid!==state.user?.uid&&(!term||String(p.nome||'').toLowerCase().includes(term)||normalizeUsername(p.username||'').includes(normalizeUsername(term)))).slice(0,40);
  if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhuma pessoa encontrada.</div>';return}
  rows.forEach(p=>box.appendChild(personRow(p,{mode:state.friends[p.uid]?'friend':'add'})));
}
function personRow(p,{mode='add',requestUid=''}={}){
  const row=document.createElement('div');row.className='person-row clickable-person';const img=document.createElement('img');img.src=p.avatar||DEFAULT_AVATAR;img.alt='';img.onclick=()=>openPublicProfile(p.uid,p);const copy=document.createElement('div');copy.className='person-copy';copy.onclick=()=>openPublicProfile(p.uid,p);const st=document.createElement('strong');st.textContent=p.nome||'Usuário';const sm=document.createElement('small');sm.textContent=`${p.username?'@'+normalizeUsername(p.username)+' • ':''}${p.bio||'Conta Gremory'}`;copy.append(st,sm);const acts=document.createElement('div');acts.className='person-actions';
  const view=document.createElement('button');view.className='mini-btn profile-action';view.textContent='Perfil';view.onclick=()=>openPublicProfile(p.uid,p);acts.appendChild(view);
  if(mode==='add'){const b=document.createElement('button');b.className='mini-btn primary';b.textContent='Adicionar';b.onclick=()=>sendFriendRequest(p.uid,p);acts.appendChild(b)}
  if(mode==='friend'){const b=document.createElement('button');b.className='mini-btn';b.textContent='Pokémon';b.onclick=()=>{navigate('pokemon');$('duelFriendSelect').value=p.uid};const r=document.createElement('button');r.className='mini-btn danger';r.textContent='Remover';r.onclick=()=>removeFriend(p.uid);acts.append(b,r)}
  if(mode==='request'){const a=document.createElement('button');a.className='mini-btn primary';a.textContent='Aceitar';a.onclick=()=>acceptFriendRequest(requestUid,p);const d=document.createElement('button');d.className='mini-btn';d.textContent='Recusar';d.onclick=()=>declineFriendRequest(requestUid);acts.append(a,d)}
  row.append(img,copy,acts);return row;
}
$('friendSearchBtn').addEventListener('click',()=>renderPeople($('friendSearchInput').value));$('friendSearchInput').addEventListener('input',()=>renderPeople($('friendSearchInput').value));
async function sendFriendRequest(targetUid,p){
  if(!state.user||targetUid===state.user.uid)return;
  try{
    const createdAt=Date.now(),request={senderUid:state.user.uid,nome:displayName(),username:normalizeUsername(state.profile?.username||''),avatar:avatarFor(),bio:state.profile?.bio||'',createdAt:nowIso()};
    await set(ref(db,`friendRequests/${targetUid}/${state.user.uid}`),request);
    await set(ref(db,`siteNotifications/${targetUid}/friend_${state.user.uid}`),{id:`friend_${state.user.uid}`,type:'friend_request',title:'Nova solicitação de amizade',text:`${displayName()}${state.profile?.username?' (@'+normalizeUsername(state.profile.username)+')':''} quer adicionar você.`,link:'#friends',actorUid:state.user.uid,sound:true,createdAt});
    toast(`Solicitação enviada para ${p.nome||'usuário'}.`)
  }catch(e){toast(permissionMessage(e))}
}
function renderFriendRequests(){const box=$('friendRequestList');box.innerHTML='';const rows=Object.entries(state.requests||{});$('requestCount').textContent=String(rows.length);if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhuma solicitação.</div>';return}rows.forEach(([uid,r])=>box.appendChild(personRow({uid,nome:r.nome,avatar:r.avatar,bio:r.bio},{mode:'request',requestUid:uid})))}
async function acceptFriendRequest(senderUid,p){if(!state.user)return;const me={uid:state.user.uid,nome:displayName(),avatar:avatarFor(),bio:state.profile?.bio||'',since:nowIso()};const other={uid:senderUid,nome:p.nome||'Usuário',avatar:p.avatar||'',bio:p.bio||'',since:nowIso()};const patch={};patch[`friends/${state.user.uid}/${senderUid}`]=other;patch[`friends/${senderUid}/${state.user.uid}`]=me;patch[`friendRequests/${state.user.uid}/${senderUid}`]=null;patch[`siteNotifications/${state.user.uid}/friend_${senderUid}`]=null;try{await update(ref(db),patch);toast('Amigo adicionado.')}catch(e){toast(permissionMessage(e))}}
async function declineFriendRequest(senderUid){try{const patch={};patch[`friendRequests/${state.user.uid}/${senderUid}`]=null;patch[`siteNotifications/${state.user.uid}/friend_${senderUid}`]=null;await update(ref(db),patch)}catch(e){toast(permissionMessage(e))}}
function renderFriends(){const box=$('friendList');box.innerHTML='';const rows=Object.values(state.friends||{});$('friendCount').textContent=String(rows.length);if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhum amigo ainda.</div>';return}rows.forEach(p=>box.appendChild(personRow(p,{mode:'friend'})))}
async function removeFriend(friendUid){if(!state.user)return;const patch={};patch[`friends/${state.user.uid}/${friendUid}`]=null;patch[`friends/${friendUid}/${state.user.uid}`]=null;try{await update(ref(db),patch);toast('Amizade removida.')}catch(e){toast(permissionMessage(e))}}

// Charlotte / vínculo
function renderCharlotteStatus(){
  const linked=state.charlottePublic?.status==='linked';$('topCharlotteStatus').classList.toggle('linked',linked);$('homeCharlotteText').textContent=linked?'Vinculada':'Não vinculada';$('linkStatusTitle').textContent=linked?'Charlotte vinculada':'Vincular Charlotte';$('linkStatusText').textContent=state.charlottePublic?.lastError?`Último erro: ${state.charlottePublic.lastError}`:(linked?'Sua conta do site está ligada ao WhatsApp.':'Gere um código e envie para a Charlotte.');$('syncStatePill').textContent=linked?'Vinculado':'Desconectado';$('syncWhatsapp').textContent=state.charlottePublic?.whatsappMasked||'—';
  if(linked){$('linkCodeBox').hidden=true;$('createLinkCodeBtn').textContent='Gerar novo código';$('openCharlotteLinkBtn').hidden=true}else{loadPendingLinkCode()}
}
async function loadPendingLinkCode(){if(!state.user)return;try{const s=await get(ref(db,`charlotteLinkRequests/${state.user.uid}`));if(s.exists()){const v=s.val();$('linkCodeValue').textContent=v.code||'------';$('linkCodeBox').hidden=false;$('openCharlotteLinkBtn').hidden=false}}catch{}}
$('createLinkCodeBtn').addEventListener('click',async()=>{if(!state.user)return;const code=randomCode(6);try{await set(ref(db,`charlotteLinkRequests/${state.user.uid}`),{uid:state.user.uid,code,createdAt:nowIso(),expiresAt:Date.now()+10*60*1000});$('linkCodeValue').textContent=code;$('linkCodeBox').hidden=false;$('openCharlotteLinkBtn').hidden=false;toast('Código criado. Ele dura 10 minutos.')}catch(e){toast(permissionMessage(e))}});
$('openCharlotteLinkBtn').addEventListener('click',()=>{const code=$('linkCodeValue').textContent.trim();if(code&&code!=='------')wa(`/vincular ${code}`)});
$('syncCharlotteBtn').addEventListener('click',async()=>{if(!state.user)return;if(state.charlottePublic?.status!=='linked')return toast('Vincule a Charlotte primeiro.');try{await requestAccountSync();toast('Dados sincronizados.')}catch(e){toast(e.message||permissionMessage(e))}});
function renderCharlotteSync(){
  const s=state.charlotteSync||{};const mons=s.pokemon?.collection||s.pokemon?.team||[];const count=Array.isArray(mons)?mons.length:Object.keys(mons||{}).length;const acc=s.account||{};const ach=s.achievements||{};
  $('syncPokemonCount').textContent=String(count);$('syncUpdatedAt').textContent=s.updatedAt?shortDateTime(s.updatedAt):'—';
  if($('syncBalance'))$('syncBalance').textContent=`₹ ${formatNumber(acc.balance||0)}`;
  if($('syncLevel'))$('syncLevel').textContent=formatNumber(acc.level||0);
  if($('syncPremium'))$('syncPremium').textContent=acc.premium?'Premium':'Padrão';
  if($('syncAchievements'))$('syncAchievements').textContent=String(ach.unlockedCount||0);
}
// Pokédex / equipe sincronizada
async function fetchPokemon(term){const clean=String(term||'').trim().toLowerCase();if(!clean)throw new Error('Digite um Pokémon.');const r=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(clean)}`);if(!r.ok)throw new Error('Pokémon não encontrado.');const p=await r.json();return{id:p.id,name:p.name,sprite:p.sprites?.other?.['official-artwork']?.front_default||p.sprites?.front_default||'',types:(p.types||[]).map(x=>x.type.name),stats:Object.fromEntries((p.stats||[]).map(x=>[x.stat.name,x.base_stat]))}}
function renderPokemon(p){const box=$('pokemonResult');box.innerHTML='';const card=document.createElement('div');card.className='pokemon-card';const art=document.createElement('div');art.className='pokemon-art';const img=document.createElement('img');img.src=p.sprite;img.alt=p.name;art.appendChild(img);const info=document.createElement('div');info.className='pokemon-info';const dex=document.createElement('div');dex.className='dex';dex.textContent=`#${String(p.id).padStart(4,'0')}`;const h=document.createElement('h3');h.textContent=p.name;const types=document.createElement('div');types.className='type-row';p.types.forEach(t=>{const s=document.createElement('span');s.className='type-pill';s.textContent=t;types.appendChild(s)});const stats=document.createElement('div');stats.className='pokemon-stats';[['HP',p.stats.hp],['Ataque',p.stats.attack],['Velocidade',p.stats.speed]].forEach(([a,b])=>{const d=document.createElement('div');const s=document.createElement('span');s.textContent=a;const st=document.createElement('strong');st.textContent=b;d.append(s,st);stats.appendChild(d)});info.append(dex,h,types,stats);card.append(art,info);box.appendChild(card)}
$('pokemonSearchForm').addEventListener('submit',async ev=>{ev.preventDefault();$('pokemonResult').innerHTML='<div class="loading-line">Buscando...</div>';try{renderPokemon(await fetchPokemon($('pokemonSearchInput').value))}catch(e){$('pokemonResult').innerHTML=`<div class="empty-state small">${escText(e.message)}</div>`}});
async function loadPokemonSources(){
  if(!state.user){state.teamDraft=[];renderTeam([],'Site');return}
  let list=[];let source='Site';const sync=state.charlotteSync?.pokemon;
  if(sync){list=Array.isArray(sync.team)&&sync.team.length?sync.team:Array.isArray(sync.collection)?sync.collection:Object.values(sync.team||sync.collection||{});source='Charlotte'}
  else{const sn=await get(ref(db,`pokemonWeb/${state.user.uid}/team`)).catch(()=>null);state.webTeam=sn?.exists()?sn.val():{};list=Object.values(state.webTeam||{})}
  state.teamDraft=(list||[]).map(normalizeMon).slice(0,6);renderTeam(state.teamDraft,source);renderCollection();renderHealingList();
}
const POKEMON_TYPE_LABEL={normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Veneno',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
const POKEMON_TYPE_EMOJI={normal:'⚪',fire:'🔥',water:'💧',electric:'⚡',grass:'🌿',ice:'❄️',fighting:'🥊',poison:'☠️',ground:'🌍',flying:'🪽',psychic:'🔮',bug:'🐛',rock:'🪨',ghost:'👻',dragon:'🐉',dark:'🌑',steel:'⚙️',fairy:'✨'};
function normalizeTypeValue(v){if(v&&typeof v==='object')v=v.name||v.type?.name||v.tipo||'';return String(v||'').trim().toLowerCase().replace('fogo','fire').replace('água','water').replace('agua','water').replace('elétrico','electric').replace('eletrico','electric').replace('planta','grass').replace('gelo','ice').replace('lutador','fighting').replace('veneno','poison').replace('terra','ground').replace('voador','flying').replace('psíquico','psychic').replace('psiquico','psychic').replace('inseto','bug').replace('pedra','rock').replace('fantasma','ghost').replace('dragão','dragon').replace('dragao','dragon').replace('sombrio','dark').replace('aço','steel').replace('aco','steel').replace('fada','fairy')}
function monTypes(m={}){let raw=m.types??m.tipos??m.tipo??m.tipoTxt??m.type??[];if(!Array.isArray(raw))raw=String(raw||'').split(/[\/,|+]/);const extra=[m.tipo1,m.tipo2,m.type1,m.type2];return [...raw,...extra].map(normalizeTypeValue).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,2)}
function typeLabel(type){const t=normalizeTypeValue(type);return `${POKEMON_TYPE_EMOJI[t]||'⚪'} ${POKEMON_TYPE_LABEL[t]||t||'Normal'}`}
function typeBadgesHtml(types=[]){return (types||[]).map(t=>`<span class="pokemon-type type-${escText(normalizeTypeValue(t))}">${escText(typeLabel(t))}</span>`).join('')}
function normalizeMon(m){return{uid:m.uid||String(m.id||m.dex||m.name),id:Number(m.dex||m.id||m.pokedexId||0),name:m.nome||m.name||'Pokémon',sprite:m.sprite||m.image||m.imagem||m.gif||m.front||'',types:monTypes(m),level:Number(m.level||1),hp:Number(m.hpAtual??m.hp??m.maxHp??1),maxHp:Math.max(1,Number(m.maxHp??m.hpMax??m.hp??1)),fainted:Boolean(m.fainted)||Number(m.hpAtual??m.hp??1)<=0,moves:Array.isArray(m.moves)?m.moves:[]}}
function hpPct(p){return Math.max(0,Math.min(100,(Number(p.hp||0)/Math.max(1,Number(p.maxHp||1)))*100))}
function renderTeam(list,source='Charlotte'){
  const wrap=$('pokemonTeam');if(!wrap)return;wrap.innerHTML='';const normalized=(list||[]).map(normalizeMon).slice(0,6);$('teamSourceLabel').textContent=source;$('teamCount').textContent=`${normalized.length}/6`;
  normalized.forEach((p,i)=>{const row=document.createElement('div');row.className='team-slot team-slot-edit'+(p.fainted?' fainted':'');const img=document.createElement('img');img.src=p.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;img.alt='';const c=document.createElement('div');c.className='team-copy';const st=document.createElement('strong');st.textContent=`${i+1}. ${p.name}`;const sm=document.createElement('small');sm.textContent=`Lv.${p.level} • HP ${Math.max(0,p.hp)}/${p.maxHp}${p.fainted?' • DESMAIADO':''}`;const hp=document.createElement('div');hp.className='mini-hpbar';const hi=document.createElement('i');hi.style.width=`${hpPct(p)}%`;hp.appendChild(hi);c.append(st,sm,hp);const acts=document.createElement('div');acts.className='team-slot-actions';const up=document.createElement('button');up.type='button';up.textContent='↑';up.disabled=i===0;up.onclick=()=>moveTeamSlot(i,-1);const down=document.createElement('button');down.type='button';down.textContent='↓';down.disabled=i===normalized.length-1;down.onclick=()=>moveTeamSlot(i,1);const rem=document.createElement('button');rem.type='button';rem.textContent='×';rem.onclick=()=>removeTeamSlot(i);acts.append(up,down,rem);row.append(img,c,acts);wrap.appendChild(row)});
  for(let i=normalized.length;i<6;i++){const e=document.createElement('div');e.className='team-empty';e.textContent='Espaço livre';wrap.appendChild(e)}$('homePokemonText').textContent=normalized.length?`${normalized.length} na equipe`:'Abrir centro'
}
function moveTeamSlot(index,delta){const next=index+delta;if(next<0||next>=state.teamDraft.length)return;[state.teamDraft[index],state.teamDraft[next]]=[state.teamDraft[next],state.teamDraft[index]];renderTeam(state.teamDraft,'Rascunho')}
function removeTeamSlot(index){state.teamDraft.splice(index,1);renderTeam(state.teamDraft,'Rascunho');renderCollection()}
function addTeamMon(mon){const p=normalizeMon(mon);if(state.teamDraft.some(x=>String(x.uid)===String(p.uid)))return toast('Esse Pokémon já está na equipe.');if(state.teamDraft.length>=6)return toast('Sua equipe já tem 6 Pokémon.');state.teamDraft.push(p);renderTeam(state.teamDraft,'Rascunho');renderCollection()}
$('savePokemonTeamBtn')?.addEventListener('click',async()=>{try{if(!state.teamDraft.length)throw new Error('Escolha pelo menos um Pokémon.');const teamUids=state.teamDraft.slice(0,6).map(x=>x.uid);await bridgeRequest('pokemon_set_team',{teamUids},30000);await requestAccountSync();toast('Equipe salva no site e na Charlotte.')}catch(e){toast(e.message)}});
$('resetPokemonTeamBtn')?.addEventListener('click',()=>loadPokemonSources());
$('pokemonSyncBtn')?.addEventListener('click',async()=>{try{await requestAccountSync();toast('Pokémon sincronizados.')}catch(e){toast(e.message)}});
$('pokemonExploreBotBtn').onclick=async()=>{try{const r=await bridgeRequest('pokemon_explore',{},30000);if(r.encounter)state.pokemonEncounter=r.encounter;renderWildEncounter();toast('Um Pokémon selvagem apareceu!')}catch(e){toast(e.message)}};

// Duelo Pokémon 6x6 via bridge do bot
function renderDuelFriendSelect(){const sel=$('duelFriendSelect');if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Escolha um amigo</option>';Object.values(state.friends||{}).forEach(f=>{const o=document.createElement('option');o.value=f.uid;o.textContent=f.nome||'Usuário';sel.appendChild(o)});if(state.friends[current])sel.value=current;renderGameFriendSelects()}
$('sendDuelChallengeBtn').addEventListener('click',async()=>{const targetUid=$('duelFriendSelect').value;if(!targetUid)return toast('Escolha um amigo.');if(state.charlottePublic?.status!=='linked')return toast('Vincule a Charlotte primeiro.');playGameSfx('select');try{await push(ref(db,`siteBridgeJobs/${state.user.uid}`),{type:'duel_challenge',targetUid,createdAt:nowIso()});toast('Desafio 6x6 enviado.')}catch(e){toast(permissionMessage(e))}});
function renderDuelInbox(obj){const box=$('duelInbox');box.innerHTML='';const rows=Object.entries(obj||{});if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhum desafio.</div>';return}rows.forEach(([id,c])=>{const r=document.createElement('div');r.className='duel-request';const cp=document.createElement('div');const st=document.createElement('strong');st.textContent=c.fromName||'Desafiante';const sm=document.createElement('small');sm.textContent='quer batalhar 6x6';cp.append(st,sm);const acts=document.createElement('div');acts.className='person-actions';const a=document.createElement('button');a.className='mini-btn primary';a.textContent='Aceitar';a.onclick=()=>duelJob('duel_accept',{challengeId:id});const d=document.createElement('button');d.className='mini-btn';d.textContent='Recusar';d.onclick=()=>duelJob('duel_decline',{challengeId:id});acts.append(a,d);r.append(cp,acts);box.appendChild(r)})}
async function duelJob(type,data){try{playGameSfx(type==='duel_switch'?'switch':'select');await push(ref(db,`siteBridgeJobs/${state.user.uid}`),{type,...data,createdAt:nowIso()});toast(type==='duel_move'?'Golpe enviado.':type==='duel_switch'?'Troca enviada.':'Processando...')}catch(e){toast(permissionMessage(e))}}
function handleDuelIndex(obj){
  const entries=Object.entries(obj||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
  const active=entries.find(x=>x.status==='active');
  if(active){if(state.duel?.id!==active.id)subscribeDuel(active.id);return}
  const finished=entries.find(x=>x.status==='finished');
  if(finished&&state.duel?.id!==finished.id)subscribeDuel(finished.id);else if(!finished)setActiveDuel(null)
}
function subscribeDuel(id){if(state.duelUnsub){try{state.duelUnsub()}catch{}}state.duelUnsub=onValue(ref(db,`pokemonSiteDuels/${id}`),s=>setActiveDuel(s.exists()?{id,...s.val()}:null))}
function setActiveDuel(duel){
  const prev=state.duel;
  if(duel?.status==='active'){
    if(!prev||prev.id!==duel.id){playGameSfx('start');if(duel.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),190)}
    else if(prev.status==='active'){
      const prevMe=prev.players?.[state.user?.uid]||{},nextMe=duel.players?.[state.user?.uid]||{},prevEnemy=Object.values(prev.players||{}).find(x=>x.uid!==state.user?.uid)||{},nextEnemy=Object.values(duel.players||{}).find(x=>x.uid!==state.user?.uid)||{};
      const prevMyMon=duelCurrent(prevMe),nextMyMon=duelCurrent(nextMe),prevEnemyMon=duelCurrent(prevEnemy),nextEnemyMon=duelCurrent(nextEnemy);
      if(Number(nextMyMon.hp)<Number(prevMyMon.hp)||Number(nextEnemyMon.hp)<Number(prevEnemyMon.hp))playPokemonSound('hit');
      else if(String(nextMyMon.uid)!==String(prevMyMon.uid)||String(nextEnemyMon.uid)!==String(prevEnemyMon.uid))playGameSfx('switch');
      if(prev.turnUid!==duel.turnUid&&duel.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),100);
    }
  }
  state.duel=duel;const arena=$('duelArena');const lobby=$('duelLobby');
  if(!duel||duel.status!=='active'){
    arena.hidden=true;lobby.hidden=false;const won=!!duel&&duel.winnerUid===state.user?.uid;$('duelStatusPill').textContent=won?'Vitória':duel?'Encerrado':'Aguardando';
    if(duel?.status==='finished'&&duel.id&&state.duelSeenActiveIds.has(duel.id)){state.duelSeenActiveIds.delete(duel.id);const reward=duel.reward||{};showGameResult({title:won?'Vitória Pokémon!':'Batalha encerrada',text:won?(reward.rupias?`Você ganhou ₹${reward.rupias}, ${reward.trainerXp||0} XP e ${reward.pokemonXp||0} XP Pokémon.`:'Você venceu a batalha.'):'A batalha foi encerrada.',win:won,icon:won?'⚡':'◉'});if(won&&Number(reward.rupias||0)>0)setTimeout(()=>playGameSfx('coins'),420)}
    return
  }
  state.duelSeenActiveIds.add(duel.id);arena.hidden=false;lobby.hidden=true;$('duelStatusPill').textContent=duel.turnUid===state.user?.uid?'Sua vez':'Vez do rival';renderDuel(duel)
}
function duelTeam(player){if(Array.isArray(player?.team)&&player.team.length)return player.team.map(normalizeMon);return player?.pokemon?[normalizeMon(player.pokemon)]:[]}
function duelCurrent(player){const team=duelTeam(player);return team.find(x=>String(x.uid)===String(player?.currentUid))||team[Math.max(0,Number(player?.activeIndex||0))]||team[0]||normalizeMon({})}
function renderDuelTeamStrip(id,player){const box=$(id);if(!box)return;box.innerHTML='';const cur=duelCurrent(player);duelTeam(player).forEach(p=>{const d=document.createElement('div');d.className='duel-team-ball'+(String(p.uid)===String(cur.uid)?' active':'')+(p.fainted||p.hp<=0?' fainted':'');d.title=`${p.name} • ${Math.max(0,p.hp)}/${p.maxHp}`;const img=document.createElement('img');img.src=p.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;img.alt='';d.appendChild(img);box.appendChild(d)})}
function renderDuel(d){
  const me=d.players?.[state.user?.uid];const enemy=Object.values(d.players||{}).find(x=>x.uid!==state.user?.uid);if(!me||!enemy)return;
  const mp=duelCurrent(me),ep=duelCurrent(enemy);
  $('duelMyName').textContent=mp.name;$('duelMyOwner').textContent=me.name||'Você';$('duelMySprite').src=mp.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mp.id}.png`;$('duelMyHp').textContent=`${Math.max(0,mp.hp)} / ${mp.maxHp}`;$('duelMyHpBar').style.width=`${hpPct(mp)}%`;
  $('duelEnemyName').textContent=ep.name;$('duelEnemyOwner').textContent=enemy.name||'Adversário';$('duelEnemySprite').src=ep.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${ep.id}.png`;$('duelEnemyHp').textContent=`${Math.max(0,ep.hp)} / ${ep.maxHp}`;$('duelEnemyHpBar').style.width=`${hpPct(ep)}%`;
  if($('duelMyTypes'))$('duelMyTypes').innerHTML=typeBadgesHtml(mp.types);if($('duelEnemyTypes'))$('duelEnemyTypes').innerHTML=typeBadgesHtml(ep.types);
  renderDuelTeamStrip('duelMyTeam',me);renderDuelTeamStrip('duelEnemyTeam',enemy);
  const acts=$('duelMoveButtons');acts.innerHTML='';const moves=mp.moves.length?mp.moves:[{name:'Ataque rápido',power:40,type:'normal'},{name:'Investida',power:45,type:'normal'}];
  moves.slice(0,4).forEach((m,i)=>{const b=document.createElement('button');b.className='btn duel-move-btn'+(i===0?' primary':'');const mt=normalizeTypeValue(m.type||m.tipo||'normal');b.innerHTML=`<b>${escText(m.nome||m.name||`Golpe ${i+1}`)}</b><small>${escText(typeLabel(mt))} • Poder ${Number(m.power||m.poder||0)}</small>`;b.disabled=d.status!=='active'||d.turnUid!==state.user?.uid||mp.fainted||mp.hp<=0;b.onclick=()=>duelJob('duel_move',{duelId:d.id,moveIndex:i});acts.appendChild(b)});
  const sw=$('duelSwitcher');sw.innerHTML='';duelTeam(me).filter(x=>x.hp>0&&!x.fainted&&String(x.uid)!==String(mp.uid)).forEach(p=>{const b=document.createElement('button');b.className='mini-btn';b.textContent=`${p.name} • ${p.hp}/${p.maxHp}`;b.disabled=d.turnUid!==state.user?.uid;b.onclick=()=>duelJob('duel_switch',{duelId:d.id,monUid:p.uid});sw.appendChild(b)});$('duelSwitchBtn').disabled=d.turnUid!==state.user?.uid||!sw.children.length;
  const log=$('duelLog');const rows=Object.values(d.log||{});log.innerHTML=rows.length?rows.slice(-12).reverse().map(x=>`<div>${escText(x.text||'')}</div>`).join(''):'<div>A batalha 6x6 começou.</div>';
}
$('duelSwitchBtn')?.addEventListener('click',()=>{$('duelSwitcher').hidden=!$('duelSwitcher').hidden});
$('duelExitBtn')?.addEventListener('click',async()=>{if(!state.duel)return;if(!confirm('Sair da luta conta como desistência. Continuar?'))return;await duelJob('duel_exit',{duelId:state.duel.id})});

// Bridge / ações do site
function linkedCharlotte(){return state.charlottePublic?.status==='linked'}
async function bridgeRequest(type,data={},timeoutMs=22000,requireLink=true){
  if(!state.user) throw new Error('Entre na sua conta.');
  if(requireLink&&!linkedCharlotte()) throw new Error('Vincule a Charlotte primeiro.');
  const jobRef=push(ref(db,`siteBridgeJobs/${state.user.uid}`));const jobId=jobRef.key;await set(jobRef,{type,...data,createdAt:nowIso()});
  return await new Promise((resolve,reject)=>{let done=false;let unsub=null;const timer=setTimeout(()=>{if(done)return;done=true;try{unsub?.()}catch{}reject(new Error('A Charlotte demorou para responder. Tente novamente.'))},timeoutMs);unsub=onValue(ref(db,`siteBridgeResults/${state.user.uid}/${jobId}`),sn=>{if(done||!sn.exists())return;done=true;clearTimeout(timer);try{unsub?.()}catch{}const v=sn.val()||{};if(v.ok===false)reject(new Error(v.error||'Não foi possível concluir.'));else resolve(v)},e=>{if(done)return;done=true;clearTimeout(timer);reject(e)})});
}
async function requestAccountSync(){return bridgeRequest('sync_account',{},25000)}
function resultBox(){return $('siteCommandResult')}
function renderProfileResult(){
  const box=resultBox();if(!box)return;const acc=accountSnapshot();const poke=state.charlotteSync?.pokemon||{};const total=(poke.collection||[]).length||Object.keys(poke.collection||{}).length||0;
  box.innerHTML=`<div class="site-result-grid"><div><span>Rúpias</span><strong>₹ ${formatNumber(acc.balance)}</strong></div><div><span>Nível</span><strong>${formatNumber(acc.level)}</strong></div><div><span>XP</span><strong>${formatNumber(acc.xp)}</strong></div><div><span>Premium</span><strong>${acc.premium?'Ativo':'Padrão'}</strong></div><div><span>Pokémon</span><strong>${total}</strong></div><div><span>Cadastro no bot</span><strong>${acc.registered===false?'Não':'Sim'}</strong></div></div>`;
}
function renderAchievementsResult(){
  const box=resultBox();if(!box)return;const a=state.charlotteSync?.achievements||{};const list=Array.isArray(a.unlocked)?a.unlocked:[];
  box.innerHTML='';const head=document.createElement('div');head.className='panel-head';head.innerHTML=`<div><strong>${a.unlockedCount||0}/${a.total||0} conquistas</strong><div class="muted">${escText(a.badge||'Sem badge equipado')}</div></div>`;box.appendChild(head);
  const wrap=document.createElement('div');wrap.className='achievement-list';if(!list.length){wrap.innerHTML='<div class="empty-state small">Nenhuma conquista desbloqueada ainda.</div>'}else list.slice().reverse().slice(0,20).forEach(x=>{const d=document.createElement('div');d.className='achievement-row';const c=document.createElement('div');const st=document.createElement('strong');st.textContent=`${x.emoji||'🏆'} ${x.name||x.id}`;const sm=document.createElement('small');sm.textContent=x.description||x.badge||'';c.append(st,sm);const b=document.createElement('b');b.textContent=x.badge||'✓';d.append(c,b);wrap.appendChild(d)});box.appendChild(wrap);
}
async function handleSiteAction(action){
  try{
    if(['profile','achievements','vip','team','collection'].includes(action)){
      if(linkedCharlotte()) await requestAccountSync();
      if(action==='profile'){renderProfileResult();navigate('charlotte');return}
      if(action==='achievements'){renderAchievementsResult();navigate('charlotte');return}
      if(action==='vip'){navigate('premium');renderAccount();return}
      if(action==='team'){navigate('pokemon');setTimeout(()=>document.querySelector('.team-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),80);return}
      if(action==='collection'){navigate('pokemon');setTimeout(()=>$('pokemonCollectionPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),80);return}
    }
    if(action==='daily'){
      const box=resultBox();if(box)box.innerHTML='<div class="loading-line">Coletando Daily...</div>';
      const r=await bridgeRequest('daily_claim',{},25000);
      await requestAccountSync().catch(()=>{});
      if(r.claimed===false){
        const ms=Math.max(0,Number(r.cooldownMs||0));const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);
        if(box)box.innerHTML=`<div class="empty-state small">Daily já coletado. Volte em <strong>${h}h ${m}m</strong>.</div>`;
        toast('Seu Daily ainda está em cooldown.');return;
      }
      if(box)box.innerHTML=`<div class="site-result-grid"><div><span>Recompensa</span><strong>${escText(r.rewardName||'Daily')}</strong></div><div><span>Rúpias</span><strong>+₹${formatNumber(r.rupias||0)}</strong></div><div><span>XP</span><strong>+${formatNumber(r.xp||0)}</strong></div><div><span>Saldo</span><strong>₹${formatNumber(r.balance||0)}</strong></div></div>`;
      if(Number(r.rupias||0)>0)playGameSfx('coins');
      toast('Daily coletado.');
    }
  }catch(e){toast(e.message||'Não foi possível concluir.');const box=resultBox();if(box)box.innerHTML=`<div class="empty-state small">${escText(e.message||'Erro')}</div>`}
}
$$('[data-site-action]').forEach(b=>b.addEventListener('click',()=>handleSiteAction(b.dataset.siteAction)));
$$('[data-bot-command]').forEach(b=>b.addEventListener('click',()=>wa(b.dataset.botCommand)));
$('playBotForm').addEventListener('submit',ev=>{ev.preventDefault();const q=$('playBotInput').value.trim();if(q)wa(`/play ${q}`)});

// Downloads
const downloadLabels={tiktok:'Link do TikTok',instagram:'Link do Instagram',pinterest:'Link do Pinterest',spotify:'Link do Spotify',youtube:'Nome ou link do YouTube',facebook:'Link do Facebook',apk:'Nome do aplicativo'};
$$('.service-tab').forEach(btn=>btn.addEventListener('click',()=>{state.downloadService=btn.dataset.service;$$('.service-tab').forEach(b=>b.classList.toggle('active',b===btn));$('downloadLabel').textContent=downloadLabels[state.downloadService];const textMode=['youtube','apk'].includes(state.downloadService);$('downloadInput').type=textMode?'text':'url';$('downloadInput').placeholder=state.downloadService==='youtube'?'Ex: Evidências Chitãozinho':state.downloadService==='apk'?'Ex: WhatsApp':'Cole o link aqui';$('downloadResult').innerHTML=''}));
async function prepareApkSearch(input){
  const r=await fetch('/api/main?action=apk_search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:input,limit:12})});
  const data=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(data.result))throw new Error(data.erro||'Não foi possível pesquisar APK.');
  const box=$('downloadResult');box.innerHTML='';if(!data.result.length){box.innerHTML='<div class="empty-state small">Nenhum aplicativo encontrado.</div>';return}
  const list=document.createElement('div');list.className='people-list';
  data.result.slice(0,12).forEach(app=>{const row=document.createElement('div');row.className='person-row';const img=document.createElement('img');img.src=app.icon||DEFAULT_AVATAR;const cp=document.createElement('div');cp.className='person-copy';const st=document.createElement('strong');st.textContent=app.name||app.package||'Aplicativo';const sm=document.createElement('small');sm.textContent=app.package||app.version||'APK';cp.append(st,sm);const b=document.createElement('button');b.className='mini-btn primary';b.textContent='Preparar';b.onclick=async()=>{try{b.disabled=true;const rr=await fetch('/api/main?action=apk_download',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:app.downloadUrl||app.file?.path||app.url,name:app.name||app.package})});const d=await rr.json().catch(()=>({}));if(!rr.ok||!d.downloadUrl)throw new Error(d.erro||'Falha ao preparar APK.');renderDownloadReady(d,'apk',input)}catch(e){toast(e.message)}finally{b.disabled=false}};row.append(img,cp,b);list.appendChild(row)});box.appendChild(list);
}
async function prepareYoutube(input){
  const box=$('downloadResult');box.innerHTML='';
  const row=document.createElement('div');row.className='download-youtube-card bot-youtube-card';
  const copy=document.createElement('div');copy.className='download-youtube-copy';const st=document.createElement('strong');st.textContent='YouTube pela Charlotte';const sm=document.createElement('small');sm.textContent='O download é processado pela Charlotte e enviado direto no WhatsApp.';
  const query=document.createElement('div');query.className='youtube-query';query.textContent=input;
  const acts=document.createElement('div');acts.className='download-ready-actions';
  const makeBtn=(mode,label)=>{const b=document.createElement('button');b.type='button';b.className=mode==='video'?'btn primary':'btn';b.textContent=label;b.onclick=async()=>{try{if(!linkedCharlotte())throw new Error('Vincule a Charlotte para usar o YouTube com os cookies do bot.');b.disabled=true;const r=await bridgeRequest('youtube_bot_download',{input,mode},120000);box.innerHTML=`<div class="download-ready"><div><strong>${escText(r.title||'YouTube')}</strong><small>${escText(r.message||'Enviado para seu WhatsApp pela Charlotte.')}</small></div></div>`;toast('YouTube processado pela Charlotte.')}catch(e){toast(e.message)}finally{b.disabled=false}};return b};
  acts.append(makeBtn('audio','Áudio no WhatsApp'),makeBtn('video','Vídeo no WhatsApp'));copy.append(st,sm,query,acts);row.appendChild(copy);box.appendChild(row);
}
$('downloadForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const input=$('downloadInput').value.trim();if(!input)return;state.lastDownloadInput=input;const service=state.downloadService;
  $('downloadSubmit').disabled=true;$('downloadResult').innerHTML='<div class="loading-line">Preparando...</div>';
  try{
    if(service==='apk'){await prepareApkSearch(input);return}
    if(service==='youtube'){await prepareYoutube(input);return}
    const r=await fetch(`/api/main?action=${service}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:input})});const data=await r.json().catch(()=>({}));if(!r.ok||!data.downloadUrl)throw new Error(data.erro||'Não foi possível preparar o arquivo.');renderDownloadReady(data,service,input)
  }catch(e){$('downloadResult').innerHTML=`<div class="empty-state small">${escText(e.message)}</div>`}finally{$('downloadSubmit').disabled=false}
});
function renderDownloadReady(data,service,input){
  const box=$('downloadResult');box.innerHTML='';const row=document.createElement('div');row.className='download-ready';const copy=document.createElement('div');const st=document.createElement('strong');st.textContent=data.title||data.filename||service;const sm=document.createElement('small');sm.textContent=data.artist?`${data.artist}${data.album?' • '+data.album:''}`:(data.quality?`Qualidade: ${data.quality}`:'Arquivo pronto');copy.append(st,sm);const acts=document.createElement('div');acts.className='download-ready-actions';const a=document.createElement('a');a.className='btn primary';a.href=data.downloadUrl;a.target='_blank';a.rel='noreferrer';a.textContent='Baixar';acts.append(a);
  if(linkedCharlotte()){const w=document.createElement('button');w.className='btn';w.textContent='Enviar no WhatsApp';w.onclick=async()=>{try{w.disabled=true;const absolute=new URL(data.downloadUrl,location.origin).toString();await bridgeRequest('send_download_link',{url:absolute,title:data.title||data.filename||service,service,filename:data.filename||'',mimetype:data.mimetype||''},30000);toast('Arquivo enviado pelo bot no seu WhatsApp.')}catch(e){toast(e.message)}finally{w.disabled=false}};acts.append(w)}
  row.append(copy,acts);box.appendChild(row)
}

// Premium
$$('[data-buy-plan]').forEach(btn=>btn.addEventListener('click',async()=>{
  const plan=btn.dataset.buyPlan;if(!linkedCharlotte())return toast('Vincule a Charlotte antes de comprar Premium.');
  const status=$('premiumCheckoutStatus');try{btn.disabled=true;if(status)status.textContent='Criando pagamento seguro...';const r=await bridgeRequest('premium_checkout',{plan},30000);if(status)status.textContent='Pagamento criado. Abrindo Mercado Pago...';if(r.checkoutUrl){window.open(r.checkoutUrl,'_blank','noopener,noreferrer');startPremiumPolling()}else throw new Error('Mercado Pago não retornou o link.')}catch(e){if(status)status.textContent=e.message;toast(e.message)}finally{btn.disabled=false}
}));
function startPremiumPolling(){
  if(state.premiumPoll)return;let tries=0;
  state.premiumPoll=setInterval(async()=>{tries++;try{await requestAccountSync();if(accountSnapshot().premium){clearInterval(state.premiumPoll);state.premiumPoll=null;toast('Premium ativado na sua conta.')}}catch{}if(tries>=20&&state.premiumPoll){clearInterval(state.premiumPoll);state.premiumPoll=null}},30000);
}
$('refreshPremiumBtn')?.addEventListener('click',async()=>{try{await requestAccountSync();toast('Status atualizado.')}catch(e){toast(e.message)}});
$('refreshStoreBtn')?.addEventListener('click',async()=>{try{await requestAccountSync();toast('Saldo atualizado.')}catch(e){toast(e.message)}});
$('openOwnPublicProfileBtn')?.addEventListener('click',()=>state.user&&openPublicProfile(state.user.uid,state.profile||{}));

// Personalizações
const STORE_CATALOG={
  frame_crimson:{name:'Carmesim',price:350,className:'fx-frame-crimson',slot:'frame'},
  frame_obsidian:{name:'Obsidiana',price:1650,className:'fx-frame-obsidian',slot:'frame'},
  frame_royal:{name:'Imperial',price:3200,className:'fx-frame-royal',slot:'frame'},
  scale_dragon:{name:'Escamas Gremory',price:600,className:'fx-scale-dragon',slot:'effect'},
  effect_stars:{name:'Estrelas Demoníacas',price:1450,className:'fx-effect-stars',slot:'effect'},
  effect_embers:{name:'Brasas Carmesim',price:2800,className:'fx-effect-embers',slot:'effect'},
  name_gold:{name:'Nome Dourado',price:900,className:'fx-name-gold',slot:'name'},
  name_rose:{name:'Nome Rosa',price:1350,className:'fx-name-rose',slot:'name'},
  name_ice:{name:'Nome Glacial',price:2100,className:'fx-name-ice',slot:'name'},
  aura_rose:{name:'Rosa Demoníaca',price:1200,className:'fx-aura-rose',slot:'aura'},
  aura_void:{name:'Aura do Vazio',price:2600,className:'fx-aura-void',slot:'aura'},
  badge_demon:{name:'Selo Demoníaco',price:4200,className:'fx-badge-demon',slot:'badge'},
  effect_petals:{name:'Pétalas Carmesim',price:1900,className:'fx-effect-petals',slot:'effect'},
  effect_snow:{name:'Neve Lunar',price:1750,className:'fx-effect-snow',slot:'effect'},
  theme_crimson:{name:'Carmesim Profundo',price:2400,className:'fx-theme-crimson',slot:'theme'},
  theme_midnight:{name:'Meia-noite',price:2600,className:'fx-theme-midnight',slot:'theme'},
  theme_neon:{name:'Neon Noturno',price:3100,className:'fx-theme-neon',slot:'theme'},
  effect_nebula:{name:'Nebulosa',price:2300,className:'fx-effect-nebula',slot:'effect'},
  effect_scanline:{name:'Cyber Scan',price:2050,className:'fx-effect-scanline',slot:'effect'},
  profile_motion_crimson:{name:'Motion Carmesim',price:3600,className:'fx-profile-motion-crimson',slot:'cover',mediaKind:'local-gif',mediaUrl:'/assets/img/background.gif'},
  gif_profile_1:{name:'GIF Especial',price:3900,className:'fx-gif-profile-1',slot:'cover',mediaKind:'gif',assetKey:'gif_profile_1'},
  sprite_profile_1:{name:'Sprite Especial',price:4300,className:'fx-sprite-profile-1',slot:'decor',mediaKind:'sprite',assetKey:'sprite_profile_1'}
};

const STATIC_STORE_IDS=new Set(Object.keys(STORE_CATALOG));let REMOTE_STORE_IDS=new Set();
function sanitizeRemoteStoreItem(id,item={}){id=String(id||item.id||'').trim().toLowerCase();if(!/^[a-z0-9_-]{2,40}$/.test(id))return null;const slot=['cover','decor'].includes(String(item.slot||''))?String(item.slot):'cover',mediaUrl=String(item.mediaUrl||'').trim();if(!/^https:\/\//i.test(mediaUrl))return null;return{id,name:String(item.name||id).trim().slice(0,60),price:Math.max(0,Math.floor(Number(item.price||0))),slot,className:`fx-remote-${id}`,mediaKind:slot==='decor'?'sprite':'gif',mediaUrl,remote:true}}
function mergeRemoteStoreCatalog(raw={}){for(const id of REMOTE_STORE_IDS)if(!STATIC_STORE_IDS.has(id))delete STORE_CATALOG[id];REMOTE_STORE_IDS=new Set();for(const[id,v]of Object.entries(raw||{})){if(STATIC_STORE_IDS.has(String(id)))continue;const item=sanitizeRemoteStoreItem(id,v);if(!item)continue;STORE_CATALOG[id]=item;REMOTE_STORE_IDS.add(id)}renderDynamicStoreItems()}
function renderDynamicStoreItems(){const grid=$('storeGrid');if(!grid)return;grid.querySelectorAll('.dynamic-store-item').forEach(x=>x.remove());for(const id of REMOTE_STORE_IDS){const item=STORE_CATALOG[id];if(!item)continue;const card=document.createElement('article');card.className='store-item external-asset-item dynamic-store-item';card.dataset.storeCategory='animated';card.dataset.storeItem=id;const prev=document.createElement('div');prev.className='store-preview external-asset-preview';prev.style.backgroundImage=`linear-gradient(180deg,rgba(5,7,12,.06),rgba(5,7,12,.46)),url("${item.mediaUrl.replace(/"/g,'%22')}")`;const copy=document.createElement('div');copy.innerHTML=`<small>${item.slot==='decor'?'SPRITE':'ANIMADO'}</small><strong>${escText(item.name)}</strong><span>₹${formatNumber(item.price)}</span>`;const b=document.createElement('button');b.className='btn';b.dataset.buyCustomization=id;b.textContent='Comprar';b.addEventListener('click',()=>handleCustomizationButton(b));card.append(prev,copy,b);grid.appendChild(card)}applyStoreFilter(currentStoreFilter)}
function applyOwnProfileCustomization(){const card=$('accountDrawerCard'),media=$('profileOwnMedia');if(!card||!media)return;Object.values(STORE_CATALOG).forEach(x=>x?.className&&card.classList.remove(x.className));const ids=equippedCustomizationIds().filter(id=>ownedCustomization(id));ids.forEach(id=>{const item=STORE_CATALOG[id];if(item?.className)card.classList.add(item.className)});media.innerHTML='';for(const id of ids){const cfg=mediaConfigForItem(id);if(!cfg?.url)continue;const img=document.createElement('img');img.src=cfg.url;img.alt='';img.loading='eager';img.decoding='async';img.className=cfg.kind==='sprite'?'profile-media-sprite':'profile-media-gif';media.appendChild(img)}}
function ownedCustomization(id){return !!state.siteInventory?.items?.[id]}
function equippedCustomizationIds(){
  const equipped=state.siteCustomization?.equipped||{};
  const ids=Object.values(equipped).filter(Boolean).map(String);
  const legacy=String(state.siteCustomization?.active||'');if(legacy&&!ids.includes(legacy))ids.push(legacy);
  return ids;
}
function renderAmbientCustomization(){
  document.getElementById('gremoryFxLayer')?.remove();
  const active=equippedCustomizationIds().filter(id=>ownedCustomization(id));
  const kind=active.includes('effect_petals')?'petals':active.includes('effect_snow')?'snow':active.includes('effect_stars')?'stars':active.includes('effect_embers')?'embers':active.includes('effect_nebula')?'nebula':'';if(!kind)return;
  const layer=document.createElement('div');layer.id='gremoryFxLayer';layer.className=`ambient-fx ambient-${kind}`;layer.setAttribute('aria-hidden','true');
  const glyph={petals:'❀',snow:'❄',stars:'✦',embers:'•',nebula:'✧'}[kind]||'✦';const total=kind==='embers'?34:kind==='nebula'?18:24;for(let i=0;i<total;i++){const s=document.createElement('span');s.textContent=glyph;s.style.setProperty('--left',`${Math.random()*100}%`);s.style.setProperty('--delay',`${-Math.random()*12}s`);s.style.setProperty('--dur',`${7+Math.random()*9}s`);s.style.setProperty('--size',`${10+Math.random()*15}px`);s.style.setProperty('--drift',`${-35+Math.random()*70}px`);layer.appendChild(s)}document.body.appendChild(layer)
}
function applyCustomization(){
  Object.values(STORE_CATALOG).forEach(x=>document.body.classList.remove(x.className));
  equippedCustomizationIds().forEach(id=>{if(STORE_CATALOG[id]&&ownedCustomization(id)&&STORE_CATALOG[id].className)document.body.classList.add(STORE_CATALOG[id].className)});renderAmbientCustomization();applyOwnProfileCustomization()
}
function externalProfileAssets(){return window.GREMORY_PROFILE_ASSETS||{}}
function hydrateExternalCustomizationAssets(){
  const assets=externalProfileAssets();
  $$('[data-store-asset]').forEach(card=>{
    const key=card.dataset.storeAsset,cfg=assets[key]||{},url=String(cfg.url||'').trim();
    card.hidden=!url;
    if(!url)return;
    const name=card.querySelector('[data-asset-name]');if(name&&cfg.name)name.textContent=cfg.name;
    const prev=card.querySelector('.external-asset-preview');if(prev){prev.style.backgroundImage=`linear-gradient(180deg,rgba(5,7,12,.08),rgba(5,7,12,.45)),url("${url.replace(/"/g,'%22')}")`;prev.style.backgroundSize='cover';prev.style.backgroundPosition='center';}
  });
}
let currentStoreFilter='all';
function applyStoreFilter(filter=currentStoreFilter){
  currentStoreFilter=filter||'all';
  $$('[data-store-filter]').forEach(b=>b.classList.toggle('active',b.dataset.storeFilter===currentStoreFilter));
  $$('[data-store-category]').forEach(card=>{const matches=currentStoreFilter==='all'||card.dataset.storeCategory===currentStoreFilter;card.classList.toggle('store-filter-hidden',!matches)});
}
$$('[data-store-filter]').forEach(b=>b.addEventListener('click',()=>applyStoreFilter(b.dataset.storeFilter)));
function renderEquippedCustomizationSummary(){
  const box=$('equippedCustomizationSummary');if(!box)return;const ids=equippedCustomizationIds().filter(id=>ownedCustomization(id)&&STORE_CATALOG[id]);box.innerHTML='';
  if(!ids.length){box.innerHTML='<span>Padrão</span>';return}
  ids.forEach(id=>{const s=document.createElement('span');s.textContent=STORE_CATALOG[id].name;box.appendChild(s)})
}
function mediaConfigForItem(id){
  const item=STORE_CATALOG[id];if(!item)return null;
  if(item.mediaUrl)return{url:item.mediaUrl,kind:item.mediaKind||'gif'};
  if(item.assetKey){const cfg=externalProfileAssets()[item.assetKey]||{};if(cfg.url)return{url:String(cfg.url),kind:cfg.kind||item.mediaKind||'gif'};}
  return null;
}
function applyPublicProfileMedia(style=[]){
  const media=$('publicProfileMedia'),cover=$('publicProfileCover');if(!media||!cover)return;media.innerHTML='';media.className='public-profile-media';cover.style.removeProperty('--profile-cover-image');
  const ids=Array.isArray(style)?style:[];
  for(const id of ids){const cfg=mediaConfigForItem(String(id));if(!cfg?.url)continue;const img=document.createElement('img');img.src=cfg.url;img.alt='';img.loading='lazy';img.decoding='async';img.className=cfg.kind==='sprite'?'profile-media-sprite':'profile-media-gif';media.appendChild(img)}
}
function renderStore(){
  renderDynamicStoreItems();hydrateExternalCustomizationAssets();
  if($('storeBalance'))$('storeBalance').textContent=`₹ ${formatNumber(accountSnapshot().balance)}`;
  const equipped=new Set(equippedCustomizationIds());
  $$('[data-store-item]').forEach(card=>{const id=card.dataset.storeItem;const owned=ownedCustomization(id);const isEquipped=equipped.has(id);card.classList.toggle('owned',owned);card.classList.toggle('equipped',isEquipped);const b=card.querySelector('[data-buy-customization]');if(!b)return;b.textContent=isEquipped?'Equipado':owned?'Equipar':'Comprar';b.classList.toggle('primary',!owned||!isEquipped)});
  renderEquippedCustomizationSummary();applyStoreFilter(currentStoreFilter);
}
async function handleCustomizationButton(btn){const itemId=btn?.dataset?.buyCustomization;if(!itemId)return;try{btn.disabled=true;if(!linkedCharlotte())throw new Error('Vincule a Charlotte primeiro.');if(ownedCustomization(itemId)){await bridgeRequest('equip_customization',{itemId});playGameSfx('select');toast('Personalização equipada.')}else{const r=await bridgeRequest('buy_customization',{itemId},25000);playGameSfx('purchase');setTimeout(()=>playGameSfx('coins'),170);toast(`${STORE_CATALOG[itemId]?.name||'Item'} comprado por ₹${formatNumber(r.price||0)}.`);await requestAccountSync().catch(()=>{})}}catch(e){toast(e.message)}finally{btn.disabled=false}}
$$('[data-buy-customization]').forEach(btn=>btn.addEventListener('click',()=>handleCustomizationButton(btn)));


function pokemonItems(){return state.charlotteSync?.pokemon?.items||{}}
function renderPokemonInventory(){const items=pokemonItems();if($('pokemonBallCount'))$('pokemonBallCount').textContent=formatNumber(items.pokebola||0);if($('pokemonGreatBallCount'))$('pokemonGreatBallCount').textContent=formatNumber(items.greatball||0);if($('pokemonUltraBallCount'))$('pokemonUltraBallCount').textContent=formatNumber(items.ultraball||0);if($('pokemonPremierBallCount'))$('pokemonPremierBallCount').textContent=formatNumber(items.premierball||0);if($('pokemonPotionCount'))$('pokemonPotionCount').textContent=`${formatNumber(items.potion||0)} poção${Number(items.potion||0)===1?'':'ões'}`}
async function usePokemonPotion(monUid){try{const r=await bridgeRequest('pokemon_use_potion',{monUid},20000);toast(`${r.name||'Pokémon'} recuperou ${r.healed||0} HP.`);await requestAccountSync().catch(()=>{})}catch(e){toast(e.message)}}
async function buyPokemonPotion(){const btn=$('pokemonBuyPotionBtn');try{if(btn)btn.disabled=true;if(!linkedCharlotte())throw new Error('Vincule a Charlotte primeiro.');const r=await bridgeRequest('pokemon_buy_potion',{quantity:1},20000);toast(`Poção comprada por ₹${formatNumber(r.total||80)}.`);await requestAccountSync().catch(()=>{})}catch(e){toast(e.message)}finally{if(btn)btn.disabled=false}}
$('pokemonBuyPotionBtn')?.addEventListener('click',buyPokemonPotion);
function renderCollection(){
  const wrap=$('pokemonCollection');if(!wrap)return;const list=state.charlotteSync?.pokemon?.collection||[];wrap.innerHTML='';$('collectionCount').textContent=String(Array.isArray(list)?list.length:Object.keys(list||{}).length);const rows=Array.isArray(list)?list:Object.values(list||{});const draftIds=new Set((state.teamDraft||[]).map(x=>String(x.uid))),items=pokemonItems();renderPokemonInventory();
  if(!rows.length){wrap.innerHTML='<div class="empty-state small">Nenhum Pokémon sincronizado.</div>';return}
  rows.slice(0,160).forEach(m=>{const p=normalizeMon(m);const damaged=Number(p.hp)<Number(p.maxHp),d=document.createElement('div');d.className='collection-mon collection-mon-v5'+(p.fainted?' fainted':'');const img=document.createElement('img');img.src=p.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;img.alt='';img.loading='lazy';img.decoding='async';const c=document.createElement('div');const st=document.createElement('strong');st.textContent=p.name;const sm=document.createElement('small');sm.textContent=`Lv.${p.level} • HP ${Math.max(0,p.hp)}/${p.maxHp}${p.fainted?' • DESMAIADO':''}`;c.append(st,sm);const acts=document.createElement('div');acts.className='collection-actions';const add=document.createElement('button');add.className='mini-btn';add.textContent=draftIds.has(String(p.uid))?'Na equipe':'Equipe';add.disabled=draftIds.has(String(p.uid));add.onclick=()=>addTeamMon(m);acts.appendChild(add);if(damaged){const heal=document.createElement('button');heal.className='mini-btn';heal.textContent='Hospital';heal.onclick=()=>startPokemonHealing(p.uid);acts.appendChild(heal)}if(damaged&&!p.fainted&&Number(items.potion||0)>0){const pot=document.createElement('button');pot.className='mini-btn primary';pot.textContent='Usar poção';pot.onclick=()=>usePokemonPotion(p.uid);acts.appendChild(pot)}d.append(img,c,acts);wrap.appendChild(d)})
}
async function startPokemonHealing(monUid){try{const r=await bridgeRequest('pokemon_heal_start',{monUid},30000);toast(r.alreadyHealing?'Esse Pokémon já está em recuperação.':`Recuperação iniciada: ₹${formatNumber(r.cost||100)}.`);await requestAccountSync().catch(()=>{})}catch(e){toast(e.message)}}
function renderHealingList(){const box=$('pokemonHealingList');if(!box)return;const rows=Object.values(state.pokemonHealing||{});box.innerHTML='';if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhum Pokémon em recuperação.</div>';return}rows.sort((a,b)=>Number(a.readyAt||0)-Number(b.readyAt||0)).forEach(x=>{const d=document.createElement('div');d.className='healing-row';const c=document.createElement('div');const st=document.createElement('strong');st.textContent=x.name||'Pokémon';const sm=document.createElement('small');const left=Math.max(0,Number(x.readyAt||0)-Date.now());const min=Math.ceil(left/60000);sm.textContent=left?`Pronto em ~${min} min`:'Finalizando recuperação...';c.append(st,sm);const pill=document.createElement('span');pill.className='pill';pill.textContent='Hospital';d.append(c,pill);box.appendChild(d)})}
function renderWildEncounter(){
  const box=$('wildStage');if(!box)return;const e=state.pokemonEncounter;
  if(!e||Number(e.expiresAt||0)<Date.now()){
    box.innerHTML='<div class="empty-state small">Explore para encontrar um Pokémon selvagem.</div>';
    if($('wildStatusPill'))$('wildStatusPill').textContent='Pronto';return;
  }
  const logs=Object.values(e.log||{}).sort((a,b)=>Number(a.at||0)-Number(b.at||0));
  const lastLog=logs.at(-1)?.text||'';
  if(e.status==='finished'){
    const resultSoundId=String(e.id||`${e.mon?.uid||e.mon?.id||'wild'}:${e.finishedAt||e.updatedAt||''}:${e.result||''}`);
    if(resultSoundId&&state.pokemonAudio.resultId!==resultSoundId){
      state.pokemonAudio.resultId=resultSoundId;
      if(e.result==='victory'){
        playVictoryTone();
        if(Number(e.reward?.rupias||0)>0)setTimeout(()=>playGameSfx('coins'),220);
      }else if(e.result==='defeat')playDefeatTone();
      else playGameSfx('reject');
    }
    const labels={victory:'Vitória',defeat:'Derrota',escaped:'Você fugiu'};
    $('wildStatusPill').textContent=labels[e.result]||'Encerrado';
    box.innerHTML='';
    const done=document.createElement('div');done.className='wild-finished';
    const h=document.createElement('strong');h.textContent=labels[e.result]||'Encontro encerrado';
    const p=document.createElement('small');p.textContent=lastLog||'A batalha terminou.';
    const again=document.createElement('button');again.className='btn primary';again.type='button';again.textContent='Explorar de novo';again.onclick=()=>$('pokemonExploreBotBtn')?.click();
    done.append(h,p,again);box.appendChild(done);return;
  }
  const wild=normalizeMon(e.mon||{}),mine=normalizeMon(e.player||{});
  const encounterSoundId=String(e.id||`${wild.uid||wild.id}:${e.createdAt||''}`);
  if(encounterSoundId&&state.pokemonAudio.encounterId!==encounterSoundId){state.pokemonAudio.encounterId=encounterSoundId;state.pokemonAudio.resultId='';playPokemonSound('encounter')}
  $('wildStatusPill').textContent='Batalha';box.innerHTML='';
  const stage=document.createElement('div');stage.className='wild-battle-stage';stage.innerHTML=`<div class="wild-mon"><img src="${escText(wild.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wild.id}.png`)}" alt=""><strong>${escText(wild.name)}</strong><div class="pokemon-type-row">${typeBadgesHtml(wild.types)}</div><small>Lv.${wild.level} • HP ${Math.max(0,wild.hp)}/${wild.maxHp}</small></div><div class="wild-vs">VS</div><div class="wild-mon mine"><img src="${escText(mine.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mine.id}.png`)}" alt=""><strong>${escText(mine.name||'Sua equipe')}</strong><div class="pokemon-type-row">${typeBadgesHtml(mine.types)}</div><small>${mine.uid?`HP ${Math.max(0,mine.hp)}/${mine.maxHp}`:'Escolha uma equipe saudável'}</small></div>`;
  const acts=document.createElement('div');acts.className='wild-actions';
  if(mine.uid){(mine.moves.length?mine.moves:[{name:'Ataque rápido'},{name:'Investida'}]).slice(0,4).forEach((m,i)=>{const b=document.createElement('button');b.className='btn';b.textContent=`${m.nome||m.name||`Golpe ${i+1}`} • ${typeLabel(m.type||m.tipo||'normal')}`;b.onclick=async()=>{try{await bridgeRequest('pokemon_wild_move',{moveIndex:i},30000);playPokemonSound('hit')}catch(er){toast(er.message)}};acts.appendChild(b)})}
  ['pokebola','greatball','ultraball',...(Number(pokemonItems().premierball||0)>0?['premierball']:[])].forEach(ball=>{const b=document.createElement('button');b.className=['ultraball','premierball'].includes(ball)?'btn primary':'btn';b.textContent=ball==='pokebola'?'Pokébola':ball==='greatball'?'Great Ball':ball==='ultraball'?'Ultra Ball':'Premier Ball';b.onclick=async()=>{try{playPokemonSound('ball');const r=await bridgeRequest('pokemon_capture',{ball},30000);toast(r.captured?'Pokémon capturado!':`Escapou! Chance ${r.chance||'?'}%.`);if(r.captured){playPokemonSound('capture');await requestAccountSync().catch(()=>{})}}catch(er){toast(er.message)}};acts.appendChild(b)});
  const flee=document.createElement('button');flee.className='btn danger-ghost';flee.type='button';flee.textContent='Fugir';flee.onclick=async()=>{try{await bridgeRequest('pokemon_wild_exit',{},20000);toast('Você saiu da batalha.')}catch(er){toast(er.message)}};acts.appendChild(flee);
  box.append(stage,acts);
}



function raidTimeLeft(raid){const ms=Math.max(0,Number(raid?.expiresAt||0)-Date.now());const min=Math.floor(ms/60000),sec=Math.floor((ms%60000)/1000);return `${min}:${String(sec).padStart(2,'0')}`}
function renderSiteRaid(){
  const box=$('siteRaidStage');if(!box)return;const raid=state.siteRaid,cfg=state.siteRaidConfig||{};
  if($('siteRaidAutoToggle'))$('siteRaidAutoToggle').checked=Boolean(cfg.auto);
  if($('raidWhatsappNotify'))$('raidWhatsappNotify').checked=Boolean(state.profile?.raidWhatsappNotify);
  if($('siteRaidAdmin'))$('siteRaidAdmin').hidden=!isSiteAdmin();
  if(!raid||raid.status!=='active'||Number(raid.expiresAt||0)<=Date.now()){$('siteRaidStatus').textContent='Aguardando';box.innerHTML='<div class="empty-state small">Nenhuma raid ativa. O modo automático pode iniciar uma nova raid a cada hora.</div>';return}
  $('siteRaidStatus').textContent=`Tier ${raid.tier||1}`;
  const boss=normalizeMon(raid.boss||{}),max=Math.max(1,Number(raid.maxHp||boss.maxHp||1)),hp=Math.max(0,Number(raid.hp||0)),pct=Math.max(0,Math.min(100,hp/max*100));const mine=raid.participants?.[state.user?.uid]||{};
  box.innerHTML=`<div class="site-raid-boss"><img src="${escText(boss.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${boss.id}.png`)}" alt=""><div class="site-raid-copy"><strong>${escText(boss.name)}</strong><div class="pokemon-type-row">${typeBadgesHtml(boss.types)}</div><small>Lv.${boss.level} • termina em ${raidTimeLeft(raid)}</small><div class="hpbar raid-hp"><i style="width:${pct}%"></i></div><b>${formatNumber(hp)} / ${formatNumber(max)} HP</b><small>Seu dano: ${formatNumber(mine.damage||0)} • ${Object.keys(raid.participants||{}).length} participante(s)</small></div></div>`;
  const acts=document.createElement('div');acts.className='site-raid-actions';const team=(state.charlotteSync?.pokemon?.team||[]).map(normalizeMon),active=team.find(x=>x.hp>0&&!x.fainted)||team[0];const moves=active?.moves?.length?active.moves:[{name:'Ataque rápido',power:40,type:'normal'}];
  if(!linkedCharlotte()){const b=document.createElement('button');b.className='btn primary';b.textContent='Vincular Charlotte para atacar';b.onclick=()=>navigate('charlotte');acts.appendChild(b)}else moves.slice(0,4).forEach((m,i)=>{const b=document.createElement('button');b.className='btn'+(i===0?' primary':'');b.innerHTML=`<b>${escText(m.nome||m.name||`Golpe ${i+1}`)}</b><small>${escText(typeLabel(m.type||m.tipo||'normal'))} • ${Number(m.power||m.poder||0)}</small>`;b.onclick=async()=>{try{playGameSfx('select');b.disabled=true;const r=await bridgeRequest('site_raid_attack',{moveIndex:i},30000);if(r?.damage){playPokemonSound('hit');toast(`Ataque: ${r.damage} de dano${r.effectText?' • '+r.effectText:''}`)}}catch(e){toast(e.message)}finally{setTimeout(()=>b.disabled=false,1200)}};acts.appendChild(b)});
  box.appendChild(acts);
}
$('siteRaidStartBtn')?.addEventListener('click',async()=>{try{await bridgeRequest('site_raid_start',{},30000,false);toast('Raid iniciada.')}catch(e){toast(e.message)}});
$('siteRaidAutoToggle')?.addEventListener('change',async e=>{try{await bridgeRequest('site_raid_auto',{enabled:e.target.checked},20000,false);toast(e.target.checked?'Raids automáticas ativadas.':'Raids automáticas desativadas.')}catch(err){e.target.checked=!e.target.checked;toast(err.message)}});
async function saveRaidNotifyPreference(enabled){if(!state.user)return;const payload={...(state.profile||{}),uid:state.user.uid,email:state.user.email||state.profile?.email||'',raidWhatsappNotify:Boolean(enabled),updatedAt:nowIso()};await set(ref(db,`profiles/${state.user.uid}`),payload);state.profile=payload;renderAccount()}
$('raidWhatsappNotify')?.addEventListener('change',e=>saveRaidNotifyPreference(e.target.checked).then(()=>toast('Preferência de raid salva.')).catch(err=>toast(permissionMessage(err))));
$('profileRaidWhatsapp')?.addEventListener('change',e=>{if($('raidWhatsappNotify'))$('raidWhatsappNotify').checked=e.target.checked});
setInterval(()=>{if(state.siteRaid?.status==='active')renderSiteRaid()},1000);

// Perfis públicos
let currentPublicProfile=null;
function applyPublicProfileStyle(style=[]){
  const card=$('publicProfileCard');if(!card)return;Object.values(STORE_CATALOG).forEach(x=>card.classList.remove(x.className));const ids=Array.isArray(style)?style:[];ids.forEach(id=>{const item=STORE_CATALOG[String(id)];if(item)card.classList.add(item.className)});applyPublicProfileMedia(ids);if($('publicProfileStyle'))$('publicProfileStyle').textContent=ids.filter(id=>STORE_CATALOG[id]).map(id=>STORE_CATALOG[id].name).join(' • ')||'Padrão'
}
async function openPublicProfile(uid,fallback={}){
  if(!uid)return;let p=fallback;try{const sn=await get(ref(db,`directory/${uid}`));if(sn.exists())p=sn.val()}catch{}currentPublicProfile={uid,...p};$('publicProfileAvatar').src=p.avatar||DEFAULT_AVATAR;$('publicProfileName').textContent=p.nome||'Usuário';if($('publicProfileUsername'))$('publicProfileUsername').textContent=p.username?`@${normalizeUsername(p.username)}`:'@sem_usuario';$('publicProfileBio').textContent=p.bio||'Sem bio ainda.';$('publicProfileAnime').textContent=p.favoriteAnime||'—';$('publicProfileSince').textContent=p.createdAt?shortDate(p.createdAt):'—';const isSelf=uid===state.user?.uid,isFriend=!!state.friends?.[uid];if($('publicProfileRelation'))$('publicProfileRelation').textContent=isSelf?'Seu perfil':isFriend?'Amigo':'Visitante';applyPublicProfileStyle(p.style||[]);const btn=$('publicProfileActionBtn');btn.textContent=isSelf?'Seu perfil':isFriend?'Amigo':'Adicionar amigo';btn.disabled=isFriend||isSelf;$('publicProfileDuelBtn').disabled=!isFriend||isSelf;openModal('publicProfileModal');renderPublicBadge(uid)
}
$('publicProfileActionBtn')?.addEventListener('click',()=>{if(currentPublicProfile)sendFriendRequest(currentPublicProfile.uid,currentPublicProfile)});
$('publicProfileDuelBtn')?.addEventListener('click',()=>{if(!currentPublicProfile)return;closeModal('publicProfileModal');navigate('pokemon');$('duelFriendSelect').value=currentPublicProfile.uid;setTimeout(()=>$('sendDuelChallengeBtn')?.scrollIntoView({behavior:'smooth',block:'center'}),80)});
$('publicProfileReportBtn')?.addEventListener('click',()=>{if(!currentPublicProfile)return;closeModal('publicProfileModal');openModal('reportModal')});

function burstConfetti(){
  const root=document.createElement('div');root.className='confetti-root';
  for(let i=0;i<34;i++){const bit=document.createElement('i');bit.className='confetti-piece';bit.style.setProperty('--x',`${Math.random()*100}%`);bit.style.setProperty('--delay',`${Math.random()*.45}s`);bit.style.setProperty('--spin',`${Math.round(Math.random()*720+180)}deg`);bit.style.setProperty('--dur',`${1.2+Math.random()*.9}s`);bit.style.background=`hsl(${Math.floor(Math.random()*360)} 78% 62%)`;root.appendChild(bit)}
  document.body.appendChild(root);setTimeout(()=>root.remove(),2600)
}
function showGameResult({title='Partida encerrada',text='',win=false,neutral=false,icon='★'}={}){
  if($('gameResultTitle'))$('gameResultTitle').textContent=title;if($('gameResultText'))$('gameResultText').textContent=text;if($('gameResultIcon'))$('gameResultIcon').textContent=icon;openModal('gameResultModal');if(win){burstConfetti();playVictoryTone()}else if(neutral){playGameSfx('draw')}else{playDefeatTone()}
}

// Jogos PvP do site: convites, partidas e jogadas ficam no Firebase do próprio site.
// A Charlotte NÃO participa de convites/turnos/resultados. Ela continua sendo usada somente onde há Rupias.
function renderGameFriendSelect(selectId){const sel=$(selectId);if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">Escolha um amigo</option>';Object.values(state.friends||{}).forEach(f=>{const o=document.createElement('option');o.value=f.uid;o.textContent=f.nome||'Usuário';sel.appendChild(o)});if(state.friends[cur])sel.value=cur}
function renderTttFriendSelect(){renderGameFriendSelect('tttFriendSelect')}
function renderGameFriendSelects(){renderTttFriendSelect();renderGameFriendSelect('blackjackFriendSelect');renderGameFriendSelect('hangmanFriendSelect')}
const SITE_GAME_META={
  ttt:{label:'Jogo da Velha',icon:'◯',inviteBox:'tttInvites',games:'ticTacToeGames',index:'ticTacToeIndex'},
  blackjack:{label:'21',icon:'21',inviteBox:'blackjackInvites',games:'blackjackGames',index:'blackjackIndex'},
  hangman:{label:'Forca',icon:'A',inviteBox:'hangmanInvites',games:'hangmanGames',index:'hangmanIndex'}
};
function gameRows(obj){return Object.entries(obj||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0))}
function siteGameName(uid){return state.directory?.[uid]?.nome||state.friends?.[uid]?.nome||(uid===state.user?.uid?displayName():'Jogador')}
async function sendSiteGameChallenge(type,targetUid){
  if(!state.user)throw new Error('Entre na sua conta.');if(!SITE_GAME_META[type])throw new Error('Jogo inválido.');if(!targetUid||targetUid===state.user.uid)throw new Error('Escolha um amigo válido.');if(!state.friends?.[targetUid])throw new Error('Esse usuário precisa estar na sua lista de amigos.');
  const challengeRef=push(ref(db,`siteGameChallenges/${targetUid}`));
  await set(challengeRef,{id:challengeRef.key,type,fromUid:state.user.uid,fromName:displayName(),createdAt:Date.now()});
  toast(`Convite de ${SITE_GAME_META[type].label} enviado pelo site.`);
}
async function rejectSiteGameChallenge(id){if(!state.user||!id)return;await remove(ref(db,`siteGameChallenges/${state.user.uid}/${id}`));playGameSfx('reject');toast('Convite recusado.')}
function challengeRow(ch){
  const row=document.createElement('div');row.className='person-row game-invite-row';
  const copy=document.createElement('div');copy.className='person-copy';copy.innerHTML=`<strong>${escText(ch.fromName||'Amigo')}</strong><small>desafiou você para ${escText(SITE_GAME_META[ch.type]?.label||'uma partida')}</small>`;
  const acts=document.createElement('div');acts.className='person-actions';
  const yes=document.createElement('button');yes.type='button';yes.className='btn primary';yes.textContent='Aceitar';yes.onclick=async()=>{try{yes.disabled=true;await acceptSiteGameChallenge(ch)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível aceitar.'))}finally{yes.disabled=false}};
  const no=document.createElement('button');no.type='button';no.className='btn';no.textContent='Recusar';no.onclick=()=>rejectSiteGameChallenge(ch.id).catch(e=>toast(permissionMessage(e)));
  acts.append(yes,no);row.append(copy,acts);return row
}
function renderSiteGameChallenges(){
  // Convites agora ficam centralizados no sininho > Amigos.
  Object.values(SITE_GAME_META).forEach(m=>{const box=$(m.inviteBox);if(box){box.innerHTML='';box.hidden=true}});
  const rows=Object.values(state.siteGameChallenges||{}).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const fresh=rows.filter(ch=>ch?.id&&!state.siteGameChallengeSeen.has(ch.id));
  rows.forEach(ch=>{if(ch?.id)state.siteGameChallengeSeen.add(ch.id)});
  renderNotifications();
  if(fresh.length){
    const last=fresh[0],label=SITE_GAME_META[last.type]?.label||'jogo';
    const notice={id:`game_${last.id}`,type:'game_challenge',gameType:last.type,challengeId:last.id,title:`Convite para ${label}`,text:`${last.fromName||'Um amigo'} desafiou você para ${label}.`,link:'#friends',createdAt:Number(last.createdAt||Date.now())};
    toast(`${last.fromName||'Um amigo'} desafiou você para ${label}. Abra o sininho em Amigos.`,5200);playNotificationTone();showBrowserNotification(notice)
  }
}
function cryptoShuffle(items){const a=[...items];const bytes=new Uint32Array(Math.max(1,a.length));crypto.getRandomValues(bytes);for(let i=a.length-1;i>0;i--){const j=bytes[i%bytes.length]%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function randomPlayer(a,b){const x=new Uint8Array(1);crypto.getRandomValues(x);return x[0]%2===0?a:b}
function appendGameLog(game,text){const k=`${Date.now()}_${Math.random().toString(36).slice(2,7)}`;game.log={...(game.log||{}),[k]:{text,at:Date.now()}}}
function tttWinner(board){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,b,c] of lines)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return''}
function buildBlackjackDeck(){const suits=['♠','♥','♦','♣'],ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];return cryptoShuffle(suits.flatMap(s=>ranks.map(r=>({r,s}))))}
function blackjackScore(cards=[]){let total=0,aces=0;for(const c of cards){if(c.r==='A'){total+=11;aces++}else if(['J','Q','K'].includes(c.r))total+=10;else total+=Number(c.r||0)}while(total>21&&aces>0){total-=10;aces--}return total}
const HANGMAN_WORDS=['CHARLOTTE','POKEMON','GREMORY','AVENTURA','AMIZADE','DRAGAO','GALAXIA','MISTERIO','FANTASIA','ESPADA','CASTELO','MAGIA','VIAGEM','TESOURO','HEROINA','GUERREIRO','VITORIA','DESAFIO','ESTRELA','IMPERIO'];
function pickHangmanWord(){const b=new Uint32Array(1);crypto.getRandomValues(b);return HANGMAN_WORDS[b[0]%HANGMAN_WORDS.length]}
function hangmanMask(answer,guessed={}){return [...answer].map(ch=>ch===' '?' ':guessed[ch]?ch:'_').join('')}
async function createSiteGame(type,opponentUid){
  const meta=SITE_GAME_META[type];if(!meta||!state.user)throw new Error('Jogo inválido.');const me=state.user.uid,other=opponentUid;if(!state.friends?.[other])throw new Error('A amizade não está mais ativa.');const gameRef=push(ref(db,meta.games)),gameId=gameRef.key,createdAt=Date.now(),first=randomPlayer(me,other),meName=displayName(),otherName=siteGameName(other);let game;
  if(type==='ttt'){
    const x=randomPlayer(me,other),o=x===me?other:me;game={id:gameId,type,status:'active',createdAt,updatedAt:createdAt,createdBy:me,turnUid:x,board:['','','','','','','','',''],players:{[x]:{uid:x,name:x===me?meName:otherName,symbol:'X'},[o]:{uid:o,name:o===me?meName:otherName,symbol:'O'}},log:{}};appendGameLog(game,'Partida iniciada pelo site.');
  }else if(type==='blackjack'){
    const deck=buildBlackjackDeck(),cardsA=[deck.pop(),deck.pop()],cardsB=[deck.pop(),deck.pop()];game={id:gameId,type,status:'active',createdAt,updatedAt:createdAt,createdBy:me,turnUid:first,deck,players:{[me]:{uid:me,name:meName,cards:cardsA,score:blackjackScore(cardsA),stood:false,busted:false},[other]:{uid:other,name:otherName,cards:cardsB,score:blackjackScore(cardsB),stood:false,busted:false}},log:{}};appendGameLog(game,'As cartas foram distribuídas.');
  }else{
    const answer=pickHangmanWord();game={id:gameId,type,status:'active',createdAt,updatedAt:createdAt,createdBy:me,turnUid:first,answer,mask:hangmanMask(answer,{}),guessed:{},misses:[],maxMisses:6,players:{[me]:{uid:me,name:meName,score:0},[other]:{uid:other,name:otherName,score:0}},log:{}};appendGameLog(game,'A palavra secreta foi escolhida pelo site.');
  }
  const idx={id:gameId,type,status:'active',createdAt,updatedAt:createdAt,createdBy:me,opponentUid:other};
  const updates={};updates[`${meta.games}/${gameId}`]=game;updates[`${meta.index}/${me}/${gameId}`]=idx;updates[`${meta.index}/${other}/${gameId}`]={...idx,opponentUid:me};await update(ref(db),updates);return gameId
}
async function acceptSiteGameChallenge(ch){if(!state.user||!ch?.id||!ch?.fromUid)throw new Error('Convite inválido.');await createSiteGame(ch.type,ch.fromUid);await remove(ref(db,`siteGameChallenges/${state.user.uid}/${ch.id}`));playGameSfx('accept');toast(`${SITE_GAME_META[ch.type]?.label||'Partida'} iniciada.`)}
async function finishIndexes(type,game){if(!game?.id)return;const meta=SITE_GAME_META[type];if(!meta)return;const updates={};const now=Number(game.updatedAt||game.finishedAt||Date.now());for(const uid of Object.keys(game.players||{})){const base=`${meta.index}/${uid}/${game.id}`;updates[`${base}/status`]=game.status||'finished';updates[`${base}/updatedAt`]=now;updates[`${base}/finishedAt`]=Number(game.finishedAt||now);if(game.winnerUid!=null)updates[`${base}/winnerUid`]=game.winnerUid;if(game.finishReason)updates[`${base}/finishReason`]=game.finishReason;if(game.leftUid)updates[`${base}/leftUid`]=game.leftUid}try{await update(ref(db),updates)}catch(e){console.warn('[GAME EXIT] Não foi possível sincronizar os índices:',e?.message||e)}}
function applyFinishedGameLocally(type,game){if(!game?.id)return;if(type==='ttt'&&state.ttt.game?.id===game.id)setTttGame(game);else if(type==='blackjack'&&state.blackjack.game?.id===game.id)setBlackjackGame(game);else if(type==='hangman'&&state.hangman.game?.id===game.id)setHangmanGame(game)}
async function directGameExit(type,game){if(!state.user||!game?.id)return;const meta=SITE_GAME_META[type],uid=state.user.uid;if(!meta)throw new Error('Jogo inválido.');let failReason='';const gameRef=ref(db,`${meta.games}/${game.id}`);const tx=await runTransaction(gameRef,g=>{if(!g){failReason='Partida não encontrada.';return}if(!g.players?.[uid]){failReason='Você não participa desta partida.';return}if(g.status!=='active'){failReason='Partida já encerrada.';return}const other=Object.keys(g.players).find(x=>x!==uid)||null,now=Date.now();g.status='finished';g.winnerUid=other;g.leftUid=uid;g.finishReason='exit';g.finishedAt=now;g.updatedAt=now;g.turnUid=null;appendGameLog(g,`${g.players[uid]?.name||'Jogador'} saiu da partida. ${other?`${g.players[other]?.name||'Adversário'} venceu por desistência.`:'Partida encerrada.'}`);return g});if(!tx.committed){const current=await get(gameRef).catch(()=>null);if(current?.exists()){const value={id:game.id,...current.val()};if(value.status!=='active'){applyFinishedGameLocally(type,value);return value}}throw new Error(failReason||'Não foi possível encerrar a partida.')}const final={id:game.id,...tx.snapshot.val()};await finishIndexes(type,final);applyFinishedGameLocally(type,final);toast('Você saiu. A partida foi encerrada para os dois jogadores.');return final}

$('tttCreateBtn')?.addEventListener('click',async()=>{const targetUid=$('tttFriendSelect')?.value;if(!targetUid)return toast('Escolha um amigo.');playGameSfx('select');try{await sendSiteGameChallenge('ttt',targetUid)}catch(e){toast(permissionMessage(e,e.message))}});
function handleTttIndex(obj){const rows=gameRows(obj),active=rows.find(x=>x.status==='active');if(active){if(state.ttt.game?.id!==active.id)subscribeTtt(active.id);return}const finished=rows.find(x=>x.status==='finished');if(finished&&state.ttt.game?.id!==finished.id)subscribeTtt(finished.id);else if(!finished)setTttGame(null)}
function subscribeTtt(id){if(state.ttt.unsub){try{state.ttt.unsub()}catch{}}state.ttt.unsub=onValue(ref(db,`ticTacToeGames/${id}`),sn=>setTttGame(sn.exists()?{id,...sn.val()}:null))}
function setTttGame(g){
  const prev=state.ttt.game;
  if(g?.status==='active'){
    if(!prev||prev.id!==g.id){playGameSfx('start');if(g.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),180)}
    else if(prev.status==='active'){
      const before=Array.isArray(prev.board)?prev.board:Array.from({length:9},(_,i)=>prev.board?.[i]||'');
      const after=Array.isArray(g.board)?g.board:Array.from({length:9},(_,i)=>g.board?.[i]||'');
      if(after.some((v,i)=>v&&v!==before[i]))playGameSfx('move');
      if(prev.turnUid!==g.turnUid&&g.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),90);
    }
  }
  state.ttt.game=g;const panel=$('tttGamePanel');
  if(!g||g.status!=='active'){
    if(panel)panel.hidden=true;
    const uid=state.user?.uid,exit=!!g&&g.finishReason==='exit'&&!!g.leftUid,iLeft=exit&&g.leftUid===uid,won=!!g&&g.winnerUid===uid,draw=!!g&&!g.winnerUid&&!exit;
    const leftName=exit?(g.players?.[g.leftUid]?.name||'O adversário'):'';
    if($('tttStatus'))$('tttStatus').textContent=exit?(iLeft?'Você saiu':'Vitória por desistência'):won?'Você venceu':g?(draw?'Empate':'Encerrada'):'Livre';
    if(g?.status==='finished'&&g.id&&state.ttt.seenActiveIds.has(g.id)){
      state.ttt.seenActiveIds.delete(g.id);state.ttt.lastResultId=g.id;if(state.user)localStorage.setItem(`gremory:tttSeen:${state.user.uid}`,g.id);
      if(exit)showGameResult({title:iLeft?'Você saiu da partida':'Vitória por desistência!',text:iLeft?'A partida foi encerrada para os dois jogadores. Seu adversário venceu por desistência.':`${leftName} saiu da partida. Você venceu por desistência.`,win:!iLeft,neutral:false,icon:iLeft?'↩':'✦'});
      else showGameResult({title:draw?'Empate!':won?'Vitória!':'Partida encerrada',text:draw?'Ninguém venceu essa rodada.':won?'Você venceu esta rodada.':'Seu amigo venceu esta rodada.',win:won,neutral:draw,icon:draw?'＝':won?'✦':'✕'});
    }
    return;
  }
  state.ttt.seenActiveIds.add(g.id);if(panel)panel.hidden=false;$('tttStatus').textContent=g.turnUid===state.user?.uid?'Sua vez':'Vez do amigo';renderTtt(g)
}
function renderTtt(g){const me=g.players?.[state.user.uid],other=Object.values(g.players||{}).find(x=>x.uid!==state.user.uid);$('tttTitle').textContent=`${me?.name||'Você'} × ${other?.name||'Amigo'}`;$('tttTurnText').textContent=g.turnUid===state.user.uid?`Sua vez • você é ${me?.symbol||'X'}`:`Vez de ${other?.name||'amigo'}`;const board=$('tttBoard');board.innerHTML='';const cells=Array.isArray(g.board)?g.board:Array.from({length:9},(_,i)=>g.board?.[i]||'');cells.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.className='ttt-cell';b.textContent=v||'';b.disabled=!!v||g.turnUid!==state.user.uid||g.status!=='active';b.onclick=()=>{playGameSfx('select');directTttMove(g.id,i).catch(e=>toast(permissionMessage(e,e.message)))};board.appendChild(b)});const log=$('tttLog');log.innerHTML=Object.values(g.log||{}).slice(-8).reverse().map(x=>`<div>${escText(x.text||'')}</div>`).join('')||'<div>Partida iniciada.</div>'}
async function directTttMove(gameId,index){const uid=state.user?.uid;if(!uid)return;let reason='';const tx=await runTransaction(ref(db,`ticTacToeGames/${gameId}`),g=>{if(!g||g.status!=='active'){reason='Partida encerrada.';return}if(g.turnUid!==uid){reason='Aguarde sua vez.';return}const board=Array.isArray(g.board)?[...g.board]:Array.from({length:9},(_,i)=>g.board?.[i]||'');if(board[index]){reason='Essa casa já foi usada.';return}const me=g.players?.[uid],other=Object.keys(g.players||{}).find(x=>x!==uid);board[index]=me?.symbol||'X';g.board=board;g.updatedAt=Date.now();appendGameLog(g,`${me?.name||'Jogador'} marcou ${me?.symbol||'X'}.`);const win=tttWinner(board);if(win){g.status='finished';g.winnerUid=uid;g.finishedAt=Date.now()}else if(board.every(Boolean)){g.status='finished';g.winnerUid=null;g.finishedAt=Date.now()}else g.turnUid=other;return g});if(!tx.committed){if(reason)throw new Error(reason);return}const final={id:gameId,...tx.snapshot.val()};if(final.status==='finished')await finishIndexes('ttt',final)}
$('tttExitBtn')?.addEventListener('click',async()=>{if(!state.ttt.game)return;playGameSfx('reject');try{await directGameExit('ttt',state.ttt.game)}catch(e){toast(permissionMessage(e,e.message))}});

// Watch Party independente do RPG
$('watchCreateBtn')?.addEventListener('click',()=>openModal('watchCreateModal'));
$('watchRefreshBtn')?.addEventListener('click',loadWatchRooms);
$('watchJoinForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const code=$('watchJoinCode').value.trim().toUpperCase();if(code)await joinWatchRoom(code)});
$('watchCreateForm')?.addEventListener('submit',createWatchRoom);
$('watchBackBtn')?.addEventListener('click',()=>closeWatchRoom(false));
$('watchExitBtn')?.addEventListener('click',exitWatchRoom);
$('watchCopyBtn')?.addEventListener('click',()=>{const code=state.watchCode||'';if(!code)return;const invite=`${location.origin}${location.pathname}?watch=${encodeURIComponent(code)}#watch`;navigator.clipboard?.writeText(invite).then(()=>toast('Link de convite copiado.')).catch(()=>toast(`Código da sala: ${code}`))});
$('watchMediaForm')?.addEventListener('submit',setWatchMedia);
$('watchPlayBtn')?.addEventListener('click',toggleWatchPlayback);
$('watchSyncBtn')?.addEventListener('click',syncWatchPlayer);
$('watchLocalFileBtn')?.addEventListener('click',()=>{if(!isWatchHost())return toast('Somente o host pode transmitir um arquivo.');$('watchLocalFileInput')?.click()});
$('watchLocalFileInput')?.addEventListener('change',async ev=>{const file=ev.target.files?.[0];ev.target.value='';if(file)await startWatchLocalFile(file)});
async function uniqueWatchCode(){for(let i=0;i<8;i++){const c=randomCode();const sn=await get(ref(db,`watchRooms/${c}`));if(!sn.exists())return c}throw new Error('Não foi possível gerar código.')}
async function createWatchRoom(ev){ev.preventDefault();if(!state.user)return;try{const code=await uniqueWatchCode(),createdAt=nowIso(),name=$('watchNameInput').value.trim()||'Watch Party';const room={meta:{code,name,ownerUid:state.user.uid,createdAt},members:{[state.user.uid]:{uid:state.user.uid,name:displayName(),avatar:avatarFor(),role:'Host',joinedAt:createdAt}},media:{url:'',type:'',playing:false,position:0,updatedAt:Date.now()}};await set(ref(db,`watchRooms/${code}`),room);await set(ref(db,`watchUserRooms/${state.user.uid}/${code}`),{code,name,role:'Host',joinedAt:createdAt});closeModal('watchCreateModal');$('watchCreateForm').reset();await openWatchRoom(code)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível criar a sala.'),6000)}}
async function loadWatchRooms(){if(!state.user)return;const box=$('watchRoomsList');box.innerHTML='<div class="loading-line">Carregando...</div>';try{const sn=await get(ref(db,`watchUserRooms/${state.user.uid}`));box.innerHTML='';const rows=sn.exists()?Object.values(sn.val()):[];$('homeWatchRecent').textContent=rows.length?`${rows.length} sala${rows.length===1?'':'s'}`:'Assistir e conversar';if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhuma sala.</div>';return}rows.forEach(r=>{const item=document.createElement('div');item.className='room-item';const c=document.createElement('div');c.innerHTML=`<strong>${escText(r.name||r.code)}</strong><small>${escText(r.code)} • ${escText(r.role||'Participante')}</small>`;const acts=document.createElement('div');acts.className='room-item-actions';const b=document.createElement('button');b.className='btn';b.textContent='Entrar';b.onclick=()=>openWatchRoom(r.code);acts.appendChild(b);if(r.role==='Host'){const del=document.createElement('button');del.className='btn danger-ghost';del.textContent='Apagar';del.onclick=()=>deleteWatchRoom(r.code,r.name);acts.appendChild(del)}item.append(c,acts);box.appendChild(item)})}catch(e){box.innerHTML=`<div class="empty-state small">${permissionMessage(e)}</div>`}}
async function joinWatchRoom(code){if(!state.user)return;try{const sn=await get(ref(db,`watchRooms/${code}`));if(!sn.exists())throw new Error('Sala não encontrada.');const room=sn.val(),member={uid:state.user.uid,name:displayName(),avatar:avatarFor(),role:room.meta?.ownerUid===state.user.uid?'Host':'Participante',joinedAt:nowIso()};await set(ref(db,`watchRooms/${code}/members/${state.user.uid}`),member);await set(ref(db,`watchUserRooms/${state.user.uid}/${code}`),{code,name:room.meta?.name||code,role:member.role,joinedAt:nowIso()});$('watchJoinCode').value='';await openWatchRoom(code)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível entrar.'))}}
async function openWatchRoom(code){if(state.watchCode&&state.watchCode!==code)await leaveWatchVoice(true);clearUnsubs(state.watchUnsubs);state.watchCode=code;$('watchLobby').hidden=true;$('watchRoom').hidden=false;if($('watchCreateBtn'))$('watchCreateBtn').hidden=true;state.watchUnsubs.push(onValue(ref(db,`watchRooms/${code}`),sn=>{if(!sn.exists()){toast('Essa sala não existe mais.');closeWatchRoom(false);return}state.watchRoom=sn.val();renderWatchRoom()}));navigate('watch')}
function isWatchHost(){return !!state.user&&state.watchRoom?.meta?.ownerUid===state.user.uid}
function renderWatchRoom(){
  const r=state.watchRoom||{},m=r.meta||{};$('watchRoomName').textContent=m.name||'Watch Party';$('watchCode').textContent=state.watchCode||'------';$('watchHostPill').textContent=isWatchHost()?'Host':'Participante';$('watchMemberCount').textContent=String(Object.keys(r.members||{}).length);
  const list=$('watchMemberList');list.innerHTML='';Object.values(r.members||{}).forEach(x=>{const d=document.createElement('div');d.className='member-item watch-member-item';const img=document.createElement('img');img.src=x.avatar||DEFAULT_AVATAR;const c=document.createElement('div');c.innerHTML=`<strong>${escText(x.name||'Usuário')}</strong><small>${escText(x.role||'Participante')}</small>`;d.append(img,c);list.appendChild(d)});
  $('watchMediaInput').disabled=!isWatchHost();$('watchMediaForm').querySelector('button').disabled=!isWatchHost();$('watchPlayBtn').disabled=!isWatchHost();if($('watchLocalFileBtn'))$('watchLocalFileBtn').disabled=!isWatchHost();if($('watchMusicSkipBtn'))$('watchMusicSkipBtn').disabled=!isWatchHost();
  renderWatchMedia(r.media||{});renderWatchMusic(r.musicQueue||{},r.musicAccess||{},r.musicPlan||{},r.musicPlayback||{});watchVoiceUi();if(!state.watchRtc.joined)ensureWatchRtcSession().catch(()=>{})
}
function youtubeEmbed(url,viewerLocked=false){
  try{
    const u=new URL(url);let id='';
    if(u.hostname.includes('youtu.be'))id=u.pathname.slice(1).split('/')[0];
    else if(u.hostname.includes('youtube.com')){
      if(u.pathname.startsWith('/shorts/'))id=u.pathname.split('/shorts/')[1]?.split('/')[0]||'';
      else if(u.pathname.startsWith('/embed/'))id=u.pathname.split('/embed/')[1]?.split('/')[0]||'';
      else id=u.searchParams.get('v')||'';
    }
    if(!id)return'';
    const origin=encodeURIComponent(location.origin);
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?enablejsapi=1&playsinline=1&origin=${origin}&rel=0${viewerLocked?'&controls=0&disablekb=1':''}`;
  }catch{return''}
}
function googleDriveFileId(url){
  try{
    const u=new URL(url);if(!/(^|\.)drive\.google\.com$/i.test(u.hostname))return'';
    const byPath=u.pathname.match(/\/file\/d\/([^/]+)/i)?.[1];
    const id=byPath||u.searchParams.get('id')||'';return /^[a-zA-Z0-9_-]{10,200}$/.test(id)?id:'';
  }catch{return''}
}
function googleDriveEmbed(url){const id=googleDriveFileId(url);if(!id)return '';const key=new URL(url).searchParams.get('resourcekey');return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview${key?'?resourcekey='+encodeURIComponent(key):''}`}
function googleDriveDirect(url){
  const id=googleDriveFileId(url);if(!id)return '';
  try{const key=new URL(url).searchParams.get('resourcekey')||'';return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t${key?'&resourcekey='+encodeURIComponent(key):''}`}catch{return''}
}
function watchMediaPosition(media={}){return Number(media.position||0)+(media.playing?Math.max(0,(Date.now()-Number(media.updatedAt||Date.now()))/1000):0)}
function youtubeCommand(iframe,func,args=[]){try{iframe?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}}
function startYoutubeListening(iframe){
  if(!iframe?.contentWindow)return;
  try{iframe.contentWindow.postMessage(JSON.stringify({event:'listening',id:'gremory-watch'}),'*')}catch{}
  youtubeCommand(iframe,'addEventListener',['onStateChange']);
  youtubeCommand(iframe,'addEventListener',['onReady']);
}
function applyYoutubeWatchState(iframe,media={}){
  const target=watchMediaPosition(media);state.watchApplying=true;
  youtubeCommand(iframe,'seekTo',[target,true]);youtubeCommand(iframe,media.playing?'playVideo':'pauseVideo',[]);
  setTimeout(()=>{state.watchApplying=false},700)
}
async function publishYoutubeStateFromEvent(playing){
  if(!isWatchHost()||state.watchApplying||!state.watchCode)return;
  const now=Date.now();if(now-state.watchYoutube.lastPublishAt<220)return;state.watchYoutube.lastPublishAt=now;
  const media=state.watchRoom?.media||{};
  let position=Number(state.watchYoutube.lastTime||0);if(!Number.isFinite(position)||position<0)position=watchMediaPosition(media);
  await update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:!!playing,position,updatedAt:Date.now()}).catch(()=>{});
}
window.addEventListener('message',ev=>{
  if(!/^https:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)$/i.test(String(ev.origin||'')))return;
  let data=ev.data;try{if(typeof data==='string')data=JSON.parse(data)}catch{return}if(!data||typeof data!=='object')return;

  const musicFrame=watchMusicEngine();
  if(musicFrame&&ev.source===musicFrame.contentWindow){
    if(data.event==='onReady'){state.watchMusic.engineReady=true;syncWatchMusicClock(true)}
    if(data.event==='infoDelivery'&&data.info&&Number.isFinite(Number(data.info.currentTime)))state.watchMusic.currentTime=Number(data.info.currentTime);
    if(data.event==='onStateChange'){
      const code=Number(data.info);
      if(code===0){
        const current=currentWatchMusic();
        if(current){state.watchMusic.endedId=current.id;musicYoutubeCommand('stopVideo',[]);autoAdvanceWatchMusic(current.id)}
      }else if(code===1){state.watchMusic.endedId='';applyLocalMusicVolume()}
    }
    return;
  }

  const iframe=$('watchMediaStage')?.querySelector('iframe[data-watch-youtube="1"]');if(!iframe||ev.source!==iframe.contentWindow)return;
  if(data.event==='infoDelivery'&&data.info&&typeof data.info==='object'){
    if(Number.isFinite(Number(data.info.currentTime)))state.watchYoutube.lastTime=Number(data.info.currentTime);
    if(Number.isFinite(Number(data.info.playerState)))state.watchYoutube.lastState=Number(data.info.playerState);
  }
  if(data.event==='onStateChange'){
    const code=Number(data.info);state.watchYoutube.lastState=code;
    if(code===1)publishYoutubeStateFromEvent(true);
    else if(code===0||code===2)publishYoutubeStateFromEvent(false);
  }
});
function renderWatchMedia(media){
  const stage=$('watchMediaStage'),url=String(media.url||'');if(!stage)return;
  const playBtn=$('watchPlayBtn'),syncBtn=$('watchSyncBtn'),host=isWatchHost();
  if(playBtn)playBtn.textContent=media.playing?'Pausar':'Reproduzir';
  if(media.type==='local'){
    const local=host?state.watchRtc.localFileVideo:null;
    if(playBtn){playBtn.disabled=!local;playBtn.textContent=local&&!local.paused?'Pausar':'Reproduzir'}
    if(syncBtn)syncBtn.disabled=true;
    if(local){stage.hidden=false;return}
    if(!state.watchRtc.activeScreenUid&&!state.watchRtc.screenStream){stage.innerHTML=`<div class="empty-state">${host?'Escolha novamente o filme do dispositivo para iniciar a transmissão.':'O host está preparando um filme do dispositivo. Aguarde a transmissão ao vivo.'}</div>`}
    return
  }
  if(!url){delete stage.dataset.url;if(!state.watchRtc.activeScreenUid&&!state.watchRtc.screenStream)stage.innerHTML='<div class="empty-state">Cole um link do YouTube, Google Drive ou vídeo direto; ou transmita um filme do dispositivo.</div>';if(playBtn)playBtn.disabled=true;if(syncBtn)syncBtn.disabled=true;return}
  const yt=youtubeEmbed(url,!host),drive=googleDriveEmbed(url),driveDirect=googleDriveDirect(url);
  if(yt){
    if(playBtn)playBtn.disabled=!host;if(syncBtn)syncBtn.disabled=false;
    let f=stage.querySelector('iframe[data-watch-youtube="1"]');
    if(!f||stage.dataset.url!==url){stage.innerHTML='';f=document.createElement('iframe');f.className='watch-iframe'+(host?'':' watch-viewer-locked');f.dataset.watchYoutube='1';f.src=yt;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;stage.appendChild(f);stage.dataset.url=url;f.addEventListener('load',()=>setTimeout(()=>{startYoutubeListening(f);applyYoutubeWatchState(f,state.watchRoom?.media||media)},300))}
    else setTimeout(()=>{startYoutubeListening(f);applyYoutubeWatchState(f,media)},35);
    return
  }
  if(drive){
    if(playBtn)playBtn.disabled=!host;if(syncBtn)syncBtn.disabled=false;
    const fallbackDrive=()=>{
      if(stage.dataset.driveFallback==='1'&&stage.dataset.url===url)return;
      stage.dataset.driveFallback='1';stage.innerHTML='';
      const f=document.createElement('iframe');f.className='watch-iframe drive-iframe';f.dataset.watchDrive='1';f.src=drive;f.allow='autoplay; fullscreen';f.allowFullscreen=true;f.title='Vídeo do Google Drive';stage.appendChild(f);
      const help=document.createElement('div');help.className='drive-help';const note=document.createElement('p');note.textContent='O Google não liberou este arquivo como vídeo direto. Se o iframe pedir login mesmo com o link público, use “Filme do dispositivo” ou compartilhe a aba/tela com áudio.';const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='btn';link.textContent='Abrir no Drive';const retry=document.createElement('button');retry.className='btn';retry.type='button';retry.textContent='Tentar vídeo direto';retry.onclick=()=>{delete stage.dataset.driveFallback;delete stage.dataset.url;renderWatchMedia(state.watchRoom?.media||media)};help.append(note,link,retry);stage.appendChild(help);stage.dataset.url=url;
      if(playBtn){playBtn.disabled=true;playBtn.textContent='Controles no Drive'}if(syncBtn)syncBtn.disabled=true
    };
    let v=stage.querySelector('video[data-watch-drive-direct="1"]');
    if(!v||stage.dataset.url!==url||stage.dataset.driveFallback==='1'){
      delete stage.dataset.driveFallback;stage.innerHTML='';v=document.createElement('video');v.className='watch-video';v.dataset.watchDriveDirect='1';v.src=driveDirect;v.controls=host;v.playsInline=true;v.preload='metadata';
      v.addEventListener('error',fallbackDrive,{once:true});
      v.addEventListener('play',()=>{if(host&&!state.watchApplying)publishWatchPlayer(true)});v.addEventListener('pause',()=>{if(host&&!state.watchApplying)publishWatchPlayer(false)});v.addEventListener('seeked',()=>{if(host&&!state.watchApplying)publishWatchPlayer(!v.paused)});
      stage.appendChild(v);stage.dataset.url=url
    }
    v.controls=host;v.classList.toggle('watch-viewer-locked',!host);const target=watchMediaPosition(media);
    if(Number.isFinite(v.duration)&&Math.abs((v.currentTime||0)-target)>2){state.watchApplying=true;try{v.currentTime=target}catch{}setTimeout(()=>state.watchApplying=false,250)}
    if(media.playing&&v.paused){state.watchApplying=true;v.play().catch(()=>{}).finally(()=>setTimeout(()=>state.watchApplying=false,250))}
    if(!media.playing&&!v.paused){state.watchApplying=true;v.pause();setTimeout(()=>state.watchApplying=false,250)}
    return
  }
  if(playBtn)playBtn.disabled=!host;if(syncBtn)syncBtn.disabled=false;
  let v=stage.querySelector('video');if(!v||stage.dataset.url!==url){stage.innerHTML='';v=document.createElement('video');v.className='watch-video';v.src=url;v.controls=host;v.playsInline=true;v.addEventListener('error',()=>toast('Este link não abriu como vídeo. Use um MP4/WebM acessível, Google Drive público ou filme do dispositivo.',6000));stage.appendChild(v);stage.dataset.url=url;v.addEventListener('play',()=>{if(host&&!state.watchApplying)publishWatchPlayer(true)});v.addEventListener('pause',()=>{if(host&&!state.watchApplying)publishWatchPlayer(false)});v.addEventListener('seeked',()=>{if(host&&!state.watchApplying)publishWatchPlayer(!v.paused)})}
  v.controls=host;v.classList.toggle('watch-viewer-locked',!host);const target=watchMediaPosition(media);
  if(Math.abs((v.currentTime||0)-target)>2){state.watchApplying=true;try{v.currentTime=target}catch{}setTimeout(()=>state.watchApplying=false,250)}
  if(media.playing&&v.paused){state.watchApplying=true;v.play().catch(()=>{}).finally(()=>setTimeout(()=>state.watchApplying=false,250))}
  if(!media.playing&&!v.paused){state.watchApplying=true;v.pause();setTimeout(()=>state.watchApplying=false,250)}
}

async function setWatchMedia(ev){
  ev.preventDefault();if(!isWatchHost())return;const url=$('watchMediaInput').value.trim();if(!/^https?:\/\//i.test(url))return toast('Use um link http/https.');
  if(state.watchRtc.screenSource==='file'&&state.watchRtc.screenStream)await stopWatchPublishedStream({clearLocalMedia:false,silent:true});
  const type=youtubeEmbed(url)?'youtube':googleDriveEmbed(url)?'drive':'video';
  await set(ref(db,`watchRooms/${state.watchCode}/media`),{url,type,playing:false,position:0,updatedAt:Date.now()}).catch(e=>toast(permissionMessage(e)));
  if(type==='drive')toast('Drive carregado. O Gremory vai tentar o arquivo público direto e sincronizado; se o Google bloquear, cai no player do Drive.');
}
async function publishWatchPlayer(playing){
  if(!isWatchHost())return;const shell=$('watchMediaStage'),v=shell?.querySelector('video'),media=state.watchRoom?.media||{};
  const position=v?Number(v.currentTime||0):(media.type==='youtube'?Number(state.watchYoutube.lastTime||watchMediaPosition(media)):watchMediaPosition(media));
  await update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:!!playing,position,updatedAt:Date.now()}).catch(()=>{})
}
async function toggleWatchPlayback(){
  if(!isWatchHost())return;const shell=$('watchMediaStage'),media=state.watchRoom?.media||{};
  const local=state.watchRtc.localFileVideo;if(media.type==='local'&&local){if(local.paused)await local.play().catch(()=>{});else local.pause();return}
  const v=shell?.querySelector('video');if(v){if(v.paused)v.play().catch(()=>{});else v.pause();return}
  const iframe=shell?.querySelector('iframe[data-watch-youtube="1"]');
  if(iframe){const next=!media.playing;const position=Number(state.watchYoutube.lastTime||watchMediaPosition(media));state.watchApplying=true;youtubeCommand(iframe,next?'playVideo':'pauseVideo',[]);setTimeout(()=>state.watchApplying=false,500);await update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:next,position,updatedAt:Date.now()}).catch(()=>{});return}
  if(media.type==='drive'&&shell?.querySelector('iframe[data-watch-drive="1"]'))return toast('O Google bloqueou o vídeo direto. Neste modo o Play/Pause fica no player do Drive.');
  toast('Carregue um vídeo primeiro.')
}
function syncWatchPlayer(){
  const media=state.watchRoom?.media||{};if(media.type==='local')return toast('O filme do dispositivo já é transmitido ao vivo para todos.');
  const shell=$('watchMediaStage'),iframe=shell?.querySelector('iframe[data-watch-youtube="1"]');if(iframe)applyYoutubeWatchState(iframe,media);else if(media.type==='drive'&&shell?.querySelector('iframe[data-watch-drive="1"]'))return toast('O Google bloqueou a sincronização direta deste arquivo.');else renderWatchMedia(media);toast('Player sincronizado.')
}
function watchMusicRows(queueObj={}){
  const rows=Object.entries(queueObj||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
  const out=[],lastByTrack=new Map();
  for(const row of rows){
    const key=`${String(row.videoId||row.url||row.title||'')}|${String(row.requestedBy||'')}`;
    const created=Number(row.createdAt||0),last=lastByTrack.get(key);
    if(last&&Math.abs(created-last)<=15000)continue;
    lastByTrack.set(key,created);out.push(row)
  }
  return out
}
function watchMusicRoomPlan(accessObj=state.watchRoom?.musicAccess||{},planObj=state.watchRoom?.musicPlan||{}){
  if(planObj?.active)return{...planObj,active:true};
  const legacy=Object.entries(accessObj||{}).find(([,v])=>v?.active);
  if(!legacy)return null;
  const [activatedBy,row]=legacy;
  return{active:true,activatedBy,premium:!!row.premiumAtActivation,used:Number(row.used||0),activatedAt:Number(row.activatedAt||0),activationCost:Number(row.activationCost||50),legacy:true}
}
function currentWatchMusic(queueObj=state.watchRoom?.musicQueue||{},playback=state.watchRoom?.musicPlayback||{}){
  const rows=watchMusicRows(queueObj);
  if(playback?.currentId){
    const exact=rows.find(x=>String(x.id)===String(playback.currentId));
    if(exact)return{...exact,startedAt:Number(playback.startedAt||exact.startedAt||Date.now())}
  }
  return rows[0]||null
}
function watchMusicPendingRows(queueObj=state.watchRoom?.musicQueue||{},playback=state.watchRoom?.musicPlayback||{}){
  const current=currentWatchMusic(queueObj,playback);
  return watchMusicRows(queueObj).filter(x=>!current||String(x.id)!==String(current.id))
}
function watchMusicCanHear(){return !!state.watchRtc.audioJoined}
function watchMusicElapsed(item,playback=state.watchRoom?.musicPlayback||{}){
  const started=Number(playback?.currentId===item?.id?playback.startedAt:(item?.startedAt||Date.now()));
  return Math.max(0,(Date.now()-started)/1000)
}
function watchMusicEngine(){return $('watchMusicEngine')}
function musicYoutubeCommand(func,args=[]){
  const iframe=watchMusicEngine();
  try{iframe?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}
}
function applyLocalMusicVolume(){
  const vol=Math.max(0,Math.min(100,Number(state.watchMusic.volume||0)));
  localStorage.setItem('gremory:watchMusicVolume',String(vol));
  localStorage.setItem('gremory:watchMusicMuted',state.watchMusic.muted?'1':'0');
  musicYoutubeCommand('setVolume',[vol]);musicYoutubeCommand(state.watchMusic.muted?'mute':'unMute',[]);
  const slider=$('watchMusicVolumeRange');if(slider)slider.value=String(vol);
  const label=$('watchMusicVolumeValue');if(label)label.textContent=`${vol}%`;
  const mute=$('watchMusicMuteBtn');if(mute)mute.textContent=state.watchMusic.muted?'Ativar som':'Silenciar'
}
function stopWatchMusicEngine(clear=true){
  musicYoutubeCommand('stopVideo',[]);
  const iframe=watchMusicEngine();
  if(clear&&iframe){iframe.src='about:blank';iframe.dataset.videoId=''}
  state.watchMusic.engineReady=false;
  state.watchMusic.currentTime=0
}
function destroyWatchMusicPlayback(){
  stopWatchMusicEngine(true);state.watchMusic.currentId='';state.watchMusic.endedId='';
  $('watchRemoteMedia')?.querySelector('[data-watch-music-bot="1"]')?.remove()
}
function ensureCharlotteMusicCard(current){
  const grid=$('watchRemoteMedia');if(!grid||!watchMusicCanHear()||!current)return null;
  let card=grid.querySelector('[data-watch-music-bot="1"]');
  if(!card){
    card=document.createElement('div');card.className='watch-call-card watch-music-bot-card';card.dataset.watchMusicBot='1';
    const avatar=document.createElement('img');avatar.src=CHARLOTTE_MUSIC_AVATAR;avatar.alt='Charlotte';
    const copy=document.createElement('div');copy.className='watch-call-copy';
    const name=document.createElement('strong');name.textContent='Charlotte';
    const status=document.createElement('small');status.id='watchMusicBotStatus';copy.append(name,status);
    const controls=document.createElement('div');controls.className='watch-music-local-controls';
    const mute=document.createElement('button');mute.type='button';mute.className='mini-btn';mute.id='watchMusicMuteBtn';mute.onclick=()=>{state.watchMusic.muted=!state.watchMusic.muted;applyLocalMusicVolume()};
    const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.step='1';range.id='watchMusicVolumeRange';range.value=String(state.watchMusic.volume);range.setAttribute('aria-label','Volume da Charlotte');
    range.oninput=()=>{state.watchMusic.volume=Number(range.value||0);state.watchMusic.muted=false;applyLocalMusicVolume()};
    const value=document.createElement('span');value.id='watchMusicVolumeValue';
    controls.append(mute,range,value);card.append(avatar,copy,controls);grid.prepend(card)
  }
  const status=card.querySelector('#watchMusicBotStatus');if(status)status.textContent=current.title||'Tocando música';
  applyLocalMusicVolume();return card
}
function syncWatchMusicClock(force=false){
  const current=currentWatchMusic(),playback=state.watchRoom?.musicPlayback||{};
  if(!current||!watchMusicCanHear()||!state.watchMusic.engineReady||state.watchMusic.endedId===current.id)return;
  const now=Date.now();if(!force&&now-state.watchMusic.lastClockSync<3500)return;
  state.watchMusic.lastClockSync=now;
  const expected=watchMusicElapsed(current,playback),actual=Number(state.watchMusic.currentTime||0);
  if(force||!Number.isFinite(actual)||Math.abs(expected-actual)>2.5)musicYoutubeCommand('seekTo',[expected,true]);
  musicYoutubeCommand('playVideo',[]);applyLocalMusicVolume()
}
setInterval(()=>{if(state.watchCode&&watchMusicCanHear())syncWatchMusicClock(false)},4000);

function loadWatchMusicPlayback(current,playback={}){
  if(!current||!watchMusicCanHear()){destroyWatchMusicPlayback();return}
  ensureCharlotteMusicCard(current);
  const iframe=watchMusicEngine();if(!iframe||!current.videoId)return;
  const videoId=String(current.videoId),changed=state.watchMusic.currentId!==current.id||iframe.dataset.videoId!==videoId;
  if(!changed){
    // Nunca reinicia a faixa que já terminou enquanto o servidor troca para a próxima.
    if(state.watchMusic.endedId!==current.id)syncWatchMusicClock(false);
    return
  }
  stopWatchMusicEngine(true);
  state.watchMusic.currentId=current.id;state.watchMusic.endedId='';state.watchMusic.lastAdvanceId='';state.watchMusic.engineReady=false;state.watchMusic.currentTime=0;
  const elapsed=watchMusicElapsed(current,playback),origin=encodeURIComponent(location.origin);
  iframe.dataset.videoId=videoId;
  iframe.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&autoplay=1&playsinline=1&controls=0&disablekb=1&rel=0&loop=0&origin=${origin}&start=${Math.floor(elapsed)}`;
  iframe.onload=()=>setTimeout(()=>{
    try{iframe.contentWindow?.postMessage(JSON.stringify({event:'listening',id:'gremory-music'}),'*')}catch{}
    musicYoutubeCommand('addEventListener',['onStateChange']);musicYoutubeCommand('addEventListener',['onReady']);
    musicYoutubeCommand('addEventListener',['onError']);musicYoutubeCommand('seekTo',[elapsed,true]);musicYoutubeCommand('playVideo',[]);applyLocalMusicVolume()
  },260)
}
async function autoAdvanceWatchMusic(currentId){
  if(!currentId||state.watchMusic.lastAdvanceId===currentId||!watchMusicCanHear())return;
  state.watchMusic.lastAdvanceId=currentId;
  try{await bridgeRequest('watch_music_advance',{roomCode:state.watchCode,currentId},20000)}
  catch(e){state.watchMusic.lastAdvanceId='';console.warn('[WATCH MUSIC ADVANCE]',e)}
}
function renderWatchMusic(queueObj={},accessObj={},planObj={},playback={}){
  const rows=watchMusicRows(queueObj),current=currentWatchMusic(queueObj,playback),pending=watchMusicPendingRows(queueObj,playback);
  const now=$('watchMusicNow'),box=$('watchMusicQueue'),form=$('watchMusicForm'),activate=$('watchMusicActivateBtn'),accessBox=$('watchMusicAccessBox');
  if(!now||!box||!form)return;now.innerHTML='';box.innerHTML='';
  const audioJoined=watchMusicCanHear(),plan=watchMusicRoomPlan(accessObj,planObj),myPremium=Boolean(state.charlotteSync?.account?.premium);
  const title=$('watchMusicAccessTitle'),txt=$('watchMusicAccessText');

  if(plan?.active){
    if(accessBox)accessBox.hidden=true;
  }else{
    if(accessBox)accessBox.hidden=false;
    if(title)title.textContent=audioJoined?'Ativar Charlotte Music por ₹50':'Entre na voz e ative por ₹50';
    if(txt)txt.textContent=myPremium?'Premium: ao ativar, a playlist da sala fica ilimitada.':'Free: a sala ganha 10 músicas inclusas e depois cada nova custa ₹5.';
  }
  if(activate){activate.hidden=!!plan?.active;activate.disabled=false;activate.textContent=audioJoined?'Ativar sala por ₹50':'Entrar na voz e ativar ₹50'}

  const input=$('watchMusicInput'),submit=form.querySelector('button[type="submit"]');
  if(input)input.disabled=!audioJoined||!plan?.active||state.watchMusic.adding;
  if(submit){submit.disabled=!audioJoined||!plan?.active||state.watchMusic.adding;submit.textContent=state.watchMusic.adding?'Adicionando...':'Adicionar à fila'}

  if(!current){
    now.innerHTML='<div class="empty-state small">A playlist está vazia.</div>';destroyWatchMusicPlayback()
  }else{
    const card=document.createElement('div');card.className='watch-music-current compact';
    const art=document.createElement('div');art.className='watch-music-note';art.textContent='♪';
    const copy=document.createElement('div');const st=document.createElement('strong');st.textContent=current.title||'Música';
    const sm=document.createElement('small');sm.textContent=`Tocando agora • pedido por ${current.requestedName||'participante'}`;
    copy.append(st,sm);card.append(art,copy);now.appendChild(card);
    if(audioJoined)loadWatchMusicPlayback(current,playback);else destroyWatchMusicPlayback()
  }

  pending.slice(0,20).forEach((x,i)=>{
    const row=document.createElement('div');row.className='watch-music-row';
    const badge=document.createElement('span');badge.textContent=String(i+1);
    const c=document.createElement('div');const st=document.createElement('strong');st.textContent=x.title||'Música';
    const sm=document.createElement('small');sm.textContent=`Na fila • ${x.requestedName||'Participante'}`;
    c.append(st,sm);row.append(badge,c);box.appendChild(row)
  })
}
$('watchMusicActivateBtn')?.addEventListener('click',async()=>{
  try{
    if(!watchMusicCanHear()){toast('Entrando na chamada de voz...');await joinWatchVoice();if(!watchMusicCanHear())return}
    const r=await bridgeRequest('watch_music_activate',{roomCode:state.watchCode},20000);
    toast(r.alreadyActive?'A Charlotte Music já está ativa nesta sala.':`Charlotte Music ativada por ₹${r.cost||50}.`)
  }catch(e){toast(e.message)}
});
$('watchMusicForm')?.addEventListener('submit',async ev=>{
  ev.preventDefault();if(state.watchMusic.adding)return;if(!watchMusicCanHear())return toast('Entre na chamada de voz primeiro.');
  const query=$('watchMusicInput').value.trim();if(!query)return;
  state.watchMusic.adding=true;renderWatchMusic(state.watchRoom?.musicQueue||{},state.watchRoom?.musicAccess||{},state.watchRoom?.musicPlan||{},state.watchRoom?.musicPlayback||{});
  try{
    const r=await bridgeRequest('watch_music_add',{roomCode:state.watchCode,query},30000);
    $('watchMusicInput').value='';
    toast(r.started?'Música iniciada.':r.cost>0?`Adicionada à fila por ₹${r.cost}.`:'Adicionada à fila.')
  }catch(e){toast(e.message)}
  finally{state.watchMusic.adding=false;renderWatchMusic(state.watchRoom?.musicQueue||{},state.watchRoom?.musicAccess||{},state.watchRoom?.musicPlan||{},state.watchRoom?.musicPlayback||{})}
});
$('watchMusicSkipBtn')?.addEventListener('click',async()=>{
  if(!isWatchHost())return toast('Somente o host pode pular.');
  try{const r=await bridgeRequest('watch_music_skip',{roomCode:state.watchCode},20000);toast(r.skipped?'Pulou para a próxima música.':'A playlist está vazia.')}catch(e){toast(e.message)}
});

async function closeWatchRoom(silent=false){await leaveWatchVoice(true);destroyWatchMusicPlayback();clearUnsubs(state.watchUnsubs);state.watchCode=null;state.watchRoom=null;$('watchRoom').hidden=true;$('watchLobby').hidden=false;if($('watchCreateBtn'))$('watchCreateBtn').hidden=false;if(!silent)loadWatchRooms()}
async function exitWatchRoom(){if(!state.user||!state.watchCode)return;const code=state.watchCode;if(isWatchHost())return deleteWatchRoom(code,state.watchRoom?.meta?.name);try{await remove(ref(db,`watchRooms/${code}/members/${state.user.uid}`));await remove(ref(db,`watchUserRooms/${state.user.uid}/${code}`));await closeWatchRoom(false)}catch(e){toast(permissionMessage(e))}}
async function deleteWatchRoom(code,name='Sala'){if(!state.user||!code||!confirm(`Apagar "${name||code}" para todos?`))return;try{const sn=await get(ref(db,`watchRooms/${code}`));const room=sn.val()||{};if(room.meta?.ownerUid!==state.user.uid)throw new Error('Só o host pode apagar.');await Promise.all(Object.keys(room.members||{}).map(uid=>remove(ref(db,`watchUserRooms/${uid}/${code}`)).catch(()=>{})));await remove(ref(db,`watchRooms/${code}`));await remove(ref(db,`watchVoice/${code}`)).catch(()=>{});await remove(ref(db,`watchRtc/${code}`)).catch(()=>{});await closeWatchRoom(false);toast('Sala apagada.')}catch(e){toast(permissionMessage(e,e.message))}}

// WebRTC da Watch Party (separado do RPG)
function watchVoiceUi(){
  const rtc=state.watchRtc,audio=rtc.audioJoined;
  if($('watchJoinVoiceBtn'))$('watchJoinVoiceBtn').hidden=audio;
  if($('watchMicBtn')){$('watchMicBtn').hidden=!audio;$('watchMicBtn').textContent=rtc.micEnabled?'Silenciar':'Ativar microfone'}
  if($('watchShareBtn')){$('watchShareBtn').hidden=!state.watchCode;$('watchShareBtn').textContent=rtc.screenStream?(rtc.screenSource==='file'?'Parar filme local':'Parar compartilhamento'):'Compartilhar tela';$('watchShareBtn').classList.toggle('active',!!rtc.screenStream)}
  if($('watchLeaveVoiceBtn'))$('watchLeaveVoiceBtn').hidden=!audio;
  if(state.watchRoom)renderWatchMusic(state.watchRoom.musicQueue||{},state.watchRoom.musicAccess||{},state.watchRoom.musicPlan||{},state.watchRoom.musicPlayback||{})
}
function setWatchRtcStatus(text,tone=''){
  const el=$('watchRtcStatus');if(!el)return;el.textContent=String(text||'');el.dataset.tone=tone||''
}
function watchPeerName(uid){return state.watchRtc.presence?.[uid]?.name||state.watchRoom?.members?.[uid]?.name||'Participante'}
function watchPcSender(pc,kind,role='voice'){
  if(!pc)return null;
  if(kind==='video')return pc.__watchVideoSender||pc.getTransceivers?.().find(t=>t.receiver?.track?.kind==='video')?.sender||null;
  if(kind==='audio'&&role==='screen')return pc.__watchScreenAudioSender||null;
  if(kind==='audio')return pc.__watchVoiceAudioSender||pc.getTransceivers?.().find(t=>t.receiver?.track?.kind==='audio')?.sender||null;
  return null
}
function watchScreenStreamFor(uid){
  return state.watchRtc.remoteScreenStreams.get(String(uid||''))||state.watchRtc.remoteStreams.get(String(uid||''))||null
}
function watchVoiceStreamFor(uid){
  return state.watchRtc.remoteVoiceStreams.get(String(uid||''))||null
}
function ensureWatchCallCard(uid){
  const grid=$('watchRemoteMedia');if(!grid)return null;let card=grid.querySelector(`[data-watch-peer="${CSS.escape(uid)}"]`);
  if(!card){
    card=document.createElement('div');card.className='watch-call-card';card.dataset.watchPeer=uid;
    const avatar=document.createElement('img');avatar.src=state.watchRoom?.members?.[uid]?.avatar||DEFAULT_AVATAR;avatar.alt='';
    const copy=document.createElement('div');copy.className='watch-call-copy';const name=document.createElement('strong');name.textContent=watchPeerName(uid);const status=document.createElement('small');status.textContent='Conectando...';copy.append(name,status);
    const view=document.createElement('button');view.type='button';view.className='mini-btn watch-view-screen';view.textContent='Assistir tela';view.hidden=true;
    const audio=document.createElement('audio');audio.autoplay=true;audio.muted=!state.watchRtc.audioJoined;
    card.append(avatar,copy,view,audio);grid.appendChild(card)
  }
  return card
}
function watchRemoteHasScreen(uid,stream=watchScreenStreamFor(uid)){return state.watchRtc.screenSharers.has(String(uid||''))&&!!stream?.getVideoTracks?.().some(t=>t.readyState==='live')}
function watchRemoteScreenFlowing(uid,stream=watchScreenStreamFor(uid)){return state.watchRtc.screenSharers.has(String(uid||''))&&!!stream?.getVideoTracks?.().some(t=>t.readyState==='live'&&!t.muted)}
async function sendWatchRtc(targetUid,payload){if(!state.user||!state.watchCode)return;await push(ref(db,`watchRtc/${state.watchCode}/${targetUid}`),{fromUid:state.user.uid,at:Date.now(),...payload})}
async function negotiateWatchPeer(peerUid,{iceRestart=false,reason='update'}={}){
  const pc=state.watchRtc.peers.get(peerUid);if(!pc||pc.signalingState==='closed'||pc.signalingState!=='stable'||state.watchRtc.makingOffer.has(peerUid))return false;
  state.watchRtc.makingOffer.add(peerUid);
  try{
    const offer=await pc.createOffer({iceRestart:!!iceRestart});await pc.setLocalDescription(offer);
    await sendWatchRtc(peerUid,{type:'offer',sdp:pc.localDescription?.sdp||offer.sdp,reason,iceRestart:!!iceRestart});return true
  }finally{state.watchRtc.makingOffer.delete(peerUid)}
}

async function scheduleWatchRenegotiation(peerUid,reason='screen-sync',attempt=0){
  const pc=state.watchRtc.peers.get(String(peerUid||''));if(!pc||pc.signalingState==='closed')return false;
  if(pc.signalingState!=='stable'||state.watchRtc.makingOffer.has(String(peerUid||''))){if(attempt<8)setTimeout(()=>scheduleWatchRenegotiation(peerUid,reason,attempt+1).catch(()=>{}),260+attempt*180);return false}
  return negotiateWatchPeer(String(peerUid),{iceRestart:false,reason}).catch(()=>false)
}
async function syncLocalScreenToPeer(peerUid,reason='late-join'){
  const pc=state.watchRtc.peers.get(String(peerUid||''))||await createWatchPeer(String(peerUid||''),false);if(!pc)return false;const videoTrack=state.watchRtc.screenStream?.getVideoTracks?.().find(t=>t.readyState==='live'),audioTrack=state.watchRtc.screenStream?.getAudioTracks?.().find(t=>t.readyState==='live')||null;if(!videoTrack)return false;const vs=watchPcSender(pc,'video'),as=watchPcSender(pc,'audio','screen');if(vs)await vs.replaceTrack(videoTrack);if(as)await as.replaceTrack(audioTrack);await tuneWatchScreenSender(pc);await tuneWatchScreenAudioSender(pc);await scheduleWatchRenegotiation(peerUid,reason);return true
}
async function tuneWatchScreenSender(pc){
  const sender=watchPcSender(pc,'video');if(!sender)return;
  try{
    const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];
    
    p.encodings[0].maxBitrate=Math.max(600000,Math.floor(3600000/Math.max(1,state.watchRtc.peers.size))); 
    p.encodings[0].maxFramerate=30;
    try{p.encodings[0].priority='high'}catch{}
    try{p.encodings[0].networkPriority='high'}catch{}
    p.degradationPreference='maintain-framerate';
    await sender.setParameters(p)
  }catch{}
}
async function tuneWatchScreenAudioSender(pc){
  const sender=watchPcSender(pc,'audio','screen');if(!sender)return;
  try{const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];p.encodings[0].maxBitrate=192000;try{p.encodings[0].priority='high'}catch{};await sender.setParameters(p)}catch{}
}
async function requestWatchScreenFrom(uid,force=false){
  uid=String(uid||'');if(!uid||uid===state.user?.uid||!state.watchRtc.screenSharers.has(uid))return;
  const last=Number(state.watchRtc.screenRetry.get(uid)||0);if(!force&&Date.now()-last<3500)return;
  state.watchRtc.screenRetry.set(uid,Date.now());await sendWatchRtc(uid,{type:'screen_request'}).catch(()=>{})
}
function updateWatchPeerScreenButton(uid){
  const card=ensureWatchCallCard(uid),btn=card?.querySelector('.watch-view-screen'),stream=watchScreenStreamFor(uid),sharing=state.watchRtc.screenSharers.has(String(uid)),ready=watchRemoteHasScreen(uid,stream);
  if(btn){
    btn.hidden=!sharing;btn.textContent=ready?'Assistir tela':'Reconectar tela';
    btn.onclick=async()=>{if(ready){state.watchRtc.activeScreenUid=uid;refreshWatchScreenStage();const a=$('watchScreenAudio');if(a?.srcObject){try{a.muted=false;state.watchRtc.screenSoundMuted=false;await a.play()}catch{}}}else{setWatchRtcStatus('Reconectando compartilhamento...','warn');await requestWatchScreenFrom(uid,true)}}
  }
  const status=card?.querySelector('small');if(status)status.textContent=sharing?(ready?'Compartilhando tela':'Conectando tela...'):'Conectado'
}
function refreshWatchScreenStage(){
  const stage=$('watchScreenStage'),video=$('watchScreenVideo'),audio=$('watchScreenAudio'),label=$('watchScreenLabel'),mediaStage=$('watchMediaStage'),soundBtn=$('watchScreenSoundBtn');if(!stage||!video)return;
  let stream=null,uid=null,isLocal=false;const localUid=String(state.user?.uid||''),localVideo=state.watchRtc.screenStream?.getVideoTracks?.()[0];
  if(state.watchRtc.activeScreenUid&&state.watchRtc.activeScreenUid!==localUid){const remote=watchScreenStreamFor(state.watchRtc.activeScreenUid);if(watchRemoteHasScreen(state.watchRtc.activeScreenUid,remote)){stream=remote;uid=state.watchRtc.activeScreenUid}}
  if(!stream&&localVideo&&localVideo.readyState==='live'){stream=state.watchRtc.screenStream;uid=localUid;isLocal=true}
  if(!stream){for(const peerUid of state.watchRtc.screenSharers){if(peerUid===localUid)continue;const remote=watchScreenStreamFor(peerUid);if(watchRemoteHasScreen(peerUid,remote)){stream=remote;uid=peerUid;break}}}
  if(!stream){state.watchRtc.activeScreenUid=null;try{video.pause()}catch{}try{audio?.pause()}catch{}video.srcObject=null;if(audio)audio.srcObject=null;stage.hidden=true;if(mediaStage)mediaStage.hidden=false;return}
  state.watchRtc.activeScreenUid=uid;
  const localFile=isLocal&&state.watchRtc.screenSource==='file'&&state.watchRtc.localFileVideo;
  if(localFile){stage.hidden=true;if(mediaStage)mediaStage.hidden=false;return}
  stage.hidden=false;if(mediaStage)mediaStage.hidden=true;
  const vtrack=stream.getVideoTracks?.().find(t=>t.readyState==='live'),atrack=stream.getAudioTracks?.().find(t=>t.readyState==='live');
  const videoStream=new MediaStream();if(vtrack)videoStream.addTrack(vtrack);if(video.srcObject?.getVideoTracks?.()[0]?.id!==vtrack?.id)video.srcObject=videoStream;video.muted=true;video.playsInline=true;video.play?.().catch(()=>{});
  if(audio){const audioStream=new MediaStream();if(atrack)audioStream.addTrack(atrack);if(audio.srcObject?.getAudioTracks?.()[0]?.id!==atrack?.id)audio.srcObject=atrack?audioStream:null;audio.muted=isLocal||state.watchRtc.screenSoundMuted;audio.volume=1;if(atrack&&!audio.muted)audio.play?.().catch(()=>{state.watchRtc.screenSoundMuted=true;audio.muted=true;if(soundBtn)soundBtn.textContent='Toque para ativar som'})}
  if(label)label.textContent=isLocal?'Sua tela compartilhada':`${watchPeerName(uid)} está compartilhando`;
  if(soundBtn){const hasAudio=!!atrack;soundBtn.hidden=isLocal;soundBtn.disabled=!hasAudio;soundBtn.textContent=!hasAudio?'Sem áudio':(state.watchRtc.screenSoundMuted?'Ativar som':'Som ligado')}
}
function attachWatchRemote(uid){
  const voice=watchVoiceStreamFor(uid),screen=watchScreenStreamFor(uid),card=ensureWatchCallCard(uid),audio=card?.querySelector('audio');
  if(audio&&voice&&audio.srcObject!==voice)audio.srcObject=voice;
  if(audio){audio.muted=!state.watchRtc.audioJoined;audio.play?.().catch(()=>{})}

  for(const track of screen?.getVideoTracks?.()||[]){
    const refresh=()=>{updateWatchPeerScreenButton(uid);refreshWatchScreenStage()};
    track.onmute=refresh;
    track.onunmute=()=>{state.watchRtc.activeScreenUid=String(uid);refresh();setWatchRtcStatus(`${watchPeerName(uid)} está compartilhando a tela`,'ok')};
    track.onended=refresh
  }
  for(const track of screen?.getAudioTracks?.()||[]){
    track.onunmute=()=>refreshWatchScreenStage();
    track.onended=()=>refreshWatchScreenStage()
  }

  updateWatchPeerScreenButton(uid);
  if(state.watchRtc.screenSharers.has(String(uid)))state.watchRtc.activeScreenUid=String(uid);
  refreshWatchScreenStage()
}
function removeWatchPeer(uid){
  const pc=state.watchRtc.peers.get(uid);try{pc?.close()}catch{}state.watchRtc.peers.delete(uid);state.watchRtc.remoteStreams.delete(uid);state.watchRtc.remoteVoiceStreams.delete(uid);state.watchRtc.remoteScreenStreams.delete(uid);state.watchRtc.pendingCandidates.delete(uid);state.watchRtc.screenRetry.delete(uid);
  $('watchRemoteMedia')?.querySelector(`[data-watch-peer="${CSS.escape(uid)}"]`)?.remove();refreshWatchScreenStage()
}
async function createWatchPeer(peerUid,initiator=false){
  peerUid=String(peerUid||'');if(!peerUid||peerUid===state.user?.uid)return null;
  const existing=state.watchRtc.peers.get(peerUid);if(existing&&existing.signalingState!=='closed')return existing;

  const pc=new RTCPeerConnection({...RTC_CONFIG,iceCandidatePoolSize:8});
  state.watchRtc.peers.set(peerUid,pc);

  const voiceRemote=new MediaStream(),screenRemote=new MediaStream();
  state.watchRtc.remoteVoiceStreams.set(peerUid,voiceRemote);
  state.watchRtc.remoteScreenStreams.set(peerUid,screenRemote);
  state.watchRtc.remoteStreams.set(peerUid,screenRemote);
  ensureWatchCallCard(peerUid);

  const voiceAudioTr=pc.addTransceiver('audio',{direction:'sendrecv'});
  const videoTr=pc.addTransceiver('video',{direction:'sendrecv'});
  const screenAudioTr=pc.addTransceiver('audio',{direction:'sendrecv'});
  pc.__watchVoiceAudioSender=voiceAudioTr.sender;
  pc.__watchVideoSender=videoTr.sender;
  pc.__watchScreenAudioSender=screenAudioTr.sender;
  pc.__watchVoiceAudioTr=voiceAudioTr;
  pc.__watchVideoTr=videoTr;
  pc.__watchScreenAudioTr=screenAudioTr;

  const micTrack=state.watchRtc.localStream?.getAudioTracks?.()[0];
  const screenVideo=state.watchRtc.screenStream?.getVideoTracks?.()[0];
  const screenAudio=state.watchRtc.screenStream?.getAudioTracks?.()[0];
  if(micTrack)await voiceAudioTr.sender.replaceTrack(micTrack);
  if(screenVideo)await videoTr.sender.replaceTrack(screenVideo);
  if(screenAudio)await screenAudioTr.sender.replaceTrack(screenAudio);

  pc.ontrack=ev=>{
    const isScreenVideo=ev.transceiver===pc.__watchVideoTr||ev.track.kind==='video';
    const isScreenAudio=ev.transceiver===pc.__watchScreenAudioTr;
    const target=(isScreenVideo||isScreenAudio)?screenRemote:voiceRemote;
    if(!target.getTracks().some(t=>t.id===ev.track.id))target.addTrack(ev.track);
    if(isScreenVideo){state.watchRtc.activeScreenUid=peerUid;setWatchRtcStatus('Vídeo recebido. Preparando reprodução...','ok')}
    ev.track.onunmute=()=>{if(isScreenVideo)state.watchRtc.activeScreenUid=peerUid;attachWatchRemote(peerUid);refreshWatchScreenStage();if(isScreenVideo)setWatchRtcStatus(`${watchPeerName(peerUid)} está transmitindo`,'ok')};
    ev.track.onended=()=>attachWatchRemote(peerUid);
    attachWatchRemote(peerUid);refreshWatchScreenStage()
  };

  pc.onicecandidate=ev=>{if(ev.candidate)sendWatchRtc(peerUid,{type:'candidate',candidate:ev.candidate.toJSON()}).catch(()=>{})};
  pc.oniceconnectionstatechange=()=>{
    const st=pc.iceConnectionState;
    if(['connected','completed'].includes(st)){setWatchRtcStatus('Mídia conectada','ok');state.watchRtc.screenRetry.delete(peerUid)}
    if(st==='failed'){
      setWatchRtcStatus('Reconectando mídia...','warn');
      if(String(state.user?.uid).localeCompare(peerUid)<0)negotiateWatchPeer(peerUid,{iceRestart:true,reason:'ice-failed'}).catch(()=>{});
      else if(state.watchRtc.screenSharers.has(peerUid))requestWatchScreenFrom(peerUid,true)
    }
  };
  pc.onconnectionstatechange=()=>{
    if(pc.connectionState==='connected'){setWatchRtcStatus('Chamada conectada','ok');return}
    if(pc.connectionState==='disconnected'){
      setWatchRtcStatus('Conexão instável, recuperando...','warn');
      setTimeout(()=>{if(pc.connectionState==='disconnected'){if(String(state.user?.uid).localeCompare(peerUid)<0)negotiateWatchPeer(peerUid,{iceRestart:true,reason:'disconnected'}).catch(()=>{});else if(state.watchRtc.screenSharers.has(peerUid))requestWatchScreenFrom(peerUid,true)}},2200)
    }
  };

  if(initiator)await negotiateWatchPeer(peerUid,{reason:'initial'});
  return pc
}
async function flushWatchCandidates(uid,pc){const q=state.watchRtc.pendingCandidates.get(uid)||[];state.watchRtc.pendingCandidates.delete(uid);for(const c of q){try{await pc.addIceCandidate(c)}catch{}}}
async function handleWatchRtc(id,msg){
  if(!msg||state.watchRtc.processed.has(id)||!state.watchRtc.joined||!state.user)return;
  state.watchRtc.processed.add(id);const from=String(msg.fromUid||'');if(!from||from===state.user.uid)return;
  try{
    const pc=await createWatchPeer(from,false);if(!pc)return;
    if(msg.type==='offer'){
      const collision=state.watchRtc.makingOffer.has(from)||pc.signalingState!=='stable';
      const polite=String(state.user.uid).localeCompare(from)>0;
      pc.__ignoreOffer=collision&&!polite;if(pc.__ignoreOffer)return;
      if(collision){try{await pc.setLocalDescription({type:'rollback'})}catch{}}
      if(pc.signalingState!=='stable')return;
      await pc.setRemoteDescription({type:'offer',sdp:msg.sdp});await flushWatchCandidates(from,pc);
      const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await sendWatchRtc(from,{type:'answer',sdp:pc.localDescription?.sdp||ans.sdp,reason:msg.reason||''})
    }else if(msg.type==='answer'){
      if(pc.signalingState==='have-local-offer'){pc.__ignoreOffer=false;await pc.setRemoteDescription({type:'answer',sdp:msg.sdp});await flushWatchCandidates(from,pc)}
    }else if(msg.type==='candidate'&&msg.candidate){
      if(pc.__ignoreOffer)return;
      if(pc.remoteDescription)try{await pc.addIceCandidate(msg.candidate)}catch{}else{const q=state.watchRtc.pendingCandidates.get(from)||[];q.push(msg.candidate);state.watchRtc.pendingCandidates.set(from,q)}
    }else if(msg.type==='screen_request'){
      const videoTrack=state.watchRtc.screenStream?.getVideoTracks?.()[0];
      if(videoTrack&&videoTrack.readyState==='live'){
        await syncLocalScreenToPeer(from,'screen-request');
        setTimeout(()=>{if(state.watchRtc.screenStream?.getVideoTracks?.().some(t=>t.readyState==='live'))syncLocalScreenToPeer(from,'screen-request-retry').catch(()=>{})},1200)
      }
    }
  }finally{remove(ref(db,`watchRtc/${state.watchCode}/${state.user.uid}/${id}`)).catch(()=>{})}
}
function watchWatchRtcInbox(){try{state.watchRtc.inboxUnsub?.()}catch{}state.watchRtc.inboxUnsub=onValue(ref(db,`watchRtc/${state.watchCode}/${state.user.uid}`),sn=>{const all=sn.exists()?sn.val():{};Object.entries(all).sort((a,b)=>(a[1]?.at||0)-(b[1]?.at||0)).forEach(([id,msg])=>{state.watchRtc.signalQueue=(state.watchRtc.signalQueue||Promise.resolve()).then(()=>handleWatchRtc(id,msg)).catch(e=>setWatchRtcStatus('Falha na conexão: '+e.message,'warn'))})})}
function watchWatchPresence(){
  try{state.watchRtc.presenceUnsub?.()}catch{}
  state.watchRtc.presenceUnsub=onValue(ref(db,`watchVoice/${state.watchCode}`),sn=>{
    const p=sn.exists()?sn.val():{};state.watchRtc.presence=p;
    const ids=Object.keys(p).filter(uid=>uid!==state.user.uid),voiceCount=Object.values(p).filter(x=>x?.audio===true).length;
    $('watchVoiceCount').textContent=String(voiceCount);
    state.watchRtc.screenSharers=new Set(Object.entries(p).filter(([,x])=>x?.screen===true).map(([uid])=>String(uid)));
    for(const uid of ids){if(!state.watchRtc.peers.has(uid)&&String(state.user.uid).localeCompare(uid)<0)createWatchPeer(uid,true).catch(()=>{})}
    for(const uid of [...state.watchRtc.peers.keys()])if(!p[uid])removeWatchPeer(uid);
    const localSharing=!!state.watchRtc.screenStream?.getVideoTracks?.().some(t=>t.readyState==='live');
    for(const uid of ids){
      updateWatchPeerScreenButton(uid);
      if(localSharing){[250,1100,3000].forEach((delay,idx)=>setTimeout(()=>{if(state.watchRtc.screenStream?.getVideoTracks?.().some(t=>t.readyState==='live'))syncLocalScreenToPeer(uid,idx?'late-join-retry':'late-join').catch(()=>{})},delay))}
      if(state.watchRtc.screenSharers.has(uid)&&!watchRemoteScreenFlowing(uid,watchScreenStreamFor(uid))){
        [350,1200,2800,5200].forEach((delay,idx)=>setTimeout(()=>{if(state.watchRtc.screenSharers.has(uid)&&!watchRemoteScreenFlowing(uid,watchScreenStreamFor(uid)))requestWatchScreenFrom(uid,idx>0).catch(()=>{})},delay))
      }
    }
    if(ids.some(uid=>state.watchRtc.screenSharers.has(uid))&&!state.watchRtc.screenStream)setWatchRtcStatus('Recebendo compartilhamento de tela...','warn');
    else if(ids.length&&!Array.from(state.watchRtc.peers.values()).some(pc=>pc.connectionState==='connected'))setWatchRtcStatus('Conectando mídia...','warn');else setWatchRtcStatus('Aguardando outras pessoas','');
    for(const [uid,person] of Object.entries(p)){const card=ensureWatchCallCard(uid);if(card){card.querySelector('strong').textContent=watchPeerName(uid)+(uid===state.user.uid?' (você)':'');card.querySelector('small').textContent=person.screen?(person.screenKind==='file'?`Transmitindo ${person.screenLabel||'filme local'}`:'Compartilhando tela'):person.audio?(person.muted?'Microfone silenciado':'Na chamada de voz'):'Assistindo';card.querySelector('img').src=person.avatar||state.watchRoom?.members?.[uid]?.avatar||DEFAULT_AVATAR}}
    refreshWatchScreenStage();
    for(const uid of ids){if(state.watchRtc.screenSharers.has(uid))setTimeout(()=>{
      if(!state.watchRtc.screenSharers.has(uid)||watchRemoteScreenFlowing(uid,watchScreenStreamFor(uid)))return;
      const pc=state.watchRtc.peers.get(uid),st=pc?.connectionState||pc?.iceConnectionState||'';
      if(['failed','disconnected','closed'].includes(st))setWatchRtcStatus('A rede bloqueou a transmissão P2P. Tente a mesma rede Wi-Fi ou configure TURN.','warn');
      else if(watchRemoteHasScreen(uid,watchScreenStreamFor(uid)))setWatchRtcStatus('Transmissão recebida; aguardando quadros do vídeo...','warn');
    },9000)}
  })
}
async function ensureWatchRtcSession(){
  if(state.watchRtc.joined)return true;if(!state.user||!state.watchCode)return false;
  state.watchRtc.joined=true;
  await loadRtcConfig();
  try{
    const presenceRef=ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`);
    await set(presenceRef,{uid:state.user.uid,name:displayName(),avatar:avatarFor(),joinedAt:Date.now(),audio:false,screen:false});
    try{state.watchRtc.disconnectRef=onDisconnect(presenceRef);await state.watchRtc.disconnectRef.remove()}catch{}
    watchWatchRtcInbox();watchWatchPresence();setWatchRtcStatus('Preparando conexão...','warn');watchVoiceUi();return true
  }catch(e){state.watchRtc.joined=false;toast(permissionMessage(e,'Não foi possível iniciar a chamada.'));return false}
}
async function joinWatchVoice(){
  if(!await ensureWatchRtcSession())return;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    state.watchRtc.localStream=stream;state.watchRtc.audioJoined=true;state.watchRtc.micEnabled=true;
    const track=stream.getAudioTracks()[0];
    for(const [uid,pc] of state.watchRtc.peers){const sender=watchPcSender(pc,'audio','voice');if(sender)await sender.replaceTrack(track);if(pc.signalingState==='stable')await negotiateWatchPeer(uid,{reason:'audio-join'}).catch(()=>{})}
    await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{audio:true}).catch(()=>{});
    $$('.watch-call-card audio').forEach(a=>{a.muted=false;a.play?.().catch(()=>{})});watchVoiceUi();toast('Você entrou na voz.')
  }catch(e){toast(e?.name==='NotAllowedError'?'Permissão do microfone negada.':'Não foi possível abrir o microfone.')}
}
function toggleWatchMic(){const track=state.watchRtc.localStream?.getAudioTracks?.()[0];if(!track)return;track.enabled=!track.enabled;state.watchRtc.micEnabled=track.enabled;update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{muted:!track.enabled}).catch(()=>{});watchVoiceUi()}
async function leaveWatchAudio(silent=false){
  const track=state.watchRtc.localStream?.getAudioTracks?.()[0];if(track)track.stop();state.watchRtc.localStream=null;state.watchRtc.audioJoined=false;state.watchRtc.micEnabled=true;
  for(const pc of state.watchRtc.peers.values()){const sender=watchPcSender(pc,'audio','voice');if(sender)await sender.replaceTrack(null)}
  if(state.watchCode&&state.user)await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{audio:false}).catch(()=>{});
  $$('.watch-call-card audio').forEach(a=>a.muted=true);destroyWatchMusicPlayback();watchVoiceUi();if(!silent)toast('Você saiu da voz.')
}
function cleanupWatchLocalFilePlayer(){
  const rtc=state.watchRtc,v=rtc.localFileVideo,url=rtc.localFileUrl;
  if(v){try{v.onended=null;v.onvolumechange=null;v.pause()}catch{}try{v.removeAttribute('src');v.load?.()}catch{}try{v.remove()}catch{}}
  try{rtc.localFileAudioSource?.disconnect?.()}catch{}
  try{rtc.localFileAudioDest?.disconnect?.()}catch{}
  try{rtc.localFileAudioCtx?.close?.()}catch{}
  if(url)try{URL.revokeObjectURL(url)}catch{}
  rtc.localFileVideo=null;rtc.localFileUrl='';rtc.localFileName='';rtc.localFileAudioCtx=null;rtc.localFileAudioSource=null;rtc.localFileAudioDest=null
}
async function buildWatchLocalFileStream(video,captured,preparedCtx=null){
  const videoTrack=captured?.getVideoTracks?.().find(t=>t.readyState==='live');
  if(!videoTrack)throw new Error('O navegador não liberou a faixa de vídeo para transmissão.');
  let audioTrack=captured?.getAudioTracks?.().find(t=>t.readyState==='live')||null;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(AudioCtx){
    let ctx=preparedCtx;
    try{
      if(!ctx||ctx.state==='closed')ctx=new AudioCtx({latencyHint:'playback'});
      const source=ctx.createMediaElementSource(video),dest=ctx.createMediaStreamDestination();
      source.connect(ctx.destination);source.connect(dest);
      await ctx.resume?.().catch(()=>{});
      const routed=dest.stream.getAudioTracks?.().find(t=>t.readyState==='live')||dest.stream.getAudioTracks?.()[0]||null;
      if(routed){audioTrack=routed;state.watchRtc.localFileAudioCtx=ctx;state.watchRtc.localFileAudioSource=source;state.watchRtc.localFileAudioDest=dest}
      else try{await ctx.close?.()}catch{}
    }catch(e){console.warn('[WATCH LOCAL AUDIO]',e);if(ctx&&ctx!==state.watchRtc.localFileAudioCtx)try{await ctx.close?.()}catch{}}
  }
  const out=new MediaStream();out.addTrack(videoTrack);if(audioTrack){audioTrack.enabled=true;try{audioTrack.contentHint='music'}catch{}out.addTrack(audioTrack)}
  return {stream:out,videoTrack,audioTrack}
}
async function stopWatchPublishedStream({clearLocalMedia=true,silent=false}={}){
  document.body.classList.remove('watch-pseudo-fullscreen');clearWatchFullscreenUiTimer();$('watchScreenStage')?.classList.remove('watch-fullscreen-ui-hidden');updateWatchFullscreenButton();
  const rtc=state.watchRtc,source=rtc.screenSource,old=rtc.screenStream;
  rtc.screenStream=null;rtc.screenSource='';
  if(old)old.getTracks().forEach(t=>{t.onended=null;try{t.stop()}catch{}});
  for(const [uid,pc] of rtc.peers){
    const videoSender=watchPcSender(pc,'video');if(videoSender)await videoSender.replaceTrack(null);
    const screenAudioSender=watchPcSender(pc,'audio','screen');if(screenAudioSender)await screenAudioSender.replaceTrack(null);
    if(pc.signalingState==='stable')await negotiateWatchPeer(uid,{reason:'screen-stop'}).catch(()=>{})
  }
  rtc.screenSharers.delete(String(state.user?.uid||''));rtc.activeScreenUid=null;
  if(source==='file')cleanupWatchLocalFilePlayer();
  if(state.watchCode&&state.user)await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{screen:false,screenAt:null,screenAudio:false,screenKind:null,screenLabel:null}).catch(()=>{});
  if(source==='file'&&clearLocalMedia&&state.watchCode&&isWatchHost())await set(ref(db,`watchRooms/${state.watchCode}/media`),{url:'',type:'',playing:false,position:0,updatedAt:Date.now()}).catch(()=>{});
  if(!silent)setWatchRtcStatus(source==='file'?'Filme do dispositivo encerrado':'Compartilhamento encerrado','');
  refreshWatchScreenStage();watchVoiceUi()
}
async function startWatchLocalFile(file){
  if(!isWatchHost())return toast('Somente o host pode transmitir um filme do dispositivo.');
  if(!file)return;
  if(!String(file.type||'').startsWith('video/'))return toast('Escolha um arquivo de vídeo. MP4 (H.264/AAC) costuma ter a melhor compatibilidade.',6000);
  if(!HTMLMediaElement.prototype.captureStream&&!HTMLMediaElement.prototype.mozCaptureStream)return toast('Seu navegador não permite transmitir um vídeo local diretamente. Use Chrome/Edge no computador ou “Compartilhar tela”.',7000);
  const AudioCtx=window.AudioContext||window.webkitAudioContext;let preparedAudioCtx=null;
  if(AudioCtx){try{preparedAudioCtx=new AudioCtx({latencyHint:'playback'});preparedAudioCtx.resume?.().catch(()=>{})}catch{preparedAudioCtx=null}}
  if(!await ensureWatchRtcSession()){try{await preparedAudioCtx?.close?.()}catch{}return}
  if(state.watchRtc.screenStream)await stopWatchPublishedStream({clearLocalMedia:true,silent:true});
  const stage=$('watchMediaStage');if(!stage)return;
  cleanupWatchLocalFilePlayer();
  const objectUrl=URL.createObjectURL(file),v=document.createElement('video');
  v.className='watch-video watch-local-file-video';v.src=objectUrl;v.controls=true;v.playsInline=true;v.preload='auto';v.autoplay=false;
  stage.innerHTML='';stage.appendChild(v);delete stage.dataset.url;stage.hidden=false;
  state.watchRtc.localFileVideo=v;state.watchRtc.localFileUrl=objectUrl;state.watchRtc.localFileName=file.name||'Filme do dispositivo';
  await set(ref(db,`watchRooms/${state.watchCode}/media`),{url:'',type:'local',label:state.watchRtc.localFileName,playing:false,position:0,updatedAt:Date.now()}).catch(()=>{});
  try{
    await new Promise((resolve,reject)=>{if(v.readyState>=2)return resolve();const ok=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(new Error('O navegador não conseguiu abrir este formato de vídeo.'))},cleanup=()=>{v.removeEventListener('canplay',ok);v.removeEventListener('error',bad)};v.addEventListener('canplay',ok,{once:true});v.addEventListener('error',bad,{once:true})});
    await v.play();
    const capture=(v.captureStream?.()||v.mozCaptureStream?.());
    const built=await buildWatchLocalFileStream(v,capture,preparedAudioCtx);preparedAudioCtx=null;
    const {stream:publishStream,videoTrack,audioTrack}=built;
    try{videoTrack.contentHint='motion'}catch{}
    state.watchRtc.screenStream=publishStream;state.watchRtc.screenSource='file';state.watchRtc.activeScreenUid=String(state.user.uid);state.watchRtc.screenSharers.add(String(state.user.uid));
    await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{screen:true,screenAt:Date.now(),screenAudio:!!audioTrack,screenKind:'file',screenLabel:state.watchRtc.localFileName});
    await update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:true,updatedAt:Date.now()}).catch(()=>{});
    const ids=Object.keys(state.watchRtc.presence||{}).filter(uid=>uid!==state.user.uid);
    for(const uid of ids){
      let pc=state.watchRtc.peers.get(uid);if(!pc)pc=await createWatchPeer(uid,false);
      await syncLocalScreenToPeer(uid,'local-file-start').catch(()=>{});
      [900,2400,5000].forEach((delay,idx)=>setTimeout(()=>{if(state.watchRtc.screenSource==='file'&&state.watchRtc.screenStream?.getVideoTracks?.().some(t=>t.readyState==='live'))syncLocalScreenToPeer(uid,`local-file-retry-${idx+1}`).catch(()=>{})},delay))
    }
    v.addEventListener('play',()=>{if(isWatchHost()&&state.watchRtc.screenSource==='file')update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:true,updatedAt:Date.now()}).catch(()=>{})});
    v.addEventListener('pause',()=>{if(isWatchHost()&&state.watchRtc.screenSource==='file'&&!v.ended)update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:false,updatedAt:Date.now()}).catch(()=>{})});
    v.onended=()=>stopWatchPublishedStream({clearLocalMedia:false,silent:true}).then(()=>set(ref(db,`watchRooms/${state.watchCode}/media`),{url:'',type:'',playing:false,position:0,updatedAt:Date.now()}).catch(()=>{})).then(()=>toast('Filme finalizado.')).catch(()=>{});
    videoTrack.onended=()=>{if(state.watchRtc.screenSource==='file'&&!v.ended)stopWatchPublishedStream().catch(()=>{})};
    setWatchRtcStatus(audioTrack?'Filme do dispositivo transmitindo com áudio':'Filme transmitindo sem faixa de áudio','ok');refreshWatchScreenStage();watchVoiceUi();toast(`Transmitindo “${state.watchRtc.localFileName}” para a sala.`)
  }catch(e){try{await preparedAudioCtx?.close?.()}catch{}await stopWatchPublishedStream({clearLocalMedia:true,silent:true}).catch(()=>{});toast(e?.message||'Não foi possível transmitir este vídeo.',7000)}
}
async function toggleWatchScreen(){
  if(!state.user||!state.watchCode)return toast('Entre numa sala primeiro.');

  if(state.watchRtc.screenStream){await stopWatchPublishedStream();return}

  if(!navigator.mediaDevices?.getDisplayMedia)return toast('Este navegador não oferece captura de tela. Você pode assistir aqui e compartilhar pelo Chrome ou Edge no computador.');
  if(!await ensureWatchRtcSession())return;

  try{
    setWatchRtcStatus('Escolha a tela ou janela para compartilhar...','warn');

    // audio:true solicita o áudio da aba/tela quando o navegador/SO oferece suporte.
    // Em Chrome/Edge, ao compartilhar uma aba, marque "Compartilhar áudio".
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{frameRate:{ideal:24,max:30},width:{ideal:1280,max:1920},height:{ideal:720,max:1080}},
      audio:{suppressLocalAudioPlayback:false},
      systemAudio:'include',
      windowAudio:'system',
      surfaceSwitching:'include'
    });

    const videoTrack=stream.getVideoTracks()[0];
    try{if(videoTrack)videoTrack.contentHint='motion'}catch{}
    const screenAudioTrack=stream.getAudioTracks()[0]||null;
    if(screenAudioTrack){screenAudioTrack.enabled=true;try{screenAudioTrack.contentHint='music'}catch{}}
    if(!videoTrack)throw new Error('Nenhuma tela selecionada.');

    state.watchRtc.screenStream=stream;state.watchRtc.screenSource='screen';
    state.watchRtc.activeScreenUid=String(state.user.uid);
    state.watchRtc.screenSharers.add(String(state.user.uid));

    await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{
      screen:true,screenAt:Date.now(),screenAudio:!!screenAudioTrack
    });

    const ids=Object.keys(state.watchRtc.presence||{}).filter(uid=>uid!==state.user.uid);
    for(const uid of ids){
      let pc=state.watchRtc.peers.get(uid);if(!pc)pc=await createWatchPeer(uid,false);
      await syncLocalScreenToPeer(uid,'screen-start').catch(()=>{})
    }

    videoTrack.onended=()=>{if(state.watchRtc.screenStream)toggleWatchScreen().catch(()=>{})};
    if(screenAudioTrack)screenAudioTrack.onended=()=>refreshWatchScreenStage();

    setWatchRtcStatus(screenAudioTrack?'Tela e áudio sendo compartilhados':'Tela compartilhada sem áudio','ok');
    refreshWatchScreenStage();watchVoiceUi();

    if(screenAudioTrack)toast('Tela + áudio compartilhados com a sala.');
    else toast('Tela compartilhada. Para transmitir som, no seletor do navegador marque “Compartilhar áudio”.',6000)
  }catch(e){
    state.watchRtc.screenStream=null;state.watchRtc.screenSource='';state.watchRtc.screenSharers.delete(String(state.user?.uid||''));
    if(state.watchCode&&state.user)await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{screen:false,screenAt:null,screenAudio:false}).catch(()=>{});
    setWatchRtcStatus('Compartilhamento não iniciado','');
    if(e?.name!=='NotAllowedError')toast(`Não foi possível compartilhar a tela${e?.message?`: ${e.message}`:'.'}`);
    watchVoiceUi()
  }
}
function watchFullscreenIsActive(){const stage=$('watchScreenStage');return !!stage&&(document.fullscreenElement===stage||document.webkitFullscreenElement===stage||document.body.classList.contains('watch-pseudo-fullscreen'))}
function clearWatchFullscreenUiTimer(){if(state.watchRtc.fullscreenUiTimer){clearTimeout(state.watchRtc.fullscreenUiTimer);state.watchRtc.fullscreenUiTimer=null}}
function showWatchFullscreenUi(autoHide=true){
  const stage=$('watchScreenStage');if(!stage)return;stage.classList.remove('watch-fullscreen-ui-hidden');clearWatchFullscreenUiTimer();
  if(autoHide&&watchFullscreenIsActive())state.watchRtc.fullscreenUiTimer=setTimeout(()=>{if(watchFullscreenIsActive())stage.classList.add('watch-fullscreen-ui-hidden')},2800)
}
function updateWatchFullscreenButton(){
  const btn=$('watchScreenFullscreenBtn'),stage=$('watchScreenStage');if(btn)btn.textContent=watchFullscreenIsActive()?'Sair da tela cheia':'Tela cheia';
  if(!watchFullscreenIsActive()){stage?.classList.remove('watch-fullscreen-ui-hidden');clearWatchFullscreenUiTimer()}else showWatchFullscreenUi(true)
}
async function fullscreenWatchScreen(){
  const stage=$('watchScreenStage'),video=$('watchScreenVideo');if(!stage||stage.hidden)return toast('Nenhuma transmissão está disponível.');
  try{
    if(document.body.classList.contains('watch-pseudo-fullscreen')){document.body.classList.remove('watch-pseudo-fullscreen');updateWatchFullscreenButton();return}
    const nativeActive=document.fullscreenElement===stage||document.webkitFullscreenElement===stage;
    if(nativeActive){
      if(document.exitFullscreen)await document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      updateWatchFullscreenButton();return
    }
    if(stage.requestFullscreen){await stage.requestFullscreen();updateWatchFullscreenButton();return}
    if(stage.webkitRequestFullscreen){stage.webkitRequestFullscreen();updateWatchFullscreenButton();return}
    if(video?.webkitEnterFullscreen){
      const hadControls=video.controls;video.controls=true;
      const restore=()=>{video.controls=hadControls;updateWatchFullscreenButton()};
      video.addEventListener('webkitendfullscreen',restore,{once:true});
      video.webkitEnterFullscreen();return
    }
    document.body.classList.add('watch-pseudo-fullscreen');updateWatchFullscreenButton()
  }catch{
    document.body.classList.add('watch-pseudo-fullscreen');updateWatchFullscreenButton()
  }
}
document.addEventListener('fullscreenchange',updateWatchFullscreenButton);
document.addEventListener('webkitfullscreenchange',updateWatchFullscreenButton);
$('watchScreenSoundBtn')?.addEventListener('click',async()=>{
  showWatchFullscreenUi(true);const audio=$('watchScreenAudio');state.watchRtc.screenSoundMuted=audio?.paused?false:!state.watchRtc.screenSoundMuted;refreshWatchScreenStage();
  if(!state.watchRtc.screenSoundMuted&&audio?.srcObject){try{audio.muted=false;audio.volume=1;await audio.play();toast('Som da transmissão ativado.')}catch{state.watchRtc.screenSoundMuted=true;refreshWatchScreenStage();toast('Toque novamente em Som para liberar o áudio da transmissão.')}}
});
const watchFsStage=$('watchScreenStage');
['pointermove','pointerdown','touchstart'].forEach(type=>watchFsStage?.addEventListener(type,()=>{if(watchFullscreenIsActive())showWatchFullscreenUi(true)},{passive:true}));
async function leaveWatchVoice(silent=false){
  document.body.classList.remove('watch-pseudo-fullscreen');clearWatchFullscreenUiTimer();$('watchScreenStage')?.classList.remove('watch-fullscreen-ui-hidden');updateWatchFullscreenButton();
  if(!state.watchRtc.joined&&!state.watchRtc.localStream&&!state.watchRtc.peers.size)return;
  const code=state.watchCode,uid=state.user?.uid;
  try{state.watchRtc.presenceUnsub?.()}catch{}try{state.watchRtc.inboxUnsub?.()}catch{}try{await state.watchRtc.disconnectRef?.cancel?.()}catch{}
  state.watchRtc.presenceUnsub=null;state.watchRtc.inboxUnsub=null;state.watchRtc.disconnectRef=null;
  for(const pc of state.watchRtc.peers.values()){try{pc.close()}catch{}}
  state.watchRtc.peers.clear();state.watchRtc.remoteStreams.clear();state.watchRtc.remoteVoiceStreams.clear();state.watchRtc.remoteScreenStreams.clear();state.watchRtc.localStream?.getTracks?.().forEach(t=>t.stop());state.watchRtc.screenStream?.getTracks?.().forEach(t=>t.stop());
  cleanupWatchLocalFilePlayer();state.watchRtc.localStream=null;state.watchRtc.screenStream=null;state.watchRtc.screenSource='';state.watchRtc.joined=false;state.watchRtc.audioJoined=false;state.watchRtc.activeScreenUid=null;state.watchRtc.micEnabled=true;
  state.watchRtc.processed.clear();state.watchRtc.pendingCandidates.clear();state.watchRtc.screenSharers.clear();state.watchRtc.presence={};state.watchRtc.screenRetry.clear();state.watchRtc.makingOffer.clear();
  if(code&&uid){await remove(ref(db,`watchVoice/${code}/${uid}`)).catch(()=>{});await remove(ref(db,`watchRtc/${code}/${uid}`)).catch(()=>{})}
  if($('watchRemoteMedia'))$('watchRemoteMedia').innerHTML='';if($('watchVoiceCount'))$('watchVoiceCount').textContent='0';
  destroyWatchMusicPlayback();refreshWatchScreenStage();watchVoiceUi();if(!silent)toast('Você saiu da chamada.')
}
$('watchJoinVoiceBtn')?.addEventListener('click',joinWatchVoice);
$('watchMicBtn')?.addEventListener('click',toggleWatchMic);
$('watchShareBtn')?.addEventListener('click',toggleWatchScreen);
$('watchScreenFullscreenBtn')?.addEventListener('click',fullscreenWatchScreen);
$('watchLeaveVoiceBtn')?.addEventListener('click',()=>leaveWatchAudio(false));
watchVoiceUi();

// RPG
$('createRoomOpen').addEventListener('click',()=>openModal('createRoomModal'));$('refreshRoomsBtn').addEventListener('click',loadMyRooms);$('joinRoomForm').addEventListener('submit',async ev=>{ev.preventDefault();const code=$('joinRoomCode').value.trim().toUpperCase();if(code)await joinRoom(code)});$('createRoomForm').addEventListener('submit',createRoom);$('leaveTableView').addEventListener('click',closeTableView);$('exitRoomBtn').addEventListener('click',exitRoom);$('copyInviteBtn').addEventListener('click',copyInvite);$('characterBtn').addEventListener('click',openCharacter);$('characterForm').addEventListener('submit',saveCharacter);$('editSceneBtn').addEventListener('click',()=>{if(!isRoomOwner())return toast('Só o mestre pode editar a cena.');const s=state.room?.scene||{};$('sceneTitleInput').value=s.title||'';$('sceneDescriptionInput').value=s.description||'';$('sceneImageInput').value=s.image||'';openModal('sceneModal')});$('sceneForm').addEventListener('submit',saveScene);$('saveRulesBtn').addEventListener('click',saveRules);$('rollInitiativeBtn').addEventListener('click',rollInitiative);$('clearInitiativeBtn')?.addEventListener('click',clearInitiative);$('chatForm').addEventListener('submit',sendChat);$('customRollForm').addEventListener('submit',ev=>{ev.preventDefault();rollDice($('customRollInput').value.trim())});$$('[data-die]').forEach(btn=>btn.addEventListener('click',()=>rollDice(`1d${btn.dataset.die}`)));$$('[data-table-tab]').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.tableTab;$$('[data-table-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tableTab===tab));$$('[data-table-pane]').forEach(p=>p.classList.toggle('active',p.dataset.tablePane===tab))}));
async function uniqueRoomCode(){for(let i=0;i<8;i++){const c=randomCode();const s=await get(ref(db,`rpgRooms/${c}`));if(!s.exists())return c}throw new Error('Não foi possível gerar o código.')}
async function createRoom(ev){ev.preventDefault();if(!state.user)return;try{const code=await uniqueRoomCode();const now=nowIso();const name=$('roomNameInput').value.trim();const room={meta:{code,name,system:$('roomSystemInput').value,privacy:'invite',ownerUid:state.user.uid,createdAt:now},scene:{title:'A aventura começa aqui',description:'',image:''},rules:'',members:{[state.user.uid]:{uid:state.user.uid,name:displayName(),avatar:avatarFor(),role:'Mestre',joinedAt:now}}};await set(ref(db,`rpgRooms/${code}`),room);await set(ref(db,`rpgUserRooms/${state.user.uid}/${code}`),{code,name,system:room.meta.system,role:'Mestre',joinedAt:now});closeModal('createRoomModal');$('createRoomForm').reset();await openRoom(code)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível criar a mesa.'),6000)}}
async function loadMyRooms(){if(!state.user)return;const wrap=$('myRooms');wrap.innerHTML='<div class="loading-line">Carregando...</div>';try{const s=await get(ref(db,`rpgUserRooms/${state.user.uid}`));wrap.innerHTML='';const rooms=s.exists()?Object.values(s.val()):[];$('homeRpgRecent').textContent=rooms.length?`${rooms.length} mesa${rooms.length===1?'':'s'}`:'Suas mesas';if(!rooms.length){wrap.innerHTML='<div class="empty-state small">Nenhuma mesa.</div>';return}rooms.sort((a,b)=>String(b.joinedAt||'').localeCompare(String(a.joinedAt||''))).forEach(r=>{const item=document.createElement('div');item.className='room-item';const c=document.createElement('div');const st=document.createElement('strong');st.textContent=r.name||r.code;const sm=document.createElement('small');sm.textContent=`${r.system||'Livre'} • ${r.code}`;c.append(st,sm);const acts=document.createElement('div');acts.className='room-item-actions';const b=document.createElement('button');b.className='btn';b.textContent='Entrar';b.onclick=()=>openRoom(r.code);acts.appendChild(b);if(r.role==='Mestre'){const del=document.createElement('button');del.className='btn danger-ghost';del.textContent='Apagar';del.onclick=()=>deleteRoomFromLobby(r.code,r.name);acts.appendChild(del)}item.append(c,acts);wrap.appendChild(item)})}catch(e){wrap.innerHTML=`<div class="empty-state small">${permissionMessage(e)}</div>`}}
async function deleteRoomFromLobby(code,name='Mesa'){
  if(!state.user||!code)return;if(!confirm(`Apagar "${name||code}" para todos?`))return;
  try{const snap=await get(ref(db,`rpgRooms/${code}`));if(!snap.exists()){await remove(ref(db,`rpgUserRooms/${state.user.uid}/${code}`));return loadMyRooms()}const room=snap.val();if(room.meta?.ownerUid!==state.user.uid)throw new Error('Só o mestre pode apagar esta mesa.');const members=room.members||{};await Promise.all(Object.keys(members).map(uid=>remove(ref(db,`rpgUserRooms/${uid}/${code}`)).catch(()=>{})));await remove(ref(db,`rpgRooms/${code}`));await remove(ref(db,`rpgVoice/${code}`)).catch(()=>{});await remove(ref(db,`rpgRtc/${code}`)).catch(()=>{});toast('Mesa apagada.');loadMyRooms()}catch(e){toast(permissionMessage(e,e.message||'Não foi possível apagar a mesa.'),6000)}
}
async function joinRoom(code){if(!state.user)return;code=String(code||'').toUpperCase();try{const s=await get(ref(db,`rpgRooms/${code}`));if(!s.exists())return toast('Mesa não encontrada.');const room=s.val();const member={uid:state.user.uid,name:displayName(),avatar:avatarFor(),role:room.meta?.ownerUid===state.user.uid?'Mestre':'Jogador',joinedAt:nowIso()};await set(ref(db,`rpgRooms/${code}/members/${state.user.uid}`),member);await set(ref(db,`rpgUserRooms/${state.user.uid}/${code}`),{code,name:room.meta?.name||code,system:room.meta?.system||'Livre',role:member.role,joinedAt:nowIso()});$('joinRoomCode').value='';await openRoom(code)}catch(e){toast(permissionMessage(e,'Não foi possível entrar na mesa.'),6000)}}
function clearRoomSubscriptions(){clearUnsubs(state.roomUnsubs)}
async function openRoom(code){clearRoomSubscriptions();state.roomCode=code;$('rpgLobby').hidden=true;$('rpgTable').hidden=false;const unsub=onValue(ref(db,`rpgRooms/${code}`),s=>{if(!s.exists()){toast('Essa mesa não existe mais.');closeTableView();return}state.room=s.val();renderRoom()},e=>toast(permissionMessage(e),6000));state.roomUnsubs.push(unsub);navigate('rpg')}
function closeTableView(){leaveVoice(true).catch(()=>{});clearRoomSubscriptions();state.roomCode=null;state.room=null;$('rpgTable').hidden=true;$('rpgLobby').hidden=false;loadMyRooms()}
async function exitRoom(){if(!state.user||!state.roomCode)return;const code=state.roomCode;try{if(isRoomOwner()){if(!confirm('Excluir esta mesa para todos?'))return;const members=state.room?.members||{};await Promise.all(Object.keys(members).map(uid=>remove(ref(db,`rpgUserRooms/${uid}/${code}`)).catch(()=>{})));await remove(ref(db,`rpgRooms/${code}`))}else{await remove(ref(db,`rpgRooms/${code}/members/${state.user.uid}`));await remove(ref(db,`rpgUserRooms/${state.user.uid}/${code}`))}closeTableView()}catch(e){toast(permissionMessage(e),6000)}}
function isRoomOwner(){return !!state.user&&state.room?.meta?.ownerUid===state.user.uid}
function roomCharacter(uid=state.user?.uid){return state.room?.characters?.[uid]||null}
function rpgDisplayName(uid=state.user?.uid){
  const ch=roomCharacter(uid),member=state.room?.members?.[uid];
  return ch?.playerName||ch?.name||member?.name||state.directory?.[uid]?.nome||'Jogador'
}
function rpgAvatar(uid=state.user?.uid){
  const ch=roomCharacter(uid),member=state.room?.members?.[uid];
  return ch?.playerAvatar||member?.avatar||state.directory?.[uid]?.avatar||DEFAULT_AVATAR
}

const RPG_SYSTEMS={
  'D&D 5e':{mode:'d20',summary:'Testes: d20 + modificador. Vantagem/desvantagem rola 2d20 e mantém o maior/menor. Iniciativa usa Destreza.',stats:['str','dex','con','int','wis','cha']},
  'Tormenta 20':{mode:'d20',summary:'Testes: d20 + bônus. O painel usa atributos e um bônus de perícia informado pelo jogador. Iniciativa usa o modificador de iniciativa.',stats:['for','des','con','int','sab','car']},
  'Ordem Paranormal':{mode:'pool',summary:'Teste de atributo: role uma quantidade de d20 igual ao atributo e mantenha o maior; atributo 0 rola 2d20 e mantém o menor. Some o bônus de perícia.',stats:['agi','for','int','pre','vig']},
  'Call of Cthulhu':{mode:'d100',summary:'Teste percentual: d100 <= valor. Difícil usa metade; extremo usa um quinto. Ordem de combate usa DEX como referência.',stats:['str','con','siz','dex','app','int','pow','edu','luck']},
  'Livre':{mode:'free',summary:'Rolagens livres. O mestre define a interpretação.',stats:[]},
  'Outro':{mode:'free',summary:'Rolagens livres. Registre as regras específicas da mesa na aba Regras.',stats:[]}
};
const RPG_LABELS={str:'FOR',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR',for:'FOR',des:'DES',sab:'SAB',car:'CAR',agi:'AGI',pre:'PRE',vig:'VIG',siz:'TAM',app:'APA',pow:'POD',edu:'EDU',luck:'SORTE'};
function rpgSystemKey(){const s=String(state.room?.meta?.system||'Livre');return RPG_SYSTEMS[s]?s:'Outro'}
function abilityMod(score){return Math.floor((Number(score||10)-10)/2)}
function currentCharacter(){return state.room?.characters?.[state.user?.uid]||{}}
function renderCharacterSystemFields(ch=currentCharacter()){
  const box=$('characterSystemFields');if(!box)return;box.innerHTML='';const system=rpgSystemKey(),def=RPG_SYSTEMS[system],stats=ch.systemStats||{};
  if(!def.stats.length){box.innerHTML='<small class="muted">Este sistema usa a ficha livre acima.</small>';return}
  const title=document.createElement('div');title.className='character-system-title';title.innerHTML=`<strong>${escText(system)}</strong><small>Atributos usados pelo assistente de rolagem</small>`;box.appendChild(title);
  const grid=document.createElement('div');grid.className='character-stat-grid';
  for(const key of def.stats){const label=document.createElement('label');label.textContent=RPG_LABELS[key]||key.toUpperCase();const input=document.createElement('input');input.type='number';input.dataset.rpgStat=key;input.min=system==='Call of Cthulhu'?'1':system==='Tormenta 20'?'-5':'0';input.max=system==='Call of Cthulhu'?'99':system==='Ordem Paranormal'?'5':system==='Tormenta 20'?'20':'30';input.value=stats[key]??(system==='Call of Cthulhu'?50:system==='Ordem Paranormal'?1:system==='Tormenta 20'?0:10);label.appendChild(input);grid.appendChild(label)}
  box.appendChild(grid);
  const extras=document.createElement('div');extras.className='character-stat-grid extras';
  if(system==='D&D 5e'){extras.innerHTML=`<label>Bônus de proficiência<input type="number" data-rpg-extra="proficiency" min="2" max="9" value="${Number(stats.proficiency||2)}"></label>`}
  if(system==='Tormenta 20'){extras.innerHTML=`<label>Iniciativa<input type="number" data-rpg-extra="initiative" min="-20" max="50" value="${Number(stats.initiative||0)}"></label><label>PM atual<input type="number" data-rpg-extra="pm" min="0" value="${Number(stats.pm||0)}"></label><label>PM máximo<input type="number" data-rpg-extra="maxPm" min="0" value="${Number(stats.maxPm||0)}"></label>`}
  if(system==='Ordem Paranormal'){extras.innerHTML=`<label>Bônus de perícia<input type="number" data-rpg-extra="skillBonus" min="0" max="30" step="5" value="${Number(stats.skillBonus||0)}"></label>`}
  if(extras.children.length)box.appendChild(extras)
}
function collectCharacterSystemStats(){const out={};$$('[data-rpg-stat]').forEach(i=>out[i.dataset.rpgStat]=Number(i.value||0));$$('[data-rpg-extra]').forEach(i=>out[i.dataset.rpgExtra]=Number(i.value||0));return out}
function rollD20(mode='normal'){const a=secureInt(20),b=secureInt(20);return mode==='adv'?Math.max(a,b):mode==='dis'?Math.min(a,b):a}
function ordemPool(attr){const n=Number(attr||0);if(n<=0){const a=secureInt(20),b=secureInt(20);return{rolls:[a,b],kept:Math.min(a,b)}}const rolls=Array.from({length:Math.min(5,n)},()=>secureInt(20));return{rolls,kept:Math.max(...rolls)}}
async function pushSystemRoll(label,total,detail,formula){if(!state.user||!state.roomCode)return;try{await push(ref(db,`rpgRooms/${state.roomCode}/rolls`),{uid:state.user.uid,name:rpgDisplayName(),formula:formula||label,total,detail,label,system:rpgSystemKey(),at:nowIso()})}catch(e){toast(permissionMessage(e),6000)}}
async function rpgSystemCheck(key,mode='normal'){
  const system=rpgSystemKey(),ch=currentCharacter(),s=ch.systemStats||{};
  if(system==='D&D 5e'){const score=Number(s[key]??10),mod=abilityMod(score),die=rollD20(mode),total=die+mod;return pushSystemRoll(`${RPG_LABELS[key]} ${mode==='adv'?'(vantagem)':mode==='dis'?'(desvantagem)':''}`,total,`d20 ${die} ${mod>=0?'+':''}${mod}`,`1d20${mod>=0?'+':''}${mod}`)}
  if(system==='Tormenta 20'){const mod=Number(s[key]??0),die=secureInt(20),total=die+mod;return pushSystemRoll(RPG_LABELS[key],total,`d20 ${die} ${mod>=0?'+':''}${mod}`,`1d20${mod>=0?'+':''}${mod}`)}
  if(system==='Ordem Paranormal'){const r=ordemPool(Number(s[key]??1)),bonus=Number(s.skillBonus||0),total=r.kept+bonus;return pushSystemRoll(RPG_LABELS[key],total,`${r.rolls.join(', ')} → ${r.kept}${bonus?` + ${bonus}`:''}`,`${Math.max(1,Number(s[key]||1))}d20 keep`)}
  if(system==='Call of Cthulhu'){const target=Number(s[key]??50),roll=secureInt(100),level=roll<=Math.floor(target/5)?'Extremo':roll<=Math.floor(target/2)?'Difícil':roll<=target?'Sucesso':'Falha';return pushSystemRoll(`${RPG_LABELS[key]} • ${level}`,roll,`Alvo ${target}%`,`1d100 <= ${target}`)}
  return rollDice('1d20')
}
function renderRpgSystemTools(){
  const box=$('rpgSystemActions'),system=rpgSystemKey(),def=RPG_SYSTEMS[system]||RPG_SYSTEMS.Outro;if(!box)return;box.innerHTML='';$('rpgSystemTitle').textContent=system;$('rpgSystemMode').textContent=def.mode==='d100'?'Percentual':def.mode==='pool'?'Pool de d20':def.mode==='d20'?'d20':'Livre';$('rpgSystemSummary').textContent=def.summary;
  const ch=currentCharacter(),stats=ch.systemStats||{};
  if(!def.stats.length){const b=document.createElement('button');b.type='button';b.className='mini-btn';b.textContent='Rolar d20';b.onclick=()=>rollDice('1d20');box.appendChild(b);return}
  for(const key of def.stats){const b=document.createElement('button');b.type='button';b.className='mini-btn rpg-stat-roll';b.textContent=RPG_LABELS[key]||key.toUpperCase();b.onclick=()=>rpgSystemCheck(key,'normal');box.appendChild(b)}
  if(system==='D&D 5e'){const adv=document.createElement('button');adv.type='button';adv.className='mini-btn';adv.textContent='Vantagem DES';adv.onclick=()=>rpgSystemCheck('dex','adv');const dis=document.createElement('button');dis.type='button';dis.className='mini-btn';dis.textContent='Desvantagem DES';dis.onclick=()=>rpgSystemCheck('dex','dis');box.append(adv,dis)}
}

function renderRoom(){
  const r=state.room||{};$('tableRoomName').textContent=r.meta?.name||'Mesa';$('tableSystem').textContent=r.meta?.system||'Livre';$('tableCode').textContent=state.roomCode||'';
  renderMembers(r.members||{},r.characters||{});renderInitiative(r.initiative||{});renderScene(r.scene||{});renderRolls(r.rolls||{});renderChat(r.messages||{});renderRpgSystemTools();
  $('roomRules').value=r.rules||'';$('roomRules').readOnly=!isRoomOwner();$('saveRulesBtn').hidden=!isRoomOwner();$('editSceneBtn').hidden=!isRoomOwner();if($('clearInitiativeBtn'))$('clearInitiativeBtn').hidden=!isRoomOwner();
  const mine=r.characters?.[state.user?.uid];
  if(mine)fillCharacterForm(mine);
  else if(state.user&&state.roomCode){
    const key=`gremory:rpgProfilePrompt:${state.roomCode}:${state.user.uid}`;
    if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');setTimeout(()=>{fillCharacterForm({});openModal('characterModal');toast('Crie seu perfil desta mesa. Ele não altera sua conta Gremory.',4500)},350)}
  }
}
function renderMembers(members,chars){
  const wrap=$('memberList');wrap.innerHTML='';const list=Object.values(members);$('memberCount').textContent=String(list.length);
  list.forEach(m=>{const ch=chars[m.uid]||{},row=document.createElement('div');row.className='member-item';const img=document.createElement('img');img.src=ch.playerAvatar||m.avatar||DEFAULT_AVATAR;const s=document.createElement('span');const st=document.createElement('strong');st.textContent=ch.playerName||m.name||'Jogador';const sm=document.createElement('small');sm.textContent=ch.name?`${ch.name}${ch.className?' • '+ch.className:''}${m.role==='Mestre'?' • Mestre':''}`:(m.role||'Jogador');s.append(st,sm);row.append(img,s);wrap.appendChild(row)})
}
function renderInitiative(obj){const wrap=$('initiativeList');wrap.innerHTML='';const rows=Object.values(obj).sort((a,b)=>Number(b.value)-Number(a.value));if(!rows.length){wrap.innerHTML='<div class="empty-state small">Sem iniciativa.</div>';return}rows.forEach(x=>{const d=document.createElement('div');d.className='initiative-item';const s=document.createElement('span');s.textContent=x.name||'Jogador';const b=document.createElement('b');b.textContent=String(x.value);d.append(s,b);wrap.appendChild(d)})}
function renderScene(scene){$('sceneTitle').textContent=scene.title||'A aventura começa aqui';$('sceneDescription').textContent=scene.description||'O mestre pode mudar a cena.';const img=$('sceneImage');if(scene.image){img.src=scene.image;img.hidden=false;$('scenePlaceholder').hidden=true}else{img.hidden=true;$('scenePlaceholder').hidden=false}}
function valuesRecent(obj,limit=20){return Object.entries(obj||{}).map(([id,v])=>({id,...v})).sort((a,b)=>String(a.at||'').localeCompare(String(b.at||''))).slice(-limit)}
function renderRolls(obj){const wrap=$('rollLog');wrap.innerHTML='';valuesRecent(obj,12).reverse().forEach(x=>{const d=document.createElement('div');d.className='roll-chip';const s=document.createElement('strong');s.textContent=`${x.formula} = ${x.total}`;const sm=document.createElement('small');sm.textContent=`${x.name||'Jogador'}${x.detail?' • '+x.detail:''}`;d.append(s,sm);wrap.appendChild(d)})}
function renderChat(obj){const wrap=$('chatList');const atBottom=wrap.scrollHeight-wrap.scrollTop-wrap.clientHeight<60;wrap.innerHTML='';valuesRecent(obj,80).forEach(m=>{const d=document.createElement('div');d.className='chat-msg'+(m.uid===state.user?.uid?' mine':'');const head=document.createElement('div');const st=document.createElement('strong');st.textContent=m.name||'Jogador';const t=document.createElement('time');t.textContent=shortDateTime(m.at).split(' ')[1]||'';head.append(st,t);const p=document.createElement('p');p.textContent=m.text||'';d.append(head,p);wrap.appendChild(d)});if(atBottom)wrap.scrollTop=wrap.scrollHeight}
async function sendChat(ev){ev.preventDefault();if(!state.user||!state.roomCode)return;const text=$('chatInput').value.trim();if(!text)return;$('chatInput').value='';try{await push(ref(db,`rpgRooms/${state.roomCode}/messages`),{uid:state.user.uid,name:rpgDisplayName(),text:text.slice(0,500),at:nowIso()})}catch(e){toast(permissionMessage(e),6000)}}
function secureInt(max){const b=new Uint32Array(1);crypto.getRandomValues(b);return(b[0]%max)+1}
function parseRoll(formula){const m=String(formula||'').toLowerCase().replace(/\s/g,'').match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/);if(!m)return null;const count=Math.min(20,Number(m[1]));const sides=Number(m[2]);const mod=Number(m[3]||0);const rolls=Array.from({length:count},()=>secureInt(sides));return{formula:`${count}d${sides}${mod>0?'+'+mod:mod<0?mod:''}`,rolls,total:rolls.reduce((a,b)=>a+b,0)+mod}}
async function rollDice(formula){if(!state.user||!state.roomCode)return;const result=parseRoll(formula);if(!result)return toast('Use algo como 1d20 ou 2d6+3.');try{await push(ref(db,`rpgRooms/${state.roomCode}/rolls`),{uid:state.user.uid,name:rpgDisplayName(),...result,at:nowIso()})}catch(e){toast(permissionMessage(e),6000)}}
async function rollInitiative(){
  if(!state.user||!state.roomCode)return;const ch=currentCharacter(),system=rpgSystemKey(),s=ch.systemStats||{};let value=secureInt(20),detail='1d20';
  if(system==='D&D 5e'){const mod=abilityMod(Number(s.dex??10));value+=mod;detail=`1d20 ${mod>=0?'+':''}${mod}`}
  else if(system==='Tormenta 20'){const mod=Number(s.initiative||0);value+=mod;detail=`1d20 ${mod>=0?'+':''}${mod}`}
  else if(system==='Ordem Paranormal'){const r=ordemPool(Number(s.agi??1));value=r.kept+Number(s.skillBonus||0);detail=`AGI [${r.rolls.join(', ')}]`}
  else if(system==='Call of Cthulhu'){value=Number(s.dex||50);detail='Ordem por DEX'}
  const name=ch.name||rpgDisplayName();try{await set(ref(db,`rpgRooms/${state.roomCode}/initiative/${state.user.uid}`),{uid:state.user.uid,name,value,detail,system,at:nowIso()});toast(`Iniciativa: ${value}`)}catch(e){toast(permissionMessage(e),6000)}
}
async function clearInitiative(){if(!isRoomOwner()||!state.roomCode)return toast('Só o mestre pode limpar a iniciativa.');if(!confirm('Limpar toda a iniciativa desta cena?'))return;try{await remove(ref(db,`rpgRooms/${state.roomCode}/initiative`));toast('Iniciativa limpa.')}catch(e){toast(permissionMessage(e),6000)}}
function openCharacter(){if(!state.user||!state.roomCode)return;fillCharacterForm(state.room?.characters?.[state.user.uid]||{});openModal('characterModal')}
function fillCharacterForm(ch){if($('charAlias'))$('charAlias').value=ch.playerName||state.profile?.nome||displayName();if($('charAvatar'))$('charAvatar').value=ch.playerAvatar||avatarFor();$('charName').value=ch.name||'';$('charClass').value=ch.className||'';$('charLevel').value=ch.level||1;$('charHp').value=ch.hp??10;$('charMaxHp').value=ch.maxHp??10;$('charDefense').value=ch.defense??10;$('charNotes').value=ch.notes||'';renderCharacterSystemFields(ch)}
async function saveCharacter(ev){
  ev.preventDefault();if(!state.user||!state.roomCode)return;
  const playerName=$('charAlias').value.trim().slice(0,40),name=$('charName').value.trim().slice(0,50);
  if(!playerName||!name)return toast('Preencha seu nome na mesa e o nome do personagem.');
  const ch={playerName,playerAvatar:$('charAvatar').value.trim(),name,className:$('charClass').value.trim().slice(0,50),level:Math.max(1,Number($('charLevel').value||1)),hp:Math.max(0,Number($('charHp').value||0)),maxHp:Math.max(1,Number($('charMaxHp').value||1)),defense:Math.max(0,Number($('charDefense').value||0)),system:rpgSystemKey(),systemStats:collectCharacterSystemStats(),notes:$('charNotes').value.trim().slice(0,1000),updatedAt:nowIso()};
  try{await set(ref(db,`rpgRooms/${state.roomCode}/characters/${state.user.uid}`),ch);closeModal('characterModal');toast('Perfil desta mesa salvo.')}catch(e){toast(permissionMessage(e),6000)}
}
async function saveScene(ev){ev.preventDefault();if(!isRoomOwner()||!state.roomCode)return;try{await set(ref(db,`rpgRooms/${state.roomCode}/scene`),{title:$('sceneTitleInput').value.trim().slice(0,80)||'Aventura',description:$('sceneDescriptionInput').value.trim().slice(0,300),image:$('sceneImageInput').value.trim()});closeModal('sceneModal');toast('Cena atualizada.')}catch(e){toast(permissionMessage(e),6000)}}
async function saveRules(){if(!isRoomOwner()||!state.roomCode)return;try{await set(ref(db,`rpgRooms/${state.roomCode}/rules`),$('roomRules').value.slice(0,4000));toast('Regras salvas.')}catch(e){toast(permissionMessage(e),6000)}}
async function copyInvite(){if(!state.roomCode)return;const url=`${location.origin}${location.pathname}?rpg=${encodeURIComponent(state.roomCode)}#rpg`;try{await navigator.clipboard.writeText(url);toast('Convite copiado.')}catch{prompt('Copie o convite:',url)}}


// Voz + compartilhamento de tela (WebRTC P2P, Firebase apenas para sinalização)
async function loadRtcConfig(){try{const r=await fetch('/api/main?action=rtc_config',{cache:'no-store'});if(!r.ok)return;const j=await r.json();if(Array.isArray(j.iceServers)&&j.iceServers.length)RTC_CONFIG={iceServers:j.iceServers}}catch{}}
loadRtcConfig();
function voiceUi(){
  const joined=state.rtc.joined;$('voiceStrip')?.classList.toggle('connected',joined);
  if($('voiceStatusText'))$('voiceStatusText').textContent=joined?'Conectado à sala':'Fora da chamada';
  if($('joinVoiceBtn'))$('joinVoiceBtn').hidden=joined;
  if($('toggleMicBtn')){$('toggleMicBtn').hidden=!joined;$('toggleMicBtn').textContent=state.rtc.micEnabled?'Silenciar microfone':'Ativar microfone'}
  if($('shareScreenBtn')){$('shareScreenBtn').hidden=!joined;$('shareScreenBtn').textContent=state.rtc.screenStream?'Parar compartilhamento':'Compartilhar tela'}
  if($('leaveVoiceBtn'))$('leaveVoiceBtn').hidden=!joined;
}
function peerLabel(uid){
  return roomCharacter(uid)?.playerName||state.room?.members?.[uid]?.name||state.friends?.[uid]?.nome||'Participante';
}
function ensureRemoteCard(uid){
  const grid=$('remoteMediaGrid');if(!grid)return null;
  let card=grid.querySelector(`[data-peer="${CSS.escape(uid)}"]`);
  if(!card){card=document.createElement('div');card.className='remote-media-card';card.dataset.peer=uid;const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.setAttribute('playsinline','');const label=document.createElement('span');label.className='remote-label';label.textContent=peerLabel(uid);card.append(video,label);grid.appendChild(card)}
  return card;
}
function attachRemoteStream(uid,stream){
  state.rtc.remoteStreams.set(uid,stream);const card=ensureRemoteCard(uid);const video=card?.querySelector('video');if(video&&video.srcObject!==stream)video.srcObject=stream;
}
function removeRemotePeer(uid){
  const pc=state.rtc.peers.get(uid);if(pc){try{pc.close()}catch{}state.rtc.peers.delete(uid)}
  state.rtc.remoteStreams.delete(uid);const card=$('remoteMediaGrid')?.querySelector(`[data-peer="${CSS.escape(uid)}"]`);if(card)card.remove();
}
async function sendRtc(targetUid,payload){
  if(!state.user||!state.roomCode)return;
  await push(ref(db,`rpgRtc/${state.roomCode}/${targetUid}`),{fromUid:state.user.uid,at:Date.now(),...payload});
}
async function createRtcPeer(peerUid,initiator=false){
  if(state.rtc.peers.has(peerUid))return state.rtc.peers.get(peerUid);
  const pc=new RTCPeerConnection(RTC_CONFIG);state.rtc.peers.set(peerUid,pc);
  const remote=new MediaStream();attachRemoteStream(peerUid,remote);
  for(const track of state.rtc.localStream?.getAudioTracks?.()||[])pc.addTrack(track,state.rtc.localStream);
  const videoTransceiver=pc.addTransceiver('video',{direction:'sendrecv'});
  pc.ontrack=ev=>{const stream=state.rtc.remoteStreams.get(peerUid)||remote;if(!stream.getTracks().some(t=>t.id===ev.track.id))stream.addTrack(ev.track);attachRemoteStream(peerUid,stream)};
  pc.onicecandidate=ev=>{if(ev.candidate)sendRtc(peerUid,{type:'candidate',candidate:ev.candidate.toJSON()}).catch(()=>{})};
  pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState))setTimeout(()=>{if(pc.connectionState!=='connected')removeRemotePeer(peerUid)},1800)};
  if(state.rtc.screenStream?.getVideoTracks?.()[0])await videoTransceiver.sender.replaceTrack(state.rtc.screenStream.getVideoTracks()[0]);
  if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await sendRtc(peerUid,{type:'offer',sdp:offer.sdp})}
  return pc;
}
async function handleRtcMessage(id,msg){
  if(!msg||state.rtc.processed.has(id)||!state.rtc.joined||!state.user)return;
  state.rtc.processed.add(id);const from=String(msg.fromUid||'');if(!from||from===state.user.uid)return;
  try{
    const pc=await createRtcPeer(from,false);
    if(msg.type==='offer'){
      await pc.setRemoteDescription({type:'offer',sdp:msg.sdp});
      const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await sendRtc(from,{type:'answer',sdp:answer.sdp});
    }else if(msg.type==='answer'){
      if(!pc.currentRemoteDescription)await pc.setRemoteDescription({type:'answer',sdp:msg.sdp});
    }else if(msg.type==='candidate'&&msg.candidate){
      try{await pc.addIceCandidate(msg.candidate)}catch{}
    }
  }finally{
    remove(ref(db,`rpgRtc/${state.roomCode}/${state.user.uid}/${id}`)).catch(()=>{});
  }
}
function watchRtcInbox(){
  if(!state.user||!state.roomCode)return;
  try{state.rtc.inboxUnsub?.()}catch{}
  state.rtc.inboxUnsub=onValue(ref(db,`rpgRtc/${state.roomCode}/${state.user.uid}`),s=>{
    const all=s.exists()?s.val():{};Object.entries(all).sort((a,b)=>(a[1]?.at||0)-(b[1]?.at||0)).forEach(([id,msg])=>handleRtcMessage(id,msg).catch(()=>{}));
  });
}
function watchVoicePresence(){
  if(!state.user||!state.roomCode)return;
  try{state.rtc.presenceUnsub?.()}catch{}
  state.rtc.presenceUnsub=onValue(ref(db,`rpgVoice/${state.roomCode}`),s=>{
    const present=s.exists()?s.val():{};const ids=Object.keys(present).filter(uid=>uid!==state.user.uid);
    for(const uid of ids){if(!state.rtc.peers.has(uid)&&state.user.uid.localeCompare(uid)<0)createRtcPeer(uid,true).catch(()=>{})}
    for(const uid of [...state.rtc.peers.keys()])if(!present[uid])removeRemotePeer(uid);
    if($('voiceStatusText'))$('voiceStatusText').textContent=`Na voz • ${ids.length+1} participante${ids.length?'s':''}`;
  },()=>{});
}
async function joinVoice(){
  if(state.rtc.joined)return;if(!state.user||!state.roomCode)return toast('Entre em uma mesa primeiro.');
  if(!navigator.mediaDevices?.getUserMedia)return toast('Seu navegador não oferece suporte à sala de voz.');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    state.rtc.localStream=stream;state.rtc.joined=true;state.rtc.micEnabled=true;state.rtc.processed.clear();
    const presenceRef=ref(db,`rpgVoice/${state.roomCode}/${state.user.uid}`);
    await set(presenceRef,{uid:state.user.uid,name:rpgDisplayName(),joinedAt:Date.now()});
    try{state.rtc.disconnectRef=onDisconnect(presenceRef);await state.rtc.disconnectRef.remove()}catch{}
    watchRtcInbox();watchVoicePresence();voiceUi();
  }catch(e){toast(e?.name==='NotAllowedError'?'Permita o acesso ao microfone para entrar na voz.':'Não foi possível abrir o microfone.')}
}
async function toggleMic(){
  if(!state.rtc.localStream)return;state.rtc.micEnabled=!state.rtc.micEnabled;state.rtc.localStream.getAudioTracks().forEach(t=>t.enabled=state.rtc.micEnabled);voiceUi()
}
async function toggleScreen(){
  if(!state.rtc.joined)return;
  if(state.rtc.screenStream){
    const tracks=state.rtc.screenStream.getTracks();tracks.forEach(t=>t.stop());state.rtc.screenStream=null;
    await Promise.all([...state.rtc.peers.values()].map(async pc=>{const sender=pc.getSenders().find(x=>x.track?.kind==='video')||pc.getTransceivers().find(t=>t.receiver?.track?.kind==='video')?.sender;if(sender)await sender.replaceTrack(null)}));
    voiceUi();return;
  }
  if(!navigator.mediaDevices?.getDisplayMedia)return toast('Compartilhamento de tela não é suportado neste navegador.');
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});state.rtc.screenStream=stream;const track=stream.getVideoTracks()[0];
    await Promise.all([...state.rtc.peers.values()].map(async pc=>{const tr=pc.getTransceivers().find(t=>t.receiver?.track?.kind==='video');if(tr)await tr.sender.replaceTrack(track)}));
    track.onended=()=>{if(state.rtc.screenStream)toggleScreen().catch(()=>{})};voiceUi()
  }catch(e){if(e?.name!=='NotAllowedError')toast('Não foi possível compartilhar a tela.')}
}
async function leaveVoice(silent=false){
  if(!state.rtc.joined&&!state.rtc.localStream&&!state.rtc.peers.size)return;
  const code=state.roomCode,uid=state.user?.uid;
  try{state.rtc.presenceUnsub?.()}catch{}try{state.rtc.inboxUnsub?.()}catch{}state.rtc.presenceUnsub=null;state.rtc.inboxUnsub=null;
  for(const pc of state.rtc.peers.values()){try{pc.close()}catch{}}state.rtc.peers.clear();state.rtc.remoteStreams.clear();
  state.rtc.localStream?.getTracks?.().forEach(t=>t.stop());state.rtc.screenStream?.getTracks?.().forEach(t=>t.stop());
  state.rtc.localStream=null;state.rtc.screenStream=null;state.rtc.joined=false;state.rtc.micEnabled=true;state.rtc.processed.clear();
  if(code&&uid){await remove(ref(db,`rpgVoice/${code}/${uid}`)).catch(()=>{});await remove(ref(db,`rpgRtc/${code}/${uid}`)).catch(()=>{})}
  if($('remoteMediaGrid'))$('remoteMediaGrid').innerHTML='';voiceUi();if(!silent)toast('Você saiu da sala de voz.');
}
$('joinVoiceBtn')?.addEventListener('click',joinVoice);
$('toggleMicBtn')?.addEventListener('click',toggleMic);
$('shareScreenBtn')?.addEventListener('click',toggleScreen);
$('leaveVoiceBtn')?.addEventListener('click',()=>leaveVoice(false));
window.addEventListener('beforeunload',()=>{if(state.rtc.joined&&state.user&&state.roomCode)remove(ref(db,`rpgVoice/${state.roomCode}/${state.user.uid}`)).catch(()=>{});if(state.watchRtc.joined&&state.user&&state.watchCode)remove(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`)).catch(()=>{})});
voiceUi();


let pdfLibPromise=null,pdfJsPromise=null;
async function getPdfLib(){if(!pdfLibPromise)pdfLibPromise=import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');return pdfLibPromise}
async function getPdfJs(){if(!pdfJsPromise)pdfJsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';return m});return pdfJsPromise}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200)}
async function fileBytes(file){return new Uint8Array(await file.arrayBuffer())}
async function busyButton(btn,work,label='Processando...'){if(!btn)return work();const old=btn.textContent;btn.disabled=true;btn.textContent=label;try{return await work()}finally{btn.disabled=false;btn.textContent=old}}
$('pdfMergeBtn')?.addEventListener('click',()=>busyButton($('pdfMergeBtn'),async()=>{const files=[...($('pdfMergeFiles')?.files||[])];if(files.length<2)return toast('Selecione pelo menos 2 PDFs.');try{const{PDFDocument}=await getPdfLib(),out=await PDFDocument.create();for(const f of files){const src=await PDFDocument.load(await fileBytes(f));const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(pg=>out.addPage(pg))}downloadBlob(new Blob([await out.save()],{type:'application/pdf'}),'gremory-documento.pdf');toast('PDF pronto.')}catch(e){toast('Não consegui juntar os PDFs: '+e.message)}}));
$('imagesToPdfBtn')?.addEventListener('click',()=>busyButton($('imagesToPdfBtn'),async()=>{const files=[...($('imagesToPdfFiles')?.files||[])];if(!files.length)return toast('Selecione uma ou mais imagens.');try{const{PDFDocument}=await getPdfLib(),doc=await PDFDocument.create();for(const f of files){const bytes=await fileBytes(f),img=f.type==='image/png'?await doc.embedPng(bytes):await doc.embedJpg(bytes),page=doc.addPage([img.width,img.height]);page.drawImage(img,{x:0,y:0,width:img.width,height:img.height})}downloadBlob(new Blob([await doc.save()],{type:'application/pdf'}),'gremory-imagens.pdf');toast('PDF pronto.')}catch(e){toast('Não consegui criar o PDF: '+e.message)}}));
$('pdfEditBtn')?.addEventListener('click',()=>busyButton($('pdfEditBtn'),async()=>{const f=$('pdfEditFile')?.files?.[0];if(!f)return toast('Selecione um PDF.');try{const{PDFDocument,StandardFonts,rgb,degrees}=await getPdfLib(),doc=await PDFDocument.load(await fileBytes(f)),remove=String($('pdfRemovePages')?.value||'').split(',').map(x=>Number(x.trim())-1).filter(x=>Number.isInteger(x)&&x>=0&&x<doc.getPageCount()).sort((a,b)=>b-a);[...new Set(remove)].forEach(i=>doc.removePage(i));const txt=String($('pdfEditText')?.value||'').trim();if(txt){const font=await doc.embedFont(StandardFonts.HelveticaBold);for(const page of doc.getPages()){const{width,height}=page.getSize();page.drawText(txt,{x:Math.max(20,width*.08),y:height*.52,size:Math.max(18,Math.min(54,width/16)),font,color:rgb(.78,.78,.78),opacity:.22,rotate:degrees(-28)})}}downloadBlob(new Blob([await doc.save()],{type:'application/pdf'}),'gremory-editado.pdf');toast('PDF pronto.')}catch(e){toast('Não consegui editar o PDF: '+e.message)}}));
$('pdfToImageBtn')?.addEventListener('click',()=>busyButton($('pdfToImageBtn'),async()=>{const f=$('pdfToImageFile')?.files?.[0],box=$('pdfImageResults');if(!f)return toast('Selecione um PDF.');try{box.innerHTML='';const pdfjs=await getPdfJs(),pdf=await pdfjs.getDocument({data:await fileBytes(f)}).promise;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),vp=page.getViewport({scale:1.8}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const a=document.createElement('a');a.className='btn';a.textContent=`Página ${n}`;a.download=`gremory-pagina-${n}.png`;a.href=c.toDataURL('image/png');box.appendChild(a)}toast(`${pdf.numPages} página(s) pronta(s).`)}catch(e){box.innerHTML='';toast('Não consegui converter o PDF: '+e.message)}}));
$('pdfToTextBtn')?.addEventListener('click',()=>busyButton($('pdfToTextBtn'),async()=>{const f=$('pdfToImageFile')?.files?.[0];if(!f)return toast('Selecione um PDF.');try{const pdfjs=await getPdfJs(),pdf=await pdfjs.getDocument({data:await fileBytes(f)}).promise;const pages=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();pages.push(`--- Página ${n} ---\n`+content.items.map(x=>x.str).join(' '))}downloadBlob(new Blob([pages.join('\n\n')],{type:'text/plain;charset=utf-8'}),'gremory-texto.txt');toast('Texto extraído.')}catch(e){toast('Não consegui extrair o texto: '+e.message)}}));
$('openBotPdfBtn')?.addEventListener('click',()=>wa('/pdf'));

let fabricPromise=null,designCanvasApp=null,designStudioBoot=null,designSlides=[],designSlideIndex=0,pptxPromise=null;
function designUid(){return `slide_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function emptyDesignSlide(size=String($('canvasPreset')?.value||'1280x720')){return{id:designUid(),name:`Slide ${designSlides.length+1}`,size,background:'#11131a',json:null,thumb:''}}
async function getFabric(){if(!fabricPromise)fabricPromise=import('https://cdn.jsdelivr.net/npm/fabric@7.0.0/+esm').then(m=>m.fabric||m.default||m);return fabricPromise}
function loadExternalScript(src){return new Promise((resolve,reject)=>{const old=[...document.scripts].find(s=>s.src===src);if(old){if(old.dataset.ready==='1')return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>{s.dataset.ready='1';resolve()};s.onerror=()=>reject(new Error('Não foi possível carregar o exportador.'));document.head.appendChild(s)})}
async function getPptx(){if(!pptxPromise)pptxPromise=loadExternalScript('https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js').then(()=>window.PptxGenJS||window.pptxgenjs);const P=await pptxPromise;if(!P)throw new Error('Exportador PowerPoint indisponível.');return P}
function designDimensions(size){const [w,h]=String(size||'1280x720').split('x').map(Number);return{width:w||1280,height:h||720}}
function designActiveObject(){return designCanvasApp?.getActiveObject?.()||null}
function designSelectionName(obj){if(!obj)return'Nenhum elemento selecionado';if(obj.type==='textbox'||obj.type==='text'||obj.type==='i-text')return'Texto selecionado';if(obj.type==='image')return'Imagem selecionada';if(obj.type==='rect')return'Retângulo selecionado';if(obj.type==='circle')return'Círculo selecionado';return'Elemento selecionado'}
function syncDesignInspector(){const obj=designActiveObject();if($('designSelectionLabel'))$('designSelectionLabel').textContent=designSelectionName(obj);if(!obj)return;const fill=typeof obj.fill==='string'&&obj.fill.startsWith('#')?obj.fill:'#ffffff';if($('designObjectColor'))$('designObjectColor').value=fill;if($('designOpacity'))$('designOpacity').value=String(Math.round(Number(obj.opacity??1)*100));if('fontSize'in obj&&$('designFontSize'))$('designFontSize').value=String(Math.round(Number(obj.fontSize||48)));if('fontFamily'in obj&&$('designFontFamily'))$('designFontFamily').value=obj.fontFamily||'Arial';if('textAlign'in obj&&$('designTextAlign'))$('designTextAlign').value=obj.textAlign||'left'}
function fitDesignCanvas(){if(!designCanvasApp)return;const stage=$('designCanvasStage');if(!stage)return;const{width,height}=designDimensions(designSlides[designSlideIndex]?.size);const max=Math.max(280,Math.min(980,stage.clientWidth-34));const scale=Math.min(1,max/width,(Math.max(340,window.innerHeight*.66))/height);try{designCanvasApp.setDimensions({width:Math.round(width*scale),height:Math.round(height*scale)},{cssOnly:true})}catch{}if($('canvasSizeLabel'))$('canvasSizeLabel').textContent=`${width} × ${height}`}
async function saveCurrentDesignSlide(){if(!designCanvasApp||!designSlides[designSlideIndex])return;const slide=designSlides[designSlideIndex];slide.json=designCanvasApp.toJSON();slide.background=designCanvasApp.backgroundColor||'#11131a';try{slide.thumb=designCanvasApp.toDataURL({format:'png',multiplier:.16,quality:.65})}catch{}renderDesignSlideList()}
async function loadDesignSlide(index){if(!designCanvasApp||!designSlides[index])return;if(designSlides[designSlideIndex]&&designSlideIndex!==index)await saveCurrentDesignSlide();designSlideIndex=index;const slide=designSlides[index],{width,height}=designDimensions(slide.size);designCanvasApp.clear();designCanvasApp.setDimensions({width,height});designCanvasApp.backgroundColor=slide.background||'#11131a';if(slide.json)await designCanvasApp.loadFromJSON(slide.json);designCanvasApp.backgroundColor=slide.background||'#11131a';designCanvasApp.requestRenderAll();if($('canvasPreset'))$('canvasPreset').value=slide.size;if($('designBackgroundColor'))$('designBackgroundColor').value=slide.background||'#11131a';fitDesignCanvas();renderDesignSlideList();syncDesignInspector()}
function renderDesignSlideList(){const box=$('designSlideList');if(!box)return;box.innerHTML='';designSlides.forEach((slide,i)=>{slide.name=`Slide ${i+1}`;const b=document.createElement('button');b.type='button';b.className='design-slide-thumb'+(i===designSlideIndex?' active':'');b.innerHTML=slide.thumb?`<img src="${slide.thumb}" alt=""><span>${slide.name}</span>`:`<i></i><span>${slide.name}</span>`;b.onclick=()=>loadDesignSlide(i);box.appendChild(b)});if($('designSlideCount'))$('designSlideCount').textContent=String(designSlides.length)}
async function initGremoryDesignStudio(){
  if(designCanvasApp){fitDesignCanvas();return designCanvasApp}if(designStudioBoot)return designStudioBoot;
  designStudioBoot=(async()=>{const f=await getFabric(),canvasEl=$('designCanvas');if(!canvasEl)throw new Error('Editor indisponível.');designCanvasApp=new f.Canvas(canvasEl,{preserveObjectStacking:true,selection:true,backgroundColor:'#11131a'});designSlides=[emptyDesignSlide('1280x720')];designSlideIndex=0;designCanvasApp.on('selection:created',syncDesignInspector);designCanvasApp.on('selection:updated',syncDesignInspector);designCanvasApp.on('selection:cleared',syncDesignInspector);designCanvasApp.on('object:modified',()=>saveCurrentDesignSlide());await loadDesignSlide(0);return designCanvasApp})();return designStudioBoot
}
async function addDesignObject(kind){const c=await initGremoryDesignStudio(),f=await getFabric(),{width,height}=designDimensions(designSlides[designSlideIndex].size),common={left:width*.18,top:height*.24,cornerColor:'#ff647f',cornerStyle:'circle',transparentCorners:false,padding:4};let obj;if(kind==='title')obj=new f.Textbox('Seu título',{...common,width:width*.64,fontSize:Math.max(54,width*.06),fontWeight:800,fill:'#ffffff',fontFamily:'Arial',textAlign:'left'});else if(kind==='text')obj=new f.Textbox('Escreva aqui',{...common,width:width*.55,fontSize:Math.max(30,width*.032),fill:'#ffffff',fontFamily:'Arial',textAlign:'left'});else if(kind==='rect')obj=new f.Rect({...common,width:width*.28,height:height*.18,rx:24,ry:24,fill:'#d5455f'});else if(kind==='circle')obj=new f.Circle({...common,radius:Math.min(width,height)*.10,fill:'#d5455f'});if(!obj)return;c.add(obj);c.setActiveObject(obj);c.requestRenderAll();syncDesignInspector();await saveCurrentDesignSlide()}
$$('[data-design-add]').forEach(b=>b.addEventListener('click',()=>addDesignObject(b.dataset.designAdd)));
$('designAddImageBtn')?.addEventListener('click',()=>$('designImageInput')?.click());
$('designImageInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const c=await initGremoryDesignStudio(),f=await getFabric(),url=URL.createObjectURL(file);const img=await f.FabricImage.fromURL(url);const{width,height}=designDimensions(designSlides[designSlideIndex].size);img.scaleToWidth(Math.min(width*.55,img.width||width*.55));img.set({left:width*.22,top:height*.18,cornerColor:'#ff647f',cornerStyle:'circle'});c.add(img);c.setActiveObject(img);c.requestRenderAll();URL.revokeObjectURL(url);await saveCurrentDesignSlide()}catch(err){toast(err.message||'Não foi possível adicionar a imagem.')}finally{e.target.value=''}});
$('designDuplicateObjectBtn')?.addEventListener('click',async()=>{const c=await initGremoryDesignStudio(),obj=designActiveObject();if(!obj)return toast('Selecione um elemento.');const copy=await obj.clone();copy.set({left:Number(obj.left||0)+28,top:Number(obj.top||0)+28});c.add(copy);c.setActiveObject(copy);c.requestRenderAll();await saveCurrentDesignSlide()});
$('designDeleteObjectBtn')?.addEventListener('click',async()=>{const c=await initGremoryDesignStudio(),obj=designActiveObject();if(!obj)return;c.remove(obj);c.requestRenderAll();await saveCurrentDesignSlide()});
$('designBringFrontBtn')?.addEventListener('click',async()=>{const c=await initGremoryDesignStudio(),obj=designActiveObject();if(!obj)return;if(c.bringObjectToFront)await c.bringObjectToFront(obj);else obj.bringToFront?.();c.requestRenderAll();await saveCurrentDesignSlide()});
$('designSendBackBtn')?.addEventListener('click',async()=>{const c=await initGremoryDesignStudio(),obj=designActiveObject();if(!obj)return;if(c.sendObjectToBack)await c.sendObjectToBack(obj);else obj.sendToBack?.();c.requestRenderAll();await saveCurrentDesignSlide()});
$('designObjectColor')?.addEventListener('input',async e=>{const obj=designActiveObject();if(!obj)return;obj.set('fill',e.target.value);designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
$('designFontSize')?.addEventListener('input',async e=>{const obj=designActiveObject();if(!obj||!('fontSize'in obj))return;obj.set('fontSize',Math.max(10,Number(e.target.value||48)));designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
$('designFontFamily')?.addEventListener('change',async e=>{const obj=designActiveObject();if(!obj||!('fontFamily'in obj))return;obj.set('fontFamily',e.target.value);designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
$('designTextAlign')?.addEventListener('change',async e=>{const obj=designActiveObject();if(!obj||!('textAlign'in obj))return;obj.set('textAlign',e.target.value);designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
$('designOpacity')?.addEventListener('input',async e=>{const obj=designActiveObject();if(!obj)return;obj.set('opacity',Math.max(.1,Math.min(1,Number(e.target.value||100)/100)));designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
$('designBackgroundColor')?.addEventListener('input',async e=>{await initGremoryDesignStudio();designCanvasApp.backgroundColor=e.target.value;designCanvasApp.requestRenderAll();designSlides[designSlideIndex].background=e.target.value;await saveCurrentDesignSlide()});
$('canvasPreset')?.addEventListener('change',async e=>{await initGremoryDesignStudio();await saveCurrentDesignSlide();designSlides[designSlideIndex].size=e.target.value;const{width,height}=designDimensions(e.target.value);designCanvasApp.setDimensions({width,height});fitDesignCanvas();designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
$('designAddSlideBtn')?.addEventListener('click',async()=>{await initGremoryDesignStudio();await saveCurrentDesignSlide();designSlides.push(emptyDesignSlide(designSlides[designSlideIndex]?.size||'1280x720'));await loadDesignSlide(designSlides.length-1)});
$('designDuplicateSlideBtn')?.addEventListener('click',async()=>{await initGremoryDesignStudio();await saveCurrentDesignSlide();const src=designSlides[designSlideIndex],copy={id:designUid(),name:'',size:src.size,background:src.background,json:structuredClone(src.json),thumb:src.thumb};designSlides.splice(designSlideIndex+1,0,copy);await loadDesignSlide(designSlideIndex+1)});
$('designDeleteSlideBtn')?.addEventListener('click',async()=>{await initGremoryDesignStudio();if(designSlides.length===1){designCanvasApp.clear();designCanvasApp.backgroundColor='#11131a';designSlides[0]=emptyDesignSlide(designSlides[0].size);designCanvasApp.requestRenderAll();return saveCurrentDesignSlide()}designSlides.splice(designSlideIndex,1);designSlideIndex=Math.max(0,Math.min(designSlideIndex,designSlides.length-1));await loadDesignSlide(designSlideIndex)});
$('designClearSlideBtn')?.addEventListener('click',async()=>{await initGremoryDesignStudio();designCanvasApp.remove(...designCanvasApp.getObjects());designCanvasApp.requestRenderAll();await saveCurrentDesignSlide()});
async function designSlideDataUrl(i){await loadDesignSlide(i);designCanvasApp.discardActiveObject();designCanvasApp.requestRenderAll();return designCanvasApp.toDataURL({format:'png',multiplier:1,quality:1})}
$('designExportPngBtn')?.addEventListener('click',()=>busyButton($('designExportPngBtn'),async()=>{await initGremoryDesignStudio();await saveCurrentDesignSlide();const url=await designSlideDataUrl(designSlideIndex),a=document.createElement('a');a.href=url;a.download=`gremory-slide-${designSlideIndex+1}.png`;a.click()},'Exportando...'));
$('designExportPdfBtn')?.addEventListener('click',()=>busyButton($('designExportPdfBtn'),async()=>{await initGremoryDesignStudio();await saveCurrentDesignSlide();const original=designSlideIndex,{PDFDocument}=await getPdfLib(),doc=await PDFDocument.create();for(let i=0;i<designSlides.length;i++){const url=await designSlideDataUrl(i),bytes=await fetch(url).then(r=>r.arrayBuffer()),img=await doc.embedPng(bytes),{width,height}=designDimensions(designSlides[i].size),page=doc.addPage([width,height]);page.drawImage(img,{x:0,y:0,width,height})}downloadBlob(new Blob([await doc.save()],{type:'application/pdf'}),'gremory-apresentacao.pdf');await loadDesignSlide(original);toast('Apresentação exportada em PDF.')},'Exportando...'));
$('designExportPptxBtn')?.addEventListener('click',()=>busyButton($('designExportPptxBtn'),async()=>{await initGremoryDesignStudio();await saveCurrentDesignSlide();const original=designSlideIndex,Pptx=await getPptx(),pptx=new Pptx(),first=designDimensions(designSlides[0].size),w=13.333,h=w*(first.height/first.width);pptx.defineLayout({name:'GREMORY',width:w,height:h});pptx.layout='GREMORY';pptx.author='Gremory';pptx.subject='Apresentação Gremory';for(let i=0;i<designSlides.length;i++){const data=await designSlideDataUrl(i),slide=pptx.addSlide();slide.background={color:'11131A'};slide.addImage({data,x:0,y:0,w,h})}await pptx.writeFile({fileName:'Gremory-apresentacao.pptx',compression:true});await loadDesignSlide(original);toast('PowerPoint exportado.')},'Exportando...'));
window.addEventListener('resize',()=>{if(designCanvasApp&&state.route==='studio')fitDesignCanvas()});
$('studioCanvasShortcut')?.addEventListener('click',()=>{$('canvasStudio')?.scrollIntoView({behavior:'smooth',block:'start'});initGremoryDesignStudio().catch(()=>{})});
$$('[data-studio-scroll]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.studioScroll)?.scrollIntoView({behavior:'smooth',block:'start'})));

// 21 e Forca PvP: lógica e sincronização 100% no Firebase do site.
function cardHtml(c){if(!c)return'';const red=c.s==='♥'||c.s==='♦';return `<i class="playing-card ${red?'red':''}"><b>${escText(c.r||'?')}</b><span>${escText(c.s||'')}</span></i>`}

// 21 PvP
$('blackjackCreateBtn')?.addEventListener('click',async()=>{const targetUid=$('blackjackFriendSelect')?.value;if(!targetUid)return toast('Escolha um amigo.');playGameSfx('select');try{await sendSiteGameChallenge('blackjack',targetUid)}catch(e){toast(permissionMessage(e,e.message))}});
function handleBlackjackIndex(obj){const rows=gameRows(obj),active=rows.find(x=>x.status==='active');if(active){if(state.blackjack.game?.id!==active.id)subscribeBlackjack(active.id);return}const finished=rows.find(x=>x.status==='finished');if(finished&&state.blackjack.game?.id!==finished.id)subscribeBlackjack(finished.id);else if(!finished)setBlackjackGame(null)}
function subscribeBlackjack(id){if(state.blackjack.unsub){try{state.blackjack.unsub()}catch{}}state.blackjack.unsub=onValue(ref(db,`blackjackGames/${id}`),sn=>setBlackjackGame(sn.exists()?{id,...sn.val()}:null))}
function blackjackCardLabel(c={}){return `${c.r||'?'}${c.s||''}`}
function blackjackHandLabel(p={}){const cards=Array.isArray(p.cards)?p.cards:[];return `${cards.map(blackjackCardLabel).join(' + ')||'—'} = ${Number(p.score||0)}`}
function blackjackResultReason(g,me,other){const my=Number(me.score||0),op=Number(other.score||0);if(me.busted&&other.busted)return `As duas mãos estouraram (${my} × ${op}).`;if(me.busted)return `Sua mão estourou com ${my}; ${other.name||'o adversário'} venceu com ${op}.`;if(other.busted)return `${other.name||'O adversário'} estourou com ${op}; sua mão venceu com ${my}.`;if(my===21&&op!==21)return `Você fechou 21 exato contra ${op}.`;if(op===21&&my!==21)return `${other.name||'O adversário'} fechou 21 exato contra ${my}.`;if(my===op)return `As duas mãos terminaram com ${my} pontos.`;const high=Math.max(my,op),low=Math.min(my,op);return `${high} venceu ${low} por ficar mais perto de 21 sem estourar.`}
function setBlackjackGame(g){
  const prev=state.blackjack.game;
  if(g?.status==='active'){
    if(!prev||prev.id!==g.id){playGameSfx('start');setTimeout(()=>playGameSfx('card'),80);if(g.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),220)}
    else if(prev.status==='active'){
      const prevPlayers=prev.players||{},nextPlayers=g.players||{},ids=new Set([...Object.keys(prevPlayers),...Object.keys(nextPlayers)]);let cardsAdded=0,stoodNow=false;
      ids.forEach(uid=>{cardsAdded+=Math.max(0,(nextPlayers[uid]?.cards?.length||0)-(prevPlayers[uid]?.cards?.length||0));if(!prevPlayers[uid]?.stood&&nextPlayers[uid]?.stood)stoodNow=true});
      if(cardsAdded)playGameSfx('card');else if(stoodNow)playGameSfx('stand');
      if(prev.turnUid!==g.turnUid&&g.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),100);
    }
  }
  state.blackjack.game=g;const panel=$('blackjackGamePanel'),lobby=$('blackjackLobby');
  if(!g||g.status!=='active'){
    if(panel)panel.hidden=true;if(lobby)lobby.hidden=false;
    const uid=state.user?.uid,exit=!!g&&g.finishReason==='exit'&&!!g.leftUid,iLeft=exit&&g.leftUid===uid,won=!!g&&g.winnerUid===uid,draw=!!g&&!g.winnerUid&&!exit;
    const leftName=exit?(g.players?.[g.leftUid]?.name||'O adversário'):'';
    if($('blackjackStatus'))$('blackjackStatus').textContent=exit?(iLeft?'Você saiu':'Vitória por desistência'):won?'Você venceu':g?(draw?'Empate':'Encerrada'):'Livre';
    if(g?.status==='finished'&&g.id&&state.blackjack.seenActiveIds.has(g.id)){
      state.blackjack.seenActiveIds.delete(g.id);
      if(exit){showGameResult({title:iLeft?'Você saiu do 21':'Vitória por desistência no 21!',text:iLeft?'A partida foi encerrada para os dois jogadores. Seu adversário venceu por desistência.':`${leftName} saiu da partida. Você venceu por desistência.`,win:!iLeft,neutral:false,icon:iLeft?'↩':'21'});return}
      const me=g.players?.[uid]||{},other=Object.values(g.players||{}).find(x=>x.uid!==uid)||{};const reason=blackjackResultReason(g,me,other);const winner=draw?'Nenhuma mão venceu':won?`Mão vencedora: ${blackjackHandLabel(me)}`:`Mão vencedora: ${blackjackHandLabel(other)}`;const detail=`Sua mão: ${blackjackHandLabel(me)} • ${other.name||'Adversário'}: ${blackjackHandLabel(other)} • ${winner} • ${reason}`;showGameResult({title:draw?'Empate no 21!':won?'Você venceu no 21!':`${other.name||'Adversário'} venceu no 21`,text:detail,win:won,neutral:draw,icon:draw?'＝':won?'21':'✕'})
    }
    return;
  }
  state.blackjack.seenActiveIds.add(g.id);if(panel)panel.hidden=false;if(lobby)lobby.hidden=true;if($('blackjackStatus'))$('blackjackStatus').textContent=g.turnUid===state.user?.uid?'Sua vez':'Vez do amigo';renderBlackjackGame(g)
}
function renderBlackjackGame(g){const me=g.players?.[state.user?.uid]||{},other=Object.values(g.players||{}).find(x=>x.uid!==state.user?.uid)||{};if($('blackjackTitle'))$('blackjackTitle').textContent=`${me.name||'Você'} × ${other.name||'Amigo'}`;if($('blackjackTurnText'))$('blackjackTurnText').textContent=g.turnUid===state.user?.uid?'Sua vez de jogar':`Vez de ${other.name||'seu amigo'}`;if($('blackjackOpponentName'))$('blackjackOpponentName').textContent=other.name||'Adversário';if($('blackjackPlayer'))$('blackjackPlayer').innerHTML=(me.cards||[]).map(cardHtml).join('');if($('blackjackDealer'))$('blackjackDealer').innerHTML=(other.cards||[]).map(cardHtml).join('');if($('blackjackPlayerScore'))$('blackjackPlayerScore').textContent=String(me.score??0);if($('blackjackDealerScore'))$('blackjackDealerScore').textContent=String(other.score??0);if($('blackjackMyState'))$('blackjackMyState').textContent=me.busted?'Estourou':me.stood?'Parou':'Jogando';if($('blackjackOpponentState'))$('blackjackOpponentState').textContent=other.busted?'Estourou':other.stood?'Parou':'Jogando';const myTurn=g.turnUid===state.user?.uid&&g.status==='active'&&!me.stood&&!me.busted;if($('blackjackHitBtn'))$('blackjackHitBtn').disabled=!myTurn;if($('blackjackStandBtn'))$('blackjackStandBtn').disabled=!myTurn;const log=$('blackjackLog');if(log)log.innerHTML=Object.values(g.log||{}).slice(-10).reverse().map(x=>`<div>${escText(x.text||'')}</div>`).join('')||'<div>Partida iniciada.</div>'}
function blackjackWinner(g){const rows=Object.values(g.players||{}),alive=rows.filter(p=>!p.busted),best=alive.length?Math.max(...alive.map(p=>Number(p.score||0))):-1,winners=alive.filter(p=>Number(p.score||0)===best);return winners.length===1?winners[0].uid:null}
async function directBlackjackMove(gameId,action){const uid=state.user?.uid;if(!uid)return;let reason='';const tx=await runTransaction(ref(db,`blackjackGames/${gameId}`),g=>{if(!g||g.status!=='active'){reason='Partida encerrada.';return}if(g.turnUid!==uid){reason='Aguarde sua vez.';return}const me=g.players?.[uid],otherUid=Object.keys(g.players||{}).find(x=>x!==uid),other=g.players?.[otherUid];if(!me||!other){reason='Partida inválida.';return}g.deck=Array.isArray(g.deck)?g.deck:[];if(action==='hit'){const card=g.deck.pop();if(!card){reason='O baralho acabou.';return}me.cards=[...(me.cards||[]),card];me.score=blackjackScore(me.cards);if(me.score>21)me.busted=true;if(me.score===21)me.stood=true;appendGameLog(g,`${me.name||'Jogador'} pediu uma carta.`)}else if(action==='stand'){me.stood=true;appendGameLog(g,`${me.name||'Jogador'} parou com ${me.score||0}.`)}else{reason='Jogada inválida.';return}g.updatedAt=Date.now();const meDone=me.stood||me.busted,otherDone=other.stood||other.busted;if(me.busted||(meDone&&otherDone)){g.status='finished';g.winnerUid=blackjackWinner(g);g.finishedAt=Date.now()}else if(!otherDone)g.turnUid=otherUid;else g.turnUid=uid;return g});if(!tx.committed){if(reason)throw new Error(reason);return}const final={id:gameId,...tx.snapshot.val()};if(final.status==='finished')await finishIndexes('blackjack',final)}
$('blackjackHitBtn')?.addEventListener('click',async()=>{const g=state.blackjack.game;if(!g)return;playGameSfx('select');try{await directBlackjackMove(g.id,'hit')}catch(e){toast(permissionMessage(e,e.message))}});
$('blackjackStandBtn')?.addEventListener('click',async()=>{const g=state.blackjack.game;if(!g)return;playGameSfx('select');try{await directBlackjackMove(g.id,'stand')}catch(e){toast(permissionMessage(e,e.message))}});
$('blackjackExitBtn')?.addEventListener('click',async()=>{const g=state.blackjack.game;if(!g)return;playGameSfx('reject');try{await directGameExit('blackjack',g)}catch(e){toast(permissionMessage(e,e.message))}});

// Forca PvP
$('hangmanCreateBtn')?.addEventListener('click',async()=>{const targetUid=$('hangmanFriendSelect')?.value;if(!targetUid)return toast('Escolha um amigo.');playGameSfx('select');try{await sendSiteGameChallenge('hangman',targetUid)}catch(e){toast(permissionMessage(e,e.message))}});
function handleHangmanIndex(obj){const rows=gameRows(obj),active=rows.find(x=>x.status==='active');if(active){if(state.hangman.game?.id!==active.id)subscribeHangman(active.id);return}const finished=rows.find(x=>x.status==='finished');if(finished&&state.hangman.game?.id!==finished.id)subscribeHangman(finished.id);else if(!finished)setHangmanGame(null)}
function subscribeHangman(id){if(state.hangman.unsub){try{state.hangman.unsub()}catch{}}state.hangman.unsub=onValue(ref(db,`hangmanGames/${id}`),sn=>setHangmanGame(sn.exists()?{id,...sn.val()}:null))}
function setHangmanGame(g){
  const prev=state.hangman.game;
  if(g?.status==='active'){
    if(!prev||prev.id!==g.id){playGameSfx('start');if(g.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),180)}
    else if(prev.status==='active'){
      const before=prev.guessed||{},after=g.guessed||{},fresh=Object.keys(after).find(k=>!before[k]);
      if(fresh)playGameSfx(after[fresh]==='hit'?'correct':'wrong');
      if(prev.turnUid!==g.turnUid&&g.turnUid===state.user?.uid)setTimeout(()=>playGameSfx('turn'),100);
    }
  }
  state.hangman.game=g;const panel=$('hangmanGamePanel'),lobby=$('hangmanLobby');
  if(!g||g.status!=='active'){
    if(panel)panel.hidden=true;if(lobby)lobby.hidden=false;
    const uid=state.user?.uid,exit=!!g&&g.finishReason==='exit'&&!!g.leftUid,iLeft=exit&&g.leftUid===uid,won=!!g&&g.winnerUid===uid,draw=!!g&&!g.winnerUid&&!exit;
    const leftName=exit?(g.players?.[g.leftUid]?.name||'O adversário'):'';
    if($('hangmanLives'))$('hangmanLives').textContent=exit?(iLeft?'Você saiu':'Vitória por desistência'):won?'Você venceu':g?(draw?'Empate':'Encerrada'):'Livre';
    if(g?.status==='finished'&&g.id&&state.hangman.seenActiveIds.has(g.id)){
      state.hangman.seenActiveIds.delete(g.id);
      if(exit)showGameResult({title:iLeft?'Você saiu da Forca':'Vitória por desistência na Forca!',text:iLeft?'A partida foi encerrada para os dois jogadores. Seu adversário venceu por desistência.':`${leftName} saiu da partida. Você venceu por desistência.`,win:!iLeft,neutral:false,icon:iLeft?'↩':'A'});
      else showGameResult({title:draw?'Empate na Forca!':won?'Você venceu a Forca!':'Você perdeu a Forca',text:`A palavra era ${g.answer||'a palavra secreta'}.`,win:won,neutral:draw,icon:draw?'＝':won?'A':'✕'});
    }
    return;
  }
  state.hangman.seenActiveIds.add(g.id);if(panel)panel.hidden=false;if(lobby)lobby.hidden=true;renderHangmanGame(g)
}
function renderHangmanGame(g){const me=g.players?.[state.user?.uid]||{},other=Object.values(g.players||{}).find(x=>x.uid!==state.user?.uid)||{},misses=Array.isArray(g.misses)?g.misses:Object.values(g.misses||{}),max=Number(g.maxMisses||6),guessed=g.guessed||{};if($('hangmanTitle'))$('hangmanTitle').textContent=`${me.name||'Você'} × ${other.name||'Amigo'}`;if($('hangmanTurnText'))$('hangmanTurnText').textContent=g.turnUid===state.user?.uid?'Sua vez de escolher uma letra':`Vez de ${other.name||'seu amigo'}`;if($('hangmanLives'))$('hangmanLives').textContent=`${Math.max(0,max-misses.length)} erros restantes`;if($('hangmanWord'))$('hangmanWord').textContent=String(g.mask||'').split('').map(ch=>ch===' '?'  ':ch).join(' ');if($('hangmanMeName'))$('hangmanMeName').textContent=me.name||'Você';if($('hangmanOpponentName'))$('hangmanOpponentName').textContent=other.name||'Adversário';if($('hangmanMeScore'))$('hangmanMeScore').textContent=String(me.score||0);if($('hangmanOpponentScore'))$('hangmanOpponentScore').textContent=String(other.score||0);const kb=$('hangmanKeyboard');if(kb){kb.innerHTML='';'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(ch=>{const b=document.createElement('button');b.type='button';b.textContent=ch;const used=guessed[ch];if(used)b.classList.add(used==='hit'?'correct':'wrong');b.disabled=!!used||g.turnUid!==state.user?.uid||g.status!=='active';b.onclick=()=>{playGameSfx('select');directHangmanGuess(g.id,ch).catch(e=>toast(permissionMessage(e,e.message)))};kb.appendChild(b)})}const log=$('hangmanLog');if(log)log.innerHTML=Object.values(g.log||{}).slice(-10).reverse().map(x=>`<div>${escText(x.text||'')}</div>`).join('')||'<div>Partida iniciada.</div>'}
async function directHangmanGuess(gameId,letter){const uid=state.user?.uid;if(!uid)return;let reason='';const tx=await runTransaction(ref(db,`hangmanGames/${gameId}`),g=>{if(!g||g.status!=='active'){reason='Partida encerrada.';return}if(g.turnUid!==uid){reason='Aguarde sua vez.';return}letter=String(letter||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,1);if(!letter){reason='Letra inválida.';return}g.guessed=g.guessed||{};if(g.guessed[letter]){reason='Essa letra já foi usada.';return}const answer=String(g.answer||'').toUpperCase(),hits=[...answer].filter(ch=>ch===letter).length,me=g.players?.[uid],otherUid=Object.keys(g.players||{}).find(x=>x!==uid);g.guessed[letter]=hits?'hit':'miss';g.misses=Array.isArray(g.misses)?g.misses:[];if(hits){me.score=Number(me.score||0)+hits;appendGameLog(g,`${me.name||'Jogador'} acertou ${letter}.`)}else{g.misses=[...g.misses,letter];appendGameLog(g,`${me.name||'Jogador'} errou ${letter}.`)}g.mask=hangmanMask(answer,g.guessed);g.updatedAt=Date.now();const solved=!g.mask.includes('_'),over=g.misses.length>=Number(g.maxMisses||6);if(solved||over){g.status='finished';const ps=Object.values(g.players||{}),top=Math.max(...ps.map(p=>Number(p.score||0))),wins=ps.filter(p=>Number(p.score||0)===top);g.winnerUid=wins.length===1?wins[0].uid:null;g.finishedAt=Date.now()}else g.turnUid=otherUid;return g});if(!tx.committed){if(reason)throw new Error(reason);return}const final={id:gameId,...tx.snapshot.val()};if(final.status==='finished')await finishIndexes('hangman',final)}
$('hangmanExitBtn')?.addEventListener('click',async()=>{const g=state.hangman.game;if(!g)return;playGameSfx('reject');try{await directGameExit('hangman',g)}catch(e){toast(permissionMessage(e,e.message))}});

// Slots solo — usa a carteira de Rupias já sincronizada com a Charlotte.
// O site controla toda a experiência visual: aposta, giro, som e exibição do resultado.

const initialRoute=(location.hash||'#home').slice(1);navigate(routeMeta[initialRoute]?initialRoute:'home');

initCommunity({app, db, getUser:()=>state.user, isAdmin:isSiteAdmin, toast, getSelectedUid:()=>state.admin.selectedUid, bridgeRequest});
$('watchYoutubeSearch')?.addEventListener('submit',async ev=>{
 ev.preventDefault();const box=$('watchYoutubeResults');box.textContent='Pesquisando...';
 try{const r=await fetch('/api/main?action=youtube_search&q='+encodeURIComponent($('watchYoutubeQuery').value.trim()));const data=await r.json();if(!r.ok)throw new Error(data.erro||'Busca indisponível');box.replaceChildren();for(const item of data.items||[]){const b=document.createElement('button');b.type='button';b.className='youtube-result';const im=document.createElement('img');im.src=item.thumbnail;im.alt='';im.loading='lazy';const title=document.createElement('span');title.textContent=item.title;b.append(im,title);b.onclick=()=>{if(!isWatchHost())return toast('Somente o host pode escolher o vídeo.');$('watchMediaInput').value='https://www.youtube.com/watch?v='+item.id;$('watchMediaForm').requestSubmit()};box.append(b)}if(!box.children.length)box.textContent='Nenhum vídeo encontrado.'}catch(e){box.textContent=e.message}
});

const watchEnable=document.createElement('button');watchEnable.type='button';watchEnable.className='btn';watchEnable.textContent='Ativar reprodução e som';$('watchMediaForm')?.after(watchEnable);
watchEnable.addEventListener('click',async()=>{primeGameAudio();const stage=$('watchMediaStage'),f=stage?.querySelector('iframe[data-watch-youtube="1"]'),v=stage?.querySelector('video');if(f){youtubeCommand(f,'unMute',[]);applyYoutubeWatchState(f,state.watchRoom?.media||{})}if(v){try{v.muted=false;if(state.watchRoom?.media?.playing)await v.play()}catch{toast('Não foi possível reproduzir. Verifique se o link aponta para um vídeo compatível.')}}state.watchRtc.screenSoundMuted=false;refreshWatchScreenStage();try{await $('watchScreenAudio')?.play()}catch{}if(stage?.querySelector('iframe[data-watch-drive]'))toast('No Drive, toque em Play dentro do vídeo.');});

async function renderPublicBadge(uid){let badge=$('publicEarnedBadge');if(!badge){badge=document.createElement('p');badge.id='publicEarnedBadge';badge.className='profile-badge';$('publicProfileName')?.after(badge)}badge.hidden=true;try{const id=(await get(ref(db,`profileEquippedBadge/${uid}`))).val();if(!id)return;const b=(await get(ref(db,`profileBadges/${uid}/${id}`))).val();if(b&&currentPublicProfile?.uid===uid){badge.textContent=`${b.icon} ${b.name}`;badge.hidden=false}}catch{}}

$('adminVerifyEmail')?.addEventListener('click',async()=>{try{if(auth.currentUser?.emailVerified)return toast('Seu e-mail já está confirmado.');await sendEmailVerification(auth.currentUser);toast('Confirme o e-mail pelo link recebido; depois saia e entre novamente.')}catch(e){toast(e.message)}});
