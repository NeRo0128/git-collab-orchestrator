// Configuration manager for gco
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE, DEFAULT_CONFIG, GCO_DIR } from './constants.js';

/**
 * Find the project root by looking for .gco directory
 */
export function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, GCO_DIR))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Ensure we're in a gco project
 */
export function ensureProject() {
  const root = findProjectRoot();
  if (!root) {
    throw new Error(
      'No se encontró un proyecto gco. Ejecuta "gco init" primero.'
    );
  }
  return root;
}

/**
 * Load configuration from .gco/config.json
 */
export function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  return deepMerge(DEFAULT_CONFIG, config);
}

/**
 * Save configuration to .gco/config.json
 */
export function saveConfig(projectRoot, config) {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Get a nested config value by dot-separated key
 */
export function getConfigValue(config, key) {
  const parts = key.split('.');
  let current = config;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set a nested config value by dot-separated key
 */
export function setConfigValue(config, key, value) {
  const parts = key.split('.');
  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  // Try to parse booleans and numbers
  if (value === 'true') value = true;
  else if (value === 'false') value = false;
  else if (!isNaN(value) && value !== '') value = Number(value);

  current[parts[parts.length - 1]] = value;
  return config;
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
