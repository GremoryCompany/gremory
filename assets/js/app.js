// Gremory Company • Site (downloads no próprio site)
const LINKS = {
  whatsapp: "https://wa.me/5521973747709",
  discord: "https://discord.gg/DEdUfdKFRR",
  instagram: "https://instagram.com/loserzinn",
  youtube: "https://www.youtube.com/@Loserzinn",
  email: "losermodder@gmail.com"
};

const IMAGE_CATEGORIES = ["shinobu", "megumin", "bully", "cuddle", "cry", "hug", "awoo", "kiss", "lick", "pat", "smug", "bonk", "yeet", "blush", "smile", "wave", "highfive", "handhold", "nom", "bite", "glomp", "slap", "kill", "kick", "happy", "wink", "poke", "dance", "cringe"];

// Estado do modal de imagem (para reiniciar/baixar sem trocar a imagem)
let CURRENT_IMG_TYPE = null;
let CURRENT_IMG_URL = null; // URL original (sem cache-buster)

function guessExtFromUrl(u){
  try{
    const p = new URL(u).pathname;
    const m = p.match(/\.(png|jpe?g|gif|webp)$/i);
    return m ? m[0].toLowerCase() : ".jpg";
  }catch{ return ".jpg"; }
}

function $(id){ return document.getElementById(id); }

function openPanel(panel, open){
  panel.classList.toggle("open", !!open);
}

function openModal(open){
  $("modal").classList.toggle("open", !!open);
  if (!open) {
    $("modalService").innerText = "";
    $("modalHint").innerText = "";
    $("modalInput").value = "";
    $("modalInput").placeholder = "";
    $("modalInputLabel").innerText = "";
    $("modalSend").disabled = false;
    $("modalSend").innerText = "Baixar";
    $("modalStatus").innerHTML = "";
  }
}


function openWikiModal(open){
  const el = $("wikiModal");
  if (!el) return;
  el.classList.toggle("open", !!open);
  el.setAttribute("aria-hidden", open ? "false" : "true");
  if (!open) {
    $("wikiTitle").innerText = "Wikipedia";
    $("wikiBrief").innerText = "";
    $("wikiResumo").innerText = "";
    $("wikiLink").href = "#";
    const img = $("wikiImg");
    if (img) { img.src = ""; img.style.display = "none"; }
  }
}

function openUpdates(open){
  const pop = $("updatesPop");
  if (!pop) return;
  pop.classList.toggle("open", !!open);
}

function openShop(open){
  const el = $("shopModal");
  if (!el) return;
  el.classList.toggle("open", !!open);
  el.setAttribute("aria-hidden", open ? "false" : "true");
}

function safeText(s){
  return (s ?? "").toString();
}


