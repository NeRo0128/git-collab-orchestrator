// gco assign and gco claim commands
import chalk from 'chalk';
import { format } from 'date-fns';
import { ensureProject, loadConfig } from '../config.js';
import { findTask, updateTask } from '../tasks.js';
import { addLogEntry } from '../log.js';
import { generateBriefing, saveBriefing } from '../briefing.js';
import * as gitOps from '../git.js';
import { printHeader, success, error, info, warn } from '../format.js';

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

      // 2. Generate briefing
      const updatedTask = findTask(projectRoot, taskId);
      const briefingContent = generateBriefing(projectRoot, updatedTask, agent, config);
      const briefingPath = saveBriefing(projectRoot, taskId, agent, briefingContent);
      success(`Briefing generado: ${briefingPath}`);

      // 3. Create git branch
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

      // 4. Log entry
      addLogEntry(projectRoot, {
        agent: 'sistema',
        taskId,
        type: 'system',
        message: `Tarea asignada a ${agentTag}. Rama: ${branchName}. Briefing generado.`,
      });

      console.log();
      console.log(chalk.bold('Próximos pasos:'));
      console.log(chalk.gray(`  1. git checkout ${branchName}`));
      console.log(
        chalk.gray(`  2. gco log --agent ${agent} --task ${taskId} --type start "Iniciando..."`)
      );
      console.log(chalk.gray(`  3. Lee el briefing: cat ${briefingPath}`));
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
