import { TranscriptParser } from './transcriptParser';
import fs from 'fs/promises';
import path from 'path';

// Mock external dependencies
jest.mock('pdf-parse');
jest.mock('mammoth');
jest.mock('node-html-parser');

// Mock logger
jest.mock('../utils/logger', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

// Mock config
jest.mock('../config/config', () => ({
  config: {
    performance: {
      cleanupTempFiles: true,
    },
  },
}));

describe('TranscriptParser', () => {
  let parser: TranscriptParser;

  beforeEach(() => {
    parser = new TranscriptParser();
  });

  describe('parseTranscript', () => {
    it('should parse plain text transcript', async () => {
      const text = `Meeting Transcript
      
Speaker 1: Let's discuss the project timeline.
Speaker 2: We need to complete the API by next week.
Speaker 1: I'll handle the database schema.
Action Item: Review the design documents by Friday.`;

      const buffer = Buffer.from(text, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'transcript.txt', 'text/plain');

      expect(result.format).toBe('plain');
      expect(result.text).toBe(text);
      expect(result.sections).toBeDefined();
      expect(result.sections?.length).toBeGreaterThan(0);
      expect(result.extractedTasks).toBeDefined();
      expect(result.extractedTasks?.length).toBeGreaterThan(0);
      expect(result.extractedTasks?.[0]).toContain('handle the database schema');
    });

    it('should extract sections with speakers', async () => {
      const text = `John Smith: Welcome everyone to the meeting.
Jane Doe: Thank you for joining.
Speaker 3: Let's get started with the agenda.
[Bob] I have a question about the timeline.`;

      const buffer = Buffer.from(text, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'meeting.txt', 'text/plain');

      expect(result.sections).toBeDefined();
      expect(result.sections?.length).toBe(4);
      expect(result.sections?.[0]?.speaker).toBe('John Smith');
      expect(result.sections?.[1]?.speaker).toBe('Jane Doe');
      expect(result.sections?.[2]?.speaker).toBe('Speaker 3');
      expect(result.sections?.[3]?.speaker).toBe('Bob');
    });

    it('should extract tasks from transcript', async () => {
      const text = `Discussion transcript:
      
We need to complete the documentation.
Action item: Update the README file.
TODO: Add unit tests for the new module.
I'll schedule a follow-up meeting.
John will review the code by tomorrow.
Make sure to test the deployment process.`;

      const buffer = Buffer.from(text, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'tasks.txt', 'text/plain');

      expect(result.extractedTasks).toBeDefined();
      expect(result.extractedTasks?.length).toBeGreaterThan(0);
      
      const tasks = result.extractedTasks || [];
      expect(tasks.some(t => t.includes('Update the README'))).toBe(true);
      expect(tasks.some(t => t.includes('Add unit tests'))).toBe(true);
      expect(tasks.some(t => t.includes('schedule a follow-up'))).toBe(true);
    });

    it('should parse VTT format', async () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
<v Speaker 1>Welcome to the meeting.

00:00:05.000 --> 00:00:10.000
<v Speaker 2>Let's discuss the project.

00:00:10.000 --> 00:00:15.000
We need to finish by Friday.`;

      const buffer = Buffer.from(vttContent, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'meeting.vtt', 'text/vtt');

      expect(result.format).toBe('vtt');
      expect(result.sections).toBeDefined();
      expect(result.sections?.length).toBeGreaterThan(0);
      expect(result.sections?.[0]?.timestamp).toBe('00:00:00.000');
      expect(result.sections?.[0]?.speaker).toBe('Speaker 1');
      expect(result.sections?.[0]?.text).toContain('Welcome to the meeting');
    });

    it('should parse SRT format', async () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Welcome to the meeting.

2
00:00:05,000 --> 00:00:10,000
Let's discuss the project timeline.

3
00:00:10,000 --> 00:00:15,000
Action item: Complete the review.`;

      const buffer = Buffer.from(srtContent, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'meeting.srt', 'text/srt');

      expect(result.format).toBe('srt');
      expect(result.sections).toBeDefined();
      expect(result.sections?.length).toBe(3);
      expect(result.sections?.[0]?.timestamp).toBe('00:00:00.000');
      expect(result.extractedTasks?.length).toBeGreaterThan(0);
    });

    it('should handle unknown format as plain text', async () => {
      const text = 'This is some content in an unknown format.';
      const buffer = Buffer.from(text, 'utf-8');
      
      const result = await parser.parseTranscript(buffer, 'unknown.xyz', 'application/unknown');
      
      expect(result.format).toBe('plain');
      expect(result.text).toBe(text);
    });
  });

  describe('determineFormat', () => {
    it('should determine format from mime type', async () => {
      const testCases = [
        { filename: 'file.txt', mimeType: 'application/pdf', expected: 'pdf' },
        { filename: 'file.doc', mimeType: 'text/plain', expected: 'plain' },
        { filename: 'file', mimeType: 'text/vtt', expected: 'vtt' },
      ];

      for (const testCase of testCases) {
        const buffer = Buffer.from('test');
        const result = await parser.parseTranscript(
          buffer,
          testCase.filename,
          testCase.mimeType
        );
        expect(result.format).toBe(testCase.expected);
      }
    });

    it('should determine format from file extension', async () => {
      const testCases = [
        { filename: 'transcript.pdf', expected: 'pdf' },
        { filename: 'notes.docx', expected: 'docx' },
        { filename: 'meeting.vtt', expected: 'vtt' },
        { filename: 'captions.srt', expected: 'srt' },
      ];

      for (const testCase of testCases) {
        const buffer = Buffer.from('test');
        const result = await parser.parseTranscript(
          buffer,
          testCase.filename,
          'application/octet-stream'
        );
        expect(result.format).toBe(testCase.expected);
      }
    });
  });

  describe('extractTasks', () => {
    it('should filter out false positive tasks', async () => {
      const text = `Meeting notes:
      
Are you available tomorrow?
Thank you for your help.
I think we should proceed.
Action item: Send the report by EOD.
Will complete the implementation today.`;

      const buffer = Buffer.from(text, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'notes.txt', 'text/plain');

      const tasks = result.extractedTasks || [];
      
      // Should include real tasks
      expect(tasks.some(t => t.includes('Send the report'))).toBe(true);
      expect(tasks.some(t => t.includes('complete the implementation'))).toBe(true);
      
      // Should not include false positives
      expect(tasks.some(t => t.includes('Are you available'))).toBe(false);
      expect(tasks.some(t => t.includes('Thank you'))).toBe(false);
    });

    it('should deduplicate extracted tasks', async () => {
      const text = `Discussion:
      
We need to update the documentation.
Action: Update the documentation.
TODO: Update the documentation with examples.`;

      const buffer = Buffer.from(text, 'utf-8');
      const result = await parser.parseTranscript(buffer, 'notes.txt', 'text/plain');

      const tasks = result.extractedTasks || [];
      
      // Should have unique tasks
      const uniqueTasks = [...new Set(tasks)];
      expect(tasks.length).toBe(uniqueTasks.length);
    });
  });

  describe('file operations', () => {
    const tempDir = path.join(process.cwd(), 'data', 'temp');

    afterEach(async () => {
      // Cleanup test files
      try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          if (file.startsWith('test_')) {
            await fs.unlink(path.join(tempDir, file));
          }
        }
      } catch {
        // Directory might not exist
      }
    });

    it('should save transcript to file', async () => {
      await parser.initialize();
      
      const content = {
        text: 'Test transcript content',
        format: 'plain' as const,
        metadata: { wordCount: 3 },
        extractedTasks: ['Task 1', 'Task 2'],
      };

      const outputPath = await parser.saveTranscriptToFile(content, 'test_transcript');
      
      expect(outputPath).toContain('test_transcript.txt');
      
      const savedContent = await fs.readFile(outputPath, 'utf-8');
      expect(savedContent).toContain('Test transcript content');
      expect(savedContent).toContain('Task 1');
      expect(savedContent).toContain('Task 2');
    });

    it('should cleanup old temporary files', async () => {
      await parser.initialize();
      
      // Create an old file (mock old timestamp)
      const oldFile = path.join(tempDir, 'test_old_file.txt');
      await fs.writeFile(oldFile, 'old content');
      
      // Modify the file's time to be old
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      await fs.utimes(oldFile, oldTime, oldTime);
      
      // Create a recent file
      const recentFile = path.join(tempDir, 'test_recent_file.txt');
      await fs.writeFile(recentFile, 'recent content');
      
      // Run cleanup
      await parser.cleanup();
      
      // Check that old file is deleted and recent file remains
      const files = await fs.readdir(tempDir);
      expect(files).not.toContain('test_old_file.txt');
      expect(files).toContain('test_recent_file.txt');
    });
  });
});