#!/usr/bin/env node

// gco - Git Collaborative Orchestrator
// Main CLI entry point

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { registerInitCommand } from '../src/commands/init.js';
import { registerTaskCommands } from '../src/commands/task.js';
import { registerAssignCommands } from '../src/commands/assign.js';
import { registerLogCommands } from '../src/commands/log.js';
import { registerSyncCommand } from '../src/commands/sync.js';
import { registerStatusCommands } from '../src/commands/status.js';
import { registerReviewCommands } from '../src/commands/review.js';
import { registerUtilityCommands } from '../src/commands/utility.js';
import { registerConfigCommand } from '../src/commands/config.js';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('gco')
  .description(
    chalk.bold('🤖 Git Collaborative Orchestrator') +
      '\n' +
      chalk.gray('   Orquesta múltiples agentes IA trabajando en paralelo sobre un proyecto Git')
  )
  .version(pkg.version);

// Register all commands
registerInitCommand(program);
registerTaskCommands(program);
registerAssignCommands(program);
registerLogCommands(program);
registerSyncCommand(program);
registerStatusCommands(program);
registerReviewCommands(program);
registerUtilityCommands(program);
registerConfigCommand(program);

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
