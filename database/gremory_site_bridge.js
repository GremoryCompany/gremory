'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function cleanJid(jid='') { return String(jid || '').replace(/:\d+@/, '@').trim(); }
function maskJid(jid='') {
  const raw = cleanJid(jid).split('@')[0].replace(/\D/g, '');
  if (raw.length < 7) return 'WhatsApp vinculado';
  return `${raw.slice(0, 4)}••••${raw.slice(-4)}`;
}
function sameUser(a,b){
  const aa=cleanJid(a),bb=cleanJid(b);if(aa===bb)return true;
  const na=aa.split('@')[0],nb=bb.split('@')[0];return !!na&&na===nb;
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, Number(n || 0))); }
function id(prefix='id'){ return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function now(){ return new Date().toISOString(); }
function readJson(file,fallback){ try{return JSON.parse(fs.readFileSync(file,'utf8')||JSON.stringify(fallback));}catch{return JSON.parse(JSON.stringify(fallback));} }
function writeJson(file,data){ fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)); }
function safeRequire(name){ try{return require(name);}catch{return null;} }

function stripOuterQuotes(value='') {
  let v = String(value || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v.trim();
}
function normalizePrivateKey(raw='') {
  let key = stripOuterQuotes(raw);
  if (!key) return '';
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  key = key.replace(/^private_key\s*=\s*/i, '').trim();
  key = stripOuterQuotes(key);
  return key.trim();
}
function decodeBase64Utf8(value='') {
  try { return Buffer.from(String(value || '').trim(), 'base64').toString('utf8').trim() || ''; } catch { return ''; }
}
function readServiceAccountEnv() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!rawJson) return null;
  let candidate = rawJson;
  if (!candidate.startsWith('{')) { const decoded = decodeBase64Utf8(candidate); if (decoded.startsWith('{')) candidate = decoded; }
  try {
    const obj = JSON.parse(candidate);
    return { projectId:String(obj.project_id || obj.projectId || '').trim(), clientEmail:String(obj.client_email || obj.clientEmail || '').trim(), privateKey:normalizePrivateKey(obj.private_key || obj.privateKey || '') };
  } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON existe, mas não é um JSON válido.'); }
}
function validatePrivateKey(key='') { return !!key && key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----'); }
function envStatus(name) { const value=typeof process.env[name]==='string'?process.env[name].trim():'';return value?`OK (${value.length} chars)`:'FALTANDO'; }
function logSafeEnvStatus() {
  const names=['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_DATABASE_URL','FIREBASE_PRIVATE_KEY','FIREBASE_PRIVATE_KEY_BASE64','FIREBASE_SERVICE_ACCOUNT_JSON','MP_ACCESS_TOKEN','MERCADO_PAGO_ACCESS_TOKEN'];
  const status={};for(const name of names)status[name]=envStatus(name);console.log('🔎 GREMORY ENV CHECK (valores ocultos):',status);
}
function createFirebaseAdmin() {
  const service=readServiceAccountEnv();
  const projectId=String(service?.projectId||process.env.FIREBASE_PROJECT_ID||'').trim();
  const clientEmail=String(service?.clientEmail||process.env.FIREBASE_CLIENT_EMAIL||'').trim();
  let privateKey=normalizePrivateKey(service?.privateKey||process.env.FIREBASE_PRIVATE_KEY||'');
  if(!privateKey&&process.env.FIREBASE_PRIVATE_KEY_BASE64)privateKey=normalizePrivateKey(decodeBase64Utf8(process.env.FIREBASE_PRIVATE_KEY_BASE64));
  const databaseURL=String(process.env.FIREBASE_DATABASE_URL||'').trim();
  if(!projectId||!clientEmail||!privateKey||!databaseURL)throw new Error('Firebase incompleto. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_DATABASE_URL e FIREBASE_PRIVATE_KEY (ou SERVICE_ACCOUNT_JSON).');
  if(!validatePrivateKey(privateKey))throw new Error('FIREBASE_PRIVATE_KEY inválida: a chave precisa conter BEGIN PRIVATE KEY e END PRIVATE KEY.');
  try{
    const appApi=require('firebase-admin/app');const databaseApi=require('firebase-admin/database');
    if(typeof appApi.getApps==='function'&&typeof appApi.initializeApp==='function'&&typeof appApi.cert==='function'&&typeof databaseApi.getDatabase==='function'){
      if(appApi.getApps().length===0)appApi.initializeApp({credential:appApi.cert({projectId,clientEmail,privateKey}),databaseURL});
      const app=typeof appApi.getApp==='function'?appApi.getApp():appApi.getApps()[0];return{database:()=>databaseApi.getDatabase(app)};
    }
  }catch(e){ if(String(e?.message||'').includes('Failed to parse private key'))throw e; }
  const admin=safeRequire('firebase-admin');if(!admin)throw new Error('Instale no bot: npm i firebase-admin');
  let hasApp=Array.isArray(admin.apps)&&admin.apps.length>0;if(!hasApp&&typeof admin.app==='function'){try{admin.app();hasApp=true}catch{}}
  if(!hasApp)admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey}),databaseURL});
  return admin;
}

function normalizeMove(move,i=0){ if(typeof move==='string')return{name:move,power:45};move=move&&typeof move==='object'?move:{};return{name:move.name||move.nome||move.move?.name||`Golpe ${i+1}`,power:clamp(move.power||move.poder||move.damage||move.dano||45,20,160),type:move.type||move.tipo||move.move?.type||''}; }
function publicMon(mon={}){
  const dex=Number(mon.dex||mon.id||mon.pokedexId||0);
  const maxHp=Math.max(1,Number(mon.maxHp||mon.hpMax||mon.hp||40));
  const hp=clamp(mon.hpAtual??mon.hp??maxHp,0,maxHp);
  const sprite=mon.sprite||mon.gif||mon.imagem||mon.image||(dex?`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${dex}.gif`:'');
  const rawMoves=Array.isArray(mon.moves)?mon.moves:[];
  return{uid:mon.uid||mon.id||`mon_${dex}_${String(mon.nome||mon.name||'').toLowerCase()}`,dex,name:mon.nome||mon.name||'Pokémon',level:Math.max(1,Number(mon.level||1)),shiny:!!mon.shiny,hp,maxHp,fainted:Boolean(mon.fainted)||hp<=0,attack:Math.max(20,Number(mon.attack||mon.ataque||mon.stats?.attack||80)),defense:Math.max(20,Number(mon.defense||mon.defesa||mon.stats?.defense||80)),sprite,types:mon.types||mon.tipos||[],moves:rawMoves.slice(0,4).map(normalizeMove)};
}
function publicPokemonUser(user={}){
  const collection=Array.isArray(user.monsters)?user.monsters.map(publicMon):[];
  const byUid=new Map(collection.map(m=>[String(m.uid),m]));
  let team=[];
  if(Array.isArray(user.party)&&user.party.length){
    for(const item of user.party){const key=String(item?.uid||item||'');const mon=byUid.get(key);if(mon&&!team.some(x=>String(x.uid)===key))team.push(mon);}
  }
  const activeFromIndex=collection[Math.max(0,Number(user.active||0))];
  const activeUid=user.activeUid||activeFromIndex?.uid||null;
  if(!team.length&&activeUid){const active=byUid.get(String(activeUid));if(active)team=[active,...collection.filter(m=>String(m.uid)!==String(activeUid)).slice(0,5)];}
  if(!team.length)team=collection.slice(0,6);
  return{collection,team:team.slice(0,6),activeUid:activeUid||team[0]?.uid||null};
}

const CUSTOMIZATION_CATALOG={
  frame_crimson:{name:'Carmesim',price:350,slot:'frame'},
  frame_obsidian:{name:'Obsidiana',price:1650,slot:'frame'},
  frame_royal:{name:'Imperial',price:3200,slot:'frame'},
  scale_dragon:{name:'Escamas Gremory',price:600,slot:'effect'},
  effect_stars:{name:'Estrelas Demoníacas',price:1450,slot:'effect'},
  effect_embers:{name:'Brasas Carmesim',price:2800,slot:'effect'},
  name_gold:{name:'Nome Dourado',price:900,slot:'name'},
  name_rose:{name:'Nome Rosa',price:1350,slot:'name'},
  name_ice:{name:'Nome Glacial',price:2100,slot:'name'},
  aura_rose:{name:'Rosa Demoníaca',price:1200,slot:'aura'},
  aura_void:{name:'Aura do Vazio',price:2600,slot:'aura'},
  badge_demon:{name:'Selo Demoníaco',price:4200,slot:'badge'}
};
const VIP_PLANS={
  '1':{nome:'💎 VIP 1 Dia',dias:1,valor:2},'7':{nome:'💎 VIP 7 Dias',dias:7,valor:5},'15':{nome:'👑 VIP 15 Dias',dias:15,valor:8},'30':{nome:'🔥 VIP 30 Dias',dias:30,valor:12}
};

