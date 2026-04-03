const axios = require("axios");

module.exports = function (app) {
  app.get("/anime/waifu", async (req, res) => {
    try {
      // Obtener JSON de waifu.pics
      const { data } = await axios.get("https://api.waifu.pics/sfw/waifu");

      // Descargar la imagen
      const imgRes = await axios.get(data.url, {
        responseType: "arraybuffer",
      });

      // Detectar tipo real de imagen
      const contentType = imgRes.headers["content-type"] || "image/jpeg";

      // Enviar la imagen directamente sin cambiar la URL
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", imgRes.data.length);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.end(imgRes.data);
    } catch (error) {
      console.error("Gagal mengambil waifu:", error.message);
      return res.status(500).json({
        status: false,
        error: "No se pudo obtener la imagen waifu",
      });
    }
  });
};
