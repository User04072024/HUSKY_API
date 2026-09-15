const express = require("express");
const chalk = require("chalk");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
let createCanvas = null;
try {
    ({ createCanvas } = require("@napi-rs/canvas"));
} catch {
    createCanvas = null;
}
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const startedAt = Date.now();
const activeRequests = new Set();
const recentRequests = [];
const dashboardClients = new Set();
const MAX_RECENT_REQUESTS = 80;
const metricTotals = { total: 0, errors: 0, totalDuration: 0 };
const ipLocationCache = new Map();
const ADMIN_GITHUB_LOGIN = String(process.env.ADMIN_GITHUB_LOGIN || "User04072024").trim().toLowerCase();
const SESSION_COOKIE = "husky_admin_session";
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

// ========== EXPRESS ==========
app.enable("trust proxy");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.set("json spaces", 2);

// ========== GITHUB ADMIN AUTH ==========
function getPublicOrigin(req) {
    return process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
}

function appendCookie(res, name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.secure) parts.push("Secure");
    res.append("Set-Cookie", parts.join("; "));
}

function clearCookie(res, name) {
    appendCookie(res, name, "", { maxAge: 0, httpOnly: true, sameSite: "Lax", secure: process.env.NODE_ENV === "production" });
}

function signSession(payload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) return null;
    const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
}

