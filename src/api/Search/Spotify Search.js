const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

  let accessToken = null;
  let tokenExpires = 0;

  async function getToken() {
    if (accessToken && Date.now() < tokenExpires) return accessToken;

    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            // Client ID y Secret públicos del web player de Spotify
            'd8a5ed958d274c2e8ee717e6a4b0971d:2f634bbc79d14e849f9d8a5e8b16c07e'
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
        }
      }
    );

    accessToken = data.access_token;
    tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
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
          'Accept': 'application/json'
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
      // Log para ver el error exacto
      console.error('Spotify error:', error.response?.data || error.message);

      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.response?.data?.error?.message || error.message || 'Error al buscar en Spotify'
      });
    }
  });
};
