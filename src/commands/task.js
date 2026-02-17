// gco task commands (create, list, show, status, edit)
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { format } from 'date-fns';
import { ensureProject, loadConfig } from '../config.js';
import {
  parseTasks,
  addTask,
  updateTask,
  findTask,
  getNextTaskId,
} from '../tasks.js';
import { addLogEntry } from '../log.js';
import { formatTask, printHeader, success, error, info } from '../format.js';
import { STATUSES } from '../constants.js';

export function registerTaskCommands(program) {
  const task = program.command('task').description('Gestión de tareas');

  // gco task create
  task
    .command('create')
    .description('Crear nueva tarea')
    .option('--id <id>', 'ID de la tarea (auto si no se especifica)')
    .option('--title <title>', 'Título de la tarea')
    .option('--description <desc>', 'Descripción')
    .option('--agent <agent>', 'Agente sugerido')
    .action(async (options) => {
      const projectRoot = ensureProject();
      const { tasks } = parseTasks(projectRoot);

      let taskData;

      if (options.title) {
        // Quick create mode
        const id = options.id || getNextTaskId(tasks);
        taskData = {
          id,
          title: options.title,
          description: options.description || '',
          status: 'pending',
          assigned: options.agent ? `@${options.agent}` : '',
          criteria: [],
          dependencies: '',
          notes: '',
          completed: '',
          blockedSince: '',
          blockReason: '',
          githubIssue: null,
          rawLines: [],
        };
      } else {
        // Interactive mode
        const nextId = getNextTaskId(tasks);
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'ID de tarea:',
            default: nextId,
          },
          {
            type: 'input',
            name: 'title',
            message: 'Título:',
            validate: (v) => (v.trim() ? true : 'El título es requerido'),
          },
          {
            type: 'input',
            name: 'description',
            message: 'Descripción:',
          },
          {
            type: 'input',
            name: 'criteria',
            message: 'Criterios de aceptación (separados por ;):',
          },
          {
            type: 'input',
            name: 'dependencies',
            message: 'Dependencias (IDs separados por coma):',
          },
          {
            type: 'input',
            name: 'notes',
            message: 'Notas técnicas:',
          },
          {
            type: 'input',
            name: 'agent',
            message: 'Agente sugerido (vacío para sin asignar):',
          },
        ]);

        taskData = {
          id: answers.id,
          title: answers.title,
          description: answers.description,
          status: 'pending',
          assigned: answers.agent ? `@${answers.agent}` : '',
          criteria: answers.criteria
            ? answers.criteria.split(';').map((c) => ({ done: false, text: c.trim() }))
            : [],
          dependencies: answers.dependencies || 'Ninguna',
          notes: answers.notes || '',
          completed: '',
          blockedSince: '',
          blockReason: '',
          githubIssue: null,
          rawLines: [],
        };
      }

      addTask(projectRoot, taskData);
      success(`Tarea ${taskData.id} creada: ${taskData.title}`);

      addLogEntry(projectRoot, {
        agent: 'sistema',
        taskId: taskData.id,
        type: 'system',
        message: `Tarea creada: ${taskData.title}`,
      });
    });

  // gco task list (also aliased as gco tasks list)
  task
    .command('list')
    .description('Listar tareas')
    .option('--status <status>', 'Filtrar por estado')
    .option('--assigned <agent>', 'Filtrar por agente asignado')
    .option('--all', 'Mostrar todas las tareas', false)
    .action((options) => {
      const projectRoot = ensureProject();
      const { tasks } = parseTasks(projectRoot);

      let filtered = tasks;

      if (options.status) {
        filtered = filtered.filter((t) => t.status === options.status);
      }
      if (options.assigned) {
        if (options.assigned === 'unassigned') {
          filtered = filtered.filter((t) => !t.assigned);
        } else {
          const agent = options.assigned.startsWith('@')
            ? options.assigned
            : `@${options.assigned}`;
          filtered = filtered.filter((t) => t.assigned === agent);
        }
      }
      if (!options.all && !options.status && !options.assigned) {
        // Default: show non-completed
        filtered = filtered.filter((t) => t.status !== 'completed');
      }

      printHeader(`Tareas (${filtered.length}/${tasks.length})`);

      if (filtered.length === 0) {
        info('No se encontraron tareas con los filtros especificados.');
        return;
      }

      for (const t of filtered) {
        console.log(formatTask(t, true));
      }
    });

  // gco task show
  task
    .command('show <taskId>')
    .description('Ver detalle de una tarea')
    .action((taskId) => {
      const projectRoot = ensureProject();
      const t = findTask(projectRoot, taskId);
      if (!t) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      printHeader(`${t.id} - ${t.title}`);
      console.log(formatTask(t, true));
      console.log();
      console.log(chalk.bold('Descripción:'), t.description);
      console.log();
      console.log(chalk.bold('Criterios de aceptación:'));
      for (const c of t.criteria) {
        console.log(`  ${c.done ? chalk.green('✓') : chalk.gray('○')} ${c.text}`);
      }
      console.log();
      console.log(chalk.bold('Dependencias:'), t.dependencies || 'Ninguna');
      console.log(chalk.bold('Notas técnicas:'), t.notes || '(vacío)');
      if (t.completed) console.log(chalk.bold('Completada:'), t.completed);
      if (t.blockReason) console.log(chalk.bold('Razón bloqueo:'), chalk.red(t.blockReason));
      if (t.githubIssue) console.log(chalk.bold('GitHub Issue:'), `#${t.githubIssue}`);
    });

  // gco task status
  task
    .command('status <taskId> <newStatus>')
    .description('Cambiar estado de tarea')
    .option('--reason <reason>', 'Razón del bloqueo (para status blocked)')
    .action((taskId, newStatus, options) => {
      const projectRoot = ensureProject();

      if (!STATUSES.includes(newStatus)) {
        error(`Estado inválido: ${newStatus}. Válidos: ${STATUSES.join(', ')}`);
        return;
      }

      const updates = { status: newStatus };
      const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

      if (newStatus === 'blocked') {
        updates.blockedSince = now;
        updates.blockReason = options.reason || '';
      }
      if (newStatus === 'completed' || newStatus === 'review') {
        updates.completed = now;
      }

      try {
        const task = updateTask(projectRoot, taskId, updates);
        success(`${taskId} → ${newStatus}`);

        addLogEntry(projectRoot, {
          agent: 'sistema',
          taskId,
          type: 'system',
          message: `Estado cambiado a ${newStatus}${options.reason ? `: ${options.reason}` : ''}`,
        });
      } catch (err) {
        error(err.message);
      }
    });

  // gco task edit
  task
    .command('edit <taskId>')
    .description('Editar tarea (abre tasks.md en editor)')
    .action(async (taskId) => {
      const projectRoot = ensureProject();
      const t = findTask(projectRoot, taskId);
      if (!t) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      const editor = process.env.EDITOR || 'vi';
      const { execSync } = await import('child_process');
      const tasksPath = path.join(projectRoot, 'tasks.md');
      execSync(`${editor} ${tasksPath}`, { stdio: 'inherit' });
    });

  // Alias: gco tasks (shortcut for gco task list)
  program
    .command('tasks')
    .description('Listar tareas (alias de task list)')
    .option('--status <status>', 'Filtrar por estado')
    .option('--assigned <agent>', 'Filtrar por agente')
    .option('--all', 'Mostrar todas', false)
    .action((options) => {
      const projectRoot = ensureProject();
      const { tasks } = parseTasks(projectRoot);

      let filtered = tasks;
      if (options.status) filtered = filtered.filter((t) => t.status === options.status);
      if (options.assigned) {
        if (options.assigned === 'unassigned') {
          filtered = filtered.filter((t) => !t.assigned);
        } else {
          const agent = options.assigned.startsWith('@')
            ? options.assigned
            : `@${options.assigned}`;
          filtered = filtered.filter((t) => t.assigned === agent);
        }
      }
      if (!options.all && !options.status && !options.assigned) {
        filtered = filtered.filter((t) => t.status !== 'completed');
      }

      printHeader(`Tareas (${filtered.length}/${tasks.length})`);
      if (filtered.length === 0) {
        info('No se encontraron tareas.');
        return;
      }
      for (const t of filtered) {
        console.log(formatTask(t, true));
      }
    });
}
