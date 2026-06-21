// Config do FRONT (edite aqui se quiser manter em JS)
window.API_BASE = "https://darkstarsapi.online/";
window.GREMORY_CONFIG = window.GREMORY_CONFIG || {};
window.GREMORY_CONFIG.darkstarsApiKey = window.GREMORY_CONFIG.darkstarsApiKey || "gremory";
window.DARKSTARS_API_KEY = window.GREMORY_CONFIG.darkstarsApiKey;

// Também existe /config.json. Se ele existir, o anime-apk.js lê e pode sobrescrever esta key.

window.UPDATES_DEFAULT = [
  { date: "2026-02-28", text: "✅ Novo: Relógio no canto superior direito." },
  { date: "2026-02-28", text: "✅ Pinterest agora baixa direto." },
  { date: "2026-03-01", text: "🛒 local de compra adicionado" },
  { date: "2026-03-27", text: "✅ perfil ajustado" }
];
