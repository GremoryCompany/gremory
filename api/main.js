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
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
  res.setHeader('Accept-Ranges', acceptRanges || 'bytes');
  if (len) res.setHeader('Content-Length', len);
  if (contentRange) res.setHeader('Content-Range', contentRange);
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
  return process.env.DARKSTARS_API_KEY || process.env.DARK_API_KEY || process.env.GREMORY_APIKEY || process.env.APIKEY || body.apikey || body.apiKey || 'gremory';
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
function refererForProvider(provider, fileUrl = ''){
  const p = String(provider || '').toLowerCase();
  const u = String(fileUrl || '').toLowerCase();
  if (p.includes('animefire') || u.includes('animefire')) return 'https://animefire.io/';
  // Na segunda fonte, muitos links já vêm de CDNs externos. Referer errado pode bloquear.
  return '';
}
function buildVideoHeaders(req, targetUrl, provider){
  const headers = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
  };
  const ref = refererForProvider(provider, targetUrl);
  if (ref) headers.Referer = ref;
  if (req.headers.range) headers.Range = req.headers.range;
  return headers;
}
function normalizeRangeHeader(rangeHeader){
  const raw = String(rangeHeader || '').trim();
  if (!/^bytes=\d*-\d*$/i.test(raw)) return '';
  return raw;
}
function firstChunkRange(){
  // Força o player a pedir só um pedaço inicial. Isso evita a Vercel tentar
  // transmitir o episódio inteiro em uma única requisição e cortar o download.
  const chunk = Number(process.env.ANIME_PROXY_CHUNK || 2 * 1024 * 1024);
  return `bytes=0-${Math.max(512 * 1024, chunk) - 1}`;
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

function decodeHtml(value){
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n) || 32));
}
function stripTags(value){
  return decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function absoluteUrl(href, base = 'https://animefire.io'){
  let v = cleanUrl(decodeHtml(href));
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  try{ return new URL(v, base).toString(); }catch{ return v; }
}

function formatUrl(url){
  return decodeHtml(String(url || '')).replace(/\\\//g, '/').replace(/\\/g, '/').trim();
}
const ANFIRE_BASES = String(process.env.ANFIRE_BASES || process.env.ANIMEFIRE_BASE || 'https://animefire.io,https://animefire.plus')
  .split(',')
  .map(x => x.trim().replace(/\/+$/, ''))
  .filter(Boolean);
function anfireBaseFrom(value){
  const raw = String(value || '').trim();
  try{
    const u = new URL(raw);
    if (/animefire\.(io|plus)$/i.test(u.hostname)) return `${u.protocol}//${u.hostname}`;
  }catch{}
  return ANFIRE_BASES[0] || 'https://animefire.io';
}
function anfireMakeUrl(base, path){
  return new URL(path, base.replace(/\/+$/, '') + '/').toString();
}
function anfirePrettyTitleFromSlug(slug){
  return String(slug || '')
    .replace(/-todos-os-episodios$/i, '')
    .replace(/-dublado$/i, ' dublado')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || 'Anime';
}
function slugifyAnime(value){
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:'’`´.!,()\[\]{}]/g, ' ')
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function anfireCandidateSlugs(name){
  const raw = String(name || '').toLowerCase().trim();
  const key = slugifyAnime(raw.replace(/\b(dublado|legendado|todos os episodios|todos os episódios)\b/g, ''));
  const aliases = {
    'one-piece': ['one-piece-todos-os-episodios', 'one-piece'],
    'naruto': ['naruto-dublado-todos-os-episodios', 'naruto-todos-os-episodios', 'naruto-dublado', 'naruto'],
    'naruto-shippuden': ['naruto-shippuuden-todos-os-episodios', 'naruto-shippuuden-dublado-todos-os-episodios', 'naruto-shippuuden'],
    'boruto-naruto-next-generations': ['boruto-naruto-next-generations-dublado-todos-os-episodios', 'boruto-naruto-next-generations-todos-os-episodios', 'boruto-naruto-next-generations-dublado', 'boruto-naruto-next-generations'],
    'solo-leveling': ['ore-dake-level-up-na-ken-todos-os-episodios', 'ore-dake-level-up-na-ken', 'solo-leveling'],
    'jujutsu-kaisen': ['jujutsu-kaisen-tv-todos-os-episodios', 'jujutsu-kaisen-todos-os-episodios', 'jujutsu-kaisen-tv', 'jujutsu-kaisen'],
    'dandadan': ['dandadan-todos-os-episodios', 'dandadan'],
    'kimetsu-no-yaiba': ['kimetsu-no-yaiba-todos-os-episodios', 'kimetsu-no-yaiba'],
    'demon-slayer': ['kimetsu-no-yaiba-todos-os-episodios', 'kimetsu-no-yaiba'],
    'dragon-ball-daima': ['dragon-ball-daima-todos-os-episodios', 'dragon-ball-daima'],
    'black-clover': ['black-clover-dublado-todos-os-episodios', 'black-clover-todos-os-episodios', 'black-clover-dublado', 'black-clover'],
    'death-note': ['death-note-dublado-todos-os-episodios', 'death-note-todos-os-episodios', 'death-note'],
    'one-punch-man': ['one-punch-man-dublado-todos-os-episodios', 'one-punch-man-todos-os-episodios', 'one-punch-man'],
    'tokidoki-bosotto-russia-go-de-dereru-tonari-no-alya-san': ['tokidoki-bosotto-russia-go-de-dereru-tonari-no-alya-san-todos-os-episodios', 'tokidoki-bosotto-russia-go-de-dereru-tonari-no-alya-san']
  };
  const list = [ ...(aliases[key] || []), key, `${key}-todos-os-episodios`, `${key}-dublado-todos-os-episodios`, `${key}-dublado` ];
  return [...new Set(list.filter(Boolean))];
}

function anfireHeaders(base = 'https://animefire.io', extra = {}){
  const origin = String(base || 'https://animefire.io').replace(/\/+$/, '');
  return {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'referer': `${origin}/`,
    ...extra
  };
}
async function fetchAnfireText(url){
  const base = anfireBaseFrom(url);
  return await fetchText(url, anfireHeaders(base));
}
async function fetchAnfireJson(url){
  const base = anfireBaseFrom(url);
  return await fetchJsonTimeout(url, { headers: anfireHeaders(base, { accept: 'application/json,text/plain,*/*' }) }, 15000);
}
function extractFirst(html, regexes){
  for (const rgx of regexes){
    const m = html.match(rgx);
    if (m && m[1]) return decodeHtml(m[1]).trim();
  }
  return '';
}
function anfireSlugFromLink(link){
  const clean = cleanUrl(link);
  const m = clean.match(/\/animes\/([^/?#]+)(?:\/(\d+))?/i);
  return { slug: m?.[1] || extractSlug(clean), episode: m?.[2] ? Number(m[2]) : null };
}
function extractAnfireCards(html, limit = 40, base = 'https://animefire.io'){
  const results = [];
  const push = (item) => {
    const link = absoluteUrl(item.link || item.href || '', base);
    if (!link || !/\/animes\//i.test(link)) return;
    const { slug, episode } = anfireSlugFromLink(link);
    const title = stripTags(item.title || item.alt || item.name || anfirePrettyTitleFromSlug(slug));
    const cover = absoluteUrl(item.cover || item.img || item.image || '', base);
    results.push({ provider:'anfire', source:'anfire', title, name:title, link, slug, episode, cover, rating:item.rating || '', audio:item.audio || '', year:item.year || '', status:item.status || '' });
  };

  const blocks = [];
  const blockRegexes = [
    /<div[^>]+class=["'][^"']*(?:divCardUltimosEps|card|item|anime)[^"']*["'][\s\S]*?(?=<div[^>]+class=["'][^"']*(?:divCardUltimosEps|card|item|anime)|<footer|<\/body|$)/gi,
    /<article[\s\S]*?<\/article>/gi,
    /<li[\s\S]*?<\/li>/gi
  ];
  for (const rgx of blockRegexes){
    let m;
    while ((m = rgx.exec(html)) && blocks.length < limit * 4) {
      if (/\/animes\//i.test(m[0])) blocks.push(m[0]);
    }
    if (blocks.length) break;
  }

  for (const block of blocks){
    const href = extractFirst(block, [/<a[^>]+href=["']([^"']*\/animes\/[^"']+)["']/i]);
    if (!href) continue;
    const img = extractFirst(block, [/<img[^>]+data-src=["']([^"']+)["']/i, /<img[^>]+src=["']([^"']+)["']/i, /data-original=["']([^"']+)["']/i]);
    const title = stripTags(extractFirst(block, [
      /<h[1-6][^>]*class=["'][^"']*(?:animeTitle|title|nome)[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/i,
      /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i,
      /<a[^>]+title=["']([^"']+)["']/i,
      /<img[^>]+alt=["']([^"']+)["']/i,
      /title=["']([^"']+)["']/i
    ]));
    const rating = stripTags(extractFirst(block, [/(\d+(?:\.\d+)?)\s*(?:A\d{2}|L)?/i]));
    push({ link:href, cover:img, title, rating });
  }

  // Fallback por âncora: pega uma janela ao redor do link e tenta achar imagem/título perto dele.
  if (results.length < 3) {
    const anchor = /<a\b[^>]+href=["']([^"']*\/animes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = anchor.exec(html)) && results.length < limit * 2){
      const link = absoluteUrl(m[1], base);
      const { slug } = anfireSlugFromLink(link);
      const idx = Math.max(0, m.index - 900);
      const win = html.slice(idx, Math.min(html.length, anchor.lastIndex + 1400));
      const img = extractFirst(win, [/<img[^>]+data-src=["']([^"']+)["']/i, /<img[^>]+src=["']([^"']+)["']/i]);
      const title = stripTags(extractFirst(m[0] + win, [
        /title=["']([^"']+)["']/i,
        /alt=["']([^"']+)["']/i,
        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i,
        /<span[^>]*class=["'][^"']*(?:title|nome)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
      ])) || anfirePrettyTitleFromSlug(slug);
      push({ link, cover:img, title });
    }
  }

  return uniqueBy(results, x => x.link || `${x.slug}-${x.episode || ''}` || x.title).slice(0, limit);
}
async function getAnfireSearch(name){
  const results = [];
  const errors = [];
  for (const base of ANFIRE_BASES){
    try{
      const html = await fetchAnfireText(anfireMakeUrl(base, `/pesquisar/${encodeURIComponent(name)}`));
      results.push(...extractAnfireCards(html, 40, base).map(x => ({ ...x, query:name })));
    }catch(e){ errors.push(`${base}: ${e.message}`); }
  }

  // Fallback: tenta páginas previsíveis do AnimeFire. Isso ajuda nos cards do início,
  // principalmente quando o nome vem do AniList em inglês.
  if (results.length < 2) {
    const candidates = anfireCandidateSlugs(name);
    for (const base of ANFIRE_BASES){
      for (const slug of candidates.slice(0, 8)){
        const link = anfireMakeUrl(base, `/animes/${slug}`);
        try{
          const details = await getAnfireDetails(link, { light:true });
          if (details?.slug) {
            results.push({
              provider:'anfire', source:'anfire', title:details.title || anfirePrettyTitleFromSlug(slug), name:details.title || anfirePrettyTitleFromSlug(slug),
              link:details.link || link, slug:details.slug, cover:details.cover || '', rating:details.rating || details.score || '', synopsis:details.synopsis || '', query:name
            });
            break;
          }
        }catch{}
      }
      if (results.length) break;
    }
  }
  return uniqueBy(results, x => x.link || x.slug || x.title).slice(0, 40);
}

async function getAnfireUpdated(limit = 24){
  const errors = [];
  for (const base of ANFIRE_BASES){
    try{
      const html = await fetchAnfireText(anfireMakeUrl(base, '/animes-atualizados'));
      const list = extractAnfireCards(html, limit, base);
      if (list.length) return list;
    }catch(e){ errors.push(`${base}: ${e.message}`); }
  }
  throw new Error(errors.join(' | ') || 'AnimeFire sem resposta');
}

function extractAnfireEpisodesFromHtml(html, animeSlug){
  const episodes = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']*\/animes\/([^\/'"?#]+)\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))){
    const link = absoluteUrl(m[1]);
    const slug = m[2] || animeSlug;
    const episode = Number(m[3]);
    if (!episode || seen.has(`${slug}-${episode}`)) continue;
    seen.add(`${slug}-${episode}`);
    const text = stripTags(m[4]);
    episodes.push({ provider:'anfire_plus', source:'anfire_plus', title: text && text.length > 3 ? text : `Episódio ${episode}`, url: link, slug, episode });
  }
  episodes.sort((a,b) => Number(a.episode || 0) - Number(b.episode || 0));
  return episodes;
}
async function probeAnfireEpisodes(animeSlug, maxEpisodes = 80, base = 'https://animefire.io'){
  const found = [];
  for (let episode = 1; episode <= maxEpisodes; episode++){
    try{
      const data = await fetchAnfireJson(anfireMakeUrl(base, `/video/${encodeURIComponent(animeSlug)}/${episode}`));
      if (data?.response && String(data.response.status) === '500') break;
      const arr = Array.isArray(data?.data) ? data.data : [];
      if (!arr.length) {
        if (episode === 1) break;
        if (found.length && episode - Number(found[found.length - 1].episode) > 6) break;
        continue;
      }
      found.push({ provider:'anfire', source:'anfire', title:`Episódio ${episode}`, url:anfireMakeUrl(base, `/animes/${animeSlug}/${episode}`), slug:animeSlug, episode });
    }catch(e){
      if (episode === 1 || found.length) break;
    }
  }
  return found;
}

async function getAnfireDetails(linkOrSlug, opts = {}){
  let link = cleanUrl(linkOrSlug || '');
  const base = anfireBaseFrom(link);
  if (!/^https?:\/\//i.test(link)) link = anfireMakeUrl(base, `/animes/${extractSlug(link)}`);
  const pageBase = anfireBaseFrom(link);
  const html = await fetchAnfireText(link);
  let { slug, episode } = anfireSlugFromLink(link);
  const firstEp = extractFirst(html, [
    /<div[^>]+class=["'][^"']*div_video_list[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["']/i,
    /<a[^>]+href=["']([^"']*\/animes\/[^"']+\/\d+[^"']*)["']/i
  ]);
  if (firstEp) slug = anfireSlugFromLink(absoluteUrl(firstEp, pageBase)).slug || slug;
  const title = stripTags(extractFirst(html, [/<h1[^>]+class=["'][^"']*quicksand400[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i, /<h1[^>]*>([\s\S]*?)<\/h1>/i, /<title[^>]*>([\s\S]*?)<\/title>/i])).replace(/\s*-\s*AnimeFire.*$/i, '').trim();
  const alt = stripTags(extractFirst(html, [/<h6[^>]+class=["'][^"']*text-gray[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i]));
  const cover = absoluteUrl(extractFirst(html, [/<div[^>]+class=["'][^"']*sub_animepage_img[^"']*["'][\s\S]*?<img[^>]+data-src=["']([^"']+)["']/i, /<div[^>]+class=["'][^"']*sub_animepage_img[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]+alt=["'][^"']*(?:Anime|${title})/i]), pageBase);
  const synopsis = stripTags(extractFirst(html, [/<div[^>]+class=["'][^"']*divSinopse[^"']*["'][\s\S]*?<span[^>]+class=["'][^"']*spanAnimeInfo[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, /Sinopse:\s*([\s\S]{40,1000}?)(?:<h|<div|Episódios|$)/i, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i]));
  const score = stripTags(extractFirst(html, [/<h4[^>]+id=["']anime_score["'][^>]*>([\s\S]*?)<\/h4>/i, /score\s*<\/[^>]+>\s*<[^>]+>\s*([\d.]+)/i]));
  const info = stripTags((html.match(/<div[^>]+class=["'][^"']*animeInfo[^"']*["'][\s\S]*?<\/div>/i) || [''])[0]);
  let episodes = [];
  if (!opts.light) {
    episodes = extractAnfireEpisodesFromHtml(html, slug || anfireSlugFromLink(link).slug);
    if (!episodes.length && slug) episodes = await probeAnfireEpisodes(slug, 80, pageBase);
    if (!episodes.length && episode && slug) episodes = [{ provider:'anfire', source:'anfire', title:`Episódio ${episode}`, url:link, slug, episode }];
  }
  return { provider:'anfire', source:'anfire', title:title || alt || anfirePrettyTitleFromSlug(slug), name:title || alt || anfirePrettyTitleFromSlug(slug), subtitle:alt, link, url:link, slug, cover, score, rating:score, synopsis, info, episodes };
}

async function getAnfireSources(ep){
  const base = anfireBaseFrom(ep.url || ep.link || '');
  const parsed = anfireSlugFromLink(ep.url || ep.link || '');
  const slug = ep.slug || parsed.slug;
  const episode = Number(ep.episode || parsed.episode || extractSlug(ep.url || ep.link));
  if (!slug || !episode) throw new Error('episódio sem slug/número');
  const videoApi = anfireMakeUrl(base, `/video/${encodeURIComponent(slug)}/${episode}`);
  const data = await fetchAnfireJson(videoApi);
  const rawSources = Array.isArray(data?.data) ? data.data : [];
  if (!rawSources.length) throw new Error('AnimeFire sem links');
  let iframeUrl = '';
  const hasGoogle = rawSources.some(item => String(item?.src || item?.url || '').includes('googlevideo.com'));
  if (hasGoogle) {
    try{
      const pageHtml = await fetchAnfireText(anfireMakeUrl(base, `/animes/${slug}/${episode}`));
      iframeUrl = absoluteUrl(extractFirst(pageHtml, [
        /<iframe[^>]+src=["']([^"']*blogger\.com[^"']+)["']/i,
        /<iframe[^>]+src=["']([^"']+)["']/i,
        /data-src=["']([^"']*blogger\.com[^"']+)["']/i
      ]), base);
    }catch{}
  }
  const sources = rawSources.map((item, i) => {
    const direct = formatUrl(cleanUrl(item.src || item.url || item.link || ''));
    const label = item.label || item.resolution || item.quality || `${i + 1}ª opção`;
    if (iframeUrl && direct.includes('googlevideo.com')) {
      return { provider:'anfire', label, type:'iframe', playType:'iframe', src:iframeUrl, url:iframeUrl, directUrl:direct, status:'ONLINE' };
    }
    const lower = direct.toLowerCase();
    const type = lower.includes('.m3u8') ? 'hls' : (/(\.mp4|\.webm|\.ogg)(\?|$)/i.test(lower) || lower.includes('googlevideo.com') ? 'video' : (direct ? 'iframe' : ''));
    return { provider:'anfire', label, type, playType:type, src:direct, url:direct, directUrl:direct, status:direct ? 'ONLINE' : 'OFFLINE' };
  }).filter(x => x.src);
  return { provider:'anfire', sources, raw:data };
}

async function anilistGraphql(query, variables){
  const r = await fetch('https://graphql.anilist.co', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'accept':'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || data?.errors) throw new Error(data?.errors?.[0]?.message || 'AniList falhou');
  return data?.data;
}
function mapAnilistMedia(m){
  const title = m?.title?.english || m?.title?.romaji || m?.title?.native || 'Anime';
  return {
    provider:'anilist', source:'anilist', title, name:title, query:title,
    cover: m?.coverImage?.extraLarge || m?.coverImage?.large || '',
    rating: m?.averageScore ? `${(Number(m.averageScore) / 10).toFixed(1)}` : '',
    year: m?.seasonYear || '', status:m?.status || '', episodes:m?.episodes || '',
    synopsis: stripTags(m?.description || ''), anilistId:m?.id || ''
  };
}
async function anilistHomeRows(){
  const q = `query($sort:[MediaSort],$perPage:Int){Page(page:1,perPage:$perPage){media(type:ANIME,isAdult:false,sort:$sort){id title{romaji english native} coverImage{large extraLarge} averageScore seasonYear status episodes description}}}`;
  const configs = [
    ['popular','Mais pesquisados globalmente',['POPULARITY_DESC']],
    ['trending','Em alta agora',['TRENDING_DESC']],
    ['recommended','Recomendados para assistir',['SCORE_DESC','POPULARITY_DESC']]
  ];
  const rows = [];
  for (const [id,title,sort] of configs){
    const data = await anilistGraphql(q, { sort, perPage: 10 });
    rows.push({ id, title, items:(data?.Page?.media || []).map(mapAnilistMedia) });
  }
  return rows;
}
async function anilistSearch(name, limit = 10){
  const q = `query($search:String,$perPage:Int){Page(page:1,perPage:$perPage){media(type:ANIME,isAdult:false,search:$search,sort:POPULARITY_DESC){id title{romaji english native} coverImage{large extraLarge} averageScore seasonYear status episodes description}}}`;
  const data = await anilistGraphql(q, { search:name, perPage:limit });
  return (data?.Page?.media || []).map(mapAnilistMedia);
}
function animeProxyUrl(req, action, fileUrl, filename, provider){
  const base = new URL(req.url, 'http://localhost');
  const u = new URL('/api/main', base.origin);
  u.searchParams.set('action', action);
  u.searchParams.set('url', fileUrl);
  if (filename) u.searchParams.set('filename', filename);
  if (provider) u.searchParams.set('provider', provider);
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
      const headers = buildVideoHeaders(req, target.toString(), qp(req, 'provider'));
      headers.Range = normalizeRangeHeader(req.headers.range) || normalizeRangeHeader(qp(req, 'range')) || firstChunkRange();
      const r = await fetch(target.toString(), { headers, redirect: 'follow' });
      if (!r.ok || !r.body) return sendJson(res, 502, { erro: 'falha ao obter mídia' });
      return streamAsMedia(res, r);
    }catch(e){
      return sendJson(res, 500, { erro: 'erro no proxy de mídia', detalhe: e.message });
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


  if (action === 'anime_home') {
    if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    try{
      const rows = [];
      try{
        const latest = await getAnfireUpdated(24);
        if (latest.length) rows.push({ id:'anfire-updated', title:'Atualizados no AnimeFire', items: latest });
      }catch{}
      try{
        const aniRows = await anilistHomeRows();
        rows.push(...aniRows);
      }catch{}
      if (!rows.length) throw new Error('nenhuma fonte retornou animes');
      return sendJson(res, 200, { ok:true, rows });
    }catch(e){
      return sendJson(res, 500, { erro:'Erro ao carregar início dos animes', detalhe:e.message });
    }
  }

  if (action === 'anime_search' || action === 'animesearch') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const name = body.name || body.query || body.q;
    if (!name) return sendJson(res, 400, { erro: 'Nome do anime obrigatório' });
    const errors = [];
    try{
      const [anfireList, aniList] = await Promise.all([
        getAnfireSearch(name).catch(e => { errors.push(`AnimeFire: ${e.message}`); return []; }),
        anilistSearch(name, 8).catch(e => { errors.push(`AniList: ${e.message}`); return []; })
      ]);
      const result = uniqueBy([...anfireList, ...aniList], x => x.link || x.slug || x.title).slice(0, 50);
      if (!result.length) return sendJson(res, 502, { erro: errors.length ? `Nenhum anime encontrado. ${errors.join(' | ')}` : 'Nenhum anime encontrado', providers:{ anfire:0, anilist:0 } });
      return sendJson(res, 200, { ok:true, result, providers:{ anfire:anfireList.length, anilist:aniList.length }, warning: errors.join(' | ') });
    }catch(e){
      return sendJson(res, 500, { erro: 'Erro ao pesquisar anime', detalhe:e.message });
    }
  }

  if (action === 'anime_eps' || action === 'animeeps') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const animeUrl = body.url || body.link;
    const slug = body.slug || body.code || body.id || extractSlug(animeUrl);
    const title = body.title || body.name || body.query || '';
    if (!animeUrl && !slug && !title) return sendJson(res, 400, { erro: 'URL/código/nome do anime obrigatório' });
    const errors = [];
    try{
      let target = animeUrl || slug;
      if (!target && title) {
        const found = await getAnfireSearch(title);
        target = found.find(x => x.link)?.link || found[0]?.link || found[0]?.slug || '';
      }
      if (!target) throw new Error('não achei esse anime no AnimeFire');
      const details = await getAnfireDetails(target);
      if (!details.episodes.length) throw new Error('AnimeFire não retornou episódios para esse anime');
      return sendJson(res, 200, { ok:true, anime: details, provider: details.provider, warning: errors.join(' | ') });
    }catch(e){
      return sendJson(res, 502, { erro: 'Não consegui listar episódios desse anime', detalhe:e.message, detalhes: errors });
    }
  }

  if (action === 'anime_stream' || action === 'anime_download' || action === 'animedownload') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const body = await readJsonBody(req);
    const epUrl = body.url || body.link;
    const epPayload = {
      url: epUrl,
      link: epUrl,
      slug: body.slug || body.code || body.id || anfireSlugFromLink(epUrl || '').slug,
      episode: body.episode || anfireSlugFromLink(epUrl || '').episode,
      title: body.title || 'Episódio'
    };
    try{
      const data = await getAnfireSources(epPayload);
      if (!data.sources.length) return sendJson(res, 502, { erro: 'Não encontrei player para esse episódio' });
      const sources = data.sources.map((src, i) => {
        const srcProvider = src.provider || data.provider || 'anfire';
        const type = src.type || src.playType || (/blogger\.com|iframe/i.test(src.src || src.url || '') ? 'iframe' : 'video');
        const direct = cleanUrl(src.src || src.url || src.link || src.download || src.directUrl || '');
        return {
          ...src,
          provider: srcProvider,
          type,
          playType:type,
          label: `${src.label || `${i + 1}ª opção`}`,
          src: direct,
          url: direct,
          directUrl: src.directUrl || direct,
          playUrl: direct,
          proxyUrl: type === 'video' ? animeProxyUrl(req, 'media_proxy', direct, '', srcProvider) : ''
        };
      }).filter(x => x.src);
      return sendJson(res, 200, { ok:true, result:sources, sources, provider:data.provider });
    }catch(e){
      return sendJson(res, 502, { erro: 'Não encontrei player para esse episódio', detalhe:e.message });
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