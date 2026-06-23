// api/proxy/[...path].js
// Full HLS restream proxy - ready to deploy

export const config = { runtime: 'nodejs' };

// ===== YOUR STREAM (hardcoded for quick test) =====
const UPSTREAM_BASE = 'https://am01.plinkspile.cc/22388/';
const TOKEN         = 'xvLmwUQ8L4LPLm';
// ==================================================

export default async function handler(req, res) {
  // Build the upstream URL
  const rawPath = (req.query.path || []).join('/');
  const cleanPath = rawPath.split('?')[0];
  const upstreamUrl = `${UPSTREAM_BASE}${cleanPath}?token=${TOKEN}`;

  // Fetch from the origin
  const upstreamRes = await fetch(upstreamUrl, {
    headers: { 'User-Agent': req.headers['user-agent'] || 'Vercel-HLS-Proxy' },
  });

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).send(upstreamRes.statusText);
    return;
  }

  const contentType = upstreamRes.headers.get('content-type') || '';

  // ---- Handle .m3u8 playlists ----
  if (cleanPath.endsWith('.m3u8') || contentType.includes('m3u8')) {
    let body = await upstreamRes.text();
    const proxyBase = `https://${req.headers.host}/api/proxy/`;
    const playlistDir = cleanPath.includes('/')
      ? cleanPath.substring(0, cleanPath.lastIndexOf('/') + 1)
      : '';

    body = body.split('\n').map((line) => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) return line;
      if (/^https?:\/\//i.test(trimmed)) return line; // absolute URL → leave as is
      if (trimmed.startsWith('/')) return proxyBase.slice(0, -1) + trimmed;
      return proxyBase + resolveRelativePath(playlistDir + trimmed);
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, max-age=2'); // live playlist cache
    res.send(body);
    return;
  }

  // ---- Handle .ts and other binary files ----
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=10'); // live segment cache

  if (upstreamRes.body) {
    const reader = upstreamRes.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
      await pump();
    };
    await pump();
  } else {
    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  }
}

// Helper to resolve "../" and "./" correctly
function resolveRelativePath(path) {
  const stack = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (stack.length > 0) stack.pop(); }
    else stack.push(seg);
  }
  return stack.join('/');
}