function readSession(req) {
    const raw = String(req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`));
    if (!raw || !process.env.ADMIN_SESSION_SECRET) return null;
    const value = decodeURIComponent(raw.slice(`${SESSION_COOKIE}=`.length));
    const [encoded, signature] = value.split(".");
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(encoded).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
    try {
        const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        return session.exp > Date.now() ? session : null;
    } catch {
        return null;
    }
}

async function requireAdmin(req, res, next) {
    const authorization = String(req.headers.authorization || "");
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!supabaseAdmin || !accessToken) return res.status(401).json({ status: false, message: "Inicia sesión con GitHub o Google para acceder al editor." });

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    const user = data?.user;
    const email = String(user?.email || "").toLowerCase();
    const githubLogin = String(user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || user?.user_metadata?.login || "").toLowerCase();
    const provider = String(user?.app_metadata?.provider || user?.identities?.[0]?.provider || "").toLowerCase();
    const allowedEmail = String(process.env.ADMIN_GOOGLE_EMAIL || "").trim().toLowerCase();
    const githubAllowed = provider === "github" && githubLogin === ADMIN_GITHUB_LOGIN;
    const googleAllowed = provider === "google" && Boolean(allowedEmail) && email === allowedEmail;
    if (error || !user || (!githubAllowed && !googleAllowed)) {
        return res.status(403).json({ status: false, message: "Esta cuenta de GitHub o Google no tiene acceso al editor." });
    }

    req.admin = { id: user.id, email: user.email || "", login: githubLogin, provider, name: data.user.user_metadata?.full_name || user.email, avatar: data.user.user_metadata?.avatar_url || "" };
    next();
}

app.get("/api/admin/session", requireAdmin, (req, res) => {
    const configured = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
    res.json({ status: true, user: req.admin, publish: { enabled: configured, message: configured ? "Los cambios se guardan como commits en GitHub." : "Configura GITHUB_TOKEN, GITHUB_OWNER y GITHUB_REPO para publicar cambios." } });
});

const editablePathPrefixes = ["api-page/", "src/api/", "src/data/"];
const editableExactPaths = new Set(["src/openapi.json"]);

function normalizeEditablePath(value) {
    const filePath = String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
    if (!filePath || filePath.includes("..") || (!editableExactPaths.has(filePath) && !editablePathPrefixes.some((prefix) => filePath.startsWith(prefix)))) return null;
    return filePath;
}

function githubConfig() {
    const token = String(process.env.GITHUB_TOKEN || "").trim();
    const owner = String(process.env.GITHUB_OWNER || "").trim();
    const repo = String(process.env.GITHUB_REPO || "").trim();
    if (!token || !owner || !repo) throw new Error("GitHub no está configurado para publicar cambios.");
    return { token, owner, repo, branch: process.env.GITHUB_BASE_BRANCH || "main" };
}

async function githubRequest(method, filePath, body = null) {
    const config = githubConfig();
    const [requestPath, query = ""] = String(filePath || "").split("?");
    const prefix = requestPath.startsWith("git/") ? "" : "/contents";
    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}${prefix}${requestPath ? `/${requestPath.split("/").map(encodeURIComponent).join("/")}` : ""}${query ? `?${query}` : ""}`;
    const response = await fetch(url, { method, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${config.token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "husky-api-admin" }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `GitHub respondió ${response.status}`);
    return data;
}

async function getGithubFile(filePath) {
    const config = githubConfig();
    const data = await githubRequest("GET", filePath, null);
    if (Array.isArray(data)) return { type: "directory", entries: data.map((entry) => ({ path: entry.path, type: entry.type, size: entry.size })) };
    return { type: "file", path: filePath, sha: data.sha, content: Buffer.from(String(data.content || "").replace(/\n/g, ""), "base64").toString("utf8"), branch: config.branch };
}

app.get("/api/admin/files", requireAdmin, async (req, res) => {
    try {
        const config = githubConfig();
        const ref = await githubRequest("GET", `git/ref/heads/${encodeURIComponent(config.branch)}`);
        const tree = await githubRequest("GET", `git/trees/${ref.object.sha}?recursive=1`);
        const files = (tree.tree || []).filter((entry) => entry.type === "blob" && normalizeEditablePath(entry.path)).map((entry) => ({ path: entry.path, size: entry.size }));
        res.json({ status: true, branch: config.branch, files });
    } catch (error) {
        res.status(503).json({ status: false, message: error.message });
    }
});

app.get("/api/admin/file", requireAdmin, async (req, res) => {
    const filePath = normalizeEditablePath(req.query.path);
    if (!filePath) return res.status(400).json({ status: false, message: "Ruta no permitida." });
    try { res.json({ status: true, file: await getGithubFile(filePath) }); } catch (error) { res.status(404).json({ status: false, message: error.message }); }
});

app.put("/api/admin/file", requireAdmin, async (req, res) => {
    const filePath = normalizeEditablePath(req.body?.path);
    const content = typeof req.body?.content === "string" ? req.body.content : null;
    if (!filePath || content === null) return res.status(400).json({ status: false, message: "Ruta o contenido inválido." });
    try {
        const current = await getGithubFile(filePath);
        const config = githubConfig();
        const result = await githubRequest("PUT", filePath, { message: String(req.body.message || `admin: update ${filePath}`).slice(0, 200), content: Buffer.from(content, "utf8").toString("base64"), sha: current.sha, branch: config.branch });
        res.json({ status: true, message: "Cambios guardados en GitHub.", commit: result.commit?.html_url || null });
    } catch (error) { res.status(502).json({ status: false, message: error.message }); }
});

app.post("/api/admin/file", requireAdmin, async (req, res) => {
    const filePath = normalizeEditablePath(req.body?.path);
    const content = typeof req.body?.content === "string" ? req.body.content : null;
    if (!filePath || content === null) return res.status(400).json({ status: false, message: "Ruta o contenido inválido." });
    try {
        const config = githubConfig();
        const result = await githubRequest("PUT", filePath, { message: String(req.body.message || `admin: create ${filePath}`).slice(0, 200), content: Buffer.from(content, "utf8").toString("base64"), branch: config.branch });
        res.status(201).json({ status: true, message: "Archivo creado en GitHub.", commit: result.commit?.html_url || null });
    } catch (error) { res.status(502).json({ status: false, message: error.message }); }
});

app.delete("/api/admin/file", requireAdmin, async (req, res) => {
    const filePath = normalizeEditablePath(req.body?.path);
    if (!filePath) return res.status(400).json({ status: false, message: "Ruta no permitida." });
    try {
        const current = await getGithubFile(filePath);
        const config = githubConfig();
        const result = await githubRequest("DELETE", filePath, { message: String(req.body.message || `admin: delete ${filePath}`).slice(0, 200), sha: current.sha, branch: config.branch });
        res.json({ status: true, message: "Archivo eliminado de GitHub.", commit: result.commit?.html_url || null });
    } catch (error) { res.status(502).json({ status: false, message: error.message }); }
});

app.get("/auth/github", (req, res) => {
    const { GITHUB_CLIENT_ID } = process.env;
    if (!GITHUB_CLIENT_ID || !process.env.ADMIN_SESSION_SECRET) {
        return res.status(503).send("GitHub OAuth no está configurado. Define GITHUB_CLIENT_ID y ADMIN_SESSION_SECRET.");
    }
    const state = crypto.randomBytes(24).toString("hex");
    const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/") ? req.query.returnTo : "/admin";
    appendCookie(res, "husky_oauth_state", `${state}.${Buffer.from(returnTo).toString("base64url")}`, { httpOnly: true, sameSite: "Lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60 * 1000 });
    const params = new URLSearchParams({ client_id: GITHUB_CLIENT_ID, redirect_uri: `${getPublicOrigin(req)}/auth/github/callback`, scope: process.env.GITHUB_OAUTH_SCOPE || "read:user user:email", state });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get("/auth/github/callback", async (req, res) => {
    const stateCookie = String(req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith("husky_oauth_state="));
    const stateValue = stateCookie ? decodeURIComponent(stateCookie.split("=").slice(1).join("=")) : "";
    const [expectedState, encodedReturnTo] = stateValue.split(".");
    const receivedState = Buffer.from(String(req.query.state || ""));
    const expectedStateBuffer = Buffer.from(expectedState || "");
    if (!req.query.code || !req.query.state || !expectedState || receivedState.length !== expectedStateBuffer.length || !crypto.timingSafeEqual(receivedState, expectedStateBuffer)) {
        return res.status(400).send("Estado OAuth inválido.");
    }

    try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: req.query.code, redirect_uri: `${getPublicOrigin(req)}/auth/github/callback` }) });
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) throw new Error("GitHub no devolvió access_token");
        const userResponse = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "husky-api-admin" } });
        const user = await userResponse.json();
        if (!user.login || user.login.toLowerCase() !== ADMIN_GITHUB_LOGIN.toLowerCase()) return res.status(403).send("Esta cuenta de GitHub no tiene acceso al editor.");
        const session = signSession({ login: user.login, name: user.name || user.login, avatar: user.avatar_url, exp: Date.now() + 8 * 60 * 60 * 1000 });
        if (!session) throw new Error("ADMIN_SESSION_SECRET no configurado");
        appendCookie(res, SESSION_COOKIE, session, { httpOnly: true, sameSite: "Lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 });
        clearCookie(res, "husky_oauth_state");
        const returnTo = encodedReturnTo ? Buffer.from(encodedReturnTo, "base64url").toString("utf8") : "/admin";
        res.redirect(returnTo.startsWith("/") ? returnTo : "/admin");
    } catch (error) {
        console.error(chalk.red(`GitHub OAuth: ${error.message}`));
        res.status(502).send("No se pudo validar la sesión con GitHub.");
    }
});

