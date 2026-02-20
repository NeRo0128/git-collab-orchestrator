// Tasks.md parser and writer for gco
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { TASKS_FILE, STATUSES, STATUS_ICONS } from './constants.js';

/**
 * Parse tasks.md into structured data
 */
export function parseTasks(projectRoot) {
  const filePath = path.join(projectRoot, TASKS_FILE);
  if (!fs.existsSync(filePath)) {
    return { tasks: [], metadata: {} };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseTasksContent(content);
}

/**
 * Parse tasks.md content string
 */
export function parseTasksContent(content) {
  const tasks = [];
  const lines = content.split('\n');

  // Parse metadata from blockquote at top
  const metadata = {};
  for (const line of lines) {
    const syncMatch = line.match(/>\s*Última sincronización:\s*(.+)/);
    if (syncMatch) metadata.lastSync = syncMatch[1].trim();
    const totalMatch = line.match(
      />\s*Total tareas:\s*(\d+)\s*\|\s*Completadas:\s*(\d+)\s*\|\s*En progreso:\s*(\d+)\s*\|\s*Pendientes:\s*(\d+)/
    );
    if (totalMatch) {
      metadata.total = parseInt(totalMatch[1]);
      metadata.completed = parseInt(totalMatch[2]);
      metadata.inProgress = parseInt(totalMatch[3]);
      metadata.pending = parseInt(totalMatch[4]);
    }
  }

  // Parse individual tasks
  const taskRegex =
    /^## (TASK-\d+)\s+\[STATUS:(\w[\w-]*)\]\s+\[ASSIGNED:(@\w+)?\]/;
  let currentTask = null;
  let currentField = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const taskMatch = line.match(taskRegex);

    if (taskMatch) {
      if (currentTask) tasks.push(currentTask);
      currentTask = {
        id: taskMatch[1],
        status: taskMatch[2],
        assigned: taskMatch[3] || '',
        title: '',
        description: '',
        criteria: [],
        dependencies: '',
        notes: '',
        completed: '',
        blockedSince: '',
        blockReason: '',
        githubIssue: null,
        rawLines: [],
      };
      currentField = null;
      continue;
    }

    if (!currentTask) continue;

    currentTask.rawLines.push(line);

    const titleMatch = line.match(/^\*\*Título:\*\*\s*(.+)/);
    if (titleMatch) {
      currentTask.title = titleMatch[1].trim();
      currentField = null;
      continue;
    }

    const descMatch = line.match(/^\*\*Descripción:\*\*\s*(.+)/);
    if (descMatch) {
      currentTask.description = descMatch[1].trim();
      currentField = 'description';
      continue;
    }

    const criteriaMatch = line.match(/^\*\*Criterios de aceptación:\*\*/);
    if (criteriaMatch) {
      currentField = 'criteria';
      continue;
    }

    const depMatch = line.match(/^\*\*Dependencias:\*\*\s*(.+)/);
    if (depMatch) {
      currentTask.dependencies = depMatch[1].trim();
      currentField = null;
      continue;
    }

    const notesMatch = line.match(/^\*\*Notas técnicas:\*\*/);
    if (notesMatch) {
      const inlineContent = line.replace(/^\*\*Notas técnicas:\*\*\s*/, '').trim();
      if (inlineContent) {
        currentTask.notes = inlineContent;
      }
      currentField = 'notes';
      continue;
    }

    const completedMatch = line.match(/^\*\*Completada:\*\*\s*(.*)/);
    if (completedMatch) {
      currentTask.completed = completedMatch[1].trim();
      currentField = null;
      continue;
    }

    const blockedMatch = line.match(/^\*\*Bloqueada desde:\*\*\s*(.*)/);
    if (blockedMatch) {
      currentTask.blockedSince = blockedMatch[1].trim();
      currentField = null;
      continue;
    }

    const blockReasonMatch = line.match(/^\*\*Razón bloqueo:\*\*\s*(.*)/);
    if (blockReasonMatch) {
      currentTask.blockReason = blockReasonMatch[1].trim();
      currentField = null;
      continue;
    }

    const issueMatch = line.match(/^\*\*GitHub Issue:\*\*\s*#?(\d+)/);
    if (issueMatch) {
      currentTask.githubIssue = parseInt(issueMatch[1]);
      currentField = null;
      continue;
    }

    // Accumulate list items for criteria
    if (currentField === 'criteria') {
      const checkMatch = line.match(/^- \[([ x])\]\s*(.+)/);
      if (checkMatch) {
        currentTask.criteria.push({
          done: checkMatch[1] === 'x',
          text: checkMatch[2].trim(),
        });
      }
      continue;
    }

    // Accumulate multi-line notes
    if (currentField === 'notes' && line.startsWith('- ')) {
      currentTask.notes += (currentTask.notes ? '\n' : '') + line;
      continue;
    }
  }

  if (currentTask) tasks.push(currentTask);

  return { tasks, metadata };
}

/**
 * Get next available task ID
 */
export function getNextTaskId(tasks) {
  let maxNum = 0;
  for (const task of tasks) {
    const match = task.id.match(/TASK-(\d+)/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1]));
    }
  }
  return `TASK-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Generate tasks.md content from structured data
 */
export function generateTasksContent(tasks, metadata = {}) {
  const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
  const pending = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'blocked' || t.status === 'review'
  ).length;

  let content = `# Backlog de Tareas

