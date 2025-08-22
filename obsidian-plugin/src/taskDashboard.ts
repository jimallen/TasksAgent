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

export class TaskDashboardView extends ItemView {
  private component: Component;
  private plugin: any; // Reference to the plugin

  constructor(leaf: WorkspaceLeaf, plugin?: any) {
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
    await this.refresh();
  }

  async onClose() {
    this.component.unload();
  }

  async refresh() {
    const container = this.containerEl.children[1];
    container.empty();
    
    // Add dashboard class for styling
    container.addClass('dashboard');
    container.addClass('markdown-preview-view');
    
    // Create header
    const header = container.createDiv('dashboard-header');
    header.createEl('h1', { text: 'TASK DASHBOARD', cls: 'title' });
    
    // Add refresh button
    const controls = header.createDiv('dashboard-controls');
    const refreshBtn = controls.createEl('button', {
      text: '🔄 Refresh',
      cls: 'mod-cta'
    });
    refreshBtn.onclick = () => this.refresh();
    
    // Add filter buttons
    const filters = container.createDiv('dashboard-filters');
    this.createFilterButtons(filters);
    
    // Create stats section
    const stats = container.createDiv('dashboard-stats');
    
    // Load tasks
    const tasks = await this.loadTasks();
    
    // Display stats
    this.displayStats(stats, tasks);
    
    // Create task sections
    await this.displayTasks(container, tasks);
    
    // Apply custom CSS
    this.applyDashboardStyles();
  }

  private createFilterButtons(container: HTMLElement) {
    const filterGroup = container.createDiv('filter-group');
    
    const filters = [
      { label: 'All Tasks', filter: 'all', active: true },
      { label: '🔴 High Priority', filter: 'high' },
      { label: '🟡 Medium Priority', filter: 'medium' },
      { label: '🟢 Low Priority', filter: 'low' },
      { label: '📅 Due Today', filter: 'today' },
      { label: '📅 Due This Week', filter: 'week' },
      { label: '👤 My Tasks', filter: 'mine' },
      { label: '✅ Completed', filter: 'completed' }
    ];
    
    filters.forEach(f => {
      const btn = filterGroup.createEl('button', {
        text: f.label,
        cls: f.active ? 'filter-btn active' : 'filter-btn'
      });
      
      btn.onclick = () => {
        // Remove active from all buttons
        filterGroup.querySelectorAll('.filter-btn').forEach(b => 
          b.removeClass('active')
        );
        btn.addClass('active');
        this.applyFilter(f.filter);
      };
    });
  }

  private async loadTasks(): Promise<Task[]> {
    const tasks: Task[] = [];
    const meetingsFolder = this.app.vault.getAbstractFileByPath('Meetings');
    
    if (!meetingsFolder) {
      new Notice('Meetings folder not found');
      return tasks;
    }
    
    // Get all markdown files in Meetings folder recursively
    const files = this.app.vault.getMarkdownFiles().filter(f => 
      f.path.startsWith('Meetings/')
    );
    
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match task lines with checkbox
        const taskMatch = line.match(/^[\s-]*\[([ x])\]\s+(.+)/);
        if (taskMatch) {
          const completed = taskMatch[1] === 'x';
          const taskText = taskMatch[2];
          
          // Extract priority
          let priority: 'high' | 'medium' | 'low' = 'medium';
          if (line.includes('🔴') || taskText.includes('High Priority')) {
            priority = 'high';
          } else if (line.includes('🟢') || taskText.includes('Low Priority')) {
            priority = 'low';
          } else if (line.includes('🟡')) {
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
    }
    
    // Filter based on settings
    if (this.plugin?.settings?.dashboardShowOnlyMyTasks && this.plugin?.settings?.dashboardMyName) {
      const myName = this.plugin.settings.dashboardMyName.toLowerCase();
      return tasks.filter(t => 
        t.assignee.toLowerCase().includes(myName) || 
        t.assignee.toLowerCase() === 'unassigned'
      );
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
    
    this.createStatCard(statsGrid, 'Total Tasks', total.toString(), 'total');
    this.createStatCard(statsGrid, 'Completed', `${completed}/${total}`, 'completed');
    this.createStatCard(statsGrid, 'High Priority', high.toString(), 'high');
    this.createStatCard(statsGrid, 'Overdue', overdue.toString(), 'overdue');
  }

  private createStatCard(container: HTMLElement, label: string, value: string, type: string) {
    const card = container.createDiv(`stat-card stat-${type}`);
    card.createDiv('stat-value').setText(value);
    card.createDiv('stat-label').setText(label);
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
      
      // Card header with assignee
      const header = card.createDiv('card-header');
      header.createEl('h3', { text: `👤 ${assignee}` });
      
      // Task list
      const taskList = card.createEl('ul', { cls: 'task-list' });
      
      for (const task of grouped[assignee]) {
        const li = taskList.createEl('li', { cls: 'task-list-item' });
        
        // Create checkbox
        const checkbox = li.createEl('input', { type: 'checkbox' });
        checkbox.checked = task.completed;
        checkbox.onclick = async () => {
          await this.toggleTask(task, checkbox.checked);
        };
        
        // Task content
        const content = li.createDiv('task-content');
        
        // Task text
        const textSpan = content.createEl('span', { 
          text: task.text,
          cls: task.completed ? 'task-text completed' : 'task-text'
        });
        
        // Task metadata
        const meta = content.createDiv('task-meta');
        
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
      }
    }
  }

  private async toggleTask(task: Task, completed: boolean) {
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
            const assignee = card.querySelector('h3')?.textContent || '';
            const myName = this.plugin?.settings?.dashboardMyName?.toLowerCase();
            show = myName ? assignee.toLowerCase().includes(myName) : false;
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

  private applyDashboardStyles() {
    // The CSS will be added separately
  }
}