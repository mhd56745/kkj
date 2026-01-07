export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // المفاتيح - يمكن وضعها في متغيرات بيئية
    const DRM_KEYS = [
      {
        kty: 'oct',
        kid: '264e7cb9dfd6b9e5c281c97db4c2b4fa',
        k: '47425a7e8f7e4030d186559852ae97db'
      }
    ];
    
    // التحقق من الطلب
    const { kids } = req.body;
    
    if (!kids || !Array.isArray(kids)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }
    
    // البحث عن المفاتيح المطلوبة
    const requestedKeys = DRM_KEYS.filter(key => kids.includes(key.kid));
    
    res.status(200).json({
      keys: requestedKeys
    });
    
  } catch (error) {
    console.error('License error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
