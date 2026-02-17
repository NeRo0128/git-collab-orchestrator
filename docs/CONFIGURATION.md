# ⚙️ Configuración

## Archivo de Configuración

La configuración se guarda en `.gco/config.json`. Puedes editarla manualmente o usar `gco config`.

```json
{
  "version": "1.0.0",
  "mainBranch": "develop",
  "branchPrefix": "agent",
  "github": {
    "token": "",
    "repo": "",
    "owner": ""
  },
  "agents": {
    "vscode": {
      "name": "@vscode",
      "type": "copilot-chat"
    },
    "copilot": {
      "name": "@copilot",
      "type": "copilot-cli"
    }
  },
  "log": {
    "autoArchive": false,
    "archiveTime": "23:59"
  },
  "templates": {
    "type": "generic"
  }
}
```

## Opciones de Configuración

### `mainBranch`
Rama principal del proyecto. Default: `develop`.

```bash
gco config set mainBranch main
```

### `branchPrefix`
Prefijo para ramas de agentes. Default: `agent`.
Las ramas se crean como: `{branchPrefix}/{agentName}/{taskId}`

```bash
gco config set branchPrefix feature/agent
# Resultado: feature/agent/vscode/TASK-001
```

### `github.token`
Token de acceso personal de GitHub. Necesario para `gco sync` en repos privados.

```bash
gco config set github.token ghp_xxxxxxxxxxxx
```

### `github.owner` y `github.repo`
Owner y nombre del repositorio de GitHub.

```bash
gco config set github.owner mi-usuario
gco config set github.repo mi-proyecto
```

### `agents.<name>.name`
Nombre/tag del agente (cómo aparece en logs y tasks.md).

```bash
gco config set agents.claude.name "@claude"
```

### `agents.<name>.type`
Tipo de agente. Valores sugeridos: `copilot-chat`, `copilot-cli`, `claude`, `custom`.

```bash
gco config set agents.claude.type "custom"
```

### `log.autoArchive`
Archivar automáticamente el log al final del día. Default: `false`.

```bash
gco config set log.autoArchive true
```

### `log.archiveTime`
Hora a la que se archiva automáticamente. Default: `23:59`.

```bash
gco config set log.archiveTime "18:00"
```

## Lectura de Configuración

```bash
# Ver toda la configuración
gco config list

# Ver un valor específico
gco config get github.owner

# Ver sección completa
gco config get agents
```

## Variables de Entorno

| Variable | Descripción | Equivalente config |
|----------|-------------|-------------------|
| `GCO_GITHUB_TOKEN` | Token de GitHub | `github.token` |
| `EDITOR` | Editor para `gco task edit` | - |

## Templates de Agentes

Los templates se guardan en `.gco/agents/` y se incluyen automáticamente en los briefings generados.

Para crear un template personalizado:

```bash
cat > .gco/agents/mi-agente-template.md << 'EOF'
# Template para @mi-agente

## Instrucciones específicas
- Usar TypeScript estricto
- Tests obligatorios para cada función
- Documentar con JSDoc

## Convenciones del proyecto
- Commits en inglés
- PR description en español
EOF
```
