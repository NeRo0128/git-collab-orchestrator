// Log manager for DEVELOP_LOG.md and .gco-logs/
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import {
  GCO_LOGS_DIR,
  CURRENT_LOG_FILE,
  LOG_INDEX_FILE,
  DEVELOP_LOG_FILE,
  STATUS_ICONS,
} from './constants.js';

/**
 * Ensure log directory structure exists
 */
export function ensureLogDir(projectRoot) {
  const logsDir = path.join(projectRoot, GCO_LOGS_DIR);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const currentLog = path.join(projectRoot, CURRENT_LOG_FILE);
  if (!fs.existsSync(currentLog)) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const header = generateLogHeader(today, path.basename(projectRoot));
    fs.writeFileSync(currentLog, header, 'utf-8');
  }
  // Ensure index
  const indexPath = path.join(projectRoot, LOG_INDEX_FILE);
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({ entries: [] }, null, 2), 'utf-8');
  }
}

/**
 * Generate the log header for a new day
 */
function generateLogHeader(date, projectName) {
  return `# DEVELOP_LOG - ${date}

> Proyecto: ${projectName}
> Agente responsable de actualizar: CUALQUIER agente que trabaje

---

## 📊 Estado de Agents (auto-generado por \`gco status\`)

| Agente | Tarea | Estado | Rama | Última Actividad | Bloqueos |
|--------|-------|--------|------|------------------|----------|

---

## 🚨 Alertas de Consistencia (auto-generado por \`gco validate\`)

---

## 📝 Entradas de Log (cronológico, más reciente abajo)

`;
}

/**
 * Add an entry to the current log
 */
export function addLogEntry(projectRoot, { agent, taskId, type, message }) {
  const currentLog = path.join(projectRoot, CURRENT_LOG_FILE);
  ensureLogDir(projectRoot);

  const now = format(new Date(), 'HH:mm:ss');
  const entry = `### [${now}] @${agent} - ${taskId} - ${type}
${message}

`;

  fs.appendFileSync(currentLog, entry, 'utf-8');

  // Update symlink / copy
  updateDevelopLog(projectRoot);

  // Update index
  updateLogIndex(projectRoot, { agent, taskId, type, message, time: now });
}

/**
 * Update DEVELOP_LOG.md (copy from current.md)
 */
export function updateDevelopLog(projectRoot) {
  const currentLog = path.join(projectRoot, CURRENT_LOG_FILE);
  const devLog = path.join(projectRoot, DEVELOP_LOG_FILE);

  if (fs.existsSync(currentLog)) {
    const content = fs.readFileSync(currentLog, 'utf-8');
    fs.writeFileSync(devLog, content, 'utf-8');
  }
}

/**
 * Read current log content
 */
export function readCurrentLog(projectRoot) {
  const currentLog = path.join(projectRoot, CURRENT_LOG_FILE);
  if (!fs.existsSync(currentLog)) {
    return '';
  }
  return fs.readFileSync(currentLog, 'utf-8');
}

/**
 * Update the log index
 */
function updateLogIndex(projectRoot, entry) {
  const indexPath = path.join(projectRoot, LOG_INDEX_FILE);
  let index = { entries: [] };
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  const today = format(new Date(), 'yyyy-MM-dd');
  index.entries.push({
    date: today,
    ...entry,
  });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Archive current log (move to date-named file)
 */
export function archiveLog(projectRoot) {
  const currentLog = path.join(projectRoot, CURRENT_LOG_FILE);
  if (!fs.existsSync(currentLog)) {
    return null;
  }

  const content = fs.readFileSync(currentLog, 'utf-8');
  if (!content.trim()) return null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const archivePath = path.join(projectRoot, GCO_LOGS_DIR, `${today}.md`);

  // If archive already exists, append
  if (fs.existsSync(archivePath)) {
    const existing = fs.readFileSync(archivePath, 'utf-8');
    fs.writeFileSync(archivePath, existing + '\n' + content, 'utf-8');
  } else {
    fs.writeFileSync(archivePath, content, 'utf-8');
  }

  // Create fresh current log
  const header = generateLogHeader(today, path.basename(projectRoot));
  fs.writeFileSync(currentLog, header, 'utf-8');

  // Update DEVELOP_LOG.md
  updateDevelopLog(projectRoot);

  return archivePath;
}

/**
 * Update the agent status table in the log
 */
export function updateAgentStatusTable(projectRoot, agentStatuses) {
  const currentLog = path.join(projectRoot, CURRENT_LOG_FILE);
  if (!fs.existsSync(currentLog)) return;

  let content = fs.readFileSync(currentLog, 'utf-8');

  // Build new table rows
  let tableRows = '';
  for (const a of agentStatuses) {
    const icon = STATUS_ICONS[a.status] || '⏳';
    tableRows += `| ${a.agent} | ${a.taskId} | ${icon} ${a.statusText} | \`${a.branch}\` | ${a.lastActivity} | ${a.blocks} |\n`;
  }

  // Replace the table content between header and next section
  const tableHeader =
    '| Agente | Tarea | Estado | Rama | Última Actividad | Bloqueos |\n|--------|-------|--------|------|------------------|----------|';
  const tableEnd = '\n---\n\n## 🚨';

  const tableStart = content.indexOf(tableHeader);
  const nextSection = content.indexOf(tableEnd, tableStart);

  if (tableStart !== -1 && nextSection !== -1) {
    const before = content.substring(0, tableStart + tableHeader.length + 1);
    const after = content.substring(nextSection);
    content = before + tableRows + after;
    fs.writeFileSync(currentLog, content, 'utf-8');
    updateDevelopLog(projectRoot);
  }
}

/**
 * Get log entries for a specific task
 */
export function getTaskLogEntries(projectRoot, taskId) {
  const content = readCurrentLog(projectRoot);
  const entries = [];
  const entryRegex = /### \[(\d{2}:\d{2}:\d{2})\] @(\w+) - (TASK-\d+) - (\w+)\n([\s\S]*?)(?=\n### |\n## |$)/g;
  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    if (match[3] === taskId) {
      entries.push({
        time: match[1],
        agent: match[2],
        taskId: match[3],
        type: match[4],
        message: match[5].trim(),
      });
    }
  }
  return entries;
}
