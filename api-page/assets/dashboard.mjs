import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { motion } from "https://esm.sh/framer-motion@11.11.17?bundle";
import { geoNaturalEarth1, geoPath } from "https://esm.sh/d3-geo@3.1.1";
import { feature } from "https://esm.sh/topojson-client@3.1.0";

const h = React.createElement;
export function useApiMetrics() {
  const [metrics, setMetrics] = useState({ uptimePercent: 99.98, averageLatency: 0, totalRequests: 0, activeRequests: 0, errorRate: 0, memory: 0, requestsPerMinute: 0 });
  const [requests, setRequests] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    fetch("/api/metrics").then((response) => response.json()).then((payload) => {
      if (!disposed) { setMetrics(payload.metrics); setRequests(payload.requests || []); }
    }).catch(() => {});
    if (!location.hostname.includes("localhost") && !location.hostname.includes("127.0.0.1")) {
      return () => { disposed = true; };
    }
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${location.host}/ws`);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.metrics) setMetrics(payload.metrics);
      if (payload.type === "snapshot") setRequests(payload.requests || []);
      if (payload.type === "request") setRequests((current) => [payload.request, ...current].slice(0, 80));
    };
    return () => { disposed = true; socket.close(); };
  }, []);

  return { metrics, requests, connected };
}

function MetricCard({ label, value, percent }) {
  return h("div", { className: "metric-card" },
    h("div", { className: "metric-ring", style: { "--metric-progress": `${Math.min(100, Math.max(4, percent)) * 3.6}deg` } },
      h("div", { className: "metric-ring-inner" }, h("strong", { className: "metric-value" }, value), h("span", null, label))
    )
  );
}

function Sparkline({ requests }) {
  const points = requests.slice(0, 24).reverse().map((item, index) => `${index * 4.2},${48 - Math.min(42, item.latency / 4)}`).join(" ");
  return h("svg", { className: "sparkline", viewBox: "0 0 100 54", preserveAspectRatio: "none" },
    h("polyline", { points: points || "0,45 20,38 40,42 60,22 80,31 100,16", fill: "none", stroke: "#22d3ee", strokeWidth: "1.5" })
  );
}

function Sidebar({ metrics, requests }) {
  const modules = useMemo(() => {
    const map = new Map();
    (metrics.endpoints || []).forEach((item) => {
      const key = item.endpoint.split("/").filter(Boolean)[0] || "root";
      map.set(key, (map.get(key) || 0) + item.total);
    });
    requests.forEach((item) => { const key = item.endpoint.split("/").slice(1, 3).join("/"); map.set(key, (map.get(key) || 0) + 1); });
    return [...map.entries()].slice(0, 5);
  }, [metrics.endpoints, requests]);
  return h("aside", { className: "sidebar" },
    h("p", { className: "section-label" }, "telemetría local"),
    h("div", { className: "metric-stack" },
      h(MetricCard, { label: "Integration", value: `${Math.max(0, 100 - metrics.errorRate)}%`, percent: 100 - metrics.errorRate }),
      h(MetricCard, { label: "Performance", value: `${metrics.averageLatency}ms`, percent: Math.max(8, 100 - metrics.averageLatency / 4) }),
      h(MetricCard, { label: "Requests / min", value: metrics.requestsPerMinute, percent: Math.min(100, metrics.requestsPerMinute * 4) })
    ),
    h("p", { className: "section-label", style: { marginTop: 22 } }, "frecuencia / latencia"),
    h(Sparkline, { requests }),
    h("p", { className: "section-label", style: { marginTop: 18 } }, "uso de módulos"),
    h("table", { className: "module-table" }, h("thead", null, h("tr", null, h("th", null, "módulo"), h("th", null, "hits"))), h("tbody", null,
      (modules.length ? modules : [["sin endpoints", 0]]).map(([name, count]) => h("tr", { key: name }, h("td", null, `/${name}`), h("td", null, count)))
    ))
  );
}

const SIMULATION_SERVER = [-74.0721, 4.711];
const SIMULATION_LOCATIONS = [
  { name: "CL-Santiago", lat: -33.4489, lng: -70.6693, ip: "190.102.44.18" },
  { name: "US-East", lat: 38.9072, lng: -77.0369, ip: "104.28.22.91" },
  { name: "EU-Central", lat: 50.1109, lng: 8.6821, ip: "85.214.132.89" },
  { name: "SA-East", lat: -23.5505, lng: -46.6333, ip: "177.12.44.12" },
  { name: "Asia-East", lat: 35.6895, lng: 139.6917, ip: "210.140.10.55" },
  { name: "AU-Sydney", lat: -33.8688, lng: 151.2093, ip: "139.130.4.5" }
];
const SIMULATION_ENDPOINTS = ["/v1/ai/chat", "/v1/generate/image", "/v1/download/media", "/v1/status"];
const NETWORK_DESTINATIONS = [
  SIMULATION_SERVER,
  [-77.0369, 38.9072],
  [8.6821, 50.1109],
  [139.6917, 35.6895],
  [151.2093, -33.8688]
];

function createSimulationRequest() {
  const location = SIMULATION_LOCATIONS[Math.floor(Math.random() * SIMULATION_LOCATIONS.length)];
  const endpoint = SIMULATION_ENDPOINTS[Math.floor(Math.random() * SIMULATION_ENDPOINTS.length)];
  const latency = Math.floor(Math.random() * 150) + 40;
  const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, method: "GET", statusCode: 200, endpoint, latency, ip: location.ip, location, simulation: true, log: `[IP: ${location.ip}] > GET ${endpoint} > 200 OK - ${latency}ms` };
}

function WorldMap({ requests }) {
  const [simulatedRequests, setSimulatedRequests] = useState([]);
  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const active = [...simulatedRequests, ...requests].slice(0, 6);
  const [world, setWorld] = useState(null);
  const mapWidth = 1000;
  const mapHeight = 560;
  const projection = useMemo(() => geoNaturalEarth1().scale(165).translate([mapWidth / 2, mapHeight / 2 + 22]), []);
  const pathGenerator = useMemo(() => geoPath(projection), [projection]);
  const toPoint = (location) => { const [x, y] = projection([location.lng, location.lat]); return { x: `${(x / mapWidth) * 100}%`, y: `${(y / mapHeight) * 100}%` }; };
  const connectionPath = (origin, destination) => {
    const [startX, startY] = projection([origin.lng, origin.lat]);
    const [endX, endY] = projection(destination);
    const bend = Math.max(18, Math.abs(endX - startX) * 0.18);
    return `M ${startX} ${startY} Q ${(startX + endX) / 2} ${Math.min(startY, endY) - bend} ${endX} ${endY}`;
  };

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((response) => { if (!response.ok) throw new Error("No se pudo cargar el mapa mundial"); return response.json(); }).then((topology) => { if (!cancelled) setWorld(feature(topology, topology.objects.countries)); }).catch((error) => console.error("Mapa mundial:", error));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const arrivalTimers = new Set();
    const expirationTimers = new Set();
    const emit = () => {
      const request = createSimulationRequest();
      setSimulatedRequests((current) => [request, ...current].slice(0, 6));
      const arrivalTimer = setTimeout(() => { setRevealedIds((current) => new Set(current).add(request.id)); arrivalTimers.delete(arrivalTimer); }, 900);
      arrivalTimers.add(arrivalTimer);
      const expirationTimer = setTimeout(() => { setSimulatedRequests((current) => current.filter((item) => item.id !== request.id)); setRevealedIds((current) => { const next = new Set(current); next.delete(request.id); return next; }); expirationTimers.delete(expirationTimer); }, 4000);
      expirationTimers.add(expirationTimer);
    };
    emit();
    const interval = setInterval(emit, 3200);
    return () => { clearInterval(interval); arrivalTimers.forEach((timer) => clearTimeout(timer)); expirationTimers.forEach((timer) => clearTimeout(timer)); };
  }, []);

  return h("div", { className: "map" },
    h("div", { className: "map-grid" }),
    h("svg", { className: "map-svg", viewBox: `0 0 ${mapWidth} ${mapHeight}`, preserveAspectRatio: "xMidYMid slice" },
      world && world.features.map((country) => h("path", { key: country.id, className: "map-land", d: pathGenerator(country) })),
      active.flatMap((request) => NETWORK_DESTINATIONS.map((destination, index) => h("path", { key: `route-${request.id}-${index}`, className: "route route-white", d: connectionPath(request.location || { lat: 20, lng: -70 }, destination) }))),
      h("circle", { className: "node server", cx: projection(SIMULATION_SERVER)[0], cy: projection(SIMULATION_SERVER)[1], r: "5" }),
      NETWORK_DESTINATIONS.slice(1).map((destination, index) => h("circle", { key: `network-node-${index}`, className: "node", cx: projection(destination)[0], cy: projection(destination)[1], r: "3" })),
      active.map((request) => { const location = request.location || { lat: 20, lng: -70 }; const [x, y] = projection([location.lng, location.lat]); return h("circle", { key: `node-${request.id}`, className: "node node-origin", cx: x, cy: y, r: "4" }); })
    ),
    active.filter((request) => !request.simulation || revealedIds.has(request.id)).map((request) => { const point = toPoint(request.location || { lat: 20, lng: -70 }); return h(motion.div, { key: `popup-${request.id}`, className: "event-pop", initial: { opacity: 0, scale: .7 }, animate: { opacity: 1, scale: 1 }, style: { left: point.x, top: point.y, transform: "translate(-50%, -50%)" } }, h("strong", null, `${request.method} ${request.statusCode} // ${request.location?.name || "NODE"}`), h("span", null, `IP: ${request.ip || "unknown"}`), h("span", null, `> ${request.endpoint}`), h("span", { className: "event-code" }, `> 200 OK - ${request.latency}ms`), h("span", { className: "cmd-cursor" }, "_")); })
  );
}

