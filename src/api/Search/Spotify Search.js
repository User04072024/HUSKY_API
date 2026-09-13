const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const SPOTIDOWN_BASE = 'https://spotidown.app';

  // ==========================================
  // HELPER FUNCTIONS (Decodificadores)
  // ==========================================

  function decodificarBase64UTF8(base64) {
    try {
      const buffer = Buffer.from(base64, 'base64');
      return buffer.toString('utf-8');
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

  function decodificarTrack(base64) {
    try {
      const texto = decodificarBase64UTF8(base64);
      if (!texto) return null;
      return JSON.parse(texto);
    } catch {
      return null;
    }
  }

  function analizarRapidURL(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('token');
      if (!token) return { url, token: null, jwt: null };

      return {
        url,
        token,
        jwt: decodificarJWT(token)
      };
    } catch {
      return { url, token: null, jwt: null };
    }
  }

  // Parseo simplificado de HTML usando expresiones regulares
  function extraerCancionesDesdeHTML(html) {
    const canciones = [];
    const formRegex = /<form[^>]*name="submitspurl"[^>]*>([\s\S]*?)<\/form>/gi;
    let match;
    let index = 1;

    while ((match = formRegex.exec(html)) !== null) {
      const formContent = match[1];

      const dataMatch = formContent.match(/name="data"\s+value="([^"]+)"/i);
      const baseMatch = formContent.match(/name="base"\s+value="([^"]+)"/i);
      const tokenMatch = formContent.match(/name="token"\s+value="([^"]+)"/i);

      if (dataMatch && dataMatch[1]) {
        const trackData = decodificarTrack(dataMatch[1]);
        if (trackData) {
          canciones.push({
            numero: index++,
            titulo: trackData.name || '',
            artista: trackData.artist || '',
            album: trackData.album || '',
            duracion: trackData.duration || '',
            fecha: trackData.date || '',
            cover: trackData.cover || '',
            tid: trackData.tid || '',
            link_spotify: trackData.tid ? `https://open.spotify.com/track/${trackData.tid}` : '',
            data: dataMatch[1],
            base: baseMatch ? baseMatch[1] : '',
            token: tokenMatch ? tokenMatch[1] : ''
          });
        }
      }
    }
    return canciones;
  }

  function extraerEnlacesDescarga(html) {
    const hrefRegex = /href="([^"]*rapid\.spotidown\.app[^"]*)"/gi;
    let match;
    let mp3 = null;
    let coverHD = null;
    let mp3JWT = null;
    let coverJWT = null;

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];
      const info = analizarRapidURL(href);

      if (info.jwt?.filename && !mp3) {
        mp3 = href;
        mp3JWT = info.jwt;
      } else if (info.jwt?.cover && !coverHD) {
        coverHD = href;
        coverJWT = info.jwt;
      }
    }

    return { mp3, coverHD, mp3JWT, coverJWT };
  }

  // ==========================================
  // ENDPOINT DE EXPRESS
  // ==========================================

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

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': SPOTIDOWN_BASE,
      'Referer': `${SPOTIDOWN_BASE}/`
    };

    try {
      // 1. Obtener lista de canciones desde Spotidown
      const bodyBusqueda = new URLSearchParams({ url: text });
      const responseAction = await axios.post(`${SPOTIDOWN_BASE}/action`, bodyBusqueda.toString(), { headers });

      if (!responseAction.data?.data) {
        throw new Error('No se obtuvo respuesta válida de Spotidown');
      }

      const canciones = extraerCancionesDesdeHTML(responseAction.data.data);

      if (!canciones.length) {
        return res.status(444).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'No se encontraron resultados para la búsqueda'
        });
      }

      // 2. Procesar cada canción individualmente para extraer portadas HD y links de descarga
      const results = await Promise.all(
        canciones.map(async (item) => {
          try {
            const bodyTrack = new URLSearchParams({
              data: item.data,
              base: item.base,
              token: item.token
            });

            const responseTrack = await axios.post(`${SPOTIDOWN_BASE}/action/track`, bodyTrack.toString(), { headers });
            const htmlTrack = responseTrack.data?.data || '';
            const descargas = extraerEnlacesDescarga(htmlTrack);

            return {
              title: item.titulo,
              artist: item.artista,
              album: item.album,
              duration: item.duracion,
              tid: item.tid,
              spotify_url: item.link_spotify,
              cover: descargas.coverJWT?.cover || item.cover,
              download: {
                mp3_link: descargas.mp3,
                cover_hd_link: descargas.coverHD,
                filename: descargas.mp3JWT?.filename || null,
                expires_at: descargas.mp3JWT?.exp ? new Date(descargas.mp3JWT.exp * 1000).toISOString() : null,
                internal_url: descargas.mp3JWT?.url || null
              }
            };
          } catch {
            // Retorno de contingencia si falla la llamada individual
            return {
              title: item.titulo,
              artist: item.artista,
              album: item.album,
              duration: item.duracion,
              tid: item.tid,
              spotify_url: item.link_spotify,
              cover: item.cover,
              download: null
            };
          }
        })
      );

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        query: text,
        total_results: results.length,
        results
      });

    } catch (error) {
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.response?.data?.error || error.message || 'Error al procesar con Spotidown'
      });
    }
  });
};
