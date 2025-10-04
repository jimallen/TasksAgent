import { requestUrl } from 'obsidian';

export interface Task {
  text: string;
  completed: boolean;
  assignee: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  confidence?: number;
  category?: string;
  file: any;
  line: number;
  rawLine: string;
  clusterId?: string;
}

export interface TaskCluster {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  priority: 'high' | 'medium' | 'low';
  suggestedAssignee?: string;
  combinedTask?: string;
  confidence: number;
}

export interface ClusteringResult {
  clusters: TaskCluster[];
  standalone: Task[];
  totalTasksAnalyzed: number;
  clustersCreated: number;
  summary: string;
}

export class TaskClusterer {
  private apiKey: string;
  private model: string;
  private apiUrl: string = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string, model: string = 'claude-3-5-haiku-20241022') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Cluster similar tasks using Claude AI
   */
  async clusterTasks(tasks: Task[]): Promise<ClusteringResult> {
    if (!this.apiKey) {
      console.warn('No Claude API key found, clustering unavailable');
      return {
        clusters: [],
        standalone: tasks,
        totalTasksAnalyzed: tasks.length,
        clustersCreated: 0,
        summary: 'Clustering unavailable without Claude API key'
      };
    }

    if (tasks.length === 0) {
      return {
        clusters: [],
        standalone: [],
        totalTasksAnalyzed: 0,
        clustersCreated: 0,
        summary: 'No tasks to cluster'
      };
    }

    try {
      const prompt = this.buildClusteringPrompt(tasks);
      const response = await this.callClaude(prompt);
      return this.parseClusteringResponse(response, tasks);
    } catch (error) {
      console.error('Task clustering failed:', error);
      return {
        clusters: [],
        standalone: tasks,
        totalTasksAnalyzed: tasks.length,
        clustersCreated: 0,
        summary: `Clustering failed: ${error.message}`
      };
    }
  }

  /**
   * Build the clustering prompt for Claude
   */
  private buildClusteringPrompt(tasks: Task[]): string {
    const taskList = tasks.map((task, idx) => {
      return `${idx}. "${task.text}" [Assignee: ${task.assignee}] [Priority: ${task.priority}] [Category: ${task.category || 'none'}] [Due: ${task.dueDate || 'none'}]`;
    }).join('\n');

    return `You are an expert at analyzing and clustering similar tasks. Analyze the following tasks and identify groups of similar or related tasks that could potentially be combined or should be tracked together.

TASKS TO ANALYZE:
${taskList}

Your goals:
1. **Identify similar tasks** - Tasks that are duplicates, very similar, or closely related
2. **Identify related tasks** - Tasks that are part of the same project/initiative
3. **Suggest combinations** - When multiple tasks can be combined into one
4. **Preserve distinct tasks** - Don't force unrelated tasks into clusters

Clustering guidelines:
- Look for similar descriptions, keywords, or objectives
- Consider task categories and assignees
- Group tasks working toward the same goal
- Identify duplicate or near-duplicate tasks
- Keep minimum cluster size of 2 tasks
- Don't cluster tasks just because they're from the same assignee
- Consider priority levels when suggesting combinations

For each cluster, provide:
- **title**: Short, descriptive name for the cluster (max 50 chars)
- **description**: Why these tasks belong together (max 100 chars)
- **taskIndices**: Array of task indices (numbers from the list above)
- **priority**: Highest priority among clustered tasks ('high', 'medium', or 'low')
- **suggestedAssignee**: Best assignee if combining (or null)
- **combinedTask**: If tasks should be combined, suggest the combined task description (or null if they should remain separate)
- **confidence**: 0-100 score of how confident you are in this cluster

Return ONLY valid JSON in this format:
{
  "clusters": [
    {
      "title": "Cluster name",
      "description": "Why these tasks are related",
      "taskIndices": [0, 3, 5],
      "priority": "high",
      "suggestedAssignee": "John Doe",
      "combinedTask": "Combined task description if applicable",
      "confidence": 85
    }
  ],
  "standaloneIndices": [1, 2, 4],
  "summary": "Brief summary of clustering results"
}

Important:
- Every task index (0 to ${tasks.length - 1}) must appear EXACTLY ONCE in either a cluster or standaloneIndices
- Do not duplicate indices
- Do not skip indices
- Return ONLY the JSON, no other text`;
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
          max_tokens: 8000,
          temperature: 0.2,
          system: 'You are a task clustering assistant. Always respond with valid JSON only, no markdown or explanations. Ensure all strings are properly escaped and no trailing commas exist in arrays or objects.'
        })
      });

      if (response.json?.content?.[0]?.text) {
        return response.json.content[0].text;
      }

      throw new Error('Invalid Claude API response structure');
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Claude API key');
      } else if (error.response?.status === 429) {
        throw new Error('Claude API rate limit exceeded');
      }
      throw error;
    }
  }

  /**
   * Parse Claude's clustering response
   */
  private parseClusteringResponse(response: string, originalTasks: Task[]): ClusteringResult {
    try {
      // Extract JSON from response - try multiple methods
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      jsonStr = jsonMatch[0];

      // Try to clean common JSON issues
      // Remove trailing commas before closing braces/brackets
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

      // Fix unescaped quotes in strings (basic heuristic)
      // This is a simple fix - matches quotes between other quotes on same line
      jsonStr = jsonStr.replace(/"([^"]*)"([^"]*?)"/g, (match, p1, p2) => {
        // If p2 contains unescaped quotes, try to escape them
        if (p2.includes('"')) {
          return `"${p1}${p2.replace(/"/g, '\\"')}"`;
        }
        return match;
      });

      // Log for debugging
      console.debug('Attempting to parse JSON, length:', jsonStr.length);

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError: any) {
        // Log the problematic area
        const errorPos = parseError.message.match(/position (\d+)/)?.[1];
        if (errorPos) {
          const pos = parseInt(errorPos);
          const start = Math.max(0, pos - 100);
          const end = Math.min(jsonStr.length, pos + 100);
          console.error('JSON parse error near:', jsonStr.substring(start, end));
          console.error('Error position:', pos, 'Character:', jsonStr[pos]);
          console.error('Last 200 chars:', jsonStr.substring(jsonStr.length - 200));

          // Check if JSON is truncated (missing closing brackets)
          const openBraces = (jsonStr.match(/\{/g) || []).length;
          const closeBraces = (jsonStr.match(/\}/g) || []).length;
          const openBrackets = (jsonStr.match(/\[/g) || []).length;
          const closeBrackets = (jsonStr.match(/\]/g) || []).length;

          console.error('Brace balance: { =', openBraces, '} =', closeBraces);
          console.error('Bracket balance: [ =', openBrackets, '] =', closeBrackets);

          // Try to auto-fix truncation
          if (openBraces > closeBraces || openBrackets > closeBrackets) {
            console.log('⚠️ JSON appears truncated, attempting to close structures');

            // Smart closing: alternate between array and object closures
            // This handles nested structures better
            let fixedJson = jsonStr;
            let braceDiff = openBraces - closeBraces;
            let bracketDiff = openBrackets - closeBrackets;

            // Close structures in reverse order (arrays inside objects, then objects)
            while (braceDiff > 0 || bracketDiff > 0) {
              if (bracketDiff > 0) {
                fixedJson += ']';
                bracketDiff--;
              }
              if (braceDiff > 0) {
                fixedJson += '}';
                braceDiff--;
              }
            }

            console.log('Attempting to parse with closures added');
            try {
              parsed = JSON.parse(fixedJson);
              console.log('✓ Successfully parsed with auto-fix!');
              return this.buildClusteringResult(parsed, originalTasks);
            } catch (retryError: any) {
              console.error('Auto-fix failed:', retryError.message);
            }
          }
        }
        throw parseError;
      }
      return this.buildClusteringResult(parsed, originalTasks);
    } catch (error) {
      console.error('Failed to parse clustering response:', error);
      console.debug('Raw response:', response);
      throw error;
    }
  }

  /**
   * Build clustering result from parsed JSON
   */
  private buildClusteringResult(parsed: any, originalTasks: Task[]): ClusteringResult {
    const clusters: TaskCluster[] = [];
    const usedIndices = new Set<number>();

    // Build clusters
    if (parsed.clusters && Array.isArray(parsed.clusters)) {
      for (const clusterData of parsed.clusters) {
        if (!clusterData.taskIndices || clusterData.taskIndices.length < 2) {
          continue; // Skip invalid or single-task clusters
        }

        const clusterTasks: Task[] = [];
        for (const idx of clusterData.taskIndices) {
          if (idx >= 0 && idx < originalTasks.length && !usedIndices.has(idx)) {
            clusterTasks.push(originalTasks[idx]);
            usedIndices.add(idx);
          }
        }

        if (clusterTasks.length >= 2) {
          clusters.push({
            id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: clusterData.title || 'Related Tasks',
            description: clusterData.description || 'Similar tasks',
            tasks: clusterTasks,
            priority: clusterData.priority || 'medium',
            suggestedAssignee: clusterData.suggestedAssignee || undefined,
            combinedTask: clusterData.combinedTask || undefined,
            confidence: clusterData.confidence || 75
          });
        }
      }
    }

    // Build standalone tasks (tasks not in any cluster)
    const standalone: Task[] = [];
    if (parsed.standaloneIndices && Array.isArray(parsed.standaloneIndices)) {
      for (const idx of parsed.standaloneIndices) {
        if (idx >= 0 && idx < originalTasks.length && !usedIndices.has(idx)) {
          standalone.push(originalTasks[idx]);
          usedIndices.add(idx);
        }
      }
    }

    // Add any missed tasks to standalone
    for (let i = 0; i < originalTasks.length; i++) {
      if (!usedIndices.has(i)) {
        standalone.push(originalTasks[i]);
      }
    }

    return {
      clusters,
      standalone,
      totalTasksAnalyzed: originalTasks.length,
      clustersCreated: clusters.length,
      summary: parsed.summary || `Found ${clusters.length} clusters from ${originalTasks.length} tasks`
    };
  }
}
