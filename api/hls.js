// api/hls.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const baseUrl = `https://${req.headers.host}`;
  
  // DRM Key
  const keyData = {
    keys: [{
      kty: 'oct',
      kid: '264e7cb9dfd6b9e5c281c97db4c2b4fa',
      k: '47425a7e8f7e4030d186559852ae97db'
    }]
  };
  
  const keyBase64 = Buffer.from(JSON.stringify(keyData)).toString('base64');
  
  // HLS Playlist
  const m3u8 = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,${keyBase64}",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1"

#EXTINF:10.000000,
${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/segment1.ts')}
#EXTINF:10.000000,
${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/segment2.ts')}
#EXTINF:10.000000,
${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/segment3.ts')}
#EXTINF:10.000000,
${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/segment4.ts')}

#EXT-X-ENDLIST`;
  
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(m3u8);
}
