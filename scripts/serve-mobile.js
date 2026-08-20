const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../mobile");
const port = Number(process.argv[2] || process.env.PORT || 4173);
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json; charset=utf-8", ".svg":"image/svg+xml" };

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  fs.readFile(target, (error, data) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control":"no-cache" });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => console.log(`NeoPet Mobile: http://127.0.0.1:${port}`));
