// Gremory Company • Site (downloads no próprio site)
const LINKS = {
  whatsapp: "https://wa.me/5521973747709",
  discord: "https://discord.gg/DEdUfdKFRR",
  instagram: "https://instagram.com/loserzinn",
  youtube: "https://www.youtube.com/@Loserzinn",
  email: "losermodder@gmail.com"
};

const IMAGE_CATEGORIES = ["shinobu", "megumin", "bully", "cuddle", "cry", "hug", "awoo", "kiss", "lick", "pat", "smug", "bonk", "yeet", "blush", "smile", "wave", "highfive", "handhold", "nom", "bite", "glomp", "slap", "kill", "kick", "happy", "wink", "poke", "dance", "cringe"];

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
    $("modalStatus").innerText = "";
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
    try{
      const raw = localStorage.getItem("gremory_updates");
      if (raw) return JSON.parse(raw);
    }catch{}
    return Array.isArray(window.UPDATES_DEFAULT) ? window.UPDATES_DEFAULT : [];
  }

  function saveUpdates(list){
    try{ localStorage.setItem("gremory_updates", JSON.stringify(list)); }catch{}
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

      const del = document.createElement("button");
      del.className = "icon-btn update-del";
      del.title = "Remover";
      del.innerHTML = '<i class="fa-solid fa-trash"></i>';
      del.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const next = loadUpdates();
        next.splice(idx, 1);
        saveUpdates(next);
        renderUpdates();
      });

      meta.appendChild(del);

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
        hint: "Digite o nome da música. Vamos gerar o link e iniciar o download.",
        label: "Nome da música",
        placeholder: "Ex: Starboy"
      },
      pinterest: {
        title: "Pinterest",
        hint: "Cole o link do Pin do Pinterest. O download vai iniciar aqui no site.",
        label: "Link do Pinterest",
        placeholder: "https://br.pinterest.com/pin/..." 
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

        const load = async () => {
          const img = $("imgPreview");
          const dl = $("imgDownload");
          if (!img) return;
          img.style.display = "block";
          try{
            const type = s;
            const url = `https://api.waifu.pics/sfw/${type}`;
            const r = await fetch(url, { cache: "no-store" });
            const d = await r.json();
            if (!d || !d.url) throw new Error("Sem imagem");
            img.src = d.url + `?t=${Date.now()}`;
            if (dl) dl.href = d.url;
          }catch(e){
            // Fallback para 'neko' caso a categoria não exista
            try{
              const r2 = await fetch(`https://api.waifu.pics/sfw/neko`, { cache: "no-store" });
              const d2 = await r2.json();
              if (d2?.url){
                img.src = d2.url + `?t=${Date.now()}`;
                if ($("imgDesc")) $("imgDesc").innerText = `Categoria '${s}' indisponível • mostrando 'neko'`;
                if (dl) dl.href = d2.url;
              }
            }catch(_){}
          }
        };

        load();
        $("imgReload").onclick = load;
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
        r = await postJson("/api/main?action=spotify", { nome: input });
      } else if (currentService === "pinterest") {
        r = await postJson("/api/main?action=pinterest", { url: input });
      } else {
        throw new Error("Serviço inválido");
      }

      setBusy(false);

      // Inicia download
      await startDownload(r.downloadUrl, r.filename);

      // Feedback
      $("modalStatus").innerText = `✅ Pronto! Se o download não iniciar, abra o link: ${r.downloadUrl}`;

    }catch(e){
      setBusy(false);
      alert("❌ " + (e?.message || "Erro"));
    }
  });
});


