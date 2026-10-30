'use strict';
// A publicação no Discord utiliza um webhook de CANAL, não o token da conta bot.
// Assim avisos funcionam mesmo quando o processo do Discord está offline.

function isDiscordWebhook(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && ['discord.com', 'discordapp.com'].includes(url.hostname) &&
      /^\/api\/webhooks\/\d{17,22}\/[A-Za-z0-9_.-]{20,}$/.test(url.pathname);
  } catch { return false; }
}

async function sendDiscordUpdate({ title = 'Atualização Gremory Studios', text = '', imageUrl = '', link = '', source = 'Gremory Studios' } = {}) {
  const webhookUrl = String(process.env.DISCORD_ANNOUNCEMENT_WEBHOOK_URL || '').trim();
  if (!webhookUrl) return { configured: false };
  if (!isDiscordWebhook(webhookUrl)) throw new Error('DISCORD_ANNOUNCEMENT_WEBHOOK_URL deve ser um webhook Discord válido.');

  const embed = {
    title: String(title || 'Atualização Gremory Studios').slice(0, 200),
    description: String(text || 'Uma novidade acabou de chegar!').slice(0, 3600),
    color: 0x8153e5,
    footer: { text: String(source).slice(0, 100) },
    timestamp: new Date().toISOString()
  };
  if (/^https:\/\//i.test(imageUrl) && imageUrl.length <= 1000) embed.image = { url: imageUrl };
  if (/^https:\/\//i.test(link) && link.length <= 1000) embed.url = link;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'Gremory Studios • Atualizações', allowed_mentions: { parse: [] }, embeds: [embed] }),
    signal: AbortSignal.timeout(12000), redirect: 'error'
  });
  if (!response.ok) throw new Error(`Discord recusou o anúncio (${response.status}).`);
  return { configured: true, sent: true };
}

module.exports = { isDiscordWebhook, sendDiscordUpdate };
