const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), http = require("node:http");
const { createStaticServer } = require("../static-server.cjs");
test("loopback asset server prevents stale HTML caching and rejects unexpected hosts", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "iris-assets-")); fs.writeFileSync(path.join(root,"index.html"),"<h1>Iris</h1>");
  const { server, origin } = await createStaticServer(root);
  try {
    const response = await fetch(origin); assert.equal(response.status,200); assert.equal(response.headers.get("cache-control"),"no-store"); assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
    const hostStatus = await new Promise((resolve,reject) => { const req = http.get(origin,{headers:{Host:"attacker.example"}},res => { res.resume(); resolve(res.statusCode); }); req.on("error",reject); });
    assert.equal(hostStatus,403);
    assert.equal((await fetch(origin,{method:"POST"})).status,403);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(root,{recursive:true}); }
});
