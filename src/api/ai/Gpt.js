const axios = require('axios');

module.exports = function (app) {
  async function chatgptChat(text) {
    try {
      const { data } = await axios.get('AQUI_TU_API_REAL', {
        params: {
          text
        }
      });

      // Ajusta estas opciones según cómo responda tu API externa
      const result =
        data?.result ||
        data?.response ||
        data?.message ||
        data?.answer ||
        data?.data?.result ||
        data?.data?.response ||
        data?.data?.message;

      if (!result) {
        throw new Error('La API externa no devolvió un campo de respuesta reconocido');
      }

      return result;
    } catch (error) {
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Error al consultar ChatGPT'
      );
    }
  }

  app.get('/ai/chatgpt', async (req, res) => {
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'Rynn UI',
        error: 'El parámetro "text" es obligatorio'
      });
    }

    try {
      const result = await chatgptChat(text);
      res.json({
        status: true,
        creator: 'Rynn UI',
        result
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        creator: 'Rynn UI',
        error: error.message
      });
    }
  });
};
