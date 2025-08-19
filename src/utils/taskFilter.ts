/**
 * Task filtering utilities for personal task management
 */

import { ExtractedTask } from '../extractors/claudeTaskExtractor';

export interface TaskFilterOptions {
  assigneeFilter?: string[];  // Filter to specific assignees
  excludeOthers?: boolean;    // Exclude tasks for others
  priorityFilter?: ('high' | 'medium' | 'low')[];
  onlyMyTasks?: boolean;      // Only tasks assigned to me
}

export class TaskFilter {
  private myNames: string[];
  
  constructor(myNames: string[] = ['Jim Allen', 'Jim', 'jimallen']) {
    this.myNames = myNames.map(n => n.toLowerCase());
  }

  /**
   * Filter tasks based on assignee
   */
  filterTasks(tasks: ExtractedTask[], options: TaskFilterOptions = {}): ExtractedTask[] {
    let filtered = [...tasks];

    // Filter to only my tasks
    if (options.onlyMyTasks) {
      filtered = filtered.filter(task => 
        this.isMyTask(task.assignee)
      );
    }

    // Filter by specific assignees
    if (options.assigneeFilter && options.assigneeFilter.length > 0) {
      const allowedAssignees = options.assigneeFilter.map(a => a.toLowerCase());
      filtered = filtered.filter(task => 
        task.assignee && allowedAssignees.includes(task.assignee.toLowerCase())
      );
    }

    // Exclude tasks for others
    if (options.excludeOthers) {
      filtered = filtered.filter(task => 
        !task.assignee || this.isMyTask(task.assignee)
      );
    }

    // Filter by priority
    if (options.priorityFilter && options.priorityFilter.length > 0) {
      filtered = filtered.filter(task => 
        options.priorityFilter!.includes(task.priority)
      );
    }

    return filtered;
  }

  /**
   * Check if a task is assigned to me
   */
  private isMyTask(assignee?: string): boolean {
    if (!assignee) return false;
    
    const assigneeLower = assignee.toLowerCase();
    return this.myNames.some(name => 
      assigneeLower.includes(name) || 
      assigneeLower === name ||
      assigneeLower === `@${name}` ||
      assigneeLower === `[[${name}]]` ||
      assigneeLower === `@[[${name}]]`
    );
  }

  /**
   * Group tasks by assignee
   */
  groupTasksByAssignee(tasks: ExtractedTask[]): Map<string, ExtractedTask[]> {
    const grouped = new Map<string, ExtractedTask[]>();
    
    for (const task of tasks) {
      const assignee = task.assignee || 'Unassigned';
      if (!grouped.has(assignee)) {
        grouped.set(assignee, []);
      }
      grouped.get(assignee)!.push(task);
    }
    
    return grouped;
  }

  /**
   * Get task statistics
   */
  getTaskStats(tasks: ExtractedTask[]) {
    const myTasks = tasks.filter(t => this.isMyTask(t.assignee));
    const otherTasks = tasks.filter(t => t.assignee && !this.isMyTask(t.assignee));
    const unassigned = tasks.filter(t => !t.assignee);

    return {
      total: tasks.length,
      mine: myTasks.length,
      others: otherTasks.length,
      unassigned: unassigned.length,
      byPriority: {
        high: myTasks.filter(t => t.priority === 'high').length,
        medium: myTasks.filter(t => t.priority === 'medium').length,
        low: myTasks.filter(t => t.priority === 'low').length,
      }
    };
  }
}

// Export singleton instance
export const taskFilter = new TaskFilter();