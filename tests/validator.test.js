// Tests for validator
import { describe, it, expect } from 'vitest';

// We test the validation logic by importing internal functions
// Since validateAll is async and needs git, we test the pure functions

import { parseTasksContent } from '../src/tasks.js';

describe('Validation logic', () => {
  it('should detect blocked task without reason', () => {
    const content = `## TASK-001 [STATUS:blocked] [ASSIGNED:@vscode]
**Título:** Test
**Descripción:** Test
**Criterios de aceptación:**
- [ ] Test
**Dependencias:** Ninguna
**Completada:** (vacío)`;

    const { tasks } = parseTasksContent(content);
    const task = tasks[0];
    expect(task.status).toBe('blocked');
    expect(task.blockReason).toBe('');
  });

  it('should detect in-progress without assignment', () => {
    const content = `## TASK-001 [STATUS:in-progress] [ASSIGNED:]
**Título:** Test
**Descripción:** Test
**Criterios de aceptación:**
- [ ] Test
**Dependencias:** Ninguna
**Completada:** (vacío)`;

    const { tasks } = parseTasksContent(content);
    expect(tasks[0].status).toBe('in-progress');
    expect(tasks[0].assigned).toBe('');
  });

  it('should detect dependency references', () => {
    const content = `## TASK-001 [STATUS:pending] [ASSIGNED:]
**Título:** Test
**Descripción:** Test
**Criterios de aceptación:**
- [ ] Test
**Dependencias:** TASK-002, TASK-003
**Completada:** (vacío)`;

    const { tasks } = parseTasksContent(content);
    const deps = tasks[0].dependencies.match(/TASK-\d+/g);
    expect(deps).toEqual(['TASK-002', 'TASK-003']);
  });
});
