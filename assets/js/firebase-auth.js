import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  getDatabase, ref, set, get, update
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
const setText = (id, value) => { const el = $(id); if (el) el.textContent = value ?? ""; };
const setValue = (id, value) => { const el = $(id); if (el) el.value = value ?? ""; };
const setSrc = (id, value) => { const el = $(id); if (el) el.src = value ?? ""; };
const authModal = $("authModal");
const authBtn = $("authBtn");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const authStatus = $("authStatus");
const authGateTitle = $("authGateTitle");
const authGateScreen = $("authGateScreen");
const authAccountView = $("authAccountView");
const accountBg = document.querySelector(".auth-account-bg");
let currentUserData = null;
let hasInteractedAuth = false;

const authPersistenceReady = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return "local";
  } catch {
    try {
      await setPersistence(auth, browserSessionPersistence);
      return "session";
    } catch {
      try {
        await setPersistence(auth, inMemoryPersistence);
        return "memory";
      } catch {
        return "none";
      }
    }
  }
})();

function setSubmitBusy(form, busy){
  if (!form) return;
  form.querySelectorAll("button, input").forEach((el) => {
    if (busy) el.setAttribute("data-was-disabled", el.disabled ? "1" : "0");
    const wasDisabled = el.getAttribute("data-was-disabled") === "1";
    el.disabled = !!busy || wasDisabled;
    if (!busy) el.removeAttribute("data-was-disabled");
  });
}
async function ensurePersistence(){
  try { await authPersistenceReady; } catch {}
}
async function ensureUserProfile(user, overrides = {}){
  if (!user?.uid) return null;
  const userRef = ref(db, "users/" + user.uid);
  let current = null;
  try {
    const snap = await get(userRef);
    if (snap.exists()) current = snap.val();
  } catch {}

  const baseName = overrides.nome || current?.nome || user.displayName || "Usuário";
  const payload = {
    uid: user.uid,
    nome: baseName,
    email: overrides.email || current?.email || user.email || "",
    avatar: overrides.avatar || current?.avatar || user.photoURL || svgAvatar(baseName),
    createdAt: overrides.createdAt || current?.createdAt || new Date(user.metadata?.creationTime || Date.now()).toISOString(),
    premium: typeof overrides.premium === "boolean" ? overrides.premium : !!current?.premium,
    apiKey: overrides.apiKey ?? current?.apiKey ?? "",
    website: overrides.website ?? current?.website ?? "",
    youtube: overrides.youtube ?? current?.youtube ?? "",
    instagram: overrides.instagram ?? current?.instagram ?? "",
    whatsapp: overrides.whatsapp ?? current?.whatsapp ?? current?.zap ?? "",
    wallpaper: overrides.wallpaper ?? current?.wallpaper ?? "",
    saldo: Number(overrides.saldo ?? current?.saldo ?? 50),
    total: Number(overrides.total ?? current?.total ?? 0)
  };

  try {
    if (current) {
      await update(userRef, payload);
    } else {
      await set(userRef, payload);
    }
  } catch {}

  return payload;
}
function setBodyLocked(locked){
  document.body.classList.toggle("auth-locked", !!locked);
}
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
  if (!open && authStatus) authStatus.textContent = "";
}
function showGate(mode = "login"){
  if (authGateScreen) authGateScreen.hidden = false;
  if (authAccountView) authAccountView.hidden = true;
  if (loginForm) loginForm.classList.toggle("active", mode === "login");
  if (registerForm) registerForm.classList.toggle("active", mode === "register");
  if (authGateTitle) authGateTitle.textContent = mode === "login" ? "Login" : "Registro";
  if (authStatus) authStatus.textContent = "";
}
function showAccount(){
  if (authGateScreen) authGateScreen.hidden = true;
  if (authAccountView) authAccountView.hidden = false;
  if (authStatus) authStatus.textContent = "";
}
function sanitizeInstagram(v = ""){
  const raw = v.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^@/, "").replace(/^instagram\.com\//i, "");
  return `https://instagram.com/${clean}`;
}
function sanitizeYoutube(v = ""){
  const raw = v.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}
