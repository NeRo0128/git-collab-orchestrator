// Tests for git operations
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { parseBranchName, createGit, getCurrentBranch, branchExists } from '../src/git.js';

function createTempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-git-test-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  // Create initial commit
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

describe('parseBranchName', () => {
  it('should parse valid agent branch', () => {
    const result = parseBranchName('agent/vscode/TASK-001');
    expect(result).toEqual({ agent: 'vscode', taskId: 'TASK-001' });
  });

  it('should parse copilot branch', () => {
    const result = parseBranchName('agent/copilot/TASK-042');
    expect(result).toEqual({ agent: 'copilot', taskId: 'TASK-042' });
  });

  it('should return null for non-agent branches', () => {
    expect(parseBranchName('main')).toBeNull();
    expect(parseBranchName('develop')).toBeNull();
    expect(parseBranchName('feature/login')).toBeNull();
  });
});

describe('Git operations', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitRepo();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('getCurrentBranch returns current branch', async () => {
    const branch = await getCurrentBranch(tmpDir);
    expect(branch).toBeTruthy();
    // Should be master or main depending on git config
    expect(['master', 'main']).toContain(branch);
  });

  it('branchExists checks correctly', async () => {
    const current = await getCurrentBranch(tmpDir);
    expect(await branchExists(tmpDir, current)).toBe(true);
    expect(await branchExists(tmpDir, 'nonexistent-branch')).toBe(false);
  });
});
