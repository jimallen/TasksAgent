/**
 * Label-based Email Processor
 *
 * Dynamically processes emails based on their Gmail label
 * Each label gets its own folder and can have a custom Claude prompt
 */

import { normalizePath, App } from 'obsidian';
import { ClaudeTaskExtractor, TaskExtractionResult } from '../claudeExtractor';
import { GmailMessage } from '../gmailService';

export interface LabelProcessorConfig {
  label: string;              // Gmail label name (e.g., "transcript", "action")
  folderName: string;          // Folder name (e.g., "Transcript", "Action")
  promptType?: string;         // Prompt type: "meeting" | "actionitem" | "custom"
  customPrompt?: string;       // Custom prompt for Claude extraction
}

export interface ProcessingContext {
  app: App;
  claudeExtractor: ClaudeTaskExtractor | null;
  anthropicApiKey: string;
  emailIdCache: Set<string>;
  emailNotesFolder: string; // Base folder for all email notes
  saveSettings: () => Promise<void>;
}

export class LabelProcessor {
  constructor(private config: LabelProcessorConfig) {}

  get label(): string {
    return this.config.label;
  }

  get folderName(): string {
    return this.config.folderName;
  }

  canProcess(email: GmailMessage): boolean {
    return email.searchedLabels?.includes(this.config.label) || false;
  }

  async process(email: GmailMessage, context: ProcessingContext): Promise<{
    success: boolean;
    taskCount?: number;
    highPriorityCount?: number;
    confidence?: number;
    emailTitle?: string;
  }> {
    try {
      console.log(`[${this.config.label}] Processing email ${email.id}`);

      // Extract email content
      let emailContent = email.body;
      if (typeof emailContent === 'object') {
        emailContent = JSON.stringify(emailContent);
      }

      if (!emailContent || emailContent === '{}' || emailContent === '[object Object]') {
        console.warn(`[${this.config.label}] No valid email content`);
        return { success: false };
      }

      // Extract tasks using Claude with appropriate prompt
      const extraction = await this.extractTasks(emailContent, email.subject, context);

      // Create note in label folder
      const noteCreated = await this.createNote(email, extraction, context);

      if (noteCreated) {
        const highPriorityCount = extraction.tasks.filter(t => t.priority === 'high').length;
        return {
          success: true,
          taskCount: extraction.tasks.length,
          highPriorityCount,
          confidence: extraction.confidence,
          emailTitle: email.subject || 'Untitled',
        };
      }

      return { success: false };
    } catch (error) {
      console.error(`[${this.config.label}] Error:`, error);
      return { success: false };
    }
  }

