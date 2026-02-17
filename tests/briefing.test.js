// Tests for briefing generator
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateBriefing, saveBriefing, readBriefing } from '../src/briefing.js';
import { DEFAULT_CONFIG } from '../src/constants.js';
import { ensureLogDir } from '../src/log.js';

function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-test-'));
  fs.mkdirSync(path.join(dir, '.gco', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gco', 'briefings'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.gco', 'config.json'), '{}');
  return dir;
}

describe('BriefingGenerator', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    ensureLogDir(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates briefing with correct content', () => {
    const task = {
      id: 'TASK-001',
      title: 'Implement Login',
      description: 'Create login form',
      criteria: [
        { done: false, text: 'Email field' },
        { done: false, text: 'Password field' },
      ],
      dependencies: 'Ninguna',
      notes: 'Use react-hook-form',
    };

    const briefing = generateBriefing(tmpDir, task, 'vscode', DEFAULT_CONFIG);

    expect(briefing).toContain('TASK-001');
    expect(briefing).toContain('Implement Login');
    expect(briefing).toContain('@vscode');
    expect(briefing).toContain('agent/vscode/TASK-001');
    expect(briefing).toContain('Email field');
    expect(briefing).toContain('Password field');
    expect(briefing).toContain('react-hook-form');
  });

  it('saves and reads briefing', () => {
    const content = '# Test briefing content';
    const filePath = saveBriefing(tmpDir, 'TASK-001', 'vscode', content);

    expect(fs.existsSync(filePath)).toBe(true);

    const read = readBriefing(tmpDir, 'TASK-001', 'vscode');
    expect(read).toBe(content);
  });

  it('readBriefing returns null for non-existent', () => {
    const result = readBriefing(tmpDir, 'TASK-999', 'vscode');
    expect(result).toBeNull();
  });
});
