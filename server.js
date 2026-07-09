/* Tiny zero-dependency static file server for the Trinidad & Tobago 2026 app.
   Designed for Railway: listens on process.env.PORT and serves ./public. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}

http
  .createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";

      const safePath = path.normalize(path.join(ROOT, urlPath));
      // block path traversal outside ROOT
      if (safePath !== ROOT && !safePath.startsWith(ROOT + path.sep)) {
        return send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
      }

      fs.stat(safePath, (err, st) => {
        if (err || !st.isFile()) {
          // fall back to index.html so deep links still load
          return fs.readFile(path.join(ROOT, "index.html"), (e, buf) => {
            if (e) return send(res, 404, { "Content-Type": "text/plain" }, "Not found");
            send(res, 200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" }, buf);
          });
        }
        const ext = path.extname(safePath).toLowerCase();
        const headers = { "Content-Type": TYPES[ext] || "application/octet-stream" };
        const base = path.basename(safePath);
        if (base === "sw.js" || ext === ".html" || base === "manifest.webmanifest") {
          headers["Cache-Control"] = "no-cache";
        } else {
          headers["Cache-Control"] = "public, max-age=86400";
        }
        res.writeHead(200, headers);
        fs.createReadStream(safePath).pipe(res);
      });
    } catch (e) {
      send(res, 500, { "Content-Type": "text/plain" }, "Server error");
    }
  })
  .listen(PORT, () => console.log("Trip app listening on port " + PORT));
