const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.dix.lat';

  function isTruthyStatus(value) {
    return (
      value === true ||
      value === 'true' ||
      value === 'verdadero' ||
      value === 'success' ||
      value === 'ok'
    );
  }

  function pickArray(data) {
    if (Array.isArray(data?.datos)) return data.datos;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.result)) return data.result;
    return null;
  }

  function pickCount(data, items) {
    return (
      Number(data?.contar) ||
      Number(data?.count) ||
      Number(data?.total) ||
      items.length ||
      0
    );
  }

  function mapItem(item) {
    return {
      title: item?.titulo || item?.title || 'Sin título',
      description: item?.descripcion || item?.description || 'Sin descripción',
      image: item?.url_hd || item?.url || item?.image || null,
      metadata: {
        id: item?.metadatos?.id || item?.metadata?.id || null,
        author: item?.metadatos?.autor || item?.metadata?.author || null,
        dimensions: item?.metadatos?.dimensiones || item?.metadata?.dimensions || null
      }
    };
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

      const items = pickArray(data);
      const ok =
        isTruthyStatus(data?.estado) ||
        isTruthyStatus(data?.status) ||
        items !== null;

      if (!data || !ok || !Array.isArray(items)) {
        console.log('Respuesta real de /images:', data);
        throw new Error('Estructura de API inválida');
      }

      return {
        total: pickCount(data, items),
        results: items.map(mapItem)
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
