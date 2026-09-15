'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
} from 'react-simple-maps';

const WORLD_GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const SERVER = {
  name: 'Husky Core',
  coordinates: [-74.0721, 4.711],
};

const CLIENT_NODES = [
  { id: 'node-us-east', name: 'US-East', coordinates: [-77.0369, 38.9072], ip: '104.28.22.91', latency: 76 },
  { id: 'node-eu-central', name: 'EU-Central', coordinates: [8.6821, 50.1109], ip: '85.214.132.89', latency: 92 },
  { id: 'node-sa-east', name: 'SA-East', coordinates: [-46.6333, -23.5505], ip: '177.12.44.12', latency: 118 },
  { id: 'node-asia-east', name: 'Asia-East', coordinates: [139.6917, 35.6895], ip: '210.140.10.55', latency: 164 },
  { id: 'node-uk-london', name: 'UK-London', coordinates: [-0.1276, 51.5074], ip: '62.252.11.4', latency: 83 },
  { id: 'node-au-sydney', name: 'AU-Sydney', coordinates: [151.2093, -33.8688], ip: '139.130.4.5', latency: 188 },
  { id: 'node-af-cape-town', name: 'AF-Cape Town', coordinates: [18.4241, -33.9249], ip: '102.67.18.43', latency: 142 },
];

const ENDPOINTS = ['/v1/ai/chat', '/v1/generate/image', '/v1/download/media', '/v1/status'];

const MODULE_USAGE = [
  { module: 'Gen-IA', endpoint: '/translate', requests: 54, latency: '110ms' },
  { module: 'Img-IA', endpoint: '/generate', requests: 38, latency: '180ms' },
  { module: 'Descargas', endpoint: '/get-video', requests: 12, latency: '240ms' },
];

const CHART_POINTS = '0,48 12,36 24,43 36,19 48,31 60,14 72,38 84,25 96,34 108,12 120,28 132,20';

function createRequestEvent() {
  const location = CLIENT_NODES[Math.floor(Math.random() * CLIENT_NODES.length)];
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const latency = Math.floor(Math.random() * 150) + 40;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    ...location,
    origin: location.coordinates,
    destination: SERVER.coordinates,
    endpoint,
    latency,
    status: 200,
    log: `[IP: ${location.ip}] > GET ${endpoint} > 200 OK - ${latency}ms`,
  };
}

