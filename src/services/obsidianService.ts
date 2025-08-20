import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
import { config } from '../config/config';
import { ExtractedTask, TaskExtractionResult } from '../extractors/claudeTaskExtractor';
import { createHash } from 'crypto';

export interface ObsidianNoteMetadata {
  title: string;
  date: Date;
  participants: string[];
  tags: string[];
  source: string;
  emailId?: string;
  transcriptHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObsidianNote {
  metadata: ObsidianNoteMetadata;
  content: string;
  filepath: string;
}

export class ObsidianService {
  private vaultPath: string;
  private meetingsFolder: string;
  private templatesFolder: string;
  private dailyNotesFolder: string;
  private attachmentsFolder: string;

  constructor() {
    // Get vault path from environment or config
    let vaultPath = process.env['OBSIDIAN_VAULT_PATH'] || config.obsidian?.vaultPath || '';
    
    // Expand tilde to home directory
    if (vaultPath.startsWith('~')) {
      vaultPath = path.join(os.homedir(), vaultPath.slice(1));
    }
    
    this.vaultPath = vaultPath;
    this.meetingsFolder = 'Meetings';
    this.templatesFolder = 'Templates';
    this.dailyNotesFolder = 'Daily Notes';
    this.attachmentsFolder = 'Attachments/Meetings';
  }

  /**
   * Initialize Obsidian vault structure
   */
  async initialize(): Promise<void> {
    if (!this.vaultPath) {
      throw new Error('Obsidian vault path not configured. Set OBSIDIAN_VAULT_PATH environment variable.');
    }

    // Check if vault exists
    try {
      await fs.access(this.vaultPath);
      logInfo(`Obsidian vault found at: ${this.vaultPath}`);
    } catch {
      throw new Error(`Obsidian vault not found at: ${this.vaultPath}`);
    }

    // Create required folders
    const folders = [
      this.meetingsFolder,
      this.templatesFolder,
      this.dailyNotesFolder,
      this.attachmentsFolder,
      `${this.meetingsFolder}/Archive`,
      `${this.meetingsFolder}/Recurring`,
    ];

    for (const folder of folders) {
      const folderPath = path.join(this.vaultPath, folder);
      try {
        await fs.mkdir(folderPath, { recursive: true });
        logDebug(`Ensured folder exists: ${folder}`);
      } catch (error) {
        logError(`Failed to create folder: ${folder}`, error);
      }
    }

    // Create meeting template if it doesn't exist
    await this.ensureMeetingTemplate();
  }

  /**
   * Create a meeting note from extraction results
   */
  async createMeetingNote(
    extraction: TaskExtractionResult,
    emailId: string,
    originalFilename?: string
  ): Promise<ObsidianNote> {
    const metadata: ObsidianNoteMetadata = {
      title: this.generateMeetingTitle(extraction, originalFilename),
      date: extraction.meetingDate,
      participants: extraction.participants,
      tags: this.generateTags(extraction),
      source: 'Gmail',
      emailId,
      transcriptHash: this.generateHash(extraction.summary),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const content = this.formatMeetingNote(metadata, extraction);
    const filepath = await this.saveNote(metadata, content);

    logInfo(`Created meeting note: ${filepath}`);

    return {
      metadata,
      content,
      filepath,
    };
  }

  /**
   * Update an existing meeting note
   */
  async updateMeetingNote(
    filepath: string,
    extraction: TaskExtractionResult,
    appendTasks: boolean = false
  ): Promise<void> {
    try {
      const fullPath = path.join(this.vaultPath, filepath);
      const existingContent = await fs.readFile(fullPath, 'utf-8');

      let updatedContent: string;
      if (appendTasks) {
        // Append new tasks to existing note
        updatedContent = this.appendTasksToNote(existingContent, extraction.tasks);
      } else {
        // Replace tasks section
        updatedContent = this.replaceTasksInNote(existingContent, extraction.tasks);
      }

      // Update metadata
      updatedContent = this.updateNoteMetadata(updatedContent, {
        updatedAt: new Date(),
        taskCount: extraction.tasks.length,
      });

      await fs.writeFile(fullPath, updatedContent, 'utf-8');
      logInfo(`Updated meeting note: ${filepath}`);
    } catch (error) {
      logError(`Failed to update meeting note: ${filepath}`, error);
      throw error;
    }
  }

  /**
   * Check if a meeting note already exists
   */
  async findExistingNote(
    emailId: string,
    transcriptHash: string
  ): Promise<string | null> {
    try {
      const meetingsPath = path.join(this.vaultPath, this.meetingsFolder);
      const files = await this.getAllMarkdownFiles(meetingsPath);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        
        // Check frontmatter for email ID or transcript hash
        if (content.includes(`emailId: ${emailId}`) || 
            content.includes(`transcriptHash: ${transcriptHash}`)) {
          return path.relative(this.vaultPath, file);
        }
      }

      return null;
    } catch (error) {
      logError('Failed to search for existing notes', error);
      return null;
    }
  }

