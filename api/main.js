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
  if (Array.isArray(v?.result)) return v.result;
  if (Array.isArray(v?.resultado)) return v.resultado;
  if (Array.isArray(v?.results)) return v.results;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.animes)) return v.animes;
  return [];
}
function normalizeAnimeItem(item = {}){
  return {
    name: item.name || item.title || item.nome || 'Anime',
    title: item.title || item.name || item.nome || 'Anime',
    alt: item.alt || item.alternativeTitle || item.subtitle || '',
    link: item.link || item.url || item.href || '',
    cover: item.cover || item.image || item.img || item.thumbnail || item.poster || '',
    rating: item.rating || item.score || item.nota || '',
    year: item.year || item.ano || '',
    status: item.status || '',
    audio: item.audio || item.tipo || ''
  };
}
function normalizeAptoideApp(app = {}){
  const file = app.file || {};
  const stats = app.stats || {};
  const rating = stats.rating || {};
  let download = file.path || file.path_alt || file.url || app.download || '';
  if (download && !/^https?:\/\//i.test(download)) download = 'https:' + download;
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
    try { target = new URL(url); } catch { return sendJson(res, 400, { erro: 'url inválida' }); }
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
    try{
      const key = pickDarkKey(body);
      const url = darkAnimeUrl('/api/anime/p2h/animefire', { name }, key);
      const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
      const data = await r.json().catch(()=>null);
      const list = asArray(data).map(normalizeAnimeItem).filter(x => x.link || x.title);
      if (!r.ok || !data) return sendJson(res, 502, { erro: 'Falha ao pesquisar anime' });
      return sendJson(res, 200, { ok:true, result:list, raw:data });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao pesquisar anime' });
    }
  }

  if (action === 'anime_eps' || action === 'animeeps') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const animeUrl = body.url || body.link;
    if (!animeUrl) return sendJson(res, 400, { erro: 'URL do anime obrigatória' });
    try{
      const key = pickDarkKey(body);
      const url = darkAnimeUrl('/api/anime/p2h/animefireEp', { url: animeUrl }, key);
      const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
      const data = await r.json().catch(()=>null);
      const obj = data?.result && !Array.isArray(data.result) ? data.result : (data?.data && !Array.isArray(data.data) ? data.data : data);
      const episodesRaw = Array.isArray(obj?.episodes) ? obj.episodes : asArray(obj?.episodes || data?.episodes || data?.result?.episodes);
      const episodes = episodesRaw.map((ep, i) => ({
        title: ep.title || ep.name || ep.nome || `Episódio ${i + 1}`,
        url: ep.url || ep.link || ep.href || ''
      })).filter(ep => ep.url);
      if (!r.ok || !data) return sendJson(res, 502, { erro: 'Falha ao buscar episódios' });
      return sendJson(res, 200, {
        ok:true,
        anime: {
          title: obj?.title || obj?.name || obj?.nome || 'Anime',
          subtitle: obj?.subtitle || obj?.alternativeTitle || '',
          cover: obj?.cover || obj?.image || obj?.poster || '',
          score: obj?.score || obj?.rating || '',
          audio: obj?.audio || '',
          status: obj?.status || '',
          year: obj?.year || '',
          synopsis: obj?.synopsis || obj?.sinopse || '',
          url: obj?.url || animeUrl,
          episodes
        },
        raw:data
      });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao buscar episódios' });
    }
  }

  if (action === 'anime_download' || action === 'animedownload') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const epUrl = body.url || body.link;
    if (!epUrl) return sendJson(res, 400, { erro: 'URL do episódio obrigatória' });
    try{
      const key = pickDarkKey(body);
      const url = darkAnimeUrl('/api/anime/p2h/animefireDow', { url: epUrl }, key);
      const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
      const data = await r.json().catch(()=>null);
      const sources = asArray(data).map((src, i) => ({
        label: src.label || src.quality || src.resolution || `${i + 1}ª opção`,
        src: src.src || src.url || src.link || src.download || ''
      })).filter(x => x.src);
      if (!r.ok || !data || sources.length === 0) return sendJson(res, 502, { erro: 'Não encontrei links para esse episódio' });
      return sendJson(res, 200, { ok:true, result:sources, sources, raw:data });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao buscar player/download do episódio' });
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