import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, push, onValue, remove, serverTimestamp
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

const state = {
  user: null,
  profile: null,
  privateData: null,
  route: 'home',
  team: {},
  downloadService: 'tiktok',
  roomCode: null,
  room: null,
  roomUnsubs: []
};

function toast(message){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('toastRoot').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function openModal(id, locked = false){
  const modal = $(id);
  if (!modal) return;
  modal.classList.add('open');
  modal.classList.toggle('locked', locked);
  modal.setAttribute('aria-hidden', 'false');
}
function closeModal(id){
  const modal = $(id);
  if (!modal || modal.classList.contains('locked')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}
function setDrawer(open){
  const drawer = $('accountDrawer');
  drawer.classList.toggle('open', !!open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
}
function escText(value){ return String(value ?? ''); }
function avatarFor(profile){ return profile?.avatar || auth.currentUser?.photoURL || DEFAULT_AVATAR; }
function displayName(){ return state.profile?.nome || state.user?.displayName || state.user?.email?.split('@')[0] || 'Usuário'; }
function formatNumber(n){ return new Intl.NumberFormat('pt-BR').format(Number(n || 0)); }

const routeMeta = {
  home:['GREMORY','Início'], pokemon:['POKÉMON','Centro Pokémon'], downloads:['DOWNLOADS','Downloads'], rpg:['RPG GREMORY','Mesas'], premium:['PREMIUM','Planos']
};
function navigate(route){
  if (!routeMeta[route]) route = 'home';
  state.route = route;
  $$('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === route));
  $$('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  const [eye,title] = routeMeta[route];
  $('pageEyebrow').textContent = eye;
  $('pageTitle').textContent = title;
  history.replaceState(null,'',`#${route}`);
  if (route === 'pokemon' && state.user) loadTeam();
  if (route === 'rpg' && state.user && !state.roomCode) loadMyRooms();
  window.scrollTo({top:0,behavior:'auto'});
}

$$('[data-route]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));
$('topAccountBtn').addEventListener('click', () => state.user ? setDrawer(true) : openModal('authModal', true));
$('mobileAccountBtn').addEventListener('click', () => state.user ? setDrawer(true) : openModal('authModal', true));
$('homeProfileBtn').addEventListener('click', () => state.user ? setDrawer(true) : openModal('authModal', true));
$('accountDrawerBackdrop').addEventListener('click', () => setDrawer(false));
$('accountDrawerClose').addEventListener('click', () => setDrawer(false));
$$('[data-close-modal]').forEach(el => el.addEventListener('click', () => closeModal(el.dataset.closeModal)));

function authTab(mode){
  $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === mode));
  $$('[data-auth-form]').forEach(f => f.classList.toggle('active', f.dataset.authForm === mode));
  $('authStatus').textContent = '';
}
$$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => authTab(btn.dataset.authTab)));
$('authCloseBtn').addEventListener('click', () => { if (state.user) { $('authModal').classList.remove('locked'); closeModal('authModal'); } });

function authError(err){
  const map = {
    'auth/email-already-in-use':'Esse e-mail já está em uso.',
    'auth/invalid-email':'E-mail inválido.',
    'auth/weak-password':'Use uma senha com pelo menos 6 caracteres.',
    'auth/invalid-credential':'E-mail ou senha incorretos.',
    'auth/too-many-requests':'Muitas tentativas. Tente novamente mais tarde.'
  };
  return map[err?.code] || 'Não foi possível concluir.';
}
async function configurePersistence(remember){
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  if (remember) {
    localStorage.setItem('gremory:remember','1');
    sessionStorage.setItem('gremory:session-ok','1');
  } else {
    localStorage.removeItem('gremory:remember');
    sessionStorage.setItem('gremory:session-ok','1');
  }
}

$('loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('authStatus').textContent = 'Entrando...';
  try{
    const remember = $('loginRemember').checked;
    await configurePersistence(remember);
    await signInWithEmailAndPassword(auth, $('loginEmail').value.trim(), $('loginPassword').value);
    $('authStatus').textContent = '';
  }catch(err){ $('authStatus').textContent = authError(err); }
});

$('registerForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim();
  const pass = $('registerPassword').value;
  const pass2 = $('registerPassword2').value;
  if (!name) return $('authStatus').textContent = 'Digite seu nome.';
  if (pass.length < 6) return $('authStatus').textContent = 'A senha precisa ter pelo menos 6 caracteres.';
  if (pass !== pass2) return $('authStatus').textContent = 'As senhas não coincidem.';
  $('authStatus').textContent = 'Criando conta...';
  try{
    const remember = $('registerRemember').checked;
    await configurePersistence(remember);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, {displayName:name});
    const now = new Date().toISOString();
    await set(ref(db,`profiles/${cred.user.uid}`), {uid:cred.user.uid,nome:name,avatar:'',bio:'',favoriteAnime:'',createdAt:now,updatedAt:now});
    $('authStatus').textContent = '';
  }catch(err){ $('authStatus').textContent = authError(err); }
});

