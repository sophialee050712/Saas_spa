import type { ServerResponse } from 'node:http';

export function healthHandler(res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true, service: 'spa-saas-api', stage: 'GD0' }));
}
