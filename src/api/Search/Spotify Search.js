const axios = require('axios');

module.exports = function (app) {

  const CREATOR = 'Husky API';
  const AUTHOR = 'ﮩ٨ـнυѕĸy_Dєv舘٨ـ舘';
  const SPOTIDOWN_URL = 'https://spotidown.app';

  // =========================================================
  // BASE64
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
  // PORTADA
  // =========================================================

  function obtenerCover(track) {

    return (
      track.cover ||
      track.image ||
      track.thumbnail ||
      ''
    );
  }

  // =========================================================
  // BUSCAR SPOTIDOWN
  // =========================================================

  async function buscarSpotify(text) {

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

    // =======================================================
    // VALIDAR RESPUESTA
    // =======================================================

    if (!response.data) {

      throw new Error(
        'SpotiDown no devolvió respuesta'
      );
    }

    if (
      typeof response.data.data !== 'string'
    ) {

      throw new Error(
        response.data.message ||
        'SpotiDown no devolvió datos válidos'
      );
    }

    // =======================================================
    // EXTRAER FORMULARIOS
    // =======================================================

    const html =
      response.data.data;

    const forms =
      html.match(
        /<form[^>]*name=["']submitspurl["'][^>]*>[\s\S]*?<\/form>/gi
      ) || [];

    const results = [];

    // =======================================================
    // PROCESAR CANCIONES
    // =======================================================

    for (
      let index = 0;
      index < forms.length;
      index++
    ) {

      const form =
        forms[index];

      const match =
        form.match(
          /<input[^>]*name=["']data["'][^>]*value=["']([^"']+)["']/i
        );

      if (!match) {
        continue;
      }

      const encoded =
        match[1];

      const decoded =
        decodificarBase64(
          encoded
        );

      if (!decoded) {
        continue;
      }

      let track;

      try {

        track =
          JSON.parse(
            decoded
          );

      } catch {

        continue;
      }

      if (!track) {
        continue;
      }

      // =====================================================
      // DATOS
      // =====================================================

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

      const cover =
        obtenerCover(
          track
        );

      const link =
        id
          ? `https://open.spotify.com/track/${id}`
          : '';

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
    }

    // =======================================================
    // VALIDAR RESULTADOS
    // =======================================================

    if (!results.length) {

      throw new Error(
        'No se encontraron canciones en la respuesta de SpotiDown'
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

      const {
        text
      } = req.query;

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
          await buscarSpotify(
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
          error.response?.data ||
          error.message ||
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

Pero hay un detalle importante

Este código usa exactamente la información que viene dentro de "track", igual que tu extractor del navegador.

Si SpotiDown devuelve algo como:

{
  name: "...",
  artist: "...",
  album: "...",
  duration: "...",
  date: "...",
  cover: "...",
  tid: "..."
}

la API devuelve:

{
  "title": "...",
  "artist": "...",
  "album": "...",
  "duration": "...",
  "date": "...",
  "cover": "...",
  "id": "...",
  "link": "https://open.spotify.com/track/..."
}

No utiliza Delirius, no necesita clave de Spotify y no llama a "/action/track". Solo utiliza "/action" para obtener la información de búsqueda.

Si después de subir este archivo exacto sigue apareciendo "FUNCTION_INVOCATION_FAILED", entonces ya no sería el "500" del endpoint sino muy probablemente un problema de runtime/dependencia o configuración de Vercel.
