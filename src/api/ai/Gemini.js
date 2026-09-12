const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.delirius.online';

  function extractResult(data) {
    if (!data) return null;

    if (typeof data.data === 'string' && data.data.trim()) {
      return data.data.trim();
    }

    if (typeof data.result === 'string' && data.result.trim()) {
      return data.result.trim();
    }

    if (typeof data.response === 'string' && data.response.trim()) {
      return data.response.trim();
    }

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    if (typeof data.content === 'string' && data.content.trim()) {
      return data.content.trim();
    }

    if (typeof data.data?.content === 'string' && data.data.content.trim()) {
      return data.data.content.trim();
    }

    if (typeof data.data?.result === 'string' && data.data.result.trim()) {
      return data.data.result.trim();
    }

    return null;
  }

  async function geminiChat(text) {
    try {
      const url = `${API_URL}/ia/chatgpt?q=${encodeURIComponent(text)}`;

      const response = await axios.get(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Husky-API/1.0'
        },
        timeout: 20000,
        validateStatus: () => true
      });

      const data = response.data;

      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          data?.error ||
          data?.message ||
          `La API externa respondió con estado ${response.status}`
        );
      }

      const result = extractResult(data);

      if (!result) {
        console.log('Respuesta real de Delirius:', data);
        throw new Error('Estructura de API inválida');
      }

      return result;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Error al conectar con Gemini'
      );
    }
  }

  app.get('/ai/gemini', async (req, res) => {
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
      const result = await geminiChat(text);

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        result
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
