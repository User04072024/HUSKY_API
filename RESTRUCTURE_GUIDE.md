# Husky API reestructura sugerida

Ya quedaron creados estos archivos nuevos dentro del repo:

- `api-page/docs-v2.html`
- `api-page/assets/docs.css`
- `api-page/assets/docs.js`
- `src/data/notifications.json`

## Qué hace cada uno

### `api-page/docs-v2.html`
Es la nueva página de documentación separada.

### `api-page/assets/docs.css`
Contiene solo estilos del frontend de docs.

### `api-page/assets/docs.js`
Contiene solo la lógica del frontend de docs:
- cargar `openapi.json`
- renderizar categorías
- abrir modal de endpoint
- ejecutar requests
- cargar notificaciones

### `src/data/notifications.json`
Contiene las notificaciones que salen arriba.

## Cómo probarlo

Abre esta ruta:

- `/docs-v2.html`

## Cómo dejarlo como docs principal

Tienes dos opciones.

### Opción 1: reemplazo simple
Reemplaza el contenido actual de `api-page/docs.html` por el contenido de `api-page/docs-v2.html`.

### Opción 2: mantener dos versiones
Deja `docs.html` como viejo y usa `docs-v2.html` como nueva versión.

## Reestructura recomendada a futuro

```text
api-page/
  index.html
  docs.html
  docs-v2.html
  assets/
    docs.css
    docs.js

src/
  api/
    ai/
    anime/
    download/
    image/
    news/
  config/
    openapi.json
  data/
    notifications.json
  lib/
    helpers.js
```

## Cambio recomendado en `index.js`

Cuando quieras dejarlo más ordenado aún, cambia esto:

```js
app.use("/", express.static(path.join(__dirname, "api-page")));
app.use("/src", express.static(path.join(__dirname, "src")));
const openApiPath = path.join(__dirname, "./src/openapi.json");
```

por algo así:

```js
app.use("/", express.static(path.join(__dirname, "api-page")));
app.use("/assets", express.static(path.join(__dirname, "api-page", "assets")));
app.use("/src", express.static(path.join(__dirname, "src")));
app.use("/src/data", express.static(path.join(__dirname, "src", "data")));

const openApiPath = path.join(__dirname, "./src/config/openapi.json");
```

## Beneficio

Con esta separación, si agregas algo nuevo:
- no rompes toda la página
- puedes tocar solo CSS
- puedes tocar solo JS
- puedes tocar solo datos
- puedes tocar solo OpenAPI
