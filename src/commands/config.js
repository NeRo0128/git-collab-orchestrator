// gco config command
import chalk from 'chalk';
import { ensureProject, loadConfig, saveConfig, getConfigValue, setConfigValue } from '../config.js';
import { printHeader, success, error, info } from '../format.js';

export function registerConfigCommand(program) {
  const configCmd = program.command('config').description('Gestión de configuración');

  // gco config set <key> <value>
  configCmd
    .command('set <key> <value>')
    .description('Establecer un valor de configuración')
    .action((key, value) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      setConfigValue(config, key, value);
      saveConfig(projectRoot, config);
      success(`${key} = ${value}`);
    });

  // gco config get <key>
  configCmd
    .command('get <key>')
    .description('Obtener un valor de configuración')
    .action((key) => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      const value = getConfigValue(config, key);
      if (value === undefined) {
        error(`Clave no encontrada: ${key}`);
      } else if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    });

  // gco config list
  configCmd
    .command('list')
    .description('Mostrar toda la configuración')
    .action(() => {
      const projectRoot = ensureProject();
      const config = loadConfig(projectRoot);
      printHeader('Configuración');
      console.log(JSON.stringify(config, null, 2));
    });

  // Also handle: gco config <key> <value> (shortcut for set)
  // This is handled by allowing config to receive positional args
  configCmd
    .argument('[key]', 'Clave de configuración (shortcut para set)')
    .argument('[value]', 'Valor (shortcut para set)')
    .action((key, value) => {
      if (!key) {
        // Show full config
        const projectRoot = ensureProject();
        const config = loadConfig(projectRoot);
        printHeader('Configuración');
        console.log(JSON.stringify(config, null, 2));
        return;
      }
      if (key && !value) {
        // Get value
        const projectRoot = ensureProject();
        const config = loadConfig(projectRoot);
        const val = getConfigValue(config, key);
        if (val === undefined) {
          error(`Clave no encontrada: ${key}`);
        } else if (typeof val === 'object') {
          console.log(JSON.stringify(val, null, 2));
        } else {
          console.log(val);
        }
        return;
      }
      if (key && value) {
        // Set value
        const projectRoot = ensureProject();
        const config = loadConfig(projectRoot);
        setConfigValue(config, key, value);
        saveConfig(projectRoot, config);
        success(`${key} = ${value}`);
      }
    });
}
