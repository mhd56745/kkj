// api/proxy/[...path].js
// Full HLS restream proxy (fixed for Node.js http.ServerResponse)

export const config = { runtime: 'nodejs' };

// ===== YOUR STREAM =====
const UPSTREAM_BASE = 'https://am01.plinkspile.cc/22388/';
const TOKEN         = 'xvLmwUQ8L4LPLm';

export default async function handler(req, res) {
  try {
    // Build the upstream URL
    const rawPath = (req.query.path || []).join('/');
    const cleanPath = rawPath.split('?')[0];
    const upstreamUrl = `${UPSTREAM_BASE}${cleanPath}?token=${TOKEN}`;

    // Fetch from the origin
    const upstreamRes = await fetch(upstreamUrl, {
      headers: { 'User-Agent': req.headers['user-agent'] || 'Vercel-HLS-Proxy' },
    });

    if (!upstreamRes.ok) {
      // --- Proper error response for Node.js ---
      res.statusCode = upstreamRes.status;
      res.end(upstreamRes.statusText);
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

    // ---- Handle .ts and other binary files ----
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=10',
    });

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        await pump();
      };
      await pump();
    } else {
      // Fallback for non-streaming bodies
      const buffer = await upstreamRes.arrayBuffer();
      res.end(Buffer.from(buffer));
    }
  } catch (error) {
    // --- Catch unexpected errors (network, etc.) and log them ---
    console.error('Proxy error:', error);
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