app.get("/auth/me", (req, res) => {
    const session = readSession(req);
    res.json({ authenticated: Boolean(session), user: session ? { login: session.login, name: session.name, avatar: session.avatar } : null });
});

app.get("/api/auth/config", (req, res) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return res.status(503).json({ status: false, message: "Supabase no está configurado." });
    res.json({ url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY });
});

app.post("/auth/logout", (req, res) => {
    clearCookie(res, SESSION_COOKIE);
    res.json({ status: true });
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "api-page", "admin.html"));
});

// ========== STATIC FILES ==========
app.use("/", express.static(path.join(__dirname, "api-page")));
app.use("/src", express.static(path.join(__dirname, "src")));

// ========== LOAD OPENAPI ==========
const openApiPath = path.join(__dirname, "./src/openapi.json");
let openApi = {};

try {
    openApi = JSON.parse(fs.readFileSync(openApiPath));
} catch {
    console.warn(chalk.yellow("⚠️ openapi.json not found or invalid."));
}

// ========== /openapi.json route ==========
app.get("/openapi.json", (req, res) => {
    if (fs.existsSync(openApiPath)) res.sendFile(openApiPath);
    else res.status(404).json({ status: false, message: "openapi.json tidak ditemukan" });
});

// ========== Helper match path OpenAPI ==========
function matchOpenApiPath(requestPath) {
    const paths = Object.keys(openApi.paths || {});
    for (const apiPath of paths) {
        const regex = new RegExp("^" + apiPath.replace(/{[^}]+}/g, "[^/]+") + "$");
        if (regex.test(requestPath)) return true;
    }
    return false;
}

// ========== JSON RESPONSE WRAPPER ==========
app.use((req, res, next) => {
    const original = res.json;
    res.json = function (data) {
        if (typeof data === "object") {
            data = {
                status: data.status ?? true,
                creator: openApi.info?.author || "Rynn UI",
                ...data
            };
        }
        return original.call(this, data);
    };
    next();
});