function escapeHtml(value){
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

// As integrações externas sensíveis passam sempre pelo backend.
// O navegador não recebe mais chave privada de provedor.
async function getDarkstarsKey(){ return ""; }
async function darkstarsJson(){
  throw new Error('Acesso direto ao provedor desativado. Use a API do servidor.');
}

function asList(data){
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function pickAnimeName(a){
  return a?.name || a?.title || a?.nome || a?.titulo || 'Anime';
}

function pickAnimeCover(a){
  return a?.cover || a?.image || a?.img || a?.poster || '';
}

function pickEpisodeListFromDetails(data){
  const obj = data?.result && !Array.isArray(data.result) ? data.result : data?.anime || data?.data || data;
  const eps = Array.isArray(obj?.episodes) ? obj.episodes : Array.isArray(obj?.episodios) ? obj.episodios : [];
  return { details: obj || {}, episodes: eps };
}

function nativeAnimeDownload(url, filename){
  if (!url) throw new Error('Link de vídeo inválido');
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noreferrer';
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function setModalResults(html){
  const el = $("modalStatus");
  if (el) el.innerHTML = html;
  const btn = $("modalSend");
  if (btn) btn.disabled = false;
}

const animeDownloadState = { results: [], currentAnime: null, episodes: [], sources: [] };

async function animeSearchLikeBot(query){
  try{
    const data = await postJson('/api/main?action=anime_search', { query });
    return { list: asList(data), warning: data?.warning || '' };
  }catch(e){
    return { list: [], warning: e?.message || String(e) };
  }
}

async function animeEpisodesLikeBot(anime){
  const provider = anime.provider || anime.source || 'animefire';
  const data = await postJson('/api/main?action=anime_eps', {
    url: anime.link || anime.url || '',
    slug: anime.slug || anime.code || anime.id || '',
    provider,
    title: pickAnimeName(anime)
  });
  const details = data?.anime || data?.result || data?.data || {};
  const episodes = Array.isArray(details?.episodes) ? details.episodes : [];
  return {
    details,
    episodes: episodes.map((ep, i) => ({
      title: ep.title || ep.name || ep.nome || `Episódio ${i + 1}`,
      url: ep.url || ep.link || ep.href || '',
      slug: ep.slug || ep.code || ep.id || ep.ep || '',
      provider: ep.provider || details.provider || provider
    })).filter(ep => ep.url || ep.slug)
  };
}

async function animeSourcesLikeBot(ep){
  const provider = ep.provider || 'animefire';
  try{
    const data = await postJson('/api/main?action=anime_stream', {
      url: ep.url || '',
      slug: ep.slug || '',
      provider
    });
    const raw = data?.sources || data?.result || [];
    return (Array.isArray(raw) ? raw : []).map((s, i) => ({
      label: s.label || s.quality || s.resolution || `${i + 1}ª opção`,
      src: s.playUrl || s.url || s.directUrl || s.src || s.originalUrl || '',
      provider: s.provider || provider
    })).filter(s => s.src);
  }catch{
    return [];
  }
}

function renderAnimeSearchResults(list, warning){
  animeDownloadState.results = list;
  if (!list.length){
    setModalResults(`<div class="modal-error">❌ Nenhum anime encontrado.${warning ? `<br><small>${escapeHtml(warning)}</small>` : ''}</div>`);
    return;
  }
  setModalResults(`
    <div class="anime-download-flow">
      ${warning ? `<div class="modal-warning">Aviso: ${escapeHtml(warning)}</div>` : ''}
      <div class="anime-flow-title">Escolha o anime</div>
      <div class="anime-flow-list">
        ${list.slice(0, 20).map((anime, i) => `
          <button type="button" class="anime-flow-item" data-anime-result="${i}">
            ${pickAnimeCover(anime) ? `<img src="${escapeHtml(pickAnimeCover(anime))}" alt="">` : `<span class="anime-flow-noimg">🎬</span>`}
            <span><b>${escapeHtml(pickAnimeName(anime))}</b><small>${escapeHtml(anime.rating || anime.score || anime.audio || anime.provider || '')}</small></span>
          </button>
        `).join('')}
      </div>
    </div>
  `);
  document.querySelectorAll('[data-anime-result]').forEach(btn => btn.addEventListener('click', () => loadAnimeEpisodes(Number(btn.dataset.animeResult))));
}

async function loadAnimeEpisodes(index){
  const anime = animeDownloadState.results[index];
  if (!anime) return;
  animeDownloadState.currentAnime = anime;
  setModalResults('<div class="modal-loading">⏳ Listando episódios...</div>');
  try{
    let data;
    try{
      data = await animeEpisodesLikeBot(anime);
    }catch(e){
      // fallback backend caso CORS bloqueie animefireEp/animesep
      const key = await getDarkstarsKey();
      const b = await postJson('/api/main?action=anime_eps', { url: anime.link || anime.url, slug: anime.slug, provider: anime.provider, title: pickAnimeName(anime), apiKey:key });
      data = { details: b.anime || {}, episodes: b.anime?.episodes || [] };
    }
    const details = data.details || {};
    const eps = data.episodes || [];
    animeDownloadState.episodes = eps;
    if (!eps.length){
      setModalResults('<div class="modal-error">❌ Esse anime não retornou episódios.</div>');
      return;
    }
    const cover = details.cover || pickAnimeCover(anime);
    const title = details.title || details.name || pickAnimeName(anime);
    const meta = [details.audio, details.status, details.year, details.score || details.rating].filter(Boolean).join(' • ');
    setModalResults(`
      <div class="anime-download-flow">
        <button type="button" class="anime-flow-back" id="animeBackResults">← voltar aos resultados</button>
        <div class="anime-flow-details">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}
          <div>
            <div class="anime-flow-title">${escapeHtml(title)}</div>
            ${meta ? `<div class="anime-flow-meta">${escapeHtml(meta)}</div>` : ''}
            ${details.synopsis ? `<p>${escapeHtml(details.synopsis).slice(0, 500)}${String(details.synopsis).length > 500 ? '...' : ''}</p>` : ''}
          </div>
        </div>
        <div class="anime-flow-title">Episódios</div>
        <div class="anime-episode-list">
          ${eps.slice(0, 300).map((ep, i) => `<button type="button" data-anime-ep="${i}">${escapeHtml(ep.title || `Episódio ${i + 1}`)}</button>`).join('')}
        </div>
      </div>
    `);
    $("animeBackResults")?.addEventListener('click', () => renderAnimeSearchResults(animeDownloadState.results));
    document.querySelectorAll('[data-anime-ep]').forEach(btn => btn.addEventListener('click', () => loadAnimeSources(Number(btn.dataset.animeEp))));
  }catch(e){
    setModalResults(`<div class="modal-error">❌ Erro ao listar episódios.<br><small>${escapeHtml(e.message || e)}</small></div>`);
  }
}

async function loadAnimeSources(index){
  const ep = animeDownloadState.episodes[index];
  if (!ep) return;
  setModalResults('<div class="modal-loading">⏳ Preparando link igual ao bot...</div>');
  try{
    const list = await animeSourcesLikeBot(ep);
    animeDownloadState.sources = list;
    if (!list.length){
      setModalResults('<div class="modal-error">❌ Não encontrei link para esse episódio.</div>');
      return;
    }
    setModalResults(`
      <div class="anime-download-flow">
        <button type="button" class="anime-flow-back" id="animeBackEpisodes">← voltar aos episódios</button>
        <div class="anime-flow-title">${escapeHtml(ep.title || 'Episódio')}</div>
        <div class="anime-flow-meta">Escolha a qualidade para abrir/baixar. O link é o mesmo retorno do animefireDow/animesver.</div>
        <div class="anime-source-list">
          ${list.map((s, i) => `
            <button type="button" class="anime-source-btn" data-anime-source="${i}">
              <i class="fa-solid fa-download"></i> Baixar ${escapeHtml(s.label || `${i + 1}ª opção`)}
            </button>
          `).join('')}
        </div>
      </div>
    `);
    $("animeBackEpisodes")?.addEventListener('click', () => {
      const idx = animeDownloadState.results.indexOf(animeDownloadState.currentAnime);
      loadAnimeEpisodes(Math.max(0, idx));
    });
    document.querySelectorAll('[data-anime-source]').forEach(btn => btn.addEventListener('click', () => {
      const s = animeDownloadState.sources[Number(btn.dataset.animeSource)];
      const baseName = (ep.title || 'episodio').replace(/[\\/:*?"<>|]+/g, '-');
      nativeAnimeDownload(s.src, `${baseName}-${String(s.label || 'video').replace(/\W+/g, '')}.mp4`);
    }));
  }catch(e){
    setModalResults(`<div class="modal-error">❌ Erro ao preparar o episódio.<br><small>${escapeHtml(e.message || e)}</small></div>`);
  }
}

async function handleAnimeDownloadSearch(query){
  setBusy(true, 'Pesquisando anime...');
  try{
    const { list, warning } = await animeSearchLikeBot(query);
    setBusy(false);
    renderAnimeSearchResults(list, warning);
  }catch(e){
    setBusy(false);
    setModalResults(`<div class="modal-error">❌ Erro ao pesquisar anime.<br><small>${escapeHtml(e.message || e)}</small></div>`);
  }
}

async function handleApkSearch(query){
  setBusy(true, 'Pesquisando APK...');
  try{
    const data = await postJson('/api/main?action=apk_search', { query });
    const list = data.result || [];
    setBusy(false);
    if (!list.length){
      setModalResults('<div class="modal-error">❌ Nenhum APK encontrado.</div>');
      return;
    }
    setModalResults(`
      <div class="anime-download-flow">
        <div class="anime-flow-title">Escolha o APK</div>
        <div class="anime-flow-list">
          ${list.slice(0, 20).map((app, i) => `
            <button type="button" class="anime-flow-item" data-apk-result="${i}">
              ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="">` : `<span class="anime-flow-noimg">🤖</span>`}
              <span><b>${escapeHtml(app.name || 'APK')}</b><small>${escapeHtml([app.version ? 'v' + app.version : '', app.size || '', app.package || ''].filter(Boolean).join(' • '))}</small></span>
            </button>`).join('')}
        </div>
      </div>
    `);
    document.querySelectorAll('[data-apk-result]').forEach(btn => btn.addEventListener('click', async () => {
      const app = list[Number(btn.dataset.apkResult)];
      try{
        setModalResults('<div class="modal-loading">⏳ Preparando APK...</div>');
        const d = await postJson('/api/main?action=apk_download', { url: app.downloadUrl, name: app.name, package: app.package });
        await startDownload(d.downloadUrl, d.filename);
        setModalResults('<div class="modal-ok">✅ Download iniciado.</div>');
      }catch(e){
        setModalResults(`<div class="modal-error">❌ Falha ao baixar APK.<br><small>${escapeHtml(e.message || e)}</small></div>`);
      }
    }));
  }catch(e){
    setBusy(false);
    setModalResults(`<div class="modal-error">❌ Erro ao pesquisar APK.<br><small>${escapeHtml(e.message || e)}</small></div>`);
  }
}

async function postJson(url, body){
  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
  const res = await fetch(API_BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(data.erro || "Falha na requisição");
  return data;
}

function setBusy(busy, text){
  $("modalSend").disabled = !!busy;
  $("modalStatus").innerText = busy ? (text || "Processando...") : "";
}

function startDownload(downloadUrl, filename){
  if (!downloadUrl) throw new Error("Link de download inválido");

  const isSameOrigin = (() => {
    try{
      if (downloadUrl.startsWith("/")) return true;
      const u = new URL(downloadUrl, window.location.href);
      return u.origin === window.location.origin;
    }catch{ return false; }
  })();

  // Para links do mesmo domínio, baixa via Blob (força download sempre).
  if (isSameOrigin) {
    return fetch(downloadUrl)
      .then(r => {
        if (!r.ok) throw new Error("Falha ao baixar arquivo");
        return Promise.all([r.blob(), r.headers.get("content-disposition")]);
      })
      .then(([blob, cd]) => {
        let name = filename;
        if (!name && cd) {
          const m = cd.match(/filename="(.+?)"/i);
          if (m) name = m[1];
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      })
      .catch(() => {
        // fallback
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.target = "_blank";
        if (filename) a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  }

  // Cross-origin: usa proxy no servidor (mesmo domínio) para forçar download sem abrir outra aba
  const prox = `/api/main?action=proxy&url=${encodeURIComponent(downloadUrl)}${filename ? `&filename=${encodeURIComponent(filename)}` : ""}`;
  return fetch(prox)
    .then(r => {
      if (!r.ok) throw new Error("Falha ao baixar arquivo");
      return Promise.all([r.blob(), r.headers.get("content-disposition")]);
    })
    .then(([blob, cd]) => {
      let name = filename;
      if (!name && cd) {
        const m = cd.match(/filename="(.+?)"/i);
        if (m) name = m[1];
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    });
}

window.startDownload = startDownload;

document.addEventListener("DOMContentLoaded", () => {
  // Panels
  const downloadsBtn = $("downloadsBtn");
  const downloadsPanel = $("downloadsPanel");
  const closeDownloads = $("closeDownloads");

  downloadsBtn.addEventListener("click", () => openPanel(downloadsPanel, true));
  closeDownloads.addEventListener("click", () => openPanel(downloadsPanel, false));

  const supportBtn = $("supportBtn");
  const supportPanel = $("supportPanel");
  const closeSupport = $("closeSupport");

  supportBtn.addEventListener("click", () => openPanel(supportPanel, true));
  closeSupport.addEventListener("click", () => openPanel(supportPanel, false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      openPanel(downloadsPanel, false);
      openPanel(supportPanel, false);
      openModal(false);
      openWikiModal(false);
      openShop(false);
      // image modal
      const imgM = $("imgModal");
      if (imgM && imgM.classList.contains("open")) imgM.classList.remove("open");
    }
  });

  document.addEventListener("click", (e) => {
    const insideDownloads = downloadsPanel.contains(e.target) || downloadsBtn.contains(e.target);
    const insideSupport = supportPanel.contains(e.target) || supportBtn.contains(e.target);
    const insideModal = $("modalBox").contains(e.target);
    const shopBox = $("shopBox");
    const insideShop = (shopBox && shopBox.contains(e.target)) || $("shopBtn")?.contains(e.target);
    if (!insideDownloads) openPanel(downloadsPanel, false);
    if (!insideSupport) openPanel(supportPanel, false);
    if ($("modal").classList.contains("open") && !insideModal && !e.target.classList.contains("service")) openModal(false);
    if ($("shopModal")?.classList.contains("open") && !insideShop) openShop(false);
  });

  // Social links
  $("linkWhats").href = LINKS.whatsapp;
  $("linkDiscord").href = LINKS.discord;
  $("linkInsta").href = LINKS.instagram;
  $("linkYoutube").href = LINKS.youtube;

  // Clock
  function initClock(){
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const now = new Date();
      if ($("clockTime")) $("clockTime").innerText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      if ($("clockDate")) $("clockDate").innerText = now.toLocaleDateString("pt-BR");
    };
    tick();
    setInterval(tick, 1000);
  }

  // Updates (sininho)
  function loadUpdates(){
    return Array.isArray(window.UPDATES_DEFAULT) ? window.UPDATES_DEFAULT : [];
  }

  function saveUpdates(){
    // As atualizações oficiais não são mais alteradas pelo navegador do usuário.
  }

  function renderUpdates(){
    const list = loadUpdates();
    const box = $("updatesList");
    if (!box) return;

    const badge = $("updatesBadge");
    if (badge){
      const n = list.length;
      badge.hidden = n === 0;
      badge.innerText = n > 99 ? "99+" : String(n);
    }

    if (list.length === 0){
      box.innerHTML = '<div style="opacity:.8;font-size:13px;">Sem atualizações por enquanto.</div>';
      return;
    }

    box.innerHTML = "";
    list.slice().reverse().forEach((u, idxFromEnd) => {
      const idx = list.length - 1 - idxFromEnd;

      const item = document.createElement("div");
      item.className = "update-item";

      const meta = document.createElement("div");
      meta.className = "update-meta";
      meta.innerHTML = `<span>${safeText(u.date || "")}</span>`;


      const text = document.createElement("div");
      text.className = "update-text";
      text.innerText = safeText(u.text || "");

      item.appendChild(meta);
      item.appendChild(text);

      box.appendChild(item);
    });
  }

  function initUpdates(){
    const btn = $("updatesBtn");
    const close = $("closeUpdates");
    const add = $("addUpdate");

    btn && btn.addEventListener("click", () => {
      const pop = $("updatesPop");
      const open = !pop.classList.contains("open");
      openUpdates(open);
      if (open) renderUpdates();
    });

    close && close.addEventListener("click", () => openUpdates(false));

    add && add.addEventListener("click", () => {
      const text = prompt("Digite a atualização (texto):");
      if (!text) return;
      const list = loadUpdates();
      list.push({ date: new Date().toISOString().slice(0,10), text: text.trim() });
      saveUpdates(list);
      renderUpdates();
      openUpdates(true);
    });

    // Clique fora fecha
    document.addEventListener("click", (e) => {
      const pop = $("updatesPop");
      if (!pop || !pop.classList.contains("open")) return;
      if (pop.contains(e.target) || e.target === btn) return;
      openUpdates(false);
    });

    renderUpdates();
  }

  // Wiki modal close
  function initWikiModal(){
    $("wikiClose")?.addEventListener("click", () => openWikiModal(false));
    $("wikiBackdrop")?.addEventListener("click", () => openWikiModal(false));
  }

  // Image modal
  function openImgModal(open){
    const el = $("imgModal");
    if (!el) return;
    el.classList.toggle("open", !!open);
    el.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open) {
      $("imgTitle").innerText = "Imagem";
      $("imgDesc").innerText = "";
      const img = $("imgPreview");
      if (img) { img.src = ""; img.style.display = "none"; }
    }
  }

  function initImgModal(){
    $("imgClose")?.addEventListener("click", () => openImgModal(false));
    $("imgBackdrop")?.addEventListener("click", () => openImgModal(false));
  }

  initClock();
  initUpdates();
  initWikiModal();
  initImgModal();

  // Shop (carrinho)
  function initShop(){
    const btn = $("shopBtn");
    const close = $("shopClose");
    const backdrop = $("shopBackdrop");

    // Cards (edite aqui quando quiser trocar/adição de bots)
    const bots = [
      {
        title: "Bot de Vendas (Discord)",
        desc: "Tickets privados, catálogo por menus, Pix/QR Code, logs e transcript.",
        price: "Sob consulta",
        waText: "Quero comprar o Bot de Vendas (Discord). Me passa valores e detalhes."
      },
      {
        title: "Bot Whitelist (FiveM)",
        desc: "Aprovação/reprovação por botões, formulário, logs e painel de status.",
        price: "Sob consulta",
        waText: "Quero comprar o Bot de Whitelist (FiveM). Me passa valores e detalhes."
      },
      {
        title: "Bot Automação/Engajamento",
        desc: "Mensagens automáticas, anúncios, lembretes, respostas rápidas e utilidades.",
        price: "Sob consulta",
        waText: "Quero comprar um Bot de Automação/Engajamento. Me passa valores e opções."
      }
    ];

    const premium = [
      { days: 7, price: 5, waText: "Quero Premium Charlotte (7 dias) - R$ 5" },
      { days: 15, price: 10, waText: "Quero Premium Charlotte (15 dias) - R$ 10" },
      { days: 30, price: 22, waText: "Quero Premium Charlotte (30 dias) - R$ 22" }
    ];

    const buildCard = ({ title, desc, price, waText }) => {
      const card = document.createElement("div");
      card.className = "shop-card";

      const t = document.createElement("div");
      t.className = "shop-card-title";
      t.innerText = title;

      const d = document.createElement("div");
      d.className = "shop-card-desc";
      d.innerText = desc;

      const p = document.createElement("div");
      p.className = "shop-card-price";
      p.innerText = price;

      const actions = document.createElement("div");
      actions.className = "shop-card-actions";

      const buy = document.createElement("button");
      buy.className = "btn primary";
      buy.type = "button";
      buy.innerText = "Comprar";
      buy.addEventListener("click", () => {
        const msg = encodeURIComponent(waText);
        const url = LINKS.whatsapp + "?text=" + msg;
        window.open(url, "_blank");
      });

      actions.appendChild(buy);

      card.appendChild(t);
      card.appendChild(d);
      card.appendChild(p);
      card.appendChild(actions);
      return card;
    };

    const botsGrid = $("botsGrid");
    if (botsGrid){
      botsGrid.innerHTML = "";
      bots.forEach(b => botsGrid.appendChild(buildCard(b)));
    }

    const premiumGrid = $("premiumGrid");
    if (premiumGrid){
      premiumGrid.innerHTML = "";
      premium.forEach(pk => {
        premiumGrid.appendChild(buildCard({
          title: `${pk.days} dias`,
          desc: "Acesso premium para a Charlotte.",
          price: `R$ ${pk.price}`,
          waText: pk.waText
        }));
      });
    }

    btn && btn.addEventListener("click", () => openShop(true));
    close && close.addEventListener("click", () => openShop(false));
    backdrop && backdrop.addEventListener("click", () => openShop(false));
  }

  initShop();

  // Tabs (Downloads / Imagens)
  const tabDownloads = $("tabDownloads");
  const tabImagens = $("tabImagens");
  const paneDownloads = $("paneDownloads");
  const paneImagens = $("paneImagens");
  function setTab(which){
    const isDl = which === "downloads";
    tabDownloads?.classList.toggle("active", isDl);
    tabImagens?.classList.toggle("active", !isDl);
    tabDownloads?.setAttribute("aria-selected", isDl ? "true" : "false");
    tabImagens?.setAttribute("aria-selected", !isDl ? "true" : "false");
    paneDownloads?.classList.toggle("active", isDl);
    paneImagens?.classList.toggle("active", !isDl);
  }
  tabDownloads?.addEventListener("click", () => setTab("downloads"));
  tabImagens?.addEventListener("click", () => setTab("imagens"));


  // Support values
  $("supportWhatsValue").innerText = LINKS.whatsapp.replace("https://wa.me/", "+");
  $("supportEmailValue").innerText = LINKS.email;

  $("supportWhatsOpen").addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(LINKS.whatsapp.replace("https://wa.me/",""));
      window.open(LINKS.whatsapp, "_blank");
      $("supportWhatsOpen").innerText = "Abrindo";
      setTimeout(() => ($("supportWhatsOpen").innerText = "Abrir"), 1200);
    }catch{
      alert("Não consegui copiar. Copie manualmente: " + LINKS.whatsapp);
    }
  });

  $("supportEmailCopy").addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(LINKS.email);
      $("supportEmailCopy").innerText = "Copiado";
      setTimeout(() => ($("supportEmailCopy").innerText = "Copiar"), 1200);
    }catch{
      alert("Não consegui copiar. Copie manualmente: " + LINKS.email);
    }
  });

  // Modal events
  $("modalClose").addEventListener("click", () => openModal(false));
  $("modalCancel").addEventListener("click", () => openModal(false));

  let currentService = null;

  function configModal(service){
    currentService = service;

    const config = {
      tiktok: {
        title: "TikTok",
        hint: "Cole o link do TikTok. O download vai iniciar aqui no site.",
        label: "Link do TikTok",
        placeholder: "https://www.tiktok.com/..."
      },
      instagram: {
        title: "Instagram",
        hint: "Cole o link do post/reels. O download vai iniciar aqui no site.",
        label: "Link do Instagram",
        placeholder: "https://www.instagram.com/..."
      },
      spotify: {
        title: "Spotify",
        hint: "Cole o link da música do Spotify. O download vai iniciar aqui no site.",
        label: "Link do Spotify",
        placeholder: "https://open.spotify.com/track/..."
      },
      pinterest: {
        title: "Pinterest",
        hint: "Cole o link do Pin do Pinterest. O download vai iniciar aqui no site.",
        label: "Link do Pinterest",
        placeholder: "https://br.pinterest.com/pin/..." 
      },
      anime: {
        title: "Anime",
        hint: "Digite o nome do anime. Depois escolha o resultado, o episódio e a qualidade para baixar.",
        label: "Nome do anime",
        placeholder: "Ex: Boruto dublado, Naruto, One Piece"
      },
      apk: {
        title: "Baixar APK",
        hint: "Digite o nome do app Android para pesquisar APK.",
        label: "Nome do app",
        placeholder: "Ex: WhatsApp, TikTok, Minecraft"
      },
      wiki: {
        title: "Wikipedia",
        hint: "Digite um termo. Vamos mostrar a imagem e o texto em um popup no centro.",
        label: "Termo de pesquisa",
        placeholder: "Ex: Genshin Impact"
      },
}[service];

    if (!config) return false;

    $("modalService").innerText = config.title;
    $("modalHint").innerText = config.hint;
    $("modalInputLabel").innerText = config.label;
    $("modalInput").placeholder = config.placeholder;
    if ($("modalSend")) {
      $("modalSend").innerText = service === "anime" ? "Pesquisar" : (service === "apk" ? "Pesquisar APK" : (service === "wiki" ? "Buscar" : "Baixar"));
    }

    return true;
  }

  document.querySelectorAll(".service").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = btn.dataset.service;

      // Imagens (anime): abre direto
      if (IMAGE_CATEGORIES.includes(s)) {
        const title = s.charAt(0).toUpperCase() + s.slice(1);
        $("imgTitle").innerText = title;
        $("imgDesc").innerText = "SFW • waifu.pics";

        CURRENT_IMG_TYPE = s;
        CURRENT_IMG_URL = null;

        const load = async () => {
          const img = $("imgPreview");
          if (!img) return;
          img.style.display = "block";
          try{
            const type = s;
            const url = `https://api.waifu.pics/sfw/${type}`;
            const r = await fetch(url, { cache: "no-store" });
            const d = await r.json();
            if (!d || !d.url) throw new Error("Sem imagem");
            CURRENT_IMG_TYPE = type;
            CURRENT_IMG_URL = d.url;
            img.src = d.url + `?t=${Date.now()}`;
          }catch(e){
            // Fallback para 'neko' caso a categoria não exista
            try{
              const r2 = await fetch(`https://api.waifu.pics/sfw/neko`, { cache: "no-store" });
              const d2 = await r2.json();
              if (d2?.url){
                CURRENT_IMG_TYPE = "neko";
                CURRENT_IMG_URL = d2.url;
                img.src = d2.url + `?t=${Date.now()}`;
                if ($("imgDesc")) $("imgDesc").innerText = `Categoria '${s}' indisponível • mostrando 'neko'`;
              }
            }catch(_){}
          }
        };

        load();
        // Reiniciar: busca outra imagem da MESMA categoria atual
        $("imgReload").onclick = (ev) => {
          ev?.preventDefault?.();
          load();
        };

        // Baixar: salva a imagem atual (sem abrir outra guia e sem puxar outra imagem)
        $("imgDownload").onclick = async (ev) => {
          ev?.preventDefault?.();
          ev?.stopPropagation?.();
          if (!CURRENT_IMG_URL) return;
          const ext = guessExtFromUrl(CURRENT_IMG_URL);
          const name = `${CURRENT_IMG_TYPE || "anime"}-${Date.now()}${ext}`;
          await startDownload(CURRENT_IMG_URL, name);
        };
        openImgModal(true);
        return;
      }

      const ok = configModal(s);
      if (!ok) {
        alert("Em breve: " + s);
        return;
      }
      openModal(true);
      $("modalInput").focus();
    });
  });

  $("modalSend").addEventListener("click", async () => {
    try{
      const input = $("modalInput").value.trim();
      if (!input && currentService !== "assado") return alert("Preencha o campo.");

      if (currentService === "anime") {
        await handleAnimeDownloadSearch(input);
        return;
      }

      if (currentService === "apk") {
        await handleApkSearch(input);
        return;
      }

      if (currentService === "wiki") {
        setBusy(true, "Buscando...");
        const r = await postJson("/api/main?action=wiki", { query: input });
        setBusy(false);
        openModal(false);
        // Popup central
        $("wikiTitle").innerText = r?.titulo || "Wikipedia";
        $("wikiBrief").innerText = r?.descricao_breve || "";
        $("wikiResumo").innerText = r?.resumo || r?.text || "Sem resultado.";
        $("wikiLink").href = r?.link || "#";
        const img = $("wikiImg");
        if (img && r?.imagem) { img.src = r.imagem; img.style.display = "block"; }
        else if (img) { img.src = ""; img.style.display = "none"; }
        openWikiModal(true);
        return;
      }

      setBusy(true, "Gerando download...");

      let r;
      if (currentService === "tiktok") {
        r = await postJson("/api/main?action=tiktok", { url: input });
      } else if (currentService === "instagram") {
        r = await postJson("/api/main?action=instagram", { url: input });
      } else if (currentService === "spotify") {
        r = await postJson("/api/main?action=spotify", { url: input });
      } else if (currentService === "pinterest") {
        r = await postJson("/api/main?action=pinterest", { url: input });
      } else {
        throw new Error("Serviço inválido");
      }

      setBusy(false);

      // Inicia download
      await startDownload(r.downloadUrl, r.filename);

      // Feedback
      $("modalStatus").innerText = "✅ Pronto! O download foi iniciado.";

    }catch(e){
      setBusy(false);
      alert("❌ " + (e?.message || "Erro"));
    }
  });
});


