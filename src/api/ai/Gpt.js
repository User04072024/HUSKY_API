const axios = require('axios');

module.exports = function (app) {
  async function chatgptChat(text, model = 'default') {
    try {
      // Cambia esta URL por la API/proveedor que realmente uses
      const { data } = await axios.get('https://tu-proveedor.com/ai/chatgpt', {
        params: {
          text,
          model,
          key: process.env.API_KEY
        }
      });

      if (!data || !data.result) {
        throw new Error('No se pudo obtener una respuesta válida');
      }

      return data.result;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Error al consultar ChatGPT'
      );
    }
  }

  // Route API
  app.get('/ai/chatgpt', async (req, res) => {
    const text = req.query.text || req.query.message;
    const { model } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        error: 'El parámetro "text" es obligatorio'
      });
    }

    try {
      const result = await chatgptChat(text, model);
      res.json({
        status: true,
        result
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message
      });
    }
  });
};
