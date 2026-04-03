const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.delirius.store';

  async function geminiChat(text) {
    try {
      const url = `${API_URL}/ia/chatgpt?q=${encodeURIComponent(text)}`;

      const { data } = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Husky-API/1.0'
        }
      });

      const result =
        data?.result ||
        data?.response ||
        data?.message ||
        data?.data?.result ||
        data?.data?.response ||
        data?.data?.message ||
        data?.data?.content;

      if (!result) {
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
