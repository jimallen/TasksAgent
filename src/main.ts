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
  TFile,
} from 'obsidian';
import { ClaudeTaskExtractor, TaskExtractionResult } from './claudeExtractor';
import { TaskDashboardView, TASK_DASHBOARD_VIEW_TYPE } from './taskDashboard';
import { GmailService, GmailMessage } from './gmailService';
import { OAuthServer } from './oauthServer';
import { processorRegistry, LabelProcessorConfig } from './emailProcessors';

interface MeetingTasksSettings {
  lookbackTime: string;
  debugMode: boolean;
  anthropicApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  claudeModel: string;
  dashboardShowOnlyMyTasks: boolean;
  dashboardMyName: string;
  gmailLabels: string; // Comma-separated labels to search
  emailNotesFolder: string; // Base folder for all email notes (e.g., "EmailNotes")
  labelProcessors: LabelProcessorConfig[]; // Configuration for each label's processor
  gmailToken?: any;
  showDetailedNotifications: boolean;
  processedEmails?: string[]; // Track which emails have been processed
}

const DEFAULT_SETTINGS: MeetingTasksSettings = {
  lookbackTime: '5d',
  debugMode: false,
  anthropicApiKey: '',
  googleClientId: '',
  googleClientSecret: '',
  claudeModel: 'claude-3-5-haiku-20241022',
  dashboardShowOnlyMyTasks: true,
  dashboardMyName: '',
  gmailLabels: 'transcript, action',
  emailNotesFolder: 'TaskAgent',
  labelProcessors: [
    {
      label: 'transcript',
      folderName: 'Transcript',
      promptType: 'meeting',
    },
    {
      label: 'action',
      folderName: 'Action',
      promptType: 'actionitem',
    },
  ],
  gmailToken: null,
  showDetailedNotifications: true,
};

export default class MeetingTasksPlugin extends Plugin {
  settings: MeetingTasksSettings;
  gmailService: GmailService | null = null;
  claudeExtractor: ClaudeTaskExtractor | null = null;
  oauthServer: OAuthServer | null = null;
  private statusBarItem: HTMLElement | null = null;
  private emailIdCache: Set<string> = new Set(); // Cache for performance

