// gco init command
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { format } from 'date-fns';
import {
  GCO_DIR,
  GCO_LOGS_DIR,
  AGENTS_DIR,
  BRIEFINGS_DIR,
  TASKS_FILE,
  DEVELOP_LOG_FILE,
  DEFAULT_CONFIG,
} from '../constants.js';
import { saveConfig } from '../config.js';
import { ensureLogDir } from '../log.js';
import { generateTasksContent } from '../tasks.js';
import { printHeader, success, info } from '../format.js';

const VSCODE_TEMPLATE = `# Template para Agente VS Code (@vscode)

## Rol
Eres un agente de desarrollo trabajando en un equipo con otros agentes IA.

## Instrucciones
1. Lee tu briefing completo antes de empezar
2. Usa \`gco log\` para registrar tu progreso
3. Coordina con otros agentes a través de DEVELOP_LOG.md
4. Commit frecuente con prefijo [TASK-XXX]
5. Al terminar, marca como review con \`gco task status TASK-XXX review\`

## Convenciones
- Commits: \`[TASK-XXX] descripción\`
- Branches: \`agent/vscode/TASK-XXX\`
- Comunicación: vía DEVELOP_LOG.md
`;

const COPILOT_TEMPLATE = `# Template para Agente Copilot (@copilot)

## Rol
Eres un agente de desarrollo trabajando en un equipo con otros agentes IA.

## Instrucciones
1. Lee tu briefing completo antes de empezar
2. Usa \`gco log\` para registrar tu progreso
3. Coordina con otros agentes a través de DEVELOP_LOG.md
4. Commit frecuente con prefijo [TASK-XXX]
5. Al terminar, marca como review con \`gco task status TASK-XXX review\`

## Convenciones
- Commits: \`[TASK-XXX] descripción\`
- Branches: \`agent/copilot/TASK-XXX\`
- Comunicación: vía DEVELOP_LOG.md
`;

export function registerInitCommand(program) {
  program
    .command('init')
    .description('Inicializar proyecto gco en el directorio actual')
    .option('--template <type>', 'Template de proyecto (generic, react, node)', 'generic')
    .action(async (options) => {
      const projectRoot = process.cwd();

      printHeader('gco init - Inicializando proyecto');

      // Check if already initialized
      if (fs.existsSync(path.join(projectRoot, GCO_DIR))) {
        console.log(chalk.yellow('⚠️  Proyecto ya inicializado. Usa --force para reinicializar.'));
        return;
      }

      // Create .gco directory structure
      const dirs = [
        path.join(projectRoot, GCO_DIR),
        path.join(projectRoot, AGENTS_DIR),
        path.join(projectRoot, BRIEFINGS_DIR),
        path.join(projectRoot, GCO_LOGS_DIR),
      ];

      for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
        info(`Directorio creado: ${path.relative(projectRoot, dir)}/`);
      }

      // Save default config
      const config = { ...DEFAULT_CONFIG, templates: { type: options.template } };
      saveConfig(projectRoot, config);
      success('Configuración guardada: .gco/config.json');

      // Create agent templates
      fs.writeFileSync(path.join(projectRoot, AGENTS_DIR, 'vscode-template.md'), VSCODE_TEMPLATE);
      fs.writeFileSync(
        path.join(projectRoot, AGENTS_DIR, 'copilot-template.md'),
        COPILOT_TEMPLATE
      );
      success('Templates de agentes creados');

      // Create tasks.md if not exists
      if (!fs.existsSync(path.join(projectRoot, TASKS_FILE))) {
        const tasksContent = generateTasksContent([]);
        fs.writeFileSync(path.join(projectRoot, TASKS_FILE), tasksContent, 'utf-8');
        success('tasks.md creado');
      } else {
        info('tasks.md ya existe, no se modificó');
      }

      // Create log structure
      ensureLogDir(projectRoot);
      success('Estructura de logs creada en .gco-logs/');

      // Create DEVELOP_LOG.md (copy of current)
      const currentLogPath = path.join(projectRoot, GCO_LOGS_DIR, 'current.md');
      const devLogPath = path.join(projectRoot, DEVELOP_LOG_FILE);
      if (fs.existsSync(currentLogPath)) {
        fs.copyFileSync(currentLogPath, devLogPath);
      }
      success('DEVELOP_LOG.md creado');

      // Add .gco-logs/ to .gitignore if not already
      const gitignorePath = path.join(projectRoot, '.gitignore');
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }
      if (!gitignoreContent.includes('.gco-logs/')) {
        gitignoreContent += '\n# gco logs (no versionados)\n.gco-logs/\n';
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
        success('.gco-logs/ agregado a .gitignore');
      }

      console.log();
      console.log(chalk.green.bold('🎉 Proyecto gco inicializado correctamente!'));
      console.log();
      console.log(chalk.white('Próximos pasos:'));
      console.log(chalk.gray('  1. gco task create          # Crear primera tarea'));
      console.log(chalk.gray('  2. gco assign TASK-001 vscode  # Asignar a agente'));
      console.log(chalk.gray('  3. gco sync                 # Sincronizar con GitHub'));
      console.log();
    });
}
