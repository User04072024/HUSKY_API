const axios = require("axios");

module.exports = function (app) {
  app.get("/anime/waifu", async (req, res) => {
    try {
      // Obtener el JSON desde waifu.pics
      const response = await axios.get("https://api.waifu.pics/sfw/waifu");

      // Sacar la URL de la imagen
      const imageUrl = response.data.url;

      // Redirigir directamente a la imagen
      return res.redirect(302, imageUrl);
    } catch (error) {
      console.error("Gagal mengambil waifu:", error.message);

      return res.status(500).json({
        status: false,
        error: "No se pudo obtener la imagen waifu"
      });
    }
  });
};