$('resetPasswordBtn').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  if (!email) return $('authStatus').textContent = 'Digite seu e-mail primeiro.';
  try{ await sendPasswordResetEmail(auth,email); $('authStatus').textContent = 'E-mail de recuperação enviado.'; }
  catch(err){ $('authStatus').textContent = authError(err); }
});

$('logoutBtn').addEventListener('click', async () => {
  localStorage.removeItem('gremory:remember');
  sessionStorage.removeItem('gremory:session-ok');
  await signOut(auth);
  setDrawer(false);
});

async function readUserData(user){
  const [profileSnap, oldSnap] = await Promise.all([
    get(ref(db,`profiles/${user.uid}`)).catch(()=>null),
    get(ref(db,`users/${user.uid}`)).catch(()=>null)
  ]);
  const profile = profileSnap?.exists() ? profileSnap.val() : {};
  const old = oldSnap?.exists() ? oldSnap.val() : {};
  const merged = {
    uid:user.uid,
    nome:profile.nome || old.nome || user.displayName || 'Usuário',
    avatar:profile.avatar || old.avatar || user.photoURL || '',
    bio:profile.bio || old.bio || '',
    favoriteAnime:profile.favoriteAnime || old.favoriteAnime || old.animeFavorito || '',
    createdAt:profile.createdAt || old.createdAt || user.metadata?.creationTime || new Date().toISOString()
  };
  if (!profileSnap?.exists()) await set(ref(db,`profiles/${user.uid}`), {...merged,updatedAt:new Date().toISOString()}).catch(()=>{});
  state.profile = merged;
  state.privateData = old;
  renderAccount();
}

function renderAccount(){
  const profile = state.profile || {};
  const avatar = avatarFor(profile);
  const name = profile.nome || 'Usuário';
  const premium = !!state.privateData?.premium;
  const level = Number(state.privateData?.nivel ?? state.privateData?.level ?? state.privateData?.total ?? 0);
  const balance = Number(state.privateData?.saldo ?? state.privateData?.dinero ?? 0);
  ['sideAvatar','topAvatar','profileAvatarPreview'].forEach(id => $(id).src = avatar);
  $('sideName').textContent = name;
  $('sideStatus').textContent = premium ? 'Premium' : 'Conta Gremory';
  $('profileNameView').textContent = name;
  $('profilePlanView').textContent = premium ? 'Premium' : 'Padrão';
  $('profileName').value = name;
  $('profileAvatar').value = profile.avatar || '';
  $('profileBio').value = profile.bio || '';
  $('profileFavoriteAnime').value = profile.favoriteAnime || '';
  $('profileLevel').textContent = formatNumber(level);
  $('profileBalance').textContent = `₹ ${formatNumber(balance)}`;
  $('homePlan').textContent = premium ? 'Premium' : 'Padrão';
  $('homeLevel').textContent = formatNumber(level);
  $('homeBalance').textContent = `₹ ${formatNumber(balance)}`;
  $('homeGreeting').textContent = `Olá, ${name}.`;
}

