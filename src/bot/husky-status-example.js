// Ejemplo de envío de estado con Baileys.
// Requiere: npm install @whiskeysockets/baileys
const API_URL = process.env.HUSKY_API_URL || "http://localhost:4000";

async function sendHuskyStatus(sock, jid) {
  const image = await fetch(`${API_URL}/v1/status/image`).then((response) => {
    if (!response.ok) throw new Error(`Status image failed: ${response.status}`);
    return response.arrayBuffer();
  });

  const metrics = await fetch(`${API_URL}/api/metrics`).then((response) => response.json());
  const { averageLatency, activeRequests, uptimePercent } = metrics.metrics;

  await sock.sendMessage(jid, {
    image: Buffer.from(image),
    caption: [
      "HUSKY API // STATUS",
      `Uptime: ${uptimePercent}%`,
      `Latencia media: ${averageLatency} ms`,
      `Requests activas: ${activeRequests}`
    ].join("\n")
  });
}

module.exports = { sendHuskyStatus };
