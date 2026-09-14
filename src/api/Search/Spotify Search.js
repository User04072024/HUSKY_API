const cheerio = require('cheerio');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const SPOTIDOWN_BASE = 'https://spotidown.app';

  function decodificarBase64UTF8(base64) {
    try {
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  function decodificarJWT(token) {
    try {
      const partes = token.split('.');
      if (partes.length < 2) return null;
      let payload = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4 !== 0) payload += '=';
      return JSON.parse(decodificarBase64UTF8(payload));
    } catch {
      return null;
    }
  }

  app.get('/search/spotify', async (req, res) => {
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: 'El parámetro "text" es obligatorio'
      });
    }

    try {
      // 1. Obtener la cookie de sesión inicial usando Fetch nativo de Node.js
      const initRes = await fetch(SPOTIDOWN_BASE, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const rawCookies = initRes.headers.getSetCookie 
        ? initRes.headers.getSetCookie() 
        : [initRes.headers.get('set-cookie')].filter(Boolean);

      const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');

      // 2. Realizar el POST a /action con las cabeceras exactas de Chrome
      const searchBody = new URLSearchParams({ url: text }).toString();

      const actionRes = await fetch(`${SPOTIDOWN_BASE}/action`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': SPOTIDOWN_BASE,
          'Referer': `${SPOTIDOWN_BASE}/`,
          'Cookie': cookieHeader,
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        body: searchBody
      });

      const actionJson = await actionRes.json().catch(() => null);
      const htmlData = actionJson?.data;

      if (!htmlData) {
        return res.status(403).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'Servidor remoto bloqueó la solicitud (Cloudflare WAF)'
        });
      }

      const $ = cheerio.load(htmlData);
      const primerForm = $('form[name="submitspurl"]').first();

      if (!primerForm.length) {
        return res.status(404).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'No se encontraron canciones para el término indicado'
        });
      }

      const inputData = primerForm.find('input[name="data"]').val();
      const base = primerForm.find('input[name="base"]').val() || '';
      const token = primerForm.find('input[name="token"]').val() || '';

      const trackMeta = JSON.parse(decodificarBase64UTF8(inputData) || '{}');

      // 3. Petición para obtener el enlace final de descarga MP3
      const trackBody = new URLSearchParams({
        data: inputData,
        base: base,
        token: token
      }).toString();

      const trackRes = await fetch(`${SPOTIDOWN_BASE}/action/track`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': SPOTIDOWN_BASE,
          'Referer': `${SPOTIDOWN_BASE}/`,
          'Cookie': cookieHeader,
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        body: trackBody
      });

      const trackJson = await trackRes.json().catch(() => null);
      const htmlTrack = trackJson?.data || '';

      const $track = cheerio.load(htmlTrack);
      let mp3Url = null;

      $track('a[href]').each((_, el) => {
        const href = $track(el).attr('href') || '';
        if (href.includes('rapid.spotidown.app')) {
          mp3Url = href;
        }
      });

      if (!mp3Url) {
        mp3Url = $track('a#popup').attr('href') || null;
      }

      let jwtData = null;
      if (mp3Url) {
        try {
          const parsed = new URL(mp3Url);
          const tParam = parsed.searchParams.get('token');
          if (tParam) jwtData = decodificarJWT(tParam);
        } catch {}
      }

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        query: text,
        results: [
          {
            title: trackMeta.name || '',
            artist: trackMeta.artist || '',
            album: trackMeta.album || '',
            duration: trackMeta.duration || '',
            tid: trackMeta.tid || '',
            spotify_url: trackMeta.tid ? `https://open.spotify.com/track/${trackMeta.tid}` : '',
            cover: trackMeta.cover || '',
            download: {
              mp3_link: mp3Url,
              filename: jwtData?.filename || null,
              expires_at: jwtData?.exp ? new Date(jwtData.exp * 1000).toISOString() : null,
              internal_url: jwtData?.url || null
            }
          }
        ]
      });

    } catch (error) {
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.message || 'Error interno en la ejecución del scraping'
      });
    }
  });
};
