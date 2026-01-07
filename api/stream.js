// api/stream.js
import axios from 'axios';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const baseUrl = `https://${req.headers.host}`;
    const sourceUrl = 'https://neacdnpop3-edge02.aws.playco.com/live/eds/ART_Aflam/DASH/ART_Aflam.mpd';
    
    // Fetch MPD
    const response = await axios.get(sourceUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    let mpdContent = response.data;
    
    // Replace URLs
    mpdContent = mpdContent.replace(
      /https:\/\/neacdnpop3-edge02\.aws\.playco\.com/g,
      `${baseUrl}/api/proxy`
    );
    
    // Add license URL
    mpdContent = mpdContent.replace(
      '<MPD',
      `<MPD xmlns:mspr="urn:microsoft:playready"
           xmlns:cenc="urn:mpeg:cenc:2013"`
    );
    
    res.setHeader('Content-Type', 'application/dash+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(mpdContent);
    
  } catch (error) {
    console.error('Stream error:', error.message);
    
    // Fallback MPD
    const baseUrl = `https://${req.headers.host}`;
    const fallbackMPD = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="dynamic" mediaPresentationDuration="PT60M">
  <Period start="PT0S">
    <AdaptationSet contentType="video" mimeType="video/mp4">
      <ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey">
        <cenc:pssh>AAAANHBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAABISEBER264e7cb9dfd6b9e5c281c97db4c2b4fa</cenc:pssh>
      </ContentProtection>
      <Representation bandwidth="2000000" codecs="avc1.640028" height="720" width="1280">
        <BaseURL>${baseUrl}/api/proxy/video</BaseURL>
        <SegmentTemplate media="video_$Number$.m4s" initialization="video_init.mp4" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="10000" r="359"/>
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
    
    res.setHeader('Content-Type', 'application/dash+xml');
    res.status(200).send(fallbackMPD);
  }
}
