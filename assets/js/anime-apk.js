(function(){
  const $ = (id) => document.getElementById(id);
  const API_BASE = () => (window.API_BASE || '').replace(/\/$/, '');
  const cache = new Map();
  let homeLoaded = false;
  let currentAnime = null;
  let currentEpisode = null;
  let currentSources = [];
  let currentSource = null;
  let currentPlayToken = 0;

  const rows = [
    {
      id: 'popular',
      title: 'Mais pesquisados globalmente',
      desc: '',
      items: ['Solo Leveling', 'One Piece', 'Naruto Shippuden', 'Boruto Naruto Next Generations Dublado', 'Jujutsu Kaisen', 'Dandadan', 'Kimetsu no Yaiba', 'Dragon Ball Daima']
    },
    {
      id: 'recommended',
      title: 'Recomendados para assistir',
      desc: '',
      items: ['Attack on Titan', 'Black Clover', 'Tokyo Revengers', 'Chainsaw Man', 'Hunter x Hunter', 'Bleach', 'Boku no Hero Academia', 'Spy x Family']
    },
    {
      id: 'dubbed',
      title: 'Dublados e queridinhos',
      desc: '',
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

  function mediaProxyUrl(url, provider){
    const clean = normalizeUrl(url);
    if (!clean) return '';
    return `${API_BASE()}/api/main?action=media_proxy&url=${encodeURIComponent(clean)}${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`;
  }

  function animeFileUrl(url, filename, provider){
    const clean = normalizeUrl(url);
    if (!clean) return '';
    return `${API_BASE()}/api/main?action=anime_file&url=${encodeURIComponent(clean)}${filename ? `&filename=${encodeURIComponent(filename)}` : ''}${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`;
  }

  function nativeDownload(downloadUrl, filename){
    if (!downloadUrl) throw new Error('Link de download inválido');
    const a = document.createElement('a');
    a.href = downloadUrl;
    if (filename) a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function blobDownload(blob, filename){
    const url = URL.createObjectURL(blob);
    try{
      nativeDownload(url, filename);
    }finally{
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  }

  function parseContentRange(value){
    const match = String(value || '').match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
    if (!match) return null;
    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: match[3] === '*' ? 0 : Number(match[3])
    };
  }

  function setStatus(text){
    const el = $('playerStatus');
    if (el) el.textContent = text;
  }

  async function downloadSourceInChunks(source, filename){
    const base = source?.playUrl || mediaProxyUrl(source?.src || source?.directUrl, source?.provider);
    if (!base) throw new Error('Link do episódio vazio');

    const chunkSize = 2 * 1024 * 1024;
    const parts = [];
    let start = 0;
    let total = 0;
    let safety = 0;

    setStatus('Preparando download do episódio...');

    while (true){
      const end = start + chunkSize - 1;
      const chunkUrl = `${base}${base.includes('?') ? '&' : '?'}range=${encodeURIComponent(`bytes=${start}-${end}`)}`;
      const res = await fetch(chunkUrl);
      if (!(res.ok || res.status === 206)) {
        let msg = '';
        try{ msg = (await res.json())?.erro || ''; }catch{}
        throw new Error(msg || `falha no trecho ${start}`);
      }

      const blob = await res.blob();
      if (!blob.size) break;
      parts.push(blob);

      const range = parseContentRange(res.headers.get('Content-Range'));
      if (range?.total) total = range.total;
      start += blob.size;
      safety += 1;

      if (total) {
        const pct = Math.min(100, Math.floor((start / total) * 100));
        setStatus(`Baixando episódio... ${pct}%`);
      } else {
        setStatus(`Baixando episódio... ${formatBytes(start)}`);
      }

      if (res.status !== 206 && !range) break;
      if (total && start >= total) break;
      if (safety > 2500) throw new Error('download muito grande');
    }

    const type = parts[0]?.type || 'video/mp4';
    blobDownload(new Blob(parts, { type }), filename);
    setStatus('Download concluído.');
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
      video.onerror = null;
      video.oncanplay = null;
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

    const p = post('anime_search', { query })
      .then(data => {
        const list = Array.isArray(data.result) ? data.result : [];
        const q = key.replace(/dublado/g, '').replace(/legendado/g, '').trim();
        const selected =
          list.find(x => normalizeUrl(x.cover) && String(x.title || x.name || '').toLowerCase().includes(q)) ||
          list.find(x => String(x.title || x.name || '').toLowerCase().includes(q)) ||
          list.find(x => normalizeUrl(x.cover) && (x.link || x.slug)) ||
          list.find(x => x.link || x.slug) ||
          null;

        if (!selected) throw new Error('sem resultado');

        const picked = {
          ...selected,
          cover: normalizeUrl(selected.cover),
          link: normalizeUrl(selected.link),
          slug: selected.slug || '',
          provider: selected.provider || selected.source || ''
        };
        if (!picked.cover && (picked.link || picked.slug)) {
          return post('anime_eps', { url: picked.link, slug: picked.slug, provider: picked.provider })
            .then(detailsData => {
              const d = detailsData.anime || {};
              return { ...picked, cover: normalizeUrl(d.cover || picked.cover), rating: picked.rating || d.score || d.rating || '', audio: picked.audio || d.audio || '', year: picked.year || d.year || '' };
            })
            .catch(() => picked);
        }
        return picked;
      })
      .catch(() => {
        cache.delete(key);
        return { title: query, name: query, cover: '', link: '', slug: '' };
      });

    cache.set(key, p);
    const result = await p;
    if (!result.link && !result.slug && !result.cover) cache.delete(key);
    return result;
  }

  function renderHomeRowsSkeleton(){
    const box = $('animeRows');
    if (!box) return;
    box.innerHTML = rows.map(row => `
      <section class="stream-row" data-row="${htmlEscape(row.id)}">
        <div class="stream-row-head"><div><h3>${htmlEscape(row.title)}</h3>${row.desc ? `<p>${htmlEscape(row.desc)}</p>` : ''}</div></div>
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
    const pending = cards.filter(card => card.dataset.loaded !== '1');
    let cursor = 0;

    async function worker(){
      while (cursor < pending.length){
        const card = pending[cursor++];
        const query = card.dataset.query;
        try{
          card.classList.add('loading');
          const anime = await resolveAnime(query);
          if (anime && (anime.cover || anime.link || anime.slug)){
            card.innerHTML = cardTemplate(anime, query);
            card.dataset.loaded = '1';
            if (anime.link) card.dataset.link = anime.link;
            if (anime.slug) card.dataset.slug = anime.slug;
            if (anime.provider) card.dataset.provider = anime.provider;
          }
        }catch(e){
          console.warn('Falha ao carregar card de anime:', query, e);
        }finally{
          card.classList.remove('loading');
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(4, pending.length || 1) }, worker));
  }

  function loadHome(force = false){
    const hasCards = document.querySelectorAll('#animeRows .anime-card').length > 0;
    if (!homeLoaded || force || !hasCards) {
      homeLoaded = true;
      renderHomeRowsSkeleton();
    }
    renderRanking('homeRankingList', 5);
    hydrateHomeRows();
    // Repete depois de um instante para pegar a ApiKey/perfil caso o Firebase ainda esteja carregando.
    setTimeout(hydrateHomeRows, 1200);
    setTimeout(hydrateHomeRows, 3200);
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

    if (!currentAnime.link && !currentAnime.slug){
      $('episodesStatus').textContent = 'Esse resultado não trouxe link/código de episódios.';
      return;
    }

    try{
      const data = await post('anime_eps', {
        url: currentAnime.link,
        slug: currentAnime.slug,
        provider: currentAnime.provider || currentAnime.source
      });
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
    const raw = currentEpisode?.url || currentEpisode?.slug || currentAnime?.url || currentAnime?.link || currentAnime?.slug || 'global';
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
    currentSource = source ? {
      ...source,
      src: normalizeUrl(source.src || source.directUrl),
      directUrl: normalizeUrl(source.directUrl || source.src),
      playUrl: source.playUrl || mediaProxyUrl(source.src || source.directUrl, source.provider),
      downloadUrl: source.downloadUrl || '',
      filename: source.filename || '',
      provider: source.provider || ''
    } : source;

    const video = $('animeVideo');
    if (video && (currentSource?.playUrl || currentSource?.src)){
      const token = ++currentPlayToken;
      const urls = [];
      const pushUrl = (value) => {
        const clean = normalizeUrl(value);
        if (clean && !urls.includes(clean)) urls.push(clean);
      };

      // Primeiro tenta pelo proxy com suporte a Range/chunks. O link direto fica só como plano B.
      pushUrl(currentSource.playUrl || mediaProxyUrl(currentSource.src || currentSource.directUrl, currentSource.provider));
      pushUrl(currentSource.directUrl || currentSource.src);

      let attempt = 0;
      const useAttempt = () => {
        if (token !== currentPlayToken) return;
        const url = urls[attempt];
        if (!url) {
          setStatus('Não consegui transmitir esse episódio. Use o botão de baixar ou escolha outra qualidade.');
          return;
        }
        setStatus(attempt === 0 ? 'Carregando vídeo...' : 'Tentando link alternativo...');
        video.pause();
        video.onerror = null;
        video.oncanplay = null;
        video.onloadedmetadata = null;
        video.removeAttribute('src');
        video.src = url;
        video.load();

        video.onerror = () => {
          if (token !== currentPlayToken) return;
          attempt += 1;
          useAttempt();
        };
        video.onloadedmetadata = () => {
          if (token === currentPlayToken) setStatus('Vídeo carregado. Aperte play para assistir.');
        };
        video.oncanplay = () => {
          if (token === currentPlayToken) setStatus('Pronto para assistir.');
        };
      };

      useAttempt();
    }
    document.querySelectorAll('#playerSources button').forEach(btn => btn.classList.toggle('active', btn.dataset.src === currentSource?.src));
  }

  async function openEpisodePlayer(ep){
    currentEpisode = ep;
    currentSources = [];
    currentSource = null;
    setScreen('player');
    $('playerTitle').textContent = ep?.title || 'Episódio';
    $('playerDesc').textContent = currentAnime?.title ? `${currentAnime.title}` : 'Escolha uma qualidade para assistir.';
    $('playerStatus').textContent = 'Preparando episódio...';
    $('playerSources').innerHTML = '';
    $('animeVideo').removeAttribute('src');
    $('animeVideo').load();
    renderComments();
    recordActivity('abriu episódio', 2);

    try{
      const data = await post('anime_download', {
        url: ep.url,
        slug: ep.slug,
        provider: ep.provider || ep.source || currentAnime?.provider || currentAnime?.source,
        title: ep.title
      });
      currentSources = (data.sources || data.result || []).map((src, index) => ({
        label: src.label || src.quality || src.resolution || `${index + 1}ª opção`,
        src: normalizeUrl(src.src || src.url || src.link || src.download || src.directUrl),
        directUrl: normalizeUrl(src.directUrl || src.src || src.url || src.link || src.download),
        playUrl: src.playUrl || '',
        downloadUrl: src.downloadUrl || '',
        filename: src.filename || '',
        provider: src.provider || data.provider || ''
      })).filter(src => src.src || src.playUrl);
      if (!currentSources.length) throw new Error('Sem links retornados');
      $('playerSources').innerHTML = currentSources.map((src, index) => `<button type="button" data-index="${index}" data-src="${htmlEscape(src.src)}">${htmlEscape(src.label || `${index + 1}ª opção`)}</button>`).join('');
      $('playerSources').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => setVideoSource(currentSources[Number(btn.dataset.index)]));
      });
      setVideoSource(currentSources[0]);
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
      nativeDownload(data.downloadUrl, data.filename);
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
      if (!currentSource?.src && !currentSource?.playUrl) return alert('Escolha uma qualidade primeiro.');
      const filename = (currentSource.filename || `${currentAnime?.title || 'anime'}-${currentEpisode?.title || 'episodio'}.mp4`).replace(/[\/:*?"<>|]+/g, '-');
      try{
        await downloadSourceInChunks(currentSource, filename);
        recordActivity('baixou episódio', 3);
      }catch(e){
        setStatus('Erro ao baixar: ' + (e.message || 'falha'));
      }
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
