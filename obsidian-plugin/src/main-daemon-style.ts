import { 
  Plugin, 
  Notice, 
  Modal,
  requestUrl,
  addIcon,
  normalizePath,
  PluginSettingTab,
  Setting,
  App,
  WorkspaceLeaf
} from 'obsidian';
import { ClaudeTaskExtractor, TaskExtractionResult } from './claudeExtractor';
import { TaskDashboardView, TASK_DASHBOARD_VIEW_TYPE } from './taskDashboard';

interface MeetingTasksSettings {
  lookbackHours: number;
  debugMode: boolean;
  mcpServerUrl: string;
  anthropicApiKey: string;
  notesFolder: string;
  claudeModel: string;
  dashboardShowOnlyMyTasks: boolean;
  dashboardMyName: string;
  meetingPlatforms: {
    googleMeet: boolean;
    zoom: boolean;
    teams: boolean;
    genericMeeting: boolean;
  };
}

const DEFAULT_SETTINGS: MeetingTasksSettings = {
  lookbackHours: 120,
  debugMode: false,
  mcpServerUrl: 'http://localhost:3002/gmail',  // Updated to daemon Gmail endpoint
  anthropicApiKey: '',
  notesFolder: 'Meetings',
  claudeModel: 'claude-3-5-haiku-20241022',
  dashboardShowOnlyMyTasks: true, // Default to showing only user's tasks
  dashboardMyName: '',
  meetingPlatforms: {
    googleMeet: true,
    zoom: true,
    teams: false,
    genericMeeting: true
  }
};

/**
 * Gmail MCP HTTP Service - connects to the HTTP wrapper
 */
class GmailMcpHttpService {
  private serverUrl: string;
  private connected: boolean = false;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<boolean> {
    console.log(`[GmailService] Attempting to connect to ${this.serverUrl}`);
    try {
      const response = await requestUrl({
        url: `${this.serverUrl}/health`,
        method: 'GET'
      });
      
      this.connected = response.status === 200;
      console.log(`[GmailService] Connection ${this.connected ? 'successful' : 'failed'}`);
      return this.connected;
    } catch (error) {
      console.error('Failed to connect to Gmail MCP service:', error);
      this.connected = false;
      return false;
    }
  }

