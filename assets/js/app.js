import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, inMemoryPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, push, onValue, remove, onDisconnect, query, orderByChild, limitToLast
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
const WHATSAPP_NUMBER = '5521973747709';
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
  bridgeResults:{}, siteInventory:{}, siteCustomization:{},
  teamDraft:[], pokemonEncounter:null, pokemonHealing:{}, pokemonAudio:{encounterId:''}, siteRaid:null, siteRaidConfig:{},
  ttt:{game:null,unsub:null,index:{},lastResultId:''},
  notificationFilter:'team',
  admin:{reports:{},updates:{},directory:{},bans:{},selectedUid:''},
  tinder:{current:null,seen:[]},updates:{},notifications:{},ban:null,
  watchCode:null,watchRoom:null,watchUnsubs:[],watchApplying:false,
  watchRtc:{joined:false,audioJoined:false,localStream:null,screenStream:null,peers:new Map(),remoteStreams:new Map(),remoteVoiceStreams:new Map(),remoteScreenStreams:new Map(),processed:new Set(),pendingCandidates:new Map(),presenceUnsub:null,inboxUnsub:null,disconnectRef:null,micEnabled:true,activeScreenUid:null,screenSharers:new Set(),presence:{},screenRetry:new Map(),makingOffer:new Set(),screenSoundMuted:false},
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
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}),{once:true})}

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
function permissionMessage(err, fallback='Acesso negado pelo Firebase.'){
  const txt=String(err?.code||err?.message||err||'').toLowerCase();
  if(txt.includes('permission_denied')||txt.includes('permission denied')) return 'Firebase bloqueou essa ação. Publique o arquivo firebase.rules.production.json no Realtime Database.';
  return fallback;
}

const routeMeta={
  home:['GREMORY','Início'],charlotte:['CHARLOTTE','Charlotte'],pokemon:['POKÉMON','Centro Pokémon'],friends:['AMIGOS','Pessoas'],tinder:['TINDER','Descobrir pessoas'],updates:['ATUALIZAÇÕES','Novidades'],downloads:['DOWNLOADS','Downloads'],studio:['STUDIO','PDF & Canvas'],games:['JOGOS','Jogos'],watch:['WATCH PARTY','Assistir com amigos'],rpg:['RPG','Mesas'],premium:['PREMIUM','Gremory Premium'],personalize:['PERSONALIZAR','Loja de rúpias'],support:['SUPORTE','Gremory oficial'],admin:['ADMINISTRAÇÃO','Painel do host']
};
function navigate(route){
  if(route==='admin'&&!isSiteAdmin()){toast('Acesso restrito ao host.');route='home'}
  if(!routeMeta[route]) route='home'; state.route=route;
  $$('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===route));
  $$('[data-route]').forEach(el=>el.classList.toggle('active',el.dataset.route===route));
  const [eye,title]=routeMeta[route]; $('pageEyebrow').textContent=eye; $('pageTitle').textContent=title;
  history.replaceState(null,'',`#${route}`); window.scrollTo({top:0,behavior:'auto'});
  if(route==='pokemon') {loadPokemonSources(); renderDuelFriendSelect();}
  if(route==='friends') loadDirectory();
  if(route==='tinder'){loadOwnTinderProfile();loadTinderProfile();}
  if(route==='updates') renderUpdates();
  if(route==='games') renderTttFriendSelect();
  if(route==='studio') renderDesignCanvas();
  if(route==='watch'&&state.user&&!state.watchCode) loadWatchRooms();
  if(route==='rpg'&&state.user&&!state.roomCode) loadMyRooms();
  if(route==='premium'&&state.user&&state.charlottePublic?.status==='linked') requestAccountSync().catch(()=>{});
  if(route==='personalize') renderStore();
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
function authError(err){const map={'auth/email-already-in-use':'Esse e-mail já está em uso.','auth/invalid-email':'E-mail inválido.','auth/weak-password':'Use uma senha com pelo menos 6 caracteres.','auth/invalid-credential':'E-mail ou senha incorretos.','auth/too-many-requests':'Muitas tentativas. Tente novamente mais tarde.'};return map[err?.code]||'Não foi possível concluir.'}
async function configurePersistence(remember){
  await setPersistence(auth,remember?browserLocalPersistence:inMemoryPersistence);
  if(remember)localStorage.setItem('gremory:remember','1');else localStorage.removeItem('gremory:remember');
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
    await signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value);
    $('authStatus').textContent='Entrando na Gremory...';
  }catch(e){
    $('authStatus').textContent=authError(e);
  }finally{
    if(button)button.disabled=false;
  }
});
$('registerForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const registerButton=ev.currentTarget.querySelector('button[type="submit"]');
  if(registerButton?.disabled)return;
  if(registerButton)registerButton.disabled=true;
  const name=$('registerName').value.trim(),username=normalizeUsername($('registerUsername').value),email=$('registerEmail').value.trim(),pass=$('registerPassword').value,pass2=$('registerPassword2').value;
  if(!name){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='Digite seu nome.';}
  if(!validUsername(username)){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='Nome de usuário inválido. Use 3–20 caracteres, começando por letra.';}
  if(pass.length<6){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='A senha precisa ter pelo menos 6 caracteres.';}
  if(pass!==pass2){if(registerButton)registerButton.disabled=false;return $('authStatus').textContent='As senhas não coincidem.';}
  $('authStatus').textContent='Criando conta...';
  try{
    const taken=await get(ref(db,`usernames/${username}`)).catch(()=>null);
    if(taken?.exists())throw new Error('USERNAME_TAKEN');
    await configurePersistence($('registerRemember').checked);
    const cred=await createUserWithEmailAndPassword(auth,email,pass);
    const stamp=Date.now();
    await updateProfile(cred.user,{displayName:name});
    await set(ref(db,`usernames/${username}`),{uid:cred.user.uid,username,updatedAt:stamp});
    const p={uid:cred.user.uid,nome:name,username,usernameChangedAt:stamp,avatar:'',bio:'',favoriteAnime:'',email:cred.user.email||email,raidWhatsappNotify:false,createdAt:nowIso(),updatedAt:nowIso()};
    await set(ref(db,`profiles/${cred.user.uid}`),p);
    await set(ref(db,`directory/${cred.user.uid}`),publicProfile(p));
    $('authStatus').textContent='';
  }catch(e){
    $('authStatus').textContent=e?.message==='USERNAME_TAKEN'?'Esse nome de usuário já está em uso.':authError(e)
  }finally{
    if(registerButton)registerButton.disabled=false;
  }
});
$('resetPasswordBtn').addEventListener('click',async()=>{const email=$('loginEmail').value.trim();if(!email)return $('authStatus').textContent='Digite seu e-mail primeiro.';try{await sendPasswordResetEmail(auth,email);$('authStatus').textContent='E-mail de recuperação enviado.'}catch(e){$('authStatus').textContent=authError(e)}});
$('logoutBtn').addEventListener('click',async()=>{localStorage.removeItem('gremory:remember');clearUserSubscriptions();await signOut(auth);setDrawer(false)});

