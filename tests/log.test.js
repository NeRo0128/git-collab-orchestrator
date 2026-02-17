// Tests for log manager
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  ensureLogDir,
  addLogEntry,
  readCurrentLog,
  archiveLog,
  getTaskLogEntries,
} from '../src/log.js';

function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-test-'));
  fs.mkdirSync(path.join(dir, '.gco'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.gco', 'config.json'), '{}');
  return dir;
}

describe('LogManager', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ensureLogDir creates structure', () => {
    ensureLogDir(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.gco-logs'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gco-logs', 'current.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.gco-logs', 'index.json'))).toBe(true);
  });

  it('addLogEntry appends to current log', () => {
    ensureLogDir(tmpDir);
    addLogEntry(tmpDir, {
      agent: 'vscode',
      taskId: 'TASK-001',
      type: 'start',
      message: 'Iniciando tarea',
    });

    const content = readCurrentLog(tmpDir);
    expect(content).toContain('@vscode');
    expect(content).toContain('TASK-001');
    expect(content).toContain('start');
    expect(content).toContain('Iniciando tarea');
  });

  it('addLogEntry updates DEVELOP_LOG.md', () => {
    ensureLogDir(tmpDir);
    addLogEntry(tmpDir, {
      agent: 'copilot',
      taskId: 'TASK-002',
      type: 'progress',
      message: '50% completado',
    });

    const devLog = fs.readFileSync(path.join(tmpDir, 'DEVELOP_LOG.md'), 'utf-8');
    expect(devLog).toContain('TASK-002');
  });

  it('addLogEntry updates index.json', () => {
    ensureLogDir(tmpDir);
    addLogEntry(tmpDir, {
      agent: 'vscode',
      taskId: 'TASK-001',
      type: 'start',
      message: 'Test',
    });

    const index = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.gco-logs', 'index.json'), 'utf-8')
    );
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].agent).toBe('vscode');
    expect(index.entries[0].taskId).toBe('TASK-001');
  });

  it('archiveLog moves current to date file', () => {
    ensureLogDir(tmpDir);
    addLogEntry(tmpDir, {
      agent: 'vscode',
      taskId: 'TASK-001',
      type: 'start',
      message: 'Test entry',
    });

    const archivePath = archiveLog(tmpDir);
    expect(archivePath).not.toBeNull();
    expect(fs.existsSync(archivePath)).toBe(true);

    // Verify the archive contains the entry
    const archived = fs.readFileSync(archivePath, 'utf-8');
    expect(archived).toContain('Test entry');

    // Current log should be fresh
    const current = readCurrentLog(tmpDir);
    expect(current).not.toContain('Test entry');
  });

  it('getTaskLogEntries filters by taskId', () => {
    ensureLogDir(tmpDir);
    addLogEntry(tmpDir, {
      agent: 'vscode',
      taskId: 'TASK-001',
      type: 'start',
      message: 'First task',
    });
    addLogEntry(tmpDir, {
      agent: 'copilot',
      taskId: 'TASK-002',
      type: 'start',
      message: 'Second task',
    });
    addLogEntry(tmpDir, {
      agent: 'vscode',
      taskId: 'TASK-001',
      type: 'progress',
      message: 'Progress on first',
    });

    const entries = getTaskLogEntries(tmpDir, 'TASK-001');
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('start');
    expect(entries[1].type).toBe('progress');
  });
});
