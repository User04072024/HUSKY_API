const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  let accessToken = null;
  let tokenExpires = 0;

  async function fetchSpotify(endpoint, params = {}) {
    if (!accessToken || Date.now() >= tokenExpires) {
      const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
      const { data } = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      accessToken = data.access_token;
      tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
    }

    const { data } = await axios.get(`https://api.spotify.com/${endpoint}`, {
      params,
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return data;
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
      const data = await fetchSpotify('v1/search', {
        q: text,
        type: 'track',
        limit: 10,
        market: 'ES'
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
