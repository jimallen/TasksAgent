import { spawn, ChildProcess } from 'child_process';
import { Readable, Writable } from 'stream';
import { createWriteStream } from 'fs';

/**
 * Custom MCP transport that completely isolates subprocess output
 */
export class SilentMCPTransport {
  private process: ChildProcess | null = null;
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  
  constructor(command: string, args: string[]) {
    this.command = command;
    this.args = args;
    this.env = {
      ...process.env,
      NODE_NO_WARNINGS: '1',
      NPM_CONFIG_LOGLEVEL: 'silent',
      NPM_CONFIG_PROGRESS: 'false',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      CI: 'true',
    };
  }
  
  async start(): Promise<{ stdin: Writable; stdout: Readable }> {
    // Create null streams for stderr
    const nullStream = createWriteStream('/dev/null');
    
    // Spawn the process with complete isolation
    this.process = spawn(this.command, this.args, {
      env: this.env,
      stdio: ['pipe', 'pipe', nullStream],
      detached: false,
      shell: false,
    });
    
    if (!this.process.stdin || !this.process.stdout) {
      throw new Error('Failed to create process streams');
    }
    
    // Return the stdio streams for MCP communication
    return {
      stdin: this.process.stdin,
      stdout: this.process.stdout,
    };
  }
  
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}