function indexV2IconForCategory(name) {
  const value = String(name || "").toLowerCase();

  if (value.includes("ai") || value.includes("bot") || value.includes("copilot")) {
    return "smart_toy";
  }
  if (value.includes("image") || value.includes("anime") || value.includes("wallpaper")) {
    return "image";
  }
  if (value.includes("download") || value.includes("media")) {
    return "download";
  }
  if (value.includes("news") || value.includes("noticia")) {
    return "newspaper";
  }
  if (value.includes("tool") || value.includes("util")) {
    return "build";
  }

  return "folder_open";
}

function indexV2CleanEndpointName(path, summary) {
  const cleanedSummary = String(summary || "")
    .replace(/^Chat de\s+/i, "")
    .replace(/^Descargador de\s+/i, "")
    .replace(/^Noticias\s+/i, "")
    .trim();

  if (cleanedSummary) {
    return cleanedSummary;
  }

  const segment = String(path || "")
    .split("/")
    .filter(Boolean)
    .pop() || "Endpoint";

  return segment
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function indexV2BuildCategories(spec) {
  const map = {};

  (spec.tags || []).forEach((tag) => {
    map[tag.name] = { name: tag.name, items: [] };
  });

  Object.entries(spec.paths || {}).forEach(([path, methods]) => {
    Object.entries(methods || {}).forEach(([method, endpoint]) => {
      const tagName = endpoint.tags && endpoint.tags.length ? endpoint.tags[0] : "General";

      if (!map[tagName]) {
        map[tagName] = { name: tagName, items: [] };
      }

      map[tagName].items.push({
        path,
        method: String(method).toUpperCase(),
        name: indexV2CleanEndpointName(path, endpoint.summary || "")
      });
    });
  });

  return Object.values(map)
    .filter((category) => category.items.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function indexV2LoadApiPanel() {
  const explorer = document.getElementById("indexV2ApiExplorer");
  const meta = document.getElementById("indexV2ApiMeta");

  try {
    const response = await fetch("/src/openapi.json");
    const spec = await response.json();
    const categories = indexV2BuildCategories(spec);
    const endpoints = Object.keys(spec.paths || {}).length;

    document.getElementById("indexV2TotalEndpoints").textContent = endpoints;
    document.getElementById("indexV2TotalCategories").textContent = categories.length;
    meta.textContent = `${categories.length} carpetas · ${endpoints} endpoints`;

    if (!categories.length) {
      explorer.innerHTML = '<div class="index-v2-empty">No hay carpetas disponibles todavía.</div>';
      return;
    }

    explorer.innerHTML = categories.slice(0, 6).map((category) => {
      const preview = category.items.slice(0, 3);
      const method = category.items[0]?.method || "API";

      return `
        <article class="index-v2-folder">
          <div class="index-v2-folder-head">
            <div class="index-v2-folder-left">
              <span class="index-v2-folder-icon material-icons">${indexV2IconForCategory(category.name)}</span>
              <div class="min-w-0">
                <div class="index-v2-folder-name">${category.name}</div>
                <div class="index-v2-folder-count">${category.items.length} endpoint${category.items.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            <span class="index-v2-folder-method">${method}</span>
          </div>

          <div class="index-v2-folder-list">
            ${preview.map((item) => `
              <div class="index-v2-folder-item">
                <span class="material-icons">subdirectory_arrow_right</span>
                <span>${item.name}</span>
              </div>
            `).join("")}
          </div>

          <a href="/docs.html" class="index-v2-folder-cta">
            <span class="material-icons text-sm">login</span>
            <span>Entrar a docs</span>
          </a>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error("No se pudo cargar openapi.json", error);
    meta.textContent = "Sin datos";
    explorer.innerHTML = '<div class="index-v2-empty">No se pudo cargar la información de la API.</div>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const year = document.getElementById("year");

  if (loader) {
    loader.classList.add("hidden");
  }

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  indexV2LoadApiPanel();

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".animate-on-scroll").forEach((target) => observer.observe(target));

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (event) {
      event.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
});
