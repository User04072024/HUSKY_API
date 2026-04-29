const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

  // Token en memoria
  let accessToken = null;
  let tokenExpires = 0;

  async function getToken() {
    if (accessToken && Date.now() < tokenExpires) return accessToken;

    const { data } = await axios.get('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'spotify-app-version': '1.2.30.1135.g1c9a9a1b',
        'app-platform': 'WebPlayer'
      }
    });

    accessToken = data.accessToken;
    tokenExpires = data.accessTokenExpirationTimestampMs - 5000;
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
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'app-platform': 'WebPlayer',
          'spotify-app-version': '1.2.30.1135.g1c9a9a1b'
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
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.response?.data?.error?.message || error.message || 'Error al buscar en Spotify'
      });
    }
  });
};