  parseTimeToHours(timeStr: string): number {
    // Parse formats like "1h", "3d", "2w", "1M"
    const match = timeStr.match(/^(\d+(?:\.\d+)?)\s*([hdwM]?)$/);

    if (!match) {
      // If no unit, default to hours
      const num = parseFloat(timeStr);
      return isNaN(num) ? 120 : num;
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'h';

    switch (unit) {
      case 'h': return value;
      case 'd': return value * 24;
      case 'w': return value * 24 * 7;
      case 'M': return value * 24 * 30; // Approximate month as 30 days
      default: return value;
    }
  }

  formatTimeString(hours: number): string {
    // Convert hours back to a readable format
    if (hours < 24) {
      return `${hours}h`;
    } else if (hours < 24 * 7) {
      const days = Math.round(hours / 24);
      return `${days}d`;
    } else if (hours < 24 * 30) {
      const weeks = Math.round(hours / (24 * 7));
      return `${weeks}w`;
    } else {
      const months = Math.round(hours / (24 * 30));
      return `${months}M`;
    }
  }

  async loadEmailIdCache() {
    // Load all email IDs from existing notes in base email folder
    console.log('[LoadCache] Starting to load email IDs from vault notes...');
    this.emailIdCache.clear();

    const files = this.app.vault.getMarkdownFiles();
    console.log(`[LoadCache] Found ${files.length} total markdown files in vault`);

    const baseFolder = this.settings.emailNotesFolder;
    console.log(`[LoadCache] Scanning base folder: ${baseFolder}`);

    let emailNoteCount = 0;
    let emailIdCount = 0;

    for (const file of files) {
      // Only check files in base email notes folder
      if (!file.path.startsWith(baseFolder)) {
        continue;
      }

      emailNoteCount++;

      try {
        const content = await this.app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (frontmatterMatch) {
          const emailIdMatch = frontmatterMatch[1].match(/emailId:\s*(.+)/);
          if (emailIdMatch && emailIdMatch[1]) {
            const emailId = emailIdMatch[1].trim();
            this.emailIdCache.add(emailId);
            emailIdCount++;
            console.log(`[LoadCache] Found emailId: ${emailId} in ${file.path}`);
          }
        }
      } catch (error) {
        console.error(`[LoadCache] Error reading file ${file.path}:`, error);
      }
    }

    console.log(`[LoadCache] Scanned ${emailNoteCount} email notes, found ${emailIdCount} email IDs`);
    console.log(`[LoadCache] Cache now contains ${this.emailIdCache.size} unique email IDs`);

    // Update settings with the loaded email IDs
    this.settings.processedEmails = Array.from(this.emailIdCache);
    await this.saveSettings();
    console.log(`[LoadCache] Saved ${this.settings.processedEmails.length} email IDs to settings`);
  }

  async onload() {
    console.log('===============================================');
    console.log('Loading Meeting Tasks Plugin...');
    console.log('Plugin version: 2.0.0');
    console.log('===============================================');

    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // Initialize label processors from configuration
    if (this.settings.labelProcessors && this.settings.labelProcessors.length > 0) {
      processorRegistry.initializeFromConfig(this.settings.labelProcessors);
      console.log(`[Plugin] Initialized ${this.settings.labelProcessors.length} label processors`);
    } else {
      console.warn('[Plugin] No label processors configured, using defaults');
    }

    // Initialize cache from settings first (for quick access)
    if (this.settings.processedEmails) {
      this.settings.processedEmails.forEach(id => this.emailIdCache.add(id));
      console.log(`[Plugin] Loaded ${this.emailIdCache.size} email IDs from settings`);
    }

    // Defer loading from vault until workspace is ready
    this.app.workspace.onLayoutReady(async () => {
      // Load cache of existing email IDs from vault (will update settings)
      await this.loadEmailIdCache();
      console.log(`[Plugin] Found ${this.emailIdCache.size} existing meeting notes in vault`);
    });

    // Register delete event handler for email notes
    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if (file instanceof TFile && file.extension === 'md' && file.path.startsWith(this.settings.emailNotesFolder)) {
          console.log(`[Delete] Email note deleted: ${file.path}`);

          // Try to extract email ID from the deleted file's cache
          const cache = this.app.metadataCache.getFileCache(file);
          if (cache?.frontmatter?.emailId) {
            const emailId = cache.frontmatter.emailId;
            console.log(`[Delete] Removing emailId from cache: ${emailId}`);

            // Remove from cache
            this.emailIdCache.delete(emailId);

            // Update settings
            this.settings.processedEmails = Array.from(this.emailIdCache);
            await this.saveSettings();

            console.log(`[Delete] Updated cache, now contains ${this.emailIdCache.size} email IDs`);
          }
        }
      })
    );

    // Register rename event handler to track moved files
    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          // Check if file moved in/out of email notes folder
          const wasInEmailFolder = oldPath.startsWith(this.settings.emailNotesFolder);
          const nowInEmailFolder = file.path.startsWith(this.settings.emailNotesFolder);

          if (wasInEmailFolder && !nowInEmailFolder) {
            // File moved out of email notes folder - remove from cache
            console.log(`[Rename] File moved out of email notes folder: ${oldPath} -> ${file.path}`);
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.emailId) {
              const emailId = cache.frontmatter.emailId;
              console.log(`[Rename] Removing emailId from cache: ${emailId}`);

              this.emailIdCache.delete(emailId);
              this.settings.processedEmails = Array.from(this.emailIdCache);
              await this.saveSettings();
              console.log(`[Rename] Cache updated, now contains ${this.emailIdCache.size} email IDs`);
            } else {
              console.log(`[Rename] File has no emailId in frontmatter, skipping cache update`);
            }
          } else if (!wasInEmailFolder && nowInEmailFolder) {
            // File moved into email notes folder - add to cache if it has an emailId
            console.log(`[Rename] File moved into email notes folder: ${oldPath} -> ${file.path}`);

            // Wait a moment for metadata cache to update
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try metadata cache first (more reliable)
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.emailId) {
              const emailId = cache.frontmatter.emailId;
              console.log(`[Rename] Adding emailId to cache: ${emailId}`);

              this.emailIdCache.add(emailId);
              this.settings.processedEmails = Array.from(this.emailIdCache);
              await this.saveSettings();
              console.log(`[Rename] Cache updated, now contains ${this.emailIdCache.size} email IDs`);
            } else {
              // Fallback to reading file content if cache not available
              try {
                const content = await this.app.vault.read(file);
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

                if (frontmatterMatch) {
                  const emailIdMatch = frontmatterMatch[1].match(/emailId:\s*(.+)/);
                  if (emailIdMatch && emailIdMatch[1]) {
                    const emailId = emailIdMatch[1].trim();
                    console.log(`[Rename] Adding emailId to cache (from file content): ${emailId}`);

                    this.emailIdCache.add(emailId);
                    this.settings.processedEmails = Array.from(this.emailIdCache);
                    await this.saveSettings();
                    console.log(`[Rename] Cache updated, now contains ${this.emailIdCache.size} email IDs`);
                  } else {
                    console.log(`[Rename] File has no emailId in frontmatter, not adding to cache`);
                  }
                } else {
                  console.log(`[Rename] File has no frontmatter, not adding to cache`);
                }
              } catch (error) {
                console.error(`[Rename] Error reading file content:`, error);
              }
            }
          }
        }
      })
    );

    // Register protocol handler for reprocessing emails
    this.registerObsidianProtocolHandler('meeting-tasks-reprocess', async (params) => {
      if (params.id) {
        await this.reprocessEmailById(params.id, true);
      }
    });

    // Register protocol handler for OAuth callback
    this.registerObsidianProtocolHandler('meeting-tasks-oauth', async (params) => {
      if (params.code) {
        try {
          if (!this.gmailService) {
            new Notice('Gmail service not initialized');
            return;
          }

          await this.gmailService.exchangeCodeForToken(params.code);
          new Notice('✅ Successfully authenticated with Gmail!');
          await this.initializeServices();

          // Update any open settings tabs
          this.app.workspace.trigger('meeting-tasks:auth-complete');
        } catch (error) {
          new Notice(`Authentication failed: ${error.message}`);
          console.error('OAuth callback error:', error);
        }
      } else if (params.error) {
        new Notice(`Authentication failed: ${params.error}`);
      }
    });

    addIcon(
      'mail-check',
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>'
    );

    const ribbonIconEl = this.addRibbonIcon('mail-check', 'Process meeting emails', async () => {
      await this.processEmails();
    });

    this.statusBarItem = this.addStatusBarItem();
    this.updateStatus('Ready');

    this.addCommand({
      id: 'process-meeting-emails',
      name: '📧 Process meeting emails now',
      callback: async () => {
        await this.processEmails();
      },
      hotkeys: [
        {
          modifiers: ['Mod', 'Shift'],
          key: 'M',
        },
      ],
    });

    this.addCommand({
      id: 'open-task-dashboard',
      name: 'Open task dashboard',
      callback: () => {
        this.openTaskDashboard();
      },
    });

    this.addCommand({
      id: 'quick-process-emails',
      name: '⚡ Quick process (last 24 hours)',
      callback: async () => {
        const originalLookback = this.settings.lookbackTime;
        this.settings.lookbackTime = '24h';
        await this.processEmails();
        this.settings.lookbackTime = originalLookback;
      },
    });

    this.addCommand({
      id: 'reset-processed-emails',
      name: 'Reset processed emails',
      callback: async () => {
        await this.resetProcessedEmails();
      },
    });

    this.addCommand({
      id: 'reprocess-meeting-note',
      name: '🔄 Reprocess current meeting note',
      callback: async () => {
        await this.reprocessCurrentMeetingNote();
      },
    });

    this.addCommand({
      id: 'reprocess-email-by-id',
      name: '📧 Reprocess email by ID',
      callback: async () => {
        // For now, let's reprocess the specific email we're testing
        await this.reprocessEmailById('1995cbb7415c015f');
      },
    });

    this.registerView(TASK_DASHBOARD_VIEW_TYPE, leaf => new TaskDashboardView(leaf, this));

    this.addRibbonIcon('layout-dashboard', 'Open task dashboard', () => {
      this.openTaskDashboard();
    });

    await this.initializeServices();

    this.addSettingTab(new MeetingTasksSettingTab(this.app, this));
  }

  async initializeServices() {
    try {
      this.gmailService = new GmailService(
        () => this.settings.gmailToken,
        async (token) => {
          this.settings.gmailToken = token;
          await this.saveSettings();
        }
      );

      if (this.settings.googleClientId && this.settings.googleClientSecret) {
        this.gmailService.setCredentials(
          this.settings.googleClientId,
          this.settings.googleClientSecret
        );

        if (this.gmailService.isAuthenticated()) {
          const connected = await this.gmailService.testConnection();
          if (connected) {
            this.updateStatus('Gmail connected');
          } else {
            this.updateStatus('Gmail auth needed');
          }
        } else {
          this.updateStatus('Gmail not authenticated');
        }
      } else {
        this.updateStatus('Gmail setup needed');
      }

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
    console.log('[processEmails] Starting email processing');

    try {
      this.updateStatus('🔄 Starting email processing...');
      new Notice('📧 Starting email processing...');

      // Ensure cache is loaded from vault
      if (this.emailIdCache.size === 0 && this.app.vault.getMarkdownFiles().length > 0) {
        console.log('[processEmails] Cache empty, loading from vault...');
        await this.loadEmailIdCache();
      }

      if (!this.gmailService) {
        this.updateStatus('❌ Gmail service not initialized');
        new Notice('Gmail service not initialized');
        return;
      }

      if (!this.gmailService.isAuthenticated()) {
        this.updateStatus('❌ Not authenticated');
        new Notice('Please authenticate with Gmail first (see plugin settings)');
        return;
      }

      const lookbackHours = this.parseTimeToHours(this.settings.lookbackTime);

      this.updateStatus(`🔍 Searching emails (${this.settings.lookbackTime})...`);
      new Notice(
        `🔄 Searching for meeting emails from the last ${this.settings.lookbackTime}...`
      );

      const emails = await this.gmailService.fetchRecentMeetingEmails(
        lookbackHours,
        this.settings.gmailLabels
      );

      if (emails.length === 0) {
        this.updateStatus('✅ No new emails found');
        new Notice(`✅ No meeting emails found in the last ${this.settings.lookbackTime}`);
        return;
      }

      this.updateStatus(`📊 Found ${emails.length} emails`);
      new Notice(`📊 Found ${emails.length} meeting emails. Processing...`);

      // Log email order to confirm newest first
      if (emails.length > 0) {
        console.log(`[Process] Emails sorted by date (newest first):`);
        emails.slice(0, 5).forEach((email, idx) => {
          console.log(`[Process]   ${idx + 1}. ${email.date} - ${email.subject?.substring(0, 50) || 'No subject'}`);
        });
        if (emails.length > 5) {
          console.log(`[Process]   ... and ${emails.length - 5} more emails`);
        }
      }

      let notesCreated = 0;
      let totalTasks = 0;
      let highPriorityTasks = 0;
      let processedCount = 0;
      let skippedCount = 0;

      console.log(`[Process] Cache contains ${this.emailIdCache.size} processed email IDs`);
      console.log(`[Process] First 5 cache entries:`, Array.from(this.emailIdCache).slice(0, 5));

      const emailsToProcess = emails.filter(email => {
        if (this.emailIdCache.has(email.id)) {
          skippedCount++;
          console.log(`[Process] Skipping already processed email: ${email.id} - "${email.subject}"`);
          return false;
        }
        console.log(`[Process] Will process new email: ${email.id} - "${email.subject}"`);
        return true;
      });

      console.log(`[Process] Processing ${emailsToProcess.length} new emails (${skippedCount} skipped)`);

      const batchSize = 3;
      const totalBatches = Math.ceil(emailsToProcess.length / batchSize);
      console.log(`[Process] Will process in ${totalBatches} batches of up to ${batchSize} emails each`);

      for (let i = 0; i < emailsToProcess.length; i += batchSize) {
        const batch = emailsToProcess.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        const batchTitles = batch.map(e => e.subject || 'Untitled').join(', ');
        const statusMsg = this.settings.showDetailedNotifications
          ? `📝 Processing: ${batchTitles.substring(0, 50)}${batchTitles.length > 50 ? '...' : ''}`
          : `📝 Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)...`;
        this.updateStatus(statusMsg);

        console.log(`\n[Process] === Starting Batch ${batchNum}/${totalBatches} ===`);
        console.log(`[Process] Batch contains ${batch.length} emails:`);
        batch.forEach((email, idx) => {
          console.log(`[Process]   ${idx + 1}. ${email.subject || 'No subject'} (ID: ${email.id})`);
        });

        const startTime = Date.now();
        console.log(`[Process] Starting parallel processing at ${new Date(startTime).toISOString()}`);

        const batchPromises = batch.map(async (email, idx) => {
          const emailStartTime = Date.now();
          console.log(`[Process] Starting email ${idx + 1}/${batch.length}: ${email.id}`);

          try {
            console.log(`[Process] Email ${email.id} has searchedLabels:`, email.searchedLabels);

            // Get appropriate processor for this email
            const processor = processorRegistry.getProcessor(email);

            if (!processor) {
              console.warn(`[Process] No processor found for email ${email.id} with labels:`, email.searchedLabels);
              return null;
            }

            console.log(`[Process] Using processor: ${processor.label} -> ${processor.folderName}`);

            // Create processing context
            const context = {
              app: this.app,
              claudeExtractor: this.claudeExtractor,
              anthropicApiKey: this.settings.anthropicApiKey,
              emailIdCache: this.emailIdCache,
              emailNotesFolder: this.settings.emailNotesFolder,
              saveSettings: async () => {
                this.settings.processedEmails = Array.from(this.emailIdCache);
                await this.saveSettings();
              },
            };

            // Process email using the selected processor
            const result = await processor.process(email, context);
            const elapsed = Date.now() - emailStartTime;

            if (result.success) {
              const successMsg = this.settings.showDetailedNotifications && result.emailTitle
                ? `[Process] ✅ [${processor.folderName}] "${result.emailTitle}" succeeded in ${elapsed}ms (${result.taskCount} tasks, ${result.confidence}% confidence)`
                : `[Process] ✅ [${processor.folderName}] Email ${idx + 1} succeeded in ${elapsed}ms (${result.taskCount} tasks, ${result.confidence}% confidence)`;
              console.log(successMsg);
              return result;
            } else {
              const failMsg = this.settings.showDetailedNotifications && email.subject
                ? `[Process] ❌ "${email.subject.substring(0, 50)}" failed in ${elapsed}ms`
                : `[Process] ❌ Email ${idx + 1} failed in ${elapsed}ms`;
              console.log(failMsg);
              return null;
            }
          } catch (error) {
            const elapsed = Date.now() - emailStartTime;
            console.error(`[Process] ❌ Email ${idx + 1} errored in ${elapsed}ms:`, error);
            return null;
          }
        });

        console.log(`[Process] Waiting for all ${batch.length} emails to complete...`);
        const batchResults = await Promise.all(batchPromises);
        const batchElapsed = Date.now() - startTime;

        const successCount = batchResults.filter(r => r && r.success).length;
        console.log(`[Process] Batch ${batchNum} complete: ${successCount}/${batch.length} successful in ${batchElapsed}ms`);
        console.log(`[Process] Average time per email: ${Math.round(batchElapsed / batch.length)}ms`);

        for (const result of batchResults) {
          if (result && result.success) {
            notesCreated++;
            totalTasks += result.taskCount || 0;
            highPriorityTasks += result.highPriorityCount || 0;
            processedCount++;

            if (result.taskCount && result.taskCount > 0) {
              if (this.settings.showDetailedNotifications && result.emailTitle) {
                new Notice(`✅ ${result.emailTitle}: ${result.taskCount} tasks extracted`);
              } else {
                new Notice(`✅ Batch ${batchNum}: Created note with ${result.taskCount} tasks`);
              }
            }
          }
        }
      }

      console.log(`\n[Process] === Processing Complete ===`);
      console.log(`[Process] Notes created: ${notesCreated}`);
      console.log(`[Process] Total tasks: ${totalTasks}`);
      console.log(`[Process] High priority tasks: ${highPriorityTasks}`);

      // No need to save processed emails - they're tracked by existing notes

      if (skippedCount > 0 && notesCreated === 0) {
        this.updateStatus(`✅ All ${skippedCount} emails already processed`);
        new Notice(`✅ All ${skippedCount} emails were already processed`);
      } else if (notesCreated > 0) {
        this.updateStatus(`✅ Created ${notesCreated} notes (${totalTasks} tasks)`);
        let message = `✅ Successfully created ${notesCreated} meeting notes with ${totalTasks} tasks`;
        if (highPriorityTasks > 0) {
          message += ` (${highPriorityTasks} high priority)`;
        }
        new Notice(message, 5000);
      } else {
        this.updateStatus('✅ Processing complete');
        new Notice('✅ Email processing complete (no new notes created)');
      }
    } catch (error) {
      console.error('Error processing emails:', error);
      this.updateStatus('❌ Error processing emails');
      new Notice(`❌ Error: ${error.message}`);
    }
  }

  async reprocessEmailById(emailId: string, replaceExisting: boolean = true) {
    try {
      console.log(`[reprocessEmailById] Reprocessing email: ${emailId}`);

      if (!this.gmailService || !this.gmailService.isAuthenticated()) {
        new Notice('Gmail service not authenticated');
        return;
      }

      // Initialize Claude extractor if not already done
      if (!this.claudeExtractor && this.settings.anthropicApiKey) {
        this.claudeExtractor = new ClaudeTaskExtractor(
          this.settings.anthropicApiKey,
          this.settings.claudeModel
        );
        console.log('[reprocessEmailById] Initialized Claude extractor');
      }

      this.updateStatus(`🔄 Fetching email ${emailId}...`);

      // Fetch the specific email by ID
      const email = await this.gmailService.getEmailById(emailId);

      if (!email) {
        new Notice(`Email ${emailId} not found`);
        return;
      }

      // Find existing note with this email ID if we need to replace it
      let existingFile: TFile | null = null;
      if (replaceExisting) {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
          if (!file.path.startsWith(this.settings.emailNotesFolder)) continue;

          try {
            const content = await this.app.vault.read(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
              const emailIdMatch = frontmatterMatch[1].match(/emailId:\s*(.+)/);
              if (emailIdMatch && emailIdMatch[1].trim() === emailId) {
                existingFile = file;
                console.log(`[Reprocess] Found existing note at: ${file.path}`);
                break;
              }
            }
          } catch (error) {
            console.error(`Error reading file ${file.path}:`, error);
          }
        }
      }

      // Remove from processed list to allow reprocessing
      this.emailIdCache.delete(emailId);

      // Get appropriate processor for this email
      const processor = processorRegistry.getProcessor(email);
      if (!processor) {
        new Notice(`No processor found for email with labels: ${email.searchedLabels?.join(', ')}`);
        return;
      }

      // Delete existing file first if requested
      if (existingFile) {
        console.log(`[Reprocess] Deleting old note: ${existingFile.path}`);
        await this.app.vault.delete(existingFile);
      }

      // Process the email with latest extraction logic
      const context = {
        app: this.app,
        claudeExtractor: this.claudeExtractor,
        anthropicApiKey: this.settings.anthropicApiKey,
        emailIdCache: this.emailIdCache,
        emailNotesFolder: this.settings.emailNotesFolder,
        saveSettings: async () => {
          this.settings.processedEmails = Array.from(this.emailIdCache);
          await this.saveSettings();
        },
      };

      const result = await processor.process(email, context);

      if (result.success) {

        this.emailIdCache.add(emailId);
        this.settings.processedEmails = Array.from(this.emailIdCache);
        await this.saveSettings();

        new Notice(`✅ Reprocessed email with ${result.taskCount || 0} tasks (Confidence: ${result.confidence}%)`);
        this.updateStatus(`✅ Reprocessed with ${result.taskCount || 0} tasks`);
      } else {
        new Notice('❌ Failed to reprocess email');
        this.updateStatus('❌ Reprocessing failed');
      }
    } catch (error) {
      console.error('Error reprocessing email:', error);
      new Notice(`❌ Error: ${error.message}`);
      this.updateStatus('❌ Error reprocessing');
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  updateStatus(status: string) {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`📧 ${status}`);
    }
  }

  async openTaskDashboard() {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(TASK_DASHBOARD_VIEW_TYPE);

    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]);
    } else {
      await workspace.getRightLeaf(false)?.setViewState({
        type: TASK_DASHBOARD_VIEW_TYPE,
        active: true,
      });
    }
  }

  async reprocessCurrentMeetingNote() {
    try {
      const activeFile = this.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice('No active file. Please open a meeting note to reprocess.');
        return;
      }

      const content = await this.app.vault.read(activeFile);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        new Notice('This file does not appear to be a meeting note (no frontmatter).');
        return;
      }

      const frontmatter = frontmatterMatch[1];
      const emailIdMatch = frontmatter.match(/emailId:\s*(.+)/);

      if (!emailIdMatch || !emailIdMatch[1]) {
        new Notice('No email ID found in this meeting note. Cannot reprocess.');
        return;
      }

      const emailId = emailIdMatch[1].trim();

      // Use the main reprocessing method
      await this.reprocessEmailById(emailId, true);
    } catch (error) {
      console.error('Failed to reprocess meeting note:', error);
      new Notice(`Error reprocessing: ${error.message}`);
      this.updateStatus('Error');
    }
  }

  async resetProcessedEmails() {
    console.log('Reset function called');
    try {
      this.updateStatus('Resetting...');

      const confirmed = confirm(
        'Reset Processed Emails?\n\nThis will clear all processed email records, allowing them to be processed again.'
      );

      if (!confirmed) {
        console.log('User cancelled reset');
        this.updateStatus('Ready');
        return;
      }

      console.log('User confirmed reset');
      new Notice('Resetting processed emails...');

      // Clear the cache and settings - notes themselves remain as the source of truth
      this.emailIdCache.clear();
      this.settings.processedEmails = [];
      await this.saveSettings();

      // Reload from vault notes
      await this.loadEmailIdCache();

      new Notice('✅ Cache refreshed. Existing notes will prevent duplicate processing.');
      this.updateStatus('Ready');
    } catch (error: any) {
      console.error('Reset failed:', error);
      new Notice(`Reset failed: ${error.message}`);
      this.updateStatus('Error');
    }
  }

  onunload() {
    console.log('Unloading Meeting Tasks Plugin...');
  }
}

