// api/proxy/[...path].js
// Enhanced HLS proxy for Al Arabiya / Al Hadath stream
export const config = { runtime: 'nodejs' };

const UPSTREAM_BASE = 'https://av.alarabiya.net/alarabiapublish/alhadath.smil/';
const REFERER = 'https://www.alarabiya.net/';

export default async function handler(req, res) {
  try {
    // Handle CORS preflight requests (OPTIONS)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    const rawPath = (req.query.path || []).join('/');
    const cleanPath = rawPath.split('?')[0];
    const upstreamUrl = `${UPSTREAM_BASE}${cleanPath}`;

    console.log(`Proxying: ${upstreamUrl}`);

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Vercel-HLS-Proxy/1.0)',
        'Referer': REFERER,
        'Origin': REFERER,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    console.log(`Status: ${upstreamRes.status}, Content-Type: ${upstreamRes.headers.get('content-type')}`);

    if (!upstreamRes.ok) {
      const errBody = await upstreamRes.text().catch(() => '');
      console.error(`Upstream error ${upstreamRes.status}:`, errBody);
      res.statusCode = upstreamRes.status;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Upstream error: ${upstreamRes.status}`);
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || '';

    // --- Handle M3U8 playlists ---
    if (cleanPath.endsWith('.m3u8') || contentType.includes('m3u8') || contentType.includes('x-mpegURL')) {
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      res.end(body);
      return;
    }

    // --- Handle TS segments and other files ---
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=10',
      'Content-Length': buffer.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Accept-Ranges': 'bytes',
    });
    res.end(buffer);

  } catch (error) {
    console.error('FATAL PROXY ERROR:', error.message);
    console.error(error.stack);
    res.statusCode = 500;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain');
    res.end('Internal Server Error');
  }
}

function resolveRelativePath(path) {
  const stack = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (stack.length > 0) stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return stack.join('/');
}
