# 🤖 Guía de Agentes

## Agentes Soportados

`gco` es agnóstico al tipo de agente IA. Cualquier agente que pueda leer/escribir archivos y ejecutar comandos puede coordinarse.

### VS Code Copilot Chat (@vscode)

El agente trabaja directamente en VS Code con acceso al terminal.

**Setup:**
```bash
gco config set agents.vscode.name "@vscode"
gco config set agents.vscode.type "copilot-chat"
```

**Flujo del agente:**
1. Lee su briefing: `cat .gco/briefings/TASK-XXX-vscode.md`
2. Cambia a su rama: `git checkout agent/vscode/TASK-XXX`
3. Registra inicio: `gco log --agent vscode --task TASK-XXX --type start "Iniciando"`
4. Trabaja en el código
5. Registra progreso: `gco log --type progress "50% completado"`
6. Al terminar: `gco log --type complete "Tarea completada"`
7. Commit: `git commit -m "[TASK-XXX] descripción"`

**Prompt sugerido para el agente:**
```
Eres un agente de desarrollo (@vscode). Tu tarea actual está en el briefing. 
Antes de empezar, ejecuta: gco log --agent vscode --task TASK-XXX --type start "Iniciando"
Registra tu progreso con: gco log --type progress "descripción"
Coordina con otros agentes leyendo: gco read
Al terminar: gco task status TASK-XXX review
```

### GitHub Copilot CLI (@copilot)

Para uso con `gh copilot suggest` o similares, donde tú actúas como intermediario.

**Setup:**
```bash
gco config set agents.copilot.name "@copilot"
gco config set agents.copilot.type "copilot-cli"
```

**Flujo:**
1. Tú lees el briefing: `gco prompt TASK-XXX copilot`
2. Usas copilot para generar código
3. Tú registras progreso: `gco log --agent copilot --task TASK-XXX --type progress "..."`
4. Tú haces commit

### Agentes Personalizados

Puedes agregar cualquier agente:

```bash
gco config set agents.claude.name "@claude"
gco config set agents.claude.type "custom"
```

Crea un template en `.gco/agents/claude-template.md` con instrucciones específicas.

## Coordinación entre Agentes

### Comunicación vía DEVELOP_LOG.md

Los agentes se comunican dejando mensajes en el log:

```bash
# Agente 1 anuncia una decisión
gco log --agent vscode --task TASK-001 --type decision "Usaré zod para validación"

# Agente 2 lee el log y responde
gco log --agent copilot --task TASK-002 --type answer "Confirmado, uso el mismo esquema"
```

### Resolución de Conflictos

Si dos agentes editan el mismo archivo:
1. `gco validate` detectará la colisión
2. El humano decide quién tiene prioridad
3. Se mergea uno primero, luego el otro resuelve conflictos

### Dependencias entre Tareas

- Usa el campo **Dependencias** en tasks.md
- `gco validate` detecta dependencias circulares
- `gco status` muestra tareas bloqueadas y sus razones