// ========== ENDPOINT LOGGER ==========
const endpointStats = {};

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    return String(forwarded || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function getMetricsSnapshot() {
    const total = metricTotals.total || 1;
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const averageLatency = metricTotals.total
        ? Math.round(metricTotals.totalDuration / metricTotals.total)
        : 0;

    return {
        uptime: process.uptime(),
        uptimePercent: 99.98,
        totalRequests: metricTotals.total,
        errorRate: Number(((metricTotals.errors / total) * 100).toFixed(2)),
        averageLatency,
        activeRequests: activeRequests.size,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
        requestsPerMinute: recentRequests.filter((item) => Date.now() - item.timestamp < 60000).length,
        uptimeSeconds,
        endpoints: Object.entries(endpointStats).map(([endpoint, stats]) => ({
            endpoint,
            total: stats.total,
            errors: stats.errors,
            latency: Math.round(stats.totalDuration / Math.max(stats.total, 1)),
            status: stats.errors / Math.max(stats.total, 1) > 0.5 ? "OFFLINE" : "ONLINE"
        }))
    };
}

function publishMetric(payload) {
    const message = JSON.stringify(payload);
    dashboardClients.forEach((client) => {
        if (client.readyState === 1) client.send(message);
    });
}

async function resolveIpLocation(ip) {
    if (ipLocationCache.has(ip)) return ipLocationCache.get(ip);
    const fallback = { lat: 20, lng: -70, city: "local" };
    if (!ip || ip === "unknown" || ip.includes("127.0.0.1") || ip.includes("::1") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
        ipLocationCache.set(ip, fallback);
        return fallback;
    }

    try {
        const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: AbortSignal.timeout(1800) });
        const data = await response.json();
        const location = { lat: Number(data.latitude) || fallback.lat, lng: Number(data.longitude) || fallback.lng, city: data.city || "unknown" };
        ipLocationCache.set(ip, location);
        return location;
    } catch {
        ipLocationCache.set(ip, fallback);
        return fallback;
    }
}

function getRequestLog(req, duration, statusCode) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        method: req.method,
        endpoint: req.originalUrl.split("?")[0],
        status: statusCode >= 400 ? "ERROR" : "OK",
        statusCode,
        latency: duration,
        ip: getClientIp(req),
        location: { lat: 20 + Math.random() * 35, lng: -110 + Math.random() * 180 }
    };
}

function drawStatusImage(metrics) {
    if (!createCanvas) {
        const text = `HUSKY API // STATUS\nUptime: ${metrics.uptimePercent}%\nRequests: ${metrics.totalRequests}`;
        return Buffer.from(text, "utf8");
    }

    const canvas = createCanvas(1200, 630);
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#070b13");
    gradient.addColorStop(1, "#0b1828");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 630);

    context.strokeStyle = "rgba(32, 211, 238, 0.08)";
    context.lineWidth = 1;
    for (let x = 0; x < 1200; x += 48) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 630); context.stroke();
    }
    for (let y = 0; y < 630; y += 48) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(1200, y); context.stroke();
    }

    context.fillStyle = "#20d3ee";
    context.font = "700 24px monospace";
    context.fillText("HUSKY API // SYSTEM STATUS", 72, 86);
    context.fillStyle = "#f8fafc";
    context.font = "700 64px monospace";
    context.fillText("OPERATIONAL", 72, 170);
    context.fillStyle = "#94a3b8";
    context.font = "24px monospace";
    context.fillText("Realtime service telemetry", 76, 214);

    const cards = [
        ["UPTIME", `${metrics.uptimePercent}%`],
        ["AVG LATENCY", `${metrics.averageLatency} ms`],
        ["ACTIVE REQUESTS", String(metrics.activeRequests)],
        ["TOTAL REQUESTS", String(metrics.totalRequests)]
    ];
    cards.forEach(([label, value], index) => {
        const x = 72 + (index % 2) * 530;
        const y = 290 + Math.floor(index / 2) * 126;
        context.strokeStyle = "#164e63";
        context.strokeRect(x, y, 470, 92);
        context.fillStyle = "#67e8f9";
        context.font = "18px monospace";
        context.fillText(label, x + 22, y + 30);
        context.fillStyle = "#f8fafc";
        context.font = "700 34px monospace";
        context.fillText(value, x + 22, y + 70);
    });

    context.fillStyle = "#64748b";
    context.font = "16px monospace";
    context.fillText(`Generated ${new Date().toISOString()} // husky-api`, 72, 586);
    return canvas.toBuffer("image/png");
}

