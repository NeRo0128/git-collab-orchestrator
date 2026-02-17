// Git operations manager for gco
import simpleGit from 'simple-git';
import path from 'path';

/**
 * Create a simple-git instance for the project root
 */
export function createGit(projectRoot) {
  return simpleGit(projectRoot);
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(projectRoot) {
  const git = createGit(projectRoot);
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
  return branch.trim();
}

/**
 * Parse agent and task from branch name
 * Format: agent/<agentName>/TASK-NNN
 */
export function parseBranchName(branchName) {
  const match = branchName.match(/^agent\/([^/]+)\/(TASK-\d+)$/);
  if (!match) return null;
  return {
    agent: match[1],
    taskId: match[2],
  };
}

/**
 * Create a new branch from base branch
 */
export async function createBranch(projectRoot, branchName, baseBranch = 'develop') {
  const git = createGit(projectRoot);
  try {
    await git.checkoutBranch(branchName, baseBranch);
  } catch (err) {
    // If base branch doesn't exist, try from current
    if (err.message.includes('not a valid')) {
      const current = await getCurrentBranch(projectRoot);
      await git.checkoutBranch(branchName, current);
    } else {
      throw err;
    }
  }
  return branchName;
}

/**
 * Check if a branch exists
 */
export async function branchExists(projectRoot, branchName) {
  const git = createGit(projectRoot);
  const branches = await git.branchLocal();
  return branches.all.includes(branchName);
}

/**
 * Get diff between branch and base
 */
export async function getBranchDiff(projectRoot, branchName, baseBranch = 'develop') {
  const git = createGit(projectRoot);
  try {
    const diff = await git.diff([`${baseBranch}...${branchName}`]);
    return diff;
  } catch {
    return '';
  }
}

/**
 * Get commit log for a branch
 */
export async function getBranchLog(projectRoot, branchName, baseBranch = 'develop') {
  const git = createGit(projectRoot);
  try {
    const log = await git.log({ from: baseBranch, to: branchName });
    return log.all;
  } catch {
    return [];
  }
}

/**
 * Merge a branch into base branch (--no-ff)
 */
export async function mergeBranch(projectRoot, branchName, baseBranch = 'develop', message) {
  const git = createGit(projectRoot);
  await git.checkout(baseBranch);
  await git.merge([branchName, '--no-ff', '-m', message]);
}

/**
 * Delete a branch
 */
export async function deleteBranch(projectRoot, branchName) {
  const git = createGit(projectRoot);
  await git.deleteLocalBranch(branchName, true);
}

/**
 * Check if working directory is clean
 */
export async function isClean(projectRoot) {
  const git = createGit(projectRoot);
  const status = await git.status();
  return status.isClean();
}

/**
 * Get files changed in a branch compared to base
 */
export async function getChangedFiles(projectRoot, branchName, baseBranch = 'develop') {
  const git = createGit(projectRoot);
  try {
    const diff = await git.diff(['--name-only', `${baseBranch}...${branchName}`]);
    return diff
      .trim()
      .split('\n')
      .filter((f) => f);
  } catch {
    return [];
  }
}

/**
 * Detect agent info from current branch
 */
export async function detectAgentFromBranch(projectRoot) {
  const branch = await getCurrentBranch(projectRoot);
  return parseBranchName(branch);
}
