const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

  let accessToken = null;
  let tokenExpires = 0;

  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async function getToken() {
    if (accessToken && Date.now() < tokenExpires) return accessToken;

    // Endpoint interno que usa la web de Spotify
    const { data } = await axios.get(
      'https://open.spotify.com/get_access_token',
      {
        params: {
          reason: 'transport',
          productType: 'web_player'
        },
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://open.spotify.com/',
          'Origin': 'https://open.spotify.com',
          'spotify-app-version': '1.2.46.467.g9a796c0d',
          'app-platform': 'WebPlayer',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        }
      }
    );

    if (!data?.accessToken) throw new Error('No se pudo obtener el token');

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
      console.log('Token:', token.substring(0, 30) + '...');

      const { data } = await axios.get('https://api.spotify.com/v1/search', {
        params: {
          q: text,
          type: 'track',
          limit: 10,
          market: 'ES'
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'app-platform': 'WebPlayer',
          'spotify-app-version': '1.2.46.467.g9a796c0d'
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
      console.error('Error completo:', error.response?.status, error.response?.data || error.message);

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
