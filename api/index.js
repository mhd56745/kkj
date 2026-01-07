// api/index.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const baseUrl = `https://${req.headers.host}`;
  
  res.status(200).json({
    status: 'online',
    endpoints: {
      home: `${baseUrl}/`,
      stream: `${baseUrl}/api/stream`,
      hls: `${baseUrl}/api/hls`,
      player: `${baseUrl}/player.html`,
      license: `${baseUrl}/api/license`
    },
    instructions: 'Use /api/stream or /api/hls in any video player'
  });
}
