/* ============================================================
   Trinidad & Tobago 2026 — server.js
   Serves the static PWA AND provides a tiny REST API that
   persists all trip data in a Railway PostgreSQL database.
   ============================================================ */
const http  = require("http");
const fs    = require("fs");
const path  = require("path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

/* ── PostgreSQL connection ──
   Railway exposes either DATABASE_URL (if you add a variable reference)
   OR individual PG* env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
   We support both so the app works however Railway is configured. */
function makePool() {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Internal Railway private network URLs contain "railway.internal" — no SSL needed.
    // Public URLs (postgres.railway.internal replaced by external host) need SSL.
    const ssl = url.includes("railway.internal") ? false : { rejectUnauthorized: false };
    return new Pool({ connectionString: url, ssl });
  }
  // Fall back to individual PG* variables (Railway shares these automatically
  // when you click "Add Variable Reference" for the Postgres service).
  return new Pool({
    host:     process.env.PGHOST     || process.env.RAILWAY_PRIVATE_DOMAIN,
    port:     parseInt(process.env.PGPORT || "5432"),
    user:     process.env.PGUSER     || process.env.POSTGRES_USER,
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || "railway",
    ssl: false  // internal Railway network — no SSL
  });
}
const pool = makePool();

/* ── Create tables on startup ── */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_state (
      id      TEXT PRIMARY KEY DEFAULT 'main',
      data    JSONB NOT NULL,
      updated TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id      TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      type    TEXT,
      size    INT,
      cat     TEXT DEFAULT 'Other',
      added   DATE DEFAULT CURRENT_DATE,
      data    TEXT  -- base64 data URL
    );
  `);
  console.log("DB tables ready");
}

initDB().catch(e => console.error("DB init error:", e.message));

/* ── Static file MIME types ── */
const TYPES = {
  ".html":        "text/html; charset=utf-8",
  ".js":          "text/javascript; charset=utf-8",
  ".css":         "text/css; charset=utf-8",
  ".json":        "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png":         "image/png",
  ".jpg":         "image/jpeg",
  ".jpeg":        "image/jpeg",
  ".svg":         "image/svg+xml",
  ".ico":         "image/x-icon",
  ".txt":         "text/plain; charset=utf-8",
  ".md":          "text/markdown; charset=utf-8"
};

/* ── Helpers ── */
function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}
function sendJSON(res, code, obj) {
  send(res, code, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 20e6) reject(new Error("too large")); });
    req.on("end",  () => resolve(body));
    req.on("error", reject);
  });
}

/* ── Request handler ── */
http.createServer(async (req, res) => {
  // CORS headers (same-origin Railway app — relaxed)
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { send(res, 204, {}, ""); return; }

  const url    = req.url.split("?")[0];
  const method = req.method;

  try {

    /* ════════════════════════════════════
       API routes
    ════════════════════════════════════ */

    /* GET /api/state — load trip state */
    if (url === "/api/state" && method === "GET") {
      const r = await pool.query("SELECT data FROM trip_state WHERE id='main'");
      sendJSON(res, 200, r.rows[0] ? r.rows[0].data : null);
      return;
    }

    /* PUT /api/state — save trip state */
    if (url === "/api/state" && method === "PUT") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      await pool.query(`
        INSERT INTO trip_state (id, data, updated)
        VALUES ('main', $1, NOW())
        ON CONFLICT (id) DO UPDATE SET data=$1, updated=NOW()
      `, [data]);
      sendJSON(res, 200, { ok: true });
      return;
    }

    /* GET /api/attachments — list all attachments (without data) */
    if (url === "/api/attachments" && method === "GET") {
      const r = await pool.query(
        "SELECT id, name, type, size, cat, added FROM attachments ORDER BY added DESC"
      );
      sendJSON(res, 200, r.rows);
      return;
    }

    /* GET /api/attachments/:id — get single attachment with data */
    if (url.startsWith("/api/attachments/") && method === "GET") {
      const id = url.slice("/api/attachments/".length);
      const r  = await pool.query("SELECT * FROM attachments WHERE id=$1", [id]);
      if (!r.rows[0]) { sendJSON(res, 404, { error: "not found" }); return; }
      sendJSON(res, 200, r.rows[0]);
      return;
    }

    /* POST /api/attachments — upload a file */
    if (url === "/api/attachments" && method === "POST") {
      const body = await readBody(req);
      const a    = JSON.parse(body);
      await pool.query(
        "INSERT INTO attachments (id,name,type,size,cat,added,data) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [a.id, a.name, a.type, a.size, a.cat || "Other", a.date || new Date().toISOString().slice(0,10), a.data]
      );
      sendJSON(res, 201, { ok: true });
      return;
    }

    /* PUT /api/attachments/:id — update category */
    if (url.startsWith("/api/attachments/") && method === "PUT") {
      const id   = url.slice("/api/attachments/".length);
      const body = await readBody(req);
      const a    = JSON.parse(body);
      await pool.query("UPDATE attachments SET cat=$1 WHERE id=$2", [a.cat, id]);
      sendJSON(res, 200, { ok: true });
      return;
    }

    /* DELETE /api/attachments/:id — remove file */
    if (url.startsWith("/api/attachments/") && method === "DELETE") {
      const id = url.slice("/api/attachments/".length);
      await pool.query("DELETE FROM attachments WHERE id=$1", [id]);
      sendJSON(res, 200, { ok: true });
      return;
    }

    /* ════════════════════════════════════
       Static file serving
    ════════════════════════════════════ */
    let urlPath = decodeURIComponent(url);
    if (urlPath === "/") urlPath = "/index.html";

    const safePath = path.normalize(path.join(ROOT, urlPath));
    if (safePath !== ROOT && !safePath.startsWith(ROOT + path.sep)) {
      send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
      return;
    }

    fs.stat(safePath, (err, st) => {
      if (err || !st.isFile()) {
        return fs.readFile(path.join(ROOT, "index.html"), (e, buf) => {
          if (e) return send(res, 404, { "Content-Type": "text/plain" }, "Not found");
          send(res, 200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" }, buf);
        });
      }
      const ext     = path.extname(safePath).toLowerCase();
      const headers = { "Content-Type": TYPES[ext] || "application/octet-stream" };
      const base    = path.basename(safePath);
      if (base === "sw.js" || ext === ".html" || base === "manifest.webmanifest") {
        headers["Cache-Control"] = "no-cache";
      } else {
        headers["Cache-Control"] = "public, max-age=86400";
      }
      res.writeHead(200, headers);
      fs.createReadStream(safePath).pipe(res);
    });

  } catch (e) {
    console.error(e);
    sendJSON(res, 500, { error: e.message });
  }

}).listen(PORT, () => console.log("Trini trip app listening on port " + PORT));
