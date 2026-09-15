const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "index.js");
const source = fs.readFileSync(file, "utf8");

const target = 'const { createCanvas } = require("@napi-rs/canvas");';
const replacement = `let createCanvas;\ntry {\n    ({ createCanvas } = require("@napi-rs/canvas"));\n} catch (error) {\n    console.warn("[HUSKY] @napi-rs/canvas no pudo cargarse. El servidor continuará sin generación de imágenes:", error.message);\n    createCanvas = null;\n}`;

if (source.includes(target)) {
    fs.writeFileSync(file, source.replace(target, replacement), "utf8");
    console.log("[HUSKY] Canvas protegido para Vercel.");
} else if (source.includes("let createCanvas;") && source.includes("@napi-rs/canvas")) {
    console.log("[HUSKY] Canvas ya está protegido.");
} else {
    console.warn("[HUSKY] No se encontró la importación de @napi-rs/canvas. No se realizaron cambios.");
}
