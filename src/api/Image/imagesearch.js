const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.dix.lat';

  function isValidEstado(value) {
    return value === true || value === 'true' || value === 'verdadero';
  }

  async function searchImages(text) {
    try {
      const url = `${API_URL}/images?query=${encodeURIComponent(text)}`;

      const { data } = await axios.get(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Husky-API/1.0'
        }
      });

      if (!data || !isValidEstado(data.estado) || !Array.isArray(data.datos)) {
        throw new Error('Estructura de API inválida');
      }

      return {
        total: Number(data.contar) || data.datos.length || 0,
        results: data.datos.map((item) => ({
          title: item.titulo || 'Sin título',
          description: item.descripcion || 'Sin descripción',
          image: item.url_hd || null,
          metadata: {
            id: item.metadatos?.id || null,
            author: item.metadatos?.autor || null,
            dimensions: item.metadatos?.dimensiones || null
          }
        }))
      };
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Error al buscar imágenes'
      );
    }
  }

  app.get('/image/search', async (req, res) => {
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
      const result = await searchImages(text);

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        total: result.total,
        result: result.results
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.message
      });
    }
  });
};
