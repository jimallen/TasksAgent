#!/usr/bin/env node

import { config } from './config/config';
import { gmailServiceRateLimited } from './services/gmailServiceRateLimited';
import { transcriptParser } from './parsers/transcriptParser';
import { emailParser } from './parsers/emailParser';
import { claudeTaskExtractor } from './extractors/claudeTaskExtractor';
import { obsidianService } from './services/obsidianService';
import { stateManager } from './database/stateManager';
import { notificationService } from './services/notificationService';
import { cronScheduler } from './scheduler/cronScheduler';
import { logInfo, logError, logWarn, logDebug } from './utils/logger';
import { EmailMessage } from './services/gmailService';

export class MeetingTranscriptAgent {
  private isProcessing: boolean = false;
  private processedCount: number = 0;
  private errorCount: number = 0;
  private startTime: Date = new Date();

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    logInfo('🚀 Initializing Meeting Transcript Agent...');

    try {
      // Initialize configuration
      await config.load();
      logInfo('✓ Configuration loaded');

      // Initialize database
      await stateManager.initialize();
      logInfo('✓ Database initialized');

      // Initialize Gmail service
      await gmailServiceRateLimited.connect();
      logInfo('✓ Gmail service connected');

      // Initialize Obsidian service
      await obsidianService.initialize();
      logInfo('✓ Obsidian vault initialized');

      // Initialize transcript parser
      await transcriptParser.initialize();
      logInfo('✓ Transcript parser initialized');

      // Setup scheduler with processing function
      cronScheduler.setProcessingFunction(() => this.processEmails());
      logInfo('✓ Scheduler configured');

      logInfo('✅ All services initialized successfully');
    } catch (error) {
      logError('Failed to initialize services', error);
      throw error;
    }
  }

  /**
   * Main processing function
   */
  async processEmails(): Promise<{ processed: number; tasksExtracted: number; notesCreated: number }> {
    if (this.isProcessing) {
      logWarn('Already processing emails, skipping this run');
      return { processed: 0, tasksExtracted: 0, notesCreated: 0 };
    }

    this.isProcessing = true;
    const sessionStartTime = Date.now();
    let sessionProcessed = 0;
    let sessionTasks = 0;
    let sessionNotes = 0;
    let sessionErrors = 0;

    try {
      logInfo('📧 Starting email processing session...');

      // Fetch recent emails
      const hoursBack = parseInt(config.gmail?.hoursToLookBack || '24');
      const emails = await gmailServiceRateLimited.fetchRecentEmails(hoursBack);
      logInfo(`Found ${emails.length} emails from the last ${hoursBack} hours`);

      // Filter for potential meeting transcripts
      const transcriptEmails = await this.filterTranscriptEmails(emails);
      logInfo(`Identified ${transcriptEmails.length} potential meeting transcript emails`);

      // Process each transcript email
      for (const email of transcriptEmails) {
        try {
          // Check if already processed
          const status = await stateManager.getEmailStatus(email.id);
          if (status.processed && status.status === 'processed') {
            logDebug(`Email ${email.id} already processed, skipping`);
            continue;
          }

          // Process the email
          const result = await this.processTranscriptEmail(email);
          
          if (result.success) {
            sessionProcessed++;
            sessionTasks += result.taskCount || 0;
            if (result.taskCount && result.taskCount > 0) sessionNotes++;
            
            // Save to database
            await stateManager.saveProcessedEmail(
              email,
              'processed',
              result.taskCount,
              result.confidence,
              result.obsidianPath
            );

            // Save tasks
            if (result.tasks && result.tasks.length > 0) {
              await stateManager.saveTasks(email.id, result.tasks);
            }

            // Save meeting record
            if (result.meetingInfo) {
              await stateManager.saveMeeting(
                email.id,
                result.meetingInfo.title,
                result.meetingInfo.date,
                result.meetingInfo.participants,
                result.meetingInfo.service,
                result.obsidianPath
              );
            }

            logInfo(`✓ Processed email: ${email.subject} (${result.taskCount} tasks)`);
          } else {
            sessionErrors++;
            await stateManager.saveProcessedEmail(
              email,
              'failed',
              0,
              0,
              undefined,
              result.error
            );
            logError(`Failed to process email: ${email.subject}`, result.error);
          }

        } catch (error: any) {
          sessionErrors++;
          await stateManager.saveProcessedEmail(
            email,
            'failed',
            0,
            0,
            undefined,
            error.message
          );
          logError(`Error processing email ${email.id}`, error);
          
          // Continue with next email
          continue;
        }
      }

      // Update statistics
      await stateManager.updateDailyStats(
        sessionProcessed,
        sessionTasks,
        sessionProcessed, // Assuming each processed email is a meeting
        sessionErrors
      );

      const duration = Date.now() - sessionStartTime;
      logInfo(`📊 Session complete: ${sessionProcessed} emails, ${sessionTasks} tasks, ${sessionErrors} errors in ${duration}ms`);

      // Send summary notification if emails were processed
      if (sessionProcessed > 0 || sessionErrors > 0) {
        await notificationService.send({
          title: '✅ Email Processing Complete',
          message: `Processed ${sessionProcessed} emails, extracted ${sessionTasks} tasks${sessionErrors > 0 ? `, ${sessionErrors} errors` : ''}`,
          priority: sessionErrors > 0 ? 'high' : 'normal'
        });
      }

      this.processedCount += sessionProcessed;
      this.errorCount += sessionErrors;

    } catch (error) {
      logError('Critical error in email processing', error);
      await notificationService.notifyError(
        error as Error,
        'Email processing session failed'
      );
      throw error;
    } finally {
      this.isProcessing = false;
    }
    
    return { processed: sessionProcessed, tasksExtracted: sessionTasks, notesCreated: sessionNotes };
  }

  /**
   * Filter emails for meeting transcripts
   */
  private async filterTranscriptEmails(emails: EmailMessage[]): Promise<EmailMessage[]> {
    const filtered: EmailMessage[] = [];

    for (const email of emails) {
      try {
        // Parse email to detect if it's a transcript
        const parsed = await emailParser.parseEmail(email);
        
        if (parsed.isTranscript && parsed.confidence > 50) {
          filtered.push(email);
          logDebug(`Email "${email.subject}" identified as ${parsed.service} transcript (${parsed.confidence}% confidence)`);
        }
      } catch (error) {
        logWarn(`Failed to parse email ${email.id}`, error as any);
      }
    }

    return filtered;
  }

  /**
   * Process a single transcript email
   */
  private async processTranscriptEmail(email: EmailMessage): Promise<{
    success: boolean;
    taskCount?: number;
    confidence?: number;
    obsidianPath?: string;
    tasks?: any[];
    meetingInfo?: any;
    error?: string;
  }> {
    try {
      logInfo(`Processing transcript email: ${email.subject}`);

      // Parse email
      const parsedEmail = await emailParser.parseEmail(email);
      
      // Get transcript content
      let transcriptContent;
      
      if (parsedEmail.transcriptLocation === 'attachment' && email.attachments?.length > 0) {
        // Download and parse attachment
        const attachment = email.attachments[0];
        if (!attachment) {
          throw new Error('No attachment found despite attachment array length > 0');
        }
        logDebug(`Downloading attachment: ${attachment.filename}`);
        
        const buffer = await gmailServiceRateLimited.downloadAttachment(
          email.id,
          attachment.id
        );
        
        transcriptContent = await transcriptParser.parseTranscript(
          buffer,
          attachment.filename,
          attachment.mimeType
        );
      } else if (parsedEmail.transcriptLocation === 'body') {
        // Parse from email body
        transcriptContent = await transcriptParser.parseTranscript(
          Buffer.from(email.body || ''),
          'email-body.txt',
          'text/plain'
        );
      } else {
        throw new Error('No transcript content found');
      }

      // Extract tasks using AI
      const extraction = await claudeTaskExtractor.extractTasks(transcriptContent);
      
      // Create Obsidian note
      const obsidianNote = await obsidianService.createMeetingNote(
        extraction,
        email.id,
        email.subject
      );

      // Link to daily note
      await obsidianService.linkToDailyNote(
        obsidianNote.filepath,
        extraction.meetingDate
      );

      // Send notification
      await notificationService.notifyTasksExtracted(
        email.subject,
        extraction,
        obsidianNote.filepath
      );

      return {
        success: true,
        taskCount: extraction.tasks.length,
        confidence: extraction.confidence,
        obsidianPath: obsidianNote.filepath,
        tasks: extraction.tasks,
        meetingInfo: {
          title: obsidianNote.metadata.title,
          date: extraction.meetingDate,
          participants: extraction.participants,
          service: parsedEmail.service
        }
      };

    } catch (error: any) {
      logError(`Failed to process transcript email: ${email.subject}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    try {
      await this.initialize();
      
      // Start scheduler
      await cronScheduler.start();
      
      logInfo('🎯 Meeting Transcript Agent is running');
      logInfo('Schedule: 9 AM, 1 PM, 5 PM daily');
      logInfo('Press Ctrl+C to stop');

      // Run initial processing if configured
      if (process.env['RUN_ON_START'] === 'true') {
        logInfo('Running initial email processing...');
        await this.processEmails();
      }

      // Keep process alive
      process.stdin.resume();

    } catch (error) {
      logError('Failed to start agent', error);
      await this.shutdown(1);
    }
  }

  /**
   * Manual trigger for processing
   */
  async triggerManual(): Promise<void> {
    logInfo('Manual processing triggered');
    await this.processEmails();
  }

  /**
   * Get agent status
   */
  getStatus(): any {
    return {
      isRunning: !this.isProcessing,
      isProcessing: this.isProcessing,
      startTime: this.startTime,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      uptime: Date.now() - this.startTime.getTime(),
      scheduler: cronScheduler.getStats(),
      rateLimits: gmailServiceRateLimited.getRateLimitStatus()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(exitCode: number = 0): Promise<void> {
    logInfo('Shutting down Meeting Transcript Agent...');

    try {
      // Stop scheduler
      await cronScheduler.stop();
      
      // Close database
      stateManager.close();
      
      // Disconnect from Gmail
      await gmailServiceRateLimited.disconnect();
      
      // Clean up temp files
      await transcriptParser.cleanup();
      
      logInfo('✓ Shutdown complete');
    } catch (error) {
      logError('Error during shutdown', error);
    }

    process.exit(exitCode);
  }
}

// Create and export agent instance
export const agent = new MeetingTranscriptAgent();

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Meeting Transcript Task Extraction Agent

Usage:
  npm start              Start the agent with scheduled processing
  npm start --once       Run processing once and exit
  npm start --test       Test all services and connections
  npm start --status     Show current agent status
  
Environment Variables:
  OBSIDIAN_VAULT_PATH    Path to your Obsidian vault (required)
  ANTHROPIC_API_KEY      Claude API key for task extraction
  NOTIFICATION_CHANNELS  Comma-separated list of notification channels
  RUN_ON_START          Run processing immediately on start (true/false)
  CUSTOM_SCHEDULE       Custom cron schedule (optional)
  TZ                    Timezone for scheduling (default: America/New_York)
    `);
    process.exit(0);
  }

  if (args.includes('--test')) {
    // Test mode
    agent.initialize().then(async () => {
      logInfo('Testing services...');
      await notificationService.test();
      logInfo('✓ All services tested successfully');
      process.exit(0);
    }).catch(error => {
      logError('Test failed', error);
      process.exit(1);
    });
  } else if (args.includes('--once')) {
    // Run once mode
    agent.initialize().then(async () => {
      await agent.processEmails();
      await agent.shutdown(0);
    }).catch(error => {
      logError('Processing failed', error);
      process.exit(1);
    });
  } else if (args.includes('--status')) {
    // Status mode
    const status = agent.getStatus();
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  } else {
    // Normal scheduled mode
    agent.start().catch(error => {
      logError('Failed to start agent', error);
      process.exit(1);
    });
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => agent.shutdown(0));
  process.on('SIGINT', () => agent.shutdown(0));
  process.on('uncaughtException', (error) => {
    logError('Uncaught exception', error);
    agent.shutdown(1);
  });
  process.on('unhandledRejection', (reason) => {
    logError('Unhandled rejection', reason);
    agent.shutdown(1);
  });
}