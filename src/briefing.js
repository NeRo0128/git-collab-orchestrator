// Briefing generator for agent task assignments
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { BRIEFINGS_DIR, AGENTS_DIR, AGENT_INSTRUCTIONS_FILE, PROJECT_CONTEXT_FILE } from './constants.js';
import { readCurrentLog } from './log.js';

/**
 * Generate a briefing document for an agent-task assignment
 */
export function generateBriefing(projectRoot, task, agentName, config) {
  const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const branchName = `agent/${agentName}/${task.id}`;

  let briefing = `# Briefing: ${task.id} - ${task.title}

> Generado: ${now}
> Agente: @${agentName}
> Rama: \`${branchName}\`

---

## 📋 Tarea

**ID:** ${task.id}
**Título:** ${task.title}
**Descripción:** ${task.description}

## 👤 Asignación

- **Agente asignado:** @${agentName}
- **Esta tarea es para:** @${agentName}
- Si no eres **@${agentName}**, detente y avisa al orquestador humano.

## ✅ Criterios de Aceptación

`;

  for (const c of task.criteria) {
    briefing += `- [ ] ${c.text}\n`;
  }

  briefing += `
## 🔗 Dependencias

${task.dependencies || 'Ninguna'}

## 📝 Notas Técnicas

${task.notes || '(sin notas)'}

## 🔧 Instrucciones

1. Checkout la rama: \`git checkout ${branchName}\`
2. Registra inicio: \`gco log --agent ${agentName} --task ${task.id} --type start "Iniciando..."\`
3. Trabaja en los criterios de aceptación uno por uno
4. Registra progreso: \`gco log --agent ${agentName} --task ${task.id} --type progress "Avance..."\`
5. Al terminar: \`gco log --agent ${agentName} --task ${task.id} --type complete "Completado"\`
6. Cambiar status: \`gco task status ${task.id} review\`
7. Commit: \`git commit -m "[${task.id}] <descripción>"\`

## 🏗️ Contexto del Proyecto

`;

  // Include project context if available
  const projectContextPath = path.join(projectRoot, PROJECT_CONTEXT_FILE);
  if (fs.existsSync(projectContextPath)) {
    const projectContext = fs.readFileSync(projectContextPath, 'utf-8');
    // Strip the header (first 3 lines) to avoid duplication
    const contextLines = projectContext.split('\n');
    const contextBody = contextLines.slice(3).join('\n').trim();
    if (contextBody && !contextBody.includes('TODO:')) {
      briefing += `${contextBody}\n\n`;
    } else {
      briefing += `> ⚠️ PROJECT_CONTEXT.md no ha sido completado. Revisa .gco/PROJECT_CONTEXT.md\n\n`;
    }
  }

  // Add recent log entries for context
  const logContent = readCurrentLog(projectRoot);
  if (logContent) {
    const recentLines = logContent.split('\n').slice(-30).join('\n');
    if (recentLines.trim()) {
      briefing += `### Actividad Reciente\n\n${recentLines}\n`;
    }
  }

  // Try to load agent template
  const templatePath = path.join(projectRoot, AGENTS_DIR, `${agentName}-template.md`);
  if (fs.existsSync(templatePath)) {
    const template = fs.readFileSync(templatePath, 'utf-8');
    briefing += `\n## 🤖 Template del Agente\n\n${template}\n`;
  }

  // Add reference to full instructions
  const instrPath = path.join(projectRoot, AGENT_INSTRUCTIONS_FILE);
  if (fs.existsSync(instrPath)) {
    briefing += `\n---\n> 📖 Lee las reglas completas en: \`cat ${AGENT_INSTRUCTIONS_FILE}\`\n`;
  }

  return briefing;
}

/**
 * Save briefing to file
 */
export function saveBriefing(projectRoot, taskId, agentName, content) {
  const dir = path.join(projectRoot, BRIEFINGS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${taskId}-${agentName}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Read a briefing file
 */
export function readBriefing(projectRoot, taskId, agentName) {
  const filePath = path.join(projectRoot, BRIEFINGS_DIR, `${taskId}-${agentName}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
