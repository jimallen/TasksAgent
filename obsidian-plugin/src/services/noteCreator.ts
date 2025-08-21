/**
 * Note Creator Service for Meeting Tasks Plugin
 * Handles creation of Obsidian notes from meeting data
 */

import {
  App,
  TFile,
  TFolder,
  Notice,
  normalizePath,
  MarkdownView,
} from 'obsidian';
import moment from 'moment';
import { MeetingTasksSettings } from '../settings';
import { 
  MeetingNote, 
  ExtractedTask,
  TemplateVariables,
  TaskPriority,
} from '../api/types';

/**
 * Service for creating Obsidian notes from meeting data
 */
export class NoteCreatorService {
  private app: App;
  private settings: MeetingTasksSettings;

  constructor(app: App, settings: MeetingTasksSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings
   */
  updateSettings(settings: MeetingTasksSettings): void {
    this.settings = settings;
  }

  /**
   * Create a note from meeting data
   */
  async createMeetingNote(meeting: MeetingNote): Promise<TFile> {
    try {
      // Check for duplicates
      const existingNote = await this.findExistingNote(meeting);
      if (existingNote && !this.settings.advanced.debugMode) {
        throw new Error(`Note already exists: ${existingNote.path}`);
      }

      // Ensure target folder exists
      await this.ensureFolderExists(this.settings.targetFolder);

      // Generate filename
      const filename = this.generateFilename(meeting);
      const filepath = normalizePath(`${this.settings.targetFolder}/${filename}`);

      // Check if Templater is available and should be used
      if (this.settings.useTemplater && await this.isTemplaterAvailable()) {
        return await this.createNoteWithTemplater(meeting, filepath);
      } else {
        return await this.createNoteWithoutTemplater(meeting, filepath);
      }
    } catch (error) {
      console.error('Failed to create meeting note:', error);
      throw error;
    }
  }

  /**
   * Check if a note already exists for this meeting
   */
  async findExistingNote(meeting: MeetingNote): Promise<TFile | null> {
    const folder = this.app.vault.getAbstractFileByPath(this.settings.targetFolder);
    if (!folder || !(folder instanceof TFolder)) {
      return null;
    }

    // Look for notes with similar title and date
    const meetingDate = moment(meeting.date);
    const possibleNames = [
      this.generateFilename(meeting),
      `${meetingDate.format(this.settings.dateFormat)} ${meeting.title}`,
      `${meeting.title} ${meetingDate.format(this.settings.dateFormat)}`,
    ];

    for (const name of possibleNames) {
      const path = normalizePath(`${this.settings.targetFolder}/${name}`);
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        return file;
      }
    }

    // Check by email ID in frontmatter
    const files = folder.children.filter(f => f instanceof TFile) as TFile[];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.sourceEmail === meeting.sourceEmail) {
        return file;
      }
    }

    return null;
  }

  /**
   * Generate filename for the meeting note
   */
  private generateFilename(meeting: MeetingNote): string {
    const date = moment(meeting.date);
    const time = moment(meeting.date);
    
    let filename = this.settings.noteNamePattern
      .replace('{{date}}', date.format(this.settings.dateFormat))
      .replace('{{time}}', time.format(this.settings.timeFormat))
      .replace('{{title}}', this.sanitizeFilename(meeting.title));

    // Ensure .md extension
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    return filename;
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFilename(name: string): string {
    // Remove characters that are invalid in filenames
    return name
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Ensure folder exists, create if needed
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  /**
   * Check if Templater plugin is available
   */
  private async isTemplaterAvailable(): Promise<boolean> {
    // @ts-ignore - Accessing Obsidian's internal plugin system
    const templater = this.app.plugins.plugins['templater-obsidian'];
    return !!templater && templater.enabled;
  }

  /**
   * Create note using Templater plugin
   */
  private async createNoteWithTemplater(
    meeting: MeetingNote, 
    filepath: string
  ): Promise<TFile> {
    // Get Templater plugin
    // @ts-ignore
    const templater = this.app.plugins.plugins['templater-obsidian'];
    
    if (!templater) {
      // Fallback if Templater not found
      return this.createNoteWithoutTemplater(meeting, filepath);
    }

    // Find template file
    const templatePath = this.settings.templaterTemplate;
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    
    if (!(templateFile instanceof TFile)) {
      new Notice(`Template file not found: ${templatePath}`);
      return this.createNoteWithoutTemplater(meeting, filepath);
    }

    // Prepare template variables
    const variables = this.prepareTemplateVariables(meeting);
    
    try {
      // Create file with template content
      const templateContent = await this.app.vault.read(templateFile);
      const file = await this.app.vault.create(filepath, templateContent);
      
      // Process with Templater
      // @ts-ignore
      await templater.templater.overwrite_file_commands(file, variables);
      
      return file;
    } catch (error) {
      console.error('Templater processing failed:', error);
      // Fallback to non-Templater creation
      return this.createNoteWithoutTemplater(meeting, filepath);
    }
  }

  /**
   * Create note without Templater
   */
  private async createNoteWithoutTemplater(
    meeting: MeetingNote,
    filepath: string
  ): Promise<TFile> {
    const content = this.generateNoteContent(meeting);
    const file = await this.app.vault.create(filepath, content);
    
    // Add tags if configured
    if (this.settings.defaultTags.length > 0) {
      await this.addTags(file, this.settings.defaultTags);
    }
    
    // Link to daily note if configured
    if (this.settings.linkToDailyNote) {
      await this.linkToDailyNote(file, meeting.date);
    }
    
    return file;
  }

  /**
   * Generate note content without Templater
   */
  private generateNoteContent(meeting: MeetingNote): string {
    const lines: string[] = [];
    
    // Frontmatter
    lines.push('---');
    lines.push(`title: "${meeting.title}"`);
    lines.push(`date: ${moment(meeting.date).format('YYYY-MM-DD')}`);
    lines.push(`time: ${moment(meeting.date).format('HH:mm')}`);
    lines.push(`sourceEmail: "${meeting.sourceEmail}"`);
    lines.push(`processedAt: ${moment(meeting.processedAt).format()}`);
    lines.push(`confidence: ${meeting.confidence}`);
    
    if (meeting.participants.length > 0) {
      lines.push('participants:');
      meeting.participants.forEach(p => lines.push(`  - "${p}"`));
    }
    
    if (this.settings.defaultTags.length > 0) {
      lines.push('tags:');
      this.settings.defaultTags.forEach(t => lines.push(`  - ${t}`));
    }
    
    lines.push('---');
    lines.push('');
    
    // Title
    lines.push(`# ${meeting.title}`);
    lines.push('');
    
    // Meeting info box
    lines.push('> [!info] Meeting Information');
    lines.push(`> **Date:** ${moment(meeting.date).format('YYYY-MM-DD')}`);
    lines.push(`> **Time:** ${moment(meeting.date).format('HH:mm')}`);
    lines.push(`> **Confidence Score:** ${Math.round(meeting.confidence * 100)}%`);
    lines.push('');
    
    // Summary
    if (meeting.summary) {
      lines.push('## 📋 Executive Summary');
      lines.push(meeting.summary);
      lines.push('');
    }
    
    // Participants
    if (meeting.participants.length > 0) {
      lines.push('## 👥 Participants');
      meeting.participants.forEach(p => {
        lines.push(`- [[${p}]]`);
      });
      lines.push('');
    }
    
    // Tasks
    if (meeting.tasks.length > 0) {
      lines.push('## ✅ Action Items & Tasks');
      lines.push('');
      
      // Group tasks by priority
      const highPriority = meeting.tasks.filter(t => t.priority === 'high');
      const mediumPriority = meeting.tasks.filter(t => t.priority === 'medium');
      const lowPriority = meeting.tasks.filter(t => t.priority === 'low');
      
      if (highPriority.length > 0) {
        lines.push('### High Priority 🔴');
        highPriority.forEach(task => {
          lines.push(this.formatTask(task));
        });
        lines.push('');
      }
      
      if (mediumPriority.length > 0) {
        lines.push('### Medium Priority 🟡');
        mediumPriority.forEach(task => {
          lines.push(this.formatTask(task));
        });
        lines.push('');
      }
      
      if (lowPriority.length > 0) {
        lines.push('### Low Priority 🟢');
        lowPriority.forEach(task => {
          lines.push(this.formatTask(task));
        });
        lines.push('');
      }
    }
    
    // Key Decisions
    if (meeting.keyDecisions && meeting.keyDecisions.length > 0) {
      lines.push('## 🎯 Key Decisions');
      meeting.keyDecisions.forEach(decision => {
        lines.push(`- ${decision}`);
      });
      lines.push('');
    }
    
    // Next Steps
    if (meeting.nextSteps && meeting.nextSteps.length > 0) {
      lines.push('## 🚀 Next Steps');
      meeting.nextSteps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('---');
    lines.push('');
    lines.push('> [!note] Processing Information');
    lines.push('> This note was automatically generated by the Meeting Tasks Obsidian Plugin');
    lines.push(`> **Processed on:** ${moment().format('YYYY-MM-DD HH:mm')}`);
    lines.push(`> **AI Model:** ${this.settings.claudeModel}`);
    
    // Link to daily note
    if (this.settings.linkToDailyNote) {
      const dailyNoteLink = this.getDailyNoteLink(meeting.date);
      if (dailyNoteLink) {
        lines.push('');
        lines.push('## 📅 Daily Note');
        lines.push(dailyNoteLink);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format a task for display
   */
  private formatTask(task: ExtractedTask): string {
    let taskLine = `- [ ] ${task.description}`;
    
    if (task.assignee) {
      taskLine += `\n  - Assigned to: [[${task.assignee}]]`;
    }
    
    if (task.dueDate) {
      taskLine += `\n  - Due: ${task.dueDate}`;
    }
    
    if (task.context) {
      taskLine += `\n  - Context: ${task.context}`;
    }
    
    return taskLine;
  }

  /**
   * Prepare template variables for Templater
   */
  private prepareTemplateVariables(meeting: MeetingNote): TemplateVariables {
    const date = moment(meeting.date);
    
    return {
      // Basic meeting info
      title: meeting.title,
      date: date.format(this.settings.dateFormat),
      time: date.format(this.settings.timeFormat),
      participants: meeting.participants,
      
      // Extracted content
      tasks: meeting.tasks,
      summary: meeting.summary,
      keyDecisions: meeting.keyDecisions || [],
      nextSteps: meeting.nextSteps || [],
      confidence: meeting.confidence,
      
      // Source info
      sourceEmail: meeting.sourceEmail,
      transcriptLink: meeting.transcript ? `[View Transcript]` : undefined,
      
      // Metadata
      meeting_type: this.detectMeetingType(meeting),
      aiModel: this.settings.claudeModel,
      pluginVersion: '1.0.0',
      
      // Additional
      additionalNotes: '',
      relatedMeetings: [],
      
      // Custom variables from settings
      ...this.settings.templateVariables,
    };
  }

  /**
   * Detect meeting type from title/content
   */
  private detectMeetingType(meeting: MeetingNote): string {
    const title = meeting.title.toLowerCase();
    
    if (title.includes('standup') || title.includes('daily')) {
      return 'standup';
    } else if (title.includes('1:1') || title.includes('one-on-one')) {
      return 'one-on-one';
    } else if (title.includes('review') || title.includes('retro')) {
      return 'review';
    } else if (title.includes('planning')) {
      return 'planning';
    } else if (title.includes('interview')) {
      return 'interview';
    } else if (title.includes('all hands') || title.includes('town hall')) {
      return 'all-hands';
    }
    
    return 'general';
  }

  /**
   * Add tags to a file
   */
  private async addTags(file: TFile, tags: string[]): Promise<void> {
    const content = await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    
    // Check if tags already exist in frontmatter
    if (cache?.frontmatter?.tags) {
      return; // Tags already present
    }
    
    // Add tags to content (this is a simplified version)
    // In production, would need more robust frontmatter handling
    const tagsLine = tags.map(t => `#${t}`).join(' ');
    const newContent = content + '\n\n' + tagsLine;
    
    await this.app.vault.modify(file, newContent);
  }

  /**
   * Link note to daily note
   */
  private async linkToDailyNote(file: TFile, meetingDate: Date): Promise<void> {
    const dailyNotePath = this.getDailyNotePath(meetingDate);
    const dailyNote = this.app.vault.getAbstractFileByPath(dailyNotePath);
    
    if (dailyNote instanceof TFile) {
      // Add link to daily note
      const content = await this.app.vault.read(dailyNote);
      const link = `[[${file.basename}]]`;
      
      if (!content.includes(link)) {
        const newContent = content + `\n\n## Meeting Notes\n- ${link}`;
        await this.app.vault.modify(dailyNote, newContent);
      }
    }
  }

  /**
   * Get daily note path for a date
   */
  private getDailyNotePath(date: Date): string {
    const dailyDate = moment(date).format(this.settings.dailyNoteDateFormat);
    return normalizePath(`${this.settings.dailyNoteFolder}/${dailyDate}.md`);
  }

  /**
   * Get daily note link for a date
   */
  private getDailyNoteLink(date: Date): string | null {
    const dailyNotePath = this.getDailyNotePath(date);
    const dailyNote = this.app.vault.getAbstractFileByPath(dailyNotePath);
    
    if (dailyNote instanceof TFile) {
      return `[[${dailyNote.basename}]]`;
    }
    
    return null;
  }

  /**
   * Open the created note
   */
  async openNote(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf();
    await leaf.openFile(file);
    
    // Focus on the note
    const view = leaf.view;
    if (view instanceof MarkdownView) {
      view.editor.focus();
    }
  }
}