  /**
   * Format meeting note content
   */
  private formatMeetingNote(
    metadata: ObsidianNoteMetadata,
    extraction: TaskExtractionResult
  ): string {
    const frontmatter = this.generateFrontmatter(metadata);
    
    const sections = [
      frontmatter,
      '',
      `# ${metadata.title}`,
      '',
      '## Meeting Summary',
      extraction.summary,
      '',
      '## Participants',
      extraction.participants.map(p => `- [[${p}]]`).join('\n'),
      '',
      '## Key Decisions',
      extraction.keyDecisions.length > 0 
        ? extraction.keyDecisions.map(d => `- ${d}`).join('\n')
        : '- No key decisions recorded',
      '',
      '## Tasks',
      this.formatTasks(extraction.tasks),
      '',
      '## Next Steps',
      extraction.nextSteps.length > 0
        ? extraction.nextSteps.map(s => `- ${s}`).join('\n')
        : '- No additional next steps',
      '',
      '## Notes',
      '',
      '',
      '---',
      `*Extracted from Gmail on ${new Date().toLocaleString()}*`,
      `*Confidence: ${extraction.confidence}%*`,
    ];

    return sections.join('\n');
  }

  /**
   * Generate frontmatter for note
   */
  private generateFrontmatter(metadata: ObsidianNoteMetadata): string {
    const frontmatter = {
      title: metadata.title,
      date: metadata.date.toISOString().split('T')[0],
      time: metadata.date.toISOString().split('T')[1]?.split('.')[0] || '',
      participants: metadata.participants,
      tags: metadata.tags,
      source: metadata.source,
      emailId: metadata.emailId,
      transcriptHash: metadata.transcriptHash,
      createdAt: metadata.createdAt.toISOString(),
      updatedAt: metadata.updatedAt.toISOString(),
      type: 'meeting-note',
    };

    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    return `---\n${yaml}\n---`;
  }

