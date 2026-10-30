'use strict';
// API HTTPS do site: vinculação Discord/Firebase e pedidos ao Bridge da Charlotte.
// Nenhum saldo é editado por esta API; o Bridge continua sendo a única origem de Rupias.
const crypto = require('node:crypto');
const { getAdmin } = require('./site-wallet');

const isSnowflake = value => /^\d{17,22}$/.test(String(value || ''));
const PLANS = new Set(['1', '7', '15', '30']);

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}
async function bodyOf(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 16000) throw new Error('Requisição muito grande.');
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw new Error('JSON inválido.'); }
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function requireBot(req) {
  const key = process.env.GREMORY_BRIDGE_API_KEY || '';
  if (key.length < 32) throw Object.assign(new Error('Configure GREMORY_BRIDGE_API_KEY (mínimo 32 caracteres) na Vercel.'), { status: 503 });
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(supplied, key)) throw Object.assign(new Error('Bot não autorizado.'), { status: 401 });
}
async function requireSiteUser(auth, idToken) {
  if (!idToken || String(idToken).length > 10000) throw Object.assign(new Error('Faça login no site.'), { status: 401 });
  try { return (await auth.verifyIdToken(String(idToken))).uid; }
  catch { throw Object.assign(new Error('Sessão expirada. Entre no site novamente.'), { status: 401 }); }
}
function codeHash(code) { return crypto.createHash('sha256').update(String(code).toUpperCase()).digest('hex'); }

async function issueCode(db, discordId) {
  const now = Date.now();
  const throttle = db.ref(`discordLinkThrottle/${discordId}`);
  const tx = await throttle.transaction(value => {
    if (Number(value || 0) > now - 30000) return;
    return now;
  }, undefined, false);
  if (!tx.committed) throw Object.assign(new Error('Espere 30 segundos antes de gerar outro código.'), { status: 429 });
  const code = crypto.randomBytes(9).toString('hex').toUpperCase();
  await db.ref(`discordLinkCodes/${codeHash(code)}`).set({ discordId, expiresAt: now + 10 * 60000, createdAt: now });
  return { code, expiresAt: now + 10 * 60000 };
}

async function confirmLink(db, uid, code) {
  const cleaned = String(code || '').trim().toUpperCase();
  if (!/^[A-F0-9]{18}$/.test(cleaned)) throw Object.assign(new Error('Código inválido.'), { status: 400 });
  const codeRef = db.ref(`discordLinkCodes/${codeHash(cleaned)}`);
  const claim = await codeRef.transaction(value => {
    if (!value || Number(value.expiresAt || 0) < Date.now() || value.claimedBy) return;
    return { ...value, claimedBy: uid, claimedAt: Date.now() };
  }, undefined, false);
  if (!claim.committed) throw Object.assign(new Error('Código usado, inválido ou expirado.'), { status: 409 });
  const discordId = String(claim.snapshot.val().discordId);
  if (!isSnowflake(discordId)) throw new Error('Identificador de Discord inválido.');
  const byDiscord = db.ref(`discordLinksByDiscord/${discordId}`);
  const byUid = db.ref(`discordLinksByUid/${uid}`);
  const [a, b] = await Promise.all([byDiscord.once('value'), byUid.once('value')]);
  if (a.val()?.uid && a.val().uid !== uid || b.val()?.discordId && b.val().discordId !== discordId) {
    throw Object.assign(new Error('Conta já vinculada. Desvinculação exige confirmação da equipe.'), { status: 409 });
  }
  // Código só pode ser resgatado uma vez. Os dois índices são atualizados juntos.
  await db.ref().update({
    [`discordLinksByDiscord/${discordId}`]: { uid, linkedAt: Date.now() },
    [`discordLinksByUid/${uid}`]: { discordId, linkedAt: Date.now() },
    [`discordLinkCodes/${codeHash(cleaned)}`]: null
  });
  return { linked: true, discordId };
}