function publicProfile(p){return{uid:p.uid,nome:p.nome||'Usuário',username:normalizeUsername(p.username||''),avatar:p.avatar||'',bio:p.bio||'',favoriteAnime:p.favoriteAnime||'',createdAt:p.createdAt||nowIso(),updatedAt:p.updatedAt||nowIso()}}
async function readUserData(user){
  const [ps,old]=await Promise.all([get(ref(db,`profiles/${user.uid}`)).catch(()=>null),get(ref(db,`users/${user.uid}`)).catch(()=>null)]);
  const p=ps?.exists()?ps.val():{};const o=old?.exists()?old.val():{};
  const merged={uid:user.uid,nome:p.nome||o.nome||user.displayName||'Usuário',username:normalizeUsername(p.username||o.username||''),usernameChangedAt:Number(p.usernameChangedAt||o.usernameChangedAt||0),avatar:p.avatar||o.avatar||user.photoURL||'',bio:p.bio||o.bio||'',favoriteAnime:p.favoriteAnime||o.favoriteAnime||o.animeFavorito||'',email:p.email||user.email||'',raidWhatsappNotify:Boolean(p.raidWhatsappNotify),createdAt:p.createdAt||o.createdAt||user.metadata?.creationTime||nowIso()};
  if(!ps?.exists()) await set(ref(db,`profiles/${user.uid}`),{...merged,updatedAt:nowIso()}).catch(()=>{});
  else if((!p.email&&user.email)||p.raidWhatsappNotify==null) await update(ref(db,`profiles/${user.uid}`),{email:user.email||p.email||'',raidWhatsappNotify:Boolean(p.raidWhatsappNotify),updatedAt:nowIso()}).catch(()=>{});
  await set(ref(db,`directory/${user.uid}`),publicProfile(merged)).catch(()=>{});
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
  ['sideAvatar','topAvatar','profileAvatarPreview'].forEach(id=>{if($(id))$(id).src=avatar});$('sideName').textContent=name;$('sideStatus').textContent=premium?'Premium':usernameLabel(p);$('profileNameView').textContent=name;if($('profileUsernameView'))$('profileUsernameView').textContent=usernameLabel(p);$('profilePlanView').textContent=premium?'Premium':'Padrão';$('profileName').value=name;if($('profileUsername'))$('profileUsername').value=normalizeUsername(p.username||'');if($('profileUsernameHint'))$('profileUsernameHint').textContent=formatCooldown(usernameCooldownRemaining(p));$('profileAvatar').value=p.avatar||'';$('profileBio').value=p.bio||'';$('profileFavoriteAnime').value=p.favoriteAnime||'';if($('profileRaidWhatsapp'))$('profileRaidWhatsapp').checked=Boolean(p.raidWhatsappNotify);if($('raidWhatsappNotify'))$('raidWhatsappNotify').checked=Boolean(p.raidWhatsappNotify);renderAdminAccess();$('profileLevel').textContent=formatNumber(level);$('profileBalance').textContent=`₹ ${formatNumber(balance)}`;$('homePlan').textContent=premium?'Premium':'Padrão';$('homeLevel').textContent=formatNumber(level);$('homeBalance').textContent=`₹ ${formatNumber(balance)}`;$('homeGreeting').textContent=`Olá, ${name}.`;
  if($('storeBalance'))$('storeBalance').textContent=`₹ ${formatNumber(balance)}`;
  if($('premiumStatusPill'))$('premiumStatusPill').textContent=premium?'Premium':'Padrão';
  if($('premiumStatusTitle'))$('premiumStatusTitle').textContent=premium?'Premium ativo':'Plano padrão';
  if($('premiumStatusText'))$('premiumStatusText').textContent=state.charlottePublic?.status==='linked'?(premium?'Seu Premium está sincronizado com a Charlotte.':'Escolha um plano abaixo. O pagamento é criado pelo bot com Mercado Pago.'):'Vincule a Charlotte para comprar e sincronizar o Premium pelo site.';
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
    const payload={uid:state.user.uid,nome:$('profileName').value.trim().slice(0,40)||'Usuário',username,usernameChangedAt:changing?Date.now():Number(oldProfile.usernameChangedAt||Date.now()),avatar:$('profileAvatar').value.trim(),bio:$('profileBio').value.trim().slice(0,180),favoriteAnime:$('profileFavoriteAnime').value.trim().slice(0,80),email:state.user.email||oldProfile.email||'',raidWhatsappNotify:Boolean($('profileRaidWhatsapp')?.checked),createdAt:oldProfile.createdAt||nowIso(),updatedAt:nowIso()};
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

function clearUserSubscriptions(){if(state.premiumPoll){clearInterval(state.premiumPoll);state.premiumPoll=null}clearUnsubs(state.userUnsubs);if(state.duelUnsub){try{state.duelUnsub()}catch{}state.duelUnsub=null}if(state.ttt.unsub){try{state.ttt.unsub()}catch{}state.ttt.unsub=null}leaveVoice(true).catch(()=>{});leaveWatchVoice(true).catch(()=>{});clearRoomSubscriptions();clearUnsubs(state.watchUnsubs);state.friends={};state.requests={};state.directory={};state.charlottePublic=null;state.charlotteSync=null;state.bridgeResults={};state.siteInventory={};state.siteCustomization={};state.duel=null;state.teamDraft=[];state.pokemonEncounter=null;state.pokemonHealing={};state.siteRaid=null;state.siteRaidConfig={};state.ttt.game=null;state.ttt.index={};state.ttt.lastResultId='';state.tinder={current:null,seen:[]};state.updates={};state.notifications={};state.ban=null;state.watchCode=null;state.watchRoom=null}
function startUserSubscriptions(){
  clearUserSubscriptions();const uid=state.user.uid;
  state.userUnsubs.push(onValue(ref(db,`friends/${uid}`),s=>{state.friends=s.exists()?s.val():{};renderFriends();renderDuelFriendSelect();$('homeFriendsText').textContent=`${Object.keys(state.friends).length} amigo${Object.keys(state.friends).length===1?'':'s'}`}));
  state.userUnsubs.push(onValue(ref(db,`friendRequests/${uid}`),s=>{state.requests=s.exists()?s.val():{};renderFriendRequests()}));
  state.userUnsubs.push(onValue(ref(db,`charlottePublic/${uid}`),s=>{state.charlottePublic=s.exists()?s.val():null;renderCharlotteStatus()}));
  state.userUnsubs.push(onValue(ref(db,`charlotteSync/${uid}`),s=>{state.charlotteSync=s.exists()?s.val():null;renderCharlotteSync();renderAccount();loadPokemonSources();renderCollection();renderStore()}));
  state.userUnsubs.push(onValue(ref(db,`siteBridgeResults/${uid}`),s=>{state.bridgeResults=s.exists()?s.val():{}}));
  state.userUnsubs.push(onValue(ref(db,`siteInventory/${uid}`),s=>{state.siteInventory=s.exists()?s.val():{};renderStore()}));
  state.userUnsubs.push(onValue(ref(db,`siteCustomization/${uid}`),s=>{state.siteCustomization=s.exists()?s.val():{};applyCustomization();renderStore()}));
  state.userUnsubs.push(onValue(ref(db,`pokemonSiteChallenges/${uid}`),s=>renderDuelInbox(s.exists()?s.val():{})));
  state.userUnsubs.push(onValue(ref(db,`pokemonSiteDuelIndex/${uid}`),s=>handleDuelIndex(s.exists()?s.val():{})));
  state.userUnsubs.push(onValue(ref(db,`pokemonSiteEncounter/${uid}`),s=>{state.pokemonEncounter=s.exists()?s.val():null;renderWildEncounter()}));
  state.userUnsubs.push(onValue(ref(db,`pokemonHealing/${uid}`),s=>{state.pokemonHealing=s.exists()?s.val():{};renderHealingList();renderCollection()}));
  state.userUnsubs.push(onValue(ref(db,'pokemonSiteRaid/current'),s=>{state.siteRaid=s.exists()?s.val():null;renderSiteRaid()}));
  state.userUnsubs.push(onValue(ref(db,'pokemonSiteRaidConfig'),s=>{state.siteRaidConfig=s.exists()?s.val():{};renderSiteRaid()}));

  state.userUnsubs.push(onValue(ref(db,`ticTacToeIndex/${uid}`),s=>{state.ttt.index=s.exists()?s.val():{};handleTttIndex(state.ttt.index)}));
  state.userUnsubs.push(onValue(query(ref(db,'siteUpdates'),orderByChild('createdAt'),limitToLast(60)),s=>{state.updates=s.exists()?s.val():{};renderUpdates()}));
  let notificationBoot=true;
  state.userUnsubs.push(onValue(query(ref(db,`siteNotifications/${uid}`),orderByChild('createdAt'),limitToLast(100)),s=>{
    const previousCount=uniqueNotificationRows(state.notifications).length;
    state.notifications=s.exists()?s.val():{};
    const nextCount=uniqueNotificationRows(state.notifications).length;
    renderNotifications();
    if(!notificationBoot&&nextCount>previousCount)playNotificationTone();
    notificationBoot=false;
  }));
  state.userUnsubs.push(onValue(ref(db,`siteBans/${uid}`),s=>{state.ban=s.exists()?s.val():null;applySiteBan()}));
}

await initialAuthPolicy();
onAuthStateChanged(auth,async user=>{
  document.body.classList.remove('auth-loading');state.user=user||null;
  if(!user){document.body.classList.remove('authenticated');$('appShell').setAttribute('aria-hidden','true');const reason=sessionStorage.getItem('gremory:banReason');if(reason){$('authStatus').textContent=`Conta suspensa: ${reason}`;sessionStorage.removeItem('gremory:banReason')}clearUserSubscriptions();return}
  try{await readUserData(user)}catch{}
  state.ttt.lastResultId=localStorage.getItem(`gremory:tttSeen:${user.uid}`)||'';
  renderAdminAccess();
  if(!state.profile?.username)setTimeout(()=>{toast('Escolha seu nome de usuário para completar a conta.',5000);setDrawer(true)},700);
  document.body.classList.add('authenticated');$('appShell').setAttribute('aria-hidden','false');setTimeout(()=>{const gif=$('authGif');if(gif)gif.removeAttribute('src')},250);startUserSubscriptions();await loadPokemonSources();
  const params=new URLSearchParams(location.search);
  const watchInvite=params.get('watch');
  const rpgInvite=params.get('rpg');
  if(watchInvite){navigate('watch');await joinWatchRoom(watchInvite.toUpperCase())}
  else if(rpgInvite){navigate('rpg');await joinRoom(rpgInvite.toUpperCase())}
});


function generatedTone(freq=720,duration=.12){
  try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=freq;gain.gain.value=.035;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);setTimeout(()=>ctx.close().catch(()=>{}),Math.ceil((duration+.15)*1000))}catch{}
}
function playSiteSound(name,fallbackFreq=720){
  try{const audio=new Audio(`/assets/audio/${name}.mp3`);audio.volume=.35;audio.play().catch(()=>generatedTone(fallbackFreq))}catch{generatedTone(fallbackFreq)}
}
function playNotificationTone(){playSiteSound('notification',720)}
function playVictoryTone(){playSiteSound('victory',920)}
function playPokemonSound(kind){
  const map={
    encounter:['pokemon-encounter',620],
    hit:['pokemon-hit',180],
    ball:['pokemon-ball',520],
    capture:['pokemon-capture',920]
  };
  const row=map[kind];if(!row)return;
  playSiteSound(row[0],row[1]);
}
function notificationLastSeen(){return Number(localStorage.getItem('gremory:notifSeen')||0)}
function notificationSignature(n){return [String(n?.type||''),String(n?.title||''),String(n?.text||''),String(n?.link||''),String(n?.imageUrl||'')].join('\u241f')}
function notificationCategory(n){
  const type=String(n?.type||'').toLowerCase();
  if(['friend_request','pokemon_duel','ttt','tinder_match','friend','social'].includes(type))return'social';
  return'team';
}
function notificationCategoryLabel(n){return notificationCategory(n)==='social'?'Amigos':'Equipe'}