function createGremorySiteBridge({sock,getGremonDB,getGremonUser,gremonAtivo,logger=console}={}){
  logSafeEnvStatus();
  if(!sock)throw new Error('sock é obrigatório no Gremory Site Bridge.');
  if(typeof getGremonDB!=='function'||typeof getGremonUser!=='function')throw new Error('Passe getGremonDB e getGremonUser ao bridge.');

  const admin=createFirebaseAdmin();
  const rtdb=admin.database();
  const economy=safeRequire('../settings/Grupo/Js/reg.js')||{};
  const mining=safeRequire('../Games/Js/mining.js')||{};
  const achievements=safeRequire('./conquistas')||{};
  const premiumLib=safeRequire('../fuction/premium.js')||{};
  const pokemonSystem=safeRequire('./sistemas.js')||{};
  const saveGremonDB=typeof pokemonSystem.saveGremonDB==='function'?pokemonSystem.saveGremonDB:(typeof global.saveGremonDB==='function'?global.saveGremonDB:null);
  const garantirHp=typeof pokemonSystem.garantirHpPokemon==='function'?pokemonSystem.garantirHpPokemon:null;
  const curarTotal=typeof pokemonSystem.curarPokemonTotal==='function'?pokemonSystem.curarPokemonTotal:null;
  const sortearSelvagem=typeof pokemonSystem.sortearPokemonSelvagem==='function'?pokemonSystem.sortearPokemonSelvagem:null;
  const levelPath=path.join(__dirname,'..','db','json','level.json');
  const premiumPath=path.join(__dirname,'..','db','json','premium.json');
  const ordersPath=path.join(__dirname,'mercadopago','mp_orders.json');
  const healingPath=path.join(__dirname,'pokemon','site_healing_jobs.json');
  const tttRewardPath=path.join(__dirname,'tictactoe','site_rewards.json');
  const tinderPath=path.join(__dirname,'tinder.json');
  const rootDir=path.join(__dirname,'..');
  const downloadDir=path.join(rootDir,'Gremory','downloads');
  const HEAL_COST=100;
  const HEAL_MS_FREE=5*60*1000;
  const HEAL_MS_PREMIUM=2*60*1000;
  const watchedUsers=new Set(),watchedRefs=new Map(),userQueues=new Map();
  const bridgeInstanceId=`bridge_${process.pid}_${crypto.randomBytes(6).toString('hex')}`;
  let rootWatcher=null,healingTimer=null,syncTimer=null,syncingLinked=false;

  function savePokemonDb(db){if(typeof saveGremonDB!=='function')throw new Error('saveGremonDB não está disponível no bot.');saveGremonDB(db);}
  function ensureMon(mon){if(!mon)return null;if(garantirHp){try{garantirHp(mon)}catch{}}if(!mon.uid)mon.uid=id('pk');if(!mon.maxHp)mon.maxHp=Math.max(1,Number(mon.hp||100));if(mon.hpAtual==null)mon.hpAtual=mon.maxHp;if(Number(mon.hpAtual)<=0){mon.hpAtual=0;mon.fainted=true;}return mon;}
  function pokemonState(jid){const db=getGremonDB(),user=getGremonUser(db,cleanJid(jid));if(!user)throw new Error('Treinador Pokémon não encontrado no bot.');user.monsters=Array.isArray(user.monsters)?user.monsters:[];user.monsters.forEach(ensureMon);return{db,user};}
  function findMon(user,uid){return(user.monsters||[]).find(m=>String(m.uid||m.id)===String(uid||''))||null;}
  function orderedTeamRaw(user){const mons=user.monsters||[],by=new Map(mons.map(m=>[String(m.uid),m]));const out=[];if(Array.isArray(user.party))for(const item of user.party){const m=by.get(String(item?.uid||item||''));if(m&&!out.includes(m))out.push(m)}if(!out.length){const active=mons[Math.max(0,Number(user.active||0))];if(active)out.push(active);for(const m of mons)if(!out.includes(m)&&out.length<6)out.push(m)}return out.slice(0,6);}
  function firstHealthy(user){return orderedTeamRaw(user).find(m=>{ensureMon(m);return !m.fainted&&Number(m.hpAtual||0)>0})||null;}
  function faintRaw(mon,reason='batalha'){ensureMon(mon);mon.hpAtual=0;mon.fainted=true;mon.faintedAt=Date.now();mon.faintedReason=reason;}
  function healRaw(mon){ensureMon(mon);if(curarTotal){try{curarTotal(mon);return}catch{}}mon.hpAtual=mon.maxHp;mon.fainted=false;mon.faintedAt=null;mon.faintedReason=null;mon.healingUntil=null;}

  async function linkedUidByJid(jid){const snap=await rtdb.ref('charlottePrivate').orderByChild('whatsappJid').equalTo(cleanJid(jid)).once('value');const val=snap.val()||{};return Object.keys(val)[0]||null;}
  async function linkedJidByUid(uid){const snap=await rtdb.ref(`charlottePrivate/${uid}/whatsappJid`).once('value');return cleanJid(snap.val()||'');}
  async function syncLinkedAccounts(){
    if(syncingLinked)return;
    syncingLinked=true;
    try{
      const snap=await rtdb.ref('charlottePrivate').once('value');
      const rows=Object.entries(snap.val()||{});
      for(const[uid,data]of rows){
        const jid=cleanJid(data?.whatsappJid||'');
        if(!jid)continue;
        try{await syncAccount(uid,jid)}catch(e){logger.log('[SITE BRIDGE] auto sync:',e.message)}
        await new Promise(r=>setTimeout(r,120));
      }
    }finally{syncingLinked=false}
  }
  async function sendWhats(jid,text){if(!jid)return;try{await sock.sendMessage(jid,{text});}catch(e){logger.log('[SITE BRIDGE] send:',e.message);}}
  function readLevel(jid){const rows=readJson(levelPath,[]);if(!Array.isArray(rows))return{level:0,xp:0,messages:0};const u=rows.find(x=>sameUser(x.id,jid));return{level:Number(u?.level||0),xp:Number(u?.xp||0),messages:Number(u?.msg||0)};}
  function readPremium(jid){const db=readJson(premiumPath,[]);let active=false;try{if(typeof premiumLib.checkPremiumUser==='function')active=!!premiumLib.checkPremiumUser(jid,db);}catch{}return{active};}
  function readAchievements(jid){try{if(!achievements.getConquistasDB||!achievements.getUserConquista)return{unlockedCount:0,total:Object.keys(achievements.CONQUISTAS||{}).length,unlocked:[],badge:''};const db=achievements.getConquistasDB(),user=achievements.getUserConquista(db,jid),defs=achievements.CONQUISTAS||{},unlocked=(user.unlocked||[]).map(k=>({id:k,emoji:defs[k]?.emoji||'🏆',name:defs[k]?.nome||k,description:defs[k]?.desc||'',badge:defs[k]?.badge||''}));let badge='';if(user.badgeAtual&&defs[user.badgeAtual])badge=`${defs[user.badgeAtual].emoji||''} ${defs[user.badgeAtual].badge||defs[user.badgeAtual].nome}`.trim();return{unlockedCount:unlocked.length,total:Object.keys(defs).length,unlocked,badge,stats:user.stats||{}};}catch{return{unlockedCount:0,total:0,unlocked:[],badge:''};}}
  function balanceFor(jid){try{return Number(typeof economy.MoneyOfSender==='function'?economy.MoneyOfSender(jid):0)||0}catch{return 0}}
  function registeredFor(jid){try{return typeof economy.checkOfReg==='function'?!!economy.checkOfReg(jid):true}catch{return true}}

  async function notifySite(uid,{type='info',title='Gremory',text='',link='',sound=true,imageUrl=''}={}){
    if(!uid)return null;
    const cleanType=String(type||'info').slice(0,60),cleanTitle=String(title||'Gremory').slice(0,80),cleanText=String(text||'').slice(0,800),cleanLink=String(link||'').slice(0,300),cleanImage=String(imageUrl||'').trim().slice(0,1000),createdAt=Date.now();
    // Evita gravar a mesma notificação duas vezes quando dois fluxos concluem quase juntos.
    try{
      const recent=await rtdb.ref(`siteNotifications/${uid}`).orderByChild('createdAt').startAt(createdAt-30000).once('value');
      for(const [key,value] of Object.entries(recent.val()||{})){
        if(String(value?.type||'')===cleanType&&String(value?.title||'')===cleanTitle&&String(value?.text||'')===cleanText&&String(value?.link||'')===cleanLink&&String(value?.imageUrl||'')===cleanImage)return key;
      }
    }catch{}
    const nref=rtdb.ref(`siteNotifications/${uid}`).push();
    await nref.set({id:nref.key,type:cleanType,title:cleanTitle,text:cleanText,link:cleanLink,imageUrl:cleanImage,sound:!!sound,createdAt});
    return nref.key;
  }
  async function siteUserUids(){
    const [profilesSnap,directorySnap]=await Promise.all([
      rtdb.ref('profiles').once('value').catch(()=>null),
      rtdb.ref('directory').once('value').catch(()=>null)
    ]);
    return [...new Set([
      ...Object.keys(profilesSnap?.val?.()||{}),
      ...Object.keys(directorySnap?.val?.()||{})
    ].filter(Boolean))];
  }

  async function notifyAllSiteUsers({title='Aviso da Gremory',text='',imageUrl='',type='admin_notice',link='',postId='',notificationId=''}={}){
    const cleanText=String(text||'').trim().slice(0,800);
    const cleanImage=String(imageUrl||'').trim().slice(0,1000);
    if(!cleanText&&!cleanImage)throw new Error('Escreva o texto da notificação ou envie uma imagem.');

    const uids=await siteUserUids();
    if(!uids.length)throw new Error('Nenhum usuário cadastrado no site foi encontrado.');

    const broadcastId=String(notificationId||'').trim()||id('notice');
    const createdAt=Date.now();
    const payloadBase={
      type:String(type||'admin_notice').slice(0,60),
      title:String(title||'Aviso da Gremory').slice(0,80),
      text:cleanText||'Novo aviso da Gremory.',
      imageUrl:cleanImage,
      link:String(link||'').trim().slice(0,300),
      postId:String(postId||'').trim().slice(0,160),
      sound:true,
      createdAt
    };

    // Grava em lotes para não fazer uma requisição separada por usuário.
    let sent=0;
    for(let i=0;i<uids.length;i+=150){
      const patch={};
      for(const uid of uids.slice(i,i+150)){
        patch[`siteNotifications/${uid}/${broadcastId}`]={id:broadcastId,...payloadBase};
        sent++;
      }
      await rtdb.ref().update(patch);
    }
    return{sent,broadcastId};
  }

  function addPokemonXpRaw(mon,amount){
    ensureMon(mon);let gained=Math.max(0,Math.floor(Number(amount||0))),levels=0;mon.xp=Math.max(0,Number(mon.xp||0))+gained;
    const need=lvl=>Math.max(80,Number(lvl||1)*100);
    while(mon.xp>=need(mon.level)&&Number(mon.level||1)<100){
      mon.xp-=need(mon.level);mon.level=Number(mon.level||1)+1;levels++;
      mon.maxHp=Number(mon.maxHp||1)+5;mon.hpAtual=Math.min(mon.maxHp,Number(mon.hpAtual||mon.maxHp)+5);
      mon.attack=Number(mon.attack||mon.ataque||80)+2;mon.ataque=mon.attack;
      mon.defense=Number(mon.defense||mon.defesa||80)+2;mon.defesa=mon.defense;
    }
    return{gained,levels};
  }
  async function uploadImageFromMessage(info){
    const direct=info?.message?.imageMessage;
    const quoted=info?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const imageMessage=direct||quoted;if(!imageMessage)return'';
    try{
      const baileys=safeRequire('baileys')||safeRequire('@whiskeysockets/baileys');
      if(!baileys?.downloadContentFromMessage)return'';
      const stream=await baileys.downloadContentFromMessage(imageMessage,'image');let buffer=Buffer.alloc(0);
      for await(const chunk of stream)buffer=Buffer.concat([buffer,chunk]);
      if(!buffer.length)return'';
      const FormData=safeRequire('form-data'),axiosMod=safeRequire('axios');if(!FormData||!axiosMod)return'';
      const axios=axiosMod.default||axiosMod,form=new FormData();form.append('reqtype','fileupload');form.append('fileToUpload',buffer,{filename:`gremory_${Date.now()}.jpg`,contentType:'image/jpeg'});
      const response=await axios.post('https://catbox.moe/user/api.php',form,{headers:form.getHeaders(),timeout:30000,maxBodyLength:12*1024*1024});
      const url=String(response.data||'').trim();return /^https?:\/\//i.test(url)?url:'';
    }catch(e){logger.log('[SITE BRIDGE] imagem da atualização:',e.message);return''}
  }
  async function publishUpdate({text='',imageUrl='',author='Charlotte'}={}){
    const clean=String(text||'').trim();if(!clean&&!imageUrl)throw new Error('Escreva o texto da atualização.');
    const uref=rtdb.ref('siteUpdates').push();const payload={id:uref.key,text:clean.slice(0,1800),imageUrl:String(imageUrl||'').trim().slice(0,1000),author:String(author||'Charlotte').slice(0,80),createdAt:Date.now()};
    await uref.set(payload);return payload;
  }

  async function processDueHealingJobs(){
    const jobs=readJson(healingPath,{});let changed=false;const syncAfter=[];
    for(const[jid,byMon]of Object.entries(jobs||{}))for(const[monUid,job]of Object.entries(byMon||{})){
      if(Number(job.readyAt||0)>Date.now())continue;
      try{const{db,user}=pokemonState(jid),mon=findMon(user,monUid);if(mon){healRaw(mon);savePokemonDb(db)}const uid=job.siteUid||await linkedUidByJid(jid).catch(()=>null);if(uid){await rtdb.ref(`pokemonHealing/${uid}/${monUid}`).remove().catch(()=>{});syncAfter.push([uid,jid])}delete jobs[jid][monUid];if(!Object.keys(jobs[jid]||{}).length)delete jobs[jid];changed=true;}catch(e){logger.log('[SITE BRIDGE] cura:',e.message)}
    }
    if(changed)writeJson(healingPath,jobs);
    for(const[uid,jid]of syncAfter)await syncAccount(uid,jid).catch(()=>{});
  }
  async function syncPokemon(uid,jid){await processDueHealingJobs().catch(()=>{});const{user}=pokemonState(jid);const pokemon=publicPokemonUser(user);await rtdb.ref(`charlotteSync/${uid}`).update({pokemon,updatedAt:now()});return pokemon;}
  async function syncAccount(uid,jid){const pokemon=await syncPokemon(uid,jid).catch(()=>null),lvl=readLevel(jid),prem=readPremium(jid),ach=readAchievements(jid),account={registered:registeredFor(jid),balance:balanceFor(jid),level:lvl.level,xp:lvl.xp,messages:lvl.messages,premium:prem.active};const patch={account,achievements:ach,updatedAt:now()};if(pokemon)patch.pokemon=pokemon;await rtdb.ref(`charlotteSync/${uid}`).update(patch);return{account,achievements:ach,pokemon};}
  async function findLinkCode(code){const snap=await rtdb.ref('charlotteLinkRequests').orderByChild('code').equalTo(String(code||'').trim().toUpperCase()).once('value');for(const[uid,req]of Object.entries(snap.val()||{}))if(Number(req.expiresAt||0)>=Date.now())return{uid,req};return null;}
  async function linkAccount(code,sender){const found=await findLinkCode(code);if(!found)throw new Error('Código inválido ou expirado. Gere outro no site.');const jid=cleanJid(sender);await rtdb.ref(`charlottePrivate/${found.uid}`).set({whatsappJid:jid,linkedAt:now()});await rtdb.ref(`charlottePublic/${found.uid}`).set({status:'linked',whatsappMasked:maskJid(jid),linkedAt:now()});await rtdb.ref(`charlotteLinkRequests/${found.uid}`).remove();try{await syncAccount(found.uid,jid)}catch(e){logger.log('[SITE BRIDGE] sync inicial:',e.message)}return found.uid;}
  async function reciprocalFriends(a,b){const[x,y]=await Promise.all([rtdb.ref(`friends/${a}/${b}`).once('value'),rtdb.ref(`friends/${b}/${a}`).once('value')]);return x.exists()&&y.exists();}

  async function startHealing(uid,jid,monUid){
    await processDueHealingJobs().catch(()=>{});
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes do hospital.');
    const{db,user}=pokemonState(jid),mon=findMon(user,monUid);if(!mon)throw new Error('Pokémon não encontrado.');
    ensureMon(mon);if(!mon.fainted&&Number(mon.hpAtual)>0)throw new Error('Esse Pokémon não está desmaiado.');
    const jobs=readJson(healingPath,{});jobs[jid]=jobs[jid]||{};const existing=jobs[jid][mon.uid];
    if(existing&&Number(existing.readyAt)>Date.now())return{alreadyHealing:true,cost:Number(existing.cost||HEAL_COST),readyAt:existing.readyAt,name:mon.nome||mon.name||'Pokémon',premium:!!existing.premium};
    const balance=balanceFor(jid);if(balance<HEAL_COST)throw new Error(`Você precisa de ₹${HEAL_COST}. Saldo: ₹${balance}.`);
    if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
    await economy.delkoin(jid,HEAL_COST);
    const premium=readPremium(jid).active,durationMs=premium?HEAL_MS_PREMIUM:HEAL_MS_FREE,readyAt=Date.now()+durationMs;
    mon.healingUntil=readyAt;savePokemonDb(db);
    const job={jid,siteUid:uid||null,monUid:mon.uid,name:mon.nome||mon.name||'Pokémon',cost:HEAL_COST,premium,durationMs,startedAt:Date.now(),readyAt};
    jobs[jid][mon.uid]=job;writeJson(healingPath,jobs);
    if(uid)await rtdb.ref(`pokemonHealing/${uid}/${mon.uid}`).set(job);
    if(uid)await syncAccount(uid,jid).catch(()=>{});
    return{alreadyHealing:false,cost:HEAL_COST,readyAt,name:job.name,premium,durationMs};
  }
  async function processHealStart(uid,jid,data){return startHealing(uid,jid,String(data.monUid||''));}
  async function processSetTeam(uid,jid,data){const ids=[...new Set((Array.isArray(data.teamUids)?data.teamUids:[]).map(String).filter(Boolean))].slice(0,6);if(!ids.length)throw new Error('Escolha pelo menos um Pokémon.');const{db,user}=pokemonState(jid),all=new Map(user.monsters.map(m=>[String(m.uid),m]));for(const x of ids)if(!all.has(x))throw new Error('Um Pokémon da equipe não existe mais.');user.party=ids;user.activeUid=ids[0];user.active=Math.max(0,user.monsters.findIndex(m=>String(m.uid)===ids[0]));savePokemonDb(db);return{pokemon:await syncPokemon(uid,jid),teamUids:ids};}

  async function processExplore(uid,jid){await processDueHealingJobs().catch(()=>{});const old=await rtdb.ref(`pokemonSiteEncounter/${uid}`).once('value');if(old.exists()&&Number(old.val()?.expiresAt||0)>Date.now()&&old.val()?.status!=='finished')return{encounter:old.val(),reused:true};const meta=await rtdb.ref(`pokemonSiteMeta/${uid}/lastExplore`).once('value');const exploreCooldown=readPremium(jid).active?8000:15000;if(Date.now()-Number(meta.val()||0)<exploreCooldown)throw new Error('Aguarde alguns segundos para explorar de novo.');const{user}=pokemonState(jid),mine=firstHealthy(user);if(!mine)throw new Error('Sua equipe está toda desmaiada. Use o Hospital Pokémon.');if(!sortearSelvagem)throw new Error('Sistema de exploração Pokémon não disponível.');const raw=await sortearSelvagem(true),wild=publicMon(raw||{});if(!wild.uid)wild.uid=id('wild');wild.hp=wild.maxHp;wild.fainted=false;const encounter={id:id('enc'),status:'battle',mon:wild,player:publicMon(mine),createdAt:now(),expiresAt:Date.now()+10*60*1000,log:{}};await Promise.all([rtdb.ref(`pokemonSiteEncounter/${uid}`).set(encounter),rtdb.ref(`pokemonSiteMeta/${uid}/lastExplore`).set(Date.now())]);return{encounter};}
  function calcDamage(attacker,defender,move){const a=publicMon(attacker),d=publicMon(defender),m=normalizeMove(move);const variance=crypto.randomInt(85,101)/100,raw=((((2*a.level/5)+2)*m.power*(a.attack/d.defense))/50)+2;return Math.max(1,Math.floor(raw*variance));}
  async function processWildMove(uid,jid,data){const er=rtdb.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())throw new Error('Explore primeiro.');const e=sn.val();if(e.status!=='battle'||Number(e.expiresAt||0)<Date.now())throw new Error('Esse encontro terminou.');const{db,user}=pokemonState(jid);let mine=findMon(user,e.player?.uid);if(!mine||mine.fainted||Number(mine.hpAtual)<=0)mine=firstHealthy(user);if(!mine)throw new Error('Sua equipe está desmaiada.');let minePub=publicMon(mine),wild={...e.mon};const moves=minePub.moves.length?minePub.moves:[{name:'Ataque rápido',power:40},{name:'Investida',power:45}],move=moves[clamp(data.moveIndex,0,moves.length-1)]||moves[0],damage=calcDamage(minePub,wild,move);wild.hp=Math.max(0,Number(wild.hp||wild.maxHp)-damage);let text=`${minePub.name} usou ${move.name} e causou ${damage} de dano.`;let reward=0;if(wild.hp<=0){wild.fainted=true;reward=crypto.randomInt(45,121);if(readPremium(jid).active)reward=Math.floor(reward*1.25);if(typeof economy.addkoin==='function')await economy.addkoin(jid,reward);const xpReward=crypto.randomInt(20,46);addPokemonXpRaw(mine,xpReward);e.reward={rupias:reward,pokemonXp:xpReward,premium:readPremium(jid).active};e.status='finished';e.result='victory';e.finishedAt=now();text+=` ${wild.name} desmaiou. +₹${reward}.`;e.expiresAt=Date.now()+60000;}else{const wildMoves=wild.moves?.length?wild.moves:[{name:'Investida',power:40}],wm=wildMoves[crypto.randomInt(0,wildMoves.length)],counter=calcDamage(wild,minePub,wm);mine.hpAtual=Math.max(0,Number(mine.hpAtual||mine.maxHp)-counter);if(mine.hpAtual<=0){faintRaw(mine,'selvagem');text+=` ${wild.name} usou ${wm.name} e causou ${counter}. ${minePub.name} desmaiou.`;const next=firstHealthy(user);if(next){mine=next;minePub=publicMon(next);text+=` Você enviou ${minePub.name}.`;await setBotActive(jid,next.uid)}else{e.status='finished';e.result='defeat';e.finishedAt=now();e.expiresAt=Date.now()+60000;text+=' Sua equipe inteira desmaiou.'}}else{text+=` ${wild.name} usou ${wm.name} e causou ${counter}.`;}}savePokemonDb(db);e.mon=wild;e.player=publicMon(mine);e.updatedAt=now();e.log=e.log||{};e.log[id('log')]={text,at:now()};await er.set(e);await syncAccount(uid,jid).catch(()=>{});return{encounter:e,reward};}
  async function processWildExit(uid){const er=rtdb.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())return{left:true};const e=sn.val()||{};e.status='finished';e.result='escaped';e.finishedAt=now();e.expiresAt=Date.now()+15000;e.updatedAt=now();e.log=e.log||{};e.log[id('log')]={text:'Você fugiu do encontro selvagem.',at:now()};await er.set(e);return{left:true};}
  async function processCapture(uid,jid,data){const er=rtdb.ref(`pokemonSiteEncounter/${uid}`),sn=await er.once('value');if(!sn.exists())throw new Error('Explore primeiro.');const e=sn.val();if(Number(e.expiresAt||0)<Date.now()||e.status==='finished')throw new Error('Esse encontro terminou.');const ball=String(data.ball||'pokebola').toLowerCase(),allowed=new Set(['pokebola','greatball','ultraball']);if(!allowed.has(ball))throw new Error('Pokébola inválida.');const{db,user}=pokemonState(jid);user.items=user.items||{};if(Number(user.items[ball]||0)<=0)throw new Error(`Você não possui ${ball}.`);user.items[ball]=Number(user.items[ball])-1;const wild=e.mon||{},hpRate=Number(wild.hp||wild.maxHp)/Math.max(1,Number(wild.maxHp||1)),base=32+Math.round((1-hpRate)*38),bonus=ball==='greatball'?15:ball==='ultraball'?30:0,chance=Math.max(5,Math.min(92,base+bonus)),captured=crypto.randomInt(1,101)<=chance;if(captured){const mon={uid:id('pk'),dex:wild.dex,nome:wild.name,level:wild.level,shiny:!!wild.shiny,maxHp:wild.maxHp,hpAtual:wild.maxHp,fainted:false,attack:wild.attack,defense:wild.defense,sprite:wild.sprite,types:wild.types,moves:wild.moves};user.monsters.push(mon);if(!Array.isArray(user.party)||user.party.length<6){user.party=Array.isArray(user.party)?user.party:[];user.party.push(mon.uid)}await er.remove();}else{e.updatedAt=now();e.log=e.log||{};e.log[id('log')]={text:`A ${ball} falhou. ${wild.name} escapou.`,at:now()};await er.set(e)}savePokemonDb(db);await syncAccount(uid,jid).catch(()=>{});return{captured,chance,pokemon:captured?wild:null};}

  function teamForJid(jid){const{user}=pokemonState(jid);return orderedTeamRaw(user).map(publicMon);}
  function currentDuelMon(player){const team=Array.isArray(player.team)?player.team:[];return team.find(m=>String(m.uid)===String(player.currentUid))||team[Math.max(0,Number(player.activeIndex||0))]||team[0]||null;}
  async function persistMonState(jid,pub){const{db,user}=pokemonState(jid),mon=findMon(user,pub.uid);if(mon){ensureMon(mon);mon.hpAtual=clamp(pub.hp,0,mon.maxHp);if(mon.hpAtual<=0)faintRaw(mon,'duelo_site');else{mon.fainted=false;mon.faintedAt=null;mon.faintedReason=null;}savePokemonDb(db)}}
  async function setBotActive(jid,monUid){const{db,user}=pokemonState(jid),idx=user.monsters.findIndex(m=>String(m.uid)===String(monUid));if(idx>=0){user.active=idx;user.activeUid=user.monsters[idx].uid;savePokemonDb(db)}}
  async function processChallenge(uid,data){const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Amigo inválido.');if(!(await reciprocalFriends(uid,targetUid)))throw new Error('O duelo só pode ser enviado para um amigo confirmado.');const[fromJid,targetJid,fromDir,targetDir]=await Promise.all([linkedJidByUid(uid),linkedJidByUid(targetUid),rtdb.ref(`directory/${uid}`).once('value'),rtdb.ref(`directory/${targetUid}`).once('value')]);if(!fromJid)throw new Error('Sua Charlotte não está vinculada.');if(!targetJid)throw new Error('Seu amigo ainda não vinculou a Charlotte.');if(!teamForJid(fromJid).some(m=>m.hp>0&&!m.fainted))throw new Error('Sua equipe está desmaiada.');if(!teamForJid(targetJid).some(m=>m.hp>0&&!m.fainted))throw new Error('A equipe do seu amigo está desmaiada.');const challengeId=id('duel'),fromName=fromDir.val()?.nome||'Treinador';await rtdb.ref(`pokemonSiteChallenges/${targetUid}/${challengeId}`).set({id:challengeId,fromUid:uid,fromName,createdAt:now()});await notifySite(targetUid,{type:'pokemon_duel',title:'Novo desafio Pokémon',text:`${fromName} te desafiou para uma batalha 6x6.`,link:'#pokemon'}).catch(()=>{});await sendWhats(targetJid,`⚔️ ${fromName} te desafiou para uma batalha Pokémon 6x6 no site Gremory.`);await sendWhats(fromJid,`⚔️ Desafio enviado para ${targetDir.val()?.nome||'seu amigo'}.`);return{challengeId};}
  async function processAccept(uid,data){const challengeId=String(data.challengeId||''),cr=rtdb.ref(`pokemonSiteChallenges/${uid}/${challengeId}`),sn=await cr.once('value');if(!sn.exists())throw new Error('Esse desafio não existe mais.');const c=sn.val(),fromUid=c.fromUid;if(!(await reciprocalFriends(uid,fromUid)))throw new Error('Amizade não confirmada.');const[fromJid,toJid,fromDir,toDir]=await Promise.all([linkedJidByUid(fromUid),linkedJidByUid(uid),rtdb.ref(`directory/${fromUid}`).once('value'),rtdb.ref(`directory/${uid}`).once('value')]);if(!fromJid||!toJid)throw new Error('Os dois jogadores precisam vincular a Charlotte.');const teamA=teamForJid(fromJid),teamB=teamForJid(toJid),firstA=teamA.find(x=>x.hp>0&&!x.fainted),firstB=teamB.find(x=>x.hp>0&&!x.fainted);if(!firstA||!firstB)throw new Error('Os dois jogadores precisam ter Pokémon saudáveis.');const duelId=id('webduel'),first=crypto.randomInt(0,2)===0?fromUid:uid,createdAt=now(),duel={id:duelId,status:'active',createdAt,updatedAt:createdAt,turnUid:first,players:{[fromUid]:{uid:fromUid,jid:fromJid,name:fromDir.val()?.nome||'Treinador',team:teamA,currentUid:firstA.uid,activeIndex:teamA.findIndex(x=>x.uid===firstA.uid)},[uid]:{uid,jid:toJid,name:toDir.val()?.nome||'Treinador',team:teamB,currentUid:firstB.uid,activeIndex:teamB.findIndex(x=>x.uid===firstB.uid)}},log:{}};await rtdb.ref(`pokemonSiteDuels/${duelId}`).set(duel);await Promise.all([rtdb.ref(`pokemonSiteDuelIndex/${fromUid}/${duelId}`).set({status:'active',createdAt,updatedAt:createdAt}),rtdb.ref(`pokemonSiteDuelIndex/${uid}/${duelId}`).set({status:'active',createdAt,updatedAt:createdAt}),cr.remove()]);await Promise.all([setBotActive(fromJid,firstA.uid),setBotActive(toJid,firstB.uid)]);return{duelId};}
  async function processDecline(uid,data){const challengeId=String(data.challengeId||''),r=rtdb.ref(`pokemonSiteChallenges/${uid}/${challengeId}`),sn=await r.once('value');if(!sn.exists())return{};const c=sn.val(),fromJid=await linkedJidByUid(c.fromUid);await r.remove();await sendWhats(fromJid,'⚔️ Seu desafio não foi aceito.');return{};}
  async function finishDuel(duelRef,duel,winnerUid,reason='fim'){
    const loserUid=Object.keys(duel.players||{}).find(x=>x!==winnerUid),updatedAt=now();
    let reward=null;
    // Vitória por nocaute recebe recompensa. Desistência não paga para evitar farm.
    if(winnerUid&&reason==='todos_desmaiados'){
      const winnerJid=duel.players?.[winnerUid]?.jid||await linkedJidByUid(winnerUid);
      const premium=readPremium(winnerJid).active,rupias=premium?90:65,trainerXp=premium?55:40,pokemonXp=premium?65:45;
      if(typeof economy.addkoin==='function')await economy.addkoin(winnerJid,rupias);
      if(typeof economy.addXp==='function')await economy.addXp(winnerJid,trainerXp);
      try{
        const{db,user}=pokemonState(winnerJid),active=currentDuelMon(duel.players?.[winnerUid]||{}),mon=findMon(user,active?.uid);
        if(mon){addPokemonXpRaw(mon,pokemonXp);savePokemonDb(db)}
      }catch{}
      reward={rupias,trainerXp,pokemonXp,premium};
      try{await achievements.registrarEventoConquista?.({sender:winnerJid,evento:'pokemon_vitoria',qtd:1})}catch{}
    }
    await duelRef.update({status:'finished',winnerUid,loserUid,finishedAt:updatedAt,updatedAt,finishReason:reason,turnUid:null,reward});
    await Promise.all(Object.keys(duel.players||{}).map(uid=>rtdb.ref(`pokemonSiteDuelIndex/${uid}/${duel.id}`).update({status:'finished',winnerUid,updatedAt,reward:uid===winnerUid?reward:null})));
    for(const uid of Object.keys(duel.players||{})){const jid=duel.players[uid]?.jid||await linkedJidByUid(uid);await syncAccount(uid,jid).catch(()=>{});await notifySite(uid,{type:'pokemon_duel',title:uid===winnerUid?'Vitória Pokémon':'Batalha encerrada',text:uid===winnerUid?(reward?`Você venceu e recebeu ₹${reward.rupias}, ${reward.trainerXp} XP e ${reward.pokemonXp} XP Pokémon.`:'Você venceu a batalha.'):'A batalha Pokémon foi encerrada.',link:'#pokemon'}).catch(()=>{})}
    return{winnerUid,loserUid,reward};
  }
  async function processMove(uid,data){const duelId=String(data.duelId||''),duelRef=rtdb.ref(`pokemonSiteDuels/${duelId}`),sn=await duelRef.once('value');if(!sn.exists())throw new Error('Duelo não encontrado.');const duel={id:duelId,...sn.val()};if(duel.status!=='active')throw new Error('Esse duelo já terminou.');if(duel.turnUid!==uid)throw new Error('Ainda não é sua vez.');const me=duel.players?.[uid];if(!me)throw new Error('Você não participa desse duelo.');const targetUid=Object.keys(duel.players).find(x=>x!==uid),enemy=duel.players[targetUid],attacker=currentDuelMon(me),defender=currentDuelMon(enemy);if(!attacker||attacker.hp<=0||attacker.fainted)throw new Error('Seu Pokémon atual está desmaiado. Troque de Pokémon.');if(!defender)throw new Error('Pokémon adversário inválido.');const moves=attacker.moves?.length?attacker.moves:[{name:'Ataque rápido',power:40},{name:'Investida',power:45}],move=moves[clamp(data.moveIndex,0,moves.length-1)]||moves[0],damage=calcDamage(attacker,defender,move),nextHp=Math.max(0,Number(defender.hp||defender.maxHp)-damage);defender.hp=nextHp;defender.fainted=nextHp<=0;const patch={updatedAt:now()};const defIndex=enemy.team.findIndex(x=>String(x.uid)===String(defender.uid));patch[`players/${targetUid}/team/${defIndex}/hp`]=nextHp;patch[`players/${targetUid}/team/${defIndex}/fainted`]=defender.fainted;let text=`${me.name} usou ${move.name} com ${attacker.name} e causou ${damage} de dano.`;await persistMonState(enemy.jid||await linkedJidByUid(targetUid),defender);if(defender.fainted){text+=` ${defender.name} desmaiou.`;const nextIndex=enemy.team.findIndex(x=>Number(x.hp)>0&&!x.fainted&&String(x.uid)!==String(defender.uid));if(nextIndex<0){patch[`log/${id('log')}`]={text,at:now()};await duelRef.update(patch);await finishDuel(duelRef,duel,uid,'todos_desmaiados');return{damage,nextHp,winnerUid:uid};}patch[`players/${targetUid}/currentUid`]=enemy.team[nextIndex].uid;patch[`players/${targetUid}/activeIndex`]=nextIndex;text+=` ${enemy.name} enviou ${enemy.team[nextIndex].name}.`;await setBotActive(enemy.jid||await linkedJidByUid(targetUid),enemy.team[nextIndex].uid)}patch.turnUid=targetUid;patch[`log/${id('log')}`]={text,at:now()};await duelRef.update(patch);return{damage,nextHp};}
  async function processDuelSwitch(uid,data){const duelId=String(data.duelId||''),dr=rtdb.ref(`pokemonSiteDuels/${duelId}`),sn=await dr.once('value');if(!sn.exists())throw new Error('Duelo não encontrado.');const duel={id:duelId,...sn.val()};if(duel.status!=='active'||duel.turnUid!==uid)throw new Error('Você só pode trocar na sua vez.');const me=duel.players?.[uid],target=me?.team?.find(x=>String(x.uid)===String(data.monUid));if(!target||target.fainted||Number(target.hp)<=0)throw new Error('Escolha um Pokémon saudável.');const targetUid=Object.keys(duel.players).find(x=>x!==uid),idx=me.team.findIndex(x=>String(x.uid)===String(target.uid));await dr.update({[`players/${uid}/currentUid`]:target.uid,[`players/${uid}/activeIndex`]:idx,turnUid:targetUid,updatedAt:now(),[`log/${id('log')}`]:{text:`${me.name} trocou para ${target.name}.`,at:now()}});await setBotActive(me.jid||await linkedJidByUid(uid),target.uid);return{currentUid:target.uid};}
  async function processDuelExit(uid,data){const duelId=String(data.duelId||''),dr=rtdb.ref(`pokemonSiteDuels/${duelId}`),sn=await dr.once('value');if(!sn.exists())return{};const duel={id:duelId,...sn.val()};if(duel.status!=='active')return{};if(!duel.players?.[uid])throw new Error('Você não participa desse duelo.');const winnerUid=Object.keys(duel.players).find(x=>x!==uid);await dr.update({[`log/${id('log')}`]:{text:`${duel.players[uid].name} desistiu da batalha.`,at:now()}});return finishDuel(dr,duel,winnerUid,'desistencia');}

  async function processDaily(uid,jid){if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de coletar o Daily pelo site.');if(typeof mining.checkDayli!=='function'||typeof mining.addDayli!=='function')throw new Error('Sistema Daily não disponível no bot.');if(mining.checkDayli(jid)){const release=Number(mining.timeDayli?.(jid)||Date.now());return{claimed:false,cooldownMs:Math.max(0,release-Date.now()),message:'Você já coletou o Daily. Volte quando o cooldown terminar.'};}await mining.addDayli(jid,24*60*60*1000);const sorte=Math.random()*100;let rupias,rewardName;if(sorte<3){rupias=crypto.randomInt(700,1001);rewardName='JACKPOT DIÁRIO';}else if(sorte<15){rupias=crypto.randomInt(400,601);rewardName='Recompensa de Ouro';}else if(sorte<45){rupias=crypto.randomInt(300,451);rewardName='Recompensa de Prata';}else{rupias=crypto.randomInt(200,301);rewardName='Recompensa Diária';}const xp=crypto.randomInt(20,61);await economy.addkoin(jid,rupias);await economy.addXp(jid,xp);try{await achievements.registrarEventoConquista?.({sender:jid,evento:'daily',qtd:1});await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_ganho',qtd:rupias});}catch{}const balance=balanceFor(jid);await syncAccount(uid,jid).catch(()=>{});return{claimed:true,rewardName,rupias,xp,balance};}
  async function processBuyCustomization(uid,jid,data){
    const itemId=String(data.itemId||''),item=CUSTOMIZATION_CATALOG[itemId];if(!item)throw new Error('Personalização inválida.');
    if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de usar rúpias no site.');
    const invRef=rtdb.ref(`siteInventory/${uid}/items/${itemId}`),owned=await invRef.once('value');
    if(!owned.exists()){
      const balance=balanceFor(jid);if(balance<item.price)throw new Error(`Saldo insuficiente. Você possui ₹${balance}.`);
      if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
      await economy.delkoin(jid,item.price);try{await achievements.registrarEventoConquista?.({sender:jid,evento:'dinheiro_gasto',qtd:item.price});}catch{}
      await invRef.set({id:itemId,name:item.name,price:item.price,slot:item.slot,purchasedAt:now()});
    }
    await rtdb.ref(`siteCustomization/${uid}`).update({[`equipped/${item.slot}`]:itemId,active:itemId,updatedAt:now()});
    await syncAccount(uid,jid).catch(()=>{});
    return{itemId,slot:item.slot,price:item.price,balance:balanceFor(jid),alreadyOwned:owned.exists()};
  }
  async function processEquipCustomization(uid,data){
    const itemId=String(data.itemId||''),item=CUSTOMIZATION_CATALOG[itemId];if(!item)throw new Error('Personalização inválida.');
    const owned=await rtdb.ref(`siteInventory/${uid}/items/${itemId}`).once('value');if(!owned.exists())throw new Error('Você ainda não possui essa personalização.');
    await rtdb.ref(`siteCustomization/${uid}`).update({[`equipped/${item.slot}`]:itemId,active:itemId,updatedAt:now()});
    return{itemId,slot:item.slot};
  }
  async function processPremiumCheckout(uid,jid,data){const plan=VIP_PLANS[String(data.plan||'')];if(!plan)throw new Error('Plano Premium inválido.');if(!registeredFor(jid))throw new Error('Use /reg na Charlotte antes de comprar Premium.');const token=String(process.env.MP_ACCESS_TOKEN||process.env.MERCADO_PAGO_ACCESS_TOKEN||'').trim();if(!token)throw new Error('Mercado Pago não está configurado no bot.');let MercadoPagoConfig,Preference;try{({MercadoPagoConfig,Preference}=require('mercadopago'))}catch{throw new Error('Pacote mercadopago não está instalado no bot.');}const client=new MercadoPagoConfig({accessToken:token}),preference=new Preference(client),orderId=`sitevip_${Date.now()}_${crypto.randomInt(100000,999999)}`,pref=await preference.create({body:{items:[{title:plan.nome,quantity:1,currency_id:'BRL',unit_price:Number(plan.valor)}],external_reference:orderId}}),checkoutUrl=pref?.init_point||pref?.sandbox_init_point;if(!checkoutUrl)throw new Error('Mercado Pago não retornou o link de pagamento.');const orders=readJson(ordersPath,{});orders[cleanJid(jid)]={orderId,sender:cleanJid(jid),plano:String(data.plan),dias:Number(plan.dias),valor:Number(plan.valor),pago:false,status:'pending',criadoEm:Date.now(),origem:'site',siteUid:uid};writeJson(ordersPath,orders);await sendWhats(jid,`💎 Pagamento Premium criado pelo site Gremory.\n${plan.nome} • R$ ${Number(plan.valor).toFixed(2).replace('.',',')}`);return{checkoutUrl,orderId,plan:{days:plan.dias,value:plan.valor,name:plan.nome}};}
  async function processSendDownload(uid,jid,data){
    let url;try{url=new URL(String(data.url||''))}catch{throw new Error('Link de download inválido.')}
    if(!['https:','http:'].includes(url.protocol))throw new Error('Link de download inválido.');
    const title=String(data.title||'Download Gremory').replace(/[\r\n]+/g,' ').slice(0,120);
    const service=String(data.service||'').toLowerCase();
    const requestedName=String(data.filename||'').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,140);
    const requestedMime=String(data.mimetype||'').trim().slice(0,100);
    const audioService=service==='spotify'||service.includes('audio');
    const fallbackExt=service==='apk'?'.apk':audioService?'.m4a':'.mp4';
    const fallbackMime=service==='apk'?'application/vnd.android.package-archive':audioService?'audio/mp4':'video/mp4';
    const safeTitle=title.replace(/[^a-zA-Z0-9._ -]+/g,'').trim()||'gremory-download';
    const fileName=requestedName||`${safeTitle}${safeTitle.includes('.')?'':fallbackExt}`;
    const mime=requestedMime||fallbackMime;

    // O WhatsApp precisa receber a mídia, não a URL temporária da API.
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
    let resp;
    try{
      resp=await fetch(url.toString(),{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0'}});
      if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
      const len=Number(resp.headers.get('content-length')||0);
      if(len>65*1024*1024)throw new Error('Arquivo maior que 65 MB.');
      const ab=await resp.arrayBuffer();const buffer=Buffer.from(ab);
      if(!buffer.length)throw new Error('A mídia veio vazia.');
      if(buffer.length>65*1024*1024)throw new Error('Arquivo maior que 65 MB.');

      if(service==='tiktok'||service==='instagram'||service==='facebook'||mime.startsWith('video/')){
        await sock.sendMessage(jid,{video:buffer,mimetype:mime.startsWith('video/')?mime:'video/mp4',caption:`✅ ${title}`});
      }else if(audioService||mime.startsWith('audio/')){
        await sock.sendMessage(jid,{audio:buffer,mimetype:mime.startsWith('audio/')?mime:'audio/mp4',fileName});
      }else{
        await sock.sendMessage(jid,{document:buffer,fileName,mimetype:mime,caption:`📥 ${title}`});
      }
    }catch(e){
      throw new Error(`Não consegui enviar a mídia no WhatsApp: ${e.name==='AbortError'?'tempo esgotado':e.message}`);
    }finally{clearTimeout(timer)}
    try{
      const evento=service==='apk'?'download_app':audioService?'download_audio':'download_video';
      await achievements.registrarEventoConquista?.({sender:jid,evento,qtd:1})
    }catch{}
    return{sent:true,sentAsFile:true,fileName,mimetype:mime};
  }

  async function processYoutubeDownload(uid,jid,data){
    const input=String(data.input||'').trim();
    const mode=String(data.mode||'video').toLowerCase()==='audio'?'audio':'video';
    if(!input)throw new Error('Nome ou link do YouTube obrigatório.');

    fs.mkdirSync(downloadDir,{recursive:true});
    const {execFile}=require('child_process');
    const target=/^https?:\/\//i.test(input)?input:`ytsearch1:${input}`;
    const stamp=`site_${Date.now()}_${crypto.randomInt(1000,9999)}`;
    const template=path.join(downloadDir,`${stamp}.%(ext)s`);

    const mediaArgs = mode==='audio'
      ? ['-x','--audio-format','mp3','--audio-quality','0']
      : ['-f','bv*[ext=mp4][vcodec^=avc1][height<=720]+ba[ext=m4a]/b[ext=mp4][height<=720]/best[height<=720]','--merge-output-format','mp4','--recode-video','mp4'];

    const common=['--no-playlist','--js-runtimes','node','--remote-components','ejs:github'];
    const run=(args)=>new Promise(resolve=>execFile('yt-dlp',args,{maxBuffer:1024*1024*30,timeout:180000,windowsHide:true},(err,stdout,stderr)=>resolve({err,stdout:String(stdout||''),stderr:String(stderr||'')})));

    // Tenta público sem cookies primeiro. Isso evita "The page needs to be reloaded"
    // causado por alguns clientes autenticados do YouTube.
    let result=await run([...common,...mediaArgs,'-o',template,target]);

    const cookies=path.join(rootDir,'cookies.txt');
    if(result.err && fs.existsSync(cookies)){
      result=await run([
        ...common,
        '--cookies',cookies,
        '--extractor-args','youtube:player_client=default,web_embedded',
        ...mediaArgs,
        '-o',template,
        target
      ]);
    }

    if(result.err){
      const msg=String(result.stderr||result.err.message||'');
      const low=msg.toLowerCase();
      if(low.includes('remote component challenge solver')||low.includes('challenge solving failed')){
        throw new Error('Não consegui preparar esse vídeo agora. Tente novamente em alguns instantes.');
      }
      if(low.includes('sign in'))throw new Error('Esse vídeo exige acesso adicional e não pôde ser baixado agora.');
      throw new Error('Não consegui concluir o download desse vídeo agora.');
    }

    const files=fs.readdirSync(downloadDir).filter(f=>f.startsWith(stamp)).map(f=>path.join(downloadDir,f));
    if(!files.length)throw new Error('Download terminou, mas o arquivo não foi encontrado.');
    const file=files.find(f=>mode==='audio'?f.toLowerCase().endsWith('.mp3'):f.toLowerCase().endsWith('.mp4'))||files[0];
    const stat=fs.statSync(file),name=path.basename(file);
    try{
      if(mode==='audio')await sock.sendMessage(jid,{audio:fs.readFileSync(file),mimetype:'audio/mpeg',fileName:name});
      else if(stat.size<=60*1024*1024)await sock.sendMessage(jid,{video:fs.readFileSync(file),caption:'✅ YouTube baixado pelo site Gremory.'});
      else await sock.sendMessage(jid,{document:fs.readFileSync(file),fileName:name,mimetype:'video/mp4',caption:'✅ YouTube baixado pelo site Gremory.'});
    }finally{
      try{fs.unlinkSync(file)}catch{}
    }
    try{await achievements.registrarEventoConquista?.({sender:jid,evento:mode==='audio'?'download_audio':'download_video',qtd:1})}catch{}
    return{sent:true,title:name,message:'Arquivo enviado no WhatsApp pela Charlotte.'};
  }

  async function processTttCreate(uid,data){const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Amigo inválido.');if(!(await reciprocalFriends(uid,targetUid)))throw new Error('Jogue apenas com amigos confirmados.');const[a,b]=await Promise.all([rtdb.ref(`directory/${uid}`).once('value'),rtdb.ref(`directory/${targetUid}`).once('value')]),gameId=id('ttt'),first=crypto.randomInt(0,2)===0?uid:targetUid,createdAt=Date.now(),game={id:gameId,status:'active',createdAt,updatedAt:createdAt,turnUid:first,board:['','','','','','','','',''],players:{[uid]:{uid,name:a.val()?.nome||'Jogador',symbol:'X'},[targetUid]:{uid:targetUid,name:b.val()?.nome||'Jogador',symbol:'O'}},log:{}};await rtdb.ref(`ticTacToeGames/${gameId}`).set(game);await Promise.all([rtdb.ref(`ticTacToeIndex/${uid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt}),rtdb.ref(`ticTacToeIndex/${targetUid}/${gameId}`).set({status:'active',createdAt,updatedAt:createdAt})]);await notifySite(targetUid,{type:'ttt',title:'Convite para jogar',text:`${a.val()?.nome||'Um amigo'} te chamou para o jogo da velha.`,link:'#games'}).catch(()=>{});return{gameId};}
  function tttWinner(board){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const[a,b,c]of lines)if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return null;}
  async function grantTttReward(uid){
    const jid=await linkedJidByUid(uid);if(!jid||typeof economy.addkoin!=='function')return{rupias:0,limitReached:false};
    const db=readJson(tttRewardPath,{}),day=new Date().toISOString().slice(0,10),row=db[jid]||{};
    if(row.day!==day){row.day=day;row.wins=0}
    const premium=readPremium(jid).active,limit=premium?8:5;
    if(Number(row.wins||0)>=limit){db[jid]=row;writeJson(tttRewardPath,db);return{rupias:0,limitReached:true,limit,premium}}
    const rupias=premium?40:30;await economy.addkoin(jid,rupias);row.wins=Number(row.wins||0)+1;db[jid]=row;writeJson(tttRewardPath,db);
    return{rupias,limitReached:false,limit,premium,wins:row.wins};
  }
  async function processTttMove(uid,data){
    const gameId=String(data.gameId||''),gr=rtdb.ref(`ticTacToeGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())throw new Error('Partida não encontrada.');
    const g={id:gameId,...sn.val()};if(g.status!=='active'||g.turnUid!==uid)throw new Error('Ainda não é sua vez.');
    const idx=Number(data.index);if(!Number.isInteger(idx)||idx<0||idx>8)throw new Error('Jogada inválida.');
    const board=Array.isArray(g.board)?g.board.slice():Array.from({length:9},(_,i)=>g.board?.[i]||'');if(board[idx])throw new Error('Essa casa já foi usada.');
    const me=g.players?.[uid],otherUid=Object.keys(g.players||{}).find(x=>x!==uid);board[idx]=me.symbol;
    const winner=tttWinner(board),draw=!winner&&board.every(Boolean),patch={board,updatedAt:Date.now(),[`log/${id('log')}`]:{text:`${me.name} marcou ${me.symbol}.`,at:now()}};
    let reward=null;
    if(winner||draw){
      patch.status='finished';patch.winnerUid=winner?uid:null;patch.finishedAt=Date.now();patch.turnUid=null;
      if(winner){reward=await grantTttReward(uid);patch.reward=reward}
    }else patch.turnUid=otherUid;
    await gr.update(patch);
    if(winner||draw){
      const up=Date.now();await Promise.all(Object.keys(g.players).map(x=>rtdb.ref(`ticTacToeIndex/${x}/${gameId}`).update({status:'finished',winnerUid:winner?uid:null,updatedAt:up,reward:x===uid?reward:null})));
      for(const playerUid of Object.keys(g.players||{}))await notifySite(playerUid,{type:'ttt',title:draw?'Empate':playerUid===uid?'Vitória!':'Partida encerrada',text:draw?'A partida terminou empatada.':playerUid===uid?(reward?.rupias?`Você venceu e ganhou ₹${reward.rupias}.`:'Você venceu. Limite diário de recompensa atingido.'):`${me.name} venceu a partida.`,link:'#games'}).catch(()=>{});
    }
    return{winnerUid:winner?uid:null,draw,reward};
  }
  async function processTttExit(uid,data){const gameId=String(data.gameId||''),gr=rtdb.ref(`ticTacToeGames/${gameId}`),sn=await gr.once('value');if(!sn.exists())return{};const g={id:gameId,...sn.val()};if(g.status!=='active'||!g.players?.[uid])return{};const winnerUid=Object.keys(g.players).find(x=>x!==uid),up=Date.now();await gr.update({status:'finished',winnerUid,finishedAt:up,updatedAt:up,turnUid:null,[`log/${id('log')}`]:{text:`${g.players[uid].name} saiu da partida.`,at:now()}});await Promise.all(Object.keys(g.players).map(x=>rtdb.ref(`ticTacToeIndex/${x}/${gameId}`).update({status:'finished',winnerUid,updatedAt:up})));return{winnerUid};}


  function tinderNormalizeProfile(p={}){
    return{...p,jid:cleanJid(p.jid||''),nome:String(p.nome||'Usuário').slice(0,60),idade:String(p.idade||''),bio:String(p.bio||'').slice(0,300),likes:Number(p.likes||0),matches:Number(p.matches||0),likedBy:Array.isArray(p.likedBy)?p.likedBy:[],matchedWith:Array.isArray(p.matchedWith)?p.matchedWith:[],ativo:p.ativo!==false};
  }
  async function siteUidMapByJid(){
    const sn=await rtdb.ref('charlottePrivate').once('value'),map=new Map();
    for(const[uid,v]of Object.entries(sn.val()||{})){const jid=cleanJid(v?.whatsappJid||'');if(jid)map.set(jid,uid)}
    return map;
  }
  async function tinderPhoto(profile){
    if(/^https?:\/\//i.test(String(profile?.foto||'')))return String(profile.foto);
    try{
      const p=await Promise.race([sock.profilePictureUrl(profile.jid,'image'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),1800))]);
      return String(p||'');
    }catch{return''}
  }
  async function processTinderFeed(uid,jid,data){
    const rows=readJson(tinderPath,[]);if(!Array.isArray(rows))throw new Error('Tinder indisponível.');
    const me=rows.find(p=>sameUser(p?.jid,jid));if(!me)throw new Error('Crie seu perfil primeiro com /rgtinder no WhatsApp.');
    const links=await siteUidMapByJid(),skip=new Set((Array.isArray(data.skipUids)?data.skipUids:[]).map(String));
    const candidates=[];
    for(const raw of rows){
      const p=tinderNormalizeProfile(raw);if(!p.ativo||sameUser(p.jid,jid))continue;
      const targetUid=links.get(cleanJid(p.jid));if(!targetUid||skip.has(targetUid))continue;
      candidates.push({targetUid,profile:p});
    }
    if(!candidates.length)return{profile:null};
    const pick=candidates[crypto.randomInt(0,candidates.length)],p=pick.profile;
    return{profile:{uid:pick.targetUid,nome:p.nome,idade:p.idade,bio:p.bio,photo:await tinderPhoto(p),likes:p.likes,matches:p.matches}};
  }
  async function processTinderLike(uid,jid,data){
    const targetUid=String(data.targetUid||'');if(!targetUid||targetUid===uid)throw new Error('Perfil inválido.');
    const targetJid=await linkedJidByUid(targetUid);if(!targetJid)throw new Error('Esse perfil não está disponível.');
    const rows=readJson(tinderPath,[]);if(!Array.isArray(rows))throw new Error('Tinder indisponível.');
    const myIndex=rows.findIndex(p=>sameUser(p?.jid,jid)),targetIndex=rows.findIndex(p=>sameUser(p?.jid,targetJid));
    if(myIndex<0)throw new Error('Crie seu perfil primeiro com /rgtinder no WhatsApp.');if(targetIndex<0)throw new Error('Esse perfil não existe mais.');
    const me=tinderNormalizeProfile(rows[myIndex]),target=tinderNormalizeProfile(rows[targetIndex]);
    if(!target.likedBy.some(x=>sameUser(x,jid)))target.likedBy.push(jid);target.likes=target.likedBy.length;
    const match=me.likedBy.some(x=>sameUser(x,targetJid));
    if(match){
      if(!me.matchedWith.some(x=>sameUser(x,targetJid)))me.matchedWith.push(targetJid);
      if(!target.matchedWith.some(x=>sameUser(x,jid)))target.matchedWith.push(jid);
      me.matches=me.matchedWith.length;target.matches=target.matchedWith.length;
    }
    rows[myIndex]=me;rows[targetIndex]=target;writeJson(tinderPath,rows);
    if(match){
      await notifySite(uid,{type:'tinder_match',title:'Deu match 💘',text:`Você e ${target.nome} curtiram um ao outro.`,link:'#tinder'}).catch(()=>{});
      await notifySite(targetUid,{type:'tinder_match',title:'Deu match 💘',text:`Você e ${me.nome} curtiram um ao outro.`,link:'#tinder'}).catch(()=>{});
      await sendWhats(targetJid,`💘 Deu match com ${me.nome}! Abra o Tinder no site ou use /tinder.`);
    }
    return{liked:true,match,contact:match?(target.wa||''):''};
  }
  function compactWatchMusicRows(queueObj={}){
    const rows=Object.entries(queueObj||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
    const keep=[],removeIds=[],lastByTrack=new Map();
    for(const row of rows){
      const key=`${String(row.videoId||row.url||row.title||'')}|${String(row.requestedBy||'')}`;
      const created=Number(row.createdAt||0),last=lastByTrack.get(key);
      if(last&&Math.abs(created-last.created)<=15000){
        removeIds.push(row.id);
        continue;
      }
      lastByTrack.set(key,{created,id:row.id});
      keep.push(row);
    }
    return{keep,removeIds};
  }
  async function compactWatchMusicQueue(roomCode,queueObj={}){
    const compacted=compactWatchMusicRows(queueObj);
    if(compacted.removeIds.length){
      const patch={};
      for(const id of compacted.removeIds)patch[`watchRooms/${roomCode}/musicQueue/${id}`]=null;
      await rtdb.ref().update(patch);
      logger.log(`[WATCH MUSIC] removidas ${compacted.removeIds.length} duplicata(s) da fila ${roomCode}.`);
    }
    return compacted.keep;
  }

  async function watchMusicRoomState(roomCode,uid){
    const roomSn=await rtdb.ref(`watchRooms/${roomCode}`).once('value');
    if(!roomSn.exists())throw new Error('Sala não encontrada.');
    const room=roomSn.val()||{};
    if(!room.members?.[uid])throw new Error('Entre na sala antes de usar música.');
    const voiceSn=await rtdb.ref(`watchVoice/${roomCode}/${uid}/audio`).once('value');
    if(voiceSn.val()!==true)throw new Error('Entre na chamada de voz para usar a música da sala.');
    return room;
  }
  async function processWatchMusicActivate(uid,jid,data){
    const roomCode=String(data.roomCode||'').trim().toUpperCase();
    if(!roomCode)throw new Error('Sala inválida.');
    const room=await watchMusicRoomState(roomCode,uid);
    const existing=room.musicAccess?.[uid];
    if(existing?.active)return{alreadyActive:true,cost:0,access:existing,premium:readPremium(jid).active};

    const cost=50,balance=balanceFor(jid);
    if(balance<cost)throw new Error(`Você precisa de ₹${cost} para ativar a música nesta sala. Saldo: ₹${balance}.`);
    if(typeof economy.delkoin!=='function')throw new Error('Sistema de rúpias não disponível.');
    await economy.delkoin(jid,cost);

    const premium=readPremium(jid).active;
    const access={active:true,activatedAt:Date.now(),activationCost:cost,used:0,premiumAtActivation:premium};
    await rtdb.ref(`watchRooms/${roomCode}/musicAccess/${uid}`).set(access);
    await syncAccount(uid,jid).catch(()=>{});
    return{alreadyActive:false,cost,access,premium};
  }
  async function processWatchMusicAdd(uid,jid,data,jobId=''){
    const roomCode=String(data.roomCode||'').trim().toUpperCase(),query=String(data.query||'').trim().slice(0,160);
    if(!roomCode||!query)throw new Error('Informe a sala e a música.');
    const room=await watchMusicRoomState(roomCode,uid);
    const access=room.musicAccess?.[uid];
    if(!access?.active)throw new Error('Ative a música nesta sala por ₹50 antes de adicionar faixas.');

    const yts=safeRequire('yt-search');if(!yts)throw new Error('Busca de música não disponível.');
    let video=null;
    const ytId=(()=>{
      try{
        if(!/^https?:\/\//i.test(query))return'';
        const u=new URL(query);
        if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0]||'';
        if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/]+)/)?.[1]||'';
      }catch{}
      return'';
    })();
    if(ytId){
      try{video=await yts({videoId:ytId})}catch{}
    }
    if(!video?.videoId){
      const result=await yts(query);video=result?.videos?.[0];
    }
    if(!video?.videoId)throw new Error('Música não encontrada.');

    const premium=readPremium(jid).active,used=Math.max(0,Number(access.used||0));
    const cost=premium?0:(used<10?0:5);
    if(cost>0){
      const balance=balanceFor(jid);
      if(balance<cost)throw new Error(`As 10 músicas inclusas acabaram. Você precisa de ₹${cost} para adicionar esta faixa.`);
      await economy.delkoin(jid,cost);
    }

    const queueRows=await compactWatchMusicQueue(roomCode,room.musicQueue||{});const queueEntries=queueRows.map(x=>[x.id,x]);
    const qref=rtdb.ref(`watchRooms/${roomCode}/musicQueue`).push(),createdAt=Date.now();
    const item={
      id:qref.key,
      title:String(video.title||query).slice(0,120),
      videoId:video.videoId,
      url:video.url||`https://youtube.com/watch?v=${video.videoId}`,
      requestedBy:uid,
      requestedName:(await rtdb.ref(`directory/${uid}/nome`).once('value')).val()||'Participante',
      createdAt,
      startedAt:queueEntries.length?null:createdAt,
      durationSec:Math.max(0,Number(video.seconds||0)),
      cost,
      included:cost===0,
      sourceJobId:String(jobId||'')
    };
    const patch={};
    patch[`watchRooms/${roomCode}/musicQueue/${qref.key}`]=item;
    patch[`watchRooms/${roomCode}/musicAccess/${uid}/used`]=used+1;
    patch[`watchRooms/${roomCode}/musicAccess/${uid}/lastAddedAt`]=createdAt;
    await rtdb.ref().update(patch);
    await syncAccount(uid,jid).catch(()=>{});
    return{item,cost,premium,used:used+1,includedRemaining:premium?null:Math.max(0,10-(used+1))};
  }
  async function startNextWatchMusic(roomCode,room){
    const entries=Object.entries(room?.musicQueue||{}).sort((a,b)=>Number(a[1]?.createdAt||0)-Number(b[1]?.createdAt||0));
    if(!entries.length)return null;
    const [nextId,next]=entries[0];
    if(!Number(next?.startedAt||0))await rtdb.ref(`watchRooms/${roomCode}/musicQueue/${nextId}/startedAt`).set(Date.now());
    return nextId;
  }
  async function processWatchMusicSkip(uid,data){
    const roomCode=String(data.roomCode||'').trim().toUpperCase();
    const roomSn=await rtdb.ref(`watchRooms/${roomCode}`).once('value');if(!roomSn.exists())throw new Error('Sala não encontrada.');
    const room=roomSn.val();if(room.meta?.ownerUid!==uid)throw new Error('Somente o host pode pular a música.');
    const entries=(await compactWatchMusicQueue(roomCode,room.musicQueue||{})).map(x=>[x.id,x]);
    if(!entries.length)return{skipped:false};
    const currentId=entries[0][0];
    await rtdb.ref(`watchRooms/${roomCode}/musicQueue/${currentId}`).remove();
    const fresh=(await rtdb.ref(`watchRooms/${roomCode}`).once('value')).val()||{};
    const nextId=await startNextWatchMusic(roomCode,fresh);
    return{skipped:true,currentId,nextId};
  }
  async function processWatchMusicAdvance(uid,data){
    const roomCode=String(data.roomCode||'').trim().toUpperCase(),currentId=String(data.currentId||'').trim();
    if(!roomCode||!currentId)return{advanced:false};
    const room=await watchMusicRoomState(roomCode,uid);
    const entries=(await compactWatchMusicQueue(roomCode,room.musicQueue||{})).map(x=>[x.id,x]);
    if(!entries.length||entries[0][0]!==currentId)return{advanced:false};
    await rtdb.ref(`watchRooms/${roomCode}/musicQueue/${currentId}`).remove();
    const fresh=(await rtdb.ref(`watchRooms/${roomCode}`).once('value')).val()||{};
    const nextId=await startNextWatchMusic(roomCode,fresh);
    return{advanced:true,nextId};
  }

  async function writeResult(uid,jobId,type,payload){const rr=rtdb.ref(`siteBridgeResults/${uid}/${jobId}`);await rr.set({ok:true,type,createdAt:now(),...payload});const timer=setTimeout(()=>rr.remove().catch(()=>{}),10*60*1000);timer.unref?.();}
  async function writeError(uid,jobId,type,e){const msg=String(e?.message||'Erro no bridge');await rtdb.ref(`siteBridgeResults/${uid}/${jobId}`).set({ok:false,type,error:msg,createdAt:now()}).catch(()=>{});await rtdb.ref(`charlottePublic/${uid}/lastError`).set(msg).catch(()=>{});}
  async function claimSiteBridgeJob(uid,jobId){
    const jobRef=rtdb.ref(`siteBridgeJobs/${uid}/${jobId}`);
    const startedAt=Date.now();
    const tx=await jobRef.transaction(current=>{
      if(!current||typeof current!=='object')return;
      const owner=String(current.__processingBy||'');
      const lockedAt=Number(current.__processingAt||0);
      // Um job em andamento não pode ser executado por outro listener/instância.
      // Locks antigos podem ser retomados depois de 2 minutos, caso um processo morra.
      if(owner&&Date.now()-lockedAt<120000)return;
      return{...current,__processingBy:bridgeInstanceId,__processingAt:startedAt};
    },undefined,false);
    const value=tx?.snapshot?.val?.()||null;
    return{claimed:!!tx?.committed&&value?.__processingBy===bridgeInstanceId,data:value};
  }
  async function processJobNow(uid,jobId,data){
    const claim=await claimSiteBridgeJob(uid,jobId).catch(e=>{logger.log('[SITE BRIDGE] claim:',e.message);return{claimed:false,data:null}});
    if(!claim.claimed)return;
    data=claim.data||data;
    const type=String(data?.type||'');
    try{
      if(!data||typeof data!=='object')return;
      let payload={};const jid=await linkedJidByUid(uid);const noLink=new Set(['ttt_create','ttt_move','ttt_exit']);if(!jid&&!noLink.has(type))throw new Error('Conta não vinculada.');
      if(type==='sync_pokemon')payload={pokemon:await syncPokemon(uid,jid)};
      else if(type==='sync_account')payload=await syncAccount(uid,jid);
      else if(type==='daily_claim')payload=await processDaily(uid,jid);
      else if(type==='buy_customization')payload=await processBuyCustomization(uid,jid,data);
      else if(type==='equip_customization')payload=await processEquipCustomization(uid,data);
      else if(type==='premium_checkout')payload=await processPremiumCheckout(uid,jid,data);
      else if(type==='send_download_link')payload=await processSendDownload(uid,jid,data);
      else if(type==='youtube_bot_download')payload=await processYoutubeDownload(uid,jid,data);
      else if(type==='pokemon_set_team')payload=await processSetTeam(uid,jid,data);
      else if(type==='pokemon_explore')payload=await processExplore(uid,jid);
      else if(type==='pokemon_wild_move')payload=await processWildMove(uid,jid,data);
      else if(type==='pokemon_wild_exit')payload=await processWildExit(uid);
      else if(type==='pokemon_capture')payload=await processCapture(uid,jid,data);
      else if(type==='pokemon_heal_start')payload=await processHealStart(uid,jid,data);
      else if(type==='duel_challenge')payload=await processChallenge(uid,data);
      else if(type==='duel_accept')payload=await processAccept(uid,data);
      else if(type==='duel_decline')payload=await processDecline(uid,data);
      else if(type==='duel_move')payload=await processMove(uid,data);
      else if(type==='duel_switch')payload=await processDuelSwitch(uid,data);
      else if(type==='duel_exit')payload=await processDuelExit(uid,data);
      else if(type==='ttt_create')payload=await processTttCreate(uid,data);
      else if(type==='ttt_move')payload=await processTttMove(uid,data);
      else if(type==='ttt_exit')payload=await processTttExit(uid,data);
      else if(type==='tinder_feed')payload=await processTinderFeed(uid,jid,data);
      else if(type==='tinder_like')payload=await processTinderLike(uid,jid,data);
      else if(type==='watch_music_activate')payload=await processWatchMusicActivate(uid,jid,data);
      else if(type==='watch_music_add')payload=await processWatchMusicAdd(uid,jid,data,jobId);
      else if(type==='watch_music_skip')payload=await processWatchMusicSkip(uid,data);
      else if(type==='watch_music_advance')payload=await processWatchMusicAdvance(uid,data);
      else throw new Error('Ação do site não permitida.');
      await rtdb.ref(`charlottePublic/${uid}/lastError`).remove().catch(()=>{});await writeResult(uid,jobId,type,payload||{});
    }catch(e){logger.log(`[SITE BRIDGE] job ${type}:`,e.message);await writeError(uid,jobId,type,e)}finally{await rtdb.ref(`siteBridgeJobs/${uid}/${jobId}`).remove().catch(()=>{})}
  }
  function processJob(uid,jobId,data){const prev=userQueues.get(uid)||Promise.resolve(),next=prev.catch(()=>{}).then(()=>processJobNow(uid,jobId,data));userQueues.set(uid,next);next.finally(()=>{if(userQueues.get(uid)===next)userQueues.delete(uid)});return next;}
  function watchUserJobs(uid){if(watchedUsers.has(uid))return;watchedUsers.add(uid);const userRef=rtdb.ref(`siteBridgeJobs/${uid}`),handler=sn=>processJob(uid,sn.key,sn.val());userRef.on('child_added',handler);watchedRefs.set(uid,{userRef,handler});}
  function start(){if(rootWatcher)return;rootWatcher=rtdb.ref('siteBridgeJobs');rootWatcher.on('child_added',sn=>watchUserJobs(sn.key));processDueHealingJobs().catch(()=>{});healingTimer=setInterval(()=>processDueHealingJobs().catch(()=>{}),30000);healingTimer.unref?.();setTimeout(()=>syncLinkedAccounts().catch(()=>{}),5000).unref?.();syncTimer=setInterval(()=>syncLinkedAccounts().catch(()=>{}),180000);syncTimer.unref?.();logger.log('✅ GREMORY SITE BRIDGE ATIVO');}
  function stop(){try{if(rootWatcher)rootWatcher.off()}catch{}for(const{userRef,handler}of watchedRefs.values()){try{userRef.off('child_added',handler)}catch{}}watchedRefs.clear();watchedUsers.clear();rootWatcher=null;if(healingTimer){clearInterval(healingTimer);healingTimer=null;}if(syncTimer){clearInterval(syncTimer);syncTimer=null;}syncingLinked=false;}
  function rawIncomingText(info){
    return String(
      info?.message?.conversation||
      info?.message?.extendedTextMessage?.text||
      info?.message?.imageMessage?.caption||
      info?.message?.videoMessage?.caption||
      ''
    );
  }
  function rawCommandPayload(info,{dropFirstArg=false,fallback=''}={}){
    let raw=rawIncomingText(info);
    if(!raw)return String(fallback||'').trim();
    raw=raw.replace(/^\s*(?:\.#|\.\/|\/|\.|\?)?\S+[ \t]*/,'');
    if(dropFirstArg)raw=raw.replace(/^[ \t]*(?:site|web)\b[ \t]*/i,'');
    return raw.replace(/^\r?\n/,'').trim();
  }
  async function publishAndNotify({text='',imageUrl='',author='Gremory'}={}){
    const post=await publishUpdate({text,imageUrl,author});
    const noticeId=`update_${post.id}`;
    const notice=await notifyAllSiteUsers({
      title:'Nova atualização da Gremory',
      text:post.text||'Uma nova publicação foi adicionada.',
      imageUrl:post.imageUrl||'',
      type:'site_update',
      link:'#updates',
      postId:post.id,
      notificationId:noticeId
    }).catch(e=>({sent:0,error:e.message}));
    return{post,notice}
  }
  async function deletePublishedUpdate(postId){
    const id=String(postId||'').trim();
    if(!id)throw new Error('Informe o ID da publicação.');
    const sn=await rtdb.ref(`siteUpdates/${id}`).once('value');
    if(!sn.exists())throw new Error('Publicação não encontrada.');
    const uids=await siteUserUids();
    const patch={[`siteUpdates/${id}`]:null};
    for(const uid of uids)patch[`siteNotifications/${uid}/update_${id}`]=null;
    await rtdb.ref().update(patch);
    return{id,notificationsRemoved:uids.length};
  }

  async function handleCommand({comando,args=[],q='',sender,enviar,isOwner=false,pushname='',info=null,from=''}={}){
    const cmd=String(comando||'').toLowerCase();
    if(cmd==='vincular'||cmd==='vincularsite'){
      const code=String(args[0]||q||'').trim().toUpperCase();
      if(!code){await enviar('Use: /vincular CODIGO');return true}
      try{await linkAccount(code,sender);await enviar('✅ Conta vinculada. Seu perfil e seus sistemas já podem sincronizar com o site.')}catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(cmd==='syncsite'||cmd==='sincronizarsite'){
      try{const uid=await linkedUidByJid(sender);if(!uid)throw new Error('Vincule primeiro pelo site.');await syncAccount(uid,sender);await enviar('✅ Site sincronizado.')}catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(cmd==='hospitalpokemon'||cmd==='hospitalpoke'){
      try{
        const{user}=pokemonState(sender);const n=Math.max(1,Number(args[0]||Number(user.active||0)+1)),mon=user.monsters[n-1];if(!mon)throw new Error('Pokémon não encontrado. Use /hospitalpokemon número.');
        const uid=await linkedUidByJid(sender).catch(()=>null),r=await startHealing(uid,sender,mon.uid);const mins=Math.max(1,Math.ceil((Number(r.readyAt)-Date.now())/60000));
        await enviar(r.alreadyHealing?`🏥 ${r.name} já está no hospital.\n⏳ Cerca de ${mins} min restantes.`:`🏥 ${r.name} entrou no hospital.\n💰 Custo: ₹${r.cost}\n⏳ Recuperação: cerca de ${mins} min${r.premium?' • Premium':''}.`)
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(['notificar','notificartodos','avisosite'].includes(cmd)){
      if(!isOwner){await enviar('❌ Apenas o dono pode enviar notificações gerais do site.');return true}
      if(String(from||'').endsWith('@g.us')){await enviar('📩 Use esse comando no privado da Charlotte.');return true}
      try{
        const imageUrl=await uploadImageFromMessage(info);
        const result=await notifyAllSiteUsers({
          title:'Aviso da Gremory',
          text:rawCommandPayload(info,{fallback:q}),
          imageUrl,
          type:'admin_notice'
        });
        await enviar(`✅ Notificação enviada para ${result.sent} usuário${result.sent===1?'':'s'} do site.\n\nEla ficará salva no sininho e aparecerá quando a pessoa entrar na conta.`);
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }

    const anuncioSiteExplicito=
      cmd==='anunciosite'||
      cmd==='siteanuncio'||
      (cmd==='anuncio'&&['site','web'].includes(String(args[0]||'').toLowerCase()));

    if(anuncioSiteExplicito){
      if(!isOwner){await enviar('❌ Apenas o dono pode publicar anúncios no site.');return true}
      if(String(from||'').endsWith('@g.us')){await enviar('📰 Use /anuncio site no privado da Charlotte para publicar no feed.');return true}
      try{
        const textoPost=rawCommandPayload(info,{dropFirstArg:cmd==='anuncio',fallback:cmd==='anuncio'?args.slice(1).join(' '):q});
        const imageUrl=await uploadImageFromMessage(info);
        const {post,notice}=await publishAndNotify({text:textoPost,imageUrl,author:pushname||'Gremory'});
        await enviar(`✅ Anúncio publicado e notificação enviada para ${Number(notice?.sent||0)} usuário${Number(notice?.sent||0)===1?'':'s'}.\nID: ${post.id}`);
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }

    if((cmd==='atualizacao'||cmd==='siteupdate')&&isOwner){
      try{
        const imageUrl=await uploadImageFromMessage(info);const textoPost=rawCommandPayload(info,{fallback:q});const {post,notice}=await publishAndNotify({text:textoPost,imageUrl,author:pushname||'Gremory'});
        await enviar(`✅ Atualização publicada e notificação enviada para ${Number(notice?.sent||0)} usuário${Number(notice?.sent||0)===1?'':'s'}.\nID: ${post.id}`);
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    // /anuncio normal permanece como anúncio de grupo.
    // Para o site use /anunciosite ou /anuncio site.
    if(cmd==='anuncio'&&isOwner)return false;
    if(['apagarpublicacao','apagaranuncio','deleteupdate','deletarupdate'].includes(cmd)&&isOwner){
      try{
        const postId=String(args[0]||q||'').trim();
        const result=await deletePublishedUpdate(postId);
        await enviar(`✅ Publicação apagada.\nID: ${result.id}\nAs notificações vinculadas também foram removidas.`)
      }catch(e){await enviar(`❌ ${e.message}`)}
      return true
    }
    if(cmd==='siteban'&&isOwner){
      const uid=String(args[0]||'').trim(),reason=args.slice(1).join(' ').trim()||'Violação das regras';if(!uid){await enviar('Use: /siteban UID motivo');return true}
      await rtdb.ref(`siteBans/${uid}`).set({uid,reason,by:cleanJid(sender),createdAt:Date.now()});await notifySite(uid,{type:'moderation',title:'Conta suspensa',text:reason,sound:false}).catch(()=>{});await enviar(`✅ Conta ${uid} suspensa no site.`);return true
    }
    if(cmd==='siteunban'&&isOwner){
      const uid=String(args[0]||'').trim();if(!uid){await enviar('Use: /siteunban UID');return true}await rtdb.ref(`siteBans/${uid}`).remove();await enviar(`✅ Banimento removido de ${uid}.`);return true
    }
    if(cmd==='sitereports'&&isOwner){
      const sn=await rtdb.ref('siteReports').once('value'),all=Object.entries(sn.val()||{}).map(([id,v])=>({id,...v})).filter(x=>x.status!=='closed').sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
      if(!all.length){await enviar('✅ Nenhuma denúncia aberta.');return true}
      const counts={};for(const x of all)counts[x.targetUid]=Number(counts[x.targetUid]||0)+1;
      const rows=all.slice(0,10);await enviar('🚨 *DENÚNCIAS DO SITE*\n\n'+rows.map(x=>`ID: ${x.id}\nUsuário: ${x.targetUid} (${counts[x.targetUid]} denúncia${counts[x.targetUid]===1?'':'s'})\nCategoria: ${x.category}\nDetalhes: ${String(x.details||'—').slice(0,160)}`).join('\n\n')+'\n\n⚠️ Denúncias recorrentes ficam destacadas para revisão; o banimento continua manual com /siteban.');return true
    }
    return false;
  }
  return{start,stop,handleCommand,syncPokemon,syncAccount,linkAccount,publishUpdate,notifySite,notifyAllSiteUsers,deletePublishedUpdate};
}
module.exports={createGremorySiteBridge};
