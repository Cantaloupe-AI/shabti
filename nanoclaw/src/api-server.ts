import crypto from 'crypto';
import http from 'http';

import { readEnvFile } from './env.js';
import {
  createTask,
  deleteTask,
  getAllRegisteredGroups,
  getAllTasks,
  getTaskById,
  getTaskRunLogs,
  updateTask,
} from './db.js';
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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function unauthorized(res: http.ServerResponse): void {
  json(res, { error: 'Unauthorized' }, 401);
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export function startApiServer(): http.Server {
  if (!DASHBOARD_API_KEY) {
    logger.warn('DASHBOARD_API_KEY not set — API server disabled');
    return null as unknown as http.Server;
  }

  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
    const method = req.method || 'GET';

    try {
      if (pathname === '/api/health') {
        json(res, { status: 'ok', timestamp: new Date().toISOString() });
      } else if (pathname === '/api/tasks' && method === 'GET') {
        const tasks = getAllTasks();
        json(res, tasks);
      } else if (pathname === '/api/tasks' && method === 'POST') {
        const body = await parseBody(req);
        const prompt = String(body.prompt || '').trim();
        if (!prompt) { json(res, { error: 'prompt is required' }, 400); return; }
        const scheduleMs = Number(body.schedule_value);
        if (!scheduleMs || scheduleMs <= 0 || !isFinite(scheduleMs)) {
          json(res, { error: 'schedule_value must be a positive number (ms)' }, 400); return;
        }
        const id = crypto.randomUUID();
        const now = new Date();
        const nextRun = new Date(now.getTime() + scheduleMs).toISOString();
        createTask({
          id,
          group_folder: String(body.group_folder || 'main'),
          chat_jid: String(body.chat_jid || ''),
          prompt,
          schedule_type: 'interval',
          schedule_value: String(body.schedule_value),
          context_mode: (body.context_mode as 'group' | 'isolated') || 'isolated',
          next_run: nextRun,
          status: 'active',
          created_at: now.toISOString(),
        });
        const task = getTaskById(id);
        json(res, task, 201);
      } else if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'PATCH') {
        const taskId = pathname.split('/')[3];
        const existing = getTaskById(taskId);
        if (!existing) { json(res, { error: 'Not found' }, 404); return; }
        const body = await parseBody(req);
        const updates: Record<string, unknown> = {};
        if (body.prompt !== undefined) updates.prompt = String(body.prompt);
        if (body.schedule_value !== undefined) updates.schedule_value = String(body.schedule_value);
        if (body.status !== undefined) updates.status = String(body.status);
        updateTask(taskId, updates);
        const task = getTaskById(taskId);
        json(res, task);
      } else if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'DELETE') {
        const taskId = pathname.split('/')[3];
        const existing = getTaskById(taskId);
        if (!existing) { json(res, { error: 'Not found' }, 404); return; }
        deleteTask(taskId);
        json(res, { ok: true });
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
