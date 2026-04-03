function fetchFirstJson(paths) {
  return (async () => {
    for (const path of paths) {
      try {
        const response = await fetch(
          `${path}${path.includes("?") ? "&" : "?"}t=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!response.ok) continue;
        return await response.json();
      } catch (_) {
        // sigue probando la siguiente ruta
      }
    }

    throw new Error("No se pudo cargar openapi.json");
  })();
}

function buildCategories(spec) {
  const map = {};

  (spec.tags || []).forEach((tag) => {
    map[tag.name] = [];
  });

  Object.entries(spec.paths || {}).forEach(([path, methods]) => {
    Object.entries(methods || {}).forEach(([method, endpoint]) => {
      const tagName =
        endpoint.tags && endpoint.tags.length
          ? endpoint.tags[0]
          : "General";

      if (!map[tagName]) {
        map[tagName] = [];
      }

      map[tagName].push({
        path,
        method: String(method).toUpperCase()
      });
    });
  });

  return Object.entries(map)
    .map(([name, items]) => ({ name, items }))
    .filter((category) => category.items.length > 0);
}

async function loadIndexStats() {
  try {
    const spec = await fetchFirstJson([
      "/openapi.json",
      "/src/openapi.json",
      "/src/config/openapi.json"
    ]);

    const categories = buildCategories(spec);
    const totalEndpoints = categories.reduce(
      (acc, category) => acc + category.items.length,
      0
    );

    const methods = new Set();
    categories.forEach((category) => {
      category.items.forEach((item) => methods.add(item.method));
    });

    const endpointsNode = document.getElementById("indexV2TotalEndpoints");
    const categoriesNode = document.getElementById("indexV2TotalCategories");
    const methodsNode = document.getElementById("indexV2TotalMethods");

    if (endpointsNode) {
      endpointsNode.textContent = `+${totalEndpoints}`;
    }

    if (categoriesNode) {
      categoriesNode.textContent = `+${categories.length}`;
    }

    if (methodsNode) {
      methodsNode.textContent = `${methods.size}`;
    }
  } catch (error) {
    console.error("Error cargando estadísticas del index:", error);
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

  loadIndexStats();

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
