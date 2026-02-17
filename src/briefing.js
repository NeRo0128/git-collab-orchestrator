// Briefing generator for agent task assignments
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { BRIEFINGS_DIR, AGENTS_DIR } from './constants.js';
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
6. Commit: \`git commit -m "[${task.id}] <descripción>"\`

## 📊 Contexto del Proyecto

`;

  // Add recent log entries for context
  const logContent = readCurrentLog(projectRoot);
  if (logContent) {
    const recentLines = logContent.split('\n').slice(-30).join('\n');
    briefing += `### Actividad Reciente\n\n${recentLines}\n`;
  }

  // Try to load agent template
  const templatePath = path.join(projectRoot, AGENTS_DIR, `${agentName}-template.md`);
  if (fs.existsSync(templatePath)) {
    const template = fs.readFileSync(templatePath, 'utf-8');
    briefing += `\n## 🤖 Template del Agente\n\n${template}\n`;
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
