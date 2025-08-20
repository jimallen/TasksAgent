import { spawn, SpawnOptions } from 'child_process';
import { logDebug } from './logger';

/**
 * Spawn a subprocess with output suppression in TUI mode
 */
export function spawnQuiet(command: string, args: string[], options: SpawnOptions = {}) {
  const spawnOptions: SpawnOptions = {
    ...options,
    stdio: process.env['TUI_MODE'] ? ['pipe', 'ignore', 'ignore'] : 'pipe',
  };

  if (process.env['TUI_MODE']) {
    // Add environment variables to suppress output
    spawnOptions.env = {
      ...process.env,
      ...options.env,
      NODE_NO_WARNINGS: '1',
      NPM_CONFIG_LOGLEVEL: 'silent',
      NPM_CONFIG_PROGRESS: 'false',
      CI: 'true', // Many tools respect CI environment variable for quiet output
    };
  }

  logDebug(`Spawning subprocess: ${command} ${args.join(' ')}`);
  return spawn(command, args, spawnOptions);
}