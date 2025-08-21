import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import { DaemonService } from '../daemon/service';
import * as fs from 'fs';
import * as path from 'path';

export class TUIInterface {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private service: DaemonService;
  private updateInterval: NodeJS.Timeout | null = null;
  
  private statusBox!: blessed.Widgets.BoxElement;
  private statsTable: any;
  private logBox!: blessed.Widgets.Log;
  private errorBox!: blessed.Widgets.BoxElement;
  private scheduleBox!: blessed.Widgets.BoxElement;
  private gauge: any;
  
  constructor(service: DaemonService) {
    this.service = service;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Meeting Transcript Agent - Service Monitor',
      fullUnicode: true,
      forceUnicode: true,
      dockBorders: true,
      ignoreDockContrast: true,
      // Capture all input to prevent leakage
      input: process.stdin,
      output: process.stdout,
      // Prevent external output from corrupting the screen
      warnings: false,
    });
    
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    
    this.createLayout();
    this.setupEventHandlers();
    this.setupServiceListeners();
    this.startUpdates();
  }

  private createLayout(): void {
    this.statusBox = this.grid.set(0, 0, 2, 4, blessed.box, {
      label: ' Service Status ',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
      },
    });
    
    this.gauge = this.grid.set(0, 4, 2, 4, contrib.gauge, {
      label: ' Success Rate ',
      stroke: 'green',
      fill: 'white',
      percent: 0,
    });
    
    this.scheduleBox = this.grid.set(0, 8, 2, 4, blessed.box, {
      label: ' Next Runs ',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
      },
    });
    
    this.statsTable = this.grid.set(2, 0, 4, 6, contrib.table, {
      keys: false,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: ' Statistics ',
      width: '50%',
      height: '30%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 3,
      columnWidth: [25, 20],
    });
    
    this.errorBox = this.grid.set(2, 6, 4, 6, blessed.box, {
      label: ' Recent Errors ',
      border: { type: 'line' },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        border: { fg: 'red' },
        label: { fg: 'red', bold: true },
      },
    });
    
    this.logBox = this.grid.set(6, 0, 5, 12, blessed.log, {
      label: ' Activity Log ',
      border: { type: 'line' },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        border: { fg: 'green' },
        label: { fg: 'green', bold: true },
      },
    });
    
    (blessed as any).listbar({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      mouse: true,
      keys: true,
      style: {
        bg: 'blue',
        item: {
          bg: 'blue',
          fg: 'white',
        },
        selected: {
          bg: 'white',
          fg: 'black',
        },
      },
      items: ['Start (F1)', 'Stop (F2)', 'Process Now (F3)', 'Clear Stats (F4)', 'View Logs (F5)', 'Config (F6)', 'Quit (Q)'],
      autoCommandKeys: true,
    });
    
    // Initialize with empty content
    this.statusBox.setContent('Loading...');
    this.scheduleBox.setContent('Loading...');
    this.errorBox.setContent('No errors');
    this.logBox.log('Meeting Transcript Agent - Starting...');
    
    // Initial table data
    this.statsTable.setData({
      headers: ['Metric', 'Value'],
      data: [
        ['Total Runs', '0'],
        ['Successful', '0'],
        ['Failed', '0'],
        ['Emails', '0'],
        ['Tasks', '0'],
        ['Notes', '0'],
        ['Last Run', 'Never']
      ]
    });
    
    // Initial render to show the layout
    this.screen.render();
  }

  private setupEventHandlers(): void {
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.handleQuit();
    });
    
    this.screen.key(['f1'], () => this.handleStart());
    this.screen.key(['f2'], () => this.handleStop());
    this.screen.key(['f3'], () => this.handleProcessNow());
    this.screen.key(['f4'], () => this.handleClearStats());
    this.screen.key(['f5'], () => this.handleViewLogs());
    this.screen.key(['f6'], () => this.handleConfig());
  }

  private setupServiceListeners(): void {
    this.service.on('statusChanged', (status: string) => {
      this.updateStatus();
      this.log(`Status changed: ${status}`, this.getStatusColor(status));
    });
    
    this.service.on('processingStarted', () => {
      this.log('Email processing started...', 'blue');
    });
    
    this.service.on('processingCompleted', (result: any) => {
      this.log(`Processing completed: ${result.emailsProcessed} emails, ${result.tasksExtracted} tasks`, 'green');
      this.updateStats();
    });
    
    this.service.on('processingFailed', (error: Error) => {
      this.log(`Processing failed: ${error.message}`, 'red');
      this.updateErrors();
    });
    
    this.service.on('started', () => {
      this.log('Service started successfully', 'green');
    });
    
    this.service.on('stopped', () => {
      this.log('Service stopped', 'yellow');
    });
    
    this.service.on('statsCleared', () => {
      this.log('Statistics cleared', 'cyan');
      this.updateStats();
    });
  }

  private startUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateStats();
      this.updateSchedule();
      this.screen.render();
    }, 1000);
  }

  private updateStatus(): void {
    const stats = this.service.getStats();
    
    this.statusBox.setContent(`Status: ${stats.status.toUpperCase()}\nUptime: ${this.formatUptime(stats.startTime)}`);
    this.screen.render();
  }

  private updateStats(): void {
    const stats = this.service.getStats();
    
    const successRate = stats.totalRuns > 0 
      ? Math.round((stats.successfulRuns / stats.totalRuns) * 100)
      : 0;
    
    if (this.gauge && this.gauge.setPercent) {
      this.gauge.setPercent(successRate);
    }
    
    const tableData = {
      headers: ['Metric', 'Value'],
      data: [
        ['Total Runs', stats.totalRuns.toString()],
        ['Successful', stats.successfulRuns.toString()],
        ['Failed', stats.failedRuns.toString()],
        ['Emails Processed', stats.emailsProcessed.toString()],
        ['Tasks Extracted', stats.tasksExtracted.toString()],
        ['Notes Created', stats.notesCreated.toString()],
        ['Last Run', stats.lastRun ? this.formatTime(stats.lastRun) : 'Never'],
      ]
    };
    
    if (this.statsTable && this.statsTable.setData) {
      this.statsTable.setData(tableData);
    }
    this.screen.render();
  }

  private updateSchedule(): void {
    const stats = this.service.getStats();
    const nextRuns = this.service.getNextScheduledRuns();
    
    let scheduleText = '';
    if (stats.status === 'stopped') {
      scheduleText = 'Service is stopped';
    } else if (nextRuns.length > 0) {
      scheduleText = 'Next scheduled runs:\n';
      nextRuns.slice(0, 3).forEach(run => {
        scheduleText += `• ${this.formatTime(run)}\n`;
      });
    } else {
      scheduleText = 'No scheduled runs';
    }
    
    this.scheduleBox.setContent(scheduleText);
    this.screen.render();
  }

  private updateErrors(): void {
    const stats = this.service.getStats();
    
    if (stats.errors.length === 0) {
      this.errorBox.setContent('No errors');
    } else {
      let errorText = '';
      stats.errors.forEach(error => {
        errorText += `• ${error}\n`;
      });
      this.errorBox.setContent(errorText);
    }
    
    this.screen.render();
  }

  private log(message: string, _color = 'white'): void {
    const timestamp = new Date().toLocaleTimeString();
    this.logBox.log(`[${timestamp}] ${message}`);
    this.screen.render();
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'green';
      case 'stopped': return 'yellow';
      case 'processing': return 'blue';
      case 'error': return 'red';
      default: return 'white';
    }
  }

  private formatUptime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  private formatTime(date: Date): string {
    return date.toLocaleString();
  }

  private async handleStart(): Promise<void> {
    const stats = this.service.getStats();
    if (stats.status === 'running') {
      this.log('Service is already running', 'yellow');
      return;
    }
    
    try {
      await this.service.start();
    } catch (error) {
      this.log(`Failed to start service: ${error}`, 'red');
    }
  }

  private async handleStop(): Promise<void> {
    const stats = this.service.getStats();
    if (stats.status === 'stopped') {
      this.log('Service is already stopped', 'yellow');
      return;
    }
    
    try {
      await this.service.stop();
    } catch (error) {
      this.log(`Failed to stop service: ${error}`, 'red');
    }
  }

  private async handleProcessNow(): Promise<void> {
    const stats = this.service.getStats();
    if (stats.status === 'processing') {
      this.log('Already processing emails', 'yellow');
      return;
    }
    
    this.log('Starting manual email processing...', 'blue');
    try {
      await this.service.processEmails(true);
    } catch (error) {
      this.log(`Manual processing failed: ${error}`, 'red');
    }
  }

  private handleClearStats(): void {
    const confirm = blessed.question({
      parent: this.screen,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ' Confirm ',
      tags: true,
      keys: true,
      vi: true,
    });
    
    confirm.ask('Clear all statistics? (y/n)', (_err: any, value: string | null) => {
      if (value && typeof value === 'string' && value.toLowerCase() === 'y') {
        this.service.clearStats();
        this.log('Statistics cleared', 'cyan');
      }
      this.screen.render();
    });
  }

  private handleViewLogs(): void {
    const logPath = path.join(process.cwd(), 'logs', 'app.log');
    
    if (!fs.existsSync(logPath)) {
      this.log('Log file not found', 'red');
      return;
    }
    
    const logViewer = blessed.box({
      parent: this.screen,
      label: ' Application Logs (ESC to close) ',
      border: 'line',
      top: 'center',
      left: 'center',
      width: '90%',
      height: '80%',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
        focus: {
          border: { fg: 'yellow' },
        },
      },
      tags: true,
    });
    
    try {
      const logs = fs.readFileSync(logPath, 'utf-8');
      const lines = logs.split('\n').filter(line => line.trim());
      
      // Parse and format JSON logs for better readability
      const formattedLogs = lines.slice(-50).map(line => {
        try {
          const log = JSON.parse(line);
          const time = log.timestamp?.split(' ')[1] || '';
          const level = log.level?.toUpperCase() || 'INFO';
          const msg = log.message || '';
          return `[${time}] [${level}] ${msg}`;
        } catch {
          // If not JSON, clean any control characters
          return line.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        }
      }).join('\n');
      
      logViewer.setContent(formattedLogs || 'No logs available');
    } catch (error) {
      logViewer.setContent(`Error reading logs: ${error}`);
    }
    
    logViewer.key(['escape', 'q'], () => {
      logViewer.detach();
      logViewer.destroy();
      this.statusBox.focus();
      this.screen.render();
    });
    
    logViewer.focus();
    this.screen.render();
  }

  private handleConfig(): void {
    const configPath = path.join(process.cwd(), '.env');
    
    const configEditor = blessed.textarea({
      parent: this.screen,
      label: ' Configuration (Ctrl+S to save, ESC to cancel) ',
      border: 'line',
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      scrollable: true,
      mouse: true,
      keys: true,
      vi: false,
      style: {
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
      },
    });
    
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      configEditor.setValue(configContent);
    } catch (error) {
      configEditor.setValue(`# Error reading config: ${error}\n# Create a new .env file`);
    }
    
    configEditor.key(['C-s'], () => {
      try {
        fs.writeFileSync(configPath, configEditor.getValue());
        this.log('Configuration saved', 'green');
        configEditor.detach();
        configEditor.destroy();
        this.statusBox.focus();
        this.screen.render();
      } catch (error) {
        this.log(`Failed to save configuration: ${error}`, 'red');
      }
    });
    
    configEditor.key(['escape'], () => {
      configEditor.detach();
      configEditor.destroy();
      this.statusBox.focus();
      this.screen.render();
    });
    
    configEditor.focus();
    this.screen.render();
  }

  private handleQuit(): void {
    // Use a simple box with text instead of question widget which might be broken
    const confirmBox = blessed.box({
      parent: this.screen,
      border: 'line',
      height: 7,
      width: 50,
      top: 'center',
      left: 'center',
      label: ' Confirm Exit ',
      content: '\n  Quit the TUI? Service will continue running.\n\n  Press Y to quit, N to cancel',
      tags: true,
      style: {
        border: { fg: 'yellow' },
        label: { fg: 'yellow', bold: true },
      },
    });
    
    const handleKey = (ch: string, key: any) => {
      if (ch === 'y' || ch === 'Y') {
        // Unregister individual keys
        this.screen.unkey('y', handleKey);
        this.screen.unkey('Y', handleKey);
        this.screen.unkey('n', handleKey);
        this.screen.unkey('N', handleKey);
        this.screen.unkey('escape', handleKey);
        this.cleanup();
        process.exit(0);
      } else if (ch === 'n' || ch === 'N' || key.name === 'escape') {
        // Unregister individual keys
        this.screen.unkey('y', handleKey);
        this.screen.unkey('Y', handleKey);
        this.screen.unkey('n', handleKey);
        this.screen.unkey('N', handleKey);
        this.screen.unkey('escape', handleKey);
        confirmBox.detach();
        confirmBox.destroy();
        this.statusBox.focus();
        this.screen.render();
      }
    };
    
    this.screen.key(['y', 'Y', 'n', 'N', 'escape'], handleKey);
    confirmBox.focus();
    this.screen.render();
  }

  private cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.service.removeAllListeners();
    
    // Restore terminal state
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    
    // Clear and destroy screen properly
    this.screen.destroy();
  }

  public start(): void {
    // Set raw mode to capture all keyboard input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    // Force initial render
    this.updateStatus();
    this.updateStats();
    this.updateSchedule();
    this.updateErrors();
    
    // Set initial focus
    this.statusBox.focus();
    this.screen.render();
  }
}