function MetricRing({ label, value, progress }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative grid h-[84px] w-[84px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(#22d3ee ${progress}%, #17243a ${progress}% 100%)`,
          boxShadow: '0 0 18px rgba(34, 211, 238, 0.16)',
        }}
      >
        <div className="absolute inset-[5px] rounded-full bg-[#07101d]" />
        <div className="relative text-center font-mono">
          <strong className="block text-lg leading-none text-slate-100">{value}</strong>
          <span className="mt-1 block text-[8px] uppercase tracking-[0.12em] text-slate-500">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function FrequencyChart() {
  return (
    <div className="relative h-20 overflow-hidden border-y border-cyan-950/70 bg-[#06101c]">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.09) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <svg viewBox="0 0 132 60" className="relative h-full w-full" preserveAspectRatio="none">
        <polyline
          points={CHART_POINTS}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function TerminalPopup({ node }) {
  return (
    <foreignObject x="8" y="-54" width="132" height="58" overflow="visible">
      <div className="w-[132px] border border-cyan-400/70 bg-[#050c16]/95 p-2 font-mono text-[8px] leading-[1.45] text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,.16)]">
        <div className="mb-1 flex items-center justify-between border-b border-cyan-900/80 pb-1 text-[7px] uppercase tracking-wider text-cyan-400">
          <span>{node.name}</span>
          <span className="text-emerald-400">LIVE</span>
        </div>
        <div>IP: {node.ip}</div>
        <div className="truncate text-cyan-300">&gt; GET {node.endpoint}</div>
        <div>LAT: {node.latency}ms</div>
        <div className="text-emerald-300">HTTP {node.status} OK</div>
        <div className="truncate text-slate-400">{node.log}</div>
        <span className="cmd-cursor text-cyan-300">_</span>
      </div>
    </foreignObject>
  );
}

function NetworkMap({ activeNode, onNodeSelect }) {
  const [activeRequests, setActiveRequests] = useState([]);
  const [arrivedRequestIds, setArrivedRequestIds] = useState(() => new Set());

  useEffect(() => {
    const arrivalTimers = new Set();
    const expirationTimers = new Set();

    const emitRequest = () => {
      const request = createRequestEvent();
      setActiveRequests((current) => [...current.slice(-5), request]);

      const arrivalTimer = setTimeout(() => {
        setArrivedRequestIds((current) => new Set(current).add(request.id));
        arrivalTimers.delete(arrivalTimer);
      }, 950);
      arrivalTimers.add(arrivalTimer);

      const expirationTimer = setTimeout(() => {
        setActiveRequests((current) => current.filter((item) => item.id !== request.id));
        setArrivedRequestIds((current) => {
          const next = new Set(current);
          next.delete(request.id);
          return next;
        });
        expirationTimers.delete(expirationTimer);
      }, 4000);

      expirationTimers.add(expirationTimer);
    };

    emitRequest();
    const interval = setInterval(emitRequest, 3200);

    return () => {
      clearInterval(interval);
      arrivalTimers.forEach((timer) => clearTimeout(timer));
      expirationTimers.forEach((timer) => clearTimeout(timer));
      arrivalTimers.clear();
      expirationTimers.clear();
    };
  }, []);

  return (
    <div className="relative min-h-[520px] overflow-hidden border border-cyan-900/80 bg-[#030712]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(14,116,144,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(14,116,144,.13) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute left-4 top-4 z-10 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-400">
        Global Network // Live triangulation
      </div>
      <div className="absolute right-4 top-4 z-10 text-right font-mono text-[9px] uppercase tracking-wider text-slate-500">
        Stream: <span className="text-emerald-400">online</span>
        <br />
        Active routes: {activeRequests.length}
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 145, center: [10, 12] }}
        className="relative z-[1] h-full min-h-[520px] w-full"
      >
        <Geographies geography={WORLD_GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#0f172a"
                stroke="#075985"
                strokeWidth={0.35}
                style={{
                  default: { outline: 'none' },
                  hover: { fill: '#172554', outline: 'none' },
                  pressed: { fill: '#164e63', outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {activeRequests.map((request) => (
          <Line
            key={`line-${request.id}`}
            from={request.coordinates}
            to={SERVER.coordinates}
            stroke="#ffffff"
            strokeWidth={request.name === activeNode?.name ? 2 : 1.5}
            strokeLinecap="round"
            strokeDasharray="5 5"
            className="hussy-network-line"
          />
        ))}

        <Marker coordinates={SERVER.coordinates}>
          <g>
            <circle r="7" fill="#22d3ee" opacity="0.12" className="animate-ping" />
            <circle r="3" fill="#ecfeff" stroke="#22d3ee" strokeWidth="1.3" />
            <text x="8" y="-8" fill="#a5f3fc" fontSize="4" fontFamily="monospace">
              HUSKY CORE
            </text>
          </g>
        </Marker>

        {activeRequests.map((request) => (
          <Marker key={request.id} coordinates={request.coordinates}>
            <g
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => onNodeSelect(request)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onNodeSelect(request);
              }}
            >
              <circle r="5" fill="#ffffff" opacity="0.15" className="animate-pulse" />
              <circle r="1.8" fill="#ffffff" stroke="#ffffff" strokeWidth="0.6" />
              {arrivedRequestIds.has(request.id) && <TerminalPopup node={request} />}
            </g>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}

export default function HuskyDashboard() {
  const [activeNode, setActiveNode] = useState(null);
  const activeLabel = activeNode ? `Focused: ${activeNode.name}` : 'All nodes active';
  const totalLatency = useMemo(
    () => Math.round(CLIENT_NODES.reduce((sum, node) => sum + node.latency, 0) / CLIENT_NODES.length),
    [],
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030712] text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -28; }
        }
        .hussy-network-line {
          animation: dash 1.1s linear infinite;
          filter: drop-shadow(0 0 4px rgba(255,255,255,.85));
          stroke-linecap: round;
        }
        .cmd-cursor {
          animation: cursor-blink .8s steps(2, start) infinite;
        }
        @keyframes cursor-blink {
          50% { opacity: 0; }
        }
      `}</style>

      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col border-x border-cyan-950/70 bg-[#07101d]">
        <header className="flex items-center justify-between border-b border-cyan-950/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-cyan-400">//</span>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-400">Secure API command center</p>
              <h1 className="font-mono text-lg font-bold tracking-wide text-slate-100">HUSKY API DASHBOARD</h1>
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">● Service online</div>
        </header>

        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="border-b border-cyan-950/80 p-4 lg:border-b-0 lg:border-r">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">System metrics</p>
            <div className="grid grid-cols-3 gap-1 lg:grid-cols-1 lg:gap-4">
              <MetricRing label="Integration" value="85%" progress={85} />
              <MetricRing label="Performance" value="94%" progress={94} />
              <MetricRing label="Requests" value="72%" progress={72} />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
                <span>Frequency</span><span className="text-emerald-400">Status: online</span>
              </div>
              <FrequencyChart />
              <div className="mt-2 flex justify-between font-mono text-[8px] text-slate-600"><span>00:00</span><span>10:00</span></div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
                <span>Response time</span><span className="text-cyan-300">{totalLatency}ms avg</span>
              </div>
              <FrequencyChart />
            </div>

            <div className="mt-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">API module usage</p>
              <div className="overflow-hidden border border-cyan-950/80">
                <table className="w-full text-left font-mono text-[9px]">
                  <thead className="bg-cyan-950/30 text-slate-500"><tr><th className="p-2 font-normal">Module</th><th className="p-2 font-normal">Endpoint</th><th className="p-2 font-normal">Req/s</th></tr></thead>
                  <tbody>{MODULE_USAGE.map((item) => <tr key={item.endpoint} className="border-t border-cyan-950/70"><td className="p-2">{item.module}</td><td className="p-2 text-cyan-300">{item.endpoint}</td><td className="p-2 text-slate-400">{item.requests}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </aside>

          <section className="min-w-0 p-4 lg:p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-400">Hola desarrollador</p><h2 className="mt-1 font-mono text-xl font-bold text-slate-100">Network activity</h2></div>
              <p className="font-mono text-[9px] text-slate-500">{activeLabel}</p>
            </div>
            <NetworkMap activeNode={activeNode} onNodeSelect={setActiveNode} />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button type="button" className="border border-cyan-500/70 bg-cyan-950/30 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-400 hover:text-slate-950" onClick={() => setActiveNode(null)}>IA y asistentes</button>
              <button type="button" className="border border-cyan-900 bg-slate-950/60 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200" onClick={() => setActiveNode(CLIENT_NODES[2])}>Imágenes y anime</button>
              <button type="button" className="border border-cyan-900 bg-slate-950/60 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200" onClick={() => setActiveNode(CLIENT_NODES[1])}>Descargas útiles</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
