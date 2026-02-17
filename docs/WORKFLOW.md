# 🔄 Flujos de Trabajo

## Flujo Completo: Dos Agentes en Paralelo

### Escenario
Frontend (@vscode) y Backend (@copilot) trabajan en autenticación simultáneamente.

### 1. Preparación (Humano)

```bash
# Crear tareas
gco task create --id TASK-001 --title "Login UI" --agent vscode
gco task create --id TASK-002 --title "Auth API" --agent copilot

# Asignar (crea ramas y briefings)
gco assign TASK-001 vscode
gco assign TASK-002 copilot
```

### 2. Trabajo Paralelo

**@vscode** (en VS Code):
```bash
git checkout agent/vscode/TASK-001
gco log --agent vscode --task TASK-001 --type start "Leyendo briefing"
# ... trabaja en el frontend ...
gco log --type progress "Formulario UI completado, integrando API"
gco log --type question "@copilot: ¿formato de respuesta del endpoint?"
```

**@copilot** (en terminal):
```bash
git checkout agent/copilot/TASK-002
gco log --agent copilot --task TASK-002 --type start "Implementando endpoint"
# ... trabaja en el backend ...
gco log --type decision "Response: {token, user: {id, email, name}}"
gco log --type answer "@vscode: formato definido, ver mi última entrada"
```

### 3. Monitoreo (Humano)

```bash
# Ver qué hacen los agentes
gco status

# Leer comunicaciones
gco read

# Verificar consistencia
gco validate
```

### 4. Revisión y Merge

```bash
# Revisar cada tarea
gco review TASK-001
gco review TASK-002

# Aprobar
gco approve TASK-002  # Backend primero
gco approve TASK-001  # Frontend después

# Archivar log del día
gco archive
```

---

## Flujo: Tarea Bloqueada

```bash
# Agente encuentra dependencia
gco task status TASK-004 blocked --reason "Esperando API avatar de @copilot"

# Humano ve bloqueo
gco status
# 🔴 TASK-004 Bloqueada: Esperando API avatar de @copilot

# Cuando se resuelve
gco task status TASK-004 in-progress
gco log --agent vscode --task TASK-004 --type start "Desbloqueada, continuando"
```

---

## Flujo: Sincronización con GitHub

```bash
# Configurar repo
gco config set github.owner mi-usuario
gco config set github.repo mi-proyecto
gco config set github.token ghp_xxxxx

# Ver qué se importaría
gco sync --dry-run

# Importar issues
gco sync

# Asignar las nuevas tareas
gco assign TASK-006 vscode
gco assign TASK-007 copilot
```

---

## Flujo: Rechazo y Corrección

```bash
# Humano revisa y no le gusta
gco reject TASK-001 --reason "Falta manejo de errores en el formulario"

# La tarea vuelve a in-progress
# El agente lee el feedback
gco read
# Corrige y vuelve a marcar como review
gco task status TASK-001 review

# Humano aprueba la segunda vez
gco approve TASK-001
```
