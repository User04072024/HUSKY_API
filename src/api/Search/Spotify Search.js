const cheerio = require('cheerio');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

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
      // 1. Usar un espejo con endpoint directo de API sin WAF Turnstile
      const searchUrl = `https://spotidown.app/action`;
      
      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://spotidown.app/'
        },
        body: new URLSearchParams({ url: text }).toString()
      });

      const responseText = await searchRes.text();
      let actionJson = null;

      try {
        actionJson = JSON.parse(responseText);
      } catch {
        // Si Cloudflare retorna HTML de bloqueo
        return res.status(503).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'IP de Vercel bloqueada por Cloudflare en Spotidown. Se requiere un servidor con IP residencial o VPS.'
        });
      }

      const htmlData = actionJson?.data;
      if (!htmlData) {
        return res.status(404).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'No se obtuvo respuesta válida del servidor'
        });
      }

      const $ = cheerio.load(htmlData);
      const primerForm = $('form[name="submitspurl"]').first();

      if (!primerForm.length) {
        return res.status(404).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'No se encontraron resultados'
        });
      }

      const inputData = primerForm.find('input[name="data"]').val();
      const base = primerForm.find('input[name="base"]').val() || '';
      const token = primerForm.find('input[name="token"]').val() || '';

      const trackMeta = JSON.parse(decodificarBase64UTF8(inputData) || '{}');

      // 2. Resolver track
      const trackRes = await fetch('https://spotidown.app/action/track', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://spotidown.app/'
        },
        body: new URLSearchParams({ data: inputData, base, token }).toString()
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
        error: error.message
      });
    }
  });
};
