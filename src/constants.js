// Constants and shared utilities for gco

export const STATUSES = ['pending', 'in-progress', 'blocked', 'completed', 'review'];

export const LOG_TYPES = [
  'start',
  'progress',
  'decision',
  'block',
  'question',
  'answer',
  'complete',
  'system',
];

export const STATUS_ICONS = {
  pending: '⏳',
  'in-progress': '🟡',
  blocked: '🔴',
  completed: '✅',
  review: '👀',
};

export const GCO_DIR = '.gco';
export const GCO_LOGS_DIR = '.gco-logs';
export const TASKS_FILE = 'tasks.md';
export const DEVELOP_LOG_FILE = 'DEVELOP_LOG.md';
export const CONFIG_FILE = '.gco/config.json';
export const BRIEFINGS_DIR = '.gco/briefings';
export const AGENTS_DIR = '.gco/agents';
export const LOG_INDEX_FILE = '.gco-logs/index.json';
export const CURRENT_LOG_FILE = '.gco-logs/current.md';
export const AGENT_INSTRUCTIONS_FILE = '.gco/AGENT_INSTRUCTIONS.md';
export const PROJECT_CONTEXT_FILE = '.gco/PROJECT_CONTEXT.md';
export const GIT_HOOKS_DIR = '.githooks';
export const PRE_COMMIT_HOOK_FILE = '.githooks/pre-commit';
export const COMMIT_MSG_HOOK_FILE = '.githooks/commit-msg';

export const BASE_AGENT_CATALOG = {
  vscode: {
    name: '@vscode',
    type: 'copilot-chat',
    description: 'GitHub Copilot Chat en VS Code',
  },
  copilot: {
    name: '@copilot',
    type: 'copilot-cli',
    description: 'GitHub Copilot CLI / terminal workflows',
  },
  claude: {
    name: '@claude',
    type: 'claude-cli',
    description: 'Claude CLI',
  },
  cursor: {
    name: '@cursor',
    type: 'cursor-agent',
    description: 'Cursor Agent',
  },
  windsurf: {
    name: '@windsurf',
    type: 'windsurf-agent',
    description: 'Windsurf Agent',
  },
  aider: {
    name: '@aider',
    type: 'aider-cli',
    description: 'Aider CLI',
  },
  codex: {
    name: '@codex',
    type: 'openai-codex-cli',
    description: 'OpenAI Codex CLI',
  },
};

export const DEFAULT_CONFIG = {
  version: '1.0.0',
  mainBranch: 'develop',
  branchPrefix: 'agent',
  github: {
    token: '',
    repo: '',
    owner: '',
  },
  agents: Object.fromEntries(
    Object.entries(BASE_AGENT_CATALOG).map(([id, value]) => [
      id,
      {
        name: value.name,
        type: value.type,
      },
    ])
  ),
  log: {
    autoArchive: false,
    archiveTime: '23:59',
  },
  templates: {
    type: 'generic',
  },
  strictMode: false,
  mode: 'execution',
  requireContextComplete: false,
  requireTasksBeforeCode: false,
};

export const TEMPLATES = {
  generic: {
    name: 'Generic',
    description: 'Template genérico para cualquier proyecto',
  },
  react: {
    name: 'React',
    description: 'Template para proyectos React/Next.js',
  },
  node: {
    name: 'Node.js',
    description: 'Template para proyectos Node.js/Express',
  },
};