function LiveLogs({ requests }) { return h("div", { className: "log-column" }, h("div", { className: "log-list" }, requests.slice(0, 30).map((item) => h("div", { className: `log ${item.status === "ERROR" ? "error" : ""}`, key: item.id }, h("b", null, `${item.method} ${item.statusCode}`), ` ${item.endpoint} `, h("span", null, `${item.latency}ms`), h("br"), `ip:${item.ip}`)))); }
function LivePanel({ requests, connected }) { return h("section", { id: "network", className: "panel" }, h("div", { className: "panel-heading" }, h("h3", null, "Global request triangulation"), h("span", null, connected ? "● STREAM CONNECTED" : "○ RECONNECTING")), h("div", { className: "map-layout" }, h(WorldMap, { requests }), h(LiveLogs, { requests }))); }

function EndpointOverview({ metrics }) {
  const endpoints = (metrics.endpoints || []).slice(0, 12);
  return h("section", { className: "panel endpoint-overview" },
    h("div", { className: "panel-heading" }, h("h3", null, "API endpoints"), h("span", null, `${metrics.endpointCount || endpoints.length} rutas · ${metrics.categoryCount || 0} categorías`)),
    h("div", { className: "endpoint-overview-grid" }, endpoints.map((item) => h("article", { className: "endpoint-summary", key: item.endpoint }, h("strong", null, item.endpoint), h("span", null, `${item.total} solicitudes · ${item.latency}ms · ${item.status}`))))
  );
}