  async searchEmails(query: string, maxResults: number = 50): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to Gmail MCP service');
    }
    
    try {
      console.log(`[searchEmails] Sending request with query: ${query}`);
      const response = await requestUrl({
        url: `${this.serverUrl}/search`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          maxResults
        })
      });
      
      const data = response.json;
      console.log(`[searchEmails] Response:`, JSON.stringify(data, null, 2));
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.success && data.results) {
        console.log(`[searchEmails] Returning ${data.results.length} emails`);
        return data.results;
      }
      
      console.log(`[searchEmails] No emails in response, returning empty array`);
      return [];
    } catch (error) {
      console.error('[searchEmails] Failed to search emails:', error);
      throw error;
    }
  }
  
  async getEmailContent(emailId: string): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to Gmail MCP service');
    }
    
    try {
      const response = await requestUrl({
        url: `${this.serverUrl}/read`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId: emailId
        })
      });
      
      const data = response.json;
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.success && data.email) {
        // Return the email body if available, otherwise return the whole email object as string
        return data.email.body || JSON.stringify(data.email);
      }
      
      return '';
    } catch (error) {
      console.error('Failed to get email content:', error);
      return '';
    }
  }
  
  /**
   * Identify meeting/transcript emails
   */
  private isMeetingEmail(email: any): boolean {
    const subject = (email.subject || '').toLowerCase();
    const from = (email.from || '').toLowerCase();
    
    // Meeting patterns - same as daemon
    const patterns = [
      // Google Meet
      'gemini-notes@google.com',
      'meet@google.com',
      'recording of',
      'transcript for',
      
      // Zoom
      'noreply@zoom.us',
      'cloud recording',
      
      // General meeting patterns
      'meeting notes',
      'meeting transcript',
      'meeting summary',
      'action items',
      'meeting recap',
      'notes:'
    ];
    
    return patterns.some(pattern => 
      subject.includes(pattern) || from.includes(pattern)
    );
  }
  
  async fetchRecentMeetingEmails(hoursBack: number, platforms?: any): Promise<any[]> {
    // Calculate the date for Gmail query
    const afterDate = new Date();
    afterDate.setTime(afterDate.getTime() - (hoursBack * 60 * 60 * 1000));
    const dateStr = afterDate.toISOString().split('T')[0];
    
    console.log(`[Gmail Search] Looking for emails after ${dateStr} (${hoursBack} hours back)`);
    console.log(`[Gmail Search] Platforms:`, platforms);
    
    // Use focused queries for meeting emails based on selected platforms
    const queries = [];
    
    // Google Meet queries
    if (!platforms || platforms.googleMeet) {
      queries.push(
        `from:gemini-notes@google.com after:${dateStr}`,
        `from:meet@google.com after:${dateStr}`,
        `subject:"Notes:" after:${dateStr}`
      );
    }
    
    // Zoom queries
    if (!platforms || platforms.zoom) {
      queries.push(
        `from:noreply@zoom.us after:${dateStr}`,
        `subject:"Recording of" after:${dateStr}`
      );
    }
    
    // Teams queries
    if (platforms && platforms.teams) {
      queries.push(
        `from:noreply@microsoft.com subject:teams after:${dateStr}`
      );
    }
    
    // Generic meeting queries
    if (!platforms || platforms.genericMeeting) {
      queries.push(
        `subject:"Transcript for" after:${dateStr}`,
        `subject:meeting after:${dateStr}`,
        `subject:transcript after:${dateStr}`,
        `subject:"meeting notes" after:${dateStr}`,
        `subject:"action items" after:${dateStr}`
      );
    }
    
    const allEmails: any[] = [];
    const seenIds = new Set<string>();
    
    for (const query of queries) {
      try {
        console.log(`[Gmail Search] Searching: ${query}`);
        const emails = await this.searchEmails(query, 10);
        console.log(`[Gmail Search] Found ${emails.length} emails for query: ${query}`);
        
        for (const email of emails) {
          console.log(`[Gmail Search] Checking email: ${email.subject} from ${email.from}`);
          // Additional filtering
          if (!seenIds.has(email.id) && this.isMeetingEmail(email)) {
            console.log(`[Gmail Search] ✓ Added email: ${email.subject}`);
            seenIds.add(email.id);
            allEmails.push(email);
          } else if (seenIds.has(email.id)) {
            console.log(`[Gmail Search] ✗ Duplicate email: ${email.subject}`);
          } else {
            console.log(`[Gmail Search] ✗ Not a meeting email: ${email.subject}`);
          }
        }
      } catch (error) {
        console.error(`[Gmail Search] Failed to search: ${query}`, error);
      }
    }
    
    console.log(`[Gmail Search] Total emails found: ${allEmails.length}`);
    return allEmails;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    this.connected = false;
  }
}

/**
 * Main Plugin Class
 */
export default class MeetingTasksPlugin extends Plugin {
  settings: MeetingTasksSettings;
  gmailService: GmailMcpHttpService | null = null;
  claudeExtractor: ClaudeTaskExtractor | null = null;
  private statusBarItem: HTMLElement | null = null;
  processedEmails: Set<string> = new Set();
  
