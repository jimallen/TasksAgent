import { requestUrl } from 'obsidian';

export interface ExtractedTask {
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  dueDate?: string;
  category?: string;
  context?: string;
  rawText?: string;
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  meetingDate: Date;
  keyDecisions: string[];
  nextSteps: string[];
  confidence: number;
}

export class ClaudeTaskExtractor {
  private apiKey: string;
  private model: string;
  private apiUrl: string = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string, model: string = 'claude-3-5-haiku-20241022') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Extract tasks using Claude API - using the same approach as the daemon
   */
  async extractTasks(emailContent: string, subject: string): Promise<TaskExtractionResult> {
    if (!this.apiKey) {
      console.warn('No Claude API key found, using fallback extraction');
      return this.fallbackExtraction(emailContent, subject);
    }

    try {
      const prompt = this.buildPrompt(emailContent, subject);
      const response = await this.callClaude(prompt);
      return this.parseResponse(response, emailContent);
    } catch (error) {
      console.error('Claude task extraction failed, using fallback', error);
      return this.fallbackExtraction(emailContent, subject);
    }
  }

  /**
   * Build the extraction prompt - same as daemon
   */
  private buildPrompt(emailContent: string, subject: string): string {
    // Ensure emailContent is a string
    const content = typeof emailContent === 'string' ? emailContent : JSON.stringify(emailContent);
    
    return `You are an expert at extracting actionable tasks from meeting transcripts. Analyze the following meeting transcript and extract all tasks, action items, and commitments.

MEETING SUBJECT: ${subject}

TRANSCRIPT:
${content.substring(0, 15000)} ${content.length > 15000 ? '... [truncated]' : ''}

Extract the following information and return as JSON:

1. **tasks** - Array of task objects with:
   - description: Clear, actionable task description
   - assignee: Person responsible (use actual names from the meeting, default "Unassigned" if unclear)
   - priority: "high", "medium", or "low" based on urgency/importance
   - confidence: 0-100 score of how confident you are this is a real task
   - dueDate: ISO date string if mentioned (optional)
   - category: engineering/product/design/documentation/communication/other
   - context: Brief context about why this task exists
   - rawText: The original text that led to this task

2. **summary** - 2-3 sentence meeting summary

3. **participants** - Array of participant names (extract all names mentioned)

4. **meetingDate** - ISO date string (use today if not specified)

5. **keyDecisions** - Array of important decisions made

6. **nextSteps** - Array of general next steps beyond specific tasks

Guidelines:
- Focus on explicit commitments ("I will", "I'll", "Let me", "I can", "[Name] will")
- Include tasks with deadlines or time constraints
- Capture follow-ups and action items
- Ignore general discussions or past work
- Be conservative - only extract clear tasks
- Only use names that actually appear in the transcript
- Default assignee should be "Unassigned" for unclear ownership

Return ONLY valid JSON, no other text:`;
  }

  /**
   * Call Claude API
   */
  private async callClaude(prompt: string): Promise<string> {
    try {
      const response = await requestUrl({
        url: this.apiUrl,
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.2,
          system: 'You are a task extraction assistant. Always respond with valid JSON only, no markdown or explanations.'
        })
      });

      if (response.json?.content?.[0]?.text) {
        return response.json.content[0].text;
      }

      throw new Error('Invalid Claude API response structure');
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error('Invalid Claude API key');
      } else if (error.response?.status === 429) {
        console.error('Claude API rate limit exceeded');
      }
      throw error;
    }
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(response: string, emailContent: string): TaskExtractionResult {
    try {
      // Extract JSON from response (in case there's any surrounding text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Normalize and validate
      const tasks = this.normalizeTasks(parsed.tasks || []);
      const participants = parsed.participants || [];
      
      return {
        tasks: this.deduplicateTasks(tasks),
        summary: parsed.summary || 'Meeting transcript processed',
        participants,
        meetingDate: this.parseDate(parsed.meetingDate) || new Date(),
        keyDecisions: parsed.keyDecisions || [],
        nextSteps: parsed.nextSteps || [],
        confidence: this.calculateOverallConfidence(tasks)
      };
    } catch (error) {
      console.error('Failed to parse Claude response', error);
      console.debug('Raw response:', response);
      return this.fallbackExtraction(emailContent, '');
    }
  }

  /**
   * Normalize task objects
   */
  private normalizeTasks(tasks: any[]): ExtractedTask[] {
    return tasks.map(task => ({
      description: this.cleanDescription(task.description || ''),
      assignee: task.assignee || 'Unassigned',
      priority: this.normalizePriority(task.priority),
      confidence: this.normalizeConfidence(task.confidence),
      dueDate: task.dueDate,
      category: task.category || 'other',
      context: task.context,
      rawText: task.rawText
    })).filter(task => task.description && task.description.length > 5);
  }

  /**
   * Clean task description
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/^[-*•]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize priority
   */
  private normalizePriority(priority: any): 'high' | 'medium' | 'low' {
    const p = String(priority).toLowerCase();
    if (p.includes('high') || p === '3') return 'high';
    if (p.includes('low') || p === '1') return 'low';
    return 'medium';
  }

  /**
   * Normalize confidence score
   */
  private normalizeConfidence(confidence: any): number {
    const c = Number(confidence);
    if (isNaN(c)) return 75;
    return Math.min(100, Math.max(0, c));
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Remove duplicate tasks
   */
  private deduplicateTasks(tasks: ExtractedTask[]): ExtractedTask[] {
    const seen = new Set<string>();
    return tasks.filter(task => {
      const key = `${task.description.toLowerCase()}-${task.assignee.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(tasks: ExtractedTask[]): number {
    if (tasks.length === 0) return 0;
    const sum = tasks.reduce((acc, task) => acc + task.confidence, 0);
    return Math.round(sum / tasks.length);
  }

  /**
   * Fallback extraction when Claude is unavailable
   */
  private fallbackExtraction(emailContent: string, subject: string): TaskExtractionResult {
    const tasks: ExtractedTask[] = [];
    const lines = emailContent.split('\n');
    
    // Simple pattern matching for tasks
    const taskPatterns = [
      /(?:I will|I'll|I can|Let me|I need to|I should|I have to)\s+(.+)/i,
      /(?:TODO|Action|Task|Follow.?up):\s*(.+)/i,
      /(?:Next steps?|Action items?):\s*(.+)/i,
      /\[ \]\s+(.+)/,
      /^[-*•]\s*(.+(?:will|need to|should|must).+)/i
    ];

    for (const line of lines) {
      for (const pattern of taskPatterns) {
        const match = line.match(pattern);
        if (match) {
          tasks.push({
            description: this.cleanDescription(match[1]),
            assignee: 'Unassigned',
            priority: 'medium',
            confidence: 50,
            category: 'other',
            rawText: line
          });
        }
      }
    }

    // Extract participant names (simple approach)
    const participants: string[] = [];
    const namePattern = /(?:with|from|to|cc|attendees?:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
    let match;
    while ((match = namePattern.exec(emailContent)) !== null) {
      if (!participants.includes(match[1])) {
        participants.push(match[1]);
      }
    }

    return {
      tasks: this.deduplicateTasks(tasks),
      summary: subject || 'Meeting notes',
      participants,
      meetingDate: new Date(),
      keyDecisions: [],
      nextSteps: [],
      confidence: 30
    };
  }
}