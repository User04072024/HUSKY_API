const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = function (app) {
  async function chatgptChat(text) {
    try {
      const apiBase = global.url_api || process.env.URL_API;
      const apiKey = global.key || global.apikey || process.env.APIKEY || process.env.API_KEY;

      if (!apiBase) {
        throw new Error('URL_API no está configurada');
      }

      if (!apiKey) {
        throw new Error('APIKEY no está configurada');
      }

      const url = `${apiBase}/chat?q=${encodeURIComponent(text)}&apikey=${apiKey}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!json?.success || !json?.data?.content) {
        throw new Error('Estructura de API inválida');
      }

      return json.data.content;
    } catch (error) {
      throw new Error(error.message || 'Error al conectar con ChatGPT');
    }
  }

  app.get('/ai/chatgpt', async (req, res) => {
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'Husky API',
        error: 'El parámetro "text" es obligatorio'
      });
    }

    try {
      const result = await chatgptChat(text);

      res.json({
        status: true,
        creator: 'Husky API',
        result
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        creator: 'Husky API',
        error: error.message
      });
    }
  });
};
