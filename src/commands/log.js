// gco log and gco read commands
import chalk from 'chalk';
import { ensureProject } from '../config.js';
import { addLogEntry, readCurrentLog } from '../log.js';
import * as gitOps from '../git.js';
import { printHeader, success, error, info } from '../format.js';
import { LOG_TYPES } from '../constants.js';

export function registerLogCommands(program) {
  // gco log
  program
    .command('log [message]')
    .description('Agregar entrada al log de desarrollo')
    .option('--agent <agent>', 'Nombre del agente')
    .option('--task <taskId>', 'ID de la tarea')
    .option('--type <type>', 'Tipo de entrada', 'progress')
    .action(async (message, options) => {
      const projectRoot = ensureProject();

      let agent = options.agent;
      let taskId = options.task;
      const type = options.type;

      // Validate type
      if (!LOG_TYPES.includes(type)) {
        error(`Tipo inválido: ${type}. Válidos: ${LOG_TYPES.join(', ')}`);
        return;
      }

      // Auto-detect from git branch if not provided
      if (!agent || !taskId) {
        const branchInfo = await gitOps.detectAgentFromBranch(projectRoot);
        if (branchInfo) {
          agent = agent || branchInfo.agent;
          taskId = taskId || branchInfo.taskId;
        }
      }

      if (!agent) {
        error('No se pudo detectar el agente. Usa --agent <nombre>');
        return;
      }
      if (!taskId) {
        error('No se pudo detectar la tarea. Usa --task <id>');
        return;
      }

      if (!message) {
        error('Mensaje requerido');
        return;
      }

      addLogEntry(projectRoot, { agent, taskId, type, message });
      success(`[${type}] @${agent} / ${taskId}: ${message}`);
    });

  // gco read
  program
    .command('read')
    .description('Leer el log actual (formateado)')
    .action(() => {
      const projectRoot = ensureProject();
      const content = readCurrentLog(projectRoot);

      if (!content.trim()) {
        info('El log está vacío');
        return;
      }

      printHeader('DEVELOP_LOG');

      // Basic colorization
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          console.log(chalk.bold.cyan(line));
        } else if (line.startsWith('## ')) {
          console.log(chalk.bold.yellow(line));
        } else if (line.startsWith('### ')) {
          // Log entries
          const match = line.match(/### \[(.+?)\] @(\w+) - (TASK-\d+) - (\w+)/);
          if (match) {
            const [, time, agent, task, type] = match;
            console.log(
              `${chalk.dim(time)} ${chalk.cyan(`@${agent}`)} ${chalk.white(task)} ${chalk.yellow(type)}`
            );
          } else {
            console.log(chalk.bold(line));
          }
        } else if (line.startsWith('> ')) {
          console.log(chalk.gray(line));
        } else if (line.startsWith('| ')) {
          console.log(chalk.white(line));
        } else if (line.startsWith('- [x]')) {
          console.log(chalk.green(line));
        } else if (line.startsWith('- [ ]')) {
          console.log(chalk.gray(line));
        } else if (line.includes('✅')) {
          console.log(chalk.green(line));
        } else if (line.includes('🔴') || line.includes('❌')) {
          console.log(chalk.red(line));
        } else if (line.includes('🟡')) {
          console.log(chalk.yellow(line));
        } else {
          console.log(line);
        }
      }
    });
}