async function accountStatus(db, discordId) {
  const record = (await db.ref(`discordLinksByDiscord/${discordId}`).once('value')).val();
  if (!record?.uid) return { linked: false };
  const uid = String(record.uid);
  const [wallet, charlotte, linkedJid] = await Promise.all([
    db.ref(`siteWallets/${uid}`).once('value'),
    db.ref(`charlotteSync/${uid}/account`).once('value'),
    db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value')
  ]);
  const w = wallet.val(), account = charlotte.val() || {};
  return {
    linked: true,
    balance: Number.isSafeInteger(w?.balance) && w.balance >= 0 ? w.balance : null,
    level: Number(account.level || 0), xp: Number(account.xp || 0),
    premium: account.premium === true, charlotteLinked: !!linkedJid.val(),
    updatedAt: Date.now()
  };
}

async function queueCheckout(db, discordId, plan) {
  if (!PLANS.has(String(plan))) throw Object.assign(new Error('Plano inválido.'), { status: 400 });
  const record = (await db.ref(`discordLinksByDiscord/${discordId}`).once('value')).val();
  if (!record?.uid) throw Object.assign(new Error('Vincule seu Discord no site antes de comprar.'), { status: 409 });
  const uid = String(record.uid);
  const linked = (await db.ref(`charlottePrivate/${uid}/whatsappJid`).once('value')).val();
  if (!linked) throw Object.assign(new Error('Vincule a Charlotte ao site primeiro.'), { status: 409 });
  // Não consuma o limite de tentativas de quem ainda não terminou o vínculo.
  const now = Date.now();
  const throttle = await db.ref(`discordCheckoutThrottle/${discordId}`).transaction(value => {
    if (Number(value || 0) > now - 60000) return;
    return now;
  }, undefined, false);
  if (!throttle.committed) throw Object.assign(new Error('Aguarde 1 minuto antes de gerar outro pagamento.'), { status: 429 });
  const job = db.ref(`siteBridgeJobs/${uid}`).push();
  await job.set({ type: 'premium_checkout', plan: String(plan), createdAt: Date.now(), origin: 'discord' });
  return { jobId: job.key };
}

async function checkoutStatus(db, discordId, jobId) {
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(String(jobId || ''))) throw Object.assign(new Error('Pedido inválido.'), { status: 400 });
  const record = (await db.ref(`discordLinksByDiscord/${discordId}`).once('value')).val();
  if (!record?.uid) throw Object.assign(new Error('Discord não vinculado.'), { status: 409 });
  const result = (await db.ref(`siteBridgeResults/${record.uid}/${jobId}`).once('value')).val();
  if (!result) return { pending: true };
  if (result.ok === false) return { pending: false, error: String(result.error || 'Pagamento não iniciado.').slice(0, 220) };
  const checkoutUrl = String(result.checkoutUrl || '');
  if (!/^https:\/\/(?:www\.)?mercadopago\.com(?:\.br)?\//i.test(checkoutUrl) && !/^https:\/\/www\.mercadopago\.com\.br\//i.test(checkoutUrl)) {
    return { pending: false, error: 'O pagamento retornou um endereço não reconhecido.' };
  }
  return { pending: false, checkoutUrl };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  try {
    const body = await bodyOf(req);
    const action = String(body.action || '');
    const { auth, db } = getAdmin();
    if (action === 'confirm_link' || action === 'site_status') {
      const uid = await requireSiteUser(auth, body.idToken);
      if (action === 'site_status') {
        const data = (await db.ref(`discordLinksByUid/${uid}`).once('value')).val();
        return send(res, 200, { linked: !!data?.discordId, discordId: data?.discordId || null });
      }
      return send(res, 200, await confirmLink(db, uid, body.code));
    }
    requireBot(req);
    const discordId = String(body.discordId || '');
    if (!isSnowflake(discordId)) return send(res, 400, { error: 'ID do Discord inválido.' });
    if (action === 'request_link') return send(res, 200, await issueCode(db, discordId));
    if (action === 'status') return send(res, 200, await accountStatus(db, discordId));
    if (action === 'premium_checkout') return send(res, 200, await queueCheckout(db, discordId, body.plan));
    if (action === 'premium_checkout_status') return send(res, 200, await checkoutStatus(db, discordId, body.jobId));
    return send(res, 400, { error: 'Ação desconhecida.' });
  } catch (error) {
    console.error('[Discord Bridge]', error.message);
    return send(res, error.status || 503, { error: error.status ? error.message : 'Falha temporária no Bridge. Consulte os logs da Vercel.' });
  }
};
