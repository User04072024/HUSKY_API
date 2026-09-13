const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function (app) {

  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєv舘٨ـ舘';
  const SPOTIDOWN_URL = 'https://spotidown.app';

  // =========================================================
  // DECODIFICAR BASE64 UTF-8
  // =========================================================

  function decodificarBase64(base64) {

    try {

      return Buffer
        .from(base64, 'base64')
        .toString('utf8');

    } catch {

      return null;
    }
  }

  // =========================================================
  // NORMALIZAR URL DE PORTADA
  // =========================================================

  function normalizarCover(url) {

    if (!url) {
      return '';
    }

    url = String(url).trim();

    if (
      url.startsWith('//')
    ) {

      return 'https:' + url;
    }

    if (
      url.startsWith('/')
    ) {

      return SPOTIDOWN_URL + url;
    }

    return url;
  }

  // =========================================================
  // EXTRAER PORTADA
  // =========================================================

  function extraerCover($, form) {

    let cover = '';

    // -------------------------------------------------------
    // IMG PRINCIPAL
    // -------------------------------------------------------

    const img =
      $(form).find('img').first();

    if (img.length) {

      cover =
        img.attr('src') ||
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        '';

      // -----------------------------------------------------
      // SRCSET
      // -----------------------------------------------------

      if (
        !cover &&
        img.attr('srcset')
      ) {

        const srcset =
          img.attr('srcset')
            .split(',');

        if (srcset.length) {

          cover =
            srcset[
              srcset.length - 1
            ]
              .trim()
              .split(/\s+/)[0] || '';
        }
      }
    }

    // -------------------------------------------------------
    // CUALQUIER IMAGEN DENTRO DEL FORM
    // -------------------------------------------------------

    if (!cover) {

      $(form)
        .find('img')
        .each((i, element) => {

          if (cover) {
            return;
          }

          cover =
            $(element).attr('src') ||
            $(element).attr('data-src') ||
            $(element).attr('data-lazy-src') ||
            $(element).attr('data-original') ||
            '';

          if (
            !cover &&
            $(element).attr('srcset')
          ) {

            const srcset =
              $(element)
                .attr('srcset')
                .split(',');

            if (srcset.length) {

              cover =
                srcset[0]
                  .trim()
                  .split(/\s+/)[0] || '';
            }
          }
        });
    }

    // -------------------------------------------------------
    // OG IMAGE DEL DOCUMENTO
    // -------------------------------------------------------

    if (!cover) {

      cover =
        $('meta[property="og:image"]')
          .first()
          .attr('content') || '';
    }

    // -------------------------------------------------------
    // TWITTER IMAGE
    // -------------------------------------------------------

    if (!cover) {

      cover =
        $('meta[name="twitter:image"]')
          .first()
          .attr('content') || '';
    }

    return normalizarCover(
      cover
    );
  }

  // =========================================================
  // BUSCAR EN SPOTIDOWN
  // =========================================================

  async function buscarSpotidown(text) {

    const params =
      new URLSearchParams();

    params.append(
      'url',
      text
    );

    const response =
      await axios.post(
        `${SPOTIDOWN_URL}/action`,
        params.toString(),
        {
          headers: {

            Accept:
              'application/json, text/plain, */*',

            'Content-Type':
              'application/x-www-form-urlencoded; charset=UTF-8',

            Origin:
              SPOTIDOWN_URL,

            Referer:
              `${SPOTIDOWN_URL}/`,

            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
          },

          timeout: 15000
        }
      );

    if (!response.data) {

      throw new Error(
        'SpotiDown no devolvió respuesta'
      );
    }

    if (
      response.data.error ||
      typeof response.data.data !== 'string'
    ) {

      throw new Error(
        response.data.message ||
        'SpotiDown no encontró resultados'
      );
    }

    const html =
      response.data.data;

    const $ =
      cheerio.load(html);

    const results = [];

    // =======================================================
    // EXTRAER CANCIONES
    // =======================================================

    $('form[name="submitspurl"]').each(
      (index, element) => {

        try {

          const encoded =
            $(element)
              .find(
                'input[name="data"]'
              )
              .attr('value');

          if (!encoded) {
            return;
          }

          const decoded =
            decodificarBase64(
              encoded
            );

          if (!decoded) {
            return;
          }

          let track;

          try {

            track =
              JSON.parse(
                decoded
              );

          } catch {

            return;
          }

          if (!track) {
            return;
          }

          // -------------------------------------------------
          // DATOS ORIGINALES
          // -------------------------------------------------

          const id =
            track.tid ||
            track.id ||
            track.track_id ||
            '';

          const title =
            track.name ||
            track.title ||
            '';

          const artist =
            track.artist ||
            track.artists ||
            '';

          const album =
            track.album ||
            '';

          const duration =
            track.duration ||
            '';

          const date =
            track.date ||
            '';

          // -------------------------------------------------
          // PORTADA
          // -------------------------------------------------

          let cover =
            track.cover ||
            track.image ||
            track.thumbnail ||
            '';

          if (!cover) {

            cover =
              extraerCover(
                $,
                element
              );
          }

          cover =
            normalizarCover(
              cover
            );

          // -------------------------------------------------
          // LINK DIRECTO SPOTIFY
          // -------------------------------------------------

          const link =
            id
              ? `https://open.spotify.com/track/${id}`
              : '';

          // -------------------------------------------------
          // RESULTADO
          // -------------------------------------------------

          results.push({

            index:
              index + 1,

            title,

            artist,

            album,

            duration,

            date,

            cover,

            id,

            link
          });

        } catch (error) {

          console.error(
            '❌ Error procesando canción:',
            error.message
          );

        }
      }
    );

    // =======================================================
    // SI NO ENCONTRÓ RESULTADOS
    // =======================================================

    if (!results.length) {

      throw new Error(
        'No se encontraron resultados'
      );
    }

    return results;
  }

  // =========================================================
  // ENDPOINT
  // =========================================================

  app.get(
    '/search/spotify',
    async (req, res) => {

      const text =
        req.query.text;

      if (!text) {

        return res
          .status(400)
          .json({

            status: false,

            creator:
              CREATOR,

            author:
              AUTHOR,

            error:
              'El parámetro "text" es obligatorio'
          });
      }

      try {

        const results =
          await buscarSpotidown(
            text
          );

        return res.json({

          status: true,

          creator:
            CREATOR,

          author:
            AUTHOR,

          query:
            text,

          source:
            'spotidown',

          search_url:
            `https://open.spotify.com/search/results/${encodeURIComponent(text)}`,

          results
        });

      } catch (error) {

        console.error(
          '❌ Error Spotify:',
          error
        );

        return res
          .status(500)
          .json({

            status: false,

            creator:
              CREATOR,

            author:
              AUTHOR,

            query:
              text,

            error:
              error.message ||
              'Error al buscar en Spotify'
          });
      }
    }
  );
};

Qué devuelve ahora

Por cada canción:

{
  "index": 1,
  "title": "Believer",
  "artist": "Imagine Dragons",
  "album": "Evolve",
  "duration": "3:24",
  "date": "2017-06-23",
  "cover": "https://...",
  "id": "0pqnGHJpmpxLKifKRmU6WP",
  "link": "https://open.spotify.com/track/0pqnGHJpmpxLKifKRmU6WP"
}

La prioridad para "cover" es:

"track.cover" → "track.image" → "track.thumbnail" → imagen del formulario → "srcset" → "og:image" → "twitter:image"

Así no modificamos la forma en que SpotiDown entrega los datos y solamente ampliamos la obtención de la portada.
