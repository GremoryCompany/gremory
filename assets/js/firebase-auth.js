
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  getDatabase, ref, set, get, child, update
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAs0NwqCy8sDpzICUasrRGyh--PNq-RO84",
  authDomain: "gremory-e4313.firebaseapp.com",
  databaseURL: "https://gremory-e4313-default-rtdb.firebaseio.com",
  projectId: "gremory-e4313",
  storageBucket: "gremory-e4313.firebasestorage.app",
  messagingSenderId: "33477938304",
  appId: "1:33477938304:web:83f29ce0e35dc79ff06a65",
  measurementId: "G-6Q9KFT1CC5"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);
const authModal = $("authModal");
const authBtn = $("authBtn");
const loginTab = $("loginTab");
const registerTab = $("registerTab");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const authFormsWrap = $("authFormsWrap");
const authTabs = $("authTabs");
const authUserBox = $("authUserBox");
const authStatus = $("authStatus");
let currentUserData = null;

function initials(name = "U"){
  return name.trim().split(/\s+/).slice(0,2).map(v => v[0]?.toUpperCase() || "").join("") || "U";
}
function svgAvatar(name){
  const txt = initials(name);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
    '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#6d5cff"/><stop offset="1" stop-color="#13b6ff"/></linearGradient></defs>' +
    '<rect width="160" height="160" rx="80" fill="url(#g)"/>' +
    '<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#ffffff">' + txt + '</text>' +
    '</svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function formatDate(v){
  if (!v) return "--/--/----";
  try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return "--/--/----"; }
}
function setAuthOpen(open){
  if (!authModal) return;
  authModal.classList.toggle("open", !!open);
  authModal.setAttribute("aria-hidden", open ? "false" : "true");
  if (!open) authStatus.textContent = "";
}
function setAuthTab(tab){
  const login = tab === "login";
  loginTab?.classList.toggle("active", login);
  registerTab?.classList.toggle("active", !login);
  loginForm?.classList.toggle("active", login);
  registerForm?.classList.toggle("active", !login);
  authStatus.textContent = "";
}
function showUserPanel(show){
  if (authFormsWrap) authFormsWrap.hidden = !!show;
  if (authTabs) authTabs.hidden = !!show;
  if (authUserBox) authUserBox.hidden = !show;
}
function setProfileInputs(data, user){
  const nome = data?.nome || user?.displayName || "Usuário";
  const avatar = data?.avatar || user?.photoURL || svgAvatar(nome);
  $("authUserAvatar").src = avatar;
  $("authUserName").textContent = nome;
  $("authUserEmail").textContent = user?.email || data?.email || "";
  $("authUserPremium").textContent = data?.premium ? "Premium" : "Padrão";
  $("authUserCreatedAt").textContent = formatDate(data?.createdAt);
  $("authUserUid").textContent = user?.uid || "";

  $("profilePhotoUrl").value = data?.avatar || "";
  $("profileApiKey").value = data?.apiKey || "";
  $("profileWebsite").value = data?.website || "";
  $("profileYoutube").value = data?.youtube || "";
  $("profileInstagram").value = data?.instagram || "";
}
function traduzErro(err){
  const code = err?.code || "";
  const msg = err?.message || "";
  if (msg && !String(code).startsWith("auth/")) return msg;
  const mapa = {
    "auth/email-already-in-use": "Esse email já está em uso.",
    "auth/invalid-email": "Email inválido.",
    "auth/missing-password": "Digite sua senha.",
    "auth/weak-password": "A senha é muito fraca.",
    "auth/invalid-credential": "Email ou senha incorretos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde."
  };
  return mapa[code] || "Não foi possível concluir a ação.";
}
function bindLiveAvatarPreview(){
  $("profilePhotoUrl")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val) $("authUserAvatar").src = val;
  });
}

authBtn?.addEventListener("click", () => {
  if (currentUserData?.user) {
    showUserPanel(true);
  } else {
    setAuthTab("login");
    showUserPanel(false);
  }
  setAuthOpen(true);
});
$("authClose")?.addEventListener("click", () => setAuthOpen(false));
$("authBackdrop")?.addEventListener("click", () => setAuthOpen(false));
loginTab?.addEventListener("click", () => setAuthTab("login"));
registerTab?.addEventListener("click", () => setAuthTab("register"));

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  authStatus.textContent = "Entrando...";
  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    await signInWithEmailAndPassword(auth, email, password);
    authStatus.textContent = "Login realizado com sucesso.";
  } catch (err) {
    authStatus.textContent = traduzErro(err);
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  authStatus.textContent = "Criando conta...";
  try {
    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;
    const password2 = $("registerPassword2").value;

    if (!name) throw new Error("Digite seu nome.");
    if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== password2) throw new Error("As senhas não coincidem.");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const createdAt = new Date().toISOString();
    const avatar = svgAvatar(name);

    await set(ref(db, "users/" + cred.user.uid), {
      uid: cred.user.uid,
      nome: name,
      email,
      avatar,
      createdAt,
      premium: false,
      apiKey: "",
      website: "",
      youtube: "",
      instagram: ""
    });

    authStatus.textContent = "Conta criada com sucesso.";
  } catch (err) {
    authStatus.textContent = traduzErro(err);
  }
});

$("resetPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) {
    authStatus.textContent = "Digite seu email para recuperar a senha.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    authStatus.textContent = "Email de recuperação enviado.";
  } catch (err) {
    authStatus.textContent = traduzErro(err);
  }
});

$("saveProfileBtn")?.addEventListener("click", async () => {
  if (!currentUserData?.user) return;
  const user = currentUserData.user;
  const dbRef = ref(db, "users/" + user.uid);
  const payload = {
    avatar: $("profilePhotoUrl").value.trim() || svgAvatar(user.displayName || "Usuário"),
    apiKey: $("profileApiKey").value.trim(),
    website: $("profileWebsite").value.trim(),
    youtube: $("profileYoutube").value.trim(),
    instagram: $("profileInstagram").value.trim()
  };

  try {
    await update(dbRef, payload);
    currentUserData.dbData = { ...(currentUserData.dbData || {}), ...payload };
    setProfileInputs(currentUserData.dbData, user);
    authStatus.textContent = "Perfil salvo com sucesso.";
  } catch (err) {
    authStatus.textContent = "Não foi possível salvar o perfil.";
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    authStatus.textContent = "";
    setAuthTab("login");
    showUserPanel(false);
    setAuthOpen(false);
  } catch {}
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    let dbData = null;
    try {
      const snap = await get(child(ref(db), "users/" + user.uid));
      if (snap.exists()) dbData = snap.val();
    } catch {}
    currentUserData = { user, dbData };
    setProfileInputs(dbData, user);
    authBtn.textContent = "Minha conta";
    showUserPanel(true);
    setTimeout(() => setAuthOpen(false), 500);
  } else {
    currentUserData = null;
    authBtn.textContent = "Entrar";
    showUserPanel(false);
    setAuthTab("login");
    setTimeout(() => setAuthOpen(true), 200);
  }
});

bindLiveAvatarPreview();
