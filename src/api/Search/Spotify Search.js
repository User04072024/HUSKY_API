const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

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
      // Llamada a spotsaver.net en lugar de delirius
      const { data } = await axios.get('https://spotsaver.net/api/spotify/', {
        params: { q: text },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Verificar si hay resultados
      if (!data?.items || data.items.length === 0) {
        throw new Error('No se encontraron resultados');
      }

      // Mapear resultados al formato de tu API
      const results = data.items.map(track => ({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        duration_formatted: `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`,
        thumbnail: track.thumbnail,
        preview_url: track.previewUrl,
        id: track.id
      }));

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        query: text,
        source: 'spotsaver.net',
        total_results: results.length,
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

  // Opcional: Endpoint para obtener URL de descarga completa (MP3)
  app.get('/download/spotify', async (req, res) => {
    const { title, artist } = req.query;

    if (!title || !artist) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: 'Los parámetros "title" y "artist" son obligatorios'
      });
    }

    try {
      // Paso 1: Obtener videoId
      const idResponse = await axios.post('https://spotsaver.net/api/get-id/', {
        title: title,
        artist: artist
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!idResponse.data?.videoId) {
        throw new Error('No se encontró fuente de descarga');
      }

      const videoId = idResponse.data.videoId;

      // Paso 2: Obtener URL de descarga
      const downloadResponse = await axios.post('https://spotsaver.net/api/download/', {
        videoId: videoId,
        candidateIds: [],
        format: "mp3",
        title: `${title} - ${artist}`,
        licenseKey: null
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        title: title,
        artist: artist,
        video_id: videoId,
        download_url: downloadResponse.data?.downloadUrl || downloadResponse.data?.url,
        filename: downloadResponse.data?.filename,
        format: 'mp3'
      });

    } catch (error) {
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.response?.data?.error || error.message || 'Error al obtener enlace de descarga'
      });
    }
  });
};
