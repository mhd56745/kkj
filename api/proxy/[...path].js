// api/proxy/[...path].js
// Full HLS restream proxy with path-rewriting for Vercel

export const config = { runtime: 'nodejs' };

const UPSTREAM_BASE = process.env.UPSTREAM_BASE; // "https://am01.plinkspile.cc/22388/"
const TOKEN         = process.env.UPSTREAM_TOKEN; // "xvLmwUQ8L4LPLm"

// Cache durations in seconds (set via env or defaults)
const CACHE_PLAYLIST = parseInt(process.env.CACHE_PLAYLIST) || 2;
const CACHE_SEGMENT  = parseInt(process.env.CACHE_SEGMENT)  || 10;

export default async function handler(req, res) {
  // -- 1. Build the upstream URL -------------------------------------------------
  const rawPath = (req.query.path || []).join('/');
  const cleanPath = rawPath.split('?')[0]; // strip any client query

  const upstreamUrl = `${UPSTREAM_BASE}${cleanPath}?token=${TOKEN}`;

  // -- 2. Fetch from origin ------------------------------------------------------
  const upstreamRes = await fetch(upstreamUrl, {
    headers: {
      'User-Agent': req.headers['user-agent'] || 'Vercel-HLS-Proxy',
    },
  });

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).send(upstreamRes.statusText);
    return;
  }

  const contentType = upstreamRes.headers.get('content-type') || '';

  // -- 3. Handle M3U8 playlists --------------------------------------------------
  if (cleanPath.endsWith('.m3u8') || contentType.includes('m3u8')) {
    let body = await upstreamRes.text();

    // Base URL of the proxy as seen by the client
    const proxyBase = `https://${req.headers.host}/api/proxy/`;

    // Directory of the current playlist (for resolving relative segments)
    const playlistDir = cleanPath.includes('/')
      ? cleanPath.substring(0, cleanPath.lastIndexOf('/') + 1)
      : '';

    // -- Rewrite every non-comment line ------------------------------------------
    body = body
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        // Keep empty lines and comments unchanged
        if (trimmed === '' || trimmed.startsWith('#')) return line;

        // -- Resolve the segment/variant URI -------------------------------------
        let resolved;
        // Absolute URL (e.g., http://...) — we can optionally proxy it or leave it.
        // Here we leave absolute URLs untouched, but you could proxy them too.
        if (/^https?:\/\//i.test(trimmed)) {
          return line;
        }
        // Root-relative path (starts with /) — treat it as relative to proxy base root
        if (trimmed.startsWith('/')) {
          resolved = proxyBase.slice(0, -1) + trimmed; // remove trailing slash
        }
        // Relative path — resolve against the playlist's directory
        else {
          // Join playlistDir + trimmed, then normalise ".." and "." segments
          const resolvedPath = resolveRelativePath(playlistDir + trimmed);
          resolved = proxyBase + resolvedPath;
        }

        return resolved;
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', `public, max-age=${CACHE_PLAYLIST}`);
    res.send(body);
    return;
  }

  // -- 4. Handle segments (.ts) and any other binary files -----------------------
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', `public, max-age=${CACHE_SEGMENT}`);

  // Stream the response body (Node.js runtime supports ReadableStream)
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
    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  }
}

// -- Helper to resolve "../" and "./" in relative paths ---------------------------
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
