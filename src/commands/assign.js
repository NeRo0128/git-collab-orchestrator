// gco assign and gco claim commands
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { format } from 'date-fns';
import { ensureProject, loadConfig } from '../config.js';
import { findTask, updateTask } from '../tasks.js';
import { addLogEntry } from '../log.js';
import { generateBriefing, saveBriefing } from '../briefing.js';
import * as gitOps from '../git.js';
import { printHeader, success, error, info, warn } from '../format.js';
import { GCO_LOGS_DIR, AGENT_INSTRUCTIONS_FILE } from '../constants.js';

/**
 * Create per-agent log directory and initial log file for a task
 */
function ensureAgentTaskLog(projectRoot, agent, taskId) {
  const agentLogDir = path.join(projectRoot, GCO_LOGS_DIR, agent);
  if (!fs.existsSync(agentLogDir)) {
    fs.mkdirSync(agentLogDir, { recursive: true });
  }

  const logFile = path.join(agentLogDir, `${taskId}.log`);
  if (!fs.existsSync(logFile)) {
    const header = `# Log: ${taskId} — Agente: @${agent}\n# Creado: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n${'='.repeat(50)}\n\n`;
    fs.writeFileSync(logFile, header, 'utf-8');
  }
  return logFile;
}

export function registerAssignCommands(program) {
  // gco assign TASK-XXX agentName
  program
    .command('assign <taskId> <agent>')
    .description('Asignar tarea a un agente (genera briefing y rama)')
    .action(async (taskId, agent) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const task = findTask(projectRoot, taskId);

      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      if (task.assigned && task.assigned !== '') {
        warn(`Tarea ya asignada a ${task.assigned}. Reasignando a @${agent}...`);
      }

      if (task.status === 'completed') {
        error('No se puede asignar una tarea completada');
        return;
      }

      const agentTag = `@${agent}`;
      const branchName = `${config.branchPrefix}/${agent}/${taskId}`;

      printHeader(`Asignando ${taskId} a ${agentTag}`);

      // 1. Update tasks.md
      updateTask(projectRoot, taskId, {
        assigned: agentTag,
        status: 'pending',
      });
      success(`tasks.md actualizado: ${taskId} → ${agentTag}`);

      // 2. Generate briefing (with project context)
      const updatedTask = findTask(projectRoot, taskId);
      const briefingContent = generateBriefing(projectRoot, updatedTask, agent, config);
      const briefingPath = saveBriefing(projectRoot, taskId, agent, briefingContent);
      success(`Briefing generado: ${briefingPath}`);

      // 3. Create per-agent task log
      const logFile = ensureAgentTaskLog(projectRoot, agent, taskId);
      success(`Log de agente creado: ${logFile}`);

      // 4. Create git branch
      try {
        await gitOps.createBranch(projectRoot, branchName, config.mainBranch);
        success(`Rama creada: ${branchName}`);
        // Go back to original branch
        const git = gitOps.createGit(projectRoot);
        await git.checkout(config.mainBranch).catch(() => {
          // If develop doesn't exist, stay on current
        });
      } catch (err) {
        warn(`No se pudo crear la rama: ${err.message}`);
        info('Puedes crearla manualmente: git checkout -b ' + branchName);
      }

      // 5. Log entry
      addLogEntry(projectRoot, {
        agent: 'sistema',
        taskId,
        type: 'system',
        message: `Tarea asignada a ${agentTag}. Rama: ${branchName}. Briefing generado.`,
      });

      // 6. Summary with all agent needs
      console.log();
      console.log(chalk.green.bold('✅ Tarea asignada correctamente'));
      console.log();
      console.log(chalk.bold('📋 El agente debe hacer lo siguiente:'));
      console.log(chalk.cyan('  1.') + chalk.gray(` git checkout ${branchName}`));
      console.log(chalk.cyan('  2.') + chalk.gray(` cat ${briefingPath}`));

      // Check if AGENT_INSTRUCTIONS exists
      const instrPath = path.join(projectRoot, AGENT_INSTRUCTIONS_FILE);
      if (fs.existsSync(instrPath)) {
        console.log(chalk.cyan('  3.') + chalk.gray(` cat ${AGENT_INSTRUCTIONS_FILE}`));
        console.log(
          chalk.cyan('  4.') +
            chalk.gray(` gco log --agent ${agent} --task ${taskId} --type start "Iniciando..."`)
        );
      } else {
        console.log(
          chalk.cyan('  3.') +
            chalk.gray(` gco log --agent ${agent} --task ${taskId} --type start "Iniciando..."`)
        );
      }
      console.log();
    });

  // gco claim TASK-XXX
  program
    .command('claim <taskId>')
    .description('Auto-asignar tarea basado en contexto git')
    .action(async (taskId) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const task = findTask(projectRoot, taskId);

      if (!task) {
        error(`Tarea ${taskId} no encontrada`);
        return;
      }

      if (task.assigned && task.assigned !== '') {
        error(`Tarea ya asignada a ${task.assigned}`);
        return;
      }

      // Try to detect agent from branch name
      const branchInfo = await gitOps.detectAgentFromBranch(projectRoot);
      let agentName;

      if (branchInfo) {
        agentName = branchInfo.agent;
      } else {
        // Default to vscode
        agentName = 'vscode';
        info(`No se detectó agente desde la rama. Usando: @${agentName}`);
      }

      const agentTag = `@${agentName}`;
      const branchName = `${config.branchPrefix}/${agentName}/${taskId}`;

      // Update task
      updateTask(projectRoot, taskId, {
        assigned: agentTag,
        status: 'in-progress',
      });

      // Generate briefing
      const updatedTask = findTask(projectRoot, taskId);
      const briefingContent = generateBriefing(projectRoot, updatedTask, agentName, config);
      saveBriefing(projectRoot, taskId, agentName, briefingContent);

      // Create branch
      try {
        await gitOps.createBranch(projectRoot, branchName, config.mainBranch);
      } catch {
        warn('No se pudo crear la rama automáticamente');
      }

      // Log
      addLogEntry(projectRoot, {
        agent: agentName,
        taskId,
        type: 'start',
        message: `Tarea reclamada por ${agentTag}`,
      });

      success(`${taskId} reclamada por ${agentTag}. Rama: ${branchName}`);
    });
}
