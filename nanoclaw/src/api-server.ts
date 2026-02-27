import http from 'http';

import { readEnvFile } from './env.js';
import { getAllRegisteredGroups, getAllTasks, getTaskRunLogs } from './db.js';
import { logger } from './logger.js';

const API_PORT = parseInt(process.env.API_PORT || '3001', 10);

const envSecrets = readEnvFile(['DASHBOARD_API_KEY']);
const DASHBOARD_API_KEY =
  process.env.DASHBOARD_API_KEY || envSecrets.DASHBOARD_API_KEY || '';

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function unauthorized(res: http.ServerResponse): void {
  json(res, { error: 'Unauthorized' }, 401);
}

export function startApiServer(): http.Server {
  if (!DASHBOARD_API_KEY) {
    logger.warn('DASHBOARD_API_KEY not set — API server disabled');
    return null as unknown as http.Server;
  }

  const server = http.createServer((req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    // Auth check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== DASHBOARD_API_KEY) {
      unauthorized(res);
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${API_PORT}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/api/health') {
        json(res, { status: 'ok', timestamp: new Date().toISOString() });
      } else if (pathname === '/api/tasks') {
        const tasks = getAllTasks();
        json(res, tasks);
      } else if (pathname.match(/^\/api\/tasks\/[^/]+\/runs$/)) {
        const taskId = pathname.split('/')[3];
        const runs = getTaskRunLogs(taskId);
        json(res, runs);
      } else if (pathname === '/api/groups') {
        const groups = getAllRegisteredGroups();
        json(res, groups);
      } else {
        json(res, { error: 'Not found' }, 404);
      }
    } catch (err) {
      logger.error({ err, path: pathname }, 'API error');
      json(res, { error: 'Internal server error' }, 500);
    }
  });

  server.listen(API_PORT, () => {
    logger.info({ port: API_PORT }, 'API server started');
  });

  return server;
}
