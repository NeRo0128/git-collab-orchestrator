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

export const DEFAULT_CONFIG = {
  version: '1.0.0',
  mainBranch: 'develop',
  branchPrefix: 'agent',
  github: {
    token: '',
    repo: '',
    owner: '',
  },
  agents: {
    vscode: {
      name: '@vscode',
      type: 'copilot-chat',
    },
    copilot: {
      name: '@copilot',
      type: 'copilot-cli',
    },
  },
  log: {
    autoArchive: false,
    archiveTime: '23:59',
  },
  templates: {
    type: 'generic',
  },
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
