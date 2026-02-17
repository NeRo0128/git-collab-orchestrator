// Shared formatting utilities
import chalk from 'chalk';
import { STATUS_ICONS } from './constants.js';

/**
 * Format a task for display
 */
export function formatTask(task, verbose = false) {
  const icon = STATUS_ICONS[task.status] || '❓';
  const assigned = task.assigned ? chalk.cyan(task.assigned) : chalk.gray('sin asignar');
  const status = colorStatus(task.status);

  let output = `${chalk.bold(task.id)} ${icon} ${status} ${chalk.dim('|')} ${assigned}\n`;
  output += `  ${chalk.white(task.title)}\n`;

  if (verbose) {
    output += `  ${chalk.gray(task.description)}\n`;
    if (task.dependencies && task.dependencies !== 'Ninguna') {
      output += `  ${chalk.yellow('Deps:')} ${task.dependencies}\n`;
    }
    const done = task.criteria.filter((c) => c.done).length;
    const total = task.criteria.length;
    if (total > 0) {
      output += `  ${chalk.green(`Criterios: ${done}/${total}`)}\n`;
    }
    if (task.blockReason) {
      output += `  ${chalk.red('Bloqueada:')} ${task.blockReason}\n`;
    }
  }

  return output;
}

/**
 * Colorize status
 */
export function colorStatus(status) {
  switch (status) {
    case 'pending':
      return chalk.gray(status);
    case 'in-progress':
      return chalk.yellow(status);
    case 'blocked':
      return chalk.red(status);
    case 'completed':
      return chalk.green(status);
    case 'review':
      return chalk.magenta(status);
    default:
      return status;
  }
}

/**
 * Format validation results
 */
export function formatValidationResults(results) {
  if (results.length === 0) {
    return chalk.green('✅ No se encontraron problemas de consistencia.\n');
  }

  let output = '';
  for (const r of results) {
    const icon = r.level === 'error' ? '❌' : r.level === 'warning' ? '⚠️' : 'ℹ️';
    const color =
      r.level === 'error' ? chalk.red : r.level === 'warning' ? chalk.yellow : chalk.blue;
    output += `${icon} ${color(`[${r.taskId}]`)} ${r.message}\n`;
  }
  return output;
}

/**
 * Print a header with box
 */
export function printHeader(title) {
  const line = '─'.repeat(title.length + 4);
  console.log(chalk.cyan(`┌${line}┐`));
  console.log(chalk.cyan(`│  ${chalk.bold(title)}  │`));
  console.log(chalk.cyan(`└${line}┘`));
  console.log();
}

/**
 * Print success message
 */
export function success(msg) {
  console.log(chalk.green(`✅ ${msg}`));
}

/**
 * Print error message
 */
export function error(msg) {
  console.error(chalk.red(`❌ ${msg}`));
}

/**
 * Print warning message
 */
export function warn(msg) {
  console.log(chalk.yellow(`⚠️  ${msg}`));
}

/**
 * Print info message
 */
export function info(msg) {
  console.log(chalk.blue(`ℹ️  ${msg}`));
}