  /**
   * Format tasks for Obsidian
   */
  private formatTasks(tasks: ExtractedTask[]): string {
    if (tasks.length === 0) {
      return '- No tasks identified';
    }

    // Group tasks by category
    const grouped = this.groupTasksByCategory(tasks);
    const sections: string[] = [];

    for (const [category, categoryTasks] of Object.entries(grouped)) {
      sections.push(`### ${this.capitalizeCategory(category)}`);
      
      categoryTasks.forEach(task => {
        const checkbox = '- [ ]';
        const priority = this.getPriorityEmoji(task.priority);
        const assignee = task.assignee !== 'me' ? ` @[[${task.assignee}]]` : '';
        const due = task.dueDate ? ` 📅 ${this.formatDueDate(task.dueDate)}` : '';
        const confidence = task.confidence < 70 ? ' ❓' : '';
        
        sections.push(`${checkbox} ${priority} ${task.description}${assignee}${due}${confidence}`);
        
        if (task.context) {
          sections.push(`  - Context: ${task.context}`);
        }
      });
      
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Group tasks by category
   */
  private groupTasksByCategory(tasks: ExtractedTask[]): Record<string, ExtractedTask[]> {
    const grouped: Record<string, ExtractedTask[]> = {};
    
    tasks.forEach(task => {
      const category = task.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(task);
    });

    // Sort tasks within each category by priority
    for (const category of Object.keys(grouped)) {
      grouped[category]?.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }

    return grouped;
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: 'high' | 'medium' | 'low'): string {
    return {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
    }[priority];
  }

  /**
   * Format due date for Obsidian
   */
  private formatDueDate(dueDate: string | undefined): string {
    if (!dueDate) return '';
    try {
      const date = new Date(dueDate);
      return date.toISOString().split('T')[0] || '';
    } catch {
      return dueDate; // Return as-is if not parseable
    }
  }

  /**
   * Capitalize category name
   */
  private capitalizeCategory(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Generate meeting title
   */
  private generateMeetingTitle(
    extraction: TaskExtractionResult,
    originalFilename?: string
  ): string {
    // Try to extract from filename first
    if (originalFilename) {
      const cleaned = originalFilename
        .replace(/\.(pdf|docx?|txt|html)$/i, '')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned.length > 5 && cleaned.length < 100) {
        return cleaned;
      }
    }

    // Generate from date and participants
    const dateStr = extraction.meetingDate.toISOString().split('T')[0];
    const participantStr = extraction.participants.slice(0, 3).join(', ');
    
    return `Meeting ${dateStr}${participantStr ? ` - ${participantStr}` : ''}`;
  }

  /**
   * Generate tags for the note
   */
  private generateTags(extraction: TaskExtractionResult): string[] {
    const tags = ['meeting', 'transcript'];
    
    // Add tags based on task categories
    const categories = new Set(extraction.tasks.map(t => t.category).filter(Boolean));
    categories.forEach(cat => {
      if (cat && cat !== 'other') {
        tags.push(`meeting/${cat}`);
      }
    });

    // Add priority tag if high priority tasks exist
    if (extraction.tasks.some(t => t.priority === 'high')) {
      tags.push('high-priority');
    }

    return tags;
  }

  /**
   * Generate hash for content
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Save note to vault
   */
  private async saveNote(
    metadata: ObsidianNoteMetadata,
    content: string
  ): Promise<string> {
    // Generate filename
    const dateStr = metadata.date.toISOString().split('T')[0];
    const safeTitle = metadata.title.replace(/[<>:"/\\|?*]/g, '-').substring(0, 100);
    const filename = `${dateStr} - ${safeTitle}.md`;
    
    // Determine folder (use year/month structure)
    const year = metadata.date.getFullYear();
    const month = String(metadata.date.getMonth() + 1).padStart(2, '0');
    const folderPath = path.join(this.vaultPath, this.meetingsFolder, String(year), month);
    
    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });
    
    // Save file
    const filepath = path.join(folderPath, filename);
    await fs.writeFile(filepath, content, 'utf-8');
    
    // Return relative path from vault root
    return path.relative(this.vaultPath, filepath);
  }

  /**
   * Append tasks to existing note
   */
  private appendTasksToNote(existingContent: string, newTasks: ExtractedTask[]): string {
    const tasksSection = this.formatTasks(newTasks);
    const marker = '## Tasks';
    
    if (existingContent.includes(marker)) {
      // Find the tasks section and append
      const lines = existingContent.split('\n');
      const taskIndex = lines.findIndex(line => line === marker);
      
      if (taskIndex !== -1) {
        // Find the end of tasks section (next ## or end of file)
        let endIndex = lines.findIndex((line, i) => i > taskIndex && line.startsWith('## '));
        if (endIndex === -1) endIndex = lines.length;
        
        // Insert new tasks
        lines.splice(endIndex, 0, '', '### New Tasks (Added ' + new Date().toLocaleDateString() + ')', tasksSection);
        return lines.join('\n');
      }
    }
    
    // If no tasks section found, append at end
    return existingContent + '\n\n' + tasksSection;
  }

  /**
   * Replace tasks in existing note
   */
  private replaceTasksInNote(existingContent: string, newTasks: ExtractedTask[]): string {
    const tasksSection = this.formatTasks(newTasks);
    const marker = '## Tasks';
    
    if (existingContent.includes(marker)) {
      const lines = existingContent.split('\n');
      const taskIndex = lines.findIndex(line => line === marker);
      
      if (taskIndex !== -1) {
        // Find the end of tasks section
        let endIndex = lines.findIndex((line, i) => i > taskIndex + 1 && line.startsWith('## '));
        if (endIndex === -1) endIndex = lines.length;
        
        // Replace tasks section
        lines.splice(taskIndex + 1, endIndex - taskIndex - 1, tasksSection);
        return lines.join('\n');
      }
    }
    
    return existingContent;
  }

  /**
   * Update note metadata in frontmatter
   */
  private updateNoteMetadata(content: string, updates: Record<string, any>): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (frontmatterMatch) {
      let frontmatter = frontmatterMatch[1];
      
      for (const [key, value] of Object.entries(updates)) {
        const pattern = new RegExp(`^${key}:.*$`, 'm');
        const replacement = `${key}: ${value instanceof Date ? value.toISOString() : (value || '')}`;
        
        if (frontmatter && pattern.test(frontmatter)) {
          frontmatter = frontmatter.replace(pattern, replacement);
        } else {
          frontmatter += `\n${replacement}`;
        }
      }
      
      return content.replace(frontmatterMatch[0], `---\n${frontmatter}\n---`);
    }
    
    return content;
  }

  /**
   * Get all markdown files in a directory
   */
  private async getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logWarn(`Failed to read directory: ${dir}`, error as any);
    }
    
