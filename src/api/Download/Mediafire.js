const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєvﮩ٨ـﮩ';

  function isMediafireUrl(text = '') {
    return /^(https?:\/\/)?(www\.)?mediafire\.com\/.+$/i.test(text);
  }

  async function mediafireDL(url) {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html'
      }
    });

    const $ = cheerio.load(data);

    const dlLink =
      $('#downloadButton').attr('href') ||
      $('.download_link a').attr('href');

    const filename = (
      $('.dl-info .filename').text() ||
      $('div.filename').text() ||
      'archivo'
    ).trim().split('\n')[0];

    const filesize =
      $('.details li:contains("File size:") span').text().trim() ||
      $('.filesize').first().text().trim() ||
      'Desconocido';

    const filetype =
      $('.filetype').first().text().trim() || 'Desconocido';

    const uploadDate =
      $('.details li:contains("Uploaded:") span').text().trim() ||
      'No disponible';

    if (!dlLink) throw new Error('No se pudo obtener el enlace de descarga.');

    return { filename, filesize, filetype, uploadDate, download: dlLink };
  }

  app.get('/download/mediafire', async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: 'El parámetro "url" es obligatorio'
      });
    }

    if (!isMediafireUrl(url)) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error: 'La URL de MediaFire no es válida'
      });
    }

    try {
      const result = await mediafireDL(url);

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
        error: error.message || 'Error al procesar el enlace de MediaFire'
      });
    }
  });
};
