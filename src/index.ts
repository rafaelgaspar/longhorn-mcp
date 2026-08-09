#!/usr/bin/env node
import { createServer as createHttpServer } from 'node:http';
import { hostHeaderValidation, NodeStreamableHTTPServerTransport, originValidation } from '@modelcontextprotocol/node';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { parseArgs } from './cli.js';
import { createServer } from './server.js';

const options = parseArgs(process.argv.slice(2));
const server = createServer({ longhornUrl: options.longhornUrl, readOnly: options.readOnly });

if (options.http) {
  const validateHost = hostHeaderValidation(options.allowedHosts);
  const validateOrigin = originValidation(options.allowedHosts);

  createHttpServer(async (req, res) => {
    // Must run before the Host/Origin guards so kubelet's liveness/readiness
    // probe (which hits the pod IP directly, not an allowed hostname) is
    // never rejected.
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }

    // The guards answer rejected requests with 403 themselves and return
    // false — the handler must not touch the request further in that case.
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;

    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }).listen(options.port, options.host, () => {
    console.error(`longhorn-mcp running on http://${options.host}:${options.port} (read-only: ${options.readOnly})`);
  });
} else {
  void serveStdio(() => server);
  console.error(`longhorn-mcp running on stdio (read-only: ${options.readOnly})`);
}
