// api/proxy/[...path].js
export const config = { runtime: 'nodejs' };

// ----- NEW STREAM: Al Arabiya / Al Hadath -----
const UPSTREAM_BASE = 'https://av.alarabiya.net/alarabiapublish/alhadath.smil/';
// No token needed – it’s a public stream

export default async function handler(req, res) {
  try {
    const rawPath = (req.query.path || []).join('/');
    const cleanPath = rawPath.split('?')[0];
    const upstreamUrl = `${UPSTREAM_BASE}${cleanPath}`;   // no ?token

    console.log(`Proxying: ${upstreamUrl}`);

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Vercel-HLS-Proxy',
        // Many news CDNs require a proper Referer
        'Referer': 'https://www.alarabiya.net/',
      },
    });

    if (!upstreamRes.ok) {
      const errBody = await upstreamRes.text().catch(() => '');
      console.error(`Upstream error: ${upstreamRes.status}`, errBody);
      res.statusCode = upstreamRes.status;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Upstream error: ${upstreamRes.status}`);
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || '';

    // --- M3U8 playlists ---
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
        'Access-Control-Allow-Origin': '*',
      });
      res.end(body);
      return;
    }

    // --- TS segments / other files ---
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=10',
      'Content-Length': buffer.length,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buffer);

  } catch (error) {
    console.error('FATAL ERROR:', error);
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
