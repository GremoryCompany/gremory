// Single Serverless Function for Vercel Hobby plan (<=12 funcs)
// Routes via ?action=...
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
  return String(name || 'download')
    .replace(/[\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'download';
}

function blockPrivateHost(host){
  const h = (host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
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

module.exports = async (req, res) => {
  const ninxKey = process.env.NINX_API_KEY || 'fuJe';
  const rapidKey = process.env.RAPIDAPI_KEY || '';

  const action = (qp(req, 'action') || '').toLowerCase();

  // ===========================
  // Proxy: GET /api/main?action=proxy&url=...&filename=...
  // ===========================
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

  // ===========================
  // Assado image: GET /api/main?action=assado  -> JSON { url }
  // (Safe endpoint as requested)
  // ===========================
  if (action === 'assado') {
    if (req.method !== 'GET') return sendJson(res, 405, { erro: 'Método inválido' });
    try{
      const url = `https://ninx.fun/api/hentai/ass?apikey=${encodeURIComponent(ninxKey)}`;
      const r = await fetch(url);
      const data = await r.json().catch(()=>null);
      const imgUrl = data?.url || data?.resultado?.url || data?.image || data?.img || null;
      if (!r.ok || !imgUrl) return sendJson(res, 502, { erro: 'Falha ao obter imagem' });
      return sendJson(res, 200, { ok:true, url: imgUrl });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao obter imagem' });
    }
  }

  // ===========================
  // Wikipedia: POST /api/main?action=wiki { query }
  // ===========================
  if (action === 'wiki') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const { query } = await readJsonBody(req);
    if (!query) return sendJson(res, 400, { erro: 'Termo obrigatório' });

    try{
      const apiUrl = `https://ninx.fun/api/pesquisa/wiki?nome=${encodeURIComponent(query)}&apikey=${encodeURIComponent(ninxKey)}`;
      const r = await fetch(apiUrl);
      const data = await r.json().catch(()=>null);
      if (!r.ok || !data || data.status !== true) return sendJson(res, 404, { erro: 'Sem resultados' });

      return sendJson(res, 200, {
        ok: true,
        titulo: data.titulo || "",
        descricao_breve: data.descricao_breve || "",
        resumo: data.resumo || "",
        imagem: data.imagem || "",
        link: data.link || ""
      });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao buscar na Wikipedia' });
    }
  }

  // ===========================
  // Pinterest: POST /api/main?action=pinterest { url }
  // -> returns same-origin proxy link so download always starts in-site
  // ===========================
  if (action === 'pinterest') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const { url } = await readJsonBody(req);
    if (!url) return sendJson(res, 400, { erro: 'URL obrigatória' });

    try{
      const apiUrl = `https://ninx.fun/api/download/pinterest?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(ninxKey)}`;
      const metaResp = await fetch(apiUrl);
      const metaData = await metaResp.json().catch(()=>null);
      const medias = metaData?.dados?.medias || metaData?.medias || null;

      if (!metaResp.ok || !metaData || !Array.isArray(medias) || medias.length === 0) {
        return sendJson(res, 404, { erro: 'Conteúdo não encontrado no Pinterest' });
      }

      const pick =
        medias.find(m => (m?.quality || '').toLowerCase() === 'image') ||
        medias.find(m => !!m?.url) ||
        medias[0];

      const mediaUrl = pick?.url;
      if (!mediaUrl) return sendJson(res, 404, { erro: 'Mídia indisponível' });

      const title = safeFilename(metaData?.dados?.title || 'pinterest');
      const ext = String(pick?.extension || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
      const filename = `${title}.${ext}`;

      // Use our own proxy (same-origin) so browser downloads instead of opening image tab
      const prox = `/api/main?action=proxy&url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;

      return sendJson(res, 200, {
        ok: true,
        downloadUrl: prox,
        filename,
        meta: {
          source: metaData?.dados?.source || 'pinterest',
          size: pick?.formattedSize || null
        }
      });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao baixar Pinterest' });
    }
  }


  // ===========================
  // Spotify: POST /api/main?action=spotify { nome } -> JSON with downloadUrl (cross-origin)
  // Front will call startDownload() which proxies via /api/main?action=proxy
  // ===========================
  if (action === 'spotify') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const { nome } = await readJsonBody(req);
    if (!nome) return sendJson(res, 400, { erro: 'Nome da música obrigatório' });

    if (!rapidKey) return sendJson(res, 500, { erro: 'RAPIDAPI_KEY não configurada na Vercel' });

    try{
      const searchUrl = `https://ninx.fun/api/pesquisa/spotify?nome=${encodeURIComponent(nome)}&apikey=${encodeURIComponent(ninxKey)}`;
      const searchResp = await fetch(searchUrl);
      const searchData = await searchResp.json().catch(()=>null);
      const resultados = searchData?.result || searchData;

      if (!Array.isArray(resultados) || resultados.length === 0) {
        return sendJson(res, 404, { erro: 'Música não encontrada' });
      }

      const primeira = resultados[0];
      const linkSpotify = primeira.url;
      if (!linkSpotify) return sendJson(res, 502, { erro: 'Resultado sem URL do Spotify' });

      const rapidUrl = new URL('https://spotify-downloader9.p.rapidapi.com/downloadSong');
      rapidUrl.searchParams.set('songId', linkSpotify);

      const dlResp = await fetch(rapidUrl.toString(), {
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': 'spotify-downloader9.p.rapidapi.com'
        }
      });
      const dl = await dlResp.json().catch(()=>null);

      if (!dlResp.ok || !dl || !dl.success || !dl.data) {
        return sendJson(res, 502, { erro: 'Não foi possível baixar essa música' });
      }

      const audioUrl = dl.data.downloadLink;
      if (!audioUrl) return sendJson(res, 502, { erro: 'Spotify sem link de download' });

      const title = dl.data.title || 'musica';
      const safeTitle = safeFilename(title) || 'musica';

      return sendJson(res, 200, {
        ok: true,
        downloadUrl: audioUrl,
        filename: `${safeTitle}.mp3`,
        title: dl.data.title || '',
        artist: dl.data.artist || '',
        album: dl.data.album || '',
        cover: dl.data.cover || ''
      });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao baixar Spotify' });
    }
  }

  // ===========================
  // TikTok / Instagram (keep JSON)
  // ===========================
  if (action === 'tiktok' || action === 'instagram') {
    if (req.method !== 'POST') return sendJson(res, 405, { erro: 'Método inválido' });
    const { url } = await readJsonBody(req);
    if (!url) return sendJson(res, 400, { erro: 'URL obrigatória' });

    const base = action === 'tiktok' ? 'https://ninx.fun/api/download/tiktok' : 'https://ninx.fun/api/download/instagram';
    try{
      const apiUrl = `${base}?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(ninxKey)}`;
      const r = await fetch(apiUrl);
      const data = await r.json().catch(()=>null);

      // Accept a few common shapes
      const downloadUrl =
        data?.downloadUrl ||
        data?.url ||
        data?.dados?.url ||
        data?.data?.url ||
        data?.data?.downloadUrl ||
        null;

      if (!r.ok || !data || !downloadUrl) return sendJson(res, 502, { erro: 'Falha ao gerar download' });

      const filename = safeFilename((data?.filename || data?.dados?.filename || `${action}-download`)) + '.mp4';

      return sendJson(res, 200, { ok:true, downloadUrl, filename });
    }catch{
      return sendJson(res, 500, { erro: 'Falha ao gerar download' });
    }
  }

  return sendJson(res, 404, { erro: 'Ação inválida' });
};
