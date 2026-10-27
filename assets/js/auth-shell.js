(function(){
  'use strict';

  const CONFIG={
    apiKey:'AIzaSyAs0NwqCy8sDpzICUasrRGyh--PNq-RO84',
    authDomain:'gremory-e4313.firebaseapp.com',
    databaseURL:'https://gremory-e4313-default-rtdb.firebaseio.com',
    projectId:'gremory-e4313',
    storageBucket:'gremory-e4313.firebasestorage.app',
    messagingSenderId:'33477938304',
    appId:'1:33477938304:web:83f29ce0e35dc79ff06a65',
    measurementId:'G-6Q9KFT1CC5'
  };

  const $=id=>document.getElementById(id);
  const $$=sel=>Array.from(document.querySelectorAll(sel));
  const safeGet=(k,f='')=>{try{const v=localStorage.getItem(k);return v==null?f:v}catch{return f}};
  const safeSet=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
  const safeRemove=k=>{try{localStorage.removeItem(k)}catch{}};
  const status=msg=>{const el=$('authStatus');if(el)el.textContent=String(msg||'')};
  const normalizeUsername=v=>String(v||'').trim().toLowerCase().replace(/^@+/,'');
  const validUsername=v=>/^[a-z][a-z0-9_]{2,19}$/.test(normalizeUsername(v));
  const timeout=(promise,ms=20000,code='AUTH_TIMEOUT')=>{
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(code);e.code=code;reject(e)},ms)})
    ]);
  };

  function setTab(mode){
    const selected=mode==='register'?'register':'login';
    $$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===selected));
    $$('[data-auth-form]').forEach(f=>f.classList.toggle('active',f.dataset.authForm===selected));
    const heading=$('authHeading');if(heading)heading.textContent=selected==='login'?'Bem-vindo':'Criar conta';
    status('');
  }

  function authMessage(err){
    const code=String(err?.code||err?.message||'');
    const map={
      'PANEL_UNAVAILABLE':'O painel n�o carregou. Recarregue a p�gina e verifique sua conex�o.',
      'AUTH_TIMEOUT':'A conexão demorou mais que o esperado. Tente novamente.',
      'DB_TIMEOUT':'O cadastro foi criado, mas o perfil demorou para sincronizar.',
      'auth/email-already-in-use':'Esse e-mail já está em uso.',
      'auth/invalid-email':'E-mail inválido.',
      'auth/weak-password':'Use uma senha com pelo menos 6 caracteres.',
      'auth/invalid-credential':'E-mail ou senha incorretos.',
      'auth/too-many-requests':'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed':'Falha de conexão com o Firebase. Verifique sua internet e tente novamente.',
      'auth/unauthorized-domain':'Este endereço do site ainda não está autorizado no Firebase Authentication.',
      'auth/operation-not-allowed':'O cadastro por e-mail/senha está desativado no Firebase Authentication.',
      'auth/web-storage-unsupported':'O navegador bloqueou o armazenamento local. A sessão continuará temporariamente.',
      'auth/configuration-not-found':'A configuração de autenticação do Firebase não foi encontrada.'
    };
    return map[code]||((code&&code.startsWith('auth/'))?`Não foi possível concluir agora. (${code})`:'Não foi possível concluir agora.');
  }

  // Authentication must wait until the panel can consume the resulting session.
  let panelResolve, panelReject;
  const panelReady=new Promise((resolve,reject)=>{panelResolve=resolve;panelReject=reject});
  panelReady.catch(()=>{});
  window.gremoryPanelReady=()=>panelResolve();
  window.gremoryPanelFailed=err=>{panelReject(err);status('O painel n�o carregou. Recarregue a p�gina e verifique sua conex�o.');};
  async function requirePanel(){
    try{await timeout(panelReady,20000,'PANEL_TIMEOUT')}
    catch{const err=new Error('PANEL_UNAVAILABLE');err.code='PANEL_UNAVAILABLE';throw err}
  }
  let firebasePromise=null;
  function loadFirebase(){
    if(firebasePromise)return firebasePromise;
    firebasePromise=Promise.all([
      import('https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js')
    ]).then(([appMod,authMod,dbMod])=>{
      const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(CONFIG);
      return{app,auth:authMod.getAuth(app),db:dbMod.getDatabase(app),appMod,authMod,dbMod};
    }).catch(err=>{firebasePromise=null;throw err});
    return firebasePromise;
  }

  async function configurePersistence(auth,authMod,remember){
    try{
      await timeout(authMod.setPersistence(auth,remember?authMod.browserLocalPersistence:authMod.inMemoryPersistence),8000,'AUTH_TIMEOUT');
      if(remember)safeSet('gremory:remember','1');else safeRemove('gremory:remember');
    }catch(err){
      try{await timeout(authMod.setPersistence(auth,authMod.inMemoryPersistence),8000,'AUTH_TIMEOUT')}catch{}
      safeRemove('gremory:remember');
      console.warn('[GREMORY AUTH SHELL] Persistência indisponível.',err);
    }
  }

  async function doLogin(form){
    const button=form.querySelector('button[type="submit"]');
    if(button?.disabled)return;
    if(button)button.disabled=true;
    status('Entrando...');
    try{
      await requirePanel();
      const {auth,authMod}=await loadFirebase();
      await configurePersistence(auth,authMod,Boolean($('loginRemember')?.checked));
      await timeout(authMod.signInWithEmailAndPassword(auth,$('loginEmail')?.value.trim()||'',$('loginPassword')?.value||''),20000,'AUTH_TIMEOUT');
      status('Entrando na Gremory...');
    }catch(err){status(authMessage(err))}
    finally{if(button)button.disabled=false}
  }

  async function doRegister(form){
    const button=form.querySelector('button[type="submit"]');
    if(button?.disabled)return;
    const name=$('registerName')?.value.trim()||'';
    const username=normalizeUsername($('registerUsername')?.value||'');
    const email=$('registerEmail')?.value.trim()||'';
    const pass=$('registerPassword')?.value||'';
    const pass2=$('registerPassword2')?.value||'';
    if(!name)return status('Digite seu nome.');
    if(!validUsername(username))return status('Nome de usuário inválido. Use 3–20 caracteres, começando por letra.');
    if(pass.length<6)return status('A senha precisa ter pelo menos 6 caracteres.');
    if(pass!==pass2)return status('As senhas não coincidem.');
    if(button)button.disabled=true;
    status('Criando conta...');
    try{
      await requirePanel();
      const {auth,authMod,db,dbMod}=await loadFirebase();
      await configurePersistence(auth,authMod,Boolean($('registerRemember')?.checked));
      const cred=await timeout(authMod.createUserWithEmailAndPassword(auth,email,pass),20000,'AUTH_TIMEOUT');
      await authMod.updateProfile(cred.user,{displayName:name}).catch(()=>{});
      const stamp=Date.now(),uid=cred.user.uid;
      let usernameOk=true;
      try{
        const snap=await timeout(dbMod.get(dbMod.ref(db,`usernames/${username}`)),8000,'DB_TIMEOUT');
        if(snap.exists()&&snap.val()?.uid!==uid)usernameOk=false;
        else await timeout(dbMod.set(dbMod.ref(db,`usernames/${username}`),{uid,username,updatedAt:stamp}),8000,'DB_TIMEOUT');
      }catch(err){console.warn('[GREMORY AUTH SHELL] Username pendente.',err)}
      const now=new Date().toISOString();
      const profile={uid,nome:name,...(usernameOk?{username,usernameChangedAt:stamp}:{}),avatar:'',bio:'',favoriteAnime:'',email:cred.user.email||email,whatsappSiteNotify:true,raidWhatsappNotify:true,profileSongTitle:'',profileSongUrl:'',profilePlaylistUrl:'',createdAt:now,updatedAt:now};
      const directory={uid,nome:name,...(usernameOk?{username}:{}),avatar:'',bio:'',favoriteAnime:'',profileSongTitle:'',profileSongUrl:'',profilePlaylistUrl:'',style:[],createdAt:now,updatedAt:now};
      Promise.allSettled([
        timeout(dbMod.set(dbMod.ref(db,`profiles/${uid}`),profile),10000,'DB_TIMEOUT'),
        timeout(dbMod.set(dbMod.ref(db,`directory/${uid}`),directory),10000,'DB_TIMEOUT')
      ]).then(results=>{if(results.some(r=>r.status==='rejected'))console.warn('[GREMORY AUTH SHELL] Perfil será ressincronizado depois.')});
      status(usernameOk?'Conta criada. Entrando...':'Conta criada. Depois escolha outro @ no seu perfil.');
    }catch(err){status(authMessage(err))}
    finally{if(button)button.disabled=false}
  }

  async function doReset(){
    const email=$('loginEmail')?.value.trim()||'';
    if(!email)return status('Digite seu e-mail primeiro.');
    status('Enviando recuperação...');
    try{
      await requirePanel();
      const {auth,authMod}=await loadFirebase();
      await timeout(authMod.sendPasswordResetEmail(auth,email),20000,'AUTH_TIMEOUT');
      status('E-mail de recuperação enviado.');
    }catch(err){status(authMessage(err))}
  }

  // Eventos em capture: continuam funcionando mesmo se o app principal falhar antes de registrar listeners.
  document.addEventListener('click',ev=>{
    const tab=ev.target.closest?.('[data-auth-tab]');
    if(tab){ev.preventDefault();ev.stopImmediatePropagation();setTab(tab.dataset.authTab);return}
    const reset=ev.target.closest?.('#resetPasswordBtn');
    if(reset){ev.preventDefault();ev.stopImmediatePropagation();doReset();}
  },true);

  document.addEventListener('submit',ev=>{
    const form=ev.target;
    if(form?.id==='loginForm'){
      ev.preventDefault();ev.stopImmediatePropagation();doLogin(form);return;
    }
    if(form?.id==='registerForm'){
      ev.preventDefault();ev.stopImmediatePropagation();doRegister(form);
    }
  },true);

  // Diagnóstico visível caso o módulo principal não consiga carregar.
  window.addEventListener('error',ev=>{
    const src=String(ev?.filename||'');
    if(src.includes('/assets/js/app.js'))status('O painel principal não carregou. Atualize a página para tentar novamente.');
  });

  window.__GREMORY_AUTH_SHELL__=true;
})();
