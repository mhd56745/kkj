// api/proxy/[...path].js
export const config = { runtime: 'nodejs' };

const UPSTREAM_BASE = 'https://am01.plinkspile.cc/22388/';
const TOKEN = 'xvLmwUQ8L4LPLm';

export default async function handler(req, res) {
  try {
    const rawPath = (req.query.path || []).join('/');
    const cleanPath = rawPath.split('?')[0];
    const upstreamUrl = `${UPSTREAM_BASE}${cleanPath}?token=${TOKEN}`;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: { 'User-Agent': req.headers['user-agent'] || 'Vercel-HLS-Proxy' },
    });

    if (!upstreamRes.ok) {
      res.statusCode = upstreamRes.status;
      res.end(await upstreamRes.text()); // send the error body for debugging
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || '';

    if (cleanPath.endsWith('.m3u8') || contentType.includes('m3u8')) {
      let body = await upstreamRes.text();
      const proxyBase = `https://${req.headers.host}/api/proxy/`;
      const playlistDir = cleanPath.includes('/')
        ? cleanPath.substring(0, cleanPath.lastIndexOf('/') + 1)
        : '';

      body = body.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) return line;
        if (/^https?:\/\//i.test(trimmed)) return line;
        if (trimmed.startsWith('/')) return proxyBase.slice(0, -1) + trimmed;
        return proxyBase + resolveRelativePath(playlistDir + trimmed);
      }).join('\n');

      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=2',
      });
      res.end(body);
      return;
    }

    // For TS segments and other binary: fetch fully, then send
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=10',
      'Content-Length': buffer.length,
    });
    res.end(buffer);

  } catch (error) {
    console.error('Proxy crash:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}

function resolveRelativePath(path) {
  const stack = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (stack.length > 0) stack.pop(); }
    else stack.push(seg);
  }
  return stack.join('/');
}