> Última sincronización: ${metadata.lastSync || now}
> Total tareas: ${tasks.length} | Completadas: ${completed} | En progreso: ${inProgress} | Pendientes: ${pending}

---
`;

  for (const task of tasks) {
    content += `
## ${task.id} [STATUS:${task.status}] [ASSIGNED:${task.assigned}]
**Título:** ${task.title}
**Descripción:** ${task.description}
**Criterios de aceptación:**
`;
    for (const c of task.criteria) {
      content += `- [${c.done ? 'x' : ' '}] ${c.text}\n`;
    }

    content += `**Dependencias:** ${task.dependencies || 'Ninguna'}\n`;
    content += `**Notas técnicas:**\n${task.notes || '(vacío)'}\n`;

    if (task.githubIssue) {
      content += `**GitHub Issue:** #${task.githubIssue}\n`;
    }

    content += `**Completada:** ${task.completed || '(vacío)'}\n`;

    if (task.status === 'blocked') {
      content += `**Bloqueada desde:** ${task.blockedSince || ''}\n`;
      content += `**Razón bloqueo:** ${task.blockReason || ''}\n`;
    }

    content += '\n---\n';
  }

  content += `
## Leyenda de Estados

- \`[STATUS:pending]\` - Tarea creada, sin empezar, sin asignar o asignada pero no iniciada
- \`[STATUS:in-progress]\` - Agente trabajando activamente
- \`[STATUS:blocked]\` - Bloqueada por dependencias o esperando a otro agente
- \`[STATUS:completed]\` - Terminada, revisada y mergeada a develop
- \`[STATUS:review]\` - Terminada, esperando aprobación del humano

## Leyenda de Asignación

- \`[ASSIGNED:]\` - Sin asignar (cualquier agente puede tomarla)
- \`[ASSIGNED:@vscode]\` - Asignada a agente VS Code
- \`[ASSIGNED:@copilot]\` - Asignada a agente Copilot CLI
- \`[ASSIGNED:@claude]\` - Asignada a agente Claude CLI
- \`[ASSIGNED:@cursor]\` - Asignada a agente Cursor Agent
- \`[ASSIGNED:@windsurf]\` - Asignada a agente Windsurf Agent
- \`[ASSIGNED:@aider]\` - Asignada a agente Aider CLI
- \`[ASSIGNED:@codex]\` - Asignada a agente OpenAI Codex CLI
- \`[ASSIGNED:@nombre]\` - Otros agents (extensible)

## Reglas para Agents

> ⚠️ **NO edites este archivo manualmente.** Usa los comandos \`gco task\` para gestionar tareas.

1. **Crear tarea:** \`gco task create --title "Mi tarea"\`
2. **Tomar tarea:** El orquestador asigna con \`gco assign TASK-XXX agente\`
3. **Iniciar trabajo:** \`gco task status TASK-XXX in-progress\`
4. **Completar tarea:** \`gco task status TASK-XXX review\`
5. **Bloquear tarea:** \`gco task status TASK-XXX blocked\`
6. **Nunca borrar tareas:** Solo cambiar status
7. **Ver estado:** \`gco status\` o \`gco task list\`

## Ejemplo de Tarea

El formato de cada tarea en este archivo es:

- Encabezado: \`## TASK-NNN [STATUS:estado] [ASSIGNED:@agente]\`
- Campos: **Título**, **Descripción**, **Criterios de aceptación** (checkboxes), **Dependencias**, **Notas técnicas**, **Completada**
- Separador: \`---\` al final de cada tarea

Para crear tareas usa: \`gco task create --title "Mi tarea"\`
Para cambiar estado usa: \`gco task status TASK-NNN review\`
`;

  return content;
}

/**
 * Write tasks to tasks.md
 */
export function writeTasks(projectRoot, tasks, metadata = {}) {
  const filePath = path.join(projectRoot, TASKS_FILE);
  const content = generateTasksContent(tasks, metadata);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Update a single task in tasks.md
 */
export function updateTask(projectRoot, taskId, updates) {
  const { tasks, metadata } = parseTasks(projectRoot);
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) {
    throw new Error(`Tarea ${taskId} no encontrada`);
  }
  tasks[idx] = { ...tasks[idx], ...updates };
  writeTasks(projectRoot, tasks, metadata);
  return tasks[idx];
}

/**
 * Add a new task to tasks.md
 */
export function addTask(projectRoot, task) {
  const { tasks, metadata } = parseTasks(projectRoot);
  tasks.push(task);
  writeTasks(projectRoot, tasks, metadata);
  return task;
}

/**
 * Find a task by ID
 */
export function findTask(projectRoot, taskId) {
  const { tasks } = parseTasks(projectRoot);
  return tasks.find((t) => t.id === taskId) || null;
}
