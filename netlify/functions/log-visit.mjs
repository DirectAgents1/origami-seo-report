// Netlify Function: log-visit  (v2 — gets context.geo natively)
// Receives a visit/section event from the inline tracker (same-origin beacon,
// clears the edge auth gate and CSP connect-src 'self'), enriches it with the
// end-user's approximate location from context.geo, then forwards server-side to
// the central Direct Agents usage monitor. Fire-and-forget; never blocks the page.
export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204 });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  const email = (body.email || '').toString().trim().toLowerCase();
  const dashboard = (body.dashboard || '').toString().trim();
  if (!email || !dashboard) return new Response('missing email or dashboard', { status: 400 });

  const geo = (context && context.geo) || {};
  const rec = {
    type: body.type === 'section' ? 'section' : 'visit',
    email, dashboard,
    browser: body.browser, os: body.os, mobile: body.mobile,
    referrer: body.referrer, section: body.section,
    seconds: typeof body.seconds === 'number' ? body.seconds : undefined,
    country: geo.country && geo.country.code, city: geo.city,
  };

  try {
    await fetch('https://da-usage-monitor.netlify.app/.netlify/functions/log-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rec),
    });
  } catch (e) { /* fire-and-forget */ }

  return new Response('', { status: 204 });
};
