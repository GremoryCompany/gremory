(function(){
  const $ = (id) => document.getElementById(id);
  const API_BASE = () => (window.API_BASE || '').replace(/\/$/, '');
  const cache = new Map();
  let homeLoaded = false;
  let currentAnime = null;
  let currentEpisode = null;
  let currentSources = [];
  let currentSource = null;

  const rows = [
    {
      id: 'popular',
      title: 'Mais pesquisados globalmente',
      desc: 'Cards carregados pela mesma API de anime usada no bot.',
      items: ['Solo Leveling', 'One Piece', 'Naruto Shippuden', 'Boruto Naruto Next Generations Dublado', 'Jujutsu Kaisen', 'Dandadan', 'Kimetsu no Yaiba', 'Dragon Ball Daima']
    },
    {
      id: 'recommended',
      title: 'Recomendados para assistir',
      desc: 'Sugestões boas para deixar fixas na tela inicial.',
      items: ['Attack on Titan', 'Black Clover', 'Tokyo Revengers', 'Chainsaw Man', 'Hunter x Hunter', 'Bleach', 'Boku no Hero Academia', 'Spy x Family']
    },
    {
      id: 'dubbed',
      title: 'Dublados e queridinhos',
      desc: 'Busca priorizando versões dubladas quando a API retornar.',
      items: ['Naruto Dublado', 'Boruto Dublado', 'Dragon Ball Super Dublado', 'One Punch Man Dublado', 'Death Note Dublado', 'Nanatsu no Taizai Dublado', 'Blue Lock Dublado']
    }
  ];

  function htmlEscape(value){
    return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function normalizeUrl(url){
    let value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('//')) value = 'https:' + value;
    return value;
  }

  function mediaProxyUrl(url){
    const clean = normalizeUrl(url);
    if (!clean) return '';
    return `${API_BASE()}/api/main?action=media_proxy&url=${encodeURIComponent(clean)}`;
  }

  function getApiKey(){
    try{
      const authData = window.gremoryAuthGetUser?.();
      const k = authData?.dbData?.apiKey || $('profileApiKey')?.value || localStorage.getItem('gremory_dark_apikey') || '';
      return String(k || '').trim();
    }catch{ return ''; }
  }

  async function post(action, body = {}){
    const payload = { ...body };
    const apiKey = getApiKey();
    if (apiKey && !payload.apikey) payload.apikey = apiKey;
    const res = await fetch(`${API_BASE()}/api/main?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'Falha na requisição');
    return data;
  }

  function userName(){
    try{
      const data = window.gremoryAuthGetUser?.();
      return data?.dbData?.nome || data?.user?.displayName || $('profileDisplayName')?.value || 'Visitante';
    }catch{ return 'Visitante'; }
  }

  function recordActivity(action, points = 1){
    const key = 'gremory_local_activity';
    let local = { nome: userName(), total: 0, activity: {} };
    try{ local = { ...local, ...(JSON.parse(localStorage.getItem(key) || '{}')) }; }catch{}
    local.nome = userName();
    local.total = Number(local.total || 0) + Number(points || 1);
    local.activity = local.activity || {};
    local.activity[action] = Number(local.activity[action] || 0) + 1;
    local.activity.lastAction = action;
    local.activity.lastAt = new Date().toISOString();
    try{ localStorage.setItem(key, JSON.stringify(local)); }catch{}
    try{ window.gremoryRecordActivity?.(action, points); }catch{}
  }

  function setScreen(name){
    const map = {
      home: 'streamScreenHome',
      anime: 'streamScreenAnime',
      details: 'streamScreenDetails',
      player: 'streamScreenPlayer',
      apps: 'streamScreenApps',
      ranking: 'streamScreenRanking'
    };
    Object.values(map).forEach(id => $(id)?.classList.remove('active'));
    $(map[name] || map.home)?.classList.add('active');
    document.querySelectorAll('.stream-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.streamScreen === name || (name === 'details' && btn.dataset.streamScreen === 'anime') || (name === 'player' && btn.dataset.streamScreen === 'anime'));
    });
    if (name === 'ranking') renderRanking('rankingList');
    if (name === 'home') loadHome();
  }

  function openStream(screen = 'home'){
    const app = $('gremoryStream');
    if (!app) return;
    app.classList.add('open');
    app.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setScreen(screen);
    if (screen === 'apps') setTimeout(() => $('apkSearchInput')?.focus(), 80);
    if (screen === 'anime') setTimeout(() => $('animeSearchInput')?.focus(), 80);
  }

  function closeStream(){
    const app = $('gremoryStream');
    if (!app) return;
    app.classList.remove('open');
    app.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    const video = $('animeVideo');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  function coverHtml(src, title){
    const img = normalizeUrl(src);
    if (img) return `<img src="${htmlEscape(img)}" alt="${htmlEscape(title)}" loading="lazy" onerror="this.remove();">`;
    return '<i class="fa-solid fa-clapperboard"></i>';
  }

  function cardTemplate(item, fallbackName = ''){
    const title = item?.title || item?.name || fallbackName || 'Anime';
    const meta = [item?.rating ? `⭐ ${item.rating}` : '', item?.audio || '', item?.year || ''].filter(Boolean).join(' • ') || 'Clique para ver episódios';
    return `<div class="anime-cover">${coverHtml(item?.cover, title)}</div><div class="anime-card-info"><div class="anime-card-title">${htmlEscape(title)}</div><div class="anime-card-meta">${htmlEscape(meta)}</div></div>`;
  }

  async function resolveAnime(query){
    const key = String(query || '').toLowerCase().trim();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);
    const p = post('anime_search', { query }).then(data => {
      const list = Array.isArray(data.result) ? data.result : [];
      const q = key.replace(/dublado/g, '').trim();
      const selected = list.find(x => String(x.title || x.name || '').toLowerCase().includes(q)) || list[0] || { title: query, name: query, cover: '', link: '' };
      return { ...selected, cover: normalizeUrl(selected.cover), link: normalizeUrl(selected.link) };
    }).catch(() => ({ title: query, name: query, cover: '', link: '' }));
    cache.set(key, p);
    return p;
  }

  function renderHomeRowsSkeleton(){
    const box = $('animeRows');
    if (!box) return;
    box.innerHTML = rows.map(row => `
      <section class="stream-row" data-row="${htmlEscape(row.id)}">
        <div class="stream-row-head"><div><h3>${htmlEscape(row.title)}</h3><p>${htmlEscape(row.desc)}</p></div></div>
        <div class="stream-card-row">
          ${row.items.map(name => `<button class="anime-card" type="button" data-query="${htmlEscape(name)}">${cardTemplate(null, name)}</button>`).join('')}
        </div>
      </section>`).join('');

    box.querySelectorAll('.anime-card').forEach(card => {
      card.addEventListener('click', async () => {
        const query = card.dataset.query;
        const anime = await resolveAnime(query);
        openAnimeDetails(anime, query);
      });
    });
  }

  async function hydrateHomeRows(){
    const cards = Array.from(document.querySelectorAll('#animeRows .anime-card'));
    for (const card of cards){
      const query = card.dataset.query;
      const anime = await resolveAnime(query);
      card.innerHTML = cardTemplate(anime, query);
      if (anime?.link) card.dataset.link = anime.link;
    }
  }

  function loadHome(force = false){
    if (homeLoaded && !force) {
      renderRanking('homeRankingList', 5);
      return;
    }
    homeLoaded = true;
    renderHomeRowsSkeleton();
    renderRanking('homeRankingList', 5);
    hydrateHomeRows();
  }

  function renderSearchResults(list){
    const box = $('animeSearchResults');
    if (!box) return;
    if (!list.length){
      box.innerHTML = '<div class="stream-status">Nenhum anime encontrado.</div>';
      return;
    }
    box.innerHTML = list.map((anime, index) => `
      <button class="anime-card" type="button" data-index="${index}">
        ${cardTemplate(anime)}
      </button>`).join('');
    box.querySelectorAll('.anime-card').forEach(card => {
      card.addEventListener('click', () => openAnimeDetails(list[Number(card.dataset.index)]));
    });
  }

  async function searchAnime(query){
    const status = $('animeSearchStatus');
    if (status) status.textContent = 'Buscando anime...';
    try{
      const data = await post('anime_search', { query });
      const list = Array.isArray(data.result) ? data.result : [];
      renderSearchResults(list);
      if (status) status.textContent = list.length ? `${list.length} resultado(s) encontrado(s).` : 'Nada encontrado.';
      recordActivity('pesquisou anime', 2);
    }catch(e){
      if (status) status.textContent = 'Erro: ' + (e.message || 'não foi possível buscar');
    }
  }

  function renderDetailsShell(anime, loadingText = 'Carregando episódios...'){
    const title = anime?.title || anime?.name || 'Anime';
    const cover = anime?.cover || '';
    $('animeDetails').innerHTML = `
      <div class="anime-details-hero">
        <div class="anime-details-poster">${coverHtml(cover, title)}</div>
        <div class="anime-details-copy">
          <h2>${htmlEscape(title)}</h2>
          <div class="anime-tags">
            ${anime?.rating ? `<span>⭐ ${htmlEscape(anime.rating)}</span>` : ''}
            ${anime?.audio ? `<span>${htmlEscape(anime.audio)}</span>` : ''}
            ${anime?.year ? `<span>${htmlEscape(anime.year)}</span>` : ''}
            ${anime?.status ? `<span>${htmlEscape(anime.status)}</span>` : ''}
          </div>
          <p class="anime-synopsis">${htmlEscape(anime?.synopsis || anime?.alt || 'Escolha um episódio para assistir no player do site.')}</p>
        </div>
      </div>
      <div class="episodes-wrap">
        <div class="stream-row-head"><div><h3>Episódios</h3><p id="episodesStatus">${htmlEscape(loadingText)}</p></div></div>
        <div id="episodesGrid" class="episodes-grid"></div>
      </div>`;
  }

  async function openAnimeDetails(anime, fallbackQuery){
    if (!anime || (!anime.link && fallbackQuery)) anime = await resolveAnime(fallbackQuery);
    currentAnime = anime || { title: fallbackQuery || 'Anime' };
    setScreen('details');
    renderDetailsShell(currentAnime);
    recordActivity('abriu anime', 1);

    if (!currentAnime.link){
      $('episodesStatus').textContent = 'Esse resultado não trouxe link de episódios.';
      return;
    }

    try{
      const data = await post('anime_eps', { url: currentAnime.link });
      const details = data.anime || {};
      currentAnime = { ...currentAnime, ...details };
      renderDetailsShell(currentAnime, `${(details.episodes || []).length} episódio(s) encontrados.`);
      renderEpisodes(details.episodes || []);
    }catch(e){
      $('episodesStatus').textContent = 'Erro ao carregar episódios: ' + (e.message || 'falha');
    }
  }

  function renderEpisodes(episodes){
    const grid = $('episodesGrid');
    if (!grid) return;
    if (!episodes.length){
      grid.innerHTML = '<div class="stream-status">Nenhum episódio retornado pela API.</div>';
      return;
    }
    grid.innerHTML = episodes.map((ep, index) => `
      <button class="episode-card" type="button" data-index="${index}">
        <strong>${htmlEscape(ep.title || `Episódio ${index + 1}`)}</strong>
        <span><i class="fa-solid fa-play"></i> Assistir</span>
      </button>`).join('');
    grid.querySelectorAll('.episode-card').forEach(btn => {
      btn.addEventListener('click', () => openEpisodePlayer(episodes[Number(btn.dataset.index)]));
    });
  }

  function commentKey(){
    const raw = currentEpisode?.url || currentAnime?.url || currentAnime?.link || 'global';
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    return 'gremory_comments_' + Math.abs(hash);
  }

  function loadComments(){
    try{ return JSON.parse(localStorage.getItem(commentKey()) || '[]'); }catch{ return []; }
  }

  function saveComments(list){
    try{ localStorage.setItem(commentKey(), JSON.stringify(list.slice(-80))); }catch{}
  }

  function renderComments(){
    const box = $('commentsList');
    if (!box) return;
    const list = loadComments();
    if (!list.length){
      box.innerHTML = '<div class="stream-status">Sem comentários ainda.</div>';
      return;
    }
    box.innerHTML = list.slice().reverse().map(c => `
      <div class="comment-item">
        <strong>${htmlEscape(c.name)}</strong>
        <span>${htmlEscape(new Date(c.date).toLocaleString('pt-BR'))}</span>
        <p>${htmlEscape(c.text)}</p>
      </div>`).join('');
  }

  function setVideoSource(source){
    currentSource = source ? { ...source, src: normalizeUrl(source.src) } : source;
    const video = $('animeVideo');
    if (video && currentSource?.src){
      video.src = mediaProxyUrl(currentSource.src);
      video.load();
      const playPromise = video.play?.();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
    document.querySelectorAll('#playerSources button').forEach(btn => btn.classList.toggle('active', btn.dataset.src === currentSource?.src));
  }

  async function openEpisodePlayer(ep){
    currentEpisode = ep;
    currentSources = [];
    currentSource = null;
    setScreen('player');
    $('playerTitle').textContent = ep?.title || 'Episódio';
    $('playerDesc').textContent = currentAnime?.title ? `${currentAnime.title} • assista no próprio site` : 'Escolha uma qualidade para assistir.';
    $('playerStatus').textContent = 'Buscando player/download...';
    $('playerSources').innerHTML = '';
    $('animeVideo').removeAttribute('src');
    $('animeVideo').load();
    renderComments();
    recordActivity('abriu episódio', 2);

    try{
      const data = await post('anime_download', { url: ep.url });
      currentSources = (data.sources || data.result || []).map((src, index) => ({
        label: src.label || src.quality || src.resolution || `${index + 1}ª opção`,
        src: normalizeUrl(src.src || src.url || src.link || src.download)
      })).filter(src => src.src);
      if (!currentSources.length) throw new Error('Sem links retornados');
      $('playerSources').innerHTML = currentSources.map((src, index) => `<button type="button" data-index="${index}" data-src="${htmlEscape(src.src)}">${htmlEscape(src.label || `${index + 1}ª opção`)}</button>`).join('');
      $('playerSources').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => setVideoSource(currentSources[Number(btn.dataset.index)]));
      });
      setVideoSource(currentSources[0]);
      $('playerStatus').textContent = 'Player carregado. Se aparecer bloqueio do servidor, use outra qualidade ou o botão Baixar episódio.';
      try{ localStorage.setItem('gremory_continue_anime', JSON.stringify({ anime: currentAnime?.title, episode: ep?.title, at: new Date().toISOString() })); }catch{}
    }catch(e){
      $('playerStatus').textContent = 'Erro ao carregar player: ' + (e.message || 'falha');
    }
  }

  function formatBytes(bytes){
    const n = Number(bytes || 0);
    if (!n) return '';
    const units = ['B','KB','MB','GB'];
    let v = n, i = 0;
    while (v >= 1024 && i < units.length - 1){ v /= 1024; i++; }
    return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function renderApkResults(list){
    const box = $('apkResults');
    if (!box) return;
    if (!list.length){
      box.innerHTML = '<div class="stream-status">Nenhum APK encontrado.</div>';
      return;
    }
    box.innerHTML = list.map((app, index) => `
      <article class="apk-card">
        <div class="apk-card-head">
          <img src="${htmlEscape(app.icon || app.graphic || '')}" alt="${htmlEscape(app.name)}" loading="lazy" onerror="this.src='';this.style.display='none';">
          <div><strong>${htmlEscape(app.name)}</strong><span>${htmlEscape(app.package || 'Pacote não informado')}</span></div>
        </div>
        <span>${[app.version ? 'v' + app.version : '', formatBytes(app.size), app.downloads ? Number(app.downloads).toLocaleString('pt-BR') + ' downloads' : ''].filter(Boolean).join(' • ')}</span>
        <button class="stream-primary" type="button" data-index="${index}"><i class="fa-solid fa-download"></i> Baixar APK</button>
      </article>`).join('');
    box.querySelectorAll('button[data-index]').forEach(btn => {
      btn.addEventListener('click', () => downloadApk(list[Number(btn.dataset.index)]));
    });
  }

  async function searchApk(query){
    const status = $('apkStatus');
    if (status) status.textContent = 'Pesquisando APK...';
    try{
      const data = await post('apk_search', { query });
      const list = Array.isArray(data.result) ? data.result : [];
      renderApkResults(list);
      if (status) status.textContent = list.length ? `${list.length} app(s) encontrado(s).` : 'Nada encontrado.';
      recordActivity('pesquisou apk', 1);
    }catch(e){
      if (status) status.textContent = 'Erro: ' + (e.message || 'não foi possível pesquisar APK');
    }
  }

  async function downloadApk(app){
    if (!app?.downloadUrl){
      alert('Esse resultado não trouxe link direto de download.');
      return;
    }
    const status = $('apkStatus');
    try{
      if (status) status.textContent = 'Preparando download...';
      const data = await post('apk_download', { url: app.downloadUrl, name: app.name, package: app.package });
      await window.startDownload?.(data.downloadUrl, data.filename);
      if (!window.startDownload) window.open(data.downloadUrl, '_blank');
      if (status) status.textContent = '✅ Download iniciado.';
      recordActivity('baixou apk', 3);
    }catch(e){
      if (status) status.textContent = 'Erro ao baixar APK: ' + (e.message || 'falha');
    }
  }

  async function renderRanking(targetId = 'rankingList', limit = 30){
    const box = $(targetId);
    if (!box) return;
    box.innerHTML = '<div class="stream-status">Carregando ranking...</div>';
    let list = [];
    try{
      if (typeof window.gremoryGetRanking === 'function') list = await window.gremoryGetRanking();
    }catch{}
    if (!Array.isArray(list) || !list.length){
      let local = { nome: userName(), total: 0, activity: {} };
      try{ local = { ...local, ...(JSON.parse(localStorage.getItem('gremory_local_activity') || '{}')) }; }catch{}
      list = [local];
    }
    list = list.filter(Boolean).sort((a,b) => Number(b.total || 0) - Number(a.total || 0)).slice(0, limit);
    box.innerHTML = list.map((u, i) => `
      <div class="ranking-item">
        <div class="ranking-pos">#${i + 1}</div>
        <div class="ranking-main"><strong>${htmlEscape(u.nome || u.name || 'Usuário')}</strong><span>${htmlEscape(u.activity?.lastAction || 'Participando da comunidade')}</span></div>
        <div class="ranking-points">${Number(u.total || 0).toLocaleString('pt-BR')} pts</div>
      </div>`).join('');
  }

  function bind(){
    window.openGremoryStream = openStream;
    $('homeAnimeBtn')?.addEventListener('click', () => openStream('home'));
    $('streamClose')?.addEventListener('click', closeStream);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('gremoryStream')?.classList.contains('open')) closeStream(); });

    document.querySelectorAll('.stream-nav-btn').forEach(btn => btn.addEventListener('click', () => setScreen(btn.dataset.streamScreen || 'home')));
    $('heroStartAnime')?.addEventListener('click', () => setScreen('anime'));
    $('animeBackHome')?.addEventListener('click', () => setScreen('home'));
    $('playerBackDetails')?.addEventListener('click', () => setScreen('details'));
    $('refreshRanking')?.addEventListener('click', () => renderRanking('rankingList'));
    $('homeRankingRefresh')?.addEventListener('click', () => renderRanking('homeRankingList', 5));

    $('animeSearchForm')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const q = $('animeSearchInput')?.value.trim();
      if (q) searchAnime(q);
    });
    $('animeGlobalSearch')?.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const q = ev.currentTarget.value.trim();
      if (!q) return;
      $('animeSearchInput').value = q;
      setScreen('anime');
      searchAnime(q);
    });
    $('apkSearchForm')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const q = $('apkSearchInput')?.value.trim();
      if (q) searchApk(q);
    });
    document.querySelectorAll('[data-apk-query]').forEach(btn => btn.addEventListener('click', () => {
      const q = btn.dataset.apkQuery;
      $('apkSearchInput').value = q;
      searchApk(q);
    }));
    $('playerDownload')?.addEventListener('click', async () => {
      if (!currentSource?.src) return alert('Escolha uma qualidade primeiro.');
      const filename = `${currentAnime?.title || 'anime'}-${currentEpisode?.title || 'episodio'}.mp4`.replace(/[\\/:*?"<>|]+/g, '-');
      const sourceUrl = normalizeUrl(currentSource.src);
      await window.startDownload?.(sourceUrl, filename);
      if (!window.startDownload) window.open(sourceUrl, '_blank');
      recordActivity('baixou episódio', 3);
    });
    $('sendComment')?.addEventListener('click', () => {
      const text = $('commentText')?.value.trim();
      if (!text) return;
      const list = loadComments();
      list.push({ name: userName(), text, date: new Date().toISOString() });
      saveComments(list);
      $('commentText').value = '';
      renderComments();
      recordActivity('comentou', 3);
    });
    loadHome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
