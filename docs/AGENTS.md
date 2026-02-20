# 🤖 Guía de Agentes

## Enfoque híbrido (catálogo + custom)

`gco` soporta una arquitectura escalable:

- **Catálogo base oficial** de agentes comunes (creado automáticamente por `gco init`).
- **Extensión custom** vía configuración (`gco config set agents.<id>...`) sin tocar código.

## Catálogo base de agentes

Al ejecutar `gco init`, se crean templates en `.gco/agents/` para:

- `vscode` (`@vscode`, `copilot-chat`)
- `copilot` (`@copilot`, `copilot-cli`)
- `claude` (`@claude`, `claude-cli`)
- `cursor` (`@cursor`, `cursor-agent`)
- `windsurf` (`@windsurf`, `windsurf-agent`)
- `aider` (`@aider`, `aider-cli`)
- `codex` (`@codex`, `openai-codex-cli`)

Cada agente recibe su template `<id>-template.md` y briefing específico por tarea.

## Flujo estándar por agente

1. Leer briefing: `cat .gco/briefings/TASK-XXX-<agente>.md`
2. Checkout a rama: `git checkout agent/<agente>/TASK-XXX`
3. Registrar inicio: `gco log --agent <agente> --task TASK-XXX --type start "Iniciando"`
4. Trabajar en código
5. Registrar progreso: `gco log --agent <agente> --task TASK-XXX --type progress "..."`
6. Marcar revisión: `gco task status TASK-XXX review`
7. Commit: `git commit -m "[TASK-XXX] descripción"`

## Agentes custom (extensión)

Puedes agregar cualquier agente adicional sin tocar código:

```bash
gco config set agents.myagent.name "@myagent"
gco config set agents.myagent.type "custom"
```

Luego crea su template:

```bash
cat > .gco/agents/myagent-template.md << 'EOF'
# Template para Agente MyAgent (@myagent)

## Rol
...
EOF
```

## Coordinación entre agentes

### Comunicación por log compartido

```bash
gco log --agent vscode --task TASK-001 --type decision "Usaré zod para validación"
gco log --agent copilot --task TASK-002 --type answer "Confirmado, uso el mismo esquema"
```

### Resolución de conflictos

Si dos agentes editan el mismo archivo:

1. `gco validate` detecta colisiones
2. El humano decide prioridad
3. Se mergea una rama primero y la otra resuelve conflictos

### Dependencias entre tareas

- Usa el campo **Dependencias** en `tasks.md`
- `gco validate` detecta dependencias circulares
- `gco status` muestra tareas bloqueadas