function App() {
  const { metrics, requests, connected } = useApiMetrics();
  const viewContent = h(motion.div, { key: "map", initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }, h(LivePanel, { requests, connected }));
  return h("div", { className: "shell" },
    h("header", { className: "topbar" },
      h("div", { className: "brand" }, h("div", { className: "brand-mark" }, "//"), h("div", null, h("div", { className: "eyebrow" }, "secure api command center"), h("h1", null, "HUSKY API v1.0"))),
      h("nav", { className: "top-nav", "aria-label": "Navegación principal" },
        h("a", { href: "/docs.html", className: "top-nav-link top-nav-link--integration" }, "INTEGRACIÓN"),
        h("a", { href: "https://github.com/", target: "_blank", rel: "noopener noreferrer", className: "top-nav-link top-nav-link--github" }, "GITHUB"),
        h("a", { href: "https://wa.me/6283191473712", target: "_blank", rel: "noopener noreferrer", className: "top-nav-link top-nav-link--whatsapp" }, "WHATSAPP"),
        h("a", { href: "https://whatsapp.com/channel/0029VbCGBnb2UPBF8LXws83u", target: "_blank", rel: "noopener noreferrer", className: "top-nav-link top-nav-link--channel" }, "CANAL"),
        h("a", { href: "mailto:contacto@huskydev.space", className: "top-nav-link top-nav-link--email" }, "CORREO"),
        h("a", { href: "#network", className: "top-nav-link top-nav-link--map" }, "MAPA EN VIVO"),
        h("div", { className: "status-pill" }, connected ? "● ONLINE / WS" : "○ OFFLINE / RETRY")
      )
    ),
    h("div", { className: "dashboard-grid" },
      h(Sidebar, { metrics, requests }),
      h("main", { className: "main" },
        h("div", { className: "hero" },
          h("div", null, h("div", { className: "eyebrow" }, "hola desarrollador"), h("h2", null, "Controla el pulso de tu API."), h("p", null, "Métricas, tráfico y endpoints en una sola superficie operativa.")),
          h("div", { className: "hero-actions" },
            h("a", { className: "primary-button", href: "/docs.html" }, "INICIAR API"),
            h("a", { className: "site-button", href: "https://huskydev.space", target: "_blank", rel: "noopener noreferrer" }, "HUSKYDEV.SPACE ↗"),
            h("button", { className: "icon-button", onClick: () => window.open("/v1/status/image", "_blank") }, "ESTADO PNG")
          )
        ),
        viewContent,
        h(EndpointOverview, { metrics })
      )
    ),
    h("footer", { className: "dashboard-footer" },
      h("div", { className: "footer-brand" }, h("span", { className: "footer-mark" }, "//"), h("div", null, h("strong", null, "HUSKY API"), h("span", null, "Secure tools for modern integrations"))),
      h("div", { className: "footer-links" }, h("a", { href: "/docs.html" }, "Documentación"), h("a", { href: "https://huskydev.space", target: "_blank", rel: "noopener noreferrer" }, "HuskyDev.space ↗"), h("a", { href: "mailto:contacto@huskydev.space" }, "Contacto"), h("a", { href: "#network" }, "Estado en vivo")),
      h("div", { className: "footer-meta" }, h("span", null, connected ? "● SYSTEM ONLINE" : "○ SYSTEM OFFLINE"), h("span", null, `© ${new Date().getFullYear()} Husky API`))
    )
  );
}

createRoot(document.getElementById("dashboard-root")).render(h(App));
