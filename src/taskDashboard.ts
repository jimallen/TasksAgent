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

interface FilterCounts {
  high: number;
  medium: number;
  low: number;
  today: number;
  week: number;
  overdue: number;
  completed: number;
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
  private filterCounts: FilterCounts | null = null;
  private badgeElements: Map<string, HTMLElement> = new Map();
  private updateCountsDebounceTimer: NodeJS.Timeout | null = null;

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
    console.log('[TaskDashboard] onOpen called');
    await this.refresh();
  }

  async onClose() {
    // Clear any pending debounce timer
    if (this.updateCountsDebounceTimer) {
      clearTimeout(this.updateCountsDebounceTimer);
      this.updateCountsDebounceTimer = null;
    }
    this.component.unload();
  }

  async refresh() {
    console.log('[TaskDashboard] refresh called');
    console.log('[TaskDashboard] containerEl:', this.containerEl);
    console.log('[TaskDashboard] containerEl.children:', this.containerEl.children);
    const container = this.containerEl.children[1] as HTMLElement;
    console.log('[TaskDashboard] container:', container);
    container.empty();

    // Add dashboard class for styling
    container.addClass('dashboard');
    container.addClass('markdown-preview-view');

    // Show loading state
    this.showLoadingState(container);

    try {
      await this.loadAndDisplayDashboard(container);
    } catch (error) {
      console.error('[TaskDashboard] Failed to refresh dashboard:', error);
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
        this.updateFilterCounts(true); // Update counts for new view mode (immediate)
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
    
    // Update filter counts after loading tasks (immediate update)
    this.updateFilterCounts(true);
    
    // Get filtered tasks based on current view mode
    const displayTasks = this.getFilteredTasks();
    
    // Create task sections
    await this.displayTasks(container, displayTasks);
    
    // Apply custom CSS
    this.applyDashboardStyles();
  }

  private createBadgeElement(count: number, filterType: string): HTMLElement | null {
    // Don't create badge if count is zero
    if (count === 0) {
      return null;
    }
    
    const badge = document.createElement('span');
    badge.className = 'filter-badge';
    badge.setAttribute('data-filter-type', filterType);
    badge.textContent = count.toString();
    
    return badge;
  }

  private createFilterButtons(container: HTMLElement) {
    const filterGroup = container.createDiv('filter-group');
    
    // Clear existing badge references
    this.badgeElements.clear();
    
    // Calculate current filter counts
    const counts = this.getCurrentFilterCounts();
    this.filterCounts = counts; // Cache the counts
    
    const filters = [
      { label: 'High Priority', filter: 'high', active: true, dataAttr: 'high', count: counts.high },
      { label: 'Medium Priority', filter: 'medium', dataAttr: 'medium', count: counts.medium },
      { label: 'Low Priority', filter: 'low', dataAttr: 'low', count: counts.low },
      { label: 'Past Due', filter: 'overdue', dataAttr: 'overdue', count: counts.overdue },
      { label: 'Due Today', filter: 'today', dataAttr: 'due-today', count: counts.today },
      { label: 'Due This Week', filter: 'week', dataAttr: 'due-week', count: counts.week },
      { label: 'Completed', filter: 'completed', dataAttr: 'completed', count: counts.completed }
    ];
    
    filters.forEach(f => {
      const btn = filterGroup.createEl('button', {
        cls: f.active ? 'filter-btn active' : 'filter-btn'
      });
      btn.setAttribute('data-filter', f.dataAttr);
      
      // Create a wrapper span for the label and badge
      const labelSpan = btn.createEl('span', {
        text: f.label,
        cls: 'filter-btn-label'
      });
      
      // Add badge if count > 0
      const badge = this.createBadgeElement(f.count, f.dataAttr);
      if (badge) {
        btn.appendChild(badge);
        // Store reference to badge element for dynamic updates
        this.badgeElements.set(f.filter, badge);
      }
      
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
    console.log('[TaskDashboard] loadTasks called');
    const tasks: Task[] = [];

    // Get all markdown files in the vault
    const files = this.app.vault.getMarkdownFiles();
    console.log('[TaskDashboard] Found', files.length, 'markdown files');

    for (const file of files) {
      const fileTasks = await this.extractTasksFromFile(file);
      tasks.push(...fileTasks);
    }

    console.log('[TaskDashboard] Loaded', tasks.length, 'total tasks');
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
    
    // Sort assignees alphabetically (user's names first if configured)
    const assignees = Object.keys(grouped).sort((a, b) => {
      const myNamesStr = this.plugin?.settings?.dashboardMyName?.toLowerCase();
      if (myNamesStr) {
        // Support comma-separated list of names
        const myNames = myNamesStr
          .split(',')
          .map(name => name.trim())
          .filter(name => name.length > 0);
        
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // Check if either assignee matches any of the names
        const aIsMe = myNames.some(name => aLower.includes(name));
        const bIsMe = myNames.some(name => bLower.includes(name));
        
        if (aIsMe && !bIsMe) return -1;
        if (bIsMe && !aIsMe) return 1;
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
          await this.toggleTask(task, checkbox.checked, li);
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
            const editor = (view as { editor?: CodeMirror.Editor }).editor;
            if (editor) {
              // Set cursor to the task line
              editor.setCursor(task.line, 0);
              editor.scrollIntoView({
                from: { line: Math.max(0, task.line - 5), ch: 0 },
                to: { line: Math.min(editor.lineCount() - 1, task.line + 5), ch: 0 }
              });
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
            await this.updateTaskPriority(task, prioritySelect.value as 'high' | 'medium' | 'low', li);
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
            await this.updateTaskAssignee(task, assigneeInput.value, li);
          };
        }
      }
    }
  }

  private async toggleTask(task: Task, completed: boolean, listItem?: HTMLElement) {
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
      
      // Update the task in our data
      task.completed = completed;
      
      // If we have the list item element and task is completed, animate and remove it
      if (listItem && completed) {
        // Add fade-out animation
        listItem.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        listItem.style.opacity = '0';
        listItem.style.transform = 'translateX(-10px)';
        
        // Remove the element after animation completes
        setTimeout(() => {
          listItem.remove();
          
          // Check if the card has no more tasks and remove it
          const card = listItem.closest('.task-card') as HTMLElement;
          if (card) {
            const remainingTasks = card.querySelectorAll('.task-list-item');
            if (remainingTasks.length === 0) {
              card.style.transition = 'opacity 0.3s ease-out';
              card.style.opacity = '0';
              setTimeout(() => {
                card.remove();
                
                // Check if the section is now empty and hide it
                const section = card.closest('.task-section') as HTMLElement;
                if (section) {
                  const remainingCards = section.querySelectorAll('.task-card');
                  if (remainingCards.length === 0) {
                    section.style.display = 'none';
                  }
                }
              }, 300);
            }
          }
          
          // Update the stats without full refresh
          this.updateStatsOnly();
          // Update filter counts after task completion
          this.updateFilterCounts();
        }, 300);
      } else if (!completed) {
        // If unchecking, we need to refresh to show it again
        setTimeout(() => this.refresh(), 500);
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
      new Notice('Failed to update task. Please try again.');
    }
  }

  private async updateTaskPriority(task: Task, newPriority: 'high' | 'medium' | 'low', taskElement?: HTMLElement) {
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
      
      // Update task data
      task.priority = newPriority;
      
      // If we have the task element, move it to the new priority section
      if (taskElement) {
        const currentCard = taskElement.closest('.task-card') as HTMLElement;
        const currentSection = currentCard?.closest('.task-section') as HTMLElement;
        
        if (currentCard && currentSection) {
          // Find the target section
          const container = this.containerEl.children[1] as HTMLElement;
          let targetSectionClass = '';
          if (newPriority === 'high') targetSectionClass = 'high-priority';
          else if (newPriority === 'medium') targetSectionClass = 'medium-priority';
          else targetSectionClass = 'low-priority';
          
          const targetSection = container.querySelector(`.task-section.${targetSectionClass}`) as HTMLElement;
          
          if (targetSection && targetSection !== currentSection) {
            // Animate the move
            taskElement.style.transition = 'opacity 0.3s ease-out';
            taskElement.style.opacity = '0';
            
            setTimeout(() => {
              // Remove from current card
              taskElement.remove();
              
              // Check if current card is now empty
              const remainingTasks = currentCard.querySelectorAll('.task-list-item');
              if (remainingTasks.length === 0) {
                currentCard.style.transition = 'opacity 0.3s ease-out';
                currentCard.style.opacity = '0';
                setTimeout(() => currentCard.remove(), 300);
              }
              
              // Find or create assignee card in target section
              const assignee = task.assignee;
              let targetCard = Array.from(targetSection.querySelectorAll('.task-card')).find(card => {
                const title = card.querySelector('h3')?.textContent;
                return title?.includes(assignee);
              }) as HTMLElement;
              
              if (!targetCard) {
                // Create new card
                targetCard = targetSection.createDiv(`task-card ${newPriority}-card`);
                const header = targetCard.createDiv('card-header');
                header.createEl('h3', {
                  text: `👤 ${assignee}`,
                  cls: 'card-assignee-title'
                });
                targetCard.createEl('ul', { cls: 'task-list' });
              }
              
              // Add task to target card
              const targetList = targetCard.querySelector('.task-list');
              if (targetList) {
                // Clone the task element structure
                const newLi = targetList.createEl('li', { cls: 'task-list-item' });
                newLi.innerHTML = taskElement.innerHTML;
                
                // Reattach event handlers
                const checkbox = newLi.querySelector('.task-checkbox') as HTMLInputElement;
                if (checkbox) {
                  checkbox.onclick = async () => {
                    await this.toggleTask(task, checkbox.checked, newLi);
                  };
                }
                
                // Fade in
                newLi.style.opacity = '0';
                setTimeout(() => {
                  newLi.style.transition = 'opacity 0.3s ease-in';
                  newLi.style.opacity = '1';
                }, 10);
              }
              
              // Update stats
              this.updateStatsOnly();
            }, 300);
          }
        }
      } else {
        // Fallback to refresh if no element provided
        setTimeout(() => this.refresh(), 500);
      }
    } catch (error) {
      console.error('Failed to update task priority:', error);
      new Notice('Failed to update priority. Please try again.');
    }
  }

  private async updateTaskAssignee(task: Task, newAssignee: string, taskElement?: HTMLElement) {
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
      
      // Update task data
      const oldAssignee = task.assignee;
      task.assignee = newAssignee.trim();
      
      // If we have the task element, move it to the new assignee's card
      if (taskElement && oldAssignee !== task.assignee) {
        const currentCard = taskElement.closest('.task-card') as HTMLElement;
        const currentSection = currentCard?.closest('.task-section') as HTMLElement;
        
        if (currentCard && currentSection) {
          // Animate the move
          taskElement.style.transition = 'opacity 0.3s ease-out';
          taskElement.style.opacity = '0';
          
          setTimeout(() => {
            // Remove from current card
            taskElement.remove();
            
            // Check if current card is now empty
            const remainingTasks = currentCard.querySelectorAll('.task-list-item');
            if (remainingTasks.length === 0) {
              currentCard.style.transition = 'opacity 0.3s ease-out';
              currentCard.style.opacity = '0';
              setTimeout(() => currentCard.remove(), 300);
            }
            
            // Find or create assignee card in the same section
            let targetCard = Array.from(currentSection.querySelectorAll('.task-card')).find(card => {
              const title = card.querySelector('h3')?.textContent;
              return title?.includes(task.assignee);
            }) as HTMLElement;
            
            if (!targetCard) {
              // Create new card for the new assignee
              const priority = task.priority || 'medium';
              targetCard = currentSection.createDiv(`task-card ${priority}-card`);
              const header = targetCard.createDiv('card-header');
              header.createEl('h3', {
                text: `👤 ${task.assignee}`,
                cls: 'card-assignee-title'
              });
              targetCard.createEl('ul', { cls: 'task-list' });
            }
            
            // Add task to target card
            const targetList = targetCard.querySelector('.task-list');
            if (targetList) {
              // Clone the task element structure
              const newLi = targetList.createEl('li', { cls: 'task-list-item' });
              newLi.innerHTML = taskElement.innerHTML;
              
              // Update the displayed assignee in the metadata
              const metadataSpan = newLi.querySelector('.task-metadata');
              if (metadataSpan) {
                metadataSpan.innerHTML = metadataSpan.innerHTML.replace(/👤\s*[^<]*/g, `👤 ${task.assignee}`);
              }
              
              // Reattach event handlers
              const checkbox = newLi.querySelector('.task-checkbox') as HTMLInputElement;
              if (checkbox) {
                checkbox.onclick = async () => {
                  await this.toggleTask(task, checkbox.checked, newLi);
                };
              }
              
              // Reattach edit button handler
              const editBtn = newLi.querySelector('.edit-button') as HTMLElement;
              if (editBtn) {
                const editContainer = newLi.querySelector('.edit-container') as HTMLElement;
                if (editContainer) {
                  editBtn.onclick = () => {
                    editContainer.style.display = editContainer.style.display === 'none' ? 'flex' : 'none';
                  };
                  
                  // Reattach priority and assignee handlers
                  const prioritySelect = editContainer.querySelector('select') as HTMLSelectElement;
                  if (prioritySelect) {
                    prioritySelect.onchange = async () => {
                      await this.updateTaskPriority(task, prioritySelect.value as 'high' | 'medium' | 'low', newLi);
                    };
                  }
                  
                  const saveBtn = editContainer.querySelector('button') as HTMLButtonElement;
                  const assigneeInput = editContainer.querySelector('input') as HTMLInputElement;
                  if (saveBtn && assigneeInput) {
                    saveBtn.onclick = async () => {
                      await this.updateTaskAssignee(task, assigneeInput.value, newLi);
                    };
                  }
                }
              }
              
              // Fade in
              newLi.style.opacity = '0';
              setTimeout(() => {
                newLi.style.transition = 'opacity 0.3s ease-in';
                newLi.style.opacity = '1';
              }, 10);
            }
            
            // Update stats
            this.updateStatsOnly();
          }, 300);
        }
      } else if (!taskElement) {
        // Fallback to refresh if no element provided
        setTimeout(() => this.refresh(), 500);
      }
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
              const myNamesStr = this.plugin?.settings?.dashboardMyName?.toLowerCase()?.trim();
              if (myNamesStr) {
                // Support comma-separated list of names
                const myNames = myNamesStr
                  .split(',')
                  .map(name => name.trim())
                  .filter(name => name.length > 0);
                
                // Check if assignee matches any of the names
                show = myNames.some(name => 
                  assignee === name || assignee.includes(name)
                );
              } else {
                show = false;
              }
            } else {
              show = false;
            }
            break;
          case 'overdue':
            show = this.hasTasksOverdue(card);
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
    // Check if this is a completed card - never show completed cards for date filters
    if (card.classList.contains('completed-card')) {
      return false;
    }
    
    const taskItems = card.querySelectorAll('.task-list-item');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (const item of Array.from(taskItems)) {
      // Skip if task is completed
      const checkbox = item.querySelector('.task-checkbox') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        continue;
      }
      
      // Look for due date in the task metadata
      const dueDateElem = item.querySelector('.task-due');
      if (dueDateElem) {
        const dateText = dueDateElem.textContent?.match(/\d{4}-\d{2}-\d{2}/);
        if (dateText) {
          const dueDate = new Date(dateText[0] + 'T00:00:00');
          dueDate.setHours(0, 0, 0, 0);
          
          if (dueDate >= today && dueDate < tomorrow) {
            return true; // Found at least one task due today
          }
        }
      }
    }
    
    return false;
  }
  
  private hasTasksDueThisWeek(card: HTMLElement): boolean {
    // Check if this is a completed card - never show completed cards for date filters
    if (card.classList.contains('completed-card')) {
      return false;
    }
    
    const taskItems = card.querySelectorAll('.task-list-item');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    for (const item of Array.from(taskItems)) {
      // Skip if task is completed
      const checkbox = item.querySelector('.task-checkbox') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        continue;
      }
      
      // Look for due date in the task metadata
      const dueDateElem = item.querySelector('.task-due');
      if (dueDateElem) {
        const dateText = dueDateElem.textContent?.match(/\d{4}-\d{2}-\d{2}/);
        if (dateText) {
          const dueDate = new Date(dateText[0] + 'T00:00:00');
          dueDate.setHours(0, 0, 0, 0);
          
          if (dueDate >= today && dueDate <= weekFromNow) {
            return true; // Found at least one task due this week
          }
        }
      }
    }
    
    return false;
  }
  
  private hasTasksOverdue(card: HTMLElement): boolean {
    // Check if this is a completed card - never show completed cards for overdue filter
    if (card.classList.contains('completed-card')) {
      return false;
    }
    
    const taskItems = card.querySelectorAll('.task-list-item');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const item of Array.from(taskItems)) {
      // Skip if task is completed
      const checkbox = item.querySelector('.task-checkbox') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        continue;
      }
      
      // Look for due date in the task metadata
      const dueDateElem = item.querySelector('.task-due');
      if (dueDateElem) {
        const dateText = dueDateElem.textContent?.match(/\d{4}-\d{2}-\d{2}/);
        if (dateText) {
          const dueDate = new Date(dateText[0] + 'T00:00:00');
          dueDate.setHours(0, 0, 0, 0);
          
          // Check if the task is overdue (past due date)
          if (dueDate < today) {
            return true; // Found at least one overdue task
          }
        }
      }
    }
    
    return false;
  }

  private updateStatsOnly() {
    // Stats section has been removed - counters are now shown in filter buttons
    // This method is kept for backward compatibility but does nothing
  }

  private getFilteredTasks(): Task[] {
    if (this.showOnlyMyTasks && this.plugin?.settings?.dashboardMyName) {
      // Support comma-separated list of names
      const myNames = this.plugin.settings.dashboardMyName
        .split(',')
        .map(name => name.toLowerCase().trim())
        .filter(name => name.length > 0);
      
      if (myNames.length === 0) {
        return this.allTasks;
      }
      
      return this.allTasks.filter(t => {
        const assignee = t.assignee.toLowerCase().trim();
        // Check if assignee matches any of the names
        return myNames.some(name => 
          assignee === name || assignee.includes(name)
        );
      });
    }
    return this.allTasks;
  }
  
  private calculateFilterCounts(tasks: Task[]): FilterCounts {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const counts: FilterCounts = {
      high: 0,
      medium: 0,
      low: 0,
      today: 0,
      week: 0,
      overdue: 0,
      completed: 0
    };
    
    for (const task of tasks) {
      // Priority counts (only for non-completed tasks)
      if (!task.completed) {
        if (task.priority === 'high') counts.high++;
        else if (task.priority === 'medium') counts.medium++;
        else if (task.priority === 'low') counts.low++;
        
        // Due date counts
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          
          // Overdue - past due date and not completed
          if (dueDate < today) {
            counts.overdue++;
          }
          // Due today
          else if (dueDate >= today && dueDate <= endOfToday) {
            counts.today++;
          }
          // Due this week (including today)
          if (dueDate >= today && dueDate <= weekFromNow) {
            counts.week++;
          }
        }
      }
      
      // Completed count
      if (task.completed) {
        counts.completed++;
      }
    }
    
    return counts;
  }
  
  private getCurrentFilterCounts(): FilterCounts {
    // Get the appropriate task list based on current view mode
    const tasksToCount = this.getFilteredTasks();
    return this.calculateFilterCounts(tasksToCount);
  }
  
  private updateFilterCountsImmediate(): void {
    // Recalculate counts
    const newCounts = this.getCurrentFilterCounts();
    this.filterCounts = newCounts;
    
    // Update each badge element
    const updateBadge = (filterKey: string, count: number) => {
      const badge = this.badgeElements.get(filterKey);
      if (badge) {
        if (count > 0) {
          badge.textContent = count.toString();
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      } else if (count > 0) {
        // Badge doesn't exist but we have a count, need to create it
        const button = this.containerEl.querySelector(`[data-filter="${this.getDataAttr(filterKey)}"]`);
        if (button) {
          const newBadge = this.createBadgeElement(count, this.getDataAttr(filterKey));
          if (newBadge) {
            button.appendChild(newBadge);
            this.badgeElements.set(filterKey, newBadge);
          }
        }
      }
    };
    
    // Update all filter badges
    updateBadge('high', newCounts.high);
    updateBadge('medium', newCounts.medium);
    updateBadge('low', newCounts.low);
    updateBadge('overdue', newCounts.overdue);
    updateBadge('today', newCounts.today);
    updateBadge('week', newCounts.week);
    updateBadge('completed', newCounts.completed);
  }
  
  private updateFilterCounts(immediate: boolean = false): void {
    if (immediate) {
      // Update immediately without debouncing
      this.updateFilterCountsImmediate();
      return;
    }
    
    // Clear existing timer
    if (this.updateCountsDebounceTimer) {
      clearTimeout(this.updateCountsDebounceTimer);
    }
    
    // Set new debounced update
    this.updateCountsDebounceTimer = setTimeout(() => {
      this.updateFilterCountsImmediate();
      this.updateCountsDebounceTimer = null;
    }, 150); // 150ms debounce delay
  }
  
  private getDataAttr(filterKey: string): string {
    const mapping: Record<string, string> = {
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'overdue': 'overdue',
      'today': 'due-today',
      'week': 'due-week',
      'completed': 'completed'
    };
    return mapping[filterKey] || filterKey;
  }
  
  private async updateTaskDisplay() {
    try {
      const container = this.containerEl.children[1] as HTMLElement;
      
      // Find and clear the task sections
      const taskSections = container.querySelectorAll('.task-section');
      
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