function uniqueNotificationRows(source=state.notifications){
  const rows=Object.entries(source||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const latestBySignature=new Map(),unique=[];
  for(const n of rows){
    const sig=notificationSignature(n),created=Number(n.createdAt||0),latest=latestBySignature.get(sig);
    if(latest!=null&&Math.abs(latest-created)<=30000)continue;
    latestBySignature.set(sig,created);unique.push(n);
  }
  return unique;
}
function ensureNotificationDetailModal(){
  let modal=$('notificationDetailModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.className='modal';
  modal.id='notificationDetailModal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <button class="modal-backdrop" type="button" aria-label="Fechar"></button>
    <div class="modal-card" style="max-width:560px">
      <button class="modal-close" type="button" aria-label="Fechar">×</button>
      <span class="tag">NOTIFICAÇÃO</span>
      <h2 id="notificationDetailTitle">Aviso da Gremory</h2>
      <img id="notificationDetailImage" alt="" style="display:none;width:100%;max-height:420px;object-fit:contain;border-radius:16px;margin:10px 0 14px">
      <p id="notificationDetailText" style="white-space:pre-wrap"></p>
      <small id="notificationDetailTime"></small>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-backdrop')?.addEventListener('click',()=>closeModal('notificationDetailModal'));
  modal.querySelector('.modal-close')?.addEventListener('click',()=>closeModal('notificationDetailModal'));
  return modal;
}
function openNotificationDetail(n){
  ensureNotificationDetailModal();
  $('notificationDetailTitle').textContent=n?.title||'Notificação';
  $('notificationDetailText').textContent=n?.text||'';
  $('notificationDetailTime').textContent=shortDateTime(n?.createdAt);
  const img=$('notificationDetailImage'),url=String(n?.imageUrl||'').trim();
  if(img){
    if(url){img.src=url;img.style.display='block'}
    else{img.removeAttribute('src');img.style.display='none'}
  }
  closeModal('notificationModal');
  openModal('notificationDetailModal');
}
function renderNotifications(){
  const all=uniqueNotificationRows();
  const unseen=all.filter(x=>Number(x.createdAt||0)>notificationLastSeen()).length,badge=$('notificationBadge');
  if(badge){badge.hidden=!unseen;badge.textContent=String(Math.min(99,unseen))}
  const team=all.filter(x=>notificationCategory(x)==='team'),social=all.filter(x=>notificationCategory(x)==='social');
  if($('notificationTeamCount'))$('notificationTeamCount').textContent=String(team.length);
  if($('notificationSocialCount'))$('notificationSocialCount').textContent=String(social.length);
  $$('[data-notification-filter]').forEach(b=>b.classList.toggle('active',b.dataset.notificationFilter===state.notificationFilter));
  const rows=state.notificationFilter==='all'?all:state.notificationFilter==='social'?social:team;
  const box=$('notificationList');if(!box)return;box.innerHTML='';
  if(!rows.length){box.innerHTML=`<div class="empty-state small">${state.notificationFilter==='social'?'Nenhuma notificação de amigos ou jogos.':'Nenhum aviso da equipe.'}</div>`;return}
  rows.slice(0,60).forEach(n=>{
    const d=document.createElement('button');d.type='button';d.className='notification-row';
    const head=document.createElement('div');head.className='notification-row-head';
    const st=document.createElement('strong');st.textContent=n.title||'Notificação';
    const kind=document.createElement('em');kind.textContent=notificationCategoryLabel(n);
    head.append(st,kind);
    const sm=document.createElement('span');sm.textContent=n.text||'';
    const time=document.createElement('small');time.textContent=shortDateTime(n.createdAt);
    d.append(head,sm,time);
    d.onclick=()=>{if(n.imageUrl||n.type==='admin_notice'||n.type==='site_update'){openNotificationDetail(n);return}if(n.link?.startsWith('#')){closeModal('notificationModal');navigate(n.link.slice(1));return}openNotificationDetail(n)};
    box.appendChild(d)
  })
}
$$('[data-notification-filter]').forEach(btn=>btn.addEventListener('click',()=>{state.notificationFilter=btn.dataset.notificationFilter||'team';renderNotifications()}));
$('notificationBtn')?.addEventListener('click',()=>{localStorage.setItem('gremory:notifSeen',String(Date.now()));renderNotifications();openModal('notificationModal')});
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
    const [reportsSnap,updatesSnap,directorySnap,bansSnap]=await Promise.all([
      get(ref(db,'siteReports')),get(ref(db,'siteUpdates')),get(ref(db,'directory')),get(ref(db,'siteBans'))
    ]);
    state.admin.reports=reportsSnap.exists()?reportsSnap.val():{};
    state.admin.updates=updatesSnap.exists()?updatesSnap.val():{};
    state.admin.directory=directorySnap.exists()?directorySnap.val():{};
    state.admin.bans=bansSnap.exists()?bansSnap.val():{};
    renderAdminDashboard()
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
function renderDuelFriendSelect(){const sel=$('duelFriendSelect');if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Escolha um amigo</option>';Object.values(state.friends||{}).forEach(f=>{const o=document.createElement('option');o.value=f.uid;o.textContent=f.nome||'Usuário';sel.appendChild(o)});if(state.friends[current])sel.value=current;renderTttFriendSelect()}
$('sendDuelChallengeBtn').addEventListener('click',async()=>{const targetUid=$('duelFriendSelect').value;if(!targetUid)return toast('Escolha um amigo.');if(state.charlottePublic?.status!=='linked')return toast('Vincule a Charlotte primeiro.');try{await push(ref(db,`siteBridgeJobs/${state.user.uid}`),{type:'duel_challenge',targetUid,createdAt:nowIso()});toast('Desafio 6x6 enviado.')}catch(e){toast(permissionMessage(e))}});
function renderDuelInbox(obj){const box=$('duelInbox');box.innerHTML='';const rows=Object.entries(obj||{});if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhum desafio.</div>';return}rows.forEach(([id,c])=>{const r=document.createElement('div');r.className='duel-request';const cp=document.createElement('div');const st=document.createElement('strong');st.textContent=c.fromName||'Desafiante';const sm=document.createElement('small');sm.textContent='quer batalhar 6x6';cp.append(st,sm);const acts=document.createElement('div');acts.className='person-actions';const a=document.createElement('button');a.className='mini-btn primary';a.textContent='Aceitar';a.onclick=()=>duelJob('duel_accept',{challengeId:id});const d=document.createElement('button');d.className='mini-btn';d.textContent='Recusar';d.onclick=()=>duelJob('duel_decline',{challengeId:id});acts.append(a,d);r.append(cp,acts);box.appendChild(r)})}
async function duelJob(type,data){try{await push(ref(db,`siteBridgeJobs/${state.user.uid}`),{type,...data,createdAt:nowIso()});if(type==='duel_move')playPokemonSound('hit');toast(type==='duel_move'?'Golpe enviado.':type==='duel_switch'?'Troca enviada.':'Processando...')}catch(e){toast(permissionMessage(e))}}
function handleDuelIndex(obj){
  const entries=Object.entries(obj||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
  const active=entries.find(x=>x.status==='active');
  if(active){if(state.duel?.id!==active.id)subscribeDuel(active.id);return}
  const finished=entries.find(x=>x.status==='finished');
  if(finished&&state.duel?.id!==finished.id)subscribeDuel(finished.id);else if(!finished)setActiveDuel(null)
}
function subscribeDuel(id){if(state.duelUnsub){try{state.duelUnsub()}catch{}}state.duelUnsub=onValue(ref(db,`pokemonSiteDuels/${id}`),s=>setActiveDuel(s.exists()?{id,...s.val()}:null))}
function setActiveDuel(duel){
  const previous=state.duel;state.duel=duel;const arena=$('duelArena');const lobby=$('duelLobby');
  if(!duel||duel.status!=='active'){
    arena.hidden=true;lobby.hidden=false;const won=!!duel&&duel.winnerUid===state.user?.uid;$('duelStatusPill').textContent=won?'Vitória':duel?'Encerrado':'Aguardando';
    if(duel?.status==='finished'&&duel.id&&sessionStorage.getItem('gremory:duelResult')!==duel.id){sessionStorage.setItem('gremory:duelResult',duel.id);const reward=duel.reward||{};showGameResult({title:won?'Vitória Pokémon!':'Batalha encerrada',text:won?(reward.rupias?`Você ganhou ₹${reward.rupias}, ${reward.trainerXp||0} XP e ${reward.pokemonXp||0} XP Pokémon.`:'Você venceu a batalha.'):'A batalha foi encerrada.',win:won,icon:won?'⚡':'◉'})}
    return
  }
  arena.hidden=false;lobby.hidden=true;$('duelStatusPill').textContent=duel.turnUid===state.user?.uid?'Sua vez':'Vez do rival';renderDuel(duel)
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
  badge_demon:{name:'Selo Demoníaco',price:4200,className:'fx-badge-demon',slot:'badge'}
};
function ownedCustomization(id){return !!state.siteInventory?.items?.[id]}
function equippedCustomizationIds(){
  const equipped=state.siteCustomization?.equipped||{};
  const ids=Object.values(equipped).filter(Boolean).map(String);
  const legacy=String(state.siteCustomization?.active||'');if(legacy&&!ids.includes(legacy))ids.push(legacy);
  return ids;
}
function applyCustomization(){
  Object.values(STORE_CATALOG).forEach(x=>document.body.classList.remove(x.className));
  equippedCustomizationIds().forEach(id=>{if(STORE_CATALOG[id]&&ownedCustomization(id))document.body.classList.add(STORE_CATALOG[id].className)});
}
function renderStore(){
  if($('storeBalance'))$('storeBalance').textContent=`₹ ${formatNumber(accountSnapshot().balance)}`;
  const equipped=new Set(equippedCustomizationIds());
  $$('[data-store-item]').forEach(card=>{const id=card.dataset.storeItem;const owned=ownedCustomization(id);const isEquipped=equipped.has(id);card.classList.toggle('owned',owned);card.classList.toggle('equipped',isEquipped);const b=card.querySelector('[data-buy-customization]');if(!b)return;b.textContent=isEquipped?'Equipado':owned?'Equipar':'Comprar';b.classList.toggle('primary',!owned||!isEquipped)})
}
$$('[data-buy-customization]').forEach(btn=>btn.addEventListener('click',async()=>{
  const itemId=btn.dataset.buyCustomization;try{btn.disabled=true;if(!linkedCharlotte())throw new Error('Vincule a Charlotte primeiro.');if(ownedCustomization(itemId)){await bridgeRequest('equip_customization',{itemId});toast('Personalização equipada.')}else{const r=await bridgeRequest('buy_customization',{itemId},25000);toast(`${STORE_CATALOG[itemId]?.name||'Item'} comprado por ₹${formatNumber(r.price||0)}.`);await requestAccountSync().catch(()=>{})}}catch(e){toast(e.message)}finally{btn.disabled=false}
}));

function renderCollection(){
  const wrap=$('pokemonCollection');if(!wrap)return;const list=state.charlotteSync?.pokemon?.collection||[];wrap.innerHTML='';$('collectionCount').textContent=String(Array.isArray(list)?list.length:Object.keys(list||{}).length);const rows=Array.isArray(list)?list:Object.values(list||{});const draftIds=new Set((state.teamDraft||[]).map(x=>String(x.uid)));
  if(!rows.length){wrap.innerHTML='<div class="empty-state small">Nenhum Pokémon sincronizado.</div>';return}
  rows.slice(0,160).forEach(m=>{const p=normalizeMon(m);const d=document.createElement('div');d.className='collection-mon collection-mon-v5'+(p.fainted?' fainted':'');const img=document.createElement('img');img.src=p.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;img.alt='';const c=document.createElement('div');const st=document.createElement('strong');st.textContent=p.name;const sm=document.createElement('small');sm.textContent=`Lv.${p.level} • HP ${Math.max(0,p.hp)}/${p.maxHp}${p.fainted?' • DESMAIADO':''}`;c.append(st,sm);const acts=document.createElement('div');acts.className='collection-actions';const add=document.createElement('button');add.className='mini-btn';add.textContent=draftIds.has(String(p.uid))?'Na equipe':'Equipe';add.disabled=draftIds.has(String(p.uid));add.onclick=()=>addTeamMon(m);acts.appendChild(add);if(p.fainted){const heal=document.createElement('button');heal.className='mini-btn primary';heal.textContent='Hospital';heal.onclick=()=>startPokemonHealing(p.uid);acts.appendChild(heal)}d.append(img,c,acts);wrap.appendChild(d)})
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
  if(encounterSoundId&&state.pokemonAudio.encounterId!==encounterSoundId){state.pokemonAudio.encounterId=encounterSoundId;playPokemonSound('encounter')}
  $('wildStatusPill').textContent='Batalha';box.innerHTML='';
  const stage=document.createElement('div');stage.className='wild-battle-stage';stage.innerHTML=`<div class="wild-mon"><img src="${escText(wild.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wild.id}.png`)}" alt=""><strong>${escText(wild.name)}</strong><div class="pokemon-type-row">${typeBadgesHtml(wild.types)}</div><small>Lv.${wild.level} • HP ${Math.max(0,wild.hp)}/${wild.maxHp}</small></div><div class="wild-vs">VS</div><div class="wild-mon mine"><img src="${escText(mine.sprite||`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mine.id}.png`)}" alt=""><strong>${escText(mine.name||'Sua equipe')}</strong><div class="pokemon-type-row">${typeBadgesHtml(mine.types)}</div><small>${mine.uid?`HP ${Math.max(0,mine.hp)}/${mine.maxHp}`:'Escolha uma equipe saudável'}</small></div>`;
  const acts=document.createElement('div');acts.className='wild-actions';
  if(mine.uid){(mine.moves.length?mine.moves:[{name:'Ataque rápido'},{name:'Investida'}]).slice(0,4).forEach((m,i)=>{const b=document.createElement('button');b.className='btn';b.textContent=`${m.nome||m.name||`Golpe ${i+1}`} • ${typeLabel(m.type||m.tipo||'normal')}`;b.onclick=async()=>{try{await bridgeRequest('pokemon_wild_move',{moveIndex:i},30000);playPokemonSound('hit')}catch(er){toast(er.message)}};acts.appendChild(b)})}
  ['pokebola','greatball','ultraball'].forEach(ball=>{const b=document.createElement('button');b.className=ball==='ultraball'?'btn primary':'btn';b.textContent=ball==='pokebola'?'Pokébola':ball==='greatball'?'Great Ball':'Ultra Ball';b.onclick=async()=>{try{playPokemonSound('ball');const r=await bridgeRequest('pokemon_capture',{ball},30000);toast(r.captured?'Pokémon capturado!':`Escapou! Chance ${r.chance||'?'}%.`);if(r.captured){playPokemonSound('capture');await requestAccountSync().catch(()=>{})}}catch(er){toast(er.message)}};acts.appendChild(b)});
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
  if(!linkedCharlotte()){const b=document.createElement('button');b.className='btn primary';b.textContent='Vincular Charlotte para atacar';b.onclick=()=>navigate('charlotte');acts.appendChild(b)}else moves.slice(0,4).forEach((m,i)=>{const b=document.createElement('button');b.className='btn'+(i===0?' primary':'');b.innerHTML=`<b>${escText(m.nome||m.name||`Golpe ${i+1}`)}</b><small>${escText(typeLabel(m.type||m.tipo||'normal'))} • ${Number(m.power||m.poder||0)}</small>`;b.onclick=async()=>{try{b.disabled=true;const r=await bridgeRequest('site_raid_attack',{moveIndex:i},30000);if(r?.damage)toast(`Ataque: ${r.damage} de dano${r.effectText?' • '+r.effectText:''}`)}catch(e){toast(e.message)}finally{setTimeout(()=>b.disabled=false,1200)}};acts.appendChild(b)});
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
async function openPublicProfile(uid,fallback={}){
  if(!uid)return;let p=fallback;try{const sn=await get(ref(db,`directory/${uid}`));if(sn.exists())p=sn.val()}catch{}currentPublicProfile={uid,...p};$('publicProfileAvatar').src=p.avatar||DEFAULT_AVATAR;$('publicProfileName').textContent=p.nome||'Usuário';if($('publicProfileUsername'))$('publicProfileUsername').textContent=p.username?`@${normalizeUsername(p.username)}`:'@sem_usuario';$('publicProfileBio').textContent=p.bio||'Conta Gremory';$('publicProfileAnime').textContent=p.favoriteAnime||'—';$('publicProfileSince').textContent=p.createdAt?shortDate(p.createdAt):'—';const isFriend=!!state.friends?.[uid];const btn=$('publicProfileActionBtn');btn.textContent=isFriend?'Amigo':'Adicionar amigo';btn.disabled=isFriend||uid===state.user?.uid;$('publicProfileDuelBtn').disabled=!isFriend;openModal('publicProfileModal')
}
$('publicProfileActionBtn')?.addEventListener('click',()=>{if(currentPublicProfile)sendFriendRequest(currentPublicProfile.uid,currentPublicProfile)});
$('publicProfileDuelBtn')?.addEventListener('click',()=>{if(!currentPublicProfile)return;closeModal('publicProfileModal');navigate('pokemon');$('duelFriendSelect').value=currentPublicProfile.uid;setTimeout(()=>$('sendDuelChallengeBtn')?.scrollIntoView({behavior:'smooth',block:'center'}),80)});
$('publicProfileReportBtn')?.addEventListener('click',()=>{if(!currentPublicProfile)return;closeModal('publicProfileModal');openModal('reportModal')});

function burstConfetti(){
  const root=document.createElement('div');root.className='confetti-root';
  for(let i=0;i<34;i++){const bit=document.createElement('i');bit.className='confetti-piece';bit.style.setProperty('--x',`${Math.random()*100}%`);bit.style.setProperty('--delay',`${Math.random()*.45}s`);bit.style.setProperty('--spin',`${Math.round(Math.random()*720+180)}deg`);bit.style.setProperty('--dur',`${1.2+Math.random()*.9}s`);bit.style.background=`hsl(${Math.floor(Math.random()*360)} 78% 62%)`;root.appendChild(bit)}
  document.body.appendChild(root);setTimeout(()=>root.remove(),2600)
}
function showGameResult({title='Partida encerrada',text='',win=false,icon='★'}={}){
  if($('gameResultTitle'))$('gameResultTitle').textContent=title;if($('gameResultText'))$('gameResultText').textContent=text;if($('gameResultIcon'))$('gameResultIcon').textContent=icon;openModal('gameResultModal');if(win){burstConfetti();playVictoryTone()}
}

// Jogo da velha seguro pelo bridge
function renderTttFriendSelect(){const sel=$('tttFriendSelect');if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">Escolha um amigo</option>';Object.values(state.friends||{}).forEach(f=>{const o=document.createElement('option');o.value=f.uid;o.textContent=f.nome||'Usuário';sel.appendChild(o)});if(state.friends[cur])sel.value=cur}
$('tttCreateBtn')?.addEventListener('click',async()=>{const targetUid=$('tttFriendSelect').value;if(!targetUid)return toast('Escolha um amigo.');try{await bridgeRequest('ttt_create',{targetUid},25000,false);toast('Partida criada.')}catch(e){toast(e.message)}});
function handleTttIndex(obj){
  const rows=Object.entries(obj||{}).map(([id,v])=>({id,...v})).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
  const active=rows.find(x=>x.status==='active');if(active){if(state.ttt.game?.id!==active.id)subscribeTtt(active.id);return}
  const finished=rows.find(x=>x.status==='finished');if(finished&&state.ttt.game?.id!==finished.id)subscribeTtt(finished.id);else if(!finished)setTttGame(null)
}
function subscribeTtt(id){if(state.ttt.unsub){try{state.ttt.unsub()}catch{}}state.ttt.unsub=onValue(ref(db,`ticTacToeGames/${id}`),sn=>setTttGame(sn.exists()?{id,...sn.val()}:null))}
function setTttGame(g){
  state.ttt.game=g;const panel=$('tttGamePanel');
  if(!g||g.status!=='active'){
    panel.hidden=true;const won=!!g&&g.winnerUid===state.user?.uid;const draw=!!g&&!g.winnerUid;$('tttStatus').textContent=won?'Você venceu':g?(draw?'Empate':'Encerrada'):'Livre';
    if(g?.status==='finished'&&g.id&&state.ttt.lastResultId!==g.id){state.ttt.lastResultId=g.id;if(state.user)localStorage.setItem(`gremory:tttSeen:${state.user.uid}`,g.id);const reward=g.reward||{};showGameResult({title:draw?'Empate!':won?'Vitória!':'Partida encerrada',text:draw?'Ninguém venceu essa rodada.':won?(reward.rupias?`Você ganhou ₹${reward.rupias}.`:'Você venceu. O limite diário de recompensa pode ter sido atingido.'):'Seu amigo venceu esta rodada.',win:won,icon:draw?'＝':won?'✦':'✕'})}
    return
  }
  panel.hidden=false;$('tttStatus').textContent=g.turnUid===state.user?.uid?'Sua vez':'Vez do amigo';renderTtt(g)
}
function renderTtt(g){const me=g.players?.[state.user.uid],other=Object.values(g.players||{}).find(x=>x.uid!==state.user.uid);$('tttTitle').textContent=`${me?.name||'Você'} × ${other?.name||'Amigo'}`;$('tttTurnText').textContent=g.turnUid===state.user.uid?`Sua vez • você é ${me?.symbol||'X'}`:`Vez de ${other?.name||'amigo'}`;const board=$('tttBoard');board.innerHTML='';const cells=Array.isArray(g.board)?g.board:Array.from({length:9},(_,i)=>g.board?.[i]||'');cells.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.className='ttt-cell';b.textContent=v||'';b.disabled=!!v||g.turnUid!==state.user.uid||g.status!=='active';b.onclick=async()=>{try{await bridgeRequest('ttt_move',{gameId:g.id,index:i},20000,false)}catch(e){toast(e.message)}};board.appendChild(b)});const log=$('tttLog');log.innerHTML=Object.values(g.log||{}).slice(-8).reverse().map(x=>`<div>${escText(x.text||'')}</div>`).join('')||'<div>Partida iniciada.</div>'}
$('tttExitBtn')?.addEventListener('click',async()=>{if(!state.ttt.game)return;try{await bridgeRequest('ttt_exit',{gameId:state.ttt.game.id},20000,false)}catch(e){toast(e.message)}});

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
async function uniqueWatchCode(){for(let i=0;i<8;i++){const c=randomCode();const sn=await get(ref(db,`watchRooms/${c}`));if(!sn.exists())return c}throw new Error('Não foi possível gerar código.')}
async function createWatchRoom(ev){ev.preventDefault();if(!state.user)return;try{const code=await uniqueWatchCode(),createdAt=nowIso(),name=$('watchNameInput').value.trim()||'Watch Party';const room={meta:{code,name,ownerUid:state.user.uid,createdAt},members:{[state.user.uid]:{uid:state.user.uid,name:displayName(),avatar:avatarFor(),role:'Host',joinedAt:createdAt}},media:{url:'',type:'',playing:false,position:0,updatedAt:Date.now()}};await set(ref(db,`watchRooms/${code}`),room);await set(ref(db,`watchUserRooms/${state.user.uid}/${code}`),{code,name,role:'Host',joinedAt:createdAt});closeModal('watchCreateModal');$('watchCreateForm').reset();await openWatchRoom(code)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível criar a sala.'),6000)}}
async function loadWatchRooms(){if(!state.user)return;const box=$('watchRoomsList');box.innerHTML='<div class="loading-line">Carregando...</div>';try{const sn=await get(ref(db,`watchUserRooms/${state.user.uid}`));box.innerHTML='';const rows=sn.exists()?Object.values(sn.val()):[];$('homeWatchRecent').textContent=rows.length?`${rows.length} sala${rows.length===1?'':'s'}`:'Assistir e conversar';if(!rows.length){box.innerHTML='<div class="empty-state small">Nenhuma sala.</div>';return}rows.forEach(r=>{const item=document.createElement('div');item.className='room-item';const c=document.createElement('div');c.innerHTML=`<strong>${escText(r.name||r.code)}</strong><small>${escText(r.code)} • ${escText(r.role||'Participante')}</small>`;const acts=document.createElement('div');acts.className='room-item-actions';const b=document.createElement('button');b.className='btn';b.textContent='Entrar';b.onclick=()=>openWatchRoom(r.code);acts.appendChild(b);if(r.role==='Host'){const del=document.createElement('button');del.className='btn danger-ghost';del.textContent='Apagar';del.onclick=()=>deleteWatchRoom(r.code,r.name);acts.appendChild(del)}item.append(c,acts);box.appendChild(item)})}catch(e){box.innerHTML=`<div class="empty-state small">${permissionMessage(e)}</div>`}}
async function joinWatchRoom(code){if(!state.user)return;try{const sn=await get(ref(db,`watchRooms/${code}`));if(!sn.exists())throw new Error('Sala não encontrada.');const room=sn.val(),member={uid:state.user.uid,name:displayName(),avatar:avatarFor(),role:room.meta?.ownerUid===state.user.uid?'Host':'Participante',joinedAt:nowIso()};await set(ref(db,`watchRooms/${code}/members/${state.user.uid}`),member);await set(ref(db,`watchUserRooms/${state.user.uid}/${code}`),{code,name:room.meta?.name||code,role:member.role,joinedAt:nowIso()});$('watchJoinCode').value='';await openWatchRoom(code)}catch(e){toast(permissionMessage(e,e.message||'Não foi possível entrar.'))}}
async function openWatchRoom(code){clearUnsubs(state.watchUnsubs);state.watchCode=code;$('watchLobby').hidden=true;$('watchRoom').hidden=false;if($('watchCreateBtn'))$('watchCreateBtn').hidden=true;state.watchUnsubs.push(onValue(ref(db,`watchRooms/${code}`),sn=>{if(!sn.exists()){toast('Essa sala não existe mais.');closeWatchRoom(false);return}state.watchRoom=sn.val();renderWatchRoom()}));navigate('watch')}
function isWatchHost(){return !!state.user&&state.watchRoom?.meta?.ownerUid===state.user.uid}
function renderWatchRoom(){
  const r=state.watchRoom||{},m=r.meta||{};$('watchRoomName').textContent=m.name||'Watch Party';$('watchCode').textContent=state.watchCode||'------';$('watchHostPill').textContent=isWatchHost()?'Host':'Participante';$('watchMemberCount').textContent=String(Object.keys(r.members||{}).length);
  const list=$('watchMemberList');list.innerHTML='';Object.values(r.members||{}).forEach(x=>{const d=document.createElement('div');d.className='member-item watch-member-item';const img=document.createElement('img');img.src=x.avatar||DEFAULT_AVATAR;const c=document.createElement('div');c.innerHTML=`<strong>${escText(x.name||'Usuário')}</strong><small>${escText(x.role||'Participante')}</small>`;d.append(img,c);list.appendChild(d)});
  $('watchMediaInput').disabled=!isWatchHost();$('watchMediaForm').querySelector('button').disabled=!isWatchHost();$('watchPlayBtn').disabled=!isWatchHost();if($('watchMusicSkipBtn'))$('watchMusicSkipBtn').disabled=!isWatchHost();
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
    return byPath||u.searchParams.get('id')||'';
  }catch{return''}
}
function googleDriveEmbed(url){const id=googleDriveFileId(url);return id?`https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`:''}
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
  if(!url){if(!state.watchRtc.activeScreenUid&&!state.watchRtc.screenStream)stage.innerHTML='<div class="empty-state">Cole um link do YouTube, Google Drive ou vídeo direto; ou compartilhe sua tela.</div>';if(playBtn)playBtn.disabled=true;if(syncBtn)syncBtn.disabled=true;return}
  const yt=youtubeEmbed(url,!host),drive=googleDriveEmbed(url);
  if(yt){
    if(playBtn)playBtn.disabled=!host;if(syncBtn)syncBtn.disabled=false;
    let f=stage.querySelector('iframe[data-watch-youtube="1"]');
    if(!f||stage.dataset.url!==url){stage.innerHTML='';f=document.createElement('iframe');f.className='watch-iframe'+(host?'':' watch-viewer-locked');f.dataset.watchYoutube='1';f.src=yt;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;stage.appendChild(f);stage.dataset.url=url;f.addEventListener('load',()=>setTimeout(()=>{startYoutubeListening(f);applyYoutubeWatchState(f,state.watchRoom?.media||media)},300))}
    else setTimeout(()=>{startYoutubeListening(f);applyYoutubeWatchState(f,media)},35);
    return
  }
  if(drive){
    if(playBtn){playBtn.disabled=true;playBtn.textContent='Controles no Drive'}if(syncBtn)syncBtn.disabled=true;
    let f=stage.querySelector('iframe[data-watch-drive="1"]');if(!f||stage.dataset.url!==url){stage.innerHTML='';f=document.createElement('iframe');f.className='watch-iframe drive-iframe';f.dataset.watchDrive='1';f.src=drive;f.allow='autoplay; fullscreen';f.allowFullscreen=true;stage.appendChild(f);stage.dataset.url=url}return
  }
  if(playBtn)playBtn.disabled=!host;if(syncBtn)syncBtn.disabled=false;
  let v=stage.querySelector('video');if(!v||stage.dataset.url!==url){stage.innerHTML='';v=document.createElement('video');v.className='watch-video';v.src=url;v.controls=host;v.playsInline=true;stage.appendChild(v);stage.dataset.url=url;v.addEventListener('play',()=>{if(host&&!state.watchApplying)publishWatchPlayer(true)});v.addEventListener('pause',()=>{if(host&&!state.watchApplying)publishWatchPlayer(false)});v.addEventListener('seeked',()=>{if(host&&!state.watchApplying)publishWatchPlayer(!v.paused)})}
  v.controls=host;v.classList.toggle('watch-viewer-locked',!host);const target=watchMediaPosition(media);
  if(Math.abs((v.currentTime||0)-target)>2){state.watchApplying=true;try{v.currentTime=target}catch{}setTimeout(()=>state.watchApplying=false,250)}
  if(media.playing&&v.paused){state.watchApplying=true;v.play().catch(()=>{}).finally(()=>setTimeout(()=>state.watchApplying=false,250))}
  if(!media.playing&&!v.paused){state.watchApplying=true;v.pause();setTimeout(()=>state.watchApplying=false,250)}
}

async function setWatchMedia(ev){
  ev.preventDefault();if(!isWatchHost())return;const url=$('watchMediaInput').value.trim();if(!/^https?:\/\//i.test(url))return toast('Use um link http/https.');
  const type=youtubeEmbed(url)?'youtube':googleDriveEmbed(url)?'drive':'video';
  await set(ref(db,`watchRooms/${state.watchCode}/media`),{url,type,playing:false,position:0,updatedAt:Date.now()}).catch(e=>toast(permissionMessage(e)));
  if(type==='drive')toast('Google Drive carregado. O Drive não permite sincronizar Play/Pause por API; cada pessoa usa os controles do player.');
}
async function publishWatchPlayer(playing){
  if(!isWatchHost())return;const shell=$('watchMediaStage'),v=shell?.querySelector('video'),media=state.watchRoom?.media||{};
  const position=v?Number(v.currentTime||0):(media.type==='youtube'?Number(state.watchYoutube.lastTime||watchMediaPosition(media)):watchMediaPosition(media));
  await update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:!!playing,position,updatedAt:Date.now()}).catch(()=>{})
}
async function toggleWatchPlayback(){
  if(!isWatchHost())return;const shell=$('watchMediaStage'),v=shell?.querySelector('video'),media=state.watchRoom?.media||{};
  if(media.type==='drive')return toast('No Google Drive, Play/Pause usa os controles do próprio player.');
  if(v){if(v.paused)v.play().catch(()=>{});else v.pause();return}
  const iframe=shell.querySelector('iframe[data-watch-youtube="1"]');
  if(iframe){const next=!media.playing;const position=Number(state.watchYoutube.lastTime||watchMediaPosition(media));state.watchApplying=true;youtubeCommand(iframe,next?'playVideo':'pauseVideo',[]);setTimeout(()=>state.watchApplying=false,500);await update(ref(db,`watchRooms/${state.watchCode}/media`),{playing:next,position,updatedAt:Date.now()}).catch(()=>{});return}
  toast('Carregue um vídeo primeiro.')
}
function syncWatchPlayer(){
  const media=state.watchRoom?.media||{};if(media.type==='drive')return toast('Google Drive não expõe sincronização de reprodução.');
  const iframe=$('watchMediaStage')?.querySelector('iframe[data-watch-youtube="1"]');if(iframe)applyYoutubeWatchState(iframe,media);else renderWatchMedia(media);toast('Player sincronizado.')
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
  if($('watchShareBtn')){$('watchShareBtn').hidden=!state.watchCode;$('watchShareBtn').textContent=rtc.screenStream?'Parar compartilhamento':'Compartilhar tela';$('watchShareBtn').classList.toggle('active',!!rtc.screenStream)}
  if($('watchLeaveVoiceBtn'))$('watchLeaveVoiceBtn').hidden=!audio;
  if(state.watchRoom)renderWatchMusic(state.watchRoom.musicQueue||{},state.watchRoom.musicAccess||{},state.watchRoom.musicPlan||{},state.watchRoom.musicPlayback||{})
}
function setWatchRtcStatus(text,tone=''){
  const el=$('watchRtcStatus');if(!el)return;el.textContent=String(text||'');el.dataset.tone=tone||''
}
function watchPeerName(uid){return state.watchRoom?.members?.[uid]?.name||'Participante'}
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
function watchRemoteHasScreen(uid,stream=watchScreenStreamFor(uid)){return state.watchRtc.screenSharers.has(String(uid||''))&&!!stream?.getVideoTracks?.().some(t=>t.readyState==='live'&&!t.muted)}
async function sendWatchRtc(targetUid,payload){if(!state.user||!state.watchCode)return;await push(ref(db,`watchRtc/${state.watchCode}/${targetUid}`),{fromUid:state.user.uid,at:Date.now(),...payload})}
async function negotiateWatchPeer(peerUid,{iceRestart=false,reason='update'}={}){
  const pc=state.watchRtc.peers.get(peerUid);if(!pc||pc.signalingState==='closed'||pc.signalingState!=='stable'||state.watchRtc.makingOffer.has(peerUid))return false;
  state.watchRtc.makingOffer.add(peerUid);
  try{
    const offer=await pc.createOffer({iceRestart:!!iceRestart});await pc.setLocalDescription(offer);
    await sendWatchRtc(peerUid,{type:'offer',sdp:pc.localDescription?.sdp||offer.sdp,reason,iceRestart:!!iceRestart});return true
  }finally{state.watchRtc.makingOffer.delete(peerUid)}
}
async function tuneWatchScreenSender(pc){
  const sender=watchPcSender(pc,'video');if(!sender)return;
  try{
    const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];
    const mobile=matchMedia('(max-width:820px)').matches;
    p.encodings[0].maxBitrate=mobile?1100000:2200000;
    p.encodings[0].maxFramerate=mobile?15:24;
    p.degradationPreference='balanced';
    await sender.setParameters(p)
  }catch{}
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
    btn.onclick=()=>{if(ready){state.watchRtc.activeScreenUid=uid;refreshWatchScreenStage()}else{setWatchRtcStatus('Reconectando compartilhamento...','warn');requestWatchScreenFrom(uid,true)}}
  }
  const status=card?.querySelector('small');if(status)status.textContent=sharing?(ready?'Compartilhando tela':'Conectando tela...'):'Conectado'
}
function refreshWatchScreenStage(){
  const stage=$('watchScreenStage'),video=$('watchScreenVideo'),label=$('watchScreenLabel'),mediaStage=$('watchMediaStage'),soundBtn=$('watchScreenSoundBtn');if(!stage||!video)return;
  let stream=null,uid=null,isLocal=false;
  const localUid=String(state.user?.uid||''),localVideo=state.watchRtc.screenStream?.getVideoTracks?.()[0];

  if(state.watchRtc.activeScreenUid&&state.watchRtc.activeScreenUid!==localUid){
    const remote=watchScreenStreamFor(state.watchRtc.activeScreenUid);
    if(watchRemoteHasScreen(state.watchRtc.activeScreenUid,remote)){stream=remote;uid=state.watchRtc.activeScreenUid}
  }
  if(!stream&&localVideo&&localVideo.readyState==='live'){stream=state.watchRtc.screenStream;uid=localUid;isLocal=true}
  if(!stream){
    for(const peerUid of state.watchRtc.screenSharers){
      if(peerUid===localUid)continue;
      const remote=watchScreenStreamFor(peerUid);
      if(watchRemoteHasScreen(peerUid,remote)){stream=remote;uid=peerUid;break}
    }
  }

  if(!stream){
    state.watchRtc.activeScreenUid=null;
    try{video.pause()}catch{}
    video.srcObject=null;stage.hidden=true;if(mediaStage)mediaStage.hidden=false;
    return
  }

  state.watchRtc.activeScreenUid=uid;stage.hidden=false;if(mediaStage)mediaStage.hidden=true;

  const selected=new MediaStream();
  const vtrack=stream.getVideoTracks?.().find(t=>t.readyState==='live');
  const atrack=stream.getAudioTracks?.().find(t=>t.readyState==='live');
  if(vtrack)selected.addTrack(vtrack);
  if(atrack)selected.addTrack(atrack);

  const currentVideo=video.srcObject?.getVideoTracks?.()[0],currentAudio=video.srcObject?.getAudioTracks?.()[0];
  if(currentVideo?.id!==vtrack?.id||currentAudio?.id!==atrack?.id)video.srcObject=selected;

  // O próprio compartilhador não ouve seu áudio de tela para não criar eco.
  // Quem assiste recebe o áudio da transmissão quando o navegador capturou esse áudio.
  video.muted=isLocal||state.watchRtc.screenSoundMuted;
  video.volume=1;
  video.play?.().catch(()=>{});

  if(label)label.textContent=isLocal?'Sua tela compartilhada':`${watchPeerName(uid)} está compartilhando`;
  if(soundBtn){
    const hasAudio=!!atrack;
    soundBtn.hidden=isLocal;
    soundBtn.disabled=!hasAudio;
    soundBtn.textContent=!hasAudio?'Sem áudio':(state.watchRtc.screenSoundMuted?'Som: desligado':'Som: ligado')
  }
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
    ev.track.onunmute=()=>attachWatchRemote(peerUid);
    ev.track.onended=()=>attachWatchRemote(peerUid);
    attachWatchRemote(peerUid)
  };

  pc.onicecandidate=ev=>{if(ev.candidate)sendWatchRtc(peerUid,{type:'candidate',candidate:ev.candidate.toJSON()}).catch(()=>{})};
  pc.oniceconnectionstatechange=()=>{
    const st=pc.iceConnectionState;
    if(['connected','completed'].includes(st)){setWatchRtcStatus('Chamada conectada','ok');state.watchRtc.screenRetry.delete(peerUid)}
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
      if(pc.signalingState==='have-local-offer'){try{await pc.setLocalDescription({type:'rollback'})}catch{}}
      if(pc.signalingState!=='stable')return;
      await pc.setRemoteDescription({type:'offer',sdp:msg.sdp});await flushWatchCandidates(from,pc);
      const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await sendWatchRtc(from,{type:'answer',sdp:pc.localDescription?.sdp||ans.sdp,reason:msg.reason||''})
    }else if(msg.type==='answer'){
      if(pc.signalingState==='have-local-offer'){await pc.setRemoteDescription({type:'answer',sdp:msg.sdp});await flushWatchCandidates(from,pc)}
    }else if(msg.type==='candidate'&&msg.candidate){
      if(pc.remoteDescription)try{await pc.addIceCandidate(msg.candidate)}catch{}else{const q=state.watchRtc.pendingCandidates.get(from)||[];q.push(msg.candidate);state.watchRtc.pendingCandidates.set(from,q)}
    }else if(msg.type==='screen_request'){
      const videoTrack=state.watchRtc.screenStream?.getVideoTracks?.()[0];
      const audioTrack=state.watchRtc.screenStream?.getAudioTracks?.()[0];
      if(videoTrack&&videoTrack.readyState==='live'){
        const videoSender=watchPcSender(pc,'video');if(videoSender)await videoSender.replaceTrack(videoTrack);
        const audioSender=watchPcSender(pc,'audio','screen');if(audioSender)await audioSender.replaceTrack(audioTrack&&audioTrack.readyState==='live'?audioTrack:null);
        await tuneWatchScreenSender(pc);await negotiateWatchPeer(from,{iceRestart:false,reason:'screen-request'})
      }
    }
  }finally{remove(ref(db,`watchRtc/${state.watchCode}/${state.user.uid}/${id}`)).catch(()=>{})}
}
function watchWatchRtcInbox(){try{state.watchRtc.inboxUnsub?.()}catch{}state.watchRtc.inboxUnsub=onValue(ref(db,`watchRtc/${state.watchCode}/${state.user.uid}`),sn=>{const all=sn.exists()?sn.val():{};Object.entries(all).sort((a,b)=>(a[1]?.at||0)-(b[1]?.at||0)).forEach(([id,msg])=>handleWatchRtc(id,msg).catch(()=>{}))})}
function watchWatchPresence(){
  try{state.watchRtc.presenceUnsub?.()}catch{}
  state.watchRtc.presenceUnsub=onValue(ref(db,`watchVoice/${state.watchCode}`),sn=>{
    const p=sn.exists()?sn.val():{};state.watchRtc.presence=p;
    const ids=Object.keys(p).filter(uid=>uid!==state.user.uid),voiceCount=Object.values(p).filter(x=>x?.audio===true).length;
    $('watchVoiceCount').textContent=String(voiceCount);
    state.watchRtc.screenSharers=new Set(Object.entries(p).filter(([,x])=>x?.screen===true).map(([uid])=>String(uid)));
    for(const uid of ids){if(!state.watchRtc.peers.has(uid)&&String(state.user.uid).localeCompare(uid)<0)createWatchPeer(uid,true).catch(()=>{})}
    for(const uid of [...state.watchRtc.peers.keys()])if(!p[uid])removeWatchPeer(uid);
    for(const uid of ids){
      updateWatchPeerScreenButton(uid);
      if(state.watchRtc.screenSharers.has(uid)&&!watchRemoteHasScreen(uid,watchScreenStreamFor(uid))){
        setTimeout(()=>{if(state.watchRtc.screenSharers.has(uid)&&!watchRemoteHasScreen(uid,watchScreenStreamFor(uid)))requestWatchScreenFrom(uid,false)},800)
      }
    }
    if(ids.some(uid=>state.watchRtc.screenSharers.has(uid))&&!state.watchRtc.screenStream)setWatchRtcStatus('Recebendo compartilhamento de tela...','warn');
    else if(ids.length)setWatchRtcStatus('Chamada conectada','ok');else setWatchRtcStatus('Aguardando outras pessoas','');
    refreshWatchScreenStage()
  })
}
async function ensureWatchRtcSession(){
  if(state.watchRtc.joined)return true;if(!state.user||!state.watchCode)return false;
  state.watchRtc.joined=true;
  try{
    const presenceRef=ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`);
    await set(presenceRef,{uid:state.user.uid,name:displayName(),joinedAt:Date.now(),audio:false,screen:false});
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
function toggleWatchMic(){const track=state.watchRtc.localStream?.getAudioTracks?.()[0];if(!track)return;track.enabled=!track.enabled;state.watchRtc.micEnabled=track.enabled;watchVoiceUi()}
async function leaveWatchAudio(silent=false){
  const track=state.watchRtc.localStream?.getAudioTracks?.()[0];if(track)track.stop();state.watchRtc.localStream=null;state.watchRtc.audioJoined=false;state.watchRtc.micEnabled=true;
  for(const pc of state.watchRtc.peers.values()){const sender=watchPcSender(pc,'audio','voice');if(sender)await sender.replaceTrack(null)}
  if(state.watchCode&&state.user)await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{audio:false}).catch(()=>{});
  $$('.watch-call-card audio').forEach(a=>a.muted=true);destroyWatchMusicPlayback();watchVoiceUi();if(!silent)toast('Você saiu da voz.')
}
async function toggleWatchScreen(){
  if(!state.user||!state.watchCode)return toast('Entre numa sala primeiro.');

  if(state.watchRtc.screenStream){
    const old=state.watchRtc.screenStream;state.watchRtc.screenStream=null;
    old.getTracks().forEach(t=>{t.onended=null;t.stop()});

    for(const [uid,pc] of state.watchRtc.peers){
      const videoSender=watchPcSender(pc,'video');if(videoSender)await videoSender.replaceTrack(null);
      const screenAudioSender=watchPcSender(pc,'audio','screen');if(screenAudioSender)await screenAudioSender.replaceTrack(null);
      if(pc.signalingState==='stable')await negotiateWatchPeer(uid,{reason:'screen-stop'}).catch(()=>{})
    }

    state.watchRtc.screenSharers.delete(String(state.user.uid));state.watchRtc.activeScreenUid=null;
    await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{screen:false,screenAt:null,screenAudio:false}).catch(()=>{});
    setWatchRtcStatus('Compartilhamento encerrado','');
    refreshWatchScreenStage();watchVoiceUi();return
  }

  if(!navigator.mediaDevices?.getDisplayMedia)return toast('Seu navegador não permite compartilhar a tela.');
  if(!await ensureWatchRtcSession())return;

  try{
    setWatchRtcStatus('Escolha a tela ou janela para compartilhar...','warn');

    // audio:true solicita o áudio da aba/tela quando o navegador/SO oferece suporte.
    // Em Chrome/Edge, ao compartilhar uma aba, marque "Compartilhar áudio".
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{frameRate:{ideal:18,max:24},width:{ideal:1280,max:1600},height:{ideal:720,max:900}},
      audio:true,
      systemAudio:'include',
      surfaceSwitching:'include'
    });

    const videoTrack=stream.getVideoTracks()[0];
    try{if(videoTrack)videoTrack.contentHint='detail'}catch{}
    const screenAudioTrack=stream.getAudioTracks()[0]||null;
    if(!videoTrack)throw new Error('Nenhuma tela selecionada.');

    state.watchRtc.screenStream=stream;
    state.watchRtc.activeScreenUid=String(state.user.uid);
    state.watchRtc.screenSharers.add(String(state.user.uid));

    await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{
      screen:true,screenAt:Date.now(),screenAudio:!!screenAudioTrack
    });

    const ids=Object.keys(state.watchRtc.presence||{}).filter(uid=>uid!==state.user.uid);
    for(const uid of ids){
      let pc=state.watchRtc.peers.get(uid);if(!pc)pc=await createWatchPeer(uid,false);
      const videoSender=watchPcSender(pc,'video');if(videoSender)await videoSender.replaceTrack(videoTrack);
      const screenAudioSender=watchPcSender(pc,'audio','screen');
      if(screenAudioSender)await screenAudioSender.replaceTrack(screenAudioTrack&&screenAudioTrack.readyState==='live'?screenAudioTrack:null);
      await tuneWatchScreenSender(pc);if(pc.signalingState==='stable')await negotiateWatchPeer(uid,{iceRestart:false,reason:'screen-start'}).catch(()=>{})
    }

    videoTrack.onended=()=>{if(state.watchRtc.screenStream)toggleWatchScreen().catch(()=>{})};
    if(screenAudioTrack)screenAudioTrack.onended=()=>refreshWatchScreenStage();

    setWatchRtcStatus(screenAudioTrack?'Tela e áudio sendo compartilhados':'Tela compartilhada sem áudio','ok');
    refreshWatchScreenStage();watchVoiceUi();

    if(screenAudioTrack)toast('Tela + áudio compartilhados com a sala.');
    else toast('Tela compartilhada. Para transmitir som, no seletor do navegador marque “Compartilhar áudio”.',6000)
  }catch(e){
    state.watchRtc.screenStream=null;state.watchRtc.screenSharers.delete(String(state.user?.uid||''));
    if(state.watchCode&&state.user)await update(ref(db,`watchVoice/${state.watchCode}/${state.user.uid}`),{screen:false,screenAt:null,screenAudio:false}).catch(()=>{});
    setWatchRtcStatus('Compartilhamento não iniciado','');
    if(e?.name!=='NotAllowedError')toast(`Não foi possível compartilhar a tela${e?.message?`: ${e.message}`:'.'}`);
    watchVoiceUi()
  }
}
function updateWatchFullscreenButton(){
  const btn=$('watchScreenFullscreenBtn'),stage=$('watchScreenStage');if(!btn||!stage)return;
  const active=document.fullscreenElement===stage||document.webkitFullscreenElement===stage;
  btn.textContent=active?'Sair da tela cheia':'Tela cheia'
}
async function fullscreenWatchScreen(){
  const stage=$('watchScreenStage'),video=$('watchScreenVideo');if(!stage||stage.hidden)return toast('Nenhuma tela está sendo compartilhada.');
  try{
    const active=document.fullscreenElement===stage||document.webkitFullscreenElement===stage;
    if(active){
      if(document.exitFullscreen)await document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      updateWatchFullscreenButton();return
    }

    if(stage.requestFullscreen)await stage.requestFullscreen();
    else if(stage.webkitRequestFullscreen)stage.webkitRequestFullscreen();
    else if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();
    else return toast('Tela cheia não é suportada neste navegador.');

    updateWatchFullscreenButton()
  }catch{toast('Não foi possível alternar a tela cheia.')}
}
document.addEventListener('fullscreenchange',updateWatchFullscreenButton);
document.addEventListener('webkitfullscreenchange',updateWatchFullscreenButton);
$('watchScreenSoundBtn')?.addEventListener('click',()=>{
  state.watchRtc.screenSoundMuted=!state.watchRtc.screenSoundMuted;
  refreshWatchScreenStage()
});
async function leaveWatchVoice(silent=false){
  if(!state.watchRtc.joined&&!state.watchRtc.localStream&&!state.watchRtc.peers.size)return;
  const code=state.watchCode,uid=state.user?.uid;
  try{state.watchRtc.presenceUnsub?.()}catch{}try{state.watchRtc.inboxUnsub?.()}catch{}try{await state.watchRtc.disconnectRef?.cancel?.()}catch{}
  state.watchRtc.presenceUnsub=null;state.watchRtc.inboxUnsub=null;state.watchRtc.disconnectRef=null;
  for(const pc of state.watchRtc.peers.values()){try{pc.close()}catch{}}
  state.watchRtc.peers.clear();state.watchRtc.remoteStreams.clear();state.watchRtc.remoteVoiceStreams.clear();state.watchRtc.remoteScreenStreams.clear();state.watchRtc.localStream?.getTracks?.().forEach(t=>t.stop());state.watchRtc.screenStream?.getTracks?.().forEach(t=>t.stop());
  state.watchRtc.localStream=null;state.watchRtc.screenStream=null;state.watchRtc.joined=false;state.watchRtc.audioJoined=false;state.watchRtc.activeScreenUid=null;state.watchRtc.micEnabled=true;
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


let pdfLibPromise=null,pdfJsPromise=null,designBgImage=null;
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

function hexToRgba(hex,a=1){const h=String(hex||'#ffffff').replace('#','');const v=h.length===3?h.split('').map(x=>x+x).join(''):h;const n=parseInt(v,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`}
function wrapCanvasText(ctx,text,maxWidth){const raw=String(text||'').trim();if(!raw)return[];const paragraphs=raw.split(/\n+/);const out=[];for(const paragraph of paragraphs){const words=paragraph.split(/\s+/);let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){out.push(line);line=word}else line=test}if(line)out.push(line)}return out.slice(0,6)}
function renderDesignCanvas(){
  const c=$('designCanvas');if(!c)return;
  const dims=String($('canvasPreset')?.value||'1080x1080').split('x').map(Number);
  const width=dims[0]||1080,height=dims[1]||1080;if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;
  if($('canvasSizeLabel'))$('canvasSizeLabel').textContent=`${width} × ${height}`;
  const ctx=c.getContext('2d');
  const bg=$('canvasBgColor')?.value||'#17121f';ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  if(designBgImage){
    const fit=$('canvasImageFit')?.value||'cover';const scale=fit==='contain'?Math.min(width/designBgImage.width,height/designBgImage.height):Math.max(width/designBgImage.width,height/designBgImage.height);const w=designBgImage.width*scale,h=designBgImage.height*scale;ctx.drawImage(designBgImage,(width-w)/2,(height-h)/2,w,h)
  }
  const overlay=Math.max(0,Math.min(70,Number($('canvasOverlay')?.value||24)));if($('canvasOverlayValue'))$('canvasOverlayValue').textContent=`${overlay}%`;if(overlay>0){ctx.fillStyle=`rgba(0,0,0,${overlay/100})`;ctx.fillRect(0,0,width,height)}
  const pos=Math.max(20,Math.min(80,Number($('canvasPositionY')?.value||50)));if($('canvasPositionValue'))$('canvasPositionValue').textContent=`${pos}%`;
  const align=$('canvasAlign')?.value||'center';const margin=width*.09;const x=align==='left'?margin:align==='right'?width-margin:width/2;ctx.textAlign=align;ctx.textBaseline='alphabetic';
  const accent=$('canvasAccentColor')?.value||'#ff4f78';const badge=String($('canvasBadge')?.value||'').trim();const title=String($('canvasText')?.value||'Gremory').trim();const subtitle=String($('canvasSubtitle')?.value||'').trim();const fontSize=Math.max(28,Math.min(240,Number($('canvasFontSize')?.value||92)));const weight=Number($('canvasFontWeight')?.value||700);const color=$('canvasTextColor')?.value||'#ffffff';const maxWidth=width*.82;
  ctx.font=`800 ${Math.max(18,fontSize*.22)}px system-ui,sans-serif`;const badgeH=badge?Math.max(48,fontSize*.48):0;ctx.font=`${weight} ${fontSize}px system-ui,sans-serif`;const lines=wrapCanvasText(ctx,title,maxWidth);const lineH=fontSize*1.08;const titleH=Math.max(lineH,lines.length*lineH);const subSize=Math.max(18,fontSize*.30);const subH=subtitle?subSize*1.45:0;const groupH=badgeH+titleH+subH;let y=height*(pos/100)-groupH/2;
  if(badge){ctx.font=`800 ${Math.max(18,fontSize*.22)}px system-ui,sans-serif`;const badgeW=Math.min(maxWidth,ctx.measureText(badge.toUpperCase()).width+36);let bx=align==='left'?x:align==='right'?x-badgeW:x-badgeW/2;ctx.fillStyle=hexToRgba(accent,.96);ctx.beginPath();if(ctx.roundRect)ctx.roundRect(bx,y,badgeW,Math.max(34,fontSize*.34),Math.max(8,fontSize*.08));else ctx.rect(bx,y,badgeW,Math.max(34,fontSize*.34));ctx.fill();ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(badge.toUpperCase(),bx+badgeW/2,y+Math.max(34,fontSize*.34)/2);ctx.textAlign=align;ctx.textBaseline='alphabetic';y+=badgeH}
  ctx.fillStyle=accent;const barW=Math.max(48,width*.055),barH=Math.max(6,fontSize*.065);const barX=align==='left'?x:align==='right'?x-barW:x-barW/2;ctx.fillRect(barX,y,barW,barH);y+=fontSize*.33;
  ctx.fillStyle=color;ctx.font=`${weight} ${fontSize}px system-ui,sans-serif`;for(const line of lines){y+=lineH;ctx.fillText(line,x,y,maxWidth)}
  if(subtitle){y+=subSize*1.3;ctx.fillStyle=hexToRgba(color,.78);ctx.font=`500 ${subSize}px system-ui,sans-serif`;wrapCanvasText(ctx,subtitle,maxWidth).slice(0,2).forEach((line,i)=>ctx.fillText(line,x,y+i*subSize*1.3,maxWidth))}
}
$('canvasPreset')?.addEventListener('change',renderDesignCanvas);
$('canvasRenderBtn')?.addEventListener('click',renderDesignCanvas);
['canvasText','canvasSubtitle','canvasBadge','canvasFontSize','canvasFontWeight','canvasAlign','canvasTextColor','canvasBgColor','canvasAccentColor','canvasImageFit','canvasOverlay','canvasPositionY'].forEach(id=>$(id)?.addEventListener('input',renderDesignCanvas));
$('canvasImageFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f){designBgImage=null;return renderDesignCanvas()}const img=new Image();img.onload=()=>{designBgImage=img;renderDesignCanvas();URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f)});
$('canvasClearImageBtn')?.addEventListener('click',()=>{designBgImage=null;if($('canvasImageFile'))$('canvasImageFile').value='';renderDesignCanvas()});
$('canvasResetBtn')?.addEventListener('click',()=>{if($('canvasText'))$('canvasText').value='Gremory';if($('canvasSubtitle'))$('canvasSubtitle').value='';if($('canvasBadge'))$('canvasBadge').value='';if($('canvasFontSize'))$('canvasFontSize').value='92';if($('canvasFontWeight'))$('canvasFontWeight').value='700';if($('canvasAlign'))$('canvasAlign').value='center';if($('canvasTextColor'))$('canvasTextColor').value='#ffffff';if($('canvasBgColor'))$('canvasBgColor').value='#17121f';if($('canvasAccentColor'))$('canvasAccentColor').value='#ff4f78';if($('canvasOverlay'))$('canvasOverlay').value='24';if($('canvasPositionY'))$('canvasPositionY').value='50';designBgImage=null;if($('canvasImageFile'))$('canvasImageFile').value='';renderDesignCanvas()});
$('canvasExportBtn')?.addEventListener('click',()=>{renderDesignCanvas();$('designCanvas')?.toBlob(blob=>blob&&downloadBlob(blob,'gremory-arte.png'),'image/png')});
$('studioCanvasShortcut')?.addEventListener('click',()=>$('canvasStudio')?.scrollIntoView({behavior:'smooth',block:'start'}));
$$('[data-studio-scroll]').forEach(btn=>btn.addEventListener('click',()=>$(btn.dataset.studioScroll)?.scrollIntoView({behavior:'smooth',block:'start'})));
renderDesignCanvas();

const initialRoute=(location.hash||'#home').slice(1);navigate(routeMeta[initialRoute]?initialRoute:'home');
