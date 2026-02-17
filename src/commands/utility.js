// gco diff, prompt, stats, archive commands
import chalk from 'chalk';
import { format } from 'date-fns';
import { ensureProject, loadConfig } from '../config.js';
import { parseTasks, findTask } from '../tasks.js';
import { archiveLog, getTaskLogEntries, readCurrentLog } from '../log.js';
import { readBriefing, generateBriefing } from '../briefing.js';
import * as gitOps from '../git.js';
import { printHeader, success, error, info, warn, colorStatus } from '../format.js';
import { STATUS_ICONS } from '../constants.js';

export function registerUtilityCommands(program) {
  // gco diff TASK-XXX
  program
    .command('diff <taskId>')
    .description('Ver diff de una tarea vs develop')
    .action(async (taskId) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const task = findTask(projectRoot, taskId);

      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      if (!task.assigned) {
        error('Tarea no tiene agente asignado');
        return;
      }

      const agentName = task.assigned.replace('@', '');
      const branchName = `${config.branchPrefix}/${agentName}/${taskId}`;

      const exists = await gitOps.branchExists(projectRoot, branchName);
      if (!exists) {
        error(`Rama ${branchName} no encontrada`);
        return;
      }

      printHeader(`Diff: ${taskId} (${branchName} vs ${config.mainBranch})`);

      const diff = await gitOps.getBranchDiff(projectRoot, branchName, config.mainBranch);
      if (!diff) {
        info('Sin diferencias');
        return;
      }

      // Colorize diff output
      for (const line of diff.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          console.log(chalk.green(line));
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          console.log(chalk.red(line));
        } else if (line.startsWith('@@')) {
          console.log(chalk.cyan(line));
        } else if (line.startsWith('diff ')) {
          console.log(chalk.bold.white(line));
        } else {
          console.log(line);
        }
      }
    });

  // gco prompt TASK-XXX agentName
  program
    .command('prompt <taskId> <agent>')
    .description('Generar prompt/briefing para un agente')
    .action((taskId, agent) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const task = findTask(projectRoot, taskId);

      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      // Try to read existing briefing first
      let briefing = readBriefing(projectRoot, taskId, agent);
      if (!briefing) {
        briefing = generateBriefing(projectRoot, task, agent, config);
      }

      // Output raw (for piping)
      process.stdout.write(briefing);
    });

  // gco stats
  program
    .command('stats')
    .description('Mostrar estadísticas del proyecto')
    .action(() => {
      const projectRoot = ensureProject();
      const { tasks } = parseTasks(projectRoot);

      printHeader('Estadísticas');

      // By status
      console.log(chalk.bold('📊 Por Estado:'));
      const byStatus = {};
      for (const t of tasks) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      }
      for (const [status, count] of Object.entries(byStatus)) {
        const icon = STATUS_ICONS[status] || '❓';
        const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, 10 - count));
        console.log(`  ${icon} ${colorStatus(status).padEnd(20)} ${bar} ${count}`);
      }
      console.log();

      // By agent
      console.log(chalk.bold('🤖 Por Agente:'));
      const byAgent = {};
      for (const t of tasks) {
        const agent = t.assigned || 'sin asignar';
        if (!byAgent[agent]) byAgent[agent] = { total: 0, completed: 0 };
        byAgent[agent].total++;
        if (t.status === 'completed') byAgent[agent].completed++;
      }
      for (const [agent, data] of Object.entries(byAgent)) {
        const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        console.log(
          `  ${chalk.cyan(agent.padEnd(15))} ${data.completed}/${data.total} completadas (${pct}%)`
        );
      }
      console.log();

      // Overall progress
      const total = tasks.length;
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const barLen = 30;
      const filled = Math.round((pct / 100) * barLen);
      const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barLen - filled));
      console.log(chalk.bold('📈 Progreso General:'));
      console.log(`  ${bar} ${pct}% (${completed}/${total})`);
      console.log();

      // Blocked count
      const blocked = tasks.filter((t) => t.status === 'blocked').length;
      if (blocked > 0) {
        console.log(chalk.red(`⚠️  ${blocked} tarea(s) bloqueada(s)`));
      }
    });

  // gco archive
  program
    .command('archive')
    .description('Archivar log del día actual')
    .action(() => {
      const projectRoot = ensureProject();
      const archivePath = archiveLog(projectRoot);

      if (archivePath) {
        success(`Log archivado en: ${archivePath}`);
        info('Nuevo log vacío creado para el día');
      } else {
        info('No hay contenido para archivar');
      }
    });
}
