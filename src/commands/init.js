// gco init command
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { format } from 'date-fns';
import {
  GCO_DIR,
  GCO_LOGS_DIR,
  AGENTS_DIR,
  BRIEFINGS_DIR,
  TASKS_FILE,
  DEVELOP_LOG_FILE,
  AGENT_INSTRUCTIONS_FILE,
  PROJECT_CONTEXT_FILE,
  GIT_HOOKS_DIR,
  PRE_COMMIT_HOOK_FILE,
  COMMIT_MSG_HOOK_FILE,
  BASE_AGENT_CATALOG,
  DEFAULT_CONFIG,
} from '../constants.js';
import { saveConfig } from '../config.js';
import { ensureLogDir } from '../log.js';
import { generateTasksContent } from '../tasks.js';
import { printHeader, success, info, warn } from '../format.js';

// ─── Agent Templates ───────────────────────────────────────────

function titleFromAgentId(agentId) {
  if (agentId === 'vscode') return 'VS Code Copilot Chat';
  if (agentId === 'copilot') return 'GitHub Copilot CLI';
  if (agentId === 'claude') return 'Claude CLI';
  if (agentId === 'cursor') return 'Cursor Agent';
  if (agentId === 'windsurf') return 'Windsurf Agent';
  if (agentId === 'aider') return 'Aider CLI';
  if (agentId === 'codex') return 'OpenAI Codex CLI';
  return agentId;
}

function generateAgentTemplate(agentId, agentConfig) {
  return `# Template para Agente ${titleFromAgentId(agentId)} (${agentConfig.name})

## Rol
Eres un agente de desarrollo trabajando en un equipo con otros agentes IA.

## Perfil
- **ID:** ${agentId}
- **Tag:** ${agentConfig.name}
- **Tipo:** ${agentConfig.type}

## Instrucciones
1. Lee tu briefing completo antes de empezar
2. Usa \`gco log\` para registrar tu progreso
3. Coordina con otros agentes a través de DEVELOP_LOG.md
4. Commit frecuente con prefijo [TASK-XXX]
5. Al terminar, marca como review con \`gco task status TASK-XXX review\`

## Convenciones
- Commits: \`[TASK-XXX] descripción\`
- Branches: \`agent/${agentId}/TASK-XXX\`
- Comunicación: vía DEVELOP_LOG.md
`;
}

// ─── Git Branch Helpers ────────────────────────────────────────

function isGitRepo(projectRoot) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: projectRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function initGitRepo(projectRoot) {
  execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
}