$('profileAvatar').addEventListener('input', () => { $('profileAvatarPreview').src = $('profileAvatar').value.trim() || DEFAULT_AVATAR; });
$('profileForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!state.user) return;
  const payload = {
    uid:state.user.uid,
    nome:$('profileName').value.trim().slice(0,40) || 'Usuário',
    avatar:$('profileAvatar').value.trim(),
    bio:$('profileBio').value.trim().slice(0,180),
    favoriteAnime:$('profileFavoriteAnime').value.trim().slice(0,80),
    createdAt:state.profile?.createdAt || new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  try{
    await set(ref(db,`profiles/${state.user.uid}`),payload);
    if (state.user.displayName !== payload.nome) await updateProfile(state.user,{displayName:payload.nome});
    state.profile = payload;
    renderAccount();
    toast('Perfil salvo.');
  }catch{ toast('Não foi possível salvar o perfil.'); }
});

async function initialAuthPolicy(){
  const remember = localStorage.getItem('gremory:remember') === '1';
  try{ await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence); }catch{}
  if (!remember && sessionStorage.getItem('gremory:session-ok') !== '1') {
    await signOut(auth).catch(()=>{});
  }
}
await initialAuthPolicy();

onAuthStateChanged(auth, async (user) => {
  state.user = user || null;
  if (!user){
    state.profile = null; state.privateData = null;
    $('sideName').textContent = 'Conta'; $('sideStatus').textContent = 'Entrar';
    ['sideAvatar','topAvatar','profileAvatarPreview'].forEach(id => $(id).src = DEFAULT_AVATAR);
    $('homeGreeting').textContent = 'Entre na sua conta para continuar.';
    $('homePlan').textContent='Visitante'; $('homeLevel').textContent='—'; $('homeBalance').textContent='—';
    openModal('authModal',true);
    clearRoomSubscriptions();
    return;
  }
  await readUserData(user);
  $('authModal').classList.remove('locked','open');
  $('authModal').setAttribute('aria-hidden','true');
  await loadTeam();
  const inviteCode = new URLSearchParams(location.search).get('rpg');
  if (inviteCode) {
    navigate('rpg');
    await joinRoom(inviteCode.toUpperCase());
  }
});

