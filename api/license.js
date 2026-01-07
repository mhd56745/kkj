// api/license.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // DRM Keys (hidden in server)
    const keys = [{
      kty: 'oct',
      kid: '264e7cb9dfd6b9e5c281c97db4c2b4fa',
      k: '47425a7e8f7e4030d186559852ae97db'
    }];
    
    res.status(200).json({ keys });
    
  } catch (error) {
    console.error('License error:', error);
    res.status(500).json({ error: 'License server error' });
  }
}
