// Configuração pública do FRONT.
// Segredos e chaves privadas devem ficar nas Environment Variables da Vercel/Railway.
window.API_BASE = "";
window.GREMORY_CONFIG = window.GREMORY_CONFIG || {};

window.UPDATES_DEFAULT = [
  { date: "2026-10-09", text: "🐉 Novo visual Gremory e navegação responsiva." },
  { date: "2026-10-09", text: "⚡ Área Pokémon reorganizada para as próximas integrações." },
  { date: "2026-10-09", text: "🔐 Login recebeu opção de manter a sessão apenas quando você escolher." }
];


// Personalizações animadas opcionais do perfil.
// Quando um URL for preenchido, o item aparece automaticamente na loja.
window.GREMORY_PROFILE_ASSETS = window.GREMORY_PROFILE_ASSETS || {
  gif_profile_1: { name: 'GIF Especial', url: '', kind: 'gif' },
  sprite_profile_1: { name: 'Sprite Especial', url: '', kind: 'sprite' }
};
