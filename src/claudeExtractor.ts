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

export interface NextStep {
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  meetingDate: Date;
  keyDecisions: string[];
  nextSteps: NextStep[];
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

6. **nextSteps** - Array of next step objects with:
   - description: Clear description of the next step
   - assignee: Person responsible (match with participants when possible, default "Unassigned")
   - priority: "high", "medium", or "low" based on importance

Guidelines:
- Focus on explicit commitments ("I will", "I'll", "Let me", "I can", "[Name] will")
- Include tasks with deadlines or time constraints
- Capture follow-ups and action items
- Look for "Next steps", "Action items", "To do", "Follow up" sections
- Check for Google Meet's AI-suggested action items or next steps (often at the end)
- Include any items listed under "Suggested next steps" or "Recommended actions"
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
      const nextSteps = this.normalizeNextSteps(parsed.nextSteps || [], participants);

      // Deduplicate between tasks and next steps
      const { deduplicatedTasks, deduplicatedNextSteps } = this.deduplicateTasksAndNextSteps(tasks, nextSteps);

      return {
        tasks: deduplicatedTasks,
        summary: parsed.summary || 'Meeting transcript processed',
        participants,
        meetingDate: this.parseDate(parsed.meetingDate) || new Date(),
        keyDecisions: parsed.keyDecisions || [],
        nextSteps: deduplicatedNextSteps,
        confidence: this.calculateOverallConfidence(deduplicatedTasks)
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
   * Normalize next steps and assign owners based on participants
   */
  private normalizeNextSteps(nextSteps: any[], participants: string[]): NextStep[] {
    if (!Array.isArray(nextSteps)) return [];

    return nextSteps.map(step => {
      // Handle both string and object formats
      if (typeof step === 'string') {
        // Try to extract assignee from the text
        const assignee = this.extractAssigneeFromText(step, participants);
        return {
          description: this.cleanDescription(step),
          assignee: assignee || 'Unassigned',
          priority: 'medium' as const
        };
      } else if (typeof step === 'object' && step !== null) {
        return {
          description: this.cleanDescription(step.description || String(step)),
          assignee: step.assignee || 'Unassigned',
          priority: this.normalizePriority(step.priority || 'medium')
        };
      }
      return null;
    }).filter((step): step is NextStep => step !== null && step.description.length > 5);
  }

  /**
   * Extract assignee from text based on participants list
   */
  private extractAssigneeFromText(text: string, participants: string[]): string | null {
    // Check if any participant name appears in the text
    for (const participant of participants) {
      if (text.toLowerCase().includes(participant.toLowerCase())) {
        return participant;
      }
    }

    // Look for patterns like "John will..." or "Sarah to..."
    const patterns = [
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to|should|needs to)/,
      /(?:assigned to|owner:|assignee:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Deduplicate between tasks and next steps
   */
  private deduplicateTasksAndNextSteps(
    tasks: ExtractedTask[],
    nextSteps: NextStep[]
  ): { deduplicatedTasks: ExtractedTask[], deduplicatedNextSteps: NextStep[] } {
    // Create a set of task descriptions for comparison
    const taskDescriptions = new Set(
      tasks.map(t => t.description.toLowerCase().replace(/[^\w\s]/g, ''))
    );

    // Filter out next steps that are already in tasks
    const deduplicatedNextSteps = nextSteps.filter(step => {
      const normalizedStep = step.description.toLowerCase().replace(/[^\w\s]/g, '');

      // Check if this next step is too similar to any existing task
      for (const taskDesc of taskDescriptions) {
        // Calculate similarity (simple approach - could be enhanced)
        const stepWords = normalizedStep.split(/\s+/);
        const taskWords = taskDesc.split(/\s+/);
        const commonWords = stepWords.filter(w => taskWords.includes(w));

        // If more than 60% of words match, consider it a duplicate
        if (commonWords.length > stepWords.length * 0.6 && stepWords.length > 2) {
          return false;
        }
      }

      return true;
    });

    return {
      deduplicatedTasks: tasks,
      deduplicatedNextSteps
    };
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

  /**
   * Extract action items from non-meeting emails
   * Uses a different prompt focused on identifying tasks in regular emails
   */
  async extractActionItems(emailContent: string, subject: string): Promise<TaskExtractionResult> {
    if (!this.apiKey) {
      console.warn('No Claude API key found, using fallback extraction');
      return this.fallbackExtraction(emailContent, subject);
    }

    try {
      const prompt = this.buildActionItemPrompt(emailContent, subject);
      const response = await this.callClaude(prompt);
      return this.parseResponse(response, emailContent);
    } catch (error) {
      console.error('Claude action item extraction failed, using fallback', error);
      return this.fallbackExtraction(emailContent, subject);
    }
  }

  /**
   * Build the action item extraction prompt for non-meeting emails
   */
  private buildActionItemPrompt(emailContent: string, subject: string): string {
    const content = typeof emailContent === 'string' ? emailContent : JSON.stringify(emailContent);

    return `You are an expert at extracting actionable tasks from emails. Analyze the following email and extract all action items, tasks, and commitments.

EMAIL SUBJECT: ${subject}

EMAIL CONTENT:
${content.substring(0, 15000)} ${content.length > 15000 ? '... [truncated]' : ''}

Extract the following information and return as JSON:

1. **tasks** - Array of task objects with:
   - description: Clear, actionable task description
   - assignee: Person responsible (extract from email, default "Unassigned" if unclear)
   - priority: "high", "medium", or "low" based on urgency/importance
   - confidence: 0-100 score of how confident you are this is a real task
   - dueDate: ISO date string if mentioned (optional)
   - category: engineering/product/design/documentation/communication/other
   - context: Brief context about why this task exists
   - rawText: The original text that led to this task

2. **summary** - 2-3 sentence summary of the email's main purpose

3. **participants** - Array of people mentioned in the email (sender, recipients, mentioned names)

4. **meetingDate** - ISO date string (use email date or today)

5. **keyDecisions** - Array of important decisions or key points from the email

6. **nextSteps** - Array of next step objects with:
   - description: Clear description of the next step
   - assignee: Person responsible (default "Unassigned")
   - priority: "high", "medium", or "low" based on importance

Guidelines for action items:
- Look for explicit requests ("Can you...", "Please...", "Could you...")
- Identify commitments ("I will...", "I'll...", "Let me...")
- Extract deadlines and time constraints
- Include follow-up items ("Need to...", "Should...", "Must...")
- Capture FYI items that require action
- Pay attention to urgent or important markers
- Extract tasks from forwarded emails or threads
- Identify implicit tasks (things that need to happen based on context)

IMPORTANT:
- For assignee matching, look for names in signatures, "From:" fields, and email addresses
- Match assignees with participants when possible
- If multiple people are mentioned, assign to the most relevant person
- Set confidence lower (40-60) if assignee is unclear
- Return ONLY valid JSON, no markdown formatting
- Priority should reflect urgency indicators like "ASAP", "urgent", "by EOD", etc.

Return your response as a single JSON object.`;
  }
}