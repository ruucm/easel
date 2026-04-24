#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { resolveBaseUrl, resolveProjectRoot } from "./project.js";

async function main() {
  const projectRoot = resolveProjectRoot();
  const baseUrl = resolveBaseUrl();

  // All informational logging goes to stderr so stdout stays clean for MCP.
  process.stderr.write(
    `[easel-mcp] projectRoot=${projectRoot} baseUrl=${baseUrl}\n`
  );

  const server = createServer({ projectRoot, baseUrl });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[easel-mcp] fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
