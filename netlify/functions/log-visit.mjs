// Netlify Function: log-visit
// Receives a dashboard visit from the inline tracker in index.html (same-origin,
// passes the edge auth gate and CSP connect-src 'self'), then forwards it
// server-side to the central Direct Agents usage monitor. Fire-and-forget.
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'method not allowed' };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const email = (body.email || '').toString().trim().toLowerCase();
  const dashboard = (body.dashboard || '').toString().trim();
  if (!email || !dashboard) return { statusCode: 400, body: 'missing email or dashboard' };
  try {
    await fetch('https://da-usage-monitor.netlify.app/.netlify/functions/log-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, dashboard }),
    });
  } catch (e) { /* fire-and-forget */ }
  return { statusCode: 204, body: '' };
}
