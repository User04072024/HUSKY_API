const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.delirius.store';

  function isSpotifyUrl(text = '') {
    return /^(https?:\/\/)?(www\.)?(open\.spotify\.com|spotify\.link)\/.+$/i.test(text);
  }

  async function downloadSpotify(urlTrack) {
    const url = `${API_URL}/download/spotifydl?url=${encodeURIComponent(urlTrack)}`;

    const { data } = await axios.get(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Husky-API/1.0'
      }
    });

    if (!data?.status || !data?.data?.download) {
      throw new Error('No se pudo obtener el enlace de descarga');
    }

    return data.data;
  }

  app.get('/download/spotify', async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: 'El parámetro "url" es obligatorio'
      });
    }

    if (!isSpotifyUrl(url)) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: 'La URL de Spotify no es válida'
      });
    }

    try {
      const result = await downloadSpotify(url);

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        result: {
          url,
          download: result.download
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.response?.data?.error || error.message || 'Error al descargar desde Spotify'
      });
    }
  });
};
