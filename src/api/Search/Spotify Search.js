const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

  let accessToken = null;
  let tokenExpires = 0;

  async function getToken() {
    if (accessToken && Date.now() < tokenExpires) return accessToken;

    const { data: html } = await axios.get('https://open.spotify.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    // Extraer token del HTML
    const tokenMatch = html.match(/"accessToken":"([^"]+)"/);
    const expiresMatch = html.match(/"accessTokenExpirationTimestampMs":(\d+)/);

    if (!tokenMatch) throw new Error('No se pudo extraer el token de Spotify');

    accessToken = tokenMatch[1];
    tokenExpires = expiresMatch ? parseInt(expiresMatch[1]) - 5000 : Date.now() + 3300000;
    return accessToken;
  }

  function msToMinutes(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
      const token = await getToken();

      const { data } = await axios.get('https://api.spotify.com/v1/search', {
        params: {
          q: text,
          type: 'track',
          limit: 10
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'app-platform': 'WebPlayer'
        }
      });

      if (!data?.tracks?.items?.length) {
        throw new Error('No se encontraron resultados');
      }

      const results = data.tracks.items.map(track => ({
        title:    track.name,
        artist:   track.artists.map(a => a.name).join(', '),
        album:    track.album.name,
        duration: msToMinutes(track.duration_ms),
        image:    track.album.images[0]?.url || null,
        link:     track.external_urls.spotify
      }));

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        query: text,
        search_url: `https://open.spotify.com/search/results/${encodeURIComponent(text)}`,
        results
      });

    } catch (error) {
      console.error('Spotify error:', error.response?.data || error.message);

      // Si el token expiró, forzar renovación
      if (error.response?.status === 401) {
        accessToken = null;
        tokenExpires = 0;
      }

      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.response?.data?.error?.message || error.message || 'Error al buscar en Spotify'
      });
    }
  });
};
