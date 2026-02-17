// gco sync command - GitHub issues synchronization
import chalk from 'chalk';
import { format } from 'date-fns';
import { ensureProject, loadConfig, saveConfig } from '../config.js';
import { parseTasks, addTask, updateTask, getNextTaskId, writeTasks } from '../tasks.js';
import { addLogEntry } from '../log.js';
import { printHeader, success, error, info, warn } from '../format.js';

/**
 * Fetch GitHub issues using the GitHub REST API
 */
async function fetchGitHubIssues(owner, repo, token, issueNumber = null) {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const url = issueNumber ? `${baseUrl}/${issueNumber}` : `${baseUrl}?state=open&per_page=100`;

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'gco-cli',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Filter out pull requests (they also appear as issues)
  if (Array.isArray(data)) {
    return data.filter((issue) => !issue.pull_request);
  }
  return data.pull_request ? null : data;
}

/**
 * Convert a GitHub issue to a gco task
 */
function issueToTask(issue, taskId) {
  const criteria = [];

  // Try to extract checkboxes from issue body
  if (issue.body) {
    const checkboxes = issue.body.match(/- \[([ x])\]\s*(.+)/g);
    if (checkboxes) {
      for (const cb of checkboxes) {
        const match = cb.match(/- \[([ x])\]\s*(.+)/);
        if (match) {
          criteria.push({ done: match[1] === 'x', text: match[2].trim() });
        }
      }
    }
  }

  return {
    id: taskId,
    title: issue.title,
    description: issue.body ? issue.body.split('\n')[0].substring(0, 200) : '',
    status: 'pending',
    assigned: '',
    criteria,
    dependencies: 'Ninguna',
    notes: '',
    completed: '',
    blockedSince: '',
    blockReason: '',
    githubIssue: issue.number,
    rawLines: [],
  };
}

export function registerSyncCommand(program) {
  program
    .command('sync')
    .description('Sincronizar issues de GitHub con tasks.md')
    .option('--dry-run', 'Mostrar cambios sin aplicar')
    .option('--issue <number>', 'Sincronizar solo un issue específico')
    .action(async (options) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);

      if (!config.github.owner || !config.github.repo) {
        error('GitHub no configurado. Usa:');
        console.log(chalk.gray('  gco config set github.owner <owner>'));
        console.log(chalk.gray('  gco config set github.repo <repo>'));
        return;
      }

      printHeader('Sincronización con GitHub');

      try {
        const issueNum = options.issue ? parseInt(options.issue) : null;
        const issues = await fetchGitHubIssues(
          config.github.owner,
          config.github.repo,
          config.github.token,
          issueNum
        );

        if (!issues || (Array.isArray(issues) && issues.length === 0)) {
          info('No se encontraron issues abiertos');
          return;
        }

        const issueList = Array.isArray(issues) ? issues : [issues];
        const { tasks, metadata } = parseTasks(projectRoot);

        // Find existing task-issue mappings
        const existingIssues = new Set();
        for (const task of tasks) {
          if (task.githubIssue) existingIssues.add(task.githubIssue);
        }

        let newCount = 0;
        let updateCount = 0;
        const newTasks = [];

        for (const issue of issueList) {
          if (existingIssues.has(issue.number)) {
            // Update existing task if status changed
            const existingTask = tasks.find((t) => t.githubIssue === issue.number);
            if (existingTask && issue.state === 'closed' && existingTask.status !== 'completed') {
              if (!options.dryRun) {
                updateTask(projectRoot, existingTask.id, {
                  status: 'completed',
                  completed: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                });
              }
              info(`Actualizada: ${existingTask.id} (Issue #${issue.number} cerrado)`);
              updateCount++;
            }
          } else {
            // New issue
            const nextId = getNextTaskId([...tasks, ...newTasks]);
            const newTask = issueToTask(issue, nextId);
            newTasks.push(newTask);

            if (options.dryRun) {
              console.log(
                chalk.yellow(`[DRY-RUN] Nueva tarea: ${nextId} ← Issue #${issue.number}: ${issue.title}`)
              );
            } else {
              addTask(projectRoot, newTask);
              success(`Nueva tarea: ${nextId} ← Issue #${issue.number}: ${issue.title}`);
            }
            newCount++;
          }
        }

        // Update sync timestamp
        if (!options.dryRun && (newCount > 0 || updateCount > 0)) {
          const { tasks: updatedTasks, metadata: updatedMeta } = parseTasks(projectRoot);
          updatedMeta.lastSync = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
          writeTasks(projectRoot, updatedTasks, updatedMeta);

          addLogEntry(projectRoot, {
            agent: 'sistema',
            taskId: 'SYNC',
            type: 'system',
            message: `Sincronización con GitHub: ${newCount} nuevas, ${updateCount} actualizadas`,
          });
        }

        console.log();
        console.log(
          chalk.bold(`Resumen: ${newCount} nuevas, ${updateCount} actualizadas, ${issueList.length - newCount - updateCount} sin cambios`)
        );

        if (options.dryRun) {
          console.log(chalk.yellow('\n(dry-run - no se aplicaron cambios)'));
        }
      } catch (err) {
        error(`Error de sincronización: ${err.message}`);
        if (err.message.includes('401')) {
          info('Configura un token: gco config set github.token <token>');
        }
      }
    });
}