function sanitizeWebsite(v = ""){
  const raw = v.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}
function sanitizeWhatsapp(v = ""){
  const digits = String(v || "").replace(/\D/g, "");
  return digits;
}
function safeText(v, fallback = "-"){
  return v && String(v).trim() ? String(v).trim() : fallback;
}
function setQuickLink(id, href){
  const el = $(id);
  if (!el) return;
  if (href) {
    el.href = href;
    el.classList.remove("disabled");
    el.setAttribute("aria-disabled", "false");
    el.tabIndex = 0;
  } else {
    el.href = "#";
    el.classList.add("disabled");
    el.setAttribute("aria-disabled", "true");
    el.tabIndex = -1;
  }
}
function applyVisualProfile(data, user){
  const nome = data?.nome || user?.displayName || "Usuário";
  const avatar = data?.avatar || user?.photoURL || svgAvatar(nome);
  const wallpaper = data?.wallpaper || "";

  setSrc("authUserAvatar", avatar);
  setText("authUserName", nome);
  if (wallpaper && accountBg) {
    accountBg.style.backgroundImage = `url("${wallpaper.replace(/"/g, '\\"')}")`;
  } else if (accountBg) {
    accountBg.style.backgroundImage = 'url("/assets/video/login.gif")';
  }
}
function setProfileInputs(data, user){
  const nome = data?.nome || user?.displayName || "Usuário";
  applyVisualProfile(data, user);
  setText("authUserEmail", user?.email || data?.email || "");
  setText("authUserPremium", data?.premium ? "Premium" : "Padrão");
  setText("authUserCreatedAt", formatDate(data?.createdAt || user?.metadata?.creationTime));
  setText("authUserUid", user?.uid || "");
  setText("authUserLevel", String(data?.total ?? 0));
  setText("authUserSaldo", String(data?.saldo ?? 50));
  setValue("profileDisplayName", nome);
  setValue("profilePhotoUrl", data?.avatar || "");
  setValue("profileWallpaper", data?.wallpaper || "");
  setValue("profileApiKey", data?.apiKey || "");
  setValue("profileWebsite", data?.website || "");
  setValue("profileYoutube", data?.youtube || "");
  setValue("profileInstagram", data?.instagram || "");
  setValue("profileWhatsapp", data?.whatsapp || data?.zap || "");

  setQuickLink("profileOpenInstagram", sanitizeInstagram(data?.instagram || ""));
  setQuickLink("profileOpenYoutube", sanitizeYoutube(data?.youtube || ""));
  setQuickLink("profileOpenWebsite", sanitizeWebsite(data?.website || ""));
  setQuickLink("profileOpenWhatsapp", data?.whatsapp || data?.zap ? `https://wa.me/${sanitizeWhatsapp(data?.whatsapp || data?.zap || "")}` : "");
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
function bindLiveProfilePreview(){
  $("profilePhotoUrl")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val) setSrc("authUserAvatar", val);
  });
  $("profileWallpaper")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (accountBg) accountBg.style.backgroundImage = val ? `url("${val.replace(/"/g, '\\"')}")` : 'url("/assets/video/login.gif")';
  });
  $("profileDisplayName")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    setText("authUserName", val || "Usuário");
    if (!$("profilePhotoUrl")?.value.trim()) {
      setSrc("authUserAvatar", svgAvatar(val || "Usuário"));
    }
  });
}

authBtn?.addEventListener("click", () => {
  if (!currentUserData?.user) return;
  showAccount();
  setAuthOpen(true);
});
$("showRegisterLink")?.addEventListener("click", () => showGate("register"));
$("showLoginLink")?.addEventListener("click", () => showGate("login"));
$("authClose")?.addEventListener("click", () => {
  if (!document.body.classList.contains("auth-locked")) setAuthOpen(false);
});
$("authBackdrop")?.addEventListener("click", () => {
  if (!document.body.classList.contains("auth-locked")) setAuthOpen(false);
});