class MeetingTasksSettingTab extends PluginSettingTab {
  plugin: MeetingTasksPlugin;

  constructor(app: App, plugin: MeetingTasksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Meeting Tasks Settings' });

    containerEl.createEl('h3', { text: 'Google OAuth Settings' });
    containerEl.createEl('p', {
      text: 'Create OAuth credentials in Google Cloud Console. Follow the guide for detailed instructions.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('Google Client ID')
      .setDesc('Your Google OAuth Client ID (from Google Cloud Console)')
      .addText(text =>
        text
          .setPlaceholder('1234567890-abc...apps.googleusercontent.com')
          .setValue(this.plugin.settings.googleClientId)
          .onChange(async value => {
            this.plugin.settings.googleClientId = value;
            await this.plugin.saveSettings();
            await this.plugin.initializeServices();
          })
      );

    new Setting(containerEl)
      .setName('Google Client Secret')
      .setDesc('Your Google OAuth Client Secret')
      .addText(text => {
        text
          .setPlaceholder('GOCSPX-...')
          .setValue(this.plugin.settings.googleClientSecret)
          .onChange(async value => {
            this.plugin.settings.googleClientSecret = value;
            await this.plugin.saveSettings();
            await this.plugin.initializeServices();
          });
        text.inputEl.type = 'password';
        return text;
      });

    containerEl.createEl('h3', { text: 'Gmail Authentication' });

    const authStatusEl = containerEl.createEl('p', {
      text: '⏳ Checking authentication status...',
      cls: 'mod-warning setting-item-description',
    });

    const checkAuthStatus = () => {
      if (!this.plugin.gmailService) {
        authStatusEl.textContent = '❌ Gmail service not initialized';
        authStatusEl.className = 'mod-warning setting-item-description';
        return;
      }

      if (this.plugin.gmailService.isAuthenticated()) {
        if (this.plugin.gmailService.hasRefreshToken()) {
          authStatusEl.textContent = '✅ Authenticated with Gmail';
          authStatusEl.className = 'mod-success setting-item-description';
        } else {
          authStatusEl.textContent = '⚠️ Authenticated but missing refresh token';
          authStatusEl.className = 'mod-warning setting-item-description';
        }
      } else {
        authStatusEl.textContent = '❌ Not authenticated with Gmail';
        authStatusEl.className = 'mod-warning setting-item-description';
      }
    };

    checkAuthStatus();

    new Setting(containerEl)
      .setName('Authenticate with Gmail')
      .setDesc('Click to start the Gmail authentication process')
      .addButton(button => {
        // Store button reference to update later
        const authButton = button;

        // Set initial button text based on auth status
        if (this.plugin.gmailService?.isAuthenticated()) {
          authButton.setButtonText('Re-authenticate');
        } else {
          authButton.setButtonText('Authenticate');
        }

        authButton.onClick(async () => {
          if (!this.plugin.gmailService) {
            new Notice('Please configure Client ID and Secret first');
            return;
          }

          try {
            // Initialize OAuth server if needed
            if (!this.plugin.oauthServer) {
              this.plugin.oauthServer = new OAuthServer();
            }

            // Start the OAuth server
            if (!this.plugin.oauthServer.isRunning()) {
              try {
                await this.plugin.oauthServer.start();
                new Notice('Starting authentication server...');
              } catch (error) {
                new Notice(`Failed to start OAuth server: ${error.message}`);
                return;
              }
            }

            // Set credentials with the OAuth server redirect URI
            const redirectUri = this.plugin.oauthServer.getRedirectUri();
            this.plugin.gmailService.setCredentials(
              this.plugin.settings.googleClientId,
              this.plugin.settings.googleClientSecret,
              redirectUri
            );

            // Get authorization URL and open it
            const authUrl = this.plugin.gmailService.getAuthorizationUrl();
            window.open(authUrl, '_blank');

            // Show waiting modal
            const modal = new Modal(this.app);
            modal.contentEl.addClass('gmail-auth-modal');

            modal.contentEl.createEl('h2', { text: '🔐 Authenticating with Gmail...' });

            const instructionsEl = modal.contentEl.createDiv('auth-instructions');
            instructionsEl.createEl('p', {
              text: 'Please complete the authorization in your browser.'
            });
            instructionsEl.createEl('p', {
              text: 'This window will close automatically when authentication is complete.'
            });

            const loadingEl = modal.contentEl.createDiv('auth-loading');
            loadingEl.style.textAlign = 'center';
            loadingEl.style.marginTop = '20px';
            loadingEl.createEl('span', { text: '⏳ Waiting for authorization...' });

            const cancelBtn = modal.contentEl.createEl('button', {
              text: 'Cancel',
              cls: 'auth-cancel-btn'
            });
            cancelBtn.style.marginTop = '20px';
            cancelBtn.onclick = async () => {
              modal.close();
              await this.plugin.oauthServer?.stop();
            };

            modal.open();

            // Wait for authorization code
            try {
              const code = await this.plugin.oauthServer.waitForAuthCode();

              if (!code) {
                new Notice('No authorization code received');
                modal.close();
                await this.plugin.oauthServer.stop();
                return;
              }

              // Exchange code for token
              modal.close();
              new Notice('Processing authentication...');

              await this.plugin.gmailService!.exchangeCodeForToken(code);
              new Notice('✅ Successfully authenticated with Gmail!');
              checkAuthStatus();
              await this.plugin.initializeServices();

              // Stop the OAuth server
              await this.plugin.oauthServer.stop();

              // Update button text after successful auth
              authButton.setButtonText('Re-authenticate');
            } catch (error) {
              modal.close();
              console.error('Authentication error:', error);
              new Notice(`Authentication failed: ${error.message}`);
              await this.plugin.oauthServer?.stop();

            }
          } catch (error) {
            new Notice(`Failed to start authentication: ${error.message}`);

          }
        });
      });

    new Setting(containerEl)
      .setName('Clear authentication')
      .setDesc('Remove stored Gmail authentication')
      .addButton(button =>
        button
          .setButtonText('Clear')
          .setWarning()
          .onClick(async () => {
            this.plugin.gmailService?.clearAuthentication();
            this.plugin.settings.gmailToken = null;
            await this.plugin.saveSettings();
            new Notice('Gmail authentication cleared');
            checkAuthStatus();
          })
      );

    containerEl.createEl('h3', { text: 'Email Processing' });

    new Setting(containerEl)
      .setName('Lookback time')
      .setDesc('How far back to search. Examples: 6h (6 hours), 3d (3 days), 2w (2 weeks), 1M (1 month)')
      .addText(text =>
        text
          .setPlaceholder('5d')
          .setValue(this.plugin.settings.lookbackTime || '5d')
          .onChange(async value => {
            // Validate the format
            const hours = this.plugin.parseTimeToHours(value);
            if (hours > 0) {
              this.plugin.settings.lookbackTime = value;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Gmail Labels')
      .setDesc('Gmail labels to filter emails (comma-separated)')
      .addText(text =>
        text
          .setPlaceholder('transcript')
          .setValue(this.plugin.settings.gmailLabels)
          .onChange(async value => {
            this.plugin.settings.gmailLabels = value || 'transcript';
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: 'Claude AI Settings' });

    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Your Claude API key for task extraction')
      .addText(text =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async value => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();

            if (value) {
              this.plugin.claudeExtractor = new ClaudeTaskExtractor(
                value,
                this.plugin.settings.claudeModel
              );
            }
          })
      );

    new Setting(containerEl)
      .setName('Claude Model')
      .setDesc('Which Claude model to use')
      .addDropdown(dropdown =>
        dropdown
          .addOption('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku (Fast & Cheap)')
          .addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4 (Balanced)')
          .addOption('claude-opus-4-1-20250805', 'Claude Opus 4.1 (Most Capable)')
          .setValue(this.plugin.settings.claudeModel)
          .onChange(async value => {
            this.plugin.settings.claudeModel = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: 'Obsidian Settings' });

    new Setting(containerEl)
      .setName('Email notes folder')
      .setDesc('Base folder for all email-based notes (organized by label inside)')
      .addText(text =>
        text
          .setPlaceholder('TaskAgent')
          .setValue(this.plugin.settings.emailNotesFolder)
          .onChange(async value => {
            this.plugin.settings.emailNotesFolder = value || 'TaskAgent';
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: 'Dashboard Settings' });

    new Setting(containerEl)
      .setName('Show only my tasks')
      .setDesc('Filter dashboard to show only tasks assigned to you')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.dashboardShowOnlyMyTasks).onChange(async value => {
          this.plugin.settings.dashboardShowOnlyMyTasks = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('My name(s)')
      .setDesc('Your name(s) for filtering tasks (comma-separated)')
      .addText(text =>
        text
          .setPlaceholder('Your name, other name')
          .setValue(this.plugin.settings.dashboardMyName)
          .onChange(async value => {
            this.plugin.settings.dashboardMyName = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: 'Notification Settings' });

    new Setting(containerEl)
      .setName('Show detailed notifications')
      .setDesc('Show email titles in status messages while processing')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showDetailedNotifications).onChange(async value => {
          this.plugin.settings.showDetailedNotifications = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl('h3', { text: 'Actions' });

    new Setting(containerEl)
      .setName('Process emails now')
      .setDesc('Search for meeting emails and create notes')
      .addButton(button =>
        button
          .setButtonText('Process')
          .setCta()
          .onClick(async () => {
            await this.plugin.processEmails();
          })
      );

    new Setting(containerEl)
      .setName('Reset processed emails')
      .setDesc('Clear the list of already processed emails')
      .addButton(button =>
        button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            await this.plugin.resetProcessedEmails();
          })
      );

    const statusDiv = containerEl.createDiv('status-info');
    const gmailStatus = this.plugin.gmailService?.isAuthenticated()
      ? '✅ Gmail authenticated'
      : '❌ Gmail not authenticated';
    const claudeStatus = this.plugin.settings.anthropicApiKey
      ? '✅ Claude AI configured'
      : '⚠️ Claude AI not configured';

    statusDiv.createEl('p', {
      text: gmailStatus,
      cls: this.plugin.gmailService?.isAuthenticated() ? 'mod-success' : 'mod-warning',
    });

    statusDiv.createEl('p', {
      text: claudeStatus,
      cls: this.plugin.settings.anthropicApiKey ? 'mod-success' : 'mod-warning',
    });
  }
}