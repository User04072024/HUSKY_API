const state = {
  categories: [],
  currentEndpoint: null,
  searchTerm: ""
};

const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarClose = document.getElementById("sidebarClose");

const endpointModal = document.getElementById("endpointModal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const endpointForm = document.getElementById("endpointForm");
const formFields = document.getElementById("formFields");
const responseSection = document.getElementById("responseSection");
const requestUrlBox = document.getElementById("requestUrlBox");
const curlBox = document.getElementById("curlBox");
const responseBox = document.getElementById("responseBox");
const clearResponseBtn = document.getElementById("clearResponseBtn");
const searchInput = document.getElementById("searchInput");
const apiList = document.getElementById("apiList");
const emptyState = document.getElementById("emptyState");
const categoryCount = document.getElementById("categoryCount");
const endpointCount = document.getElementById("endpointCount");
const notificationCount = document.getElementById("notificationCount");

const endpointTranslations = {
  "/ai/copilot": {
    summary: "Chat de Copilot",
    description: "Envía preguntas a Microsoft Copilot y obtén respuestas junto con referencias/citas.",
    parameters: {
      message: {
        description: "Mensaje o pregunta que quieres enviar a Copilot"
      },
      model: {
        description: "Modelo de Copilot que se utilizará (predeterminado: default; opcional: think-deeper, gpt-5)"
      }
    }
  },
  "/ai/venice": {
    summary: "Chat de Venice AI",
    description: "Envía preguntas a Venice AI y obtén una respuesta final."
  },
  "/anime/waifu": {
    summary: "Waifu",
    description: "Obtiene una imagen aleatoria de waifu desde la API."
  },
  "/download/capcut": {
    summary: "Descargador de CapCut",
    description: "Obtiene datos y video de una plantilla de CapCut a partir de su URL."
  },
  "/download/pinterest": {
    summary: "Pinterest",
    description: "Obtiene datos y enlaces multimedia desde una URL de Pinterest o pin.it."
  },
  "/download/tiktok": {
    summary: "TikTok",
    description: "Descarga video de TikTok."
  },
  "/image/bluearchive": {
    summary: "Blue Archive",
    description: "Imágenes aleatorias de Blue Archive."
  },
  "/image/loli": {
    summary: "Loli",
    description: "Imágenes aleatorias de loli."
  },
  "/image/mpls": {
    summary: "Generador MPLS",
    description: "Crea un marco/twibbon usando la foto del usuario."
  },
  "/image/papayang": {
    summary: "Papayang",
    description: "Imágenes aleatorias de Papayang."
  },
  "/image/wallpaper": {
    summary: "Wallpaper",
    description: "Imágenes aleatorias desde WallpaperFlare según una búsqueda."
  },
  "/news/detik": {
    summary: "Noticias Detik",
    description: "Extrae noticias populares de Detik.com."
  },
  "/news/kontan": {
    summary: "Noticias Kontan",
    description: "Extrae noticias recientes de Kontan.co.id."
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function categoryIcon(name = "") {
  const label = String(name).toLowerCase();

  if (label.includes("ai") || label.includes("bot") || label.includes("copilot")) {
    return "smart_toy";
  }
  if (label.includes("image") || label.includes("anime") || label.includes("wallpaper")) {
    return "image";
  }
  if (label.includes("download") || label.includes("media")) {
    return "download";
  }
  if (label.includes("news") || label.includes("noticia")) {
    return "newspaper";
  }
  if (label.includes("tool") || label.includes("util") || label.includes("convert")) {
    return "build";
  }
  if (label.includes("search") || label.includes("finder")) {
    return "travel_explore";
  }

  return "folder_open";
}

function methodClass(method = "") {
  const normalized = String(method).toLowerCase();
  return ["get", "post", "put", "patch", "delete"].includes(normalized)
    ? normalized
    : "get";
}

function localizeSpec(spec) {
  if (!spec || !spec.paths) return spec;

  Object.entries(spec.paths).forEach(([path, methods]) => {
    const translation = endpointTranslations[path];
    if (!translation) return;

    Object.values(methods || {}).forEach((endpoint) => {
      if (translation.summary) endpoint.summary = translation.summary;
      if (translation.description) endpoint.description = translation.description;

      if (endpoint.parameters && translation.parameters) {
        endpoint.parameters = endpoint.parameters.map((param) => {
          const translatedParam = translation.parameters[param.name];
          if (translatedParam?.description) {
            return { ...param, description: translatedParam.description };
          }
          return param;
        });
      }
    });
  });

  return spec;
}

function normalizeCategories(spec) {
  const map = {};

  (spec.tags || []).forEach((tag) => {
    map[tag.name] = { name: tag.name, items: [], open: false };
  });

  Object.entries(spec.paths || {}).forEach(([path, methods]) => {
    Object.entries(methods || {}).forEach(([method, endpoint]) => {
      const tagName = endpoint.tags && endpoint.tags.length ? endpoint.tags[0] : "Uncategorized";
      if (!map[tagName]) {
        map[tagName] = { name: tagName, items: [], open: false };
      }

      map[tagName].items.push({
        path,
        method: String(method).toUpperCase(),
        summary: endpoint.summary || "Sin resumen",
        description: endpoint.description || "Sin descripción",
        parameters: endpoint.parameters || [],
        requestBody: endpoint.requestBody || null,
        deprecated: !!endpoint.deprecated
      });
    });
  });

  return Object.values(map)
    .map((category, index) => ({
      ...category,
      open: index < 2,
      items: category.items.sort((a, b) => a.path.localeCompare(b.path))
    }))
    .filter((category) => category.items.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function openSidebar() {
  sidebar.classList.remove("translate-x-full");
  backdrop.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeSidebar() {
  sidebar.classList.add("translate-x-full");
  backdrop.classList.add("hidden");
  if (endpointModal.classList.contains("hidden")) {
    document.body.classList.remove("overflow-hidden");
  }
}

function openModal(endpoint) {
  state.currentEndpoint = endpoint;

  document.getElementById("modalMethod").textContent = endpoint.method;
  document.getElementById("modalMethod").className = `future-method-pill ${methodClass(endpoint.method)}`;
  document.getElementById("modalPath").textContent = endpoint.path;
  document.getElementById("modalSummary").textContent = endpoint.summary || "Sin resumen";
  document.getElementById("modalDescription").textContent = endpoint.description || "Sin descripción";

  formFields.innerHTML = buildFields(endpoint);
  clearResponse();

  endpointModal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeModal() {
  endpointModal.classList.add("hidden");
  state.currentEndpoint = null;
  if (backdrop.classList.contains("hidden")) {
    document.body.classList.remove("overflow-hidden");
  }
}

function filteredCategories() {
  const query = state.searchTerm.trim().toLowerCase();

  return state.categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        if (!query) return true;
        const text = [
          category.name,
          item.path,
          item.summary,
          item.description,
          item.method
        ].join(" ").toLowerCase();
        return text.includes(query);
      })
    }))
    .filter((category) => category.items.length > 0);
}

function updateHeroCounts(categories) {
  const totalCategories = categories.length;
  const totalEndpoints = categories.reduce((count, category) => count + category.items.length, 0);

  if (categoryCount) categoryCount.textContent = `${totalCategories} categorías`;
  if (endpointCount) endpointCount.textContent = `${totalEndpoints} endpoints`;
}

function renderApiList() {
  const categories = filteredCategories();
  updateHeroCounts(categories);

  if (!categories.length) {
    apiList.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  apiList.innerHTML = categories
    .map((category) => {
      const icon = categoryIcon(category.name);
      const total = category.items.length;

      return `
        <article class="future-folder-card ${category.open ? "is-open" : ""}">
          <button
            type="button"
            class="future-folder-toggle"
            onclick="toggleCategory('${escapeAttr(category.name)}')"
          >
            <div class="future-folder-left">
              <span class="future-folder-icon material-icons">${icon}</span>
              <div class="min-w-0">
                <div class="future-folder-name break-anywhere">${escapeHtml(category.name)}</div>
                <div class="future-folder-count">${total} endpoint${total > 1 ? "s" : ""}</div>
              </div>
            </div>
            <span class="future-folder-chevron material-icons">expand_more</span>
          </button>

          <div class="future-folder-body ${category.open ? "block" : "hidden"}">
            <div class="space-y-3">
              ${category.items
                .map(
                  (item, index) => `
                    <article class="future-endpoint-card">
                      <button
                        type="button"
                        class="future-endpoint-btn"
                        onclick="openEndpointByFilter('${escapeAttr(category.name)}', ${index})"
                      >
                        <div class="future-method-row">
                          <span class="future-method-pill ${methodClass(item.method)}">${escapeHtml(item.method)}</span>
                          <span class="future-status-pill">${item.deprecated ? "deprecated" : "ready"}</span>
                        </div>
                        <div translate="no" class="notranslate future-endpoint-path break-anywhere">${escapeHtml(item.path)}</div>
                        <div class="future-endpoint-summary break-anywhere">${escapeHtml(item.summary)}</div>
                      </button>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function toggleCategory(categoryName) {
  const category = state.categories.find((item) => item.name === categoryName);
  if (!category) return;
  category.open = !category.open;
  renderApiList();
}

function openEndpointByFilter(categoryName, filteredIndex) {
  const categories = filteredCategories();
  const category = categories.find((item) => item.name === categoryName);
  if (!category) return;
  const endpoint = category.items[filteredIndex];
  if (endpoint) openModal(endpoint);
}

function buildFields(endpoint) {
  const fields = [];

  (endpoint.parameters || []).forEach((param) => {
    const schema = param.schema || {};
    const required = !!param.required;
    const helper = param.description
      ? `<p class="future-input-helper">${escapeHtml(param.description)}</p>`
      : "";
    const placeholder = escapeAttr(schema.example ?? schema.default ?? "");
    const label = `${escapeHtml(param.name)}${required ? ' <span class="text-rose-400">*</span>' : ""}`;

    if (Array.isArray(schema.enum) && schema.enum.length) {
      fields.push(`
        <div class="future-input-card">
          <label class="future-input-label">${label}</label>
          <select name="${escapeAttr(param.name)}" class="future-select" ${required ? "required" : ""}>
            ${schema.enum.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("")}
          </select>
          ${helper}
        </div>
      `);
      return;
    }

    if (schema.type === "boolean") {
      fields.push(`
        <div class="future-input-card">
          <label class="future-input-label">${label}</label>
          <select name="${escapeAttr(param.name)}" class="future-select" ${required ? "required" : ""}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          ${helper}
        </div>
      `);
      return;
    }

    const inputType = schema.type === "number" || schema.type === "integer" ? "number" : "text";
    fields.push(`
      <div class="future-input-card">
        <label class="future-input-label">${label}</label>
        <input
          type="${inputType}"
          name="${escapeAttr(param.name)}"
          placeholder="${placeholder}"
          class="future-input"
          ${required ? "required" : ""}
        />
        ${helper}
      </div>
    `);
  });

  const content = endpoint.requestBody?.content || {};

  if (content["application/json"]) {
    fields.push(`
      <div class="future-input-card md:col-span-2">
        <label class="future-input-label">Body (application/json)</label>
        <textarea
          name="__raw_json__"
          rows="7"
          placeholder='{"key":"value"}'
          class="future-textarea"
        ></textarea>
        <p class="future-input-helper">Si llenas este campo, la solicitud se enviará como JSON.</p>
      </div>
    `);
  }

  if (!fields.length) {
    return `
      <div class="future-input-card">
        <p class="future-input-helper">Este endpoint no requiere parámetros.</p>
      </div>
    `;
  }

  return `<div class="future-form-grid two-cols">${fields.join("")}</div>`;
}

function buildCurl(method, url, rawJson) {
  let curl = `curl -X ${method} \"${url}\"`;

  if (rawJson && ["POST", "PUT", "PATCH"].includes(method)) {
    const safeJson = rawJson.replace(/'/g, `'\\''`);
    curl += ` -H \"Content-Type: application/json\" -d '${safeJson}'`;
  }

  return curl;
}

function docsCodeEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightJson(text = "") {
  const escaped = docsCodeEscape(text);
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|\b-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?\b|([{}\[\],])/g,
    (match, stringToken, isKey, boolOrNull, punctuation) => {
      if (punctuation) {
        return `<span class="future-token-punctuation">${punctuation}</span>`;
      }
      if (boolOrNull) {
        if (boolOrNull === "null") {
          return `<span class="future-token-null">${boolOrNull}</span>`;
        }
        return `<span class="future-token-boolean">${boolOrNull}</span>`;
      }
      if (/^-?\d/.test(match)) {
        return `<span class="future-token-number">${match}</span>`;
      }
      if (stringToken) {
        if (isKey) {
          return `<span class="future-token-key">${stringToken}</span><span class="future-token-punctuation">:</span>`;
        }
        return `<span class="future-token-string">${stringToken}</span>`;
      }
      return match;
    }
  );
}

function highlightCurl(text = "") {
  let escaped = docsCodeEscape(text);
  escaped = escaped.replace(/\bcurl\b/g, `<span class="future-token-command">curl</span>`);
  escaped = escaped.replace(/(\s)(-[A-Za-z-]+)/g, `$1<span class="future-token-flag">$2</span>`);
  escaped = escaped.replace(/\"(https?:\/\/[^\"]+)\"/g, `\"<span class="future-token-url">$1</span>\"`);
  escaped = escaped.replace(/'([^']*)'/g, `'<span class="future-token-string">$1</span>'`);
  return escaped;
}

function highlightUrl(text = "") {
  const escaped = docsCodeEscape(text);
  const [base, query = ""] = escaped.split("?");

  let html = `<span class="future-token-url">${base}</span>`;
  if (query) {
    html += `<span class="future-token-punctuation">?</span>`;
    const parts = query.split("&");
    html += parts
      .map((part, index) => {
        const [key, value = ""] = part.split("=");
        const prefix = index > 0 ? `<span class="future-token-punctuation">&amp;</span>` : "";
        return `${prefix}<span class="future-token-query-key">${key}</span><span class="future-token-punctuation">=</span><span class="future-token-query-value">${value}</span>`;
      })
      .join("");
  }
  return html;
}

function highlightPlain(text = "") {
  return `<span class="future-token-plain">${docsCodeEscape(text)}</span>`;
}

function highlightError(text = "") {
  return `<span class="future-token-error">${docsCodeEscape(text)}</span>`;
}

function setCodeBlock(target, text = "", type = "plain") {
  const node = typeof target === "string" ? document.getElementById(target) : target;
  if (!node) return;

  switch (type) {
    case "json":
      node.innerHTML = highlightJson(text);
      break;
    case "curl":
      node.innerHTML = highlightCurl(text);
      break;
    case "url":
      node.innerHTML = highlightUrl(text);
      break;
    case "error":
      node.innerHTML = highlightError(text);
      break;
    default:
      node.innerHTML = highlightPlain(text);
      break;
  }
}

function clearResponse() {
  responseSection.classList.add("hidden");
  setCodeBlock(requestUrlBox, "", "plain");
  setCodeBlock(curlBox, "", "plain");
  setCodeBlock(responseBox, "", "plain");
}

async function executeEndpoint(event) {
  event.preventDefault();

  const endpoint = state.currentEndpoint;
  if (!endpoint) return;

  const formData = new FormData(endpointForm);
  const method = endpoint.method.toUpperCase();
  const rawJson = String(formData.get("__raw_json__") || "").trim();

  let path = endpoint.path;
  const options = { method };

  if (["POST", "PUT", "PATCH"].includes(method)) {
    if (rawJson) {
      options.headers = { "Content-Type": "application/json" };
      options.body = rawJson;
    }
  } else {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (key === "__raw_json__") continue;
      if (typeof value === "string" && value) {
        params.append(key, value);
      }
    }
    const query = params.toString();
    if (query) {
      path += (path.includes("?") ? "&" : "?") + query;
    }
  }

  const fullUrl = `${window.location.origin}${path}`;
  setCodeBlock(requestUrlBox, fullUrl, "url");
  setCodeBlock(curlBox, buildCurl(method, fullUrl, rawJson), "curl");
  setCodeBlock(responseBox, "Cargando...", "plain");
  responseSection.classList.remove("hidden");

  try {
    const response = await fetch(path, options);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`${response.status} ${response.statusText}${errorText ? "\n\n" + errorText : ""}`);
    }

    if (contentType.includes("application/json")) {
      const data = await response.json();
      setCodeBlock(responseBox, JSON.stringify(data, null, 2), "json");
    } else {
      const text = await response.text();
      setCodeBlock(responseBox, text, "plain");
    }
  } catch (error) {
    setCodeBlock(responseBox, error.message || String(error), "error");
  }
}

function getCodeText(targetId) {
  const node = document.getElementById(targetId);
  return node ? node.textContent || "" : "";
}

async function copyCode(targetId, button) {
  const text = getCodeText(targetId);
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    button.classList.add("is-copied");
    const icon = button.querySelector(".material-icons");
    if (icon) icon.textContent = "check";

    window.setTimeout(() => {
      button.classList.remove("is-copied");
      if (icon) icon.textContent = "content_copy";
    }, 1400);
  } catch (_) {
    /* noop */
  }
}

async function fetchFirstJson(paths) {
  for (const path of paths) {
    try {
      const response = await fetch(`${path}${path.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) continue;
      return await response.json();
    } catch (_) {
      /* noop */
    }
  }
  throw new Error("No valid JSON source found");
}

async function loadNotifications() {
  const container = document.getElementById("notificationsList");

  try {
    const data = await fetchFirstJson([
      "/src/data/notifications.json",
      "/src/notifications.json",
      "/notifications.json"
    ]);

    const notifications = Array.isArray(data) ? data : data ? [data] : [];
    const translated = notifications.map((item) => ({
      ...item,
      title:
        item.title === "Update UI API"
          ? "Actualización de la interfaz API"
          : item.title || "Sin título",
      message:
        item.message === "Sekarang ada update baru dari UI API, silahkan cek informasinya di saluran WhatsApp kami."
          ? "Ahora hay una nueva actualización de la interfaz de la API. Revisa la información en nuestro canal de WhatsApp."
          : item.message || "-"
    }));

    if (notificationCount) {
      notificationCount.textContent = `${translated.length} avisos`;
    }

    if (!translated.length) {
      container.innerHTML = `<div class="future-notification-card">No hay notificaciones disponibles.</div>`;
      return;
    }

    const sorted = translated.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    container.innerHTML = sorted
      .map((item) => {
        const dateText = item.date
          ? new Date(item.date).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "short",
              day: "numeric"
            })
          : "-";

        return `
          <article class="future-notification-card">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 flex-1">
                <p class="future-notification-title text-sm font-semibold break-anywhere">${escapeHtml(item.title || "Sin título")}</p>
                <p class="future-notification-text text-sm mt-1 break-anywhere">${escapeHtml(item.message || "-")}</p>
              </div>
              <div class="future-notification-date text-xs sm:ml-4 sm:shrink-0">${escapeHtml(dateText)}</div>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (_) {
    if (notificationCount) {
      notificationCount.textContent = "Sin avisos";
    }
    container.innerHTML = `<div class="future-notification-card">No hay notificaciones disponibles.</div>`;
  }
}

async function loadApis() {
  try {
    const spec = await fetchFirstJson([
      "./openapi.json",
      "./src/openapi.json",
      "/src/config/openapi.json"
    ]);

    state.categories = normalizeCategories(localizeSpec(spec));
    renderApiList();
  } catch (error) {
    apiList.innerHTML = `<div class="future-empty">Error al cargar la documentación: ${escapeHtml(error.message || String(error))}</div>`;
  }
}

sidebarToggle.addEventListener("click", openSidebar);
sidebarClose.addEventListener("click", closeSidebar);
backdrop.addEventListener("click", closeSidebar);
modalClose.addEventListener("click", closeModal);
clearResponseBtn.addEventListener("click", clearResponse);
endpointForm.addEventListener("submit", executeEndpoint);
searchInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value || "";
  renderApiList();
});

document.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-target]");
  if (!copyButton) return;
  copyCode(copyButton.getAttribute("data-copy-target"), copyButton);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
    closeModal();
  }
});

modalOverlay.addEventListener("click", closeModal);
endpointModal.addEventListener("click", (event) => {
  if (event.target === endpointModal) closeModal();
});

window.toggleCategory = toggleCategory;
window.openEndpointByFilter = openEndpointByFilter;

document.addEventListener("DOMContentLoaded", () => {
  loadNotifications();
  loadApis();
});
