import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as parseHTML } from 'node-html-parser';
import { logDebug, logError, logWarn } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/config';

export interface TranscriptContent {
  text: string;
  format: 'plain' | 'pdf' | 'docx' | 'doc' | 'html' | 'vtt' | 'srt' | 'unknown';
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    creationDate?: Date;
    author?: string;
    title?: string;
  };
  sections?: TranscriptSection[];
  extractedTasks?: string[];
}

export interface TranscriptSection {
  timestamp?: string;
  speaker?: string;
  text: string;
}

export class TranscriptParser {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'data', 'temp');
  }

  /**
   * Initialize temp directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logDebug(`Initialized temp directory: ${this.tempDir}`);
    } catch (error) {
      logError('Failed to create temp directory', error);
      throw error;
    }
  }

  /**
   * Parse transcript from buffer based on mime type
   */
  async parseTranscript(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<TranscriptContent> {
    logDebug(`Parsing transcript: ${filename} (${mimeType})`);

    // Determine format from mime type or file extension
    const format = this.determineFormat(filename, mimeType);

    try {
      switch (format) {
        case 'plain':
          return await this.parsePlainText(buffer);
        case 'pdf':
          return await this.parsePDF(buffer);
        case 'docx':
          return await this.parseDOCX(buffer);
        case 'doc':
          return await this.parseDOC(buffer);
        case 'html':
          return await this.parseHTML(buffer);
        case 'vtt':
          return await this.parseVTT(buffer);
        case 'srt':
          return await this.parseSRT(buffer);
        default:
          // Try to parse as plain text by default
          logWarn(`Unknown format for ${filename}, attempting plain text parsing`);
          return await this.parsePlainText(buffer);
      }
    } catch (error) {
      logError(`Failed to parse transcript ${filename}`, error);
      throw error;
    }
  }

  /**
   * Parse transcript from file path
   */
  async parseTranscriptFile(filePath: string): Promise<TranscriptContent> {
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // Guess mime type from extension
    const mimeTypeMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.html': 'text/html',
      '.vtt': 'text/vtt',
      '.srt': 'text/srt',
    };
    
    const mimeType = mimeTypeMap[ext] || 'application/octet-stream';
    return this.parseTranscript(buffer, filename, mimeType);
  }

  /**
   * Determine format from filename and mime type
   */
  private determineFormat(
    filename: string,
    mimeType: string
  ): TranscriptContent['format'] {
    const ext = path.extname(filename).toLowerCase();

    // Check by mime type first
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('wordprocessingml')) return 'docx';
    if (mimeType.includes('msword')) return 'doc';
    if (mimeType.includes('html')) return 'html';
    if (mimeType.includes('plain')) return 'plain';
    if (mimeType.includes('vtt')) return 'vtt';
    if (mimeType.includes('srt')) return 'srt';

    // Check by file extension
    switch (ext) {
      case '.pdf':
        return 'pdf';
      case '.docx':
        return 'docx';
      case '.doc':
        return 'doc';
      case '.html':
      case '.htm':
        return 'html';
      case '.txt':
        return 'plain';
      case '.vtt':
        return 'vtt';
      case '.srt':
        return 'srt';
      default:
        return 'unknown';
    }
  }

  /**
   * Parse plain text transcript
   */
  private async parsePlainText(buffer: Buffer): Promise<TranscriptContent> {
    const text = buffer.toString('utf-8');
    const sections = this.extractSections(text);
    const tasks = this.extractTasks(text);

    return {
      text,
      format: 'plain',
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
      sections,
      extractedTasks: tasks,
    };
  }

  /**
   * Parse PDF transcript
   */
  private async parsePDF(buffer: Buffer): Promise<TranscriptContent> {
    try {
      const data = await pdfParse(buffer);
      const sections = this.extractSections(data.text);
      const tasks = this.extractTasks(data.text);

      return {
        text: data.text,
        format: 'pdf',
        metadata: {
          pageCount: data.numpages,
          wordCount: data.text.split(/\s+/).length,
          title: data.info?.Title,
          author: data.info?.Author,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
        },
        sections,
        extractedTasks: tasks,
      };
    } catch (error) {
      logError('PDF parsing failed', error);
      throw new Error(`Failed to parse PDF: ${error}`);
    }
  }

  /**
   * Parse DOCX transcript
   */
  private async parseDOCX(buffer: Buffer): Promise<TranscriptContent> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      const sections = this.extractSections(text);
      const tasks = this.extractTasks(text);

      if (result.messages && result.messages.length > 0) {
        logWarn('DOCX parsing warnings:', result.messages);
      }

      return {
        text,
        format: 'docx',
        metadata: {
          wordCount: text.split(/\s+/).length,
        },
        sections,
        extractedTasks: tasks,
      };
    } catch (error) {
      logError('DOCX parsing failed', error);
      throw new Error(`Failed to parse DOCX: ${error}`);
    }
  }

  /**
   * Parse DOC transcript (legacy Word format)
   */
  private async parseDOC(buffer: Buffer): Promise<TranscriptContent> {
    // Mammoth can handle .doc files as well
    return this.parseDOCX(buffer);
  }

  /**
   * Parse HTML transcript
   */
  private async parseHTML(buffer: Buffer): Promise<TranscriptContent> {
    const html = buffer.toString('utf-8');
    const root = parseHTML(html);
    
    // Remove script and style tags
    root.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Extract text content
    const text = root.textContent || '';
    const sections = this.extractSections(text);
    const tasks = this.extractTasks(text);

    return {
      text,
      format: 'html',
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
      sections,
      extractedTasks: tasks,
    };
  }

  /**
   * Parse VTT (WebVTT) subtitle format
   */
  private async parseVTT(buffer: Buffer): Promise<TranscriptContent> {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    const sections: TranscriptSection[] = [];
    let currentSection: Partial<TranscriptSection> = {};

    for (const line of lines) {
      // Skip WEBVTT header and empty lines
      if (line.startsWith('WEBVTT') || line.trim() === '') continue;

      // Timestamp line (e.g., "00:00:00.000 --> 00:00:05.000")
      if (line.includes('-->')) {
        const [start] = line.split('-->').map(t => t.trim());
        currentSection.timestamp = start;
      }
      // Speaker or text line
      else if (line.trim() && !line.match(/^\d+$/)) {
        // Check if line contains speaker (e.g., "<v Speaker Name>text")
        const speakerMatch = line.match(/^<v\s+([^>]+)>(.*)$/);
        if (speakerMatch) {
          currentSection.speaker = speakerMatch[1];
          currentSection.text = speakerMatch[2];
        } else {
          currentSection.text = (currentSection.text || '') + ' ' + line;
        }

        // If we have a complete section, add it
        if (currentSection.timestamp && currentSection.text) {
          sections.push({
            timestamp: currentSection.timestamp,
            speaker: currentSection.speaker,
            text: currentSection.text.trim(),
          });
          currentSection = {};
        }
      }
    }

    const fullText = sections.map(s => `${s.speaker ? s.speaker + ': ' : ''}${s.text}`).join('\n');
    const tasks = this.extractTasks(fullText);

    return {
      text: fullText,
      format: 'vtt',
      metadata: {
        wordCount: fullText.split(/\s+/).length,
      },
      sections,
      extractedTasks: tasks,
    };
  }

  /**
   * Parse SRT subtitle format
   */
  private async parseSRT(buffer: Buffer): Promise<TranscriptContent> {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    const sections: TranscriptSection[] = [];
    let currentSection: Partial<TranscriptSection> = {};
    let isTimestamp = false;

    for (const line of lines) {
      // Skip sequence numbers and empty lines
      if (line.match(/^\d+$/) || line.trim() === '') {
        if (currentSection.text) {
          sections.push({
            timestamp: currentSection.timestamp,
            speaker: currentSection.speaker,
            text: currentSection.text.trim(),
          });
          currentSection = {};
        }
        continue;
      }

      // Timestamp line (e.g., "00:00:00,000 --> 00:00:05,000")
      if (line.includes('-->')) {
        const [start] = line.split('-->').map(t => t.trim());
        if (start) {
          currentSection.timestamp = start.replace(',', '.');
        }
        isTimestamp = true;
      }
      // Text line
      else if (isTimestamp) {
        currentSection.text = (currentSection.text || '') + ' ' + line;
      }
    }

    // Add last section if exists
    if (currentSection.text) {
      sections.push({
        timestamp: currentSection.timestamp,
        text: currentSection.text.trim(),
      });
    }

    const fullText = sections.map(s => s.text).join('\n');
    const tasks = this.extractTasks(fullText);

    return {
      text: fullText,
      format: 'srt',
      metadata: {
        wordCount: fullText.split(/\s+/).length,
      },
      sections,
      extractedTasks: tasks,
    };
  }

  /**
   * Extract sections from transcript text
   */
  private extractSections(text: string): TranscriptSection[] {
    const sections: TranscriptSection[] = [];
    const lines = text.split('\n');

    // Pattern for speaker identification
    const speakerPatterns = [
      /^([A-Z][a-z]+ [A-Z][a-z]+):\s*(.*)$/, // "John Smith: text"
      /^(Speaker \d+):\s*(.*)$/, // "Speaker 1: text"
      /^(Participant \d+):\s*(.*)$/, // "Participant 1: text"
      /^\[([^\]]+)\]\s*(.*)$/, // "[John] text"
      /^(\d{2}:\d{2}:\d{2})\s+([^:]+):\s*(.*)$/, // "00:01:23 John: text"
    ];

    for (const line of lines) {
      if (!line.trim()) continue;

      let matched = false;
      for (const pattern of speakerPatterns) {
        const match = line.match(pattern);
        if (match) {
          if (match.length === 4) {
            // Timestamp + speaker + text
            sections.push({
              timestamp: match[1] || '',
              speaker: match[2] || '',
              text: match[3] || '',
            });
          } else if (match.length === 3) {
            // Speaker + text
            sections.push({
              speaker: match[1] || '',
              text: match[2] || '',
            });
          }
          matched = true;
          break;
        }
      }

      // If no pattern matched, add as text without speaker
      if (!matched && line.trim()) {
        // Check if it's a continuation of the previous section
        if (sections.length > 0 && !line.match(/^[A-Z]/)) {
          const lastSection = sections[sections.length - 1];
          if (lastSection) {
            lastSection.text += ' ' + line.trim();
          }
        } else {
          sections.push({ text: line.trim() });
        }
      }
    }

    return sections;
  }

  /**
   * Extract tasks from transcript text
   */
  private extractTasks(text: string): string[] {
    const tasks: string[] = [];
    const lines = text.split('\n');

    // Task patterns
    const taskPatterns = [
      /(?:action item|todo|task|follow[- ]up|will do|assigned to \w+|needs? to|should|must|have to|going to):\s*(.+)/i,
      /^[-*]\s*(?:TODO|ACTION|TASK):\s*(.+)/i,
      /(?:I'll|We'll|You'll|They'll|He'll|She'll)\s+(.+?)(?:\.|$)/i,
      /(?:need(?:s)? to|should|must|will)\s+(\w+\s+.+?)(?:\.|$)/i,
      /(?:make sure|ensure|verify|check|confirm)\s+(?:that\s+)?(.+?)(?:\.|$)/i,
    ];

    for (const line of lines) {
      for (const pattern of taskPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const task = match[1].trim();
          
          // Filter out common false positives
          if (task.length > 10 && task.length < 200) {
            if (!this.isLikelyFalsePositive(task)) {
              tasks.push(task);
            }
          }
        }
      }
    }

    // Deduplicate tasks
    return [...new Set(tasks)];
  }

  /**
   * Check if extracted task is likely a false positive
   */
  private isLikelyFalsePositive(task: string): boolean {
    const falsePositivePatterns = [
      /^(be|have|get|see|hear|think|know|feel)\s/i,
      /^(yes|no|okay|ok|sure|right|exactly|correct)/i,
      /^(thank|please|sorry|excuse)/i,
      /\?$/,  // Questions
      /^(is|are|was|were|am)\s/i,  // Questions starting with be verbs
    ];

    return falsePositivePatterns.some(pattern => pattern.test(task));
  }

  /**
   * Save transcript to file for debugging
   */
  async saveTranscriptToFile(
    content: TranscriptContent,
    filename: string
  ): Promise<string> {
    await this.initialize();
    
    const outputPath = path.join(this.tempDir, `${filename}.txt`);
    const contentToSave = [
      `Format: ${content.format}`,
      `Word Count: ${content.metadata?.wordCount || 'unknown'}`,
      '',
      '=== TRANSCRIPT ===',
      content.text,
      '',
      '=== EXTRACTED TASKS ===',
      ...(content.extractedTasks || []).map((task, i) => `${i + 1}. ${task}`),
    ].join('\n');

    await fs.writeFile(outputPath, contentToSave, 'utf-8');
    logDebug(`Saved transcript to: ${outputPath}`);
    
    return outputPath;
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    if (!config.performance.cleanupTempFiles) {
      logDebug('Temp file cleanup disabled by configuration');
      return;
    }

    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          logDebug(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      logWarn('Failed to cleanup temp files', error as any);
    }
  }
}

// Export singleton instance
export const transcriptParser = new TranscriptParser();