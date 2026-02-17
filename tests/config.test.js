// Tests for configuration manager
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  findProjectRoot,
} from '../src/config.js';
import { DEFAULT_CONFIG } from '../src/constants.js';

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-test-'));
  fs.mkdirSync(path.join(dir, '.gco'), { recursive: true });
  return dir;
}

describe('Config', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadConfig returns defaults when no config file', () => {
    const config = loadConfig(tmpDir);
    expect(config.version).toBe(DEFAULT_CONFIG.version);
    expect(config.mainBranch).toBe('develop');
  });

  it('saveConfig and loadConfig roundtrip', () => {
    const config = { ...DEFAULT_CONFIG, mainBranch: 'main' };
    saveConfig(tmpDir, config);
    const loaded = loadConfig(tmpDir);
    expect(loaded.mainBranch).toBe('main');
  });

  it('getConfigValue works with dot notation', () => {
    const config = {
      github: { token: 'abc123', repo: 'test' },
      agents: { vscode: { name: '@vscode' } },
    };
    expect(getConfigValue(config, 'github.token')).toBe('abc123');
    expect(getConfigValue(config, 'agents.vscode.name')).toBe('@vscode');
    expect(getConfigValue(config, 'nonexistent')).toBeUndefined();
    expect(getConfigValue(config, 'github.nonexistent')).toBeUndefined();
  });

  it('setConfigValue works with dot notation', () => {
    const config = {};
    setConfigValue(config, 'github.token', 'mytoken');
    expect(config.github.token).toBe('mytoken');

    setConfigValue(config, 'log.autoArchive', 'true');
    expect(config.log.autoArchive).toBe(true);

    setConfigValue(config, 'some.number', '42');
    expect(config.some.number).toBe(42);
  });

  it('findProjectRoot finds .gco directory', () => {
    const root = findProjectRoot(tmpDir);
    expect(root).toBe(tmpDir);
  });

  it('findProjectRoot returns null when not found', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-empty-'));
    const root = findProjectRoot(emptyDir);
    expect(root).toBeNull();
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });
});