    return files;
  }

  /**
   * Ensure meeting template exists
   */
  private async ensureMeetingTemplate(): Promise<void> {
    const templatePath = path.join(this.vaultPath, this.templatesFolder, 'Meeting Template.md');
    
    try {
      await fs.access(templatePath);
    } catch {
      // Template doesn't exist, create it
      const template = `---
title: {{title}}
date: {{date}}
participants: []
tags:
  - meeting
  - template
---

# {{title}}

## Meeting Summary


## Participants
- 

## Key Decisions
- 

## Tasks
- [ ] 

## Next Steps
- 

## Notes


---
*Created from template on {{date}}*`;

      await fs.writeFile(templatePath, template, 'utf-8');
      logInfo('Created meeting template');
    }
  }

  /**
   * Link to daily note
   */
  async linkToDailyNote(meetingPath: string, date: Date): Promise<void> {
    const dailyNotePath = path.join(
      this.vaultPath,
      this.dailyNotesFolder,
      date.toISOString().split('T')[0] + '.md'
    );

    try {
      let content: string;
      
      try {
        content = await fs.readFile(dailyNotePath, 'utf-8');
      } catch {
        // Daily note doesn't exist, create it
        content = `# ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n## Meetings\n\n## Tasks\n\n## Notes\n`;
      }

      // Add meeting link if not already present
      const meetingLink = `[[${meetingPath.replace('.md', '')}]]`;
      if (!content.includes(meetingLink)) {
        const meetingsSection = '## Meetings';
        const lines = content.split('\n');
        const meetingIndex = lines.findIndex(line => line === meetingsSection);
        
        if (meetingIndex !== -1) {
          lines.splice(meetingIndex + 1, 0, `- ${meetingLink}`);
          content = lines.join('\n');
        } else {
          content += `\n## Meetings\n- ${meetingLink}\n`;
        }

        await fs.writeFile(dailyNotePath, content, 'utf-8');
        logDebug(`Linked meeting to daily note: ${date.toISOString().split('T')[0]}`);
      }
    } catch (error) {
      logWarn('Failed to link to daily note', error as any);
    }
  }

  /**
   * Get vault statistics
   */
  async getVaultStats(): Promise<Record<string, any>> {
    const meetingsPath = path.join(this.vaultPath, this.meetingsFolder);
    const files = await this.getAllMarkdownFiles(meetingsPath);
    
    let totalTasks = 0;
    let completedTasks = 0;
    let meetings = files.length;
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const taskMatches = content.match(/- \[([ x])\]/g);
      
      if (taskMatches) {
        totalTasks += taskMatches.length;
        completedTasks += taskMatches.filter(m => m.includes('[x]')).length;
      }
    }

    return {
      meetings,
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) + '%' : '0%',
    };
  }
}

// Export singleton instance
export const obsidianService = new ObsidianService();