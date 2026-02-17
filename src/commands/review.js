// gco review, approve, reject commands
import chalk from 'chalk';
import inquirer from 'inquirer';
import { format } from 'date-fns';
import { ensureProject, loadConfig } from '../config.js';
import { findTask, updateTask, parseTasks } from '../tasks.js';
import { addLogEntry, getTaskLogEntries } from '../log.js';
import * as gitOps from '../git.js';
import { printHeader, formatTask, success, error, info, warn } from '../format.js';

export function registerReviewCommands(program) {
  // gco review [taskId]
  program
    .command('review [taskId]')
    .description('Revisar tarea completada o listar pendientes')
    .option('--list', 'Listar tareas pendientes de revisión')
    .action(async (taskId, options) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);

      if (options.list || !taskId) {
        // List tasks in review
        const { tasks } = parseTasks(projectRoot);
        const reviewTasks = tasks.filter((t) => t.status === 'review');

        printHeader('Tareas Pendientes de Revisión');

        if (reviewTasks.length === 0) {
          info('No hay tareas pendientes de revisión');
          return;
        }

        for (const t of reviewTasks) {
          console.log(formatTask(t, true));
        }
        return;
      }

      // Review specific task
      const task = findTask(projectRoot, taskId);
      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      printHeader(`Review: ${taskId} - ${task.title}`);

      // Show task details
      console.log(formatTask(task, true));
      console.log();

      // Show criteria checklist
      console.log(chalk.bold('✅ Criterios de Aceptación:'));
      for (const c of task.criteria) {
        const icon = c.done ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${c.text}`);
      }
      console.log();

      // Show diff if branch exists
      if (task.assigned) {
        const agentName = task.assigned.replace('@', '');
        const branchName = `${config.branchPrefix}/${agentName}/${taskId}`;
        const exists = await gitOps.branchExists(projectRoot, branchName);

        if (exists) {
          console.log(chalk.bold('📁 Archivos Modificados:'));
          const files = await gitOps.getChangedFiles(
            projectRoot,
            branchName,
            config.mainBranch
          );
          for (const f of files) {
            console.log(`  ${chalk.yellow(f)}`);
          }
          console.log();

          console.log(chalk.bold('📝 Commits:'));
          const commits = await gitOps.getBranchLog(
            projectRoot,
            branchName,
            config.mainBranch
          );
          for (const c of commits) {
            console.log(`  ${chalk.gray(c.hash.substring(0, 7))} ${c.message}`);
          }
          console.log();
        }
      }

      // Show log entries
      const logEntries = getTaskLogEntries(projectRoot, taskId);
      if (logEntries.length > 0) {
        console.log(chalk.bold('📋 Historial de Log:'));
        for (const e of logEntries) {
          console.log(
            `  ${chalk.dim(e.time)} ${chalk.cyan(`@${e.agent}`)} ${chalk.yellow(e.type)}: ${e.message}`
          );
        }
        console.log();
      }

      console.log(chalk.gray('Usa "gco approve ' + taskId + '" o "gco reject ' + taskId + '"'));
    });

  // gco approve TASK-XXX
  program
    .command('approve <taskId>')
    .description('Aprobar y mergear tarea a develop')
    .option('--delete-branch', 'Eliminar rama después del merge')
    .action(async (taskId, options) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const task = findTask(projectRoot, taskId);

      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      if (task.status !== 'review' && task.status !== 'in-progress') {
        warn(`Tarea no está en review (estado actual: ${task.status})`);
      }

      if (!task.assigned) {
        error('Tarea no tiene agente asignado');
        return;
      }

      const agentName = task.assigned.replace('@', '');
      const branchName = `${config.branchPrefix}/${agentName}/${taskId}`;
      const mergeMessage = `feat(${taskId}): ${task.title} [skip ci]`;

      printHeader(`Aprobando ${taskId}`);

      // Merge branch
      const branchExist = await gitOps.branchExists(projectRoot, branchName);
      if (branchExist) {
        try {
          await gitOps.mergeBranch(projectRoot, branchName, config.mainBranch, mergeMessage);
          success(`Rama ${branchName} mergeada a ${config.mainBranch}`);
        } catch (err) {
          error(`Error al mergear: ${err.message}`);
          return;
        }
      } else {
        warn(`Rama ${branchName} no encontrada. Actualizando solo tasks.md`);
      }

      // Update task
      const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      updateTask(projectRoot, taskId, {
        status: 'completed',
        completed: now,
      });
      success(`${taskId} marcada como completada`);

      // Log
      addLogEntry(projectRoot, {
        agent: 'sistema',
        taskId,
        type: 'complete',
        message: `✅ Tarea aprobada por humano y mergeada a ${config.mainBranch}`,
      });

      // Delete branch if requested
      if (options.deleteBranch && branchExist) {
        try {
          await gitOps.deleteBranch(projectRoot, branchName);
          success(`Rama ${branchName} eliminada`);
        } catch (err) {
          warn(`No se pudo eliminar la rama: ${err.message}`);
        }
      } else if (branchExist) {
        info(`Rama ${branchName} conservada. Usa --delete-branch para eliminarla.`);
      }
    });

  // gco reject TASK-XXX
  program
    .command('reject <taskId>')
    .description('Rechazar tarea (mantiene rama para correcciones)')
    .option('--reason <reason>', 'Razón del rechazo')
    .action(async (taskId, options) => {
      const projectRoot = ensureProject();
      const task = findTask(projectRoot, taskId);

      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      let reason = options.reason;
      if (!reason) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'reason',
            message: 'Razón del rechazo:',
            validate: (v) => (v.trim() ? true : 'La razón es requerida'),
          },
        ]);
        reason = answers.reason;
      }

      // Update task back to in-progress
      updateTask(projectRoot, taskId, {
        status: 'in-progress',
        completed: '',
      });

      // Log
      addLogEntry(projectRoot, {
        agent: 'sistema',
        taskId,
        type: 'system',
        message: `❌ Tarea rechazada: ${reason}`,
      });

      success(`${taskId} rechazada y devuelta a in-progress`);
      info(`Razón: ${reason}`);
    });
}