  private async extractTasks(
    emailContent: string,
    emailSubject: string,
    context: ProcessingContext
  ): Promise<TaskExtractionResult> {
    if (!context.claudeExtractor || !context.anthropicApiKey) {
      console.log(`[${this.config.label}] No Claude API key, skipping extraction`);
      return {
        tasks: [],
        summary: emailSubject || 'Email note',
        participants: [],
        meetingDate: new Date(),
        keyDecisions: [],
        nextSteps: [],
        confidence: 0,
      };
    }

    console.log(`[${this.config.label}] Starting Claude extraction with prompt type: ${this.config.promptType || 'default'}`);
    const startTime = Date.now();

    let extraction: TaskExtractionResult;

    // Use appropriate extraction method based on prompt type
    if (this.config.promptType === 'actionitem') {
      extraction = await context.claudeExtractor.extractActionItems(emailContent, emailSubject);
    } else if (this.config.promptType === 'meeting' || this.config.promptType === 'transcript') {
      extraction = await context.claudeExtractor.extractTasks(emailContent, emailSubject);
    } else if (this.config.customPrompt) {
      // TODO: Support custom prompts in the future
      extraction = await context.claudeExtractor.extractTasks(emailContent, emailSubject);
    } else {
      // Default to meeting extraction
      extraction = await context.claudeExtractor.extractTasks(emailContent, emailSubject);
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[${this.config.label}] Claude extraction complete in ${elapsed}ms: ${extraction.tasks.length} tasks`
    );

    return extraction;
  }

  private async createNote(
    email: GmailMessage,
    extraction: TaskExtractionResult,
    context: ProcessingContext
  ): Promise<boolean> {
    try {
      // Create folder structure: BaseFolder/LabelFolder/YYYY/MM/
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const basePath = normalizePath(context.emailNotesFolder);
      const labelPath = normalizePath(`${basePath}/${this.config.folderName}`);
      const yearPath = normalizePath(`${labelPath}/${year}`);
      const folderPath = normalizePath(`${yearPath}/${month}`);

      // Ensure folder structure exists
      if (!context.app.vault.getAbstractFileByPath(basePath)) {
        await context.app.vault.createFolder(basePath);
      }
      if (!context.app.vault.getAbstractFileByPath(labelPath)) {
        await context.app.vault.createFolder(labelPath);
      }
      if (!context.app.vault.getAbstractFileByPath(yearPath)) {
        await context.app.vault.createFolder(yearPath);
      }
      if (!context.app.vault.getAbstractFileByPath(folderPath)) {
        await context.app.vault.createFolder(folderPath);
      }

      // Create filename
      const date = new Date(email.date || Date.now()).toISOString().split('T')[0];
      const subject = (email.subject || 'Email')
        .replace(/[\\/:*?"<>|]/g, '-')
        .substring(0, 50);
      const fileName = `${date} - ${subject}.md`;
      const filePath = normalizePath(`${folderPath}/${fileName}`);

      // Check if note already exists
      if (context.app.vault.getAbstractFileByPath(filePath)) {
        console.log(`[${this.config.label}] Note already exists: ${filePath}`);
        return false;
      }

      // Format note content
      const noteContent = this.formatNote(email, extraction);

      await context.app.vault.create(filePath, noteContent);
      console.log(`[${this.config.label}] Created note: ${filePath}`);

      // Add to cache
      context.emailIdCache.add(email.id);
      await context.saveSettings();

      return true;
    } catch (error) {
      console.error(`[${this.config.label}] Error creating note:`, error);
      return false;
    }
  }

  private formatNote(email: GmailMessage, extraction: TaskExtractionResult): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`title: ${extraction.summary}`);
    lines.push(`emailId: ${email.id}`);
    lines.push(`label: ${this.config.label}`);
    if (email.gmailUrl) {
      lines.push(`gmailUrl: ${email.gmailUrl}`);
    }
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${extraction.summary}`);
    lines.push('');

    // Email metadata
    lines.push('## Email Details');
    lines.push(`**From:** ${email.from}`);
    lines.push(`**Date:** ${email.date}`);
    if (email.gmailUrl) {
      lines.push(`**Email:** [View in Gmail](${email.gmailUrl})`);
    }
    lines.push('');

    // Attachments
    if (email.attachments && email.attachments.length > 0) {
      const attachmentStr = email.attachments
        .map(a => `${a.filename} (${this.formatFileSize(a.size)})`)
        .join(', ');
      lines.push(`**Attachments:** ${attachmentStr}`);
      lines.push('');
    }

    // Participants (if any)
    if (extraction.participants && extraction.participants.length > 0) {
      lines.push('## Participants');
      extraction.participants.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    }

    // Action Items grouped by priority
    if (extraction.tasks && extraction.tasks.length > 0) {
      lines.push('## Action Items');
      lines.push('');

      const highPriority = extraction.tasks.filter(t => t.priority === 'high');
      const mediumPriority = extraction.tasks.filter(t => t.priority === 'medium');
      const lowPriority = extraction.tasks.filter(t => t.priority === 'low');

      if (highPriority.length > 0) {
        lines.push('### 🔴 High Priority');
        highPriority.forEach(task => lines.push(this.formatTask(task)));
        lines.push('');
      }

      if (mediumPriority.length > 0) {
        lines.push('### 🟡 Medium Priority');
        mediumPriority.forEach(task => lines.push(this.formatTask(task)));
        lines.push('');
      }

      if (lowPriority.length > 0) {
        lines.push('### 🟢 Low Priority');
        lowPriority.forEach(task => lines.push(this.formatTask(task)));
        lines.push('');
      }
    }

    // Next Steps
    if (extraction.nextSteps && extraction.nextSteps.length > 0) {
      lines.push('## Next Steps');
      extraction.nextSteps.forEach(step => {
        if (typeof step === 'string') {
          lines.push(`- [ ] ${step}`);
        } else {
          lines.push(`- [ ] ${step.description || step}`);
        }
      });
      lines.push('');
    }

    // Key Decisions
    if (extraction.keyDecisions && extraction.keyDecisions.length > 0) {
      lines.push('## Key Decisions');
      extraction.keyDecisions.forEach(decision => lines.push(`- ${decision}`));
      lines.push('');
    }

    // Context section (email snippet)
    if (email.snippet && !extraction.keyDecisions?.length && !extraction.nextSteps?.length) {
      lines.push('## Context');
      lines.push(email.snippet);
      lines.push('');
    }

    // Reprocess link
    lines.push('---');
    lines.push(`**[🔄 Reprocess this email](obsidian://meeting-tasks-reprocess?id=${email.id})**`);

    return lines.join('\n');
  }

  private formatTask(task: any): string {
    let line = `- [ ] ${task.description}`;

    if (task.assignee) {
      line += ` [[${task.assignee}]]`;
    }

    if (task.dueDate) {
      line += ` 📅 ${task.dueDate}`;
    }

    if (task.confidence && task.confidence < 70) {
      line += ` ⚠️ ${task.confidence}%`;
    }

    if (task.tags && task.tags.length > 0) {
      line += ` ${task.tags.map((t: string) => `#${t}`).join(' ')}`;
    }

    return line;
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }
}
