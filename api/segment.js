import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // استخراج المسار من URL
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    // فك التشفير لو كان مرمزاً
    const segmentUrl = decodeURIComponent(url);
    
    const response = await axios({
      method: 'GET',
      url: segmentUrl,
      responseType: 'stream',
      timeout: 30000
    });
    
    // نسخ الرؤوس المهمة
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    // التخزين المؤقت
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // إرسال البيانات
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Error fetching segment:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch segment',
      url: url 
    });
  }
}
