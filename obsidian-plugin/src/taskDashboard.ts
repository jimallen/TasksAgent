import { 
  ItemView, 
  WorkspaceLeaf,
  TFile,
  Notice,
  MarkdownRenderer,
  Component
} from 'obsidian';

export const TASK_DASHBOARD_VIEW_TYPE = 'task-dashboard-view';

interface Task {
  text: string;
  completed: boolean;
  assignee: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  confidence?: number;
  category?: string;
  file: TFile;
  line: number;
  rawLine: string;
}

interface GroupedTasks {
  [key: string]: Task[];
}

interface PluginSettings {
  dashboardMyName?: string;
  dashboardShowOnlyMyTasks?: boolean;
  notesFolder?: string;
  lookbackHours?: number;
}

interface MeetingTasksPlugin {
  settings: PluginSettings;
}

export class TaskDashboardView extends ItemView {
  private component: Component;
  private plugin: MeetingTasksPlugin | undefined;
  private showOnlyMyTasks: boolean = true;
  private allTasks: Task[] = [];
  private isLoading: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin?: MeetingTasksPlugin) {
    super(leaf);
    this.component = new Component();
    this.plugin = plugin;
    this.showOnlyMyTasks = true;
  }

  getViewType() {
    return TASK_DASHBOARD_VIEW_TYPE;
  }

  getDisplayText() {
    return 'Task Dashboard';
  }

  getIcon() {
    return 'check-square';
  }

  async onOpen() {
    await this.refresh();
  }

  async onClose() {
    this.component.unload();
  }

  async refresh() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    
    // Add dashboard class for styling
    container.addClass('dashboard');
    container.addClass('markdown-preview-view');
    
    // Show loading state
    this.showLoadingState(container);
    
    try {
      await this.loadAndDisplayDashboard(container);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
      this.showErrorState(container, error);
    }
  }
  
  private showLoadingState(container: HTMLElement) {
    const loadingDiv = container.createDiv('dashboard-loading');
    loadingDiv.createEl('div', { cls: 'loading-spinner' });
    loadingDiv.createEl('p', { text: 'Loading tasks...', cls: 'loading-text' });
  }
  
  private showErrorState(container: HTMLElement, error: any) {
    container.empty();
    const errorDiv = container.createDiv('dashboard-error');
    errorDiv.createEl('h2', { text: '⚠️ Error Loading Dashboard' });
    errorDiv.createEl('p', { text: 'Failed to load tasks. Please try refreshing.' });
    errorDiv.createEl('pre', { text: error?.message || 'Unknown error', cls: 'error-details' });
    
    const retryBtn = errorDiv.createEl('button', {
      text: '🔄 Retry',
      cls: 'dashboard-control-btn'
    });
    retryBtn.onclick = () => this.refresh();
  }
  
  private async loadAndDisplayDashboard(container: HTMLElement) {
    // Clear loading state
    container.empty();
    
    // Create header
    const header = container.createDiv('dashboard-header');
    header.createEl('h1', { text: 'TASK DASHBOARD', cls: 'title' });
    
    // Add control buttons
    const controls = header.createDiv('dashboard-controls');
    
    // Add toggle button for my tasks/all tasks (only if user name is configured)
    if (this.plugin?.settings?.dashboardMyName) {
      const toggleBtn = controls.createEl('button', {
        text: this.showOnlyMyTasks ? '👥 Show All Tasks' : '👤 Show My Tasks',
        cls: 'dashboard-control-btn dashboard-toggle-btn'
      });
      
      toggleBtn.onclick = () => {
        this.showOnlyMyTasks = !this.showOnlyMyTasks;
        toggleBtn.textContent = this.showOnlyMyTasks ? '👥 Show All Tasks' : '👤 Show My Tasks';
        this.updateTaskDisplay();
      };
    }
    
    // Add refresh button
    const refreshBtn = controls.createEl('button', {
      text: '🔄 Refresh',
      cls: 'dashboard-control-btn dashboard-refresh-btn'
    });
    
    refreshBtn.onclick = () => this.refresh();
    
    // Add filter buttons
    const filters = container.createDiv('dashboard-filters');
    this.createFilterButtons(filters);
    
    // Create stats section
    const stats = container.createDiv('dashboard-stats');
    
    // Load all tasks with error handling
    try {
      this.isLoading = true;
      this.allTasks = await this.loadTasks();
    } catch (error) {
      console.error('Failed to load tasks:', error);
      new Notice('Failed to load tasks. Check console for details.');
      this.allTasks = [];
    } finally {
      this.isLoading = false;
    }
    
    // Get filtered tasks based on current view mode
    const displayTasks = this.getFilteredTasks();
    
    // Display stats
    this.displayStats(stats, displayTasks);
    
    // Create task sections
    await this.displayTasks(container, displayTasks);
    
    // Apply custom CSS
    this.applyDashboardStyles();
  }

  private createFilterButtons(container: HTMLElement) {
    const filterGroup = container.createDiv('filter-group');
    
    const filters = [
      { label: 'High Priority', filter: 'high', active: true, dataAttr: 'high' },
      { label: 'Medium Priority', filter: 'medium', dataAttr: 'medium' },
      { label: 'Low Priority', filter: 'low', dataAttr: 'low' },
      { label: 'Due Today', filter: 'today', dataAttr: 'due-today' },
      { label: 'Due This Week', filter: 'week', dataAttr: 'due-week' },
      { label: 'Completed', filter: 'completed', dataAttr: 'completed' }
    ];
    
    filters.forEach(f => {
      const btn = filterGroup.createEl('button', {
        text: f.label,
        cls: f.active ? 'filter-btn active' : 'filter-btn'
      });
      btn.setAttribute('data-filter', f.dataAttr);
      
      btn.onclick = () => {
        // Toggle filter - click active button to show all
        if (btn.hasClass('active')) {
          btn.removeClass('active');
          this.applyFilter('all');
        } else {
          // Remove active from all buttons
          filterGroup.querySelectorAll('.filter-btn').forEach(b => {
            if (b instanceof HTMLElement) {
              b.removeClass('active');
            }
          });
          btn.addClass('active');
          this.applyFilter(f.filter);
        }
      };
    });
  }

  private async loadTasks(): Promise<Task[]> {
    const tasks: Task[] = [];
    
    // Get all markdown files in the vault
    const files = this.app.vault.getMarkdownFiles();
    
    for (const file of files) {
      const fileTasks = await this.extractTasksFromFile(file);
      tasks.push(...fileTasks);
    }
    
    return tasks;
  }

  private async extractTasksFromFile(file: TFile): Promise<Task[]> {
    const tasks: Task[] = [];
    
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match task lines with checkbox
        const taskMatch = line.match(/^[\s-]*\[([ x])\]\s+(.+)/);
        if (taskMatch) {
          const completed = taskMatch[1] === 'x';
          const taskText = taskMatch[2];
          
          // Extract priority - Support both Obsidian's built-in syntax and custom emojis
          let priority: 'high' | 'medium' | 'low' = 'medium';
          // High priority: Obsidian's ⏫ (highest) and 🔼 (high), or custom 🔴
          if (line.includes('⏫') || line.includes('🔼') || line.includes('🔴') || taskText.includes('High Priority')) {
            priority = 'high';
          } 
          // Low priority: Obsidian's ⏬ (lowest) and 🔽 (low), or custom 🟢
          else if (line.includes('⏬') || line.includes('🔽') || line.includes('🟢') || taskText.includes('Low Priority')) {
            priority = 'low';
          } 
          // Medium priority: custom 🟡 or default
          else if (line.includes('🟡')) {
            priority = 'medium';
          }
          
          // Extract assignee
          const assigneeMatch = taskText.match(/\[\[@?([^\]]+)\]\]/);
          const assignee = assigneeMatch ? assigneeMatch[1] : 'Unassigned';
          
          // Extract due date
          const dateMatch = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
          const dueDate = dateMatch ? dateMatch[1] : '';
          
          // Extract confidence
          const confidenceMatch = taskText.match(/⚠️\s*(\d+)%/);
          const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 100;
          
          // Extract category
          const categoryMatch = taskText.match(/#(\w+)/);
          const category = categoryMatch ? categoryMatch[1] : 'general';
          
          // Clean task text
          const cleanText = taskText
            .replace(/\[\[@?[^\]]+\]\]/g, '')
            .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/[🔴🟡🟢]/g, '')
            .replace(/⚠️\s*\d+%/g, '')
            .replace(/#\w+/g, '')
            .trim();
          
          tasks.push({
            text: cleanText,
            completed,
            assignee,
            dueDate,
            priority,
            confidence,
            category,
            file,
            line: i,
            rawLine: line
          });
        }
      }
    } catch (error) {
      console.error(`Failed to read file ${file.path}:`, error);
      // Return empty array for this file, continue with others
    }
    
    return tasks;
  }

  private displayStats(container: HTMLElement, tasks: Task[]): void {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const high = tasks.filter(t => t.priority === 'high' && !t.completed).length;
    const overdue = tasks.filter(t => {
      if (!t.dueDate || t.completed) return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    
    const statsGrid = container.createDiv('stats-grid');
    
    // Create stat cards
    const totalCard = statsGrid.createDiv('stat-card stat-total');
    totalCard.createDiv('stat-value').textContent = total.toString();
    totalCard.createDiv('stat-label').textContent = 'Total Tasks';
    
    const completedCard = statsGrid.createDiv('stat-card stat-completed');
    completedCard.createDiv('stat-value').textContent = `${completed}/${total}`;
    completedCard.createDiv('stat-label').textContent = 'Completed';
    
    const highCard = statsGrid.createDiv('stat-card stat-high');
    highCard.createDiv('stat-value').textContent = high.toString();
    highCard.createDiv('stat-label').textContent = 'High Priority';
    
    const overdueCard = statsGrid.createDiv('stat-card stat-overdue');
    overdueCard.createDiv('stat-value').textContent = overdue.toString();
    overdueCard.createDiv('stat-label').textContent = 'Overdue';
  }

  private async displayTasks(container: HTMLElement, tasks: Task[]) {
    // Group tasks by priority
    const highPriority = tasks.filter(t => t.priority === 'high' && !t.completed);
    const mediumPriority = tasks.filter(t => t.priority === 'medium' && !t.completed);
    const lowPriority = tasks.filter(t => t.priority === 'low' && !t.completed);
    const completedTasks = tasks.filter(t => t.completed);
    
    // Create sections
    if (highPriority.length > 0) {
      await this.createTaskSection(container, '🔴 High Priority', highPriority, 'high');
    }
    
    if (mediumPriority.length > 0) {
      await this.createTaskSection(container, '🟡 Medium Priority', mediumPriority, 'medium');
    }
    
    if (lowPriority.length > 0) {
      await this.createTaskSection(container, '🟢 Low Priority', lowPriority, 'low');
    }
    
    // Completed section (collapsed by default)
    if (completedTasks.length > 0) {
      const section = container.createDiv('task-section completed-section');
      const header = section.createEl('h2', { 
        text: `✅ Completed (${completedTasks.length})`,
        cls: 'collapsible'
      });
      
      const content = section.createDiv('task-grid collapsed');
      
      header.onclick = () => {
        const isCollapsed = content.hasClass('collapsed');
        if (isCollapsed) {
          content.removeClass('collapsed');
          header.removeClass('collapsed');
        } else {
          content.addClass('collapsed');
          header.addClass('collapsed');
        }
      };
      
      await this.createTaskCards(content, completedTasks, 'completed');
    }
  }

  private async createTaskSection(
    container: HTMLElement, 
    title: string, 
    tasks: Task[], 
    priority: string
  ) {
    const section = container.createDiv(`task-section ${priority}-section`);
    section.createEl('h2', { text: `${title} (${tasks.length})` });
    
    const grid = section.createDiv('task-grid');
    await this.createTaskCards(grid, tasks, priority);
  }

  private async createTaskCards(container: HTMLElement, tasks: Task[], priority: string) {
    // Group tasks by assignee
    const grouped: GroupedTasks = {};
    
    tasks.forEach(task => {
      const key = task.assignee || 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    
    // Sort assignees alphabetically (user's name first if configured)
    const assignees = Object.keys(grouped).sort((a, b) => {
      const myName = this.plugin?.settings?.dashboardMyName?.toLowerCase();
      if (myName) {
        if (a.toLowerCase().includes(myName)) return -1;
        if (b.toLowerCase().includes(myName)) return 1;
      }
      return a.localeCompare(b);
    });
    
    for (const assignee of assignees) {
      const card = container.createDiv(`task-card ${priority}-card`);
      
      // Card header with assignee name
      const header = card.createDiv('card-header');
      
      // Assignee name
      const assigneeTitle = header.createEl('h3', {
        text: `👤 ${assignee}`,
        cls: 'card-assignee-title'
      });
      
      // Task list
      const taskList = card.createEl('ul', { cls: 'task-list' });
      
      for (const task of grouped[assignee]) {
        const li = taskList.createEl('li', { cls: 'task-list-item' });
        
        // Create checkbox
        const checkbox = li.createEl('input', { 
          type: 'checkbox',
          cls: 'task-checkbox'
        });
        checkbox.checked = task.completed;
        checkbox.onclick = async () => {
          await this.toggleTask(task, checkbox.checked);
        };
        
        // Task content wrapper
        const content = li.createDiv('task-content');
        
        // Task text - make it clickable to navigate to the meeting note
        const textSpan = content.createEl('span', { 
          text: task.text,
          cls: task.completed ? 'task-text completed clickable' : 'task-text clickable'
        });
        
        // Add click handler to navigate to the meeting note
        textSpan.onclick = async (event) => {
          event.stopPropagation();
          // Open the file at the specific line
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(task.file);
          
          // Scroll to the task line if possible
          const view = leaf.view;
          if (view && 'editor' in view) {
            const editor = (view as any).editor;
            if (editor) {
              // Set cursor to the task line
              editor.setCursor(task.line, 0);
              editor.scrollIntoView({
                from: { line: Math.max(0, task.line - 5), ch: 0 },
                to: { line: Math.min(editor.lineCount() - 1, task.line + 5), ch: 0 }
              }, true);
            }
          }
        };
        
        // Add title attribute for tooltip
        textSpan.title = `Click to open: ${task.file.basename}`;
        
        // Task metadata
        const meta = content.createDiv('task-meta');
        
        // Add meeting source
        const sourceSpan = meta.createEl('span', { 
          cls: 'task-source clickable',
          text: `📄 ${task.file.basename}`
        });
        sourceSpan.onclick = textSpan.onclick; // Same click handler
        sourceSpan.title = `Click to open: ${task.file.basename}`;
        
        if (task.dueDate) {
          const dueSpan = meta.createEl('span', { cls: 'task-due' });
          dueSpan.setText(`📅 ${task.dueDate}`);
          
          // Check if overdue
          if (!task.completed && new Date(task.dueDate) < new Date()) {
            dueSpan.addClass('overdue');
          }
        }
        
        if (task.category) {
          meta.createEl('span', { 
            text: `#${task.category}`,
            cls: 'task-category'
          });
        }
        
        if (task.confidence && task.confidence < 70) {
          meta.createEl('span', { 
            text: `⚠️ ${task.confidence}%`,
            cls: 'task-confidence'
          });
        }
        
        // Source file link
        const fileLink = meta.createEl('a', {
          text: '📄',
          cls: 'task-source',
          title: task.file.basename
        });
        fileLink.onclick = (e) => {
          e.preventDefault();
          this.app.workspace.getLeaf().openFile(task.file);
        };
        
        // Add edit button as a separate element at the end
        const taskEditBtn = li.createEl('button', { 
          cls: 'task-edit-btn',
          text: '✏️',
          title: 'Edit task'
        });
        
        // Edit controls for this specific task (hidden by default)
        const editControls = li.createEl('div', { cls: 'task-edit-controls' });
        editControls.style.display = 'none';
        
        let editMode = false;
        taskEditBtn.onclick = () => {
          editMode = !editMode;
          editControls.style.display = editMode ? 'block' : 'none';
          taskEditBtn.classList.toggle('active', editMode);
        };
        
        // Add edit controls for this task
        if (editControls) {
          const taskEditRow = editControls.createDiv('task-edit-row');
          
          // Priority selector
          const prioritySelect = taskEditRow.createEl('select', { cls: 'task-priority-select' });
          ['high', 'medium', 'low'].forEach(p => {
            const option = prioritySelect.createEl('option', { text: p, value: p });
            if (p === task.priority) option.selected = true;
          });
          prioritySelect.onchange = async () => {
            await this.updateTaskPriority(task, prioritySelect.value as 'high' | 'medium' | 'low');
          };
          
          // Assignee input
          const assigneeInput = taskEditRow.createEl('input', { 
            type: 'text',
            cls: 'task-assignee-input',
            placeholder: 'Assign to...',
            value: task.assignee
          });
          
          // Save button for assignee
          const saveBtn = taskEditRow.createEl('button', { 
            text: '✓',
            cls: 'task-save-btn',
            title: 'Save assignee'
          });
          saveBtn.onclick = async () => {
            await this.updateTaskAssignee(task, assigneeInput.value);
          };
        }
      }
    }
  }

  private async toggleTask(task: Task, completed: boolean) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');
      
      // Update the checkbox
      if (completed) {
        lines[task.line] = task.rawLine.replace('[ ]', '[x]');
      } else {
        lines[task.line] = task.rawLine.replace('[x]', '[ ]');
      }
      
      await this.app.vault.modify(task.file, lines.join('\n'));
      
      // Refresh the dashboard
      setTimeout(() => this.refresh(), 500);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      new Notice('Failed to update task. Please try again.');
    }
  }

  private async updateTaskPriority(task: Task, newPriority: 'high' | 'medium' | 'low') {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');
    
    // Get the current line
    let line = lines[task.line];
    
    // Remove old priority indicators
    line = line.replace(/🔴\s*/g, '').replace(/🟡\s*/g, '').replace(/🟢\s*/g, '');
    line = line.replace(/High Priority/gi, '').replace(/Medium Priority/gi, '').replace(/Low Priority/gi, '');
    
    // Add new priority indicator at the beginning of the task text
    const checkboxMatch = line.match(/^([\s-]*)\[([x ]?)\]\s*/);
    if (checkboxMatch) {
      const prefix = checkboxMatch[0];
      const restOfLine = line.substring(prefix.length);
      
      let priorityIndicator = '';
      if (newPriority === 'high') {
        priorityIndicator = '🔴 ';
      } else if (newPriority === 'medium') {
        priorityIndicator = '🟡 ';
      } else if (newPriority === 'low') {
        priorityIndicator = '🟢 ';
      }
      
      lines[task.line] = prefix + priorityIndicator + restOfLine.trim();
    }
    
      await this.app.vault.modify(task.file, lines.join('\n'));
      
      // Refresh the dashboard
      setTimeout(() => this.refresh(), 500);
    } catch (error) {
      console.error('Failed to update task priority:', error);
      new Notice('Failed to update priority. Please try again.');
    }
  }

  private async updateTaskAssignee(task: Task, newAssignee: string) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');
    
    // Get the current line
    let line = lines[task.line];
    
    // Remove old assignee
    line = line.replace(/\[\[@?[^\]]+\]\]/g, '');
    
    // Add new assignee before the date if present, otherwise at the end
    const dateMatch = line.match(/📅\s*\d{4}-\d{2}-\d{2}/);
    if (dateMatch && dateMatch.index !== undefined) {
      // Insert before date
      line = line.substring(0, dateMatch.index) + 
             `[[@${newAssignee.trim()}]] ` + 
             line.substring(dateMatch.index);
    } else {
      // Add at the end
      line = line.trim() + ` [[@${newAssignee.trim()}]]`;
    }
    
    lines[task.line] = line;
    
      await this.app.vault.modify(task.file, lines.join('\n'));
      
      // Refresh the dashboard
      setTimeout(() => this.refresh(), 500);
    } catch (error) {
      console.error('Failed to update task assignee:', error);
      new Notice('Failed to update assignee. Please try again.');
    }
  }

  private applyFilter(filter: string) {
    const sections = this.containerEl.querySelectorAll('.task-section');
    
    sections.forEach((section: Element) => {
      if (!(section instanceof HTMLElement)) return;
      const cards = section.querySelectorAll('.task-card');
      let sectionHasVisibleCards = false;
      
      cards.forEach((card: Element) => {
        if (!(card instanceof HTMLElement)) return;
        let show = true;
        
        switch(filter) {
          case 'all':
            show = true;
            break;
          case 'high':
            show = card.hasClass('high-card');
            break;
          case 'medium':
            show = card.hasClass('medium-card');
            break;
          case 'low':
            show = card.hasClass('low-card');
            break;
          case 'completed':
            show = card.hasClass('completed-card');
            break;
          case 'mine':
            const assigneeEl = card.querySelector('h3');
            if (assigneeEl && assigneeEl.textContent) {
              // Remove emoji prefix and trim
              const assignee = assigneeEl.textContent.replace(/^👤\s*/, '').trim().toLowerCase();
              const myName = this.plugin?.settings?.dashboardMyName?.toLowerCase()?.trim();
              if (myName) {
                // Check for exact match or if assignee contains user's name
                // Handle variations like "Jim Allen" matching "Jim Allen, Karishma Karnik"
                show = assignee === myName || assignee.includes(myName);
              } else {
                show = false;
              }
            } else {
              show = false;
            }
            break;
          case 'today':
            show = this.hasTasksDueToday(card);
            break;
          case 'week':
            show = this.hasTasksDueThisWeek(card);
            break;
        }
        
        card.style.display = show ? 'block' : 'none';
        if (show) sectionHasVisibleCards = true;
      });
      
      // Hide section if no cards are visible
      section.style.display = sectionHasVisibleCards ? 'block' : 'none';
    });
  }
  
  private hasTasksDueToday(card: HTMLElement): boolean {
    const dueDates = card.querySelectorAll('.task-due');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (const elem of Array.from(dueDates)) {
      const dateText = elem.textContent?.match(/\d{4}-\d{2}-\d{2}/);
      if (dateText) {
        const dueDate = new Date(dateText[0]);
        if (dueDate >= today && dueDate < tomorrow) {
          return true;
        }
      }
    }
    return false;
  }
  
  private hasTasksDueThisWeek(card: HTMLElement): boolean {
    const dueDates = card.querySelectorAll('.task-due');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    for (const elem of Array.from(dueDates)) {
      const dateText = elem.textContent?.match(/\d{4}-\d{2}-\d{2}/);
      if (dateText) {
        const dueDate = new Date(dateText[0]);
        if (dueDate >= today && dueDate <= weekFromNow) {
          return true;
        }
      }
    }
    return false;
  }

  private getFilteredTasks(): Task[] {
    if (this.showOnlyMyTasks && this.plugin?.settings?.dashboardMyName) {
      const myName = this.plugin.settings.dashboardMyName.toLowerCase().trim();
      return this.allTasks.filter(t => {
        const assignee = t.assignee.toLowerCase().trim();
        // Match exactly or if the assignee contains the user's name
        return assignee === myName || 
               assignee.includes(myName);
      });
    }
    return this.allTasks;
  }
  
  private async updateTaskDisplay() {
    try {
      const container = this.containerEl.children[1] as HTMLElement;
      
      // Find and clear the stats and task sections
      const statsContainer = container.querySelector('.dashboard-stats');
      const taskSections = container.querySelectorAll('.task-section');
      
      if (statsContainer) {
        (statsContainer as HTMLElement).empty();
        const displayTasks = this.getFilteredTasks();
        this.displayStats(statsContainer as HTMLElement, displayTasks);
      }
      
      // Remove old task sections
      taskSections.forEach(section => section.remove());
      
      // Re-display tasks with current filter
      const displayTasks = this.getFilteredTasks();
      await this.displayTasks(container, displayTasks);
    } catch (error) {
      console.error('Failed to update task display:', error);
      new Notice('Failed to update display. Please refresh.');
    }
  }
  
  private applyDashboardStyles() {
    // The CSS will be added separately
  }
}