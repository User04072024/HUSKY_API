const axios = require('axios');
const cheerio = require('cheerio');

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

  function decodificarTrack(base64) {
    try {
      const texto = decodificarBase64UTF8(base64);
      if (!texto) return null;
      return JSON.parse(texto);
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

  function extraerCanciones(html) {
    const $ = cheerio.load(html);
    const canciones = [];

    $('form[name="submitspurl"]').each((index, form) => {
      const inputData = $(form).find('input[name="data"]').val();
      if (!inputData) return;

      const track = decodificarTrack(inputData);
      if (!track) return;

      const base = $(form).find('input[name="base"]').val() || '';
      const token = $(form).find('input[name="token"]').val() || '';

      canciones.push({
        numero: index + 1,
        titulo: track.name || '',
        artista: track.artist || '',
        album: track.album || '',
        duracion: track.duration || '',
        fecha: track.date || '',
        cover: track.cover || '',
        tid: track.tid || '',
        spotify_url: track.tid ? `https://open.spotify.com/track/${track.tid}` : '',
        data: inputData,
        base,
        token
      });
    });

    return canciones;
  }

  function extraerResultadoTrack(html, cancionOriginal) {
    const $ = cheerio.load(html);

    const datos = {
      titulo: cancionOriginal?.titulo || $('[itemprop="name"]').text().trim() || '',
      artista: cancionOriginal?.artista || $('.spotidown-downloader-middle p span').text().trim() || '',
      album: cancionOriginal?.album || '',
      duracion: cancionOriginal?.duracion || '',
      tid: cancionOriginal?.tid || '',
      cover: cancionOriginal?.cover || $('.spotidown-downloader-left img').attr('src') || '',
      mp3: null,
      coverHD: null,
      mp3Token: null,
      coverToken: null,
      mp3JWT: null,
      coverJWT: null
    };

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || !href.includes('rapid.spotidown.app')) return;

      const texto = $(el).text().trim().toLowerCase();
      const info = analizarRapidURL(href);

      if (texto.includes('mp3') || info.jwt?.filename) {
        if (!datos.mp3) {
          datos.mp3 = href;
          datos.mp3Token = info.token;
          datos.mp3JWT = info.jwt;
        }
      } else if (texto.includes('cover') || info.jwt?.cover) {
        if (!datos.coverHD) {
          datos.coverHD = href;
          datos.coverToken = info.token;
          datos.coverJWT = info.jwt;
        }
        if (!datos.cover && info.jwt?.cover) {
          datos.cover = info.jwt.cover;
        }
      }
    });

    return datos;
  }

  // ==========================================
  // ENDPOINT EXPRESS
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

    try {
      // Instancia de axios para mantener cookies de sesión entre peticiones
      const client = axios.create({
        baseURL: SPOTIDOWN_BASE,
        withCredentials: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': SPOTIDOWN_BASE,
          'Referer': `${SPOTIDOWN_BASE}/`
        }
      });

      // 1. Obtener la página principal para establecer la cookie de sesión inicial
      const initResponse = await client.get('/');
      const cookies = initResponse.headers['set-cookie'];

      const requestHeaders = cookies ? { Cookie: cookies.join('; ') } : {};

      // 2. Realizar la búsqueda enviando la URL o texto
      const bodyAction = new URLSearchParams({ url: text }).toString();
      const responseAction = await client.post('/action', bodyAction, { headers: requestHeaders });

      const htmlData = responseAction.data?.data || (typeof responseAction.data === 'string' ? responseAction.data : null);

      if (!htmlData) {
        throw new Error('Respuesta vacía o bloqueada por el servidor de Spotidown');
      }

      const canciones = extraerCanciones(htmlData);

      if (!canciones.length) {
        return res.status(444).json({
          status: false,
          creator: CREATOR,
          author: AUTHOR,
          error: 'No se encontraron resultados para la búsqueda'
        });
      }

      // 3. Procesar las canciones para extraer el link de audio y portada HD
      const results = await Promise.all(
        canciones.map(async (cancion) => {
          try {
            const bodyTrack = new URLSearchParams({
              data: cancion.data,
              base: cancion.base,
              token: cancion.token
            }).toString();

            const responseTrack = await client.post('/action/track', bodyTrack, { headers: requestHeaders });
            const htmlTrack = responseTrack.data?.data || '';

            const trackInfo = extraerResultadoTrack(htmlTrack, cancion);

            return {
              title: trackInfo.titulo,
              artist: trackInfo.artista,
              album: trackInfo.album,
              duration: trackInfo.duracion,
              tid: trackInfo.tid,
              spotify_url: cancion.spotify_url,
              cover: trackInfo.cover,
              download: {
                mp3_link: trackInfo.mp3,
                cover_hd_link: trackInfo.coverHD,
                filename: trackInfo.mp3JWT?.filename || null,
                expires_at: trackInfo.mp3JWT?.exp ? new Date(trackInfo.mp3JWT.exp * 1000).toISOString() : null,
                internal_url: trackInfo.mp3JWT?.url || null
              }
            };
          } catch {
            return {
              title: cancion.titulo,
              artist: cancion.artista,
              album: cancion.album,
              duration: cancion.duracion,
              tid: cancion.tid,
              spotify_url: cancion.spotify_url,
              cover: cancion.cover,
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
        error: error.response?.data?.error || error.message || 'Error al procesar la petición'
      });
    }
  });
};
