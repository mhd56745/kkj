import axios from 'axios';

export default async function handler(req, res) {
  // السماح لجميع النطاقات (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // جلب ملف MPD الأصلي
    const mpdUrl = 'https://neacdnpop3-edge02.aws.playco.com/live/eds/ART_Aflam/DASH/ART_Aflam.mpd';
    const response = await axios.get(mpdUrl, {
      timeout: 10000
    });
    
    let mpdContent = response.data;
    
    // استبدل الروابط الأصلية بروابط Vercel
    const baseUrl = `https://${req.headers.host}`;
    mpdContent = mpdContent.replace(
      /https:\/\/neacdnpop3-edge02\.aws\.playco\.com/g,
      `${baseUrl}/api/segment`
    );
    
    // إرجاع محتوى MPD المعدل
    res.setHeader('Content-Type', 'application/dash+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(mpdContent);
    
  } catch (error) {
    console.error('Error fetching manifest:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch manifest',
      details: error.message 
    });
  }
}