  async onload() {
    console.log('===============================================');
    console.log('Loading Meeting Tasks Plugin (Daemon-Style)...');
    console.log('Plugin version: 1.0.0');
    console.log('===============================================');
    
    // Load all data
    const data = await this.loadData();
    
    // Load settings from data
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    
    // Load processed emails from data
    if (data?.processedEmails) {
      this.processedEmails = new Set(data.processedEmails);
    }
    
    // Add ribbon icon
    addIcon('mail-check', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>');
    
    const ribbonIconEl = this.addRibbonIcon('mail-check', 'Process meeting emails', async () => {
      await this.processEmails();
    });
    
    // Add status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatus('Ready');
    
    // Add commands
    this.addCommand({
      id: 'process-meeting-emails',
      name: 'Process meeting emails and extract tasks',
      callback: async () => {
        await this.processEmails();
      }
    });
    
    this.addCommand({
      id: 'open-task-dashboard',
      name: 'Open task dashboard',
      callback: () => {
        this.openTaskDashboard();
      }
    });
    
    this.addCommand({
      id: 'reset-processed-emails',
      name: 'Reset processed emails',
      callback: async () => {
        await this.resetProcessedEmails();
      }
    });
    
    // Register the task dashboard view
    this.registerView(
      TASK_DASHBOARD_VIEW_TYPE,
      (leaf) => new TaskDashboardView(leaf, this)
    );
    
    // Add dashboard ribbon icon
    this.addRibbonIcon('layout-dashboard', 'Open task dashboard', () => {
      this.openTaskDashboard();
    });
    
    // Add reset ribbon icon
    this.addRibbonIcon('refresh-cw', 'Reset processed emails', async () => {
      await this.resetProcessedEmails();
    });
    
    // Initialize services
    await this.initializeServices();
    
    // Add settings tab
    this.addSettingTab(new MeetingTasksSettingTab(this.app, this));
  }
  
  async initializeServices() {
    try {
      // Initialize Gmail service
      this.gmailService = new GmailMcpHttpService(this.settings.mcpServerUrl);
      const connected = await this.gmailService.connect();
      
      if (connected) {
        this.updateStatus('Gmail connected');
      } else {
        this.updateStatus('Gmail offline');
        new Notice('Gmail MCP not available. Start the daemon with: npm run daemon');
      }
      
      // Initialize Claude extractor if API key is present
      if (this.settings.anthropicApiKey) {
        this.claudeExtractor = new ClaudeTaskExtractor(
          this.settings.anthropicApiKey,
          this.settings.claudeModel
        );
      }
    } catch (error) {
      console.error('Failed to initialize services:', error);
      new Notice(`Error: ${error.message}`);
    }
  }
  
  async processEmails() {
    console.log('[processEmails] Function called - Starting email processing');
    console.log('[processEmails] Settings:', {
      lookbackHours: this.settings.lookbackHours,
      mcpServerUrl: this.settings.mcpServerUrl,
      hasApiKey: !!this.settings.anthropicApiKey,
      processedEmailsCount: this.processedEmails.size
    });
    
    try {
      this.updateStatus('Processing...');
      new Notice('Triggering email processing...');
      
      // Try to trigger the daemon via HTTP with quiet mode
      const daemonUrl = 'http://localhost:3002/trigger';
      try {
        const response = await requestUrl({
          url: daemonUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: 'obsidian-plugin',
            quiet: true,  // Use quiet mode to suppress notifications
            lookbackHours: this.settings.lookbackHours,  // Pass the plugin's lookback setting
            meetingPlatforms: this.settings.meetingPlatforms  // Pass platform preferences
          })
        });
        
        if (response.status === 200) {
          const result = response.json;
          new Notice(`✅ Processed: ${result.emailsProcessed || 0} emails, ${result.tasksExtracted || 0} tasks extracted`);
          this.updateStatus('Processing complete');
          return;
        }
      } catch (daemonError) {
        console.log('Daemon not available, falling back to direct processing');
      }
      
      // Fallback to direct processing if daemon is not available
      // Ensure Gmail is connected
      if (!this.gmailService || !this.gmailService.isConnected()) {
        new Notice('Gmail not connected. Reconnecting...');
        await this.initializeServices();
        
        if (!this.gmailService || !this.gmailService.isConnected()) {
          new Notice('Failed to connect to Gmail MCP');
          return;
        }
      }
      
      new Notice('Searching for meeting emails...');
      
      // Fetch recent meeting emails with platform preferences
      const emails = await this.gmailService.fetchRecentMeetingEmails(
        this.settings.lookbackHours,
        this.settings.meetingPlatforms
      );
      
      if (emails.length === 0) {
        this.updateStatus('No new emails');
        new Notice(`No meeting emails found in the last ${this.settings.lookbackHours} hours`);
        return;
      }
      
      new Notice(`Found ${emails.length} meeting emails. Processing...`);
      
      let notesCreated = 0;
      let totalTasks = 0;
      let highPriorityTasks = 0;
      
      for (const email of emails) {
        // Skip if already processed
        if (this.processedEmails.has(email.id)) {
          continue;
        }
        
        try {
          // Process the email
          const result = await this.processTranscriptEmail(email);
          
          if (result.success) {
            notesCreated++;
            totalTasks += result.taskCount || 0;
            highPriorityTasks += result.highPriorityCount || 0;
            this.processedEmails.add(email.id);
          }
        } catch (error) {
          console.error(`Failed to process email ${email.id}:`, error);
        }
      }
      
      // Save all data including settings and processed emails
      await this.saveData({
        ...this.settings,
        processedEmails: Array.from(this.processedEmails)
      });
      
      // Update status
      this.updateStatus(`Created ${notesCreated} notes`);
      
      // Show detailed notification
      if (notesCreated > 0) {
        let message = `✅ Created ${notesCreated} meeting notes with ${totalTasks} tasks`;
        if (highPriorityTasks > 0) {
          message += ` (${highPriorityTasks} high priority)`;
        }
        new Notice(message);
      } else {
        new Notice('No new meeting notes created (all emails already processed)');
      }
      
    } catch (error) {
      console.error('Error processing emails:', error);
      this.updateStatus('Error');
      new Notice(`Error: ${error.message}`);
    }
  }
  
  /**
   * Process a single transcript email - using daemon approach
   */
  private async processTranscriptEmail(email: any): Promise<{
    success: boolean;
    taskCount?: number;
    highPriorityCount?: number;
    confidence?: number;
    obsidianPath?: string;
  }> {
    try {
      console.log(`Processing email: ${email.subject}`);
      
      // Get full email content
      let emailContent = email.body;
      if (!emailContent && email.id) {
        console.log('Fetching full email content...');
        emailContent = await this.gmailService?.getEmailContent(email.id) || '';
      }
      
      // Ensure emailContent is a string
      if (typeof emailContent === 'object') {
        console.warn('Email content is an object, converting to string:', emailContent);
        emailContent = JSON.stringify(emailContent);
      }
      
      if (!emailContent || emailContent === '{}' || emailContent === '[object Object]') {
        console.warn('No valid email content available');
        return { success: false };
      }
      
      // Extract tasks using Claude (or fallback)
      let extraction: TaskExtractionResult;
      
      if (this.claudeExtractor && this.settings.anthropicApiKey) {
        console.log('Extracting tasks with Claude...');
        extraction = await this.claudeExtractor.extractTasks(emailContent, email.subject);
        console.log(`Extracted ${extraction.tasks.length} tasks with ${extraction.confidence}% confidence`);
      } else {
        console.log('No Claude API key, skipping task extraction');
        // Create minimal extraction result
        extraction = {
          tasks: [],
          summary: email.subject || 'Meeting notes',
          participants: [],
          meetingDate: email.date ? new Date(email.date) : new Date(),
          keyDecisions: [],
          nextSteps: [],
          confidence: 0
        };
      }
      
      // Create Obsidian note
      const noteCreated = await this.createMeetingNote(email, extraction);
      
      if (noteCreated) {
        const highPriorityCount = extraction.tasks.filter(t => t.priority === 'high').length;
        
        return {
          success: true,
          taskCount: extraction.tasks.length,
          highPriorityCount,
          confidence: extraction.confidence,
          obsidianPath: noteCreated
        };
      }
      
      return { success: false };
      
    } catch (error) {
      console.error('Failed to process transcript email:', error);
      return { success: false };
    }
  }
  
  /**
   * Create meeting note in Obsidian - using daemon-style format
   */
  private async createMeetingNote(email: any, extraction: TaskExtractionResult): Promise<string | false> {
    try {
      // Ensure folder exists
      const folderPath = normalizePath(this.settings.notesFolder);
      if (!this.app.vault.getAbstractFileByPath(folderPath)) {
        await this.app.vault.createFolder(folderPath);
      }
      
      // Generate filename
      const date = extraction.meetingDate.toISOString().split('T')[0];
      const subject = (email.subject || 'Meeting').replace(/[\\/:*?"<>|]/g, '-').substring(0, 50);
      const fileName = `${date} - ${subject}.md`;
      const filePath = normalizePath(`${folderPath}/${fileName}`);
      
      // Check if file already exists
      if (this.app.vault.getAbstractFileByPath(filePath)) {
        console.log('Note already exists:', filePath);
        return false;
      }
      
      // Format note content - daemon style
      let noteContent = this.formatMeetingNote(email, extraction);
      
      // Create the note
      await this.app.vault.create(filePath, noteContent);
      console.log('Created note:', filePath);
      
      return filePath;
    } catch (error) {
      console.error('Failed to create note:', error);
      return false;
    }
  }
  
  /**
   * Format meeting note - using daemon's comprehensive format
   */
  private formatMeetingNote(email: any, extraction: TaskExtractionResult): string {
    const date = extraction.meetingDate.toISOString().split('T')[0];
    
    // Frontmatter
    let content = `---
title: ${email.subject || 'Meeting Notes'}
date: ${date}
type: meeting
source: Gmail
emailId: ${email.id}
participants: [${extraction.participants.map(p => `"${p}"`).join(', ')}]
confidence: ${extraction.confidence}
tags: [meeting, ${extraction.tasks.length > 0 ? 'has-tasks' : 'no-tasks'}]
created: ${new Date().toISOString()}
---

# ${email.subject || 'Meeting Notes'}

**Date:** ${extraction.meetingDate.toLocaleDateString()}
**From:** ${email.from || 'Unknown'}
`;

    // Add participants if available
    if (extraction.participants.length > 0) {
      content += `**Participants:** ${extraction.participants.map(p => `[[${p}]]`).join(', ')}\n`;
    }
    
    content += `**Confidence:** ${extraction.confidence}%\n\n`;
    
    // Summary
    if (extraction.summary) {
      content += `## Summary\n${extraction.summary}\n\n`;
    }
    
    // Key Decisions
    if (extraction.keyDecisions.length > 0) {
      content += `## Key Decisions\n`;
      for (const decision of extraction.keyDecisions) {
        content += `- ${decision}\n`;
      }
      content += '\n';
    }
    
    // Action Items with full details
    if (extraction.tasks.length > 0) {
      content += `## Action Items\n\n`;
      
      // Group by priority
      const highPriority = extraction.tasks.filter(t => t.priority === 'high');
      const mediumPriority = extraction.tasks.filter(t => t.priority === 'medium');
      const lowPriority = extraction.tasks.filter(t => t.priority === 'low');
      
      if (highPriority.length > 0) {
        content += `### 🔴 High Priority\n`;
        for (const task of highPriority) {
          content += this.formatTask(task);
        }
        content += '\n';
      }
      
      if (mediumPriority.length > 0) {
        content += `### 🟡 Medium Priority\n`;
        for (const task of mediumPriority) {
          content += this.formatTask(task);
        }
        content += '\n';
      }
      
      if (lowPriority.length > 0) {
        content += `### 🟢 Low Priority\n`;
        for (const task of lowPriority) {
          content += this.formatTask(task);
        }
        content += '\n';
      }
    }
    
    // Next Steps
    if (extraction.nextSteps.length > 0) {
      content += `## Next Steps\n`;
      for (const step of extraction.nextSteps) {
        content += `- ${step}\n`;
      }
      content += '\n';
    }
    
    // Original email preview
    if (email.body) {
      content += `## Original Email\n\`\`\`\n${email.body.substring(0, 1000)}${email.body.length > 1000 ? '...' : ''}\n\`\`\`\n`;
    }
    
    content += `\n---\n*Imported from Gmail on ${new Date().toLocaleString()}*`;
    
    return content;
  }
  
  /**
   * Format individual task with all metadata
   */
  private formatTask(task: any): string {
    const dueDate = task.dueDate || this.getDefaultDueDate();
    let taskLine = `- [ ] ${task.description} [[@${task.assignee}]] 📅 ${dueDate}`;
    
    // Add confidence indicator if low
    if (task.confidence < 70) {
      taskLine += ` ⚠️ ${task.confidence}%`;
    }
    
    // Add category tag
    if (task.category && task.category !== 'other') {
      taskLine += ` #${task.category}`;
    }
    
    taskLine += '\n';
    
    // Add context as sub-item if available
    if (task.context) {
      taskLine += `  - Context: ${task.context}\n`;
    }
    
    // Add raw text as quote if available and different from description
    if (task.rawText && task.rawText !== task.description) {
      taskLine += `  > "${task.rawText}"\n`;
    }
    
    return taskLine;
  }
  
  /**
   * Get default due date (1 week from now)
   */
  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }
  
  updateStatus(status: string) {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`📧 ${status}`);
    }
  }
  
  /**
   * Open the task dashboard view
   */
  async openTaskDashboard() {
    const { workspace } = this.app;
    
    // Check if dashboard is already open
    const leaves = workspace.getLeavesOfType(TASK_DASHBOARD_VIEW_TYPE);
    
    if (leaves.length > 0) {
      // Focus existing dashboard
      workspace.revealLeaf(leaves[0]);
    } else {
      // Create new dashboard
      const leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: TASK_DASHBOARD_VIEW_TYPE,
          active: true
        });
        workspace.revealLeaf(leaf);
      }
    }
  }
  
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }
  
  async saveSettings() {
    // Save all data including settings and processed emails
    await this.saveData({
      ...this.settings,
      processedEmails: Array.from(this.processedEmails)
    });
  }
  
  async resetProcessedEmails() {
    console.log('Reset function called');
    try {
      this.updateStatus('Resetting...');
      
      // Simple confirmation using Obsidian's built-in confirm
      const confirmed = confirm('Reset Processed Emails?\n\nThis will clear all processed email records, allowing them to be processed again.');
      
      if (!confirmed) {
        console.log('User cancelled reset');
        this.updateStatus('Ready');
        return;
      }
      
      console.log('User confirmed reset');
      new Notice('Resetting processed emails...');
      
      // Try to reset via daemon HTTP endpoint
      const daemonUrl = 'http://localhost:3002/reset';
      try {
        console.log('Calling daemon reset endpoint...');
        const response = await requestUrl({
          url: daemonUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'all'  // Reset both emails and stats
          })
        });
        
        console.log('Daemon response:', response.status, response.json);
        
        if (response.status === 200) {
          const result = response.json;
          new Notice(`✅ Reset complete: ${result.details?.emailsDeleted || 0} emails cleared`);
          
          // Also clear local cache
          this.processedEmails.clear();
          await this.saveSettings();
          
          this.updateStatus('Ready');
          return;
        }
      } catch (daemonError) {
        console.error('Daemon reset error:', daemonError);
        console.log('Daemon not available, clearing local cache only');
      }
      
      // Fallback: clear local cache only
      this.processedEmails.clear();
      await this.saveSettings();
      
      new Notice('✅ Local cache cleared. Emails can be processed again.');
      this.updateStatus('Ready');
      
    } catch (error: any) {
      console.error('Reset failed:', error);
      new Notice(`Reset failed: ${error.message}`);
      this.updateStatus('Error');
    }
  }
  
  onunload() {
    console.log('Unloading Meeting Tasks Plugin...');
    
    if (this.gmailService) {
      this.gmailService.disconnect();
    }
  }
}

