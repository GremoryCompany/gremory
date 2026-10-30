'use strict';
// Endpoint seguro para anúncios criados no SERVIDOR do Roblox, nunca LocalScript.
const crypto = require('node:crypto');
const { sendDiscordUpdate } = require('../database/gremory_discord_webhook');

function equal(a, b) {
  const one = Buffer.from(String(a || ''));
  const two = Buffer.from(String(b || ''));
  return one.length === two.length && crypto.timingSafeEqual(one, two);
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Use POST.' })); }
  const secret = String(process.env.ROBLOX_ANNOUNCE_SECRET || '');
  if (secret.length < 32) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'Webhook ainda não configurado.' })); }
  if (!equal(secret, req.headers['x-gremory-hook-secret'])) {
    res.statusCode = 401; return res.end(JSON.stringify({ error: 'Não autorizado.' }));
  }
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk.toString(); if (raw.length > 20000) throw new Error('Corpo muito grande.'); }
    const event = JSON.parse(raw || '{}');
    const title = String(event.title || '').trim();
    if (title.length < 3 || title.length > 200) throw new Error('Título inválido.');
    const sent = await sendDiscordUpdate({ title: `🎮 ${title}`, text: String(event.text || '').slice(0, 3500), imageUrl: String(event.imageUrl || ''), link: String(event.link || ''), source: 'Roblox • Gremory Studios' });
    res.statusCode = sent.sent ? 200 : 503;
    return res.end(JSON.stringify(sent.sent ? { ok: true } : { error: 'Configure o webhook do Discord na Vercel.' }));
  } catch (error) {
    console.error('[Roblox Discord Update]', error.message);
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Não foi possível enviar o anúncio.' }));
  }
};
