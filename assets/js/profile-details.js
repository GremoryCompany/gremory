const fields = { pronouns: 40, favoriteGame: 80, interests: 160, lookingFor: 120, website: 300, accent: 16 };
export function safeProfileUrl(value) {
  try { const url = new URL(String(value || '').trim()); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function profileDetails(input = {}) {
  const result = {};
  for (const [key, max] of Object.entries(fields)) result[key] = String(input?.[key] || '').trim().slice(0, max);
  result.website = safeProfileUrl(result.website);
  if (!['violet', 'ocean', 'rose', 'forest'].includes(result.accent)) result.accent = 'violet';
  return result;
}
