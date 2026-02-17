// Validator for project consistency
import { parseTasks } from './tasks.js';
import { readCurrentLog } from './log.js';
import * as gitOps from './git.js';

/**
 * Run all validation checks
 */
export async function validateAll(projectRoot, config) {
  const results = [];
  const { tasks } = parseTasks(projectRoot);

  results.push(...validateBlockedTasks(tasks));
  results.push(...validateDependencies(tasks));
  results.push(...validateAssignments(tasks));
  results.push(...(await validateBranches(projectRoot, tasks, config)));
  results.push(...validateStatuses(tasks));

  return results;
}

/**
 * Validate blocked tasks have reasons
 */
function validateBlockedTasks(tasks) {
  const issues = [];
  for (const task of tasks) {
    if (task.status === 'blocked' && !task.blockReason) {
      issues.push({
        level: 'warning',
        taskId: task.id,
        message: `Tarea bloqueada sin razón especificada`,
      });
    }
    if (task.status === 'blocked' && !task.blockedSince) {
      issues.push({
        level: 'info',
        taskId: task.id,
        message: `Tarea bloqueada sin fecha de bloqueo`,
      });
    }
  }
  return issues;
}

/**
 * Validate circular dependencies
 */
function validateDependencies(tasks) {
  const issues = [];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const task of tasks) {
    if (!task.dependencies || task.dependencies === 'Ninguna') continue;

    const deps = task.dependencies.match(/TASK-\d+/g) || [];
    for (const depId of deps) {
      if (!taskMap.has(depId)) {
        issues.push({
          level: 'error',
          taskId: task.id,
          message: `Dependencia ${depId} no existe`,
        });
      }
    }

    // Check circular
    const visited = new Set();
    const queue = [...deps];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === task.id) {
        issues.push({
          level: 'error',
          taskId: task.id,
          message: `Dependencia circular detectada`,
        });
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const depTask = taskMap.get(current);
      if (depTask?.dependencies && depTask.dependencies !== 'Ninguna') {
        const subDeps = depTask.dependencies.match(/TASK-\d+/g) || [];
        queue.push(...subDeps);
      }
    }
  }
  return issues;
}

/**
 * Validate assignment consistency
 */
function validateAssignments(tasks) {
  const issues = [];
  for (const task of tasks) {
    if (task.status === 'in-progress' && !task.assigned) {
      issues.push({
        level: 'warning',
        taskId: task.id,
        message: `Tarea en progreso sin agente asignado`,
      });
    }
    if (task.status === 'completed' && !task.completed) {
      issues.push({
        level: 'info',
        taskId: task.id,
        message: `Tarea completada sin fecha de completado`,
      });
    }
  }
  return issues;
}

/**
 * Validate git branches exist for in-progress tasks
 */
async function validateBranches(projectRoot, tasks, config) {
  const issues = [];
  for (const task of tasks) {
    if (task.status === 'in-progress' && task.assigned) {
      const agentName = task.assigned.replace('@', '');
      const branchName = `${config.branchPrefix}/${agentName}/${task.id}`;
      const exists = await gitOps.branchExists(projectRoot, branchName);
      if (!exists) {
        issues.push({
          level: 'warning',
          taskId: task.id,
          message: `Rama ${branchName} no encontrada para tarea en progreso`,
        });
      }
    }
  }
  return issues;
}

/**
 * Validate status transitions are valid
 */
function validateStatuses(tasks) {
  const issues = [];
  // Check for file collision: multiple in-progress tasks assigned to same agent
  const agentTasks = {};
  for (const task of tasks) {
    if (task.status === 'in-progress' && task.assigned) {
      if (!agentTasks[task.assigned]) agentTasks[task.assigned] = [];
      agentTasks[task.assigned].push(task.id);
    }
  }
  for (const [agent, taskIds] of Object.entries(agentTasks)) {
    if (taskIds.length > 1) {
      issues.push({
        level: 'warning',
        taskId: taskIds.join(', '),
        message: `${agent} tiene múltiples tareas en progreso: ${taskIds.join(', ')}`,
      });
    }
  }
  return issues;
}

/**
 * Check for file collisions between agents
 */
export async function checkFileCollisions(projectRoot, tasks, config) {
  const fileMap = {};
  for (const task of tasks) {
    if (task.status !== 'in-progress' || !task.assigned) continue;
    const agentName = task.assigned.replace('@', '');
    const branchName = `${config.branchPrefix}/${agentName}/${task.id}`;
    try {
      const files = await gitOps.getChangedFiles(projectRoot, branchName, config.mainBranch);
      for (const file of files) {
        if (!fileMap[file]) fileMap[file] = [];
        fileMap[file].push({ agent: task.assigned, taskId: task.id });
      }
    } catch {
      // Branch may not exist
    }
  }

  const collisions = [];
  for (const [file, agents] of Object.entries(fileMap)) {
    if (agents.length > 1) {
      collisions.push({
        file,
        agents: agents.map((a) => `${a.agent}(${a.taskId})`),
      });
    }
  }
  return collisions;
}
