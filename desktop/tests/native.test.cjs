const { test } = require("node:test"), assert = require("node:assert/strict"), { spawn } = require("node:child_process"), path = require("node:path"), fs = require("node:fs");
const executable = path.resolve(__dirname, "../native/bin/IrisInput.exe");
test("compiled native helper dry-run checks its gate without injecting input", { skip: process.platform !== "win32" || !fs.existsSync(executable) }, async () => {
  const child = spawn(executable,["--dry-run"],{windowsHide:true}); let output="";
  child.stdout.setEncoding("utf8");
  const done = new Promise((resolve,reject) => { child.on("error",reject); child.on("exit",code => code === 0 ? resolve() : reject(new Error(`helper exit ${code}`))); });
  const timeout = setTimeout(() => child.kill(),5000);
  let sent = false;
  child.stdout.on("data",chunk => { output+=chunk; if (!sent && output.includes("READY")) { sent=true; child.stdin.end("CLICK\nHEARTBEAT\nSTATE 1\nMOVE 100 100\nCLICK\nSTATE 0\nRIGHT\nQUIT\n"); } });
  try { await done; assert.match(output,/READY/); assert.match(output,/DRY MOVE 100 100/); assert.equal((output.match(/DRY CLICK/g)||[]).length,1); assert.equal(output.includes("DRY RIGHT"),false); } finally { clearTimeout(timeout); }
});
