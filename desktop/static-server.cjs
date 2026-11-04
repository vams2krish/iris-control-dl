const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".task": "application/octet-stream" };
function createStaticServer(root, { port = 0 } = {}) {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || "") || !["GET", "HEAD"].includes(req.method)) { res.writeHead(403).end(); return; }
    let url;
    try { url = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname); } catch { res.writeHead(400).end(); return; }
    const file = path.resolve(resolvedRoot, "." + (url === "/" ? "/index.html" : url));
    if (!file.startsWith(resolvedRoot + path.sep)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store"); // old HTML must never reference replaced chunk hashes
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      if (req.method === "HEAD") res.end(); else fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
    });
  });
  return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })); });
}
module.exports = { createStaticServer };
if (require.main === module) createStaticServer(path.resolve(__dirname, "../web/out"), { port: Number(process.env.PORT || 3000) }).then(({ origin }) => console.log(`Iris preview: ${origin}`));
