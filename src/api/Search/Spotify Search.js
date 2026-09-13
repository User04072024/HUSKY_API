const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.delirius.online';

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
      const { data } = await axios.get(`${API_URL}/search/spotify`, {
        params: { q: text },
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Husky-API/1.0'
        }
      });

      if (!data?.status || !data?.data?.length) {
        throw new Error('No se encontraron resultados');
      }

      const results = data.data.map(track => ({
        title: track.title || track.name,
        artist: track.artist || track.artists,
        duration: track.duration,
        link: track.url || `https://open.spotify.com/track/${track.id}`
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
        error: error.response?.data?.error || error.message || 'Error al buscar en Spotify'
      });
    }
  });
};