// Pokémon
async function fetchPokemon(term){
  const clean = String(term||'').trim().toLowerCase();
  if (!clean) throw new Error('Digite um Pokémon.');
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(clean)}`);
  if (!r.ok) throw new Error('Pokémon não encontrado.');
  const p = await r.json();
  return {
    id:p.id,name:p.name,
    sprite:p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default || '',
    types:(p.types||[]).map(x=>x.type.name),height:p.height,weight:p.weight,
    stats:Object.fromEntries((p.stats||[]).map(x=>[x.stat.name,x.base_stat]))
  };
}
function renderPokemon(p){
  const box = $('pokemonResult'); box.innerHTML='';
  const card=document.createElement('div'); card.className='pokemon-card';
  const art=document.createElement('div'); art.className='pokemon-art'; const img=document.createElement('img'); img.src=p.sprite; img.alt=p.name; art.appendChild(img);
  const info=document.createElement('div'); info.className='pokemon-info';
  const dex=document.createElement('div'); dex.className='dex'; dex.textContent=`#${String(p.id).padStart(4,'0')}`;
  const h=document.createElement('h3'); h.textContent=p.name;
  const types=document.createElement('div'); types.className='type-row'; p.types.forEach(t=>{const s=document.createElement('span');s.className='type-pill';s.textContent=t;types.appendChild(s)});
  const stats=document.createElement('div'); stats.className='pokemon-stats';
  [['HP',p.stats.hp],['Ataque',p.stats.attack],['Velocidade',p.stats.speed]].forEach(([a,b])=>{const d=document.createElement('div');const s=document.createElement('span');s.textContent=a;const st=document.createElement('strong');st.textContent=b;d.append(s,st);stats.appendChild(d)});
  const acts=document.createElement('div'); acts.className='pokemon-actions'; const add=document.createElement('button'); add.className='btn primary'; add.textContent='Adicionar à equipe'; add.addEventListener('click',()=>addPokemonToTeam(p)); acts.appendChild(add);
  info.append(dex,h,types,stats,acts); card.append(art,info); box.appendChild(card);
}
$('pokemonSearchForm').addEventListener('submit', async ev=>{ev.preventDefault();$('pokemonResult').innerHTML='<div class="loading-line">Buscando...</div>';try{renderPokemon(await fetchPokemon($('pokemonSearchInput').value));}catch(e){$('pokemonResult').innerHTML=`<div class="empty-state small">${escText(e.message)}</div>`}});
$('randomPokemonBtn').addEventListener('click',async()=>{const id=Math.floor(Math.random()*1025)+1;$('pokemonSearchInput').value=String(id);$('pokemonResult').innerHTML='<div class="loading-line">Explorando...</div>';try{renderPokemon(await fetchPokemon(id));}catch(e){toast(e.message)}});
async function loadTeam(){
  if(!state.user){renderTeam();return}
  const snap=await get(ref(db,`pokemonWeb/${state.user.uid}/team`)).catch(()=>null); state.team=snap?.exists()?snap.val():{}; renderTeam();
}
function renderTeam(){
  const wrap=$('pokemonTeam'); wrap.innerHTML=''; const list=Object.values(state.team||{}); $('teamCount').textContent=`${list.length}/6`;
  list.forEach(p=>{const row=document.createElement('div');row.className='team-slot';const img=document.createElement('img');img.src=p.sprite||'';img.alt='';const copy=document.createElement('div');copy.className='team-copy';const strong=document.createElement('strong');strong.textContent=p.name;const small=document.createElement('small');small.textContent=`#${String(p.id).padStart(4,'0')} • ${Array.isArray(p.types)?p.types.join(' / '):''}`;copy.append(strong,small);const rem=document.createElement('button');rem.textContent='Remover';rem.addEventListener('click',()=>removePokemonFromTeam(p.name));row.append(img,copy,rem);wrap.appendChild(row)});
  for(let i=list.length;i<6;i++){const e=document.createElement('div');e.className='team-empty';e.textContent='Espaço livre';wrap.appendChild(e)}
}
async function addPokemonToTeam(p){
  if(!state.user)return openModal('authModal',true); const list=Object.keys(state.team||{}); if(state.team[p.name])return toast('Esse Pokémon já está na equipe.'); if(list.length>=6)return toast('Sua equipe já tem 6 Pokémon.');
  const save={id:p.id,name:p.name,sprite:p.sprite,types:p.types,addedAt:new Date().toISOString()}; await set(ref(db,`pokemonWeb/${state.user.uid}/team/${p.name}`),save);state.team[p.name]=save;renderTeam();toast('Pokémon adicionado à equipe.');
}
async function removePokemonFromTeam(name){if(!state.user)return;await remove(ref(db,`pokemonWeb/${state.user.uid}/team/${name}`));delete state.team[name];renderTeam()}

