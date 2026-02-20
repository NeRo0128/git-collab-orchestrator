# 🤖 gco - Git Collaborative Orchestrator

> CLI para orquestar agentes IA en paralelo sobre un repositorio Git con tareas, ramas y briefings por agente.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

## ¿Qué es gco?

`gco` te ayuda a coordinar un flujo multi-agente de forma controlada:

- `tasks.md` = backlog y estado de trabajo
- `DEVELOP_LOG.md` = memoria compartida del proyecto
- `.gco/briefings/` = contexto por tarea/agente
- ramas por tarea/agente = `agent/<agente>/<TASK-ID>`

Incluye política de planificación para que el **agente principal** cree/actualice tareas acordadas durante la conversación.

## 🚀 Instalación

```bash
# Global
npm install -g git-collab-orchestrator

# O sin instalar
npx git-collab-orchestrator init
```

## ⚡ Quick Start

```bash
# 1) En tu repo
cd mi-proyecto
gco init

# 2) Completar contexto
# Edita .gco/PROJECT_CONTEXT.md

# 3) Planificación (agente principal)
gco task create --title "Diseñar arquitectura base"
gco task create --title "Implementar auth API"
gco task list

# 4) Asignación (crea rama + briefing + log)
gco assign TASK-001 vscode
gco assign TASK-002 copilot

# 5) Seguimiento
gco status
gco review --list
```

## 🆕 ¿Qué agrega `gco init` ahora?

`gco init` (y `gco init --force`) crea/configura:

- repo Git si no existe
- ramas base `main` y `develop`
- `.gco/AGENT_INSTRUCTIONS.md` con políticas operativas
- `.gco/PROJECT_CONTEXT.md` para contexto del proyecto
- `.gco/agents/` (templates)
- `.gco/briefings/`
- `.gco-logs/` y `DEVELOP_LOG.md`
- `tasks.md` inicial
- `.gitignore` con `.gco-logs/`

Además, intenta commit automático de la inicialización.

## 🧠 Política de planificación (incluida)

Las instrucciones generadas incluyen que el agente principal debe:

1. Leer `.gco/PROJECT_CONTEXT.md` y `.gco/AGENT_INSTRUCTIONS.md`
2. Crear backlog con `gco task create` si está vacío/incompleto
3. Registrar nuevas tareas acordadas en conversación **en el momento**
4. Confirmar IDs `TASK-XXX`
5. Cerrar ronda con `gco task list` + resumen

## 📋 Comandos principales

### Inicialización

| Comando | Descripción |
|---------|-------------|
| `gco init` | Inicializa estructura de orquestación |
| `gco init --force` | Regenera archivos de orquestación/políticas |
| `gco init --template react` | Usa template de proyecto |

### Tareas

| Comando | Descripción |
|---------|-------------|
| `gco task create` | Crear tarea (interactivo) |
| `gco task create --title "X" --description "Y"` | Crear tarea rápida |
| `gco task list` | Listar tareas |
| `gco task list --status pending` | Filtrar por estado |
| `gco task list --assigned vscode` | Filtrar por agente |
| `gco task show TASK-001` | Ver detalle |
| `gco task status TASK-001 review` | Cambiar estado |

### Asignación y ejecución

| Comando | Descripción |
|---------|-------------|
| `gco assign TASK-001 vscode` | Asigna: actualiza task + crea briefing + crea rama + crea log |
| `gco claim TASK-001` | Auto-claim según rama actual |
| `gco prompt TASK-001 vscode` | Imprime briefing/prompt para agente |

### Seguimiento y revisión

| Comando | Descripción |
|---------|-------------|
| `gco status` | Estado global |
| `gco validate` | Valida consistencia |
| `gco log --type progress "..."` | Agrega entrada al log |
| `gco read` | Leer log actual |
| `gco review TASK-001` | Revisar tarea |
| `gco approve TASK-001` | Aprobar y mergear |
| `gco reject TASK-001 --reason "..."` | Rechazar |

## 📁 Estructura generada

```text
tu-proyecto/
├── tasks.md
├── DEVELOP_LOG.md
├── .gco/
│   ├── config.json
│   ├── AGENT_INSTRUCTIONS.md
│   ├── PROJECT_CONTEXT.md
│   ├── agents/
│   │   ├── vscode-template.md
│   │   └── copilot-template.md
│   └── briefings/
│       └── TASK-001-vscode.md
└── .gco-logs/
	├── current.md
	├── index.json
	└── <agente>/
		└── TASK-001.log
```

## 🧪 Desarrollo local

```bash
npm ci
npm test
npm link

# smoke test
mkdir -p /tmp/gco-smoke && cd /tmp/gco-smoke
git init
gco init
gco task create --title "Prueba"
gco task list
```

## 🔧 Configuración útil

```bash
# GitHub sync
gco config set github.owner mi-usuario
gco config set github.repo mi-repo
gco config set github.token ghp_xxx

# Branch base para merges/reviews
gco config set mainBranch develop
```

## 📚 Documentación adicional

- [Guía de Agentes](docs/AGENTS.md)
- [Flujos de Trabajo](docs/WORKFLOW.md)
- [Configuración](docs/CONFIGURATION.md)

## License

MIT
