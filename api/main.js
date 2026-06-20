function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
async function readJsonBody(req){
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf-8') || "{}";
  try{ return JSON.parse(raw); }catch{ return {}; }
}
function qp(req, key){
  try{
    const u = new URL(req.url, 'http://localhost');
    return u.searchParams.get(key);
  }catch{ return null; }
}
function safeFilename(name){
  return String(name || 'download').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'download';
}
function blockPrivateHost(host){
  const h = (host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}
async function streamAsAttachment(res, fileResp, filename){
  const contentType = fileResp.headers.get('content-type') || 'application/octet-stream';
  const len = fileResp.headers.get('content-length');
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(filename)}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (len) res.setHeader('Content-Length', len);
  const { Readable } = require('stream');
  Readable.fromWeb(fileResp.body).pipe(res);
}
async function streamAsMedia(res, fileResp){
  const contentType = fileResp.headers.get('content-type') || 'video/mp4';
  const len = fileResp.headers.get('content-length');
  const contentRange = fileResp.headers.get('content-range');
  const acceptRanges = fileResp.headers.get('accept-ranges');
  res.statusCode = fileResp.status || 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (len) res.setHeader('Content-Length', len);
  if (contentRange) res.setHeader('Content-Range', contentRange);
  if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
  const { Readable } = require('stream');
  Readable.fromWeb(fileResp.body).pipe(res);
}
function cleanUrl(value){
  let v = String(value || '').trim();
  if (v.startsWith('//')) v = 'https:' + v;
  return v;
}
async function fetchText(url, headers = {}){
  const r = await fetch(url, { headers, redirect: 'follow' });
  if (!r.ok) throw new Error('Falha ao buscar página');
  return await r.text();
}
function matchMeta(html, keys){
  for (const key of keys){
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, 'i')
    ];
    for (const rgx of patterns){
      const m = html.match(rgx);
      if (m && m[1]) return m[1].replace(/&amp;/g, '&');
    }
  }
  return null;
}
function matchJsonUrl(html){
  const regexes = [
    /"image_url":"(https:[^"]+)"/i,
    /"orig":\{"url":"(https:[^"]+)"/i,
    /"url":"(https:\\\/\\\/i\.pinimg\.com[^"]+)"/i,
    /"contentUrl":"(https:[^"]+)"/i
  ];
  for (const rgx of regexes){
    const m = html.match(rgx);
    if (m && m[1]) return m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
  }
  return null;
}
function pickDarkKey(body = {}){
  return process.env.DARKSTARS_API_KEY || process.env.DARK_API_KEY || process.env.GREMORY_APIKEY || process.env.APIKEY || body.apikey || body.apiKey || '';
}
function darkAnimeUrl(path, params = {}, key = ''){
  const u = new URL(`https://darkstarsapi.online${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') u.searchParams.set(k, String(v));
  });
  if (key) u.searchParams.set('apikey', key);
  return u;
}
function asArray(v){
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  const keys = ['result','resultado','results','data','animes','items','list','sources','downloads','links'];
  for (const key of keys){
    if (Array.isArray(v[key])) return v[key];
  }
  for (const key of keys){
    const nested = asArray(v[key]);
    if (nested.length) return nested;
  }
  return [];
}
function fetchJsonTimeout(url, opts = {}, timeoutMs = 15000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' })
    .then(async (r) => {
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const msg = data?.erro || data?.message || `HTTP ${r.status}`;
        const err = new Error(msg);
        err.status = r.status;
        err.data = data;
        throw err;
      }
      return data;
    })
    .finally(() => clearTimeout(timer));
}
function extractSlug(value){
  let v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) {
    try{
      const u = new URL(v);
      const parts = u.pathname.split('/').filter(Boolean);
      v = parts.pop() || parts.pop() || v;
    }catch{}
  }
  return String(v || '').replace(/^\/+|\/+$/g, '').trim();
}
function normalizeAnimeItem(item = {}, provider = 'animefire'){
  const link = cleanUrl(item.link || item.url || item.href || item.path || '');
  const slug = item.slug || item.code || item.id || item.ep || item.linkCode || extractSlug(item.slug || item.code || item.id || item.ep || link || item.url || item.href);
  return {
    provider,
    source: provider,
    name: item.name || item.title || item.nome || item.titulo || 'Anime',
    title: item.title || item.name || item.nome || item.titulo || 'Anime',
    alt: item.alt || item.alternativeTitle || item.subtitle || item.subtitulo || '',
    link,
    slug: String(slug || '').trim(),
    cover: cleanUrl(item.cover || item.image || item.img || item.thumbnail || item.poster || item.capa || ''),
    rating: item.rating || item.score || item.nota || '',
    year: item.year || item.ano || '',
    status: item.status || '',
    audio: item.audio || item.tipo || item.type || ''
  };
}
function normalizeEpisodeItem(ep = {}, i = 0, provider = 'animefire'){
  const url = cleanUrl(ep.url || ep.link || ep.href || ep.path || '');
  const slug = ep.slug || ep.code || ep.id || ep.ep || ep.linkCode || extractSlug(ep.slug || ep.code || ep.id || ep.ep || url || ep.link || ep.href);
  return {
    provider,
    source: provider,
    title: ep.title || ep.name || ep.nome || ep.titulo || `Episódio ${i + 1}`,
    url,
    slug: String(slug || '').trim()
  };
}
function normalizeVideoSource(src = {}, i = 0, provider = ''){
  return {
    provider: src.provider || provider || '',
    label: src.label || src.quality || src.resolution || src.tipo || src.name || `${i + 1}ª opção`,
    src: cleanUrl(src.src || src.url || src.link || src.download || src.file || src.path || '')
  };
}
function uniqueBy(list, keyFn){
  const seen = new Set();
  return list.filter((item) => {
    const key = String(keyFn(item) || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function providerLabel(provider){
  if (provider === 'animefire') return 'AnimeFire';
  if (provider === 'nexus') return 'Nexus';
  return provider || 'Anime';
}
async function getAnimeFireSearch(name, key){
  const url = darkAnimeUrl('/api/anime/p2h/animefire', { name }, key);
  const data = await fetchJsonTimeout(url.toString(), { headers: { accept: 'application/json' } });
  return asArray(data).map(x => normalizeAnimeItem(x, 'animefire')).filter(x => x.link || x.title);
}
async function getNexusSearch(name, key){
  const url = darkAnimeUrl('/api/anime/p2h/animes', { name }, key);
  const data = await fetchJsonTimeout(url.toString(), { headers: { accept: 'application/json' } });
  return asArray(data).map(x => normalizeAnimeItem(x, 'nexus')).filter(x => x.slug || x.link || x.title);
}
async function getAnimeFireEpisodes(animeUrl, key){
  const url = darkAnimeUrl('/api/anime/p2h/animefireEp', { url: animeUrl }, key);
  const data = await fetchJsonTimeout(url.toString(), { headers: { accept: 'application/json' } });
  const obj = data?.result && !Array.isArray(data.result) ? data.result : (data?.data && !Array.isArray(data.data) ? data.data : data);
  const episodesRaw = Array.isArray(obj?.episodes) ? obj.episodes : asArray(obj?.episodes || data?.episodes || data?.result?.episodes);
  const episodes = episodesRaw.map((ep, i) => normalizeEpisodeItem(ep, i, 'animefire')).filter(ep => ep.url);
  return {
    provider: 'animefire',
    title: obj?.title || obj?.name || obj?.nome || 'Anime',
    subtitle: obj?.subtitle || obj?.alternativeTitle || '',
    cover: cleanUrl(obj?.cover || obj?.image || obj?.poster || ''),
    score: obj?.score || obj?.rating || '',
    audio: obj?.audio || '',
    status: obj?.status || '',
    year: obj?.year || '',
    synopsis: obj?.synopsis || obj?.sinopse || '',
    url: obj?.url || animeUrl,
    episodes,
    raw: data
  };
}
async function getNexusEpisodes(slugOrUrl, key){
  const slug = extractSlug(slugOrUrl);
  const url = darkAnimeUrl('/api/anime/p2h/animesep', { ep: slug }, key);
  const data = await fetchJsonTimeout(url.toString(), { headers: { accept: 'application/json' } });
  const dados = data?.result ?? data?.data ?? data;
  let epsRaw = [];
  if (Array.isArray(dados)) epsRaw = dados;
  else if (Array.isArray(dados?.episodes)) epsRaw = dados.episodes;
  else if (Array.isArray(dados?.episodios)) epsRaw = dados.episodios;
  else if (Array.isArray(dados?.result)) epsRaw = dados.result;
  else epsRaw = asArray(dados);
  const episodes = epsRaw.map((ep, i) => normalizeEpisodeItem(ep, i, 'nexus')).filter(ep => ep.slug || ep.url);
  return {
    provider: 'nexus',
    title: dados?.title || dados?.name || dados?.nome || 'Anime',
    subtitle: dados?.subtitle || dados?.alternativeTitle || '',
    cover: cleanUrl(dados?.cover || dados?.image || dados?.img || dados?.poster || ''),
    score: dados?.score || dados?.rating || '',
    audio: dados?.audio || '',
    status: dados?.status || '',
    year: dados?.year || '',
    synopsis: dados?.synopsis || dados?.sinopse || '',
    slug,
    episodes,
    raw: data
  };
}
async function getAnimeFireSources(epUrl, key){
  const url = darkAnimeUrl('/api/anime/p2h/animefireDow', { url: epUrl }, key);
  const data = await fetchJsonTimeout(url.toString(), { headers: { accept: 'application/json' } });
  const sources = asArray(data).map((src, i) => normalizeVideoSource({ ...src, provider: 'animefire' }, i, 'animefire')).filter(x => x.src);
  return { provider: 'animefire', sources, raw: data };
}
async function getNexusSources(slugOrUrl, key){
  const link = extractSlug(slugOrUrl);
  const url = darkAnimeUrl('/api/anime/p2h/animesver', { link }, key);
  const data = await fetchJsonTimeout(url.toString(), { headers: { accept: 'application/json' } });
  const sources = asArray(data).map((src, i) => normalizeVideoSource({ ...src, provider: 'nexus' }, i, 'nexus')).filter(x => x.src);
  return { provider: 'nexus', sources, raw: data };
}
function animeProxyUrl(req, action, fileUrl, filename){
  const base = new URL(req.url, 'http://localhost');
  const u = new URL('/api/main', base.origin);
  u.searchParams.set('action', action);
  u.searchParams.set('url', fileUrl);
  if (filename) u.searchParams.set('filename', filename);
  return u.pathname + u.search;
}
function normalizeAptoideApp(app = {}){
  const file = app.file || {};
  const stats = app.stats || {};
  const rating = stats.rating || {};
  let download = file.path || file.path_alt || file.url || app.download || '';
  if (download && !/^https?:\/\//i.test(download)) download = 'https:' + download;
  download = cleanUrl(download);
  return {
    name: app.name || app.title || 'Aplicativo',
    package: app.package || app.package_name || '',
    icon: app.icon || app.icon_hd || '',
    graphic: app.graphic || '',
    version: file.vername || app.version || '',
    size: file.filesize || app.size || 0,
    downloads: stats.downloads || stats.pdownloads || app.downloads || 0,
    rating: rating.avg || app.rating || '',
    store: app.store?.name || app.store || '',
    downloadUrl: download
  };
}

module.exports = async (req, res) => {
  const rapidKey = process.env.RAPIDAPI_KEY || '6e6739bedbmsh671d99355539a01p1d9748jsn68265b82360a';
  const action = (qp(req, 'action') || '').toLowerCase();

  if (action === 'proxy') {
    if (req.method !== 'GET') return sendJson(res, 405, { erro: 'Método inválido' });
    const url = qp(req, 'url');
    const filename = qp(req, 'filename') || 'download';
    if (!url) return sendJson(res, 400, { erro: 'url obrigatória' });
    let target;
    try { target = new URL(cleanUrl(url)); } catch { return sendJson(res, 400, { erro: 'url inválida' }); }
    if (!['https:', 'http:'].includes(target.protocol)) return sendJson(res, 400, { erro: 'protocolo inválido' });
    if (blockPrivateHost(target.hostname)) return sendJson(res, 400, { erro: 'host bloqueado' });
    try{
      const r = await fetch(target.toString(), { redirect: 'follow' });
      if (!r.ok || !r.body) return sendJson(res, 502, { erro: 'falha ao obter arquivo' });
      return streamAsAttachment(res, r, filename);
    }catch{
      return sendJson(res, 500, { erro: 'erro no proxy' });
    }
  }

  if (action === 'media_proxy') {
    if (req.method !== 'GET') return sendJson(res, 405, { erro: 'Método inválido' });
    const url = qp(req, 'url');
    if (!url) return sendJson(res, 400, { erro: 'url obrigatória' });
    let target;
    try { target = new URL(cleanUrl(url)); } catch { return sendJson(res, 400, { erro: 'url inválida' }); }
    if (!['https:', 'http:'].includes(target.protocol)) return sendJson(res, 400, { erro: 'protocolo inválido' });
    if (blockPrivateHost(target.hostname)) return sendJson(res, 400, { erro: 'host bloqueado' });
    try{
      const headers = {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': req.headers.accept || 'video/mp4,video/*,*/*',
        'Referer': 'https://animefire.io/',
        'Origin': 'https://animefire.io'
      };
      if (req.headers.range) headers.Range = req.headers.range;
      const r = await fetch(target.toString(), { headers, redirect: 'follow' });
      if (!r.ok || !r.body) return sendJson(res, 502, { erro: 'falha ao obter mídia' });
      return streamAsMedia(res, r);
    }catch{
      return sendJson(res, 500, { erro: 'erro no proxy de mídia' });
    }
  }

  if (action === 'instagram') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const url = body.url;
    if (!url) return sendJson(res, 400, { erro: 'URL obrigatória' });
    try{
      const rapidUrl = new URL('https://instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com/convert');
      rapidUrl.searchParams.set('url', url);
      const r = await fetch(rapidUrl.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': 'instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com'
        }
      });
      const data = await r.json().catch(()=>null);
      const mediaUrl =
        data?.video_url ||
        data?.download_url ||
        data?.url ||
        data?.media ||
        data?.data?.url ||
        data?.data?.video_url ||
        (Array.isArray(data?.media) ? data.media[0]?.url : null) ||
        null;
      if (!r.ok || !mediaUrl) return sendJson(res, 502, { erro: 'Falha ao gerar download do Instagram' });
      const ext = /(\.jpg|\.jpeg|\.png|\.webp)(\?|$)/i.test(String(mediaUrl)) ? 'jpg' : 'mp4';
      const filename = `instagram-${Date.now()}.${ext}`;
      const prox = `/api/main?action=proxy&url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
      return sendJson(res, 200, { ok:true, downloadUrl: prox, filename });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao gerar download do Instagram' });
    }
  }

  if (action === 'spotify') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const songId = body.url || body.songId;
    if (!songId) return sendJson(res, 400, { erro: 'Link do Spotify obrigatório' });
    try{
      const rapidUrl = new URL('https://spotify-downloader9.p.rapidapi.com/downloadSong');
      rapidUrl.searchParams.set('songId', songId);
      const r = await fetch(rapidUrl.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': 'spotify-downloader9.p.rapidapi.com'
        }
      });
      const data = await r.json().catch(()=>null);
      if (!r.ok || !data || !data.success || !data.data?.downloadLink) return sendJson(res, 502, { erro: 'Falha ao baixar Spotify' });
      const title = safeFilename(data.data.title || 'musica');
      const prox = `/api/main?action=proxy&url=${encodeURIComponent(data.data.downloadLink)}&filename=${encodeURIComponent(title + '.mp3')}`;
      return sendJson(res, 200, {
        ok:true,
        downloadUrl: prox,
        filename: `${title}.mp3`,
        title: data.data.title || '',
        artist: data.data.artist || '',
        album: data.data.album || '',
        cover: data.data.cover || ''
      });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao baixar Spotify' });
    }
  }

  if (action === 'pinterest') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const url = body.url;
    if (!url) return sendJson(res, 400, { erro: 'URL obrigatória' });
    try{
      const html = await fetchText(url, {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8'
      });
      let mediaUrl = matchMeta(html, ['og:video:secure_url', 'og:video', 'og:image:secure_url', 'og:image', 'twitter:image']);
      if (!mediaUrl) mediaUrl = matchJsonUrl(html);
      if (!mediaUrl) return sendJson(res, 404, { erro: 'Não foi possível extrair a mídia do Pinterest' });
      let ext = 'jpg';
      try{
        const pathname = new URL(mediaUrl).pathname;
        const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
        if (match) ext = match[1];
      }catch{}
      const isVideo = /(\.mp4|\.m3u8)(\?|$)/i.test(mediaUrl) || /og:video/i.test(html);
      if (isVideo) ext = 'mp4';
      const filename = `pinterest-${Date.now()}.${ext}`;
      const prox = `/api/main?action=proxy&url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
      return sendJson(res, 200, { ok:true, downloadUrl: prox, filename });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao baixar Pinterest' });
    }
  }

  if (action === 'tiktok') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const url = body.url;
    if (!url) return sendJson(res, 400, { erro: 'URL obrigatória' });
    try{
      const form = new URLSearchParams({ url });
      const r = await fetch('https://tiktok-video-no-watermark2.p.rapidapi.com/', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com',
          'x-rapidapi-key': rapidKey
        },
        body: form.toString()
      });
      const data = await r.json().catch(()=>null);
      if (!r.ok || !data || data.code !== 0 || !data.data?.play) return sendJson(res, 502, { erro: 'Não foi possível baixar esse TikTok' });
      const title = safeFilename(data.data.title || 'tiktok-video');
      const prox = `/api/main?action=proxy&url=${encodeURIComponent(data.data.play)}&filename=${encodeURIComponent(title + '.mp4')}`;
      return sendJson(res, 200, {
        ok:true,
        downloadUrl: prox,
        filename:`${title}.mp4`,
        thumb:data.data.cover || '',
        autor:data.data.author?.nickname || ''
      });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao baixar TikTok' });
    }
  }


  if (action === 'anime_search' || action === 'animesearch') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const name = body.name || body.query || body.q;
    if (!name) return sendJson(res, 400, { erro: 'Nome do anime obrigatório' });
    const key = pickDarkKey(body);
    const errors = [];
    const tasks = [
      getAnimeFireSearch(name, key).catch(e => { errors.push(`AnimeFire: ${e.message}`); return []; }),
      getNexusSearch(name, key).catch(e => { errors.push(`Nexus: ${e.message}`); return []; })
    ];
    try{
      const [fireList, nexusList] = await Promise.all(tasks);
      const result = uniqueBy([...fireList, ...nexusList], x => x.link || x.slug || x.title).slice(0, 40);
      if (!result.length) {
        return sendJson(res, 502, { erro: errors.length ? `Nenhum anime encontrado. ${errors.join(' | ')}` : 'Nenhum anime encontrado', providers:{ animefire: fireList.length, nexus: nexusList.length } });
      }
      return sendJson(res, 200, {
        ok:true,
        result,
        providers:{ animefire: fireList.length, nexus: nexusList.length },
        warning: errors.join(' | ')
      });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao pesquisar anime' });
    }
  }

  if (action === 'anime_eps' || action === 'animeeps') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const provider = String(body.provider || body.source || '').toLowerCase();
    const animeUrl = body.url || body.link;
    const slug = body.slug || body.code || body.id || extractSlug(animeUrl);
    if (!animeUrl && !slug) return sendJson(res, 400, { erro: 'URL/código do anime obrigatório' });
    const key = pickDarkKey(body);
    const errors = [];
    const tryFire = async () => {
      if (!animeUrl) throw new Error('sem URL para AnimeFire');
      const data = await getAnimeFireEpisodes(animeUrl, key);
      if (!data.episodes.length) throw new Error('AnimeFire sem episódios');
      return data;
    };
    const tryNexus = async () => {
      if (!slug && !animeUrl) throw new Error('sem código para Nexus');
      const data = await getNexusEpisodes(slug || animeUrl, key);
      if (!data.episodes.length) throw new Error('Nexus sem episódios');
      return data;
    };
    try{
      let details = null;
      const order = provider === 'nexus' ? [tryNexus, tryFire] : [tryFire, tryNexus];
      for (const fn of order){
        try{
          details = await fn();
          break;
        }catch(e){
          errors.push(e.message);
        }
      }
      if (!details) return sendJson(res, 502, { erro: 'Não consegui listar episódios desse anime', detalhes: errors });
      return sendJson(res, 200, {
        ok:true,
        anime: details,
        provider: details.provider,
        warning: errors.join(' | ')
      });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao buscar episódios' });
    }
  }

  if (action === 'anime_download' || action === 'animedownload') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const provider = String(body.provider || body.source || '').toLowerCase();
    const epUrl = body.url || body.link;
    const slug = body.slug || body.code || body.id || extractSlug(epUrl);
    const title = safeFilename(body.title || 'episodio');
    if (!epUrl && !slug) return sendJson(res, 400, { erro: 'URL/código do episódio obrigatório' });
    const key = pickDarkKey(body);
    const errors = [];
    const tryFire = async () => {
      if (!epUrl) throw new Error('sem URL para AnimeFire');
      const data = await getAnimeFireSources(epUrl, key);
      if (!data.sources.length) throw new Error('AnimeFire sem links');
      return data;
    };
    const tryNexus = async () => {
      if (!slug && !epUrl) throw new Error('sem código para Nexus');
      const data = await getNexusSources(slug || epUrl, key);
      if (!data.sources.length) throw new Error('Nexus sem links');
      return data;
    };
    try{
      let data = null;
      const order = provider === 'nexus' ? [tryNexus, tryFire] : [tryFire, tryNexus];
      for (const fn of order){
        try{
          data = await fn();
          break;
        }catch(e){
          errors.push(e.message);
        }
      }
      if (!data || !data.sources.length) return sendJson(res, 502, { erro: 'Não encontrei links para esse episódio', detalhes: errors });
      const sources = data.sources.map((src, i) => {
        const filename = `${title}-${safeFilename(src.label || i + 1)}.mp4`;
        return {
          ...src,
          label: `${src.label || `${i + 1}ª opção`} • ${providerLabel(src.provider || data.provider)}`,
          playUrl: animeProxyUrl(req, 'media_proxy', src.src, ''),
          downloadUrl: animeProxyUrl(req, 'anime_file', src.src, filename),
          filename
        };
      });
      return sendJson(res, 200, {
        ok:true,
        result:sources,
        sources,
        provider:data.provider,
        warning: errors.join(' | ')
      });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao buscar player/download do episódio' });
    }
  }

  if (action === 'anime_file') {
    if (req.method !== 'GET') return sendJson(res, 405, { erro: 'Método inválido' });
    const url = qp(req, 'url');
    const filename = qp(req, 'filename') || 'episodio.mp4';
    if (!url) return sendJson(res, 400, { erro: 'url obrigatória' });
    let target;
    try { target = new URL(cleanUrl(url)); } catch { return sendJson(res, 400, { erro: 'url inválida' }); }
    if (!['https:', 'http:'].includes(target.protocol)) return sendJson(res, 400, { erro: 'protocolo inválido' });
    if (blockPrivateHost(target.hostname)) return sendJson(res, 400, { erro: 'host bloqueado' });
    try{
      const r = await fetch(target.toString(), {
        redirect: 'follow',
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
          'Referer': 'https://animefire.io/',
          'Origin': 'https://animefire.io',
          'Accept': 'video/mp4,video/*,*/*'
        }
      });
      if (!r.ok || !r.body) return sendJson(res, 502, { erro: 'falha ao obter episódio' });
      return streamAsAttachment(res, r, filename);
    }catch{
      return sendJson(res, 500, { erro: 'erro ao baixar episódio' });
    }
  }

  if (action === 'apk_search' || action === 'apksearch') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const query = body.query || body.q || body.name;
    if (!query) return sendJson(res, 400, { erro: 'Nome do APK obrigatório' });
    try{
      const url = `https://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=${Number(body.limit || 18) || 18}`;
      const r = await fetch(url, { headers: { 'accept': 'application/json' } });
      const data = await r.json().catch(()=>null);
      const list = (data?.datalist?.list || data?.list || data?.data || []).map(normalizeAptoideApp).filter(x => x.name);
      if (!r.ok || !data) return sendJson(res, 502, { erro: 'Falha ao pesquisar APK' });
      return sendJson(res, 200, { ok:true, result:list, raw:data });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao pesquisar APK' });
    }
  }

  if (action === 'apk_download' || action === 'apkdownload') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const fileUrl = body.url || body.downloadUrl;
    const name = safeFilename(body.name || body.package || 'app');
    if (!fileUrl) return sendJson(res, 400, { erro: 'Link do APK obrigatório' });
    let target;
    try { target = new URL(fileUrl); } catch { return sendJson(res, 400, { erro: 'Link do APK inválido' }); }
    if (!['https:', 'http:'].includes(target.protocol)) return sendJson(res, 400, { erro: 'protocolo inválido' });
    if (blockPrivateHost(target.hostname)) return sendJson(res, 400, { erro: 'host bloqueado' });
    const ext = /\.xapk(\?|$)/i.test(fileUrl) ? '.xapk' : '.apk';
    const filename = `${name}${ext}`;
    const prox = `/api/main?action=proxy&url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
    return sendJson(res, 200, { ok:true, downloadUrl: prox, filename });
  }

  return sendJson(res, 404, { erro: 'Ação inválida' });
};