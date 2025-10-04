import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Notice,
  MarkdownRenderer,
  Component
} from 'obsidian';
import { TaskClusterer, TaskCluster, ClusteringResult } from './taskClusterer';

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
  delegatedFrom?: string;
  delegatedDate?: string;
  delegationChain?: Array<{ assignee: string; date: string }>;
  clusterId?: string;
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
  delegated: number;
}

interface PluginSettings {
  dashboardMyName?: string;
  dashboardShowOnlyMyTasks?: boolean;
  notesFolder?: string;
  lookbackHours?: number;
  anthropicApiKey?: string;
  claudeModel?: string;
}

interface MeetingTasksPlugin {
  settings: PluginSettings;
}

export class TaskDashboardView extends ItemView {
  private component: Component;
  private plugin: MeetingTasksPlugin | undefined;
  private allTasks: Task[] = [];
  private isLoading: boolean = false;
  private filterCounts: FilterCounts | null = null;
  private badgeElements: Map<string, HTMLElement> = new Map();
  private updateCountsDebounceTimer: NodeJS.Timeout | null = null;
  private cachedParticipants: string[] | null = null;
  private taskClusterer: TaskClusterer | null = null;
  private clusteringResult: ClusteringResult | null = null;
  private showClustered: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin?: MeetingTasksPlugin) {
    super(leaf);
    this.component = new Component();
    this.plugin = plugin;
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

    // Clear cached participants on refresh
    this.cachedParticipants = null;

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
  
  private currentFilter: string = 'all';
  private activeFilters: Set<string> = new Set();

  private async loadAndDisplayDashboard(container: HTMLElement) {
    // Clear loading state
    container.empty();

    // Create header
    const header = container.createDiv('dashboard-header');
    header.createEl('h1', { text: 'TASK DASHBOARD', cls: 'title' });

    // Add control buttons
    const controls = header.createDiv('dashboard-controls');

    // Add cluster button
    const clusterBtn = controls.createEl('button', {
      text: this.showClustered ? '📋 Show Task List' : '🧩 Show Clustered View',
      cls: 'dashboard-control-btn dashboard-cluster-btn'
    });

    clusterBtn.onclick = async () => {
      console.log('[ClusterBtn] Clicked. Current showClustered:', this.showClustered);

      // Clear existing task sections
      const taskSections = container.querySelectorAll('.task-section');
      taskSections.forEach(section => section.remove());

      if (!this.showClustered) {
        // Switch to clustered view
        this.showClustered = true;
        clusterBtn.textContent = '📋 Show Task List';
        console.log('[ClusterBtn] Switching to clustered view');

        await this.displayClusteredTasks(container);

        // Re-apply active filters to clustered view
        if (this.activeFilters.size > 0) {
          this.applyMultipleFiltersToClusters();
        }
      } else {
        // Switch to normal view
        this.showClustered = false;
        clusterBtn.textContent = '🧩 Show Clustered View';
        console.log('[ClusterBtn] Switching to task list view');

        // Display normal task list
        const displayTasks = this.currentFilter === 'delegated' ? this.allTasks : this.getFilteredTasks();
        await this.displayTasks(container, displayTasks);

        // Re-apply active filters to normal view
        if (this.activeFilters.size > 0) {
          this.applyMultipleFilters();
        }
      }
    };

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

    // Load clusters from saved IDs (but keep current view state)
    const hasClusters = this.allTasks.some(t => t.clusterId);
    if (hasClusters && !this.clusteringResult) {
      this.clusteringResult = this.buildClusteringFromSavedIds();
      console.log('[Dashboard] Loaded', this.clusteringResult?.clusters.length || 0, 'clusters from saved IDs');
    }

    // Update button text based on current state
    if (this.showClustered) {
      clusterBtn.textContent = '📋 Show Task List';
    }

    console.log('[Dashboard] Current state: showClustered =', this.showClustered);

    // Update filter counts after loading tasks (immediate update)
    this.updateFilterCounts(true);

    // Get filtered tasks based on current view mode
    // Delegated filter always uses all tasks, regardless of "My Tasks" toggle
    const displayTasks = this.currentFilter === 'delegated' ? this.allTasks : this.getFilteredTasks();

    console.log('[Dashboard] Render state:', {
      showClustered: this.showClustered,
      hasClusteringResult: !!this.clusteringResult,
      currentFilter: this.currentFilter,
      allTasksCount: this.allTasks.length,
      displayTasksCount: displayTasks.length
    });

    // Create task sections - either clustered or normal view
    if (this.showClustered && this.clusteringResult) {
      await this.displayClusteredTasks(container);
      // Re-apply active filters to clustered view
      if (this.activeFilters.size > 0) {
        this.applyMultipleFiltersToClusters();
      }
    } else {
      console.log('[Dashboard] Calling displayTasks with', displayTasks.length, 'tasks');
      await this.displayTasks(container, displayTasks);
      // Re-apply active filters to normal view
      if (this.activeFilters.size > 0) {
        this.applyMultipleFilters();
      }
    }

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
      { label: '🔴 High', filter: 'high', active: false, dataAttr: 'high', count: counts.high },
      { label: '🟡 Medium', filter: 'medium', active: false, dataAttr: 'medium', count: counts.medium },
      { label: '⏰ Past Due', filter: 'overdue', dataAttr: 'overdue', count: counts.overdue },
      { label: '📅 This Week', filter: 'week', dataAttr: 'due-week', count: counts.week },
      { label: '👥 Delegated', filter: 'delegated', dataAttr: 'delegated', count: counts.delegated },
      { label: '✅ Done', filter: 'completed', dataAttr: 'completed', count: counts.completed }
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
        // Toggle filter in/out of active set
        if (btn.hasClass('active')) {
          btn.removeClass('active');
          this.activeFilters.delete(f.filter);
        } else {
          btn.addClass('active');
          this.activeFilters.add(f.filter);
        }

        console.log('[Filter] Active filters:', Array.from(this.activeFilters));

        // Update currentFilter for backward compatibility
        this.currentFilter = this.activeFilters.size === 0 ? 'all' : Array.from(this.activeFilters)[0];

        // Apply filters to current view
        if (this.activeFilters.has('delegated') && this.activeFilters.size === 1) {
          // Special case: delegated only
          this.updateTaskDisplay();
        } else if (this.showClustered) {
          this.applyMultipleFiltersToClusters();
        } else {
          this.applyMultipleFilters();
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

          // Extract delegation metadata
          const delegatedFromMatch = taskText.match(/🔗\s*delegated-from:@?([^📆🔗]+?)(?:\s*📆|\s*🔗|\s*$)/);
          const delegatedFrom = delegatedFromMatch ? delegatedFromMatch[1].trim() : undefined;

          const delegatedDateMatch = taskText.match(/📆\s*(\d{4}-\d{2}-\d{2})/);
          const delegatedDate = delegatedDateMatch ? delegatedDateMatch[1] : undefined;

          // Extract delegation chain
          const delegationChain: Array<{ assignee: string; date: string }> = [];
          const chainMatches = taskText.matchAll(/🔗@?([^\s]+)📆(\d{4}-\d{2}-\d{2})/g);
          for (const match of chainMatches) {
            delegationChain.push({ assignee: match[1], date: match[2] });
          }

          // Extract cluster ID
          const clusterMatch = taskText.match(/🧩\s*cluster:([a-z0-9-]+)/);
          const clusterId = clusterMatch ? clusterMatch[1] : undefined;

          // Clean task text
          const cleanText = taskText
            .replace(/\[\[@?[^\]]+\]\]/g, '')
            .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/📆\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/🔗\s*delegated-from:@?[^📆🔗]+/g, '')
            .replace(/🔗@?[^\s]+📆\d{4}-\d{2}-\d{2}/g, '')
            .replace(/🧩\s*cluster:[a-z0-9-]+/g, '')
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
            rawLine: line,
            delegatedFrom,
            delegatedDate,
            delegationChain: delegationChain.length > 0 ? delegationChain : undefined,
            clusterId
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
    console.log('[displayTasks] Called with', tasks.length, 'tasks');

    // Clear existing task sections first
    const taskSections = container.querySelectorAll('.task-section');
    console.log('[displayTasks] Clearing', taskSections.length, 'existing sections');
    taskSections.forEach(section => section.remove());

    // Group tasks by priority
    const highPriority = tasks.filter(t => t.priority === 'high' && !t.completed);
    const mediumPriority = tasks.filter(t => t.priority === 'medium' && !t.completed);
    const lowPriority = tasks.filter(t => t.priority === 'low' && !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    console.log('[displayTasks] Grouped:', {
      high: highPriority.length,
      medium: mediumPriority.length,
      low: lowPriority.length,
      completed: completedTasks.length
    });
    
    // Create sections
    if (highPriority.length > 0) {
      console.log('[displayTasks] Creating high priority section with', highPriority.length, 'tasks');
      await this.createTaskSection(container, '🔴 High Priority', highPriority, 'high');
    }

    if (mediumPriority.length > 0) {
      console.log('[displayTasks] Creating medium priority section with', mediumPriority.length, 'tasks');
      await this.createTaskSection(container, '🟡 Medium Priority', mediumPriority, 'medium');
    }

    if (lowPriority.length > 0) {
      console.log('[displayTasks] Creating low priority section with', lowPriority.length, 'tasks');
      await this.createTaskSection(container, '🟢 Low Priority', lowPriority, 'low');
    }

    console.log('[displayTasks] Finished creating sections');
    
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

        // Display delegation metadata
        if (task.delegatedFrom) {
          // Add "Delegated" tag
          const delegatedTag = meta.createEl('span', {
            cls: 'task-tag task-delegated-tag',
            text: 'DELEGATED',
            title: `Delegated from ${task.delegatedFrom}${task.delegatedDate ? ' on ' + task.delegatedDate : ''}`
          });

          const delegationSpan = meta.createEl('span', {
            cls: 'task-delegation',
            title: `Delegated from ${task.delegatedFrom}${task.delegatedDate ? ' on ' + task.delegatedDate : ''}`
          });
          delegationSpan.setText(`🔗 from @${task.delegatedFrom}`);
          if (task.delegatedDate) {
            delegationSpan.setText(`🔗 from @${task.delegatedFrom} 📆 ${task.delegatedDate}`);
          }
        }

        // Display delegation chain if present
        if (task.delegationChain && task.delegationChain.length > 0) {
          const chainSpan = meta.createEl('span', {
            cls: 'task-delegation-chain',
            title: 'Delegation history'
          });
          const chainText = task.delegationChain
            .map(d => `@${d.assignee} (${d.date})`)
            .join(' → ');
          chainSpan.setText(`🔗 Chain: ${chainText}`);
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

          // Assignee input with autocomplete
          const assigneeInput = taskEditRow.createEl('input', {
            type: 'text',
            cls: 'task-assignee-input',
            placeholder: 'Type @ to see participants...',
            value: task.assignee
          });

          // Create autocomplete dropdown
          const autocompleteDiv = taskEditRow.createEl('div', {
            cls: 'task-assignee-autocomplete'
          });
          autocompleteDiv.style.display = 'none';

          // Load participants from ALL notes
          let participants: string[] = [];
          this.loadAllParticipants().then(p => {
            participants = p;
          });

          // Autocomplete logic
          assigneeInput.addEventListener('input', (e) => {
            const value = assigneeInput.value;
            const cursorPos = assigneeInput.selectionStart || 0;

            // Find if we're typing after an @
            const textBeforeCursor = value.substring(0, cursorPos);
            const atMatch = textBeforeCursor.match(/@(\w*)$/);

            if (atMatch && participants.length > 0) {
              const searchTerm = atMatch[1].toLowerCase();
              const filtered = participants.filter(p =>
                p.toLowerCase().includes(searchTerm)
              );

              if (filtered.length > 0) {
                autocompleteDiv.empty();
                filtered.forEach(participant => {
                  const item = autocompleteDiv.createEl('div', {
                    cls: 'autocomplete-item',
                    text: participant
                  });
                  item.onclick = () => {
                    // Replace @search with participant name
                    const beforeAt = value.substring(0, cursorPos - atMatch[0].length);
                    const afterCursor = value.substring(cursorPos);
                    assigneeInput.value = beforeAt + participant + afterCursor;
                    autocompleteDiv.style.display = 'none';
                    assigneeInput.focus();
                  };
                });
                autocompleteDiv.style.display = 'block';
              } else {
                autocompleteDiv.style.display = 'none';
              }
            } else {
              autocompleteDiv.style.display = 'none';
            }
          });

          // Hide autocomplete when clicking outside
          assigneeInput.addEventListener('blur', () => {
            setTimeout(() => {
              autocompleteDiv.style.display = 'none';
            }, 200);
          });

          // Save button (handles both priority and assignee changes with delegation tracking)
          const saveBtn = taskEditRow.createEl('button', {
            text: '✓',
            cls: 'task-save-btn',
            title: 'Save changes (assignee changes are tracked as delegations)'
          });
          saveBtn.onclick = async () => {
            // Check if priority changed
            const newPriority = prioritySelect.value as 'high' | 'medium' | 'low';
            const priorityChanged = newPriority !== task.priority;

            // Check if assignee changed
            const newAssignee = assigneeInput.value.trim();
            const assigneeChanged = newAssignee !== task.assignee && newAssignee !== '';

            // Update priority if changed
            if (priorityChanged) {
              await this.updateTaskPriority(task, newPriority, li);
            }

            // Update assignee with delegation tracking if changed
            if (assigneeChanged) {
              await this.updateTaskDelegation(task, newAssignee, li);
            }

            // Close edit controls if nothing changed
            if (!priorityChanged && !assigneeChanged) {
              editControls.style.display = 'none';
              taskEditBtn.classList.remove('active');
            }
          };

          // Cancel button
          const cancelBtn = taskEditRow.createEl('button', {
            text: '✕',
            cls: 'task-cancel-btn',
            title: 'Cancel changes'
          });
          cancelBtn.onclick = () => {
            // Reset values to original
            prioritySelect.value = task.priority;
            assigneeInput.value = task.assignee;
            // Close edit controls
            editControls.style.display = 'none';
            taskEditBtn.classList.remove('active');
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

  private async updateTaskDelegation(task: Task, newAssignee: string, taskElement?: HTMLElement) {
    try {
      console.log('[TaskDashboard] Delegating task:', task.text, 'from', task.assignee, 'to', newAssignee);

      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');

      let line = lines[task.line];
      console.log('[TaskDashboard] Original line:', line);

      // Get current assignee for delegation chain
      const currentAssignee = task.assignee;

      // Check if assigning back to myself (the original delegator)
      const myNamesStr = this.plugin?.settings?.dashboardMyName?.toLowerCase();
      const myNames = myNamesStr
        ? myNamesStr.split(',').map(name => name.trim()).filter(name => name.length > 0)
        : [];

      const newAssigneeLower = newAssignee.toLowerCase().trim();
      const isAssigningToMyself = myNames.length > 0 && myNames.some(name =>
        newAssigneeLower === name || newAssigneeLower.includes(name) || name.includes(newAssigneeLower)
      );

      // Remove existing delegation metadata FIRST (but not due date 📅)
      // This removes: 🔗 delegated-from:@Jim Allen 📆 2025-01-01
      line = line.replace(/🔗\s*delegated-from:@?[^📆\[]+/g, '');
      line = line.replace(/📆\s*\d{4}-\d{2}-\d{2}/g, '');

      // Then remove old assignee bracket
      line = line.replace(/\[\[@?[^\]]+\]\]/g, '');

      // Clean up extra whitespace
      line = line.replace(/\s+/g, ' ').trim();

      // If assigning back to myself, don't add delegation metadata
      if (isAssigningToMyself) {
        // Just add the assignee, no delegation metadata
        const dateMatch = line.match(/📅\s*\d{4}-\d{2}-\d{2}/);
        if (dateMatch && dateMatch.index !== undefined) {
          line = line.substring(0, dateMatch.index) +
                 `[[@${newAssignee.trim()}]] ` +
                 line.substring(dateMatch.index);
        } else {
          line = line.trim() + ` [[@${newAssignee.trim()}]]`;
        }

        console.log('[TaskDashboard] Task assigned back to self, removing delegation metadata');
        new Notice(`Task assigned back to ${newAssignee}`);

        // Update task data
        task.delegatedFrom = undefined;
        task.delegatedDate = undefined;
        task.assignee = newAssignee.trim();
      } else {
        // Add delegation metadata
        const today = new Date().toISOString().split('T')[0];
        const delegationMeta = ` 🔗 delegated-from:@${currentAssignee} 📆 ${today}`;

        // Add new assignee and delegation metadata before the due date if present
        const dateMatch = line.match(/📅\s*\d{4}-\d{2}-\d{2}/);
        if (dateMatch && dateMatch.index !== undefined) {
          line = line.substring(0, dateMatch.index) +
                 `[[@${newAssignee.trim()}]]${delegationMeta} ` +
                 line.substring(dateMatch.index);
        } else {
          line = line.trim() + ` [[@${newAssignee.trim()}]]${delegationMeta}`;
        }

        console.log('[TaskDashboard] Task delegated successfully. delegatedFrom:', currentAssignee);
        new Notice(`Task delegated from ${currentAssignee} to ${newAssignee}`);

        // Update task data
        task.delegatedFrom = currentAssignee;
        task.delegatedDate = today;
        task.assignee = newAssignee.trim();
      }

      console.log('[TaskDashboard] Updated line:', line);
      lines[task.line] = line;
      await this.app.vault.modify(task.file, lines.join('\n'));

      // Refresh to show updated delegation
      setTimeout(() => this.refresh(), 500);
    } catch (error) {
      console.error('[TaskDashboard] Failed to delegate task:', error);
      new Notice('Failed to delegate task. Please try again.');
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

    // Special handling for delegated filter - always show all delegated tasks
    const shouldShowAllTasks = filter === 'delegated';

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
          case 'delegated':
            show = this.hasDelegatedTasks(card);
            break;
        }

        card.style.display = show ? 'block' : 'none';
        if (show) sectionHasVisibleCards = true;
      });

      // Hide section if no cards are visible
      section.style.display = sectionHasVisibleCards ? 'block' : 'none';
    });
  }

  private applyMultipleFilters() {
    const sections = this.containerEl.querySelectorAll('.task-section');

    // If no filters active, show all
    if (this.activeFilters.size === 0) {
      sections.forEach((section: Element) => {
        if (section instanceof HTMLElement) {
          section.style.display = 'block';
          const cards = section.querySelectorAll('.task-card');
          cards.forEach((card: Element) => {
            if (card instanceof HTMLElement) {
              card.style.display = 'block';
            }
          });
        }
      });
      return;
    }

    sections.forEach((section: Element) => {
      if (!(section instanceof HTMLElement)) return;
      const cards = section.querySelectorAll('.task-card');
      let sectionHasVisibleCards = false;

      cards.forEach((card: Element) => {
        if (!(card instanceof HTMLElement)) return;

        // Card passes if it matches ANY of the active filters (OR logic)
        let show = false;

        for (const filter of this.activeFilters) {
          let matches = false;

          switch(filter) {
            case 'high':
              matches = card.hasClass('high-card');
              break;
            case 'medium':
              matches = card.hasClass('medium-card');
              break;
            case 'low':
              matches = card.hasClass('low-card');
              break;
            case 'completed':
              matches = card.hasClass('completed-card');
              break;
            case 'overdue':
              matches = this.hasTasksOverdue(card);
              break;
            case 'today':
              matches = this.hasTasksDueToday(card);
              break;
            case 'week':
              matches = this.hasTasksDueThisWeek(card);
              break;
            case 'delegated':
              matches = this.hasDelegatedTasks(card);
              break;
          }

          if (matches) {
            show = true;
            break; // Found a match, no need to check other filters
          }
        }

        card.style.display = show ? 'block' : 'none';
        if (show) sectionHasVisibleCards = true;
      });

      // Hide section if no cards are visible
      section.style.display = sectionHasVisibleCards ? 'block' : 'none';
    });
  }

  private applyMultipleFiltersToClusters() {
    const clusterCards = this.containerEl.querySelectorAll('.cluster-card');
    const standaloneSections = this.containerEl.querySelectorAll('.standalone-section .task-card');

    // If no filters active, show all
    if (this.activeFilters.size === 0) {
      clusterCards.forEach((card: Element) => {
        if (card instanceof HTMLElement) card.style.display = 'block';
      });
      standaloneSections.forEach((card: Element) => {
        if (card instanceof HTMLElement) card.style.display = 'block';
      });
      return;
    }

    // Apply filters to cluster cards and standalone tasks
    const allCards = Array.from(clusterCards).concat(Array.from(standaloneSections));
    allCards.forEach((card: Element) => {
      if (!(card instanceof HTMLElement)) return;

      let show = false;

      for (const filter of this.activeFilters) {
        let matches = false;

        switch(filter) {
          case 'high':
            matches = card.hasClass('high-card');
            break;
          case 'medium':
            matches = card.hasClass('medium-card');
            break;
          case 'low':
            matches = card.hasClass('low-card');
            break;
          case 'completed':
            matches = card.hasClass('completed-card');
            break;
          case 'overdue':
            matches = this.hasTasksOverdue(card);
            break;
          case 'today':
            matches = this.hasTasksDueToday(card);
            break;
          case 'week':
            matches = this.hasTasksDueThisWeek(card);
            break;
          case 'delegated':
            matches = this.hasDelegatedTasks(card);
            break;
        }

        if (matches) {
          show = true;
          break;
        }
      }

      card.style.display = show ? 'block' : 'none';
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

  private hasDelegatedTasks(card: HTMLElement): boolean {
    // Check if this is a completed card - don't show completed for delegated filter
    if (card.classList.contains('completed-card')) {
      return false;
    }

    // Check against the actual tasks in allTasks array that match this card
    const cardAssignee = card.querySelector('h3')?.textContent?.replace(/^👤\s*/, '').trim();
    if (!cardAssignee) return false;

    // Find tasks in this card that are delegated
    const cardTasks = this.allTasks.filter(t =>
      t.assignee === cardAssignee && !t.completed
    );

    // Get user's names for delegation matching
    const myNamesStr = this.plugin?.settings?.dashboardMyName?.toLowerCase();
    const myNames = myNamesStr
      ? myNamesStr.split(',').map(name => name.trim()).filter(name => name.length > 0)
      : [];

    for (const task of cardTasks) {
      if (task.delegatedFrom) {
        // If no name configured, show all delegated tasks
        if (myNames.length === 0) {
          return true;
        }

        // Otherwise, check if delegated by me
        const delegatedFromLower = task.delegatedFrom.toLowerCase();
        const isDelegatedByMe = myNames.some(name =>
          delegatedFromLower === name ||
          delegatedFromLower.includes(name) ||
          name.includes(delegatedFromLower)
        );
        if (isDelegatedByMe) {
          return true;
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
    // Always filter to my tasks if name is configured
    if (this.plugin?.settings?.dashboardMyName) {
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
      completed: 0,
      delegated: 0
    };

    // Get user's names for delegation matching
    const myNamesStr = this.plugin?.settings?.dashboardMyName?.toLowerCase();
    const myNames = myNamesStr
      ? myNamesStr.split(',').map(name => name.trim()).filter(name => name.length > 0)
      : [];

    console.log('[TaskDashboard] Calculating filter counts. My names:', myNames);

    // For delegated count, always use ALL tasks, not filtered
    const allTasksForDelegation = this.allTasks;

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

    // Delegated count - ALWAYS use all tasks, ignore "My Tasks" filter
    for (const task of allTasksForDelegation) {
      if (!task.completed && task.delegatedFrom) {
        console.log('[TaskDashboard] Found delegated task:', task.text, 'delegatedFrom:', task.delegatedFrom);
        if (myNames.length > 0) {
          const delegatedFromLower = task.delegatedFrom.toLowerCase();
          const isDelegatedByMe = myNames.some(name => {
            // Check both directions: delegatedFrom matches name, or name matches delegatedFrom
            const matches = delegatedFromLower === name ||
                           delegatedFromLower.includes(name) ||
                           name.includes(delegatedFromLower);
            console.log('[TaskDashboard] Checking if "' + delegatedFromLower + '" matches "' + name + '": ' + matches);
            return matches;
          });
          console.log('[TaskDashboard] isDelegatedByMe:', isDelegatedByMe);
          if (isDelegatedByMe) {
            counts.delegated++;
          }
        } else {
          // If no name configured, count all delegated tasks
          counts.delegated++;
        }
      }
    }

    console.log('[TaskDashboard] Delegated count:', counts.delegated);
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
    updateBadge('delegated', newCounts.delegated);
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
      'delegated': 'delegated',
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
      // Delegated filter always uses all tasks
      const displayTasks = this.currentFilter === 'delegated' ? this.allTasks : this.getFilteredTasks();
      await this.displayTasks(container, displayTasks);

      // Re-apply the current filter after displaying
      if (this.currentFilter !== 'all') {
        this.applyFilter(this.currentFilter);
      }
    } catch (error) {
      console.error('Failed to update task display:', error);
      new Notice('Failed to update display. Please refresh.');
    }
  }
  
  private async loadAllParticipants(): Promise<string[]> {
    // Return cached participants if available
    if (this.cachedParticipants) {
      return this.cachedParticipants;
    }

    try {
      const participants = new Set<string>();
      const files = this.app.vault.getMarkdownFiles();

      for (const file of files) {
        try {
          const content = await this.app.vault.read(file);

          // Only process files with emailId in frontmatter
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) continue;

          const frontmatter = frontmatterMatch[1];
          if (!frontmatter.includes('emailId:')) continue;

          // Extract participants from the "## Participants" section
          const participantsMatch = content.match(/## Participants\s*\n((?:- .+\n?)+)/);
          if (participantsMatch) {
            const lines = participantsMatch[1].split('\n');
            lines.forEach(line => {
              const nameMatch = line.match(/^- (.+)$/);
              if (nameMatch) {
                const name = nameMatch[1].trim();
                // Only add if it looks like a person's name (contains letters, not URLs, not too long)
                if (name.length > 0 &&
                    name.length < 50 &&
                    !name.includes('http') &&
                    !name.includes('www.') &&
                    /^[a-zA-Z\s\-\.]+$/.test(name)) {
                  participants.add(name);
                }
              }
            });
          }

          // Also extract assignees from existing tasks in email notes
          const assigneeMatches = content.matchAll(/\[\[@?([^\]]+)\]\]/g);
          for (const match of assigneeMatches) {
            const assignee = match[1].trim();
            if (assignee !== 'Unassigned' &&
                assignee.length < 50 &&
                /^[a-zA-Z\s\-\.]+$/.test(assignee)) {
              participants.add(assignee);
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      // Sort alphabetically and cache
      this.cachedParticipants = Array.from(participants).sort();
      console.log('[TaskDashboard] Loaded participants:', this.cachedParticipants);
      return this.cachedParticipants;
    } catch (error) {
      console.error('[TaskDashboard] Failed to load participants:', error);
      return [];
    }
  }

  private applyDashboardStyles() {
    // The CSS will be added separately
  }

  private async clusterCurrentTasks() {
    // Use all incomplete tasks for clustering
    const displayTasks = this.allTasks.filter(t => !t.completed);

    if (displayTasks.length < 2) {
      new Notice('Need at least 2 tasks to cluster');
      return;
    }

    // Initialize clusterer if needed
    if (!this.taskClusterer && this.plugin?.settings?.anthropicApiKey) {
      this.taskClusterer = new TaskClusterer(
        this.plugin.settings.anthropicApiKey,
        this.plugin.settings.claudeModel || 'claude-3-5-haiku-20241022'
      );
    }

    if (!this.taskClusterer) {
      new Notice('Claude API key required for clustering. Configure in settings.');
      return;
    }

    try {
      new Notice('🧩 Analyzing tasks for clustering...');
      this.clusteringResult = await this.taskClusterer.clusterTasks(displayTasks);

      // Save cluster IDs to task files
      await this.saveClusterIds(this.clusteringResult);

      new Notice(`✅ ${this.clusteringResult.summary}`);
    } catch (error) {
      console.error('Clustering failed:', error);
      new Notice(`❌ Clustering failed: ${error.message}`);
      this.clusteringResult = null;
    }
  }

  private async saveClusterIds(result: ClusteringResult) {
    try {
      // Save cluster IDs to each task in the result
      for (const cluster of result.clusters) {
        for (const task of cluster.tasks) {
          await this.addClusterIdToTask(task, cluster.id);
        }
      }

      // Clear cluster IDs from standalone tasks
      for (const task of result.standalone) {
        if (task.clusterId) {
          await this.removeClusterIdFromTask(task);
        }
      }

      console.log('[Clustering] Saved cluster IDs to tasks');
    } catch (error) {
      console.error('[Clustering] Failed to save cluster IDs:', error);
    }
  }

  private async addClusterIdToTask(task: Task, clusterId: string) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');
      let line = lines[task.line];

      // Check if already has cluster ID
      if (line.includes('🧩 cluster:')) {
        // Replace existing cluster ID
        line = line.replace(/🧩\s*cluster:[a-z0-9-]+/g, `🧩 cluster:${clusterId}`);
      } else {
        // Add cluster ID at the end of the line
        line = line.trimEnd() + ` 🧩 cluster:${clusterId}`;
      }

      lines[task.line] = line;
      await this.app.vault.modify(task.file, lines.join('\n'));

      // Update task object
      task.clusterId = clusterId;
    } catch (error) {
      console.error(`[Clustering] Failed to add cluster ID to task:`, error);
    }
  }

  private async removeClusterIdFromTask(task: Task) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');
      let line = lines[task.line];

      // Remove cluster ID
      line = line.replace(/\s*🧩\s*cluster:[a-z0-9-]+/g, '');

      lines[task.line] = line;
      await this.app.vault.modify(task.file, lines.join('\n'));

      // Update task object
      task.clusterId = undefined;
    } catch (error) {
      console.error(`[Clustering] Failed to remove cluster ID from task:`, error);
    }
  }

  private async displayClusteredTasks(container: HTMLElement) {
    // Build clusters from saved cluster IDs in tasks
    if (!this.clusteringResult) {
      this.clusteringResult = this.buildClusteringFromSavedIds();
    }

    if (!this.clusteringResult) {
      new Notice('No clusters found. Process some emails first to create clusters.');
      return;
    }

    // Remove existing task sections
    const taskSections = container.querySelectorAll('.task-section');
    taskSections.forEach(section => section.remove());

    // Display clusters
    if (this.clusteringResult.clusters.length > 0) {
      const clustersSection = container.createDiv('task-section clusters-section');
      clustersSection.createEl('h2', {
        text: `🧩 Task Clusters (${this.clusteringResult.clusters.length})`,
        cls: 'clusters-header'
      });

      for (const cluster of this.clusteringResult.clusters) {
        await this.createClusterCard(clustersSection, cluster);
      }
    }

    // Display standalone tasks
    if (this.clusteringResult.standalone.length > 0) {
      const standaloneSection = container.createDiv('task-section standalone-section');
      standaloneSection.createEl('h2', {
        text: `📋 Standalone Tasks (${this.clusteringResult.standalone.length})`
      });

      await this.displayTasks(standaloneSection, this.clusteringResult.standalone);
    }
  }

  private buildClusteringFromSavedIds(): ClusteringResult | null {
    try {
      // Group tasks by cluster ID
      const clusterMap = new Map<string, Task[]>();
      const standalone: Task[] = [];

      for (const task of this.allTasks) {
        if (task.completed) continue; // Skip completed tasks

        if (task.clusterId) {
          if (!clusterMap.has(task.clusterId)) {
            clusterMap.set(task.clusterId, []);
          }
          clusterMap.get(task.clusterId)!.push(task);
        } else {
          standalone.push(task);
        }
      }

      // Build clusters from the map
      const clusters: TaskCluster[] = [];
      for (const [clusterId, tasks] of clusterMap.entries()) {
        if (tasks.length < 2) {
          // Move single tasks to standalone
          standalone.push(...tasks);
          continue;
        }

        // Determine cluster priority (highest among tasks)
        let priority: 'high' | 'medium' | 'low' = 'low';
        for (const task of tasks) {
          if (task.priority === 'high') {
            priority = 'high';
            break;
          }
          if (task.priority === 'medium' && priority === 'low') {
            priority = 'medium';
          }
        }

        // Create title from common words or first task
        const title = this.generateClusterTitle(tasks);

        clusters.push({
          id: clusterId,
          title,
          description: `${tasks.length} related tasks`,
          tasks,
          priority,
          confidence: 75 // Default confidence for loaded clusters
        });
      }

      if (clusters.length === 0) {
        return null;
      }

      return {
        clusters,
        standalone,
        totalTasksAnalyzed: this.allTasks.filter(t => !t.completed).length,
        clustersCreated: clusters.length,
        summary: `Loaded ${clusters.length} saved clusters`
      };
    } catch (error) {
      console.error('[Clustering] Failed to build clusters from saved IDs:', error);
      return null;
    }
  }

  private generateClusterTitle(tasks: Task[]): string {
    // Simple title generation from first task or common words
    if (tasks.length === 0) return 'Related Tasks';

    const firstTask = tasks[0].text;
    const words = firstTask.split(' ').filter(w => w.length > 3);

    if (words.length > 0) {
      return words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
    }

    return 'Related Tasks';
  }

  private applyFilterToClusters(filter: string) {
    const clusterCards = this.containerEl.querySelectorAll('.cluster-card');
    const standalone = this.containerEl.querySelector('.standalone-section');

    clusterCards.forEach((card: Element) => {
      if (!(card instanceof HTMLElement)) return;

      const taskItems = card.querySelectorAll('.cluster-task-item');
      let hasVisibleTasks = false;

      taskItems.forEach((item: Element) => {
        if (!(item instanceof HTMLElement)) return;

        // Apply filter logic to each task
        const show = this.shouldShowTaskInFilter(item, filter);
        item.style.display = show ? 'list-item' : 'none';
        if (show) hasVisibleTasks = true;
      });

      // Hide cluster card if no visible tasks
      card.style.display = hasVisibleTasks ? 'block' : 'none';
    });

    // Apply filter to standalone section
    if (standalone instanceof HTMLElement) {
      this.applyFilter(filter);
    }
  }

  private shouldShowTaskInFilter(taskElement: HTMLElement, filter: string): boolean {
    switch(filter) {
      case 'all':
        return true;
      case 'high':
        return taskElement.closest('.cluster-card')?.classList.contains('high-card') || false;
      case 'medium':
        return taskElement.closest('.cluster-card')?.classList.contains('medium-card') || false;
      case 'low':
        return taskElement.closest('.cluster-card')?.classList.contains('low-card') || false;
      case 'overdue':
      case 'today':
      case 'week':
        const dueDateElem = taskElement.querySelector('.task-due');
        if (!dueDateElem) return false;
        const dateMatch = dueDateElem.textContent?.match(/\d{4}-\d{2}-\d{2}/);
        if (!dateMatch) return false;

        const dueDate = new Date(dateMatch[0]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filter === 'overdue') {
          return dueDate < today;
        } else if (filter === 'today') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return dueDate >= today && dueDate < tomorrow;
        } else if (filter === 'week') {
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return dueDate >= today && dueDate <= weekFromNow;
        }
        return false;
      default:
        return true;
    }
  }

  private async createClusterCard(container: HTMLElement, cluster: TaskCluster) {
    const card = container.createDiv(`cluster-card ${cluster.priority}-card`);

    // Cluster header
    const header = card.createDiv('cluster-header');

    const titleRow = header.createDiv('cluster-title-row');
    titleRow.createEl('h3', {
      text: `${cluster.title} (${cluster.tasks.length} tasks)`,
      cls: 'cluster-title'
    });

    // Confidence badge
    const confidenceBadge = titleRow.createEl('span', {
      text: `${cluster.confidence}%`,
      cls: 'cluster-confidence'
    });
    if (cluster.confidence >= 80) {
      confidenceBadge.addClass('high-confidence');
    } else if (cluster.confidence >= 60) {
      confidenceBadge.addClass('medium-confidence');
    } else {
      confidenceBadge.addClass('low-confidence');
    }

    // Description
    header.createEl('p', {
      text: cluster.description,
      cls: 'cluster-description'
    });

    // Combined task suggestion if available
    if (cluster.combinedTask) {
      const suggestion = header.createDiv('cluster-suggestion');
      suggestion.createEl('strong', { text: '💡 Suggested Combined Task:' });
      suggestion.createEl('p', {
        text: cluster.combinedTask,
        cls: 'combined-task-text'
      });

      if (cluster.suggestedAssignee) {
        suggestion.createEl('span', {
          text: `→ ${cluster.suggestedAssignee}`,
          cls: 'suggested-assignee'
        });
      }
    }

    // Task list
    const taskList = card.createEl('ul', { cls: 'cluster-task-list' });

    for (const task of cluster.tasks) {
      const li = taskList.createEl('li', { cls: 'cluster-task-item' });

      // Task text
      const textSpan = li.createEl('span', {
        text: task.text,
        cls: 'task-text clickable'
      });

      textSpan.onclick = async () => {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(task.file);
      };

      // Metadata
      const meta = li.createDiv('task-meta');
      meta.createEl('span', {
        text: `👤 ${task.assignee}`,
        cls: 'task-assignee'
      });

      if (task.dueDate) {
        meta.createEl('span', {
          text: `📅 ${task.dueDate}`,
          cls: 'task-due'
        });
      }

      meta.createEl('span', {
        text: `📄 ${task.file.basename}`,
        cls: 'task-source'
      });
    }
  }
}