// Downloads
const downloadLabels={tiktok:'Link do TikTok',instagram:'Link do Instagram',pinterest:'Link do Pinterest',spotify:'Link do Spotify'};
$$('.service-tab').forEach(btn=>btn.addEventListener('click',()=>{state.downloadService=btn.dataset.service;$$('.service-tab').forEach(b=>b.classList.toggle('active',b===btn));$('downloadLabel').textContent=downloadLabels[state.downloadService];$('downloadResult').innerHTML='';}));
$('downloadForm').addEventListener('submit',async ev=>{ev.preventDefault();const url=$('downloadInput').value.trim();if(!url)return;const service=state.downloadService;$('downloadSubmit').disabled=true;$('downloadResult').innerHTML='<div class="loading-line">Preparando...</div>';try{const r=await fetch(`/api/main?action=${service}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});const data=await r.json().catch(()=>({}));if(!r.ok||!data.downloadUrl)throw new Error(data.erro||'Não foi possível preparar o arquivo.');renderDownloadReady(data,service)}catch(e){$('downloadResult').innerHTML=`<div class="empty-state small">${escText(e.message)}</div>`}finally{$('downloadSubmit').disabled=false}});
function renderDownloadReady(data,service){const box=$('downloadResult');box.innerHTML='';const row=document.createElement('div');row.className='download-ready';const copy=document.createElement('div');const strong=document.createElement('strong');strong.textContent=data.title||data.filename||service;const small=document.createElement('small');small.textContent=data.artist?`${data.artist}${data.album?' • '+data.album:''}`:'Arquivo pronto';copy.append(strong,small);const a=document.createElement('a');a.className='btn primary';a.href=data.downloadUrl;a.target='_blank';a.rel='noreferrer';a.textContent='Baixar';row.append(copy,a);box.appendChild(row)}

// Premium -> WhatsApp
$$('[data-buy-plan]').forEach(btn=>btn.addEventListener('click',()=>{const plan=btn.dataset.buyPlan;const text=encodeURIComponent(`/sitecomprar ${plan}`);window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`,'_blank','noopener,noreferrer')}));