class MeetingTasksSettingTab extends PluginSettingTab {
  plugin: MeetingTasksPlugin;
  
  constructor(app: App, plugin: MeetingTasksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const {containerEl} = this;
    
    containerEl.empty();
    
    containerEl.createEl('h2', {text: 'Meeting Tasks Settings'});
    
    // Gmail settings
    containerEl.createEl('h3', {text: 'Gmail Settings'});
    
    new Setting(containerEl)
      .setName('Gmail Service URL')
      .setDesc('URL of the daemon Gmail service endpoints')
      .addText(text => text
        .setPlaceholder('http://localhost:3002/gmail')
        .setValue(this.plugin.settings.mcpServerUrl)
        .onChange(async (value) => {
          this.plugin.settings.mcpServerUrl = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Lookback hours')
      .setDesc('How many hours back to search for emails')
      .addText(text => text
        .setPlaceholder('120')
        .setValue(String(this.plugin.settings.lookbackHours))
        .onChange(async (value) => {
          const hours = parseInt(value);
          if (!isNaN(hours) && hours > 0) {
            this.plugin.settings.lookbackHours = hours;
            await this.plugin.saveSettings();
          }
        }));
    
    // Meeting Platforms
    containerEl.createEl('h3', {text: 'Meeting Platforms'});
    containerEl.createEl('p', {text: 'Select which meeting platforms to search for', cls: 'setting-item-description'});
    
    new Setting(containerEl)
      .setName('Google Meet')
      .setDesc('Search for Google Meet recordings and Gemini notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.meetingPlatforms?.googleMeet ?? true)
        .onChange(async (value) => {
          if (!this.plugin.settings.meetingPlatforms) {
            this.plugin.settings.meetingPlatforms = DEFAULT_SETTINGS.meetingPlatforms;
          }
          this.plugin.settings.meetingPlatforms.googleMeet = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Zoom')
      .setDesc('Search for Zoom recordings and transcripts')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.meetingPlatforms?.zoom ?? true)
        .onChange(async (value) => {
          if (!this.plugin.settings.meetingPlatforms) {
            this.plugin.settings.meetingPlatforms = DEFAULT_SETTINGS.meetingPlatforms;
          }
          this.plugin.settings.meetingPlatforms.zoom = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Microsoft Teams')
      .setDesc('Search for Teams meeting recordings')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.meetingPlatforms?.teams ?? false)
        .onChange(async (value) => {
          if (!this.plugin.settings.meetingPlatforms) {
            this.plugin.settings.meetingPlatforms = DEFAULT_SETTINGS.meetingPlatforms;
          }
          this.plugin.settings.meetingPlatforms.teams = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Generic Meeting Emails')
      .setDesc('Search for general meeting/transcript keywords')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.meetingPlatforms?.genericMeeting ?? true)
        .onChange(async (value) => {
          if (!this.plugin.settings.meetingPlatforms) {
            this.plugin.settings.meetingPlatforms = DEFAULT_SETTINGS.meetingPlatforms;
          }
          this.plugin.settings.meetingPlatforms.genericMeeting = value;
          await this.plugin.saveSettings();
        }));
    
    // Claude settings
    containerEl.createEl('h3', {text: 'Claude AI Settings'});
    
    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Your Claude API key for task extraction')
      .addText(text => text
        .setPlaceholder('sk-ant-...')
        .setValue(this.plugin.settings.anthropicApiKey)
        .onChange(async (value) => {
          this.plugin.settings.anthropicApiKey = value;
          await this.plugin.saveSettings();
          
          // Reinitialize Claude service
          if (value) {
            this.plugin.claudeExtractor = new ClaudeTaskExtractor(
              value,
              this.plugin.settings.claudeModel
            );
          }
        }));
    
    new Setting(containerEl)
      .setName('Claude Model')
      .setDesc('Which Claude model to use')
      .addDropdown(dropdown => dropdown
        .addOption('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku (Fast & Cheap)')
        .addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4 (Balanced)')
        .addOption('claude-opus-4-1-20250805', 'Claude Opus 4.1 (Most Capable)')
        .setValue(this.plugin.settings.claudeModel)
        .onChange(async (value) => {
          this.plugin.settings.claudeModel = value;
          await this.plugin.saveSettings();
        }));
    
    // Obsidian settings
    containerEl.createEl('h3', {text: 'Obsidian Settings'});
    
    new Setting(containerEl)
      .setName('Notes folder')
      .setDesc('Where to create meeting notes')
      .addText(text => text
        .setPlaceholder('Meetings')
        .setValue(this.plugin.settings.notesFolder)
        .onChange(async (value) => {
          this.plugin.settings.notesFolder = value;
          await this.plugin.saveSettings();
        }));
    
    // Status
    containerEl.createEl('h3', {text: 'Status'});
    
    const statusDiv = containerEl.createDiv('gmail-status');
    
    const gmailConnected = this.plugin.gmailService?.isConnected() || false;
    const claudeConfigured = !!this.plugin.settings.anthropicApiKey;
    
    statusDiv.createEl('p', {
      text: gmailConnected ? '✅ Gmail service connected' : '❌ Gmail service not connected (start daemon)',
      cls: gmailConnected ? 'mod-success' : 'mod-warning'
    });
    
    statusDiv.createEl('p', {
      text: claudeConfigured ? '✅ Claude AI configured' : '⚠️ Claude AI not configured (tasks won\'t be extracted)',
      cls: claudeConfigured ? 'mod-success' : 'mod-warning'
    });
    
    // Dashboard Settings
    containerEl.createEl('h3', {text: 'Dashboard Settings'});
    
    new Setting(containerEl)
      .setName('Show only my tasks')
      .setDesc('Filter dashboard to show only tasks assigned to you')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.dashboardShowOnlyMyTasks)
        .onChange(async (value) => {
          this.plugin.settings.dashboardShowOnlyMyTasks = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('My name')
      .setDesc('Your name for filtering tasks (e.g., "John", "Sarah")')
      .addText(text => text
        .setPlaceholder('Your name')
        .setValue(this.plugin.settings.dashboardMyName)
        .onChange(async (value) => {
          this.plugin.settings.dashboardMyName = value;
          await this.plugin.saveSettings();
        }));
    
    // Actions
    new Setting(containerEl)
      .setName('Process emails now')
      .setDesc('Search for meeting emails and create notes')
      .addButton(button => button
        .setButtonText('Process')
        .onClick(async () => {
          await this.plugin.processEmails();
        }));
    
    new Setting(containerEl)
      .setName('Reset processed emails')
      .setDesc('Clear the list of already processed emails')
      .addButton(button => button
        .setButtonText('Reset')
        .onClick(async () => {
          this.plugin.processedEmails.clear();
          await this.plugin.saveData({
            ...this.plugin.settings,
            processedEmails: []
          });
          new Notice('Processed emails list cleared');
        }));
  }
}