function hasCommits(projectRoot) {
  try {
    execSync('git rev-parse HEAD', { cwd: projectRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function branchExistsLocal(projectRoot, branchName) {
  try {
    execSync(`git rev-parse --verify ${branchName}`, { cwd: projectRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranchName(projectRoot) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function ensureBranch(projectRoot, branchName, baseBranch = null) {
  if (branchExistsLocal(projectRoot, branchName)) {
    info(`Rama '${branchName}' ya existe`);
    return;
  }

  if (baseBranch && branchExistsLocal(projectRoot, baseBranch)) {
    execSync(`git branch ${branchName} ${baseBranch}`, { cwd: projectRoot, stdio: 'ignore' });
  } else {
    // Si es main y no existe, renombrar la rama actual
    const current = getCurrentBranchName(projectRoot);
    if (branchName === 'main' && current && current !== 'main') {
      execSync(`git branch -M ${branchName}`, { cwd: projectRoot, stdio: 'ignore' });
    } else if (current) {
      execSync(`git branch ${branchName}`, { cwd: projectRoot, stdio: 'ignore' });
    }
  }
  success(`Rama '${branchName}' configurada`);
}

function createStrictHooks(projectRoot) {
  const hooksDir = path.join(projectRoot, GIT_HOOKS_DIR);
  fs.mkdirSync(hooksDir, { recursive: true });

  const preCommitHook = `#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f ".gco/config.json" ]]; then
  exit 0
fi

STRICT_MODE=$(node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync(".gco/config.json","utf8"));process.stdout.write(String(Boolean(c.strictMode)));')
MODE=$(node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync(".gco/config.json","utf8"));process.stdout.write(c.mode||"execution");')

if [[ "$STRICT_MODE" != "true" ]]; then
  exit 0
fi

if [[ "$MODE" == "planning" ]]; then
  STAGED=$(git diff --cached --name-only)
  if [[ -n "$STAGED" ]]; then
    DISALLOWED=$(echo "$STAGED" | grep -Ev '^(\.gco/|\.gco-logs/|\.githooks/|\.gitignore$|tasks\.md$|DEVELOP_LOG\.md$|README\.md$|docs/)' || true)
    if [[ -n "$DISALLOWED" ]]; then
      echo "❌ Modo estricto/planning: solo se permiten cambios de planificación (.gco, docs, logs, tasks.md)."
      echo "$DISALLOWED"
      exit 1
    fi
  fi
fi
`;

  const commitMsgHook = `#!/usr/bin/env bash
set -euo pipefail

MSG_FILE="$1"
MSG=$(cat "$MSG_FILE")

if echo "$MSG" | grep -Eq '^\[TASK-[0-9]+\]'; then
  exit 0
fi

if echo "$MSG" | grep -Eq '^chore: (initial|initialize|bootstrap|setup)'; then
  exit 0
fi

if echo "$MSG" | grep -Eq '^Merge '; then
  exit 0
fi

echo "❌ Commit inválido: debe iniciar con [TASK-XXX] en modo estricto."
echo "Ejemplo: [TASK-001] feat: implementar autenticación"
exit 1
`;

  fs.writeFileSync(path.join(projectRoot, PRE_COMMIT_HOOK_FILE), preCommitHook, {
    encoding: 'utf-8',
    mode: 0o755,
  });

  fs.writeFileSync(path.join(projectRoot, COMMIT_MSG_HOOK_FILE), commitMsgHook, {
    encoding: 'utf-8',
    mode: 0o755,
  });
}

function activateHooksPath(projectRoot) {
  execSync(`git config core.hooksPath ${GIT_HOOKS_DIR}`, { cwd: projectRoot, stdio: 'ignore' });
}

function disableHooksPath(projectRoot) {
  try {
    execSync('git config --unset core.hooksPath', { cwd: projectRoot, stdio: 'ignore' });
  } catch {
    // ignore if not configured
  }
}

// ─── File Generators ───────────────────────────────────────────

function generateAgentInstructions() {
  return `# 🤖 Instrucciones para Agentes IA

> Este archivo contiene las reglas que TODO agente debe seguir al trabajar en este proyecto.
> Generado por **git-collab-orchestrator (gco)**.

## 🧠 Política: Agente Principal de Planificación

### Rol

Eres el **Agente Principal de Planificación** de este proyecto, operando con gco.

### Objetivo

- Convertir el contexto del proyecto en un backlog completo y mantenido en tiempo real.
- Asegurar que toda nueva necesidad acordada con el usuario quede registrada como tarea usando CLI.

### Reglas obligatorias

1. Leer primero:
  - \`.gco/PROJECT_CONTEXT.md\`
  - \`.gco/AGENT_INSTRUCTIONS.md\`
2. Si ya tienes información suficiente del proyecto por la conversación, debes completar/actualizar \`.gco/PROJECT_CONTEXT.md\` antes de continuar.
3. Durante toda la conversación, mantener \`.gco/PROJECT_CONTEXT.md\` actualizado con nueva información del usuario (arquitectura, alcance, restricciones, stack, decisiones).
4. Asegurar que \`.gitignore\` incluya artefactos runtime de gco (mínimo: \`.gco-logs/\` y temporales de gco si existieran).
5. Antes de escribir cualquier código, preguntar explícitamente al usuario:

   **"¿Quieres que:**
   **A) primero cree/actualice las tareas del backlog con gco task create, o**
   **B) vayamos directo a implementar código?"**

6. Si el usuario elige **A** (recomendado):
  - crear tareas con \`gco task create\`
  - confirmar IDs \`TASK-XXX\` creados
  - ejecutar \`gco task list\` y resumir backlog
  - **no implementar código aún**
7. Si el usuario elige **B**:
  - confirmar que acepta omitir planificación inicial
  - crear al menos 1 tarea mínima de trazabilidad antes de codificar
  - luego recién implementar
8. No editar \`tasks.md\` manualmente.
9. No asignar tareas ni implementar código durante planificación inicial.
10. Si durante la conversación se acuerda una nueva tarea/cambio/alcance:
  - crearla en ese momento con \`gco task create\`
  - confirmar al usuario el ID generado (\`TASK-XXX\`)
11. Mantener tareas pequeñas, claras y verificables; agregar dependencias cuando aplique.
12. Al cerrar cada ronda de planificación:
  - ejecutar \`gco task list\`
  - reportar resumen por estado y próximos pasos.

### Comportamiento esperado

**Planificar → Crear tareas → Confirmar IDs → Actualizar backlog continuamente**.

Nunca dejar acuerdos solo en texto: todo acuerdo operativo debe existir como tarea en gco.

### Formato de respuesta al usuario

- Qué tarea(s) se crearon
- IDs generados
- Breve motivo de cada una
- Estado actual del backlog

## 📌 Reglas Generales

1. **Nunca trabajes directamente en \`main\` o \`develop\`.**
2. Siempre trabaja en tu rama asignada: \`agent/<tu-nombre>/<TASK-ID>\`.
3. Antes de empezar, lee tu briefing en \`.gco/briefings/<TASK-ID>-<agente>.md\`.
4. Registra tu progreso con \`gco log\`.
5. Haz commits pequeños y frecuentes con el formato: \`[TASK-XXX] descripción\`.
6. Cuando termines, marca la tarea como review: \`gco task status <TASK-ID> review\`.

## 🔀 Flujo de Ramas

\`\`\`
main (producción, protegida)
 └── develop (integración)
      └── agent/<nombre>/<TASK-ID> (tu rama de trabajo)
\`\`\`

**IMPORTANTE:** Las ramas \`agent/<nombre>/<TASK-ID>\` se crean **automáticamente** cuando el orquestador ejecuta \`gco assign\`. Tú solo necesitas hacer checkout:

\`\`\`bash
git checkout agent/<tu-nombre>/<TASK-ID>
\`\`\`

Si por alguna razón la rama no existe, créala desde \`develop\`:

\`\`\`bash
git checkout -b agent/<tu-nombre>/<TASK-ID> develop
\`\`\`

## 📝 Flujo de Trabajo del Agente

\`\`\`bash
# 1. Ver tus tareas asignadas
gco status

# 2. Cambiar a tu rama de trabajo (ya fue creada por gco assign)
git checkout agent/<tu-nombre>/<TASK-ID>

# 3. Leer tu briefing (contiene todo el contexto que necesitas)
cat .gco/briefings/<TASK-ID>-<tu-nombre>.md

# 4. Registrar inicio
gco log --agent <tu-nombre> --task <TASK-ID> --type start "Iniciando trabajo"

# 5. Trabajar y hacer commits
git add .
git commit -m "[TASK-ID] feat: descripción del cambio"

# 6. Registrar progreso
gco log --agent <tu-nombre> --task <TASK-ID> --type progress "Descripción del avance"

# 7. Al terminar
gco log --agent <tu-nombre> --task <TASK-ID> --type complete "Trabajo completado"
gco task status <TASK-ID> review
\`\`\`

## 📋 Gestión de Tareas

Usa **siempre** los comandos \`gco task\` para gestionar tareas. **Nunca edites tasks.md manualmente.**

### ¿Cuándo debo crear tareas?

- Solo cuando el orquestador humano te lo pida explícitamente (por ejemplo: "crea las tasks del proyecto").
- Si no te lo piden, enfócate en ejecutar tus tareas asignadas.
- Al crear tareas, deja \`status: pending\` y evita auto-asignarte a menos que te lo indiquen.

### Crear una tarea nueva

\`\`\`bash
# Modo rápido
gco task create --title "Implementar login" --description "Crear formulario y lógica de autenticación"

# Crear tarea sugerida para un agente específico
gco task create --title "API auth" --description "Crear endpoint login" --agent copilot

# Modo interactivo (te pregunta cada campo)
gco task create
\`\`\`

### Cambiar estado de una tarea

\`\`\`bash
gco task status TASK-001 in-progress   # Empezar a trabajar
gco task status TASK-001 blocked        # Marcar como bloqueada
gco task status TASK-001 review         # Terminada, lista para revisión
\`\`\`

### Listar tareas

\`\`\`bash
gco task list                # Ver todas
gco task list --status pending   # Solo pendientes
gco task list --assigned vscode  # Solo tareas de @vscode
gco task show TASK-001       # Detalle de una tarea
\`\`\`

### ¿Cómo sé si una tarea me toca a mí?

Una tarea te corresponde si se cumplen estas señales:

1. En \`tasks.md\` aparece \`[ASSIGNED:@tu-nombre]\`
2. Existe tu briefing: \`.gco/briefings/<TASK-ID>-<tu-nombre>.md\`
3. Tu rama esperada coincide: \`agent/<tu-nombre>/<TASK-ID>\`

Comprobación rápida:

\`\`\`bash
gco task list --assigned <tu-nombre>
gco task show <TASK-ID>
\`\`\`

Si una tarea está asignada a otro agente, **no la ejecutes**.

### Formato de tasks.md (referencia)

El archivo \`tasks.md\` se genera automáticamente con este formato para cada tarea:

\`\`\`markdown
## TASK-001 [STATUS:pending] [ASSIGNED:@vscode]
**Título:** Implementar login
**Descripción:** Crear formulario y lógica de autenticación
**Criterios de aceptación:**
- [ ] Formulario con email y contraseña
- [ ] Validación de campos
- [ ] Integración con API de auth
**Dependencias:** Ninguna
**Notas técnicas:**
- Usar bcrypt para hash de contraseñas
**Completada:** (vacío)
\`\`\`

### Estados válidos

| Estado | Significado |
|--------|-------------|
| \`pending\` | Creada, sin empezar o asignada pero no iniciada |
| \`in-progress\` | Agente trabajando activamente |
| \`blocked\` | Bloqueada por dependencias o esperando a otro agente |
| \`review\` | Terminada, esperando aprobación del humano |
| \`completed\` | Aprobada y mergeada a develop |

## ⚠️ Restricciones

- **NO** modifiques archivos fuera del alcance de tu tarea.
- **NO** edites \`tasks.md\` manualmente — usa \`gco task create\`, \`gco task status\`, etc.
- **NO** hagas merge a \`develop\` o \`main\` — eso lo hace el orquestador humano.
- **NO** trabajes en tareas que no te fueron asignadas.
- Si necesitas algo de otra tarea, documéntalo: \`gco log --type block "Necesito TASK-002 terminada"\`.

## 📂 Estructura del Orquestador

\`\`\`
.gco/
├── config.json              # Configuración del proyecto
├── AGENT_INSTRUCTIONS.md    # Este archivo
├── PROJECT_CONTEXT.md       # Contexto del proyecto (leer antes de trabajar)
├── agents/                  # Templates de agentes registrados
│   ├── vscode-template.md
│   └── copilot-template.md
└── briefings/               # Briefings por tarea asignada
    └── TASK-XXX-agente.md   # Tu briefing específico

.gco-logs/                   # Logs de actividad (no versionados)
├── current.md               # Log del día
├── index.json               # Índice de entradas
└── <agente>/                # Logs por agente
    └── <TASK-ID>.log        # Log específico de la tarea

tasks.md                     # Board de tareas (raíz del proyecto)
DEVELOP_LOG.md               # Log de desarrollo (raíz del proyecto)
\`\`\`

## 🏷️ Convención de Commits

\`\`\`
[TASK-XXX] tipo: descripción breve

Tipos válidos:
- feat: nueva funcionalidad
- fix: corrección de bug
- refactor: refactorización
- docs: documentación
- test: tests
- chore: mantenimiento
\`\`\`

Ejemplos:
\`\`\`
[TASK-001] feat: add login form component
[TASK-001] fix: validate email format before submit
[TASK-003] test: add unit tests for auth service
\`\`\`

## 📡 Comunicación entre Agentes

Los agentes **NO se comunican directamente**. Toda coordinación pasa por:
1. El archivo \`tasks.md\` (estado de tareas) — usar \`gco task\` para modificar
2. El archivo \`DEVELOP_LOG.md\` (registro de actividad) — usar \`gco log\`
3. Los briefings en \`.gco/briefings/\` (instrucciones por tarea)
4. El orquestador humano (asignación con \`gco assign\` y revisión con \`gco review\`)

## 🔍 Comandos Útiles (referencia rápida)

\`\`\`bash
gco status                    # Ver estado general del proyecto
gco task list                 # Listar todas las tareas
gco task create --title ".."  # Crear tarea nueva
gco task status TASK-X review # Cambiar estado de tarea
gco log --type progress ".."  # Registrar progreso (auto-detecta agente/tarea desde la rama)
gco read                      # Leer el log actual formateado
gco diff TASK-001             # Ver diff de una tarea vs develop
\`\`\`
`;
}

function generateProjectContext(projectRoot) {
  let projectName = path.basename(projectRoot);
  let projectDesc = '';
  let techStack = [];

  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      projectName = pkg.name || projectName;
      projectDesc = pkg.description || '';
      if (pkg.dependencies) techStack.push(...Object.keys(pkg.dependencies));
      if (pkg.devDependencies) techStack.push(...Object.keys(pkg.devDependencies));
    } catch { /* ignore */ }
  }

  // Detectar pyproject.toml
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    techStack.push('python (pyproject.toml detectado)');
  }

  // Detectar Cargo.toml
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    techStack.push('rust (Cargo.toml detectado)');
  }

  return `# 🏗️ Contexto del Proyecto

> Completa este archivo para que los agentes tengan contexto sobre el proyecto.
> Generado por **git-collab-orchestrator (gco)**.

## Proyecto
- **Nombre:** ${projectName}
- **Descripción:** ${projectDesc || 'TODO: Describir el proyecto'}

## Tech Stack
${techStack.length > 0 ? techStack.map(t => `- ${t}`).join('\n') : '- TODO: Listar tecnologías'}

## Arquitectura
<!-- Describe la arquitectura del proyecto para que los agentes entiendan la estructura -->
TODO: Describir la arquitectura, carpetas principales, patrones usados.

## Convenciones del Proyecto
<!-- Convenciones específicas de ESTE proyecto que los agentes deben seguir -->
TODO: Documentar convenciones de código, naming, estructura de archivos.

## Endpoints / APIs (si aplica)
TODO: Listar endpoints o APIs relevantes.

## Variables de Entorno
TODO: Listar variables de entorno necesarias.

## Notas Importantes
TODO: Cualquier cosa que un agente deba saber antes de empezar a trabajar.
`;
}

// ─── Init Command ──────────────────────────────────────────────

export function registerInitCommand(program) {
  program
    .command('init')
    .description('Inicializar proyecto gco en el directorio actual')
    .option('--template <type>', 'Template de proyecto (generic, react, node)', 'generic')
    .option('--force', 'Reinicializar aunque ya exista .gco/')
    .option('--strict', 'Activar modo estricto (hooks y guardas técnicas)')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const strictMode = Boolean(options.strict);

      printHeader('gco init — Inicializando proyecto');

      // Check if already initialized
      if (fs.existsSync(path.join(projectRoot, GCO_DIR)) && !options.force) {
        warn('Proyecto ya inicializado. Usa --force para reinicializar.');
        return;
      }

      // ── 1. Git repo ──────────────────────────────────────
      console.log(chalk.bold('\n📦 Repositorio Git'));
      if (!isGitRepo(projectRoot)) {
        initGitRepo(projectRoot);
        success('Repositorio Git inicializado');
      } else {
        info('Repositorio Git detectado');
      }

      // Asegurar al menos un commit para poder crear ramas
      if (!hasCommits(projectRoot)) {
        try {
          execSync('git commit --allow-empty -m "chore: initial commit"', {
            cwd: projectRoot,
            stdio: 'ignore',
          });
          success('Commit inicial creado');
        } catch {
          warn('No se pudo crear commit inicial — configura git user.name y user.email');
        }
      }

      // ── 2. Crear directorios ─────────────────────────────
      console.log(chalk.bold('\n📁 Estructura de directorios'));
      const dirs = [
        path.join(projectRoot, GCO_DIR),
        path.join(projectRoot, AGENTS_DIR),
        path.join(projectRoot, BRIEFINGS_DIR),
        path.join(projectRoot, GCO_LOGS_DIR),
      ];

      for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
        // .gitkeep para que Git trackee carpetas vacías
        const gitkeep = path.join(dir, '.gitkeep');
        if (!fs.existsSync(gitkeep)) {
          fs.writeFileSync(gitkeep, '', 'utf-8');
        }
      }
      success('Directorios creados: .gco/, .gco/agents/, .gco/briefings/, .gco-logs/');

      // ── 3. Config ────────────────────────────────────────
      console.log(chalk.bold('\n⚙️  Configuración'));
      const config = {
        ...DEFAULT_CONFIG,
        templates: { type: options.template },
        strictMode,
        mode: strictMode ? 'planning' : DEFAULT_CONFIG.mode,
        requireContextComplete: strictMode,
        requireTasksBeforeCode: strictMode,
      };
      saveConfig(projectRoot, config);
      success('Configuración guardada: .gco/config.json');

      // ── 4. Agent templates ───────────────────────────────
      const mergedAgents = {
        ...BASE_AGENT_CATALOG,
        ...Object.fromEntries(
          Object.entries(config.agents || {}).map(([agentId, value]) => [
            agentId,
            {
              name: value.name || `@${agentId}`,
              type: value.type || 'custom',
            },
          ])
        ),
      };

      for (const [agentId, agentCfg] of Object.entries(mergedAgents)) {
        const template = generateAgentTemplate(agentId, agentCfg);
        fs.writeFileSync(
          path.join(projectRoot, AGENTS_DIR, `${agentId}-template.md`),
          template,
          'utf-8'
        );
      }
      success(`Templates de agentes creados (${Object.keys(mergedAgents).length})`);

      // ── 5. tasks.md ──────────────────────────────────────
      console.log(chalk.bold('\n📋 Archivos de orquestación'));
      const tasksPath = path.join(projectRoot, TASKS_FILE);
      if (!fs.existsSync(tasksPath)) {
        const tasksContent = generateTasksContent([]);
        fs.writeFileSync(tasksPath, tasksContent, 'utf-8');
        success('tasks.md creado');
      } else {
        info('tasks.md ya existe, no se modificó');
      }

      // ── 6. AGENT_INSTRUCTIONS.md ─────────────────────────
      const instrPath = path.join(projectRoot, AGENT_INSTRUCTIONS_FILE);
      if (!fs.existsSync(instrPath) || options.force) {
        fs.writeFileSync(instrPath, generateAgentInstructions(), 'utf-8');
        success('AGENT_INSTRUCTIONS.md creado — instrucciones para agentes');
      } else {
        info('AGENT_INSTRUCTIONS.md ya existe');
      }

      // ── 7. PROJECT_CONTEXT.md ────────────────────────────
      const ctxPath = path.join(projectRoot, PROJECT_CONTEXT_FILE);
      if (!fs.existsSync(ctxPath) || options.force) {
        fs.writeFileSync(ctxPath, generateProjectContext(projectRoot), 'utf-8');
        success('PROJECT_CONTEXT.md creado');
        warn('⚡ Edita .gco/PROJECT_CONTEXT.md con info de tu proyecto para mejor contexto');
      } else {
        info('PROJECT_CONTEXT.md ya existe');
      }

      // ── 8. Log structure ─────────────────────────────────
      console.log(chalk.bold('\n📝 Logs'));
      ensureLogDir(projectRoot);
      success('Estructura de logs creada en .gco-logs/');

      const currentLogPath = path.join(projectRoot, GCO_LOGS_DIR, 'current.md');
      const devLogPath = path.join(projectRoot, DEVELOP_LOG_FILE);
      if (fs.existsSync(currentLogPath) && !fs.existsSync(devLogPath)) {
        fs.copyFileSync(currentLogPath, devLogPath);
      }
      success('DEVELOP_LOG.md listo');

      // ── 9. .gitignore ────────────────────────────────────
      console.log(chalk.bold('\n🔒 Git'));
      const gitignorePath = path.join(projectRoot, '.gitignore');
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }
      const gcoIgnoreEntries = [
        '# gco runtime artifacts (no versionados)',
        '.gco-logs/',
        '.gco/tmp/',
      ];
      const missingEntries = gcoIgnoreEntries.filter((entry) => !gitignoreContent.includes(entry));
      if (missingEntries.length > 0) {
        gitignoreContent += `\n${missingEntries.join('\n')}\n`;
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
        success('Entradas de gco agregadas a .gitignore');
      }

      // ── 10. Modo estricto (opcional) ────────────────────
      if (strictMode) {
        createStrictHooks(projectRoot);
        activateHooksPath(projectRoot);
        success('Modo estricto activado: hooks instalados en .githooks/');
      } else if (options.force) {
        disableHooksPath(projectRoot);
        info('Modo estricto desactivado (core.hooksPath limpiado si existía)');
      }

      // ── 11. Ramas main y develop ─────────────────────────
      ensureBranch(projectRoot, 'main');
      ensureBranch(projectRoot, 'develop', 'main');

      // ── 12. Commit de la estructura ──────────────────────
      try {
        const addTargets = strictMode
          ? '.gco/ tasks.md DEVELOP_LOG.md .gitignore .githooks/'
          : '.gco/ tasks.md DEVELOP_LOG.md .gitignore';
        execSync(`git add ${addTargets}`, {
          cwd: projectRoot,
          stdio: 'ignore',
        });
        try {
          execSync('git diff --cached --quiet', { cwd: projectRoot, stdio: 'ignore' });
          info('Sin cambios nuevos que commitear');
        } catch {
          execSync('git commit -m "chore: initialize git-collab-orchestrator"', {
            cwd: projectRoot,
            stdio: 'ignore',
          });
          success('Commit de inicialización creado');
        }
      } catch {
        warn('No se pudo hacer commit automático. Hazlo manualmente con git add y git commit.');
      }

      // ── Resumen ──────────────────────────────────────────
      console.log();
      console.log(chalk.green.bold('🎉 Proyecto gco inicializado correctamente!'));
      console.log();
      console.log(chalk.white('📂 Estructura creada:'));
      console.log(chalk.gray('   .gco/'));
      console.log(chalk.gray('   ├── config.json'));
      console.log(chalk.gray('   ├── AGENT_INSTRUCTIONS.md  ← reglas para agentes'));
      console.log(chalk.gray('   ├── PROJECT_CONTEXT.md     ← contexto del proyecto'));
      console.log(chalk.gray('   ├── agents/                ← templates por agente'));
      console.log(chalk.gray('   └── briefings/             ← briefings por tarea'));
      console.log(chalk.gray('   .gco-logs/                 ← logs (no versionados)'));
      console.log(chalk.gray('   tasks.md                   ← board de tareas'));
      console.log(chalk.gray('   DEVELOP_LOG.md             ← log de desarrollo'));
      if (strictMode) {
        console.log(chalk.gray('   .githooks/                 ← guardas técnicas (modo estricto)'));
      }
      console.log();
      console.log(chalk.white('🔀 Ramas configuradas:'));
      console.log(chalk.gray('   main    → producción (protegida)'));
      console.log(chalk.gray('   develop → integración'));
      if (strictMode) {
        console.log(chalk.gray('   modo    → planning (estricto)'));
      }
      console.log();
      console.log(chalk.white('📝 Próximos pasos:'));
      console.log(chalk.cyan('  1.') + chalk.gray(' Edita .gco/PROJECT_CONTEXT.md con info de tu proyecto'));
      console.log(chalk.cyan('  2.') + chalk.gray(' gco task create --title "Mi tarea"'));
      console.log(chalk.cyan('  3.') + chalk.gray(' gco assign TASK-001 vscode'));
      console.log(chalk.cyan('  4.') + chalk.gray(' ¡Los agentes ya pueden empezar a trabajar!'));
      console.log();
    });
}