app.use(async (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const method = req.method;
    const endpoint = req.originalUrl.split("?")[0];
    const start = Date.now();
    const requestId = `${method}:${endpoint}:${start}`;
    activeRequests.add(requestId);

    try {
        if (matchOpenApiPath(endpoint)) {
            console.log(chalk.yellow(`🟡 [REQUEST] ${method} ${endpoint} | IP: ${ip}`));
        }

        next();

        res.on("finish", () => {
            const duration = Date.now() - start;
            const isError = res.statusCode >= 400;
            const status = isError ? "error" : "success";
            activeRequests.delete(requestId);

            if (!matchOpenApiPath(endpoint)) return;

            metricTotals.total++;
            metricTotals.totalDuration += duration;
            if (isError) metricTotals.errors++;

            const requestLog = getRequestLog(req, duration, res.statusCode);
            recentRequests.unshift(requestLog);
            recentRequests.splice(MAX_RECENT_REQUESTS);
            resolveIpLocation(requestLog.ip).then((location) => {
                requestLog.location = location;
                publishMetric({ type: "request", request: requestLog, metrics: getMetricsSnapshot() });
            });

            if (!endpointStats[endpoint]) {
                endpointStats[endpoint] = { total: 0, errors: 0, totalDuration: 0 };
            }

            endpointStats[endpoint].total++;
            endpointStats[endpoint].totalDuration += duration;
            if (isError) endpointStats[endpoint].errors++;

            const avg = (
                endpointStats[endpoint].totalDuration / endpointStats[endpoint].total
            ).toFixed(2);

            console.log(
                chalk[isError ? "red" : "green"](
                    `${isError ? "❌" : "✅"} [${status.toUpperCase()}] ${method} ${endpoint} | ${res.statusCode} | ${duration}ms (Avg: ${avg}ms)`
                )
            );
        });
    } catch (err) {
        console.error(chalk.red(`❌ Middleware Error: ${err.message}`));
        res.status(500).json({ status: false, message: "Internal middleware error" });
    }
});

// ========== LOAD API ROUTES ==========
let totalRoutes = 0;
const apiFolder = path.join(__dirname, "./src/api");

if (fs.existsSync(apiFolder)) {
    fs.readdirSync(apiFolder).forEach((sub) => {
        const subPath = path.join(apiFolder, sub);
        if (fs.statSync(subPath).isDirectory()) {
            fs.readdirSync(subPath).forEach((file) => {
                if (file.endsWith(".js")) {
                    const route = require(path.join(subPath, file));
                    if (typeof route === "function") route(app);

                    totalRoutes++;
                    console.log(chalk.bgYellow.black(`Loaded Route: ${file}`));
                }
            });
        }
    });
}

// ========== MAIN ROUTES ==========
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "api-page", "dashboard.html")));
app.get("/docs", (req, res) => res.sendFile(path.join(__dirname, "api-page", "docs.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "api-page", "dashboard.html")));

app.get("/api/metrics", (req, res) => {
    res.json({ status: true, metrics: getMetricsSnapshot(), requests: recentRequests });
});

app.get("/v1/status/image", (req, res) => {
    res.type("png").set("Cache-Control", "no-store").send(drawStatusImage(getMetricsSnapshot()));
});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "api-page", "404.html")));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, "api-page", "500.html"));
});

// ========== START ==========
const dashboardWss = new WebSocketServer({ noServer: true });
dashboardWss.on("connection", (socket) => {
    dashboardClients.add(socket);
    socket.send(JSON.stringify({ type: "snapshot", metrics: getMetricsSnapshot(), requests: recentRequests }));
    socket.on("close", () => dashboardClients.delete(socket));
});

server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
        socket.destroy();
        return;
    }
    dashboardWss.handleUpgrade(request, socket, head, (client) => dashboardWss.emit("connection", client, request));
});

if (process.env.VERCEL) {
    module.exports = app;
} else {
    server.listen(PORT, () => {
        console.log(chalk.bgGreen.black(`Server running on port ${PORT}`));
        console.log(chalk.blue(`Total Routes Loaded: ${totalRoutes}`));
    });
}
