import { ObsidianService } from './obsidianService';
import { TaskExtractionResult, ExtractedTask } from '../extractors/claudeTaskExtractor';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
jest.mock('fs/promises');
jest.mock('../utils/logger');

describe('ObsidianService', () => {
  let service: ObsidianService;
  const mockVaultPath = '/test/vault';
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['OBSIDIAN_VAULT_PATH'] = mockVaultPath;
    service = new ObsidianService();
    
    // Mock fs.access to simulate vault exists
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    // Mock fs.mkdir
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    // Mock fs.writeFile
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    // Mock fs.readFile
    (fs.readFile as jest.Mock).mockResolvedValue('existing content');
    // Mock fs.readdir
    (fs.readdir as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env['OBSIDIAN_VAULT_PATH'];
  });

  describe('initialize', () => {
    it('should create required folder structure', async () => {
      await service.initialize();

      expect(fs.access).toHaveBeenCalledWith(mockVaultPath);
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockVaultPath, 'Meetings'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockVaultPath, 'Templates'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockVaultPath, 'Daily Notes'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockVaultPath, 'Attachments/Meetings'),
        { recursive: true }
      );
    });

    it('should throw error if vault path not configured', async () => {
      delete process.env['OBSIDIAN_VAULT_PATH'];
      const service = new ObsidianService();
      
      await expect(service.initialize()).rejects.toThrow(
        'Obsidian vault path not configured'
      );
    });

    it('should throw error if vault does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('Not found'));
      
      await expect(service.initialize()).rejects.toThrow(
        `Obsidian vault not found at: ${mockVaultPath}`
      );
    });
  });

  describe('createMeetingNote', () => {
    const mockExtraction: TaskExtractionResult = {
      tasks: [
        {
          description: 'Test task 1',
          assignee: 'me',
          priority: 'high',
          confidence: 90,
          category: 'engineering',
        },
        {
          description: 'Test task 2',
          assignee: 'John',
          priority: 'medium',
          confidence: 75,
          dueDate: '2024-01-15',
          category: 'product',
        },
      ],
      summary: 'Test meeting summary',
      participants: ['John', 'Jane'],
      meetingDate: new Date('2024-01-10'),
      keyDecisions: ['Decision 1', 'Decision 2'],
      nextSteps: ['Next step 1'],
      confidence: 85,
    };

    it('should create a meeting note with proper formatting', async () => {
      const result = await service.createMeetingNote(
        mockExtraction,
        'email123',
        'Test Meeting.pdf'
      );

      expect(result.metadata.title).toContain('Test Meeting');
      expect(result.metadata.participants).toEqual(['John', 'Jane']);
      expect(result.metadata.emailId).toBe('email123');
      
      // Check that file was written
      expect(fs.writeFile).toHaveBeenCalled();
      const [filePath, content] = (fs.writeFile as jest.Mock).mock.calls[0];
      
      // Check file path structure (year/month)
      expect(filePath).toContain('2024');
      expect(filePath).toContain('01');
      expect(filePath).toContain('.md');
      
      // Check content includes key sections
      expect(content).toContain('# Test Meeting');
      expect(content).toContain('## Meeting Summary');
      expect(content).toContain('Test meeting summary');
      expect(content).toContain('## Tasks');
      expect(content).toContain('- [ ] 🔴 Test task 1');
      expect(content).toContain('- [ ] 🟡 Test task 2 @[[John]] 📅 2024-01-15');
      expect(content).toContain('## Key Decisions');
      expect(content).toContain('Decision 1');
    });

    it('should group tasks by category', async () => {
      await service.createMeetingNote(mockExtraction, 'email123');

      const content = (fs.writeFile as jest.Mock).mock.calls[0][1];
      
      expect(content).toContain('### Engineering');
      expect(content).toContain('### Product');
    });

    it('should generate tags based on content', async () => {
      const result = await service.createMeetingNote(mockExtraction, 'email123');

      expect(result.metadata.tags).toContain('meeting');
      expect(result.metadata.tags).toContain('transcript');
      expect(result.metadata.tags).toContain('meeting/engineering');
      expect(result.metadata.tags).toContain('meeting/product');
      expect(result.metadata.tags).toContain('high-priority');
    });
  });

  describe('findExistingNote', () => {
    it('should find note by email ID', async () => {
      // const mockFiles = [
      //   '/test/vault/Meetings/2024/01/meeting1.md',
      //   '/test/vault/Meetings/2024/01/meeting2.md',
      // ];
      
      (fs.readdir as jest.Mock).mockResolvedValue([
        { name: '2024', isDirectory: () => true, isFile: () => false },
      ]);
      
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('---\nemailId: other\n---\nContent')
        .mockResolvedValueOnce('---\nemailId: email123\n---\nContent');

      const result = await service.findExistingNote('email123', 'hash123');

      expect(result).toBeTruthy();
    });

    it('should find note by transcript hash', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        '---\ntranscriptHash: hash123\n---\nContent'
      );

      const result = await service.findExistingNote('email456', 'hash123');

      expect(result).toBeTruthy();
    });

    it('should return null if no matching note found', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        '---\nemailId: other\n---\nContent'
      );

      const result = await service.findExistingNote('email123', 'hash123');

      expect(result).toBeNull();
    });
  });

  describe('updateMeetingNote', () => {
    const mockTasks: ExtractedTask[] = [
      {
        description: 'New task',
        assignee: 'me',
        priority: 'high',
        confidence: 90,
        category: 'engineering',
      },
    ];

    const mockExtraction: TaskExtractionResult = {
      tasks: mockTasks,
      summary: 'Updated summary',
      participants: [],
      meetingDate: new Date(),
      keyDecisions: [],
      nextSteps: [],
      confidence: 85,
    };

    it('should update existing note with new tasks', async () => {
      const existingContent = `---
title: Test Meeting
updatedAt: 2024-01-01T00:00:00.000Z
---

# Test Meeting

## Tasks
- [ ] Old task

## Next Steps`;

      (fs.readFile as jest.Mock).mockResolvedValue(existingContent);

      await service.updateMeetingNote('test.md', mockExtraction, false);

      expect(fs.writeFile).toHaveBeenCalled();
      const updatedContent = (fs.writeFile as jest.Mock).mock.calls[0][1];
      
      expect(updatedContent).toContain('- [ ] 🔴 New task');
      expect(updatedContent).not.toContain('Old task');
    });

    it('should append tasks when appendTasks is true', async () => {
      const existingContent = `---
title: Test Meeting
---

# Test Meeting

## Tasks
- [ ] Old task

## Next Steps`;

      (fs.readFile as jest.Mock).mockResolvedValue(existingContent);

      await service.updateMeetingNote('test.md', mockExtraction, true);

      const updatedContent = (fs.writeFile as jest.Mock).mock.calls[0][1];
      
      expect(updatedContent).toContain('Old task');
      expect(updatedContent).toContain('New Tasks (Added');
      expect(updatedContent).toContain('- [ ] 🔴 New task');
    });

    it('should update metadata timestamp', async () => {
      const existingContent = `---
title: Test Meeting
updatedAt: 2024-01-01T00:00:00.000Z
---

Content`;

      (fs.readFile as jest.Mock).mockResolvedValue(existingContent);

      await service.updateMeetingNote('test.md', mockExtraction);

      const updatedContent = (fs.writeFile as jest.Mock).mock.calls[0][1];
      
      expect(updatedContent).toMatch(/updatedAt: \d{4}-\d{2}-\d{2}T/);
      expect(updatedContent).not.toContain('2024-01-01T00:00:00.000Z');
    });
  });

  describe('linkToDailyNote', () => {
    it('should create daily note if it does not exist', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Not found'));

      await service.linkToDailyNote('Meetings/2024/01/meeting.md', new Date('2024-01-10'));

      expect(fs.writeFile).toHaveBeenCalled();
      const [filePath, content] = (fs.writeFile as jest.Mock).mock.calls[0];
      
      expect(filePath).toContain('Daily Notes');
      expect(filePath).toContain('2024-01-10.md');
      expect(content).toContain('## Meetings');
      expect(content).toContain('[[Meetings/2024/01/meeting]]');
    });

    it('should add meeting link to existing daily note', async () => {
      const existingDaily = `# Wednesday, January 10, 2024

## Meetings

## Tasks`;

      (fs.readFile as jest.Mock).mockResolvedValue(existingDaily);

      await service.linkToDailyNote('Meetings/2024/01/meeting.md', new Date('2024-01-10'));

      const updatedContent = (fs.writeFile as jest.Mock).mock.calls[0][1];
      
      expect(updatedContent).toContain('## Meetings\n- [[Meetings/2024/01/meeting]]');
    });

    it('should not add duplicate links', async () => {
      const existingDaily = `# Wednesday, January 10, 2024

## Meetings
- [[Meetings/2024/01/meeting]]

## Tasks`;

      (fs.readFile as jest.Mock).mockResolvedValue(existingDaily);

      await service.linkToDailyNote('Meetings/2024/01/meeting.md', new Date('2024-01-10'));

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('getVaultStats', () => {
    it('should calculate vault statistics', async () => {
      // const mockFiles = [
      //   '/test/vault/Meetings/meeting1.md',
      //   '/test/vault/Meetings/meeting2.md',
      // ];

      (fs.readdir as jest.Mock).mockImplementation(() => 
        Promise.resolve([
          { name: 'meeting1.md', isDirectory: () => false, isFile: () => true },
          { name: 'meeting2.md', isDirectory: () => false, isFile: () => true },
        ])
      );

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3')
        .mockResolvedValueOnce('- [ ] Task 4\n- [x] Task 5');

      const stats = await service.getVaultStats();

      expect(stats['meetings']).toBe(2);
      expect(stats['totalTasks']).toBe(5);
      expect(stats['completedTasks']).toBe(2);
      expect(stats['pendingTasks']).toBe(3);
      expect(stats['completionRate']).toBe('40.0%');
    });

    it('should handle empty vault', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const stats = await service.getVaultStats();

      expect(stats['meetings']).toBe(0);
      expect(stats['totalTasks']).toBe(0);
      expect(stats['completedTasks']).toBe(0);
      expect(stats['completionRate']).toBe('0%');
    });
  });
});