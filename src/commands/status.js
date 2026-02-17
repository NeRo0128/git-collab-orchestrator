// gco status and gco validate commands
import chalk from 'chalk';
import { ensureProject, loadConfig } from '../config.js';
import { parseTasks } from '../tasks.js';
import { updateAgentStatusTable } from '../log.js';
import { validateAll, checkFileCollisions } from '../validator.js';
import * as gitOps from '../git.js';
import {
  printHeader,
  formatTask,
  formatValidationResults,
  success,
  error,
  info,
  warn,
  colorStatus,
} from '../format.js';
import { STATUS_ICONS } from '../constants.js';

export function registerStatusCommands(program) {
  // gco status
  program
    .command('status')
    .description('Ver estado completo del proyecto')
    .action(async () => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const { tasks } = parseTasks(projectRoot);

      printHeader('Estado del Proyecto');

      // Summary
      const byStatus = {};
      for (const t of tasks) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      }

      console.log(chalk.bold('📊 Resumen:'));
      for (const [status, count] of Object.entries(byStatus)) {
        const icon = STATUS_ICONS[status] || '❓';
        console.log(`  ${icon} ${colorStatus(status)}: ${count}`);
      }
      console.log();

      // Active agents
      const activeTasks = tasks.filter(
        (t) => t.status === 'in-progress' && t.assigned
      );
      if (activeTasks.length > 0) {
        console.log(chalk.bold('🤖 Agentes Activos:'));
        const agentStatuses = [];
        for (const t of activeTasks) {
          const agentName = t.assigned.replace('@', '');
          const branchName = `${config.branchPrefix}/${agentName}/${t.id}`;
          const exists = await gitOps.branchExists(projectRoot, branchName);
          agentStatuses.push({
            agent: t.assigned,
            taskId: t.id,
            status: t.status,
            statusText: 'En progreso',
            branch: exists ? branchName : '(sin rama)',
            lastActivity: '-',
            blocks: 'Ninguno',
          });
          console.log(
            `  ${chalk.cyan(t.assigned)} → ${chalk.white(t.id)} ${chalk.gray(t.title)}`
          );
          console.log(`    Rama: ${exists ? chalk.green(branchName) : chalk.red('(sin rama)')}`);
        }
        // Update log table
        updateAgentStatusTable(projectRoot, agentStatuses);
        console.log();
      }

      // Blocked tasks
      const blockedTasks = tasks.filter((t) => t.status === 'blocked');
      if (blockedTasks.length > 0) {
        console.log(chalk.bold('🔴 Tareas Bloqueadas:'));
        for (const t of blockedTasks) {
          console.log(`  ${chalk.red(t.id)} ${t.title}`);
          if (t.blockReason) console.log(`    Razón: ${chalk.yellow(t.blockReason)}`);
          if (t.assigned) console.log(`    Asignada a: ${chalk.cyan(t.assigned)}`);
        }
        console.log();
      }

      // Pending/unassigned
      const unassigned = tasks.filter(
        (t) => t.status === 'pending' && !t.assigned
      );
      if (unassigned.length > 0) {
        console.log(chalk.bold('⏳ Pendientes sin asignar:'));
        for (const t of unassigned) {
          console.log(`  ${chalk.gray(t.id)} ${t.title}`);
        }
        console.log();
      }

      // Review tasks
      const reviewTasks = tasks.filter((t) => t.status === 'review');
      if (reviewTasks.length > 0) {
        console.log(chalk.bold('👀 Pendientes de Revisión:'));
        for (const t of reviewTasks) {
          console.log(`  ${chalk.magenta(t.id)} ${t.title} (${chalk.cyan(t.assigned || 'sin agente')})`);
        }
        console.log();
      }

      // Quick validation
      const issues = await validateAll(projectRoot, config);
      if (issues.length > 0) {
        console.log(chalk.bold('🚨 Alertas:'));
        console.log(formatValidationResults(issues));
      }
    });

  // gco validate
  program
    .command('validate')
    .description('Validar consistencia del proyecto')
    .action(async () => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);

      printHeader('Validación de Consistencia');

      const issues = await validateAll(projectRoot, config);
      console.log(formatValidationResults(issues));

      // Check file collisions
      const { tasks } = parseTasks(projectRoot);
      const collisions = await checkFileCollisions(projectRoot, tasks, config);
      if (collisions.length > 0) {
        console.log(chalk.bold.red('⚠️  Colisiones de archivos detectadas:'));
        for (const c of collisions) {
          console.log(`  ${chalk.red(c.file)}: ${c.agents.join(', ')}`);
        }
      } else {
        success('Sin colisiones de archivos entre agentes');
      }
    });
}
