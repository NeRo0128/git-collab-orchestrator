// Tests for tasks.md parser and writer
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  parseTasksContent,
  generateTasksContent,
  getNextTaskId,
  parseTasks,
  addTask,
  updateTask,
  findTask,
  writeTasks,
} from '../src/tasks.js';

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gco-test-'));
  // Create .gco so ensureProject works
  fs.mkdirSync(path.join(dir, '.gco'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.gco', 'config.json'), '{}');
  return dir;
}

describe('parseTasksContent', () => {
  it('should parse empty content', () => {
    const result = parseTasksContent('');
    expect(result.tasks).toEqual([]);
  });

  it('should parse a single task', () => {
    const content = `# Backlog de Tareas

> Última sincronización: 2024-01-15 09:00:00
> Total tareas: 1 | Completadas: 0 | En progreso: 1 | Pendientes: 0

---

## TASK-001 [STATUS:in-progress] [ASSIGNED:@vscode]
**Título:** Implementar login
**Descripción:** Crear formulario de login
**Criterios de aceptación:**
- [x] Campo email
- [ ] Campo password
**Dependencias:** Ninguna
**Notas técnicas:**
- Usar react-hook-form
**Completada:** (vacío)

---`;

    const result = parseTasksContent(content);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('TASK-001');
    expect(result.tasks[0].status).toBe('in-progress');
    expect(result.tasks[0].assigned).toBe('@vscode');
    expect(result.tasks[0].title).toBe('Implementar login');
    expect(result.tasks[0].criteria).toHaveLength(2);
    expect(result.tasks[0].criteria[0].done).toBe(true);
    expect(result.tasks[0].criteria[1].done).toBe(false);
  });

  it('should parse multiple tasks', () => {
    const content = `# Backlog

---

## TASK-001 [STATUS:completed] [ASSIGNED:@vscode]
**Título:** Tarea 1
**Descripción:** Desc 1
**Criterios de aceptación:**
- [x] Done
**Dependencias:** Ninguna
**Completada:** 2024-01-15

---

## TASK-002 [STATUS:pending] [ASSIGNED:]
**Título:** Tarea 2
**Descripción:** Desc 2
**Criterios de aceptación:**
- [ ] Todo
**Dependencias:** TASK-001
**Completada:** (vacío)

---`;

    const result = parseTasksContent(content);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].status).toBe('completed');
    expect(result.tasks[1].assigned).toBe('');
    expect(result.tasks[1].dependencies).toBe('TASK-001');
  });

  it('should parse blocked tasks', () => {
    const content = `## TASK-004 [STATUS:blocked] [ASSIGNED:@vscode]
**Título:** Tarea bloqueada
**Descripción:** Esperando algo
**Criterios de aceptación:**
- [ ] Pendiente
**Dependencias:** TASK-003
**Bloqueada desde:** 2024-01-15 10:00:00
**Razón bloqueo:** Esperando API de @copilot
**Completada:** (vacío)`;

    const result = parseTasksContent(content);
    expect(result.tasks[0].status).toBe('blocked');
    expect(result.tasks[0].blockedSince).toBe('2024-01-15 10:00:00');
    expect(result.tasks[0].blockReason).toBe('Esperando API de @copilot');
  });

  it('should parse metadata', () => {
    const content = `# Backlog de Tareas

> Última sincronización: 2024-01-15 09:00:00
> Total tareas: 5 | Completadas: 2 | En progreso: 2 | Pendientes: 1`;

    const result = parseTasksContent(content);
    expect(result.metadata.lastSync).toBe('2024-01-15 09:00:00');
    expect(result.metadata.total).toBe(5);
    expect(result.metadata.completed).toBe(2);
  });
});

describe('getNextTaskId', () => {
  it('should return TASK-001 for empty list', () => {
    expect(getNextTaskId([])).toBe('TASK-001');
  });

  it('should return next sequential ID', () => {
    const tasks = [
      { id: 'TASK-001' },
      { id: 'TASK-003' },
      { id: 'TASK-002' },
    ];
    expect(getNextTaskId(tasks)).toBe('TASK-004');
  });
});

describe('generateTasksContent', () => {
  it('should generate valid markdown', () => {
    const tasks = [
      {
        id: 'TASK-001',
        status: 'pending',
        assigned: '',
        title: 'Test Task',
        description: 'Test description',
        criteria: [{ done: false, text: 'Criterion 1' }],
        dependencies: 'Ninguna',
        notes: '',
        completed: '',
        blockedSince: '',
        blockReason: '',
        githubIssue: null,
      },
    ];

    const content = generateTasksContent(tasks);
    expect(content).toContain('TASK-001');
    expect(content).toContain('[STATUS:pending]');
    expect(content).toContain('Test Task');
    expect(content).toContain('- [ ] Criterion 1');
    expect(content).toContain('Backlog de Tareas');
  });

  it('should roundtrip parse/generate', () => {
    const tasks = [
      {
        id: 'TASK-001',
        status: 'in-progress',
        assigned: '@vscode',
        title: 'Login',
        description: 'Create login',
        criteria: [
          { done: true, text: 'Email field' },
          { done: false, text: 'Password field' },
        ],
        dependencies: 'Ninguna',
        notes: '- Use zod',
        completed: '',
        blockedSince: '',
        blockReason: '',
        githubIssue: null,
      },
    ];

    const content = generateTasksContent(tasks);
    const parsed = parseTasksContent(content);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].id).toBe('TASK-001');
    expect(parsed.tasks[0].title).toBe('Login');
    expect(parsed.tasks[0].criteria).toHaveLength(2);
  });
});

describe('File operations', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parseTasks returns empty for missing file', () => {
    const result = parseTasks(tmpDir);
    expect(result.tasks).toEqual([]);
  });

  it('addTask and findTask work correctly', () => {
    // Write initial empty tasks
    writeTasks(tmpDir, []);

    const task = {
      id: 'TASK-001',
      status: 'pending',
      assigned: '',
      title: 'Test',
      description: 'Testing',
      criteria: [],
      dependencies: 'Ninguna',
      notes: '',
      completed: '',
      blockedSince: '',
      blockReason: '',
      githubIssue: null,
      rawLines: [],
    };

    addTask(tmpDir, task);

    const found = findTask(tmpDir, 'TASK-001');
    expect(found).not.toBeNull();
    expect(found.title).toBe('Test');
  });

  it('updateTask modifies task correctly', () => {
    const task = {
      id: 'TASK-001',
      status: 'pending',
      assigned: '',
      title: 'Test',
      description: 'Testing',
      criteria: [],
      dependencies: 'Ninguna',
      notes: '',
      completed: '',
      blockedSince: '',
      blockReason: '',
      githubIssue: null,
      rawLines: [],
    };
    writeTasks(tmpDir, [task]);

    updateTask(tmpDir, 'TASK-001', { status: 'in-progress', assigned: '@vscode' });
    const updated = findTask(tmpDir, 'TASK-001');
    expect(updated.status).toBe('in-progress');
    expect(updated.assigned).toBe('@vscode');
  });

  it('updateTask throws for missing task', () => {
    writeTasks(tmpDir, []);
    expect(() => updateTask(tmpDir, 'TASK-999', {})).toThrow('no encontrada');
  });
});
