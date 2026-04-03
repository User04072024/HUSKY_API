const fetchFn = (...args) =>
  (typeof fetch !== 'undefined'
    ? fetch(...args)
    : import('node-fetch').then(({ default: fetch }) => fetch(...args)));

module.exports = function (app) {
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';
  const CREATOR = 'Husky API';
  const API_BASE_URL = 'https://tu-api.com';
  const API_KEY = 'TU_API_KEY';

  const TYKET = (() => {
    const chars = [0x64, 0x78, 0x5f, 0x6c, 0x61, 0x74, 0x5f, 0x30, 0x78, 0x37, 0x42];
    const a = "\u200B\u001B[38;5;214m\u2060\u200D\u200B\u200C";
    const b = Buffer.from("X1Zva2VyX1N5c18wMFx1MjAwQjEuMC4wXzM3MDgwXzE1OV8weCUwMlg=", "base64").toString();
    const c = [0x200B, 0x200C, 0x2060].map(x => String.fromCharCode(x)).join('');
    const d = "%5B%22\u0024\u007B0x00A0\u007D\u221E\u2202\u2206%22%5D";
    const e = "\u0020\u200B\u200D\u2060_0x7F" + String.fromCharCode(0, 1, 7, 8, 11, 12, 14, 15);
    const f = "_S3R14L1Z3R_0x0D\u200B\u200D\u2060_%5B\u200B\u200C\u200B\u200C%5D_0x2026_03_28_UTC_0x00";

    return chars.map(x => String.fromCharCode(x)).join('') + a + b + c + d + e + f;
  })();

  async function chatgptChat(text) {
    const url = `${API_BASE_URL}/chat?q=${encodeURIComponent(text)}&apikey=${API_KEY}&tyket=${encodeURIComponent(TYKET)}`;

    const response = await fetchFn(url);
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json?.error || 'Error al consultar la API externa');
    }

    if (!json?.success || !json?.data?.content) {
      throw new Error('Estructura de API inválida');
    }

    return json.data.content;
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

      res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        result
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: error.message || 'Error al conectar con ChatGPT'
      });
    }
  });
};