document.querySelectorAll(".profile-link-btn").forEach((link) => {
  link.addEventListener("click", (e) => {
    if (link.classList.contains("disabled")) e.preventDefault();
  });
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hasInteractedAuth = true;
  authStatus.textContent = "Entrando...";
  setSubmitBusy(loginForm, true);
  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    await ensurePersistence();
    await signInWithEmailAndPassword(auth, email, password);
    authStatus.textContent = "Login realizado com sucesso.";
  } catch (err) {
    authStatus.textContent = traduzErro(err);
  } finally {
    setSubmitBusy(loginForm, false);
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hasInteractedAuth = true;
  authStatus.textContent = "Criando conta...";
  setSubmitBusy(registerForm, true);
  try {
    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;
    const password2 = $("registerPassword2").value;
    if (!name) throw new Error("Digite seu nome.");
    if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== password2) throw new Error("As senhas não coincidem.");

    await ensurePersistence();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const avatar = svgAvatar(name);
    await updateProfile(cred.user, { displayName: name, photoURL: avatar }).catch(() => {});
    await ensureUserProfile(cred.user, {
      nome: name,
      email,
      avatar,
      createdAt: new Date().toISOString(),
      premium: false,
      apiKey: "",
      website: "",
      youtube: "",
      instagram: "",
      whatsapp: "",
      wallpaper: "",
      saldo: 50,
      total: 0
    });

    authStatus.textContent = "Conta criada com sucesso.";
    registerForm.reset();
  } catch (err) {
    authStatus.textContent = traduzErro(err);
  } finally {
    setSubmitBusy(registerForm, false);
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
  const nome = $("profileDisplayName").value.trim() || user.displayName || "Usuário";
  const payload = {
    nome,
    avatar: $("profilePhotoUrl").value.trim() || svgAvatar(nome),
    wallpaper: $("profileWallpaper").value.trim(),
    apiKey: $("profileApiKey").value.trim(),
    website: sanitizeWebsite($("profileWebsite").value),
    youtube: sanitizeYoutube($("profileYoutube").value),
    instagram: sanitizeInstagram($("profileInstagram").value),
    whatsapp: sanitizeWhatsapp($("profileWhatsapp").value),
    email: user.email || currentUserData?.dbData?.email || "",
    createdAt: currentUserData?.dbData?.createdAt || new Date().toISOString(),
    saldo: Number(currentUserData?.dbData?.saldo ?? 50),
    total: Number(currentUserData?.dbData?.total ?? 0),
    premium: !!currentUserData?.dbData?.premium
  };
  try {
    await update(dbRef, payload);
    if (user.displayName !== nome) {
      await updateProfile(user, { displayName: nome, photoURL: payload.avatar }).catch(() => {});
    } else {
      await updateProfile(user, { photoURL: payload.avatar }).catch(() => {});
    }
    currentUserData.dbData = { ...(currentUserData.dbData || {}), ...payload };
    setProfileInputs(currentUserData.dbData, user);
    authStatus.textContent = "Perfil salvo com sucesso.";
  } catch {
    authStatus.textContent = "Não foi possível salvar o perfil.";
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    currentUserData = null;
    hasInteractedAuth = false;
    showGate("login");
    setBodyLocked(true);
    setAuthOpen(true);
  } catch {}
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const dbData = await ensureUserProfile(user);
    currentUserData = { user, dbData };
    setProfileInputs(dbData, user);
    authBtn.textContent = safeText(dbData?.nome || user.displayName, "Minha conta");
    setBodyLocked(false);
    setAuthOpen(false);
    return;
  }

  currentUserData = null;
  authBtn.textContent = "Minha conta";
  showGate("login");
  setBodyLocked(true);
  setAuthOpen(true);
});

bindLiveProfilePreview();
showGate("login");
setBodyLocked(true);
setAuthOpen(true);
