const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function (app) {
  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєv舘٨ـ舘';
  const SPOTIDOWN_URL = 'https://spotidown.app';

  async function buscarSpotidown(text) {
    const params = new URLSearchParams();

    params.append('url', text);

    const response = await axios.post(
      `${SPOTIDOWN_URL}/action`,
      params.toString(),
      {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',
          Origin: SPOTIDOWN_URL,
          Referer: `${SPOTIDOWN_URL}/`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
        },
        timeout: 15000
      }
    );

    if (
      response.data?.error ||
      typeof response.data?.data !== 'string'
    ) {
      throw new Error(
        response.data?.message ||
        'SpotiDown no encontró resultados'
      );
    }

    const $ = cheerio.load(
      response.data.data
    );

    const results = [];

    $('form[name="submitspurl"]').each(
      (index, element) => {

        const encoded =
          $(element)
            .find('input[name="data"]')
            .attr('value');

        if (!encoded) return;

        let track;

        try {

          track = JSON.parse(
            Buffer
              .from(encoded, 'base64')
              .toString('utf8')
          );

        } catch {
          return;
        }

        if (!track) return;

        const id =
          track.tid ||
          track.id ||
          track.track_id ||
          '';

        let cover =
          track.cover ||
          track.image ||
          track.thumbnail ||
          track.album_cover ||
          '';

        const img =
          $(element)
            .find('img')
            .first();

        if (!cover) {
          cover =
            img.attr('src') ||
            img.attr('data-src') ||
            img.attr('data-lazy-src') ||
            img.attr('data-original') ||
            '';
        }

        if (!cover) {

          const srcset =
            img.attr('srcset');

          if (srcset) {

            const opciones =
              srcset
                .split(',')
                .map(x => x.trim())
                .filter(Boolean);

            if (opciones.length) {
              cover =
                opciones[
                  opciones.length - 1
                ].split(/\s+/)[0];
            }
          }
        }

        if (
          cover &&
          cover.startsWith('//')
        ) {
          cover =
            `https:${cover}`;
        }

        if (
          cover &&
          cover.startsWith('/')
        ) {
          cover =
            `${SPOTIDOWN_URL}${cover}`;
        }

        results.push({
          title:
            track.name ||
            track.title ||
            '',

          artist:
            track.artist ||
            track.artists ||
            '',

          album:
            track.album ||
            '',

          duration:
            track.duration ||
            '',

          date:
            track.date ||
            '',

          cover,

          id,

          link:
            id
              ? `https://open.spotify.com/track/${id}`
              : ''
        });
      }
    );

    if (!results.length) {
      throw new Error(
        'No se encontraron resultados'
      );
    }

    return results;
  }

  app.get('/search/spotify', async (req, res) => {

    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        error:
          'El parámetro "text" es obligatorio'
      });
    }

    try {

      const results =
        await buscarSpotidown(text);

      return res.json({
        status: true,
        creator: CREATOR,
        author: AUTHOR,
        query: text,
        source: 'spotidown',
        search_url:
          `https://open.spotify.com/search/results/${encodeURIComponent(text)}`,
        results
      });

    } catch (error) {

      console.error(
        '❌ SpotiDown:',
        error.message
      );

      return res.status(500).json({
        status: false,
        creator: CREATOR,
        author: AUTHOR,
        query: text,
        error:
          error.message ||
          'Error al buscar en Spotify'
      });
    }
  });
};
