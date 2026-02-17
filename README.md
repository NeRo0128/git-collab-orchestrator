# 🤖 gco - Git Collaborative Orchestrator

> Orquesta múltiples agentes de IA trabajando en paralelo sobre un proyecto Git.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

## ¿Qué es gco?

`gco` es un sistema CLI que permite coordinar múltiples agentes de IA (VS Code Copilot Chat, Copilot CLI, Claude, etc.) trabajando simultáneamente en un mismo proyecto. Usa `tasks.md` como fuente de verdad para tareas y `DEVELOP_LOG.md` como memoria compartida de coordinación.

## 🚀 Instalación

```bash
# Instalación global
npm install -g git-collab-orchestrator

# O usar directamente con npx
npx git-collab-orchestrator init
```

## ⚡ Quick Start

```bash
# 1. En tu proyecto Git existente
cd mi-proyecto
gco init

# 2. Crear tareas
gco task create --title "Implementar login" --agent vscode
gco task create --title "API de autenticación" --agent copilot

# 3. Asignar (crea rama y briefing)
gco assign TASK-001 vscode
gco assign TASK-002 copilot

# 4. Los agentes trabajan y registran progreso
gco log --agent vscode --task TASK-001 --type start "Iniciando login"
gco log --agent copilot --task TASK-002 --type progress "API 50% lista"

# 5. Ver estado
gco status

# 6. Revisar y aprobar
gco review TASK-001
gco approve TASK-001
```

## 📋 Comandos

### Inicialización

| Comando | Descripción |
|---------|-------------|
| `gco init` | Inicializar proyecto gco |
| `gco init --template react` | Inicializar con template React |

### Gestión de Tareas

| Comando | Descripción |
|---------|-------------|
| `gco task create` | Crear tarea (interactivo) |
| `gco task create --title "X" --agent vscode` | Crear tarea rápida |
| `gco task list` | Listar tareas activas |
| `gco task list --status pending` | Filtrar por estado |
| `gco task list --assigned @vscode` | Filtrar por agente |
| `gco task show TASK-001` | Ver detalle de tarea |
| `gco task status TASK-001 in-progress` | Cambiar estado |
| `gco task status TASK-001 blocked --reason "..."` | Bloquear con razón |

### Asignación

| Comando | Descripción |
|---------|-------------|
| `gco assign TASK-001 vscode` | Asignar tarea a agente |
| `gco claim TASK-001` | Auto-asignarse tarea |

### Log de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `gco log "mensaje"` | Log rápido (detecta agente/tarea del branch) |
| `gco log --agent vscode --task TASK-001 --type start "..."` | Log completo |
| `gco read` | Leer log formateado |
| `gco archive` | Archivar log del día |

### Sincronización GitHub

| Comando | Descripción |
|---------|-------------|
| `gco sync` | Sincronizar issues → tasks.md |
| `gco sync --dry-run` | Ver cambios sin aplicar |
| `gco sync --issue 42` | Sincronizar issue específico |

### Revisión

| Comando | Descripción |
|---------|-------------|
| `gco review TASK-001` | Revisar tarea (diff, log, criterios) |
| `gco review --list` | Listar tareas pendientes de review |
| `gco approve TASK-001` | Aprobar y mergear |
| `gco reject TASK-001 --reason "..."` | Rechazar |

### Utilidades

| Comando | Descripción |
|---------|-------------|
| `gco status` | Estado completo del proyecto |
| `gco validate` | Validar consistencia |
| `gco diff TASK-001` | Diff de tarea vs develop |
| `gco prompt TASK-001 vscode` | Generar briefing |
| `gco stats` | Estadísticas del proyecto |
| `gco config set key value` | Configuración |

## 📁 Estructura del Proyecto

```
tu-proyecto/
├── tasks.md                 # Fuente de verdad (en Git)
├── DEVELOP_LOG.md           # Log del día actual (en Git)
├── .gco/                    # Configuración (en Git)
│   ├── config.json
│   ├── agents/              # Templates de agentes
│   └── briefings/           # Briefings generados
├── .gco-logs/               # Logs históricos (NO en Git)
│   ├── current.md
│   ├── index.json
│   └── YYYY-MM-DD.md
└── .gitignore
```

## 📄 Formato tasks.md

```markdown
## TASK-001 [STATUS:in-progress] [ASSIGNED:@vscode]
**Título:** Implementar login
**Descripción:** Crear formulario de login con validación
**Criterios de aceptación:**
- [x] Campo email con validación
- [ ] Campo password mínimo 8 caracteres
**Dependencias:** TASK-002
**Notas técnicas:** Usar react-hook-form + zod
**Completada:** (vacío)
```

### Estados

- `pending` — Sin empezar
- `in-progress` — Agente trabajando
- `blocked` — Esperando dependencia/otro agente
- `review` — Completada, esperando aprobación
- `completed` — Aprobada y mergeada

## 🔧 Configuración

```bash
# GitHub
gco config set github.owner mi-usuario
gco config set github.repo mi-repo
gco config set github.token ghp_xxx

# Branch principal
gco config set mainBranch develop

# Agentes
gco config set agents.vscode.name "@vscode"
gco config set agents.copilot.name "@copilot"
```

## 🧪 Tests

```bash
npm test            # Ejecutar tests
npm run test:watch  # Watch mode
```

## 📚 Documentación Adicional

- [Guía de Agentes](docs/AGENTS.md) — Cómo usar gco con diferentes agentes IA
- [Flujos de Trabajo](docs/WORKFLOW.md) — Ejemplos de flujos completos
- [Configuración](docs/CONFIGURATION.md) — Opciones avanzadas

## License

MIT