// RPG
$('createRoomOpen').addEventListener('click',()=>state.user?openModal('createRoomModal'):openModal('authModal',true));
$('refreshRoomsBtn').addEventListener('click',loadMyRooms);
$('joinRoomForm').addEventListener('submit',async ev=>{ev.preventDefault();const code=$('joinRoomCode').value.trim().toUpperCase();if(code)await joinRoom(code)});
$('createRoomForm').addEventListener('submit',createRoom);
$('leaveTableView').addEventListener('click',closeTableView);
$('exitRoomBtn').addEventListener('click',exitRoom);
$('copyInviteBtn').addEventListener('click',copyInvite);
$('characterBtn').addEventListener('click',openCharacter);
$('characterForm').addEventListener('submit',saveCharacter);
$('editSceneBtn').addEventListener('click',()=>{if(!isRoomOwner())return toast('Só o mestre pode editar a cena.');const s=state.room?.scene||{};$('sceneTitleInput').value=s.title||'';$('sceneDescriptionInput').value=s.description||'';$('sceneImageInput').value=s.image||'';openModal('sceneModal')});
$('sceneForm').addEventListener('submit',saveScene);
$('saveRulesBtn').addEventListener('click',saveRules);
$('rollInitiativeBtn').addEventListener('click',rollInitiative);
$('chatForm').addEventListener('submit',sendChat);
$('customRollForm').addEventListener('submit',ev=>{ev.preventDefault();rollDice($('customRollInput').value.trim())});
$$('[data-die]').forEach(btn=>btn.addEventListener('click',()=>rollDice(`1d${btn.dataset.die}`)));
$$('[data-table-tab]').forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.tableTab;$$('[data-table-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tableTab===tab));$$('[data-table-pane]').forEach(p=>p.classList.toggle('active',p.dataset.tablePane===tab))}));

function randomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(b=>alphabet[b%alphabet.length]).join('')}
async function uniqueRoomCode(){for(let i=0;i<6;i++){const c=randomCode();const s=await get(ref(db,`rpgRooms/${c}`));if(!s.exists())return c}throw new Error('Não foi possível gerar o código.')}
async function createRoom(ev){
  ev.preventDefault(); if(!state.user)return;
  try{
    const code=await uniqueRoomCode();const now=new Date().toISOString();const name=$('roomNameInput').value.trim();
    const room={meta:{code,name,system:$('roomSystemInput').value,privacy:$('roomPrivacyInput').value,ownerUid:state.user.uid,createdAt:now},scene:{title:'A aventura começa aqui',description:'',image:''},rules:'',members:{[state.user.uid]:{uid:state.user.uid,name:displayName(),avatar:avatarFor(state.profile),role:'Mestre',joinedAt:now}}};
    await set(ref(db,`rpgRooms/${code}/meta`),room.meta);
    await set(ref(db,`rpgRooms/${code}/scene`),room.scene);
    await set(ref(db,`rpgRooms/${code}/rules`),'');
    await set(ref(db,`rpgRooms/${code}/members/${state.user.uid}`),room.members[state.user.uid]);
    await set(ref(db,`rpgUserRooms/${state.user.uid}/${code}`),{code,name,system:room.meta.system,role:'Mestre',joinedAt:now});closeModal('createRoomModal');$('createRoomForm').reset();await openRoom(code);
  }catch(e){toast(e.message||'Não foi possível criar a mesa.')}
}
async function loadMyRooms(){
  if(!state.user)return;const wrap=$('myRooms');wrap.innerHTML='<div class="loading-line">Carregando...</div>';const snap=await get(ref(db,`rpgUserRooms/${state.user.uid}`)).catch(()=>null);wrap.innerHTML='';const rooms=snap?.exists()?Object.values(snap.val()):[];if(!rooms.length){wrap.innerHTML='<div class="empty-state small">Nenhuma mesa salva.</div>';return}rooms.sort((a,b)=>String(b.joinedAt||'').localeCompare(String(a.joinedAt||'')));rooms.forEach(r=>{const item=document.createElement('div');item.className='room-item';const c=document.createElement('div');const strong=document.createElement('strong');strong.textContent=r.name||r.code;const small=document.createElement('small');small.textContent=`${r.system||'Livre'} • ${r.code}`;c.append(strong,small);const b=document.createElement('button');b.className='btn';b.textContent='Entrar';b.addEventListener('click',()=>openRoom(r.code));item.append(c,b);wrap.appendChild(item)});
}
async function joinRoom(code){
  if(!state.user)return openModal('authModal',true);code=String(code||'').toUpperCase();const snap=await get(ref(db,`rpgRooms/${code}`)).catch(()=>null);if(!snap?.exists())return toast('Mesa não encontrada.');const room=snap.val();const member={uid:state.user.uid,name:displayName(),avatar:avatarFor(state.profile),role:room.meta?.ownerUid===state.user.uid?'Mestre':'Jogador',joinedAt:new Date().toISOString()};await set(ref(db,`rpgRooms/${code}/members/${state.user.uid}`),member);await set(ref(db,`rpgUserRooms/${state.user.uid}/${code}`),{code,name:room.meta?.name||code,system:room.meta?.system||'Livre',role:member.role,joinedAt:new Date().toISOString()});$('joinRoomCode').value='';await openRoom(code)
}
function clearRoomSubscriptions(){state.roomUnsubs.forEach(fn=>{try{fn()}catch{}});state.roomUnsubs=[]}
async function openRoom(code){
  clearRoomSubscriptions();state.roomCode=code;$('rpgLobby').hidden=true;$('rpgTable').hidden=false;
  const unsub=onValue(ref(db,`rpgRooms/${code}`),(snap)=>{if(!snap.exists()){toast('Essa mesa não existe mais.');closeTableView();return}state.room=snap.val();renderRoom()});state.roomUnsubs.push(unsub);navigate('rpg');
}
function closeTableView(){clearRoomSubscriptions();state.roomCode=null;state.room=null;$('rpgTable').hidden=true;$('rpgLobby').hidden=false;loadMyRooms()}
async function exitRoom(){if(!state.user||!state.roomCode)return;const code=state.roomCode;if(isRoomOwner()){const confirmDelete=confirm('Você é o mestre. Excluir esta mesa para todos?');if(!confirmDelete)return;const members=state.room?.members||{};await Promise.all(Object.keys(members).map(uid=>remove(ref(db,`rpgUserRooms/${uid}/${code}`)).catch(()=>{})));await remove(ref(db,`rpgRooms/${code}`));}else{await remove(ref(db,`rpgRooms/${code}/members/${state.user.uid}`));await remove(ref(db,`rpgUserRooms/${state.user.uid}/${code}`));}closeTableView()}
function isRoomOwner(){return !!state.user && state.room?.meta?.ownerUid===state.user.uid}
function renderRoom(){
  const r=state.room||{};$('tableRoomName').textContent=r.meta?.name||'Mesa';$('tableSystem').textContent=r.meta?.system||'Livre';$('tableCode').textContent=state.roomCode||'';
  renderMembers(r.members||{},r.characters||{});renderInitiative(r.initiative||{});renderScene(r.scene||{});renderRolls(r.rolls||{});renderChat(r.messages||{});
  $('roomRules').value=r.rules||'';$('roomRules').readOnly=!isRoomOwner();$('saveRulesBtn').hidden=!isRoomOwner();$('editSceneBtn').hidden=!isRoomOwner();
  const mine=r.characters?.[state.user?.uid];if(mine)fillCharacterForm(mine,true);
}
function renderMembers(members,chars){const wrap=$('memberList');wrap.innerHTML='';const list=Object.values(members);$('memberCount').textContent=String(list.length);list.forEach(m=>{const row=document.createElement('div');row.className='member-item';const img=document.createElement('img');img.src=m.avatar||DEFAULT_AVATAR;const s=document.createElement('span');const st=document.createElement('strong');st.textContent=m.name||'Jogador';const sm=document.createElement('small');const ch=chars[m.uid];sm.textContent=ch?`${ch.name}${ch.className?' • '+ch.className:''}`:(m.role||'Jogador');s.append(st,sm);row.append(img,s);wrap.appendChild(row)})}
function renderInitiative(obj){const wrap=$('initiativeList');wrap.innerHTML='';const rows=Object.values(obj).sort((a,b)=>Number(b.value)-Number(a.value));if(!rows.length){wrap.innerHTML='<div class="empty-state small">Sem iniciativa.</div>';return}rows.forEach(x=>{const d=document.createElement('div');d.className='initiative-item';const s=document.createElement('span');s.textContent=x.name||'Jogador';const b=document.createElement('b');b.textContent=String(x.value);d.append(s,b);wrap.appendChild(d)})}
function renderScene(scene){$('sceneTitle').textContent=scene.title||'A aventura começa aqui';$('sceneDescription').textContent=scene.description||'O mestre pode mudar a cena.';const img=$('sceneImage');if(scene.image){img.src=scene.image;img.hidden=false;$('scenePlaceholder').hidden=true}else{img.hidden=true;$('scenePlaceholder').hidden=false}}
function valuesRecent(obj,limit=20){return Object.entries(obj||{}).map(([id,v])=>({id,...v})).sort((a,b)=>String(a.at||'').localeCompare(String(b.at||''))).slice(-limit)}
function renderRolls(obj){const wrap=$('rollLog');wrap.innerHTML='';valuesRecent(obj,12).reverse().forEach(x=>{const d=document.createElement('div');d.className='roll-chip';const s=document.createElement('strong');s.textContent=`${x.formula} = ${x.total}`;const sm=document.createElement('small');sm.textContent=x.name||'Jogador';d.append(s,sm);wrap.appendChild(d)})}
function renderChat(obj){const wrap=$('chatList');const atBottom=wrap.scrollHeight-wrap.scrollTop-wrap.clientHeight<60;wrap.innerHTML='';valuesRecent(obj,80).forEach(m=>{const d=document.createElement('div');d.className='chat-msg'+(m.uid===state.user?.uid?' mine':'');const head=document.createElement('div');const st=document.createElement('strong');st.textContent=m.name||'Jogador';const t=document.createElement('time');t.textContent=formatTime(m.at);head.append(st,t);const p=document.createElement('p');p.textContent=m.text||'';d.append(head,p);wrap.appendChild(d)});if(atBottom)wrap.scrollTop=wrap.scrollHeight}
function formatTime(v){try{return new Date(v||Date.now()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
async function sendChat(ev){ev.preventDefault();if(!state.user||!state.roomCode)return;const text=$('chatInput').value.trim();if(!text)return;$('chatInput').value='';await push(ref(db,`rpgRooms/${state.roomCode}/messages`),{uid:state.user.uid,name:displayName(),text:text.slice(0,500),at:new Date().toISOString()})}
function secureInt(max){const b=new Uint32Array(1);crypto.getRandomValues(b);return (b[0]%max)+1}
function parseRoll(formula){const m=String(formula||'').toLowerCase().replace(/\s/g,'').match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/);if(!m)return null;const count=Math.min(20,Number(m[1]));const sides=Number(m[2]);const mod=Number(m[3]||0);const rolls=Array.from({length:count},()=>secureInt(sides));return{formula:`${count}d${sides}${mod>0?'+'+mod:mod<0?mod:''}`,rolls,total:rolls.reduce((a,b)=>a+b,0)+mod}}
async function rollDice(formula){if(!state.user||!state.roomCode)return;const result=parseRoll(formula);if(!result)return toast('Use algo como 1d20 ou 2d6+3.');await push(ref(db,`rpgRooms/${state.roomCode}/rolls`),{uid:state.user.uid,name:displayName(),...result,at:new Date().toISOString()})}
async function rollInitiative(){if(!state.user||!state.roomCode)return;const value=secureInt(20);const name=state.room?.characters?.[state.user.uid]?.name||displayName();await set(ref(db,`rpgRooms/${state.roomCode}/initiative/${state.user.uid}`),{uid:state.user.uid,name,value,at:new Date().toISOString()});toast(`Iniciativa: ${value}`)}
function openCharacter(){if(!state.user||!state.roomCode)return;const ch=state.room?.characters?.[state.user.uid];fillCharacterForm(ch||{},false);openModal('characterModal')}
function fillCharacterForm(ch,preserveModal){$('charName').value=ch.name||displayName();$('charClass').value=ch.className||'';$('charLevel').value=ch.level||1;$('charHp').value=ch.hp??10;$('charMaxHp').value=ch.maxHp??10;$('charDefense').value=ch.defense??10;$('charNotes').value=ch.notes||'';}
async function saveCharacter(ev){ev.preventDefault();if(!state.user||!state.roomCode)return;const ch={name:$('charName').value.trim().slice(0,50)||displayName(),className:$('charClass').value.trim().slice(0,50),level:Math.max(1,Number($('charLevel').value||1)),hp:Math.max(0,Number($('charHp').value||0)),maxHp:Math.max(1,Number($('charMaxHp').value||1)),defense:Math.max(0,Number($('charDefense').value||0)),notes:$('charNotes').value.trim().slice(0,1000),updatedAt:new Date().toISOString()};await set(ref(db,`rpgRooms/${state.roomCode}/characters/${state.user.uid}`),ch);closeModal('characterModal');toast('Personagem salvo.')}
async function saveScene(ev){ev.preventDefault();if(!isRoomOwner()||!state.roomCode)return;await set(ref(db,`rpgRooms/${state.roomCode}/scene`),{title:$('sceneTitleInput').value.trim().slice(0,80)||'Aventura',description:$('sceneDescriptionInput').value.trim().slice(0,300),image:$('sceneImageInput').value.trim()});closeModal('sceneModal');toast('Cena atualizada.')}
async function saveRules(){if(!isRoomOwner()||!state.roomCode)return;await set(ref(db,`rpgRooms/${state.roomCode}/rules`),$('roomRules').value.slice(0,4000));toast('Regras salvas.')}
async function copyInvite(){if(!state.roomCode)return;const url=`${location.origin}${location.pathname}?rpg=${encodeURIComponent(state.roomCode)}#rpg`;try{await navigator.clipboard.writeText(url);toast('Convite copiado.')}catch{prompt('Copie o convite:',url)}}

// inicialização visual
const initialRoute=(location.hash||'#home').slice(1);navigate(routeMeta[initialRoute]?initialRoute:'home');
renderTeam();
