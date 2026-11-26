// Smoke test for the SpectreScan MCP server over stdio.
// Sends initialize, tools/list, and one call per tool, prints results.
import { spawn } from "node:child_process";

const server = spawn("node", ["dist/index.js"], { cwd: process.cwd() });

let buffer = "";
const pending = new Map();
let nextId = 1;

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  server.stdin.write(JSON.stringify(msg) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => reject(new Error("timeout for " + method)), 90000);
  });
}

server.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id).resolve(msg);
        pending.delete(msg.id);
      }
    } catch {
      // ignore non-JSON lines
    }
  }
});
server.stderr.on("data", (d) => process.stderr.write("[server stderr] " + d));

async function tool(name, args) {
  const res = await send("tools/call", {
    name,
    arguments: args,
  });
  const text = res.result?.content?.[0]?.text ?? JSON.stringify(res);
  return text.slice(0, 400);
}

const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke-test", version: "1.0.0" },
});
console.log("initialize ok:", !!init.result);

const list = await send("tools/list", {});
console.log(
  "tools:",
  list.result.tools.map((t) => t.name).join(", "),
);

console.log(
  "getTokenInfo CAKE:",
  await tool("getTokenInfo", {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  }),
);
console.log(
  "getPairInfo CAKE:",
  await tool("getPairInfo", {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  }),
);
console.log(
  "getContractSource AGIO:",
  await tool("getContractSource", {
    address: "0x07D1554f450bE9158993180Dd0494A00C5c696dA",
  }),
);
console.log(
  "scanContract SELO:",
  await tool("scanContract", {
    address: "0x903449fdca80acec639941dc3c84f439cbad5df7",
  }),
);

server.kill();
process.exit(0);
