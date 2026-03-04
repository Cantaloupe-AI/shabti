import crypto from 'crypto';
import os from 'os';

import * as pty from 'node-pty';

import { logger } from './logger.js';

const MAX_SESSIONS = 5;

export interface TerminalSession {
  id: string;
  pty: pty.IPty;
  createdAt: string;
  cols: number;
  rows: number;
}

const sessions = new Map<string, TerminalSession>();

export function createSession(cols = 80, rows = 24): TerminalSession {
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error(`Maximum ${MAX_SESSIONS} concurrent terminal sessions`);
  }

  const id = crypto.randomUUID();
  const shell = process.env.SHELL || '/bin/bash';

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: process.env as Record<string, string>,
  });

  const session: TerminalSession = {
    id,
    pty: term,
    createdAt: new Date().toISOString(),
    cols,
    rows,
  };

  sessions.set(id, session);
  logger.info({ sessionId: id }, 'Terminal session created');

  term.onExit(() => {
    sessions.delete(id);
    logger.info({ sessionId: id }, 'Terminal session exited');
  });

  return session;
}

export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

export function listSessions(): { id: string; createdAt: string; cols: number; rows: number }[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    cols: s.cols,
    rows: s.rows,
  }));
}

export function destroySession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.pty.kill();
  sessions.delete(id);
  logger.info({ sessionId: id }, 'Terminal session destroyed');
  return true;
}

export function destroyAllSessions(): void {
  for (const [id, session] of sessions) {
    session.pty.kill();
    logger.info({ sessionId: id }, 'Terminal session destroyed (shutdown)');
  }
  sessions.clear();
}
