const axios = require('axios');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const API_URL = 'https://api.dix.lat';
  const API_KEY = 'VOKER_FREE_2026';

  async function chatgptChat(text) {
    const url = `${API_URL}/chat?q=${encodeURIComponent(text)}&apikey=${API_KEY}`;

    const { data } = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Husky-API/1.0'
      }
    });

    if (!data?.success || !data?.data?.content) {
      throw new Error('Estructura de API inválida');
    }

    return data.data.content;
  }

  app.get('/ai/chatgpt', async (req, res) => {
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
      const result = await chatgptChat(text);

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
        error: error.response?.data?.error || error.message || 'Error al conectar con ChatGPT'
      });
    }
  });
};
