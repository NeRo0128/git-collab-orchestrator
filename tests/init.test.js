// Integration tests for gco init command
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { BASE_AGENT_CATALOG } from '../src/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BIN_PATH = path.resolve(__dirname, '../bin/gco.js');

function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-init-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'ignore' });
  return dir;
}

function runInit(cwd, flags = '') {
  execSync(`node "${BIN_PATH}" init ${flags}`.trim(), {
    cwd,
    stdio: 'ignore',
  });
}

function readConfig(repoDir) {
  const configPath = path.join(repoDir, '.gco', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

describe('gco init strict mode', () => {
  let repoDir;

  beforeEach(() => {
    repoDir = createTempRepo();
  });

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('keeps default behavior without --strict', () => {
    runInit(repoDir);

    const config = readConfig(repoDir);
    expect(config.strictMode).toBe(false);
    expect(config.mode).toBe('execution');
    expect(config.requireContextComplete).toBe(false);
    expect(config.requireTasksBeforeCode).toBe(false);

    expect(fs.existsSync(path.join(repoDir, '.githooks'))).toBe(false);

    let hooksPath = '';
    try {
      hooksPath = execSync('git config --get core.hooksPath', {
        cwd: repoDir,
        stdio: 'pipe',
      })
        .toString()
        .trim();
    } catch {
      hooksPath = '';
    }

    expect(hooksPath).toBe('');

    for (const agentId of Object.keys(BASE_AGENT_CATALOG)) {
      expect(fs.existsSync(path.join(repoDir, '.gco', 'agents', `${agentId}-template.md`))).toBe(
        true
      );
    }
  });

  it('enables strict mode with --strict', () => {
    runInit(repoDir, '--strict');

    const config = readConfig(repoDir);
    expect(config.strictMode).toBe(true);
    expect(config.mode).toBe('planning');
    expect(config.requireContextComplete).toBe(true);
    expect(config.requireTasksBeforeCode).toBe(true);

    expect(fs.existsSync(path.join(repoDir, '.githooks', 'pre-commit'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, '.githooks', 'commit-msg'))).toBe(true);

    const hooksPath = execSync('git config --get core.hooksPath', {
      cwd: repoDir,
      stdio: 'pipe',
    })
      .toString()
      .trim();

    expect(hooksPath).toBe('.githooks');
  });
});
