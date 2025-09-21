var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeetingTasksPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/claudeExtractor.ts
var import_obsidian = require("obsidian");
var ClaudeTaskExtractor = class {
  constructor(apiKey, model = "claude-3-5-haiku-20241022") {
    this.apiUrl = "https://api.anthropic.com/v1/messages";
    this.apiKey = apiKey;
    this.model = model;
  }
  /**
   * Extract tasks using Claude API - using the same approach as the daemon
   */
  async extractTasks(emailContent, subject) {
    if (!this.apiKey) {
      console.warn("No Claude API key found, using fallback extraction");
      return this.fallbackExtraction(emailContent, subject);
    }
    try {
      const prompt = this.buildPrompt(emailContent, subject);
      const response = await this.callClaude(prompt);
      return this.parseResponse(response, emailContent);
    } catch (error) {
      console.error("Claude task extraction failed, using fallback", error);
      return this.fallbackExtraction(emailContent, subject);
    }
  }
  /**
   * Build the extraction prompt - same as daemon
   */
  buildPrompt(emailContent, subject) {
    const content = typeof emailContent === "string" ? emailContent : JSON.stringify(emailContent);
    return `You are an expert at extracting actionable tasks from meeting transcripts. Analyze the following meeting transcript and extract all tasks, action items, and commitments.

MEETING SUBJECT: ${subject}

TRANSCRIPT:
${content.substring(0, 15e3)} ${content.length > 15e3 ? "... [truncated]" : ""}

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
  async callClaude(prompt) {
    var _a, _b, _c, _d, _e;
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: this.apiUrl,
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 4e3,
          temperature: 0.2,
          system: "You are a task extraction assistant. Always respond with valid JSON only, no markdown or explanations."
        })
      });
      if ((_c = (_b = (_a = response.json) == null ? void 0 : _a.content) == null ? void 0 : _b[0]) == null ? void 0 : _c.text) {
        return response.json.content[0].text;
      }
      throw new Error("Invalid Claude API response structure");
    } catch (error) {
      if (((_d = error.response) == null ? void 0 : _d.status) === 401) {
        console.error("Invalid Claude API key");
      } else if (((_e = error.response) == null ? void 0 : _e.status) === 429) {
        console.error("Claude API rate limit exceeded");
      }
      throw error;
    }
  }
  /**
   * Parse Claude's response
   */
  parseResponse(response, emailContent) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      const tasks = this.normalizeTasks(parsed.tasks || []);
      const participants = parsed.participants || [];
      return {
        tasks: this.deduplicateTasks(tasks),
        summary: parsed.summary || "Meeting transcript processed",
        participants,
        meetingDate: this.parseDate(parsed.meetingDate) || /* @__PURE__ */ new Date(),
        keyDecisions: parsed.keyDecisions || [],
        nextSteps: parsed.nextSteps || [],
        confidence: this.calculateOverallConfidence(tasks)
      };
    } catch (error) {
      console.error("Failed to parse Claude response", error);
      console.debug("Raw response:", response);
      return this.fallbackExtraction(emailContent, "");
    }
  }
  /**
   * Normalize task objects
   */
  normalizeTasks(tasks) {
    return tasks.map((task) => ({
      description: this.cleanDescription(task.description || ""),
      assignee: task.assignee || "Unassigned",
      priority: this.normalizePriority(task.priority),
      confidence: this.normalizeConfidence(task.confidence),
      dueDate: task.dueDate,
      category: task.category || "other",
      context: task.context,
      rawText: task.rawText
    })).filter((task) => task.description && task.description.length > 5);
  }
  /**
   * Clean task description
   */
  cleanDescription(description) {
    return description.replace(/^[-*•]\s*/, "").replace(/\s+/g, " ").trim();
  }
  /**
   * Normalize priority
   */
  normalizePriority(priority) {
    const p = String(priority).toLowerCase();
    if (p.includes("high") || p === "3") return "high";
    if (p.includes("low") || p === "1") return "low";
    return "medium";
  }
  /**
   * Normalize confidence score
   */
  normalizeConfidence(confidence) {
    const c = Number(confidence);
    if (isNaN(c)) return 75;
    return Math.min(100, Math.max(0, c));
  }
  /**
   * Parse date string
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }
  /**
   * Remove duplicate tasks
   */
  deduplicateTasks(tasks) {
    const seen = /* @__PURE__ */ new Set();
    return tasks.filter((task) => {
      const key = `${task.description.toLowerCase()}-${task.assignee.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  /**
   * Calculate overall confidence
   */
  calculateOverallConfidence(tasks) {
    if (tasks.length === 0) return 0;
    const sum = tasks.reduce((acc, task) => acc + task.confidence, 0);
    return Math.round(sum / tasks.length);
  }
  /**
   * Fallback extraction when Claude is unavailable
   */
  fallbackExtraction(emailContent, subject) {
    const tasks = [];
    const lines = emailContent.split("\n");
    const taskPatterns = [
      /(?:I will|I'll|I can|Let me|I need to|I should|I have to)\s+(.+)/i,
      /(?:TODO|Action|Task|Follow.?up):\s*(.+)/i,
      /(?:Next steps?|Action items?):\s*(.+)/i,
      /\[ \]\s+(.+)/,
      /^[-*•]\s*(.+(?:will|need to|should|must).+)/i
    ];
    for (const line of lines) {
      for (const pattern of taskPatterns) {
        const match2 = line.match(pattern);
        if (match2) {
          tasks.push({
            description: this.cleanDescription(match2[1]),
            assignee: "Unassigned",
            priority: "medium",
            confidence: 50,
            category: "other",
            rawText: line
          });
        }
      }
    }
    const participants = [];
    const namePattern = /(?:with|from|to|cc|attendees?:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
    let match;
    while ((match = namePattern.exec(emailContent)) !== null) {
      if (!participants.includes(match[1])) {
        participants.push(match[1]);
      }
    }
    return {
      tasks: this.deduplicateTasks(tasks),
      summary: subject || "Meeting notes",
      participants,
      meetingDate: /* @__PURE__ */ new Date(),
      keyDecisions: [],
      nextSteps: [],
      confidence: 30
    };
  }
};

// src/taskDashboard.ts
var import_obsidian2 = require("obsidian");
var TASK_DASHBOARD_VIEW_TYPE = "task-dashboard-view";
var TaskDashboardView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.showOnlyMyTasks = true;
    this.allTasks = [];
    this.isLoading = false;
    this.filterCounts = null;
    this.badgeElements = /* @__PURE__ */ new Map();
    this.updateCountsDebounceTimer = null;
    this.component = new import_obsidian2.Component();
    this.plugin = plugin;
    this.showOnlyMyTasks = true;
  }
  getViewType() {
    return TASK_DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "Task Dashboard";
  }
  getIcon() {
    return "check-square";
  }
  async onOpen() {
    await this.refresh();
  }
  async onClose() {
    if (this.updateCountsDebounceTimer) {
      clearTimeout(this.updateCountsDebounceTimer);
      this.updateCountsDebounceTimer = null;
    }
    this.component.unload();
  }
  async refresh() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("dashboard");
    container.addClass("markdown-preview-view");
    this.showLoadingState(container);
    try {
      await this.loadAndDisplayDashboard(container);
    } catch (error) {
      console.error("Failed to refresh dashboard:", error);
      this.showErrorState(container, error);
    }
  }
  showLoadingState(container) {
    const loadingDiv = container.createDiv("dashboard-loading");
    loadingDiv.createEl("div", { cls: "loading-spinner" });
    loadingDiv.createEl("p", { text: "Loading tasks...", cls: "loading-text" });
  }
  showErrorState(container, error) {
    container.empty();
    const errorDiv = container.createDiv("dashboard-error");
    errorDiv.createEl("h2", { text: "\u26A0\uFE0F Error Loading Dashboard" });
    errorDiv.createEl("p", { text: "Failed to load tasks. Please try refreshing." });
    errorDiv.createEl("pre", { text: (error == null ? void 0 : error.message) || "Unknown error", cls: "error-details" });
    const retryBtn = errorDiv.createEl("button", {
      text: "\u{1F504} Retry",
      cls: "dashboard-control-btn"
    });
    retryBtn.onclick = () => this.refresh();
  }
  async loadAndDisplayDashboard(container) {
    var _a, _b;
    container.empty();
    const header = container.createDiv("dashboard-header");
    header.createEl("h1", { text: "TASK DASHBOARD", cls: "title" });
    const controls = header.createDiv("dashboard-controls");
    if ((_b = (_a = this.plugin) == null ? void 0 : _a.settings) == null ? void 0 : _b.dashboardMyName) {
      const toggleBtn = controls.createEl("button", {
        text: this.showOnlyMyTasks ? "\u{1F465} Show All Tasks" : "\u{1F464} Show My Tasks",
        cls: "dashboard-control-btn dashboard-toggle-btn"
      });
      toggleBtn.onclick = () => {
        this.showOnlyMyTasks = !this.showOnlyMyTasks;
        toggleBtn.textContent = this.showOnlyMyTasks ? "\u{1F465} Show All Tasks" : "\u{1F464} Show My Tasks";
        this.updateFilterCounts(true);
        this.updateTaskDisplay();
      };
    }
    const refreshBtn = controls.createEl("button", {
      text: "\u{1F504} Refresh",
      cls: "dashboard-control-btn dashboard-refresh-btn"
    });
    refreshBtn.onclick = () => this.refresh();
    const filters = container.createDiv("dashboard-filters");
    this.createFilterButtons(filters);
    try {
      this.isLoading = true;
      this.allTasks = await this.loadTasks();
    } catch (error) {
      console.error("Failed to load tasks:", error);
      new import_obsidian2.Notice("Failed to load tasks. Check console for details.");
      this.allTasks = [];
    } finally {
      this.isLoading = false;
    }
    this.updateFilterCounts(true);
    const displayTasks = this.getFilteredTasks();
    await this.displayTasks(container, displayTasks);
    this.applyDashboardStyles();
  }
  createBadgeElement(count, filterType) {
    if (count === 0) {
      return null;
    }
    const badge = document.createElement("span");
    badge.className = "filter-badge";
    badge.setAttribute("data-filter-type", filterType);
    badge.textContent = count.toString();
    return badge;
  }
  createFilterButtons(container) {
    const filterGroup = container.createDiv("filter-group");
    this.badgeElements.clear();
    const counts = this.getCurrentFilterCounts();
    this.filterCounts = counts;
    const filters = [
      { label: "High Priority", filter: "high", active: true, dataAttr: "high", count: counts.high },
      { label: "Medium Priority", filter: "medium", dataAttr: "medium", count: counts.medium },
      { label: "Low Priority", filter: "low", dataAttr: "low", count: counts.low },
      { label: "Past Due", filter: "overdue", dataAttr: "overdue", count: counts.overdue },
      { label: "Due Today", filter: "today", dataAttr: "due-today", count: counts.today },
      { label: "Due This Week", filter: "week", dataAttr: "due-week", count: counts.week },
      { label: "Completed", filter: "completed", dataAttr: "completed", count: counts.completed }
    ];
    filters.forEach((f) => {
      const btn = filterGroup.createEl("button", {
        cls: f.active ? "filter-btn active" : "filter-btn"
      });
      btn.setAttribute("data-filter", f.dataAttr);
      const labelSpan = btn.createEl("span", {
        text: f.label,
        cls: "filter-btn-label"
      });
      const badge = this.createBadgeElement(f.count, f.dataAttr);
      if (badge) {
        btn.appendChild(badge);
        this.badgeElements.set(f.filter, badge);
      }
      btn.onclick = () => {
        if (btn.hasClass("active")) {
          btn.removeClass("active");
          this.applyFilter("all");
        } else {
          filterGroup.querySelectorAll(".filter-btn").forEach((b) => {
            if (b instanceof HTMLElement) {
              b.removeClass("active");
            }
          });
          btn.addClass("active");
          this.applyFilter(f.filter);
        }
      };
    });
  }
  async loadTasks() {
    const tasks = [];
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const fileTasks = await this.extractTasksFromFile(file);
      tasks.push(...fileTasks);
    }
    return tasks;
  }
  async extractTasksFromFile(file) {
    const tasks = [];
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const taskMatch = line.match(/^[\s-]*\[([ x])\]\s+(.+)/);
        if (taskMatch) {
          const completed = taskMatch[1] === "x";
          const taskText = taskMatch[2];
          let priority = "medium";
          if (line.includes("\u23EB") || line.includes("\u{1F53C}") || line.includes("\u{1F534}") || taskText.includes("High Priority")) {
            priority = "high";
          } else if (line.includes("\u23EC") || line.includes("\u{1F53D}") || line.includes("\u{1F7E2}") || taskText.includes("Low Priority")) {
            priority = "low";
          } else if (line.includes("\u{1F7E1}")) {
            priority = "medium";
          }
          const assigneeMatch = taskText.match(/\[\[@?([^\]]+)\]\]/);
          const assignee = assigneeMatch ? assigneeMatch[1] : "Unassigned";
          const dateMatch = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
          const dueDate = dateMatch ? dateMatch[1] : "";
          const confidenceMatch = taskText.match(/⚠️\s*(\d+)%/);
          const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 100;
          const categoryMatch = taskText.match(/#(\w+)/);
          const category = categoryMatch ? categoryMatch[1] : "general";
          const cleanText = taskText.replace(/\[\[@?[^\]]+\]\]/g, "").replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "").replace(/[🔴🟡🟢]/g, "").replace(/⚠️\s*\d+%/g, "").replace(/#\w+/g, "").trim();
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
    }
    return tasks;
  }
  async displayTasks(container, tasks) {
    const highPriority = tasks.filter((t) => t.priority === "high" && !t.completed);
    const mediumPriority = tasks.filter((t) => t.priority === "medium" && !t.completed);
    const lowPriority = tasks.filter((t) => t.priority === "low" && !t.completed);
    const completedTasks = tasks.filter((t) => t.completed);
    if (highPriority.length > 0) {
      await this.createTaskSection(container, "\u{1F534} High Priority", highPriority, "high");
    }
    if (mediumPriority.length > 0) {
      await this.createTaskSection(container, "\u{1F7E1} Medium Priority", mediumPriority, "medium");
    }
    if (lowPriority.length > 0) {
      await this.createTaskSection(container, "\u{1F7E2} Low Priority", lowPriority, "low");
    }
    if (completedTasks.length > 0) {
      const section = container.createDiv("task-section completed-section");
      const header = section.createEl("h2", {
        text: `\u2705 Completed (${completedTasks.length})`,
        cls: "collapsible"
      });
      const content = section.createDiv("task-grid collapsed");
      header.onclick = () => {
        const isCollapsed = content.hasClass("collapsed");
        if (isCollapsed) {
          content.removeClass("collapsed");
          header.removeClass("collapsed");
        } else {
          content.addClass("collapsed");
          header.addClass("collapsed");
        }
      };
      await this.createTaskCards(content, completedTasks, "completed");
    }
  }
  async createTaskSection(container, title, tasks, priority) {
    const section = container.createDiv(`task-section ${priority}-section`);
    section.createEl("h2", { text: `${title} (${tasks.length})` });
    const grid = section.createDiv("task-grid");
    await this.createTaskCards(grid, tasks, priority);
  }
  async createTaskCards(container, tasks, priority) {
    const grouped = {};
    tasks.forEach((task) => {
      const key = task.assignee || "Unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    const assignees = Object.keys(grouped).sort((a, b) => {
      var _a, _b, _c;
      const myNamesStr = (_c = (_b = (_a = this.plugin) == null ? void 0 : _a.settings) == null ? void 0 : _b.dashboardMyName) == null ? void 0 : _c.toLowerCase();
      if (myNamesStr) {
        const myNames = myNamesStr.split(",").map((name) => name.trim()).filter((name) => name.length > 0);
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aIsMe = myNames.some((name) => aLower.includes(name));
        const bIsMe = myNames.some((name) => bLower.includes(name));
        if (aIsMe && !bIsMe) return -1;
        if (bIsMe && !aIsMe) return 1;
      }
      return a.localeCompare(b);
    });
    for (const assignee of assignees) {
      const card = container.createDiv(`task-card ${priority}-card`);
      const header = card.createDiv("card-header");
      const assigneeTitle = header.createEl("h3", {
        text: `\u{1F464} ${assignee}`,
        cls: "card-assignee-title"
      });
      const taskList = card.createEl("ul", { cls: "task-list" });
      for (const task of grouped[assignee]) {
        const li = taskList.createEl("li", { cls: "task-list-item" });
        const checkbox = li.createEl("input", {
          type: "checkbox",
          cls: "task-checkbox"
        });
        checkbox.checked = task.completed;
        checkbox.onclick = async () => {
          await this.toggleTask(task, checkbox.checked, li);
        };
        const content = li.createDiv("task-content");
        const textSpan = content.createEl("span", {
          text: task.text,
          cls: task.completed ? "task-text completed clickable" : "task-text clickable"
        });
        textSpan.onclick = async (event) => {
          event.stopPropagation();
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(task.file);
          const view = leaf.view;
          if (view && "editor" in view) {
            const editor = view.editor;
            if (editor) {
              editor.setCursor(task.line, 0);
              editor.scrollIntoView({
                from: { line: Math.max(0, task.line - 5), ch: 0 },
                to: { line: Math.min(editor.lineCount() - 1, task.line + 5), ch: 0 }
              });
            }
          }
        };
        textSpan.title = `Click to open: ${task.file.basename}`;
        const meta = content.createDiv("task-meta");
        const sourceSpan = meta.createEl("span", {
          cls: "task-source clickable",
          text: `\u{1F4C4} ${task.file.basename}`
        });
        sourceSpan.onclick = textSpan.onclick;
        sourceSpan.title = `Click to open: ${task.file.basename}`;
        if (task.dueDate) {
          const dueSpan = meta.createEl("span", { cls: "task-due" });
          dueSpan.setText(`\u{1F4C5} ${task.dueDate}`);
          if (!task.completed && new Date(task.dueDate) < /* @__PURE__ */ new Date()) {
            dueSpan.addClass("overdue");
          }
        }
        if (task.category) {
          meta.createEl("span", {
            text: `#${task.category}`,
            cls: "task-category"
          });
        }
        if (task.confidence && task.confidence < 70) {
          meta.createEl("span", {
            text: `\u26A0\uFE0F ${task.confidence}%`,
            cls: "task-confidence"
          });
        }
        const fileLink = meta.createEl("a", {
          text: "\u{1F4C4}",
          cls: "task-source",
          title: task.file.basename
        });
        fileLink.onclick = (e) => {
          e.preventDefault();
          this.app.workspace.getLeaf().openFile(task.file);
        };
        const taskEditBtn = li.createEl("button", {
          cls: "task-edit-btn",
          text: "\u270F\uFE0F",
          title: "Edit task"
        });
        const editControls = li.createEl("div", { cls: "task-edit-controls" });
        editControls.style.display = "none";
        let editMode = false;
        taskEditBtn.onclick = () => {
          editMode = !editMode;
          editControls.style.display = editMode ? "block" : "none";
          taskEditBtn.classList.toggle("active", editMode);
        };
        if (editControls) {
          const taskEditRow = editControls.createDiv("task-edit-row");
          const prioritySelect = taskEditRow.createEl("select", { cls: "task-priority-select" });
          ["high", "medium", "low"].forEach((p) => {
            const option = prioritySelect.createEl("option", { text: p, value: p });
            if (p === task.priority) option.selected = true;
          });
          prioritySelect.onchange = async () => {
            await this.updateTaskPriority(task, prioritySelect.value, li);
          };
          const assigneeInput = taskEditRow.createEl("input", {
            type: "text",
            cls: "task-assignee-input",
            placeholder: "Assign to...",
            value: task.assignee
          });
          const saveBtn = taskEditRow.createEl("button", {
            text: "\u2713",
            cls: "task-save-btn",
            title: "Save assignee"
          });
          saveBtn.onclick = async () => {
            await this.updateTaskAssignee(task, assigneeInput.value, li);
          };
        }
      }
    }
  }
  async toggleTask(task, completed, listItem) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split("\n");
      if (completed) {
        lines[task.line] = task.rawLine.replace("[ ]", "[x]");
      } else {
        lines[task.line] = task.rawLine.replace("[x]", "[ ]");
      }
      await this.app.vault.modify(task.file, lines.join("\n"));
      task.completed = completed;
      if (listItem && completed) {
        listItem.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
        listItem.style.opacity = "0";
        listItem.style.transform = "translateX(-10px)";
        setTimeout(() => {
          listItem.remove();
          const card = listItem.closest(".task-card");
          if (card) {
            const remainingTasks = card.querySelectorAll(".task-list-item");
            if (remainingTasks.length === 0) {
              card.style.transition = "opacity 0.3s ease-out";
              card.style.opacity = "0";
              setTimeout(() => {
                card.remove();
                const section = card.closest(".task-section");
                if (section) {
                  const remainingCards = section.querySelectorAll(".task-card");
                  if (remainingCards.length === 0) {
                    section.style.display = "none";
                  }
                }
              }, 300);
            }
          }
          this.updateStatsOnly();
          this.updateFilterCounts();
        }, 300);
      } else if (!completed) {
        setTimeout(() => this.refresh(), 500);
      }
    } catch (error) {
      console.error("Failed to toggle task:", error);
      new import_obsidian2.Notice("Failed to update task. Please try again.");
    }
  }
  async updateTaskPriority(task, newPriority, taskElement) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split("\n");
      let line = lines[task.line];
      line = line.replace(/🔴\s*/g, "").replace(/🟡\s*/g, "").replace(/🟢\s*/g, "");
      line = line.replace(/High Priority/gi, "").replace(/Medium Priority/gi, "").replace(/Low Priority/gi, "");
      const checkboxMatch = line.match(/^([\s-]*)\[([x ]?)\]\s*/);
      if (checkboxMatch) {
        const prefix = checkboxMatch[0];
        const restOfLine = line.substring(prefix.length);
        let priorityIndicator = "";
        if (newPriority === "high") {
          priorityIndicator = "\u{1F534} ";
        } else if (newPriority === "medium") {
          priorityIndicator = "\u{1F7E1} ";
        } else if (newPriority === "low") {
          priorityIndicator = "\u{1F7E2} ";
        }
        lines[task.line] = prefix + priorityIndicator + restOfLine.trim();
      }
      await this.app.vault.modify(task.file, lines.join("\n"));
      task.priority = newPriority;
      if (taskElement) {
        const currentCard = taskElement.closest(".task-card");
        const currentSection = currentCard == null ? void 0 : currentCard.closest(".task-section");
        if (currentCard && currentSection) {
          const container = this.containerEl.children[1];
          let targetSectionClass = "";
          if (newPriority === "high") targetSectionClass = "high-priority";
          else if (newPriority === "medium") targetSectionClass = "medium-priority";
          else targetSectionClass = "low-priority";
          const targetSection = container.querySelector(`.task-section.${targetSectionClass}`);
          if (targetSection && targetSection !== currentSection) {
            taskElement.style.transition = "opacity 0.3s ease-out";
            taskElement.style.opacity = "0";
            setTimeout(() => {
              taskElement.remove();
              const remainingTasks = currentCard.querySelectorAll(".task-list-item");
              if (remainingTasks.length === 0) {
                currentCard.style.transition = "opacity 0.3s ease-out";
                currentCard.style.opacity = "0";
                setTimeout(() => currentCard.remove(), 300);
              }
              const assignee = task.assignee;
              let targetCard = Array.from(targetSection.querySelectorAll(".task-card")).find((card) => {
                var _a;
                const title = (_a = card.querySelector("h3")) == null ? void 0 : _a.textContent;
                return title == null ? void 0 : title.includes(assignee);
              });
              if (!targetCard) {
                targetCard = targetSection.createDiv(`task-card ${newPriority}-card`);
                const header = targetCard.createDiv("card-header");
                header.createEl("h3", {
                  text: `\u{1F464} ${assignee}`,
                  cls: "card-assignee-title"
                });
                targetCard.createEl("ul", { cls: "task-list" });
              }
              const targetList = targetCard.querySelector(".task-list");
              if (targetList) {
                const newLi = targetList.createEl("li", { cls: "task-list-item" });
                newLi.innerHTML = taskElement.innerHTML;
                const checkbox = newLi.querySelector(".task-checkbox");
                if (checkbox) {
                  checkbox.onclick = async () => {
                    await this.toggleTask(task, checkbox.checked, newLi);
                  };
                }
                newLi.style.opacity = "0";
                setTimeout(() => {
                  newLi.style.transition = "opacity 0.3s ease-in";
                  newLi.style.opacity = "1";
                }, 10);
              }
              this.updateStatsOnly();
            }, 300);
          }
        }
      } else {
        setTimeout(() => this.refresh(), 500);
      }
    } catch (error) {
      console.error("Failed to update task priority:", error);
      new import_obsidian2.Notice("Failed to update priority. Please try again.");
    }
  }
  async updateTaskAssignee(task, newAssignee, taskElement) {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split("\n");
      let line = lines[task.line];
      line = line.replace(/\[\[@?[^\]]+\]\]/g, "");
      const dateMatch = line.match(/📅\s*\d{4}-\d{2}-\d{2}/);
      if (dateMatch && dateMatch.index !== void 0) {
        line = line.substring(0, dateMatch.index) + `[[@${newAssignee.trim()}]] ` + line.substring(dateMatch.index);
      } else {
        line = line.trim() + ` [[@${newAssignee.trim()}]]`;
      }
      lines[task.line] = line;
      await this.app.vault.modify(task.file, lines.join("\n"));
      const oldAssignee = task.assignee;
      task.assignee = newAssignee.trim();
      if (taskElement && oldAssignee !== task.assignee) {
        const currentCard = taskElement.closest(".task-card");
        const currentSection = currentCard == null ? void 0 : currentCard.closest(".task-section");
        if (currentCard && currentSection) {
          taskElement.style.transition = "opacity 0.3s ease-out";
          taskElement.style.opacity = "0";
          setTimeout(() => {
            taskElement.remove();
            const remainingTasks = currentCard.querySelectorAll(".task-list-item");
            if (remainingTasks.length === 0) {
              currentCard.style.transition = "opacity 0.3s ease-out";
              currentCard.style.opacity = "0";
              setTimeout(() => currentCard.remove(), 300);
            }
            let targetCard = Array.from(currentSection.querySelectorAll(".task-card")).find((card) => {
              var _a;
              const title = (_a = card.querySelector("h3")) == null ? void 0 : _a.textContent;
              return title == null ? void 0 : title.includes(task.assignee);
            });
            if (!targetCard) {
              const priority = task.priority || "medium";
              targetCard = currentSection.createDiv(`task-card ${priority}-card`);
              const header = targetCard.createDiv("card-header");
              header.createEl("h3", {
                text: `\u{1F464} ${task.assignee}`,
                cls: "card-assignee-title"
              });
              targetCard.createEl("ul", { cls: "task-list" });
            }
            const targetList = targetCard.querySelector(".task-list");
            if (targetList) {
              const newLi = targetList.createEl("li", { cls: "task-list-item" });
              newLi.innerHTML = taskElement.innerHTML;
              const metadataSpan = newLi.querySelector(".task-metadata");
              if (metadataSpan) {
                metadataSpan.innerHTML = metadataSpan.innerHTML.replace(/👤\s*[^<]*/g, `\u{1F464} ${task.assignee}`);
              }
              const checkbox = newLi.querySelector(".task-checkbox");
              if (checkbox) {
                checkbox.onclick = async () => {
                  await this.toggleTask(task, checkbox.checked, newLi);
                };
              }
              const editBtn = newLi.querySelector(".edit-button");
              if (editBtn) {
                const editContainer = newLi.querySelector(".edit-container");
                if (editContainer) {
                  editBtn.onclick = () => {
                    editContainer.style.display = editContainer.style.display === "none" ? "flex" : "none";
                  };
                  const prioritySelect = editContainer.querySelector("select");
                  if (prioritySelect) {
                    prioritySelect.onchange = async () => {
                      await this.updateTaskPriority(task, prioritySelect.value, newLi);
                    };
                  }
                  const saveBtn = editContainer.querySelector("button");
                  const assigneeInput = editContainer.querySelector("input");
                  if (saveBtn && assigneeInput) {
                    saveBtn.onclick = async () => {
                      await this.updateTaskAssignee(task, assigneeInput.value, newLi);
                    };
                  }
                }
              }
              newLi.style.opacity = "0";
              setTimeout(() => {
                newLi.style.transition = "opacity 0.3s ease-in";
                newLi.style.opacity = "1";
              }, 10);
            }
            this.updateStatsOnly();
          }, 300);
        }
      } else if (!taskElement) {
        setTimeout(() => this.refresh(), 500);
      }
    } catch (error) {
      console.error("Failed to update task assignee:", error);
      new import_obsidian2.Notice("Failed to update assignee. Please try again.");
    }
  }
  applyFilter(filter) {
    const sections = this.containerEl.querySelectorAll(".task-section");
    sections.forEach((section) => {
      if (!(section instanceof HTMLElement)) return;
      const cards = section.querySelectorAll(".task-card");
      let sectionHasVisibleCards = false;
      cards.forEach((card) => {
        var _a, _b, _c, _d;
        if (!(card instanceof HTMLElement)) return;
        let show = true;
        switch (filter) {
          case "all":
            show = true;
            break;
          case "high":
            show = card.hasClass("high-card");
            break;
          case "medium":
            show = card.hasClass("medium-card");
            break;
          case "low":
            show = card.hasClass("low-card");
            break;
          case "completed":
            show = card.hasClass("completed-card");
            break;
          case "mine":
            const assigneeEl = card.querySelector("h3");
            if (assigneeEl && assigneeEl.textContent) {
              const assignee = assigneeEl.textContent.replace(/^👤\s*/, "").trim().toLowerCase();
              const myNamesStr = (_d = (_c = (_b = (_a = this.plugin) == null ? void 0 : _a.settings) == null ? void 0 : _b.dashboardMyName) == null ? void 0 : _c.toLowerCase()) == null ? void 0 : _d.trim();
              if (myNamesStr) {
                const myNames = myNamesStr.split(",").map((name) => name.trim()).filter((name) => name.length > 0);
                show = myNames.some(
                  (name) => assignee === name || assignee.includes(name)
                );
              } else {
                show = false;
              }
            } else {
              show = false;
            }
            break;
          case "overdue":
            show = this.hasTasksOverdue(card);
            break;
          case "today":
            show = this.hasTasksDueToday(card);
            break;
          case "week":
            show = this.hasTasksDueThisWeek(card);
            break;
        }
        card.style.display = show ? "block" : "none";
        if (show) sectionHasVisibleCards = true;
      });
      section.style.display = sectionHasVisibleCards ? "block" : "none";
    });
  }
  hasTasksDueToday(card) {
    var _a;
    if (card.classList.contains("completed-card")) {
      return false;
    }
    const taskItems = card.querySelectorAll(".task-list-item");
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    for (const item of Array.from(taskItems)) {
      const checkbox = item.querySelector(".task-checkbox");
      if (checkbox && checkbox.checked) {
        continue;
      }
      const dueDateElem = item.querySelector(".task-due");
      if (dueDateElem) {
        const dateText = (_a = dueDateElem.textContent) == null ? void 0 : _a.match(/\d{4}-\d{2}-\d{2}/);
        if (dateText) {
          const dueDate = /* @__PURE__ */ new Date(dateText[0] + "T00:00:00");
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate >= today && dueDate < tomorrow) {
            return true;
          }
        }
      }
    }
    return false;
  }
  hasTasksDueThisWeek(card) {
    var _a;
    if (card.classList.contains("completed-card")) {
      return false;
    }
    const taskItems = card.querySelectorAll(".task-list-item");
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    for (const item of Array.from(taskItems)) {
      const checkbox = item.querySelector(".task-checkbox");
      if (checkbox && checkbox.checked) {
        continue;
      }
      const dueDateElem = item.querySelector(".task-due");
      if (dueDateElem) {
        const dateText = (_a = dueDateElem.textContent) == null ? void 0 : _a.match(/\d{4}-\d{2}-\d{2}/);
        if (dateText) {
          const dueDate = /* @__PURE__ */ new Date(dateText[0] + "T00:00:00");
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate >= today && dueDate <= weekFromNow) {
            return true;
          }
        }
      }
    }
    return false;
  }
  hasTasksOverdue(card) {
    var _a;
    if (card.classList.contains("completed-card")) {
      return false;
    }
    const taskItems = card.querySelectorAll(".task-list-item");
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    for (const item of Array.from(taskItems)) {
      const checkbox = item.querySelector(".task-checkbox");
      if (checkbox && checkbox.checked) {
        continue;
      }
      const dueDateElem = item.querySelector(".task-due");
      if (dueDateElem) {
        const dateText = (_a = dueDateElem.textContent) == null ? void 0 : _a.match(/\d{4}-\d{2}-\d{2}/);
        if (dateText) {
          const dueDate = /* @__PURE__ */ new Date(dateText[0] + "T00:00:00");
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            return true;
          }
        }
      }
    }
    return false;
  }
  updateStatsOnly() {
  }
  getFilteredTasks() {
    var _a, _b;
    if (this.showOnlyMyTasks && ((_b = (_a = this.plugin) == null ? void 0 : _a.settings) == null ? void 0 : _b.dashboardMyName)) {
      const myNames = this.plugin.settings.dashboardMyName.split(",").map((name) => name.toLowerCase().trim()).filter((name) => name.length > 0);
      if (myNames.length === 0) {
        return this.allTasks;
      }
      return this.allTasks.filter((t) => {
        const assignee = t.assignee.toLowerCase().trim();
        return myNames.some(
          (name) => assignee === name || assignee.includes(name)
        );
      });
    }
    return this.allTasks;
  }
  calculateFilterCounts(tasks) {
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1e3 - 1);
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1e3);
    const counts = {
      high: 0,
      medium: 0,
      low: 0,
      today: 0,
      week: 0,
      overdue: 0,
      completed: 0
    };
    for (const task of tasks) {
      if (!task.completed) {
        if (task.priority === "high") counts.high++;
        else if (task.priority === "medium") counts.medium++;
        else if (task.priority === "low") counts.low++;
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          if (dueDate < today) {
            counts.overdue++;
          } else if (dueDate >= today && dueDate <= endOfToday) {
            counts.today++;
          }
          if (dueDate >= today && dueDate <= weekFromNow) {
            counts.week++;
          }
        }
      }
      if (task.completed) {
        counts.completed++;
      }
    }
    return counts;
  }
  getCurrentFilterCounts() {
    const tasksToCount = this.getFilteredTasks();
    return this.calculateFilterCounts(tasksToCount);
  }
  updateFilterCountsImmediate() {
    const newCounts = this.getCurrentFilterCounts();
    this.filterCounts = newCounts;
    const updateBadge = (filterKey, count) => {
      const badge = this.badgeElements.get(filterKey);
      if (badge) {
        if (count > 0) {
          badge.textContent = count.toString();
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      } else if (count > 0) {
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
    updateBadge("high", newCounts.high);
    updateBadge("medium", newCounts.medium);
    updateBadge("low", newCounts.low);
    updateBadge("overdue", newCounts.overdue);
    updateBadge("today", newCounts.today);
    updateBadge("week", newCounts.week);
    updateBadge("completed", newCounts.completed);
  }
  updateFilterCounts(immediate = false) {
    if (immediate) {
      this.updateFilterCountsImmediate();
      return;
    }
    if (this.updateCountsDebounceTimer) {
      clearTimeout(this.updateCountsDebounceTimer);
    }
    this.updateCountsDebounceTimer = setTimeout(() => {
      this.updateFilterCountsImmediate();
      this.updateCountsDebounceTimer = null;
    }, 150);
  }
  getDataAttr(filterKey) {
    const mapping = {
      "high": "high",
      "medium": "medium",
      "low": "low",
      "overdue": "overdue",
      "today": "due-today",
      "week": "due-week",
      "completed": "completed"
    };
    return mapping[filterKey] || filterKey;
  }
  async updateTaskDisplay() {
    try {
      const container = this.containerEl.children[1];
      const taskSections = container.querySelectorAll(".task-section");
      taskSections.forEach((section) => section.remove());
      const displayTasks = this.getFilteredTasks();
      await this.displayTasks(container, displayTasks);
    } catch (error) {
      console.error("Failed to update task display:", error);
      new import_obsidian2.Notice("Failed to update display. Please refresh.");
    }
  }
  applyDashboardStyles() {
  }
};

// src/gmailService.ts
var import_obsidian3 = require("obsidian");
var GmailService = class {
  constructor(getStoredToken, saveToken) {
    this.getStoredToken = getStoredToken;
    this.saveToken = saveToken;
    this.credentials = null;
    this.token = null;
    this.baseUrl = "https://gmail.googleapis.com/gmail/v1";
    this.authBaseUrl = "https://accounts.google.com/o/oauth2";
    this.tokenUrl = "https://oauth2.googleapis.com/token";
    this.redirectUri = "http://localhost";
    this.token = this.getStoredToken();
  }
  setCredentials(clientId, clientSecret, redirectUri) {
    this.redirectUri = redirectUri || "http://localhost";
    this.credentials = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.redirectUri
    };
  }
  getAuthorizationUrl() {
    if (!this.credentials) {
      throw new Error("Credentials not set. Please configure Google OAuth in settings.");
    }
    const params = new URLSearchParams({
      client_id: this.credentials.client_id,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      access_type: "offline",
      prompt: "consent"
    });
    return `${this.authBaseUrl}/auth?${params.toString()}`;
  }
  async exchangeCodeForToken(code) {
    if (!this.credentials) {
      throw new Error("Credentials not set");
    }
    try {
      const response = await (0, import_obsidian3.requestUrl)({
        url: this.tokenUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret,
          redirect_uri: this.redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });
      if (response.status === 200) {
        const tokenData = response.json;
        this.token = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expiry_date: Date.now() + tokenData.expires_in * 1e3,
          token_type: tokenData.token_type,
          scope: tokenData.scope
        };
        await this.saveToken(this.token);
      } else {
        throw new Error(`Failed to exchange code: ${response.text}`);
      }
    } catch (error) {
      console.error("OAuth token exchange failed:", error);
      throw error;
    }
  }
  async refreshAccessToken() {
    var _a;
    if (!this.credentials || !((_a = this.token) == null ? void 0 : _a.refresh_token)) {
      throw new Error("Cannot refresh token: missing credentials or refresh token");
    }
    try {
      const response = await (0, import_obsidian3.requestUrl)({
        url: this.tokenUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          refresh_token: this.token.refresh_token,
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret,
          grant_type: "refresh_token"
        }).toString()
      });
      if (response.status === 200) {
        const tokenData = response.json;
        this.token = {
          ...this.token,
          access_token: tokenData.access_token,
          expiry_date: Date.now() + tokenData.expires_in * 1e3
        };
        await this.saveToken(this.token);
      } else {
        throw new Error(`Failed to refresh token: ${response.text}`);
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      throw error;
    }
  }
  async ensureValidToken() {
    if (!this.token) {
      throw new Error("Not authenticated. Please authenticate with Gmail first.");
    }
    if (this.token.expiry_date && Date.now() >= this.token.expiry_date - 6e4) {
      console.log("[Gmail] Token expired or expiring soon, refreshing...");
      await this.refreshAccessToken();
    }
  }
  async makeGmailRequest(endpoint, options = {}) {
    await this.ensureValidToken();
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    try {
      const response = await (0, import_obsidian3.requestUrl)({
        url,
        method: options.method || "GET",
        headers: {
          "Authorization": `Bearer ${this.token.access_token}`,
          "Content-Type": "application/json",
          ...options.headers
        },
        ...options
      });
      if (response.status === 401) {
        console.log("[Gmail] Received 401, attempting token refresh...");
        await this.refreshAccessToken();
        const retryResponse = await (0, import_obsidian3.requestUrl)({
          url,
          method: options.method || "GET",
          headers: {
            "Authorization": `Bearer ${this.token.access_token}`,
            "Content-Type": "application/json",
            ...options.headers
          },
          ...options
        });
        return retryResponse.json;
      }
      return response.json;
    } catch (error) {
      console.error(`Gmail API request failed: ${endpoint}`, error);
      throw error;
    }
  }
  async searchEmails(query, maxResults = 100, batchSize = 5) {
    try {
      console.log(`[Gmail] Searching with query: ${query}`);
      const listResponse = await this.makeGmailRequest(
        `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
      );
      if (!listResponse.messages || listResponse.messages.length === 0) {
        console.log("[Gmail] No messages found");
        return [];
      }
      console.log(`[Gmail] Found ${listResponse.messages.length} messages, fetching in batches of ${batchSize}`);
      const messages = [];
      const messageRefs = listResponse.messages.filter((ref) => ref.id);
      const totalBatches = Math.ceil(messageRefs.length / batchSize);
      console.log(`[Gmail] Starting parallel fetch: ${messageRefs.length} emails in ${totalBatches} batches`);
      for (let i = 0; i < messageRefs.length; i += batchSize) {
        const batch = messageRefs.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        console.log(`[Gmail] Fetching batch ${batchNum}/${totalBatches} (${batch.length} emails in parallel)...`);
        const startTime = Date.now();
        const batchPromises = batch.map((messageRef) => {
          console.log(`[Gmail] Starting fetch for email ${messageRef.id}`);
          return this.getEmailById(messageRef.id).catch((error) => {
            console.error(`[Gmail] Failed to fetch message ${messageRef.id}:`, error);
            return null;
          });
        });
        const batchResults = await Promise.all(batchPromises);
        const successfulResults = batchResults.filter((msg) => msg !== null);
        messages.push(...successfulResults);
        const elapsed = Date.now() - startTime;
        console.log(`[Gmail] Batch ${batchNum} complete: ${successfulResults.length}/${batch.length} successful in ${elapsed}ms`);
      }
      console.log(`[Gmail] All batches complete: ${messages.length} emails fetched successfully`);
      return messages;
    } catch (error) {
      console.error("Email search failed:", error);
      throw error;
    }
  }
  async getEmailById(messageId) {
    var _a, _b, _c;
    try {
      const message = await this.makeGmailRequest(
        `/users/me/messages/${messageId}?format=full`
      );
      const headers = ((_a = message.payload) == null ? void 0 : _a.headers) || [];
      const getHeader = (name) => {
        const header = headers.find(
          (h) => {
            var _a2;
            return ((_a2 = h.name) == null ? void 0 : _a2.toLowerCase()) === name.toLowerCase();
          }
        );
        return (header == null ? void 0 : header.value) || "";
      };
      const body = this.extractBody(message.payload);
      const attachments = [];
      if ((_b = message.payload) == null ? void 0 : _b.parts) {
        for (const part of message.payload.parts) {
          if (part.filename && ((_c = part.body) == null ? void 0 : _c.attachmentId)) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId
            });
          }
        }
      }
      return {
        id: messageId,
        subject: getHeader("subject"),
        from: getHeader("from"),
        to: getHeader("to"),
        date: getHeader("date"),
        body,
        snippet: message.snippet || "",
        attachments
      };
    } catch (error) {
      console.error(`Failed to get email ${messageId}:`, error);
      throw error;
    }
  }
  extractBody(payload) {
    var _a, _b, _c;
    if (!payload) return "";
    if ((_a = payload.body) == null ? void 0 : _a.data) {
      return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && ((_b = part.body) == null ? void 0 : _b.data)) {
          return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        }
      }
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && ((_c = part.body) == null ? void 0 : _c.data)) {
          const htmlBody = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          return htmlBody.replace(/<[^>]*>/g, "").trim();
        }
      }
      for (const part of payload.parts) {
        const nestedBody = this.extractBody(part);
        if (nestedBody) return nestedBody;
      }
    }
    return "";
  }
  async fetchRecentMeetingEmails(hoursBack, labels) {
    const afterDate = /* @__PURE__ */ new Date();
    afterDate.setTime(afterDate.getTime() - hoursBack * 60 * 60 * 1e3);
    const dateStr = afterDate.toISOString().split("T")[0];
    const labelList = (labels || "transcript").split(",").map((l) => l.trim()).filter((l) => l);
    console.log(
      `[Gmail] Looking for emails with labels: ${labelList.join(", ")} after ${dateStr} (${hoursBack} hours back)`
    );
    let labelQuery = "";
    if (labelList.length === 1) {
      labelQuery = `label:${labelList[0]}`;
    } else {
      labelQuery = `(${labelList.map((l) => `label:${l}`).join(" OR ")})`;
    }
    const query = `${labelQuery} after:${dateStr}`;
    return this.searchEmails(query, 100);
  }
  isAuthenticated() {
    var _a;
    return !!((_a = this.token) == null ? void 0 : _a.access_token);
  }
  hasRefreshToken() {
    var _a;
    return !!((_a = this.token) == null ? void 0 : _a.refresh_token);
  }
  async testConnection() {
    try {
      await this.ensureValidToken();
      const profile = await this.makeGmailRequest("/users/me/profile");
      console.log("[Gmail] Connection test successful:", profile.emailAddress);
      return true;
    } catch (error) {
      console.error("[Gmail] Connection test failed:", error);
      return false;
    }
  }
  clearAuthentication() {
    this.token = null;
  }
};

// src/oauthServer.ts
var OAuthServer = class {
  constructor() {
    this.server = null;
    this.port = 42813;
    this.authCodePromise = null;
    this.authCodeResolve = null;
    this.authCodeReject = null;
  }
  async start() {
    if (this.server) {
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        const http = window.require("http");
        this.server = http.createServer((req, res) => {
          const url = new URL(req.url, `http://localhost:${this.port}`);
          if (url.pathname === "/callback") {
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");
            res.writeHead(200, { "Content-Type": "text/html" });
            if (code) {
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      margin: 0;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                    }
                    .container {
                      text-align: center;
                      padding: 2rem;
                      background: rgba(255, 255, 255, 0.1);
                      border-radius: 12px;
                      backdrop-filter: blur(10px);
                    }
                    .success-icon {
                      font-size: 4rem;
                      margin-bottom: 1rem;
                    }
                    h1 {
                      margin: 0 0 0.5rem 0;
                      font-size: 2rem;
                    }
                    p {
                      margin: 0.5rem 0;
                      opacity: 0.9;
                      font-size: 1.1rem;
                    }
                    .close-hint {
                      margin-top: 2rem;
                      font-size: 0.9rem;
                      opacity: 0.7;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="success-icon">\u2705</div>
                    <h1>Authentication Successful!</h1>
                    <p>You can now close this window and return to Obsidian.</p>
                    <p class="close-hint">This window will close automatically in 3 seconds...</p>
                  </div>
                  <script>
                    setTimeout(() => window.close(), 3000);
                  <\/script>
                </body>
                </html>
              `);
              if (this.authCodeResolve) {
                this.authCodeResolve(code);
                this.authCodeResolve = null;
                this.authCodeReject = null;
              }
            } else {
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Failed</title>
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      margin: 0;
                      background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
                      color: white;
                    }
                    .container {
                      text-align: center;
                      padding: 2rem;
                      background: rgba(255, 255, 255, 0.1);
                      border-radius: 12px;
                      backdrop-filter: blur(10px);
                    }
                    .error-icon {
                      font-size: 4rem;
                      margin-bottom: 1rem;
                    }
                    h1 {
                      margin: 0 0 0.5rem 0;
                      font-size: 2rem;
                    }
                    p {
                      margin: 0.5rem 0;
                      opacity: 0.9;
                    }
                    .error-msg {
                      margin-top: 1rem;
                      padding: 1rem;
                      background: rgba(0, 0, 0, 0.2);
                      border-radius: 6px;
                      font-family: monospace;
                      font-size: 0.9rem;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="error-icon">\u274C</div>
                    <h1>Authentication Failed</h1>
                    <p>There was an error during authentication.</p>
                    ${error ? `<div class="error-msg">Error: ${error}</div>` : ""}
                    <p>Please close this window and try again.</p>
                  </div>
                </body>
                </html>
              `);
              if (this.authCodeReject) {
                this.authCodeReject(new Error(error || "Authentication failed"));
                this.authCodeResolve = null;
                this.authCodeReject = null;
              }
            }
          } else {
            res.writeHead(404);
            res.end("Not found");
          }
        });
        this.server.listen(this.port, "127.0.0.1", () => {
          console.log(`[OAuth Server] Started on http://127.0.0.1:${this.port}`);
          resolve();
        });
        this.server.on("error", (err) => {
          if (err.code === "EADDRINUSE") {
            console.error(`[OAuth Server] Port ${this.port} is already in use`);
            reject(new Error(`Port ${this.port} is already in use. Please close any other applications using this port.`));
          } else {
            reject(err);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  async stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.authCodeResolve = null;
    this.authCodeReject = null;
    this.authCodePromise = null;
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log("[OAuth Server] Stopped");
          this.server = null;
          resolve();
        });
      });
    }
  }
  async waitForAuthCode() {
    if (!this.server) {
      throw new Error("OAuth server not started");
    }
    this.authCodeResolve = null;
    this.authCodeReject = null;
    this.authCodePromise = null;
    this.authCodePromise = new Promise((resolve, reject) => {
      this.authCodeResolve = resolve;
      this.authCodeReject = reject;
      const timeoutId = setTimeout(() => {
        this.authCodeResolve = null;
        this.authCodeReject = null;
        reject(new Error("OAuth timeout - no response received within 5 minutes"));
      }, 5 * 60 * 1e3);
      this.timeoutId = timeoutId;
    });
    return this.authCodePromise;
  }
  getRedirectUri() {
    return `http://127.0.0.1:${this.port}/callback`;
  }
  isRunning() {
    return this.server !== null;
  }
};

// src/main.ts
var DEFAULT_SETTINGS = {
  lookbackTime: "5d",
  lookbackHours: 120,
  // Keep for backward compatibility
  debugMode: false,
  anthropicApiKey: "",
  googleClientId: "",
  googleClientSecret: "",
  notesFolder: "Meetings",
  claudeModel: "claude-3-5-haiku-20241022",
  dashboardShowOnlyMyTasks: true,
  dashboardMyName: "",
  gmailLabels: "transcript",
  gmailToken: null,
  showDetailedNotifications: true
};
var MeetingTasksPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.gmailService = null;
    this.claudeExtractor = null;
    this.oauthServer = null;
    this.statusBarItem = null;
    this.emailIdCache = /* @__PURE__ */ new Set();
  }
  // Cache for performance
  parseTimeToHours(timeStr) {
    const match = timeStr.match(/^(\d+(?:\.\d+)?)\s*([hdwM]?)$/);
    if (!match) {
      const num = parseFloat(timeStr);
      return isNaN(num) ? 120 : num;
    }
    const value = parseFloat(match[1]);
    const unit = match[2] || "h";
    switch (unit) {
      case "h":
        return value;
      case "d":
        return value * 24;
      case "w":
        return value * 24 * 7;
      case "M":
        return value * 24 * 30;
      // Approximate month as 30 days
      default:
        return value;
    }
  }
  formatTimeString(hours) {
    if (hours < 24) {
      return `${hours}h`;
    } else if (hours < 24 * 7) {
      const days = Math.round(hours / 24);
      return `${days}d`;
    } else if (hours < 24 * 30) {
      const weeks = Math.round(hours / (24 * 7));
      return `${weeks}w`;
    } else {
      const months = Math.round(hours / (24 * 30));
      return `${months}M`;
    }
  }
  async loadEmailIdCache() {
    console.log("[LoadCache] Starting to load email IDs from vault notes...");
    this.emailIdCache.clear();
    const files = this.app.vault.getMarkdownFiles();
    console.log(`[LoadCache] Found ${files.length} total markdown files in vault`);
    let meetingNoteCount = 0;
    let emailIdCount = 0;
    for (const file of files) {
      if (!file.path.startsWith(this.settings.notesFolder)) {
        continue;
      }
      meetingNoteCount++;
      try {
        const content = await this.app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const emailIdMatch = frontmatterMatch[1].match(/emailId:\s*(.+)/);
          if (emailIdMatch && emailIdMatch[1]) {
            const emailId = emailIdMatch[1].trim();
            this.emailIdCache.add(emailId);
            emailIdCount++;
            console.log(`[LoadCache] Found emailId: ${emailId} in ${file.path}`);
          }
        }
      } catch (error) {
        console.error(`[LoadCache] Error reading file ${file.path}:`, error);
      }
    }
    console.log(`[LoadCache] Scanned ${meetingNoteCount} meeting notes, found ${emailIdCount} email IDs`);
    console.log(`[LoadCache] Cache now contains ${this.emailIdCache.size} unique email IDs`);
    this.settings.processedEmails = Array.from(this.emailIdCache);
    await this.saveSettings();
    console.log(`[LoadCache] Saved ${this.settings.processedEmails.length} email IDs to settings`);
  }
  async onload() {
    console.log("===============================================");
    console.log("Loading Meeting Tasks Plugin...");
    console.log("Plugin version: 2.0.0");
    console.log("===============================================");
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    if ((data == null ? void 0 : data.lookbackHours) && !(data == null ? void 0 : data.lookbackTime)) {
      this.settings.lookbackTime = this.formatTimeString(data.lookbackHours);
      this.settings.lookbackHours = data.lookbackHours;
    } else if (this.settings.lookbackTime) {
      this.settings.lookbackHours = this.parseTimeToHours(this.settings.lookbackTime);
    }
    if (this.settings.processedEmails) {
      this.settings.processedEmails.forEach((id) => this.emailIdCache.add(id));
      console.log(`[Plugin] Loaded ${this.emailIdCache.size} email IDs from settings`);
    }
    this.app.workspace.onLayoutReady(async () => {
      await this.loadEmailIdCache();
      console.log(`[Plugin] Found ${this.emailIdCache.size} existing meeting notes in vault`);
    });
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        var _a;
        if (file instanceof import_obsidian4.TFile && file.extension === "md" && file.path.startsWith(this.settings.notesFolder)) {
          console.log(`[Delete] Meeting note deleted: ${file.path}`);
          const cache = this.app.metadataCache.getFileCache(file);
          if ((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.emailId) {
            const emailId = cache.frontmatter.emailId;
            console.log(`[Delete] Removing emailId from cache: ${emailId}`);
            this.emailIdCache.delete(emailId);
            this.settings.processedEmails = Array.from(this.emailIdCache);
            await this.saveSettings();
            console.log(`[Delete] Updated cache, now contains ${this.emailIdCache.size} email IDs`);
          }
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        var _a, _b;
        if (file instanceof import_obsidian4.TFile && file.extension === "md") {
          const wasInMeetings = oldPath.startsWith(this.settings.notesFolder);
          const nowInMeetings = file.path.startsWith(this.settings.notesFolder);
          if (wasInMeetings && !nowInMeetings) {
            console.log(`[Rename] File moved out of meetings folder: ${oldPath} -> ${file.path}`);
            const cache = this.app.metadataCache.getFileCache(file);
            if ((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.emailId) {
              const emailId = cache.frontmatter.emailId;
              console.log(`[Rename] Removing emailId from cache: ${emailId}`);
              this.emailIdCache.delete(emailId);
              this.settings.processedEmails = Array.from(this.emailIdCache);
              await this.saveSettings();
              console.log(`[Rename] Cache updated, now contains ${this.emailIdCache.size} email IDs`);
            } else {
              console.log(`[Rename] File has no emailId in frontmatter, skipping cache update`);
            }
          } else if (!wasInMeetings && nowInMeetings) {
            console.log(`[Rename] File moved into meetings folder: ${oldPath} -> ${file.path}`);
            await new Promise((resolve) => setTimeout(resolve, 100));
            const cache = this.app.metadataCache.getFileCache(file);
            if ((_b = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _b.emailId) {
              const emailId = cache.frontmatter.emailId;
              console.log(`[Rename] Adding emailId to cache: ${emailId}`);
              this.emailIdCache.add(emailId);
              this.settings.processedEmails = Array.from(this.emailIdCache);
              await this.saveSettings();
              console.log(`[Rename] Cache updated, now contains ${this.emailIdCache.size} email IDs`);
            } else {
              try {
                const content = await this.app.vault.read(file);
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                  const emailIdMatch = frontmatterMatch[1].match(/emailId:\s*(.+)/);
                  if (emailIdMatch && emailIdMatch[1]) {
                    const emailId = emailIdMatch[1].trim();
                    console.log(`[Rename] Adding emailId to cache (from file content): ${emailId}`);
                    this.emailIdCache.add(emailId);
                    this.settings.processedEmails = Array.from(this.emailIdCache);
                    await this.saveSettings();
                    console.log(`[Rename] Cache updated, now contains ${this.emailIdCache.size} email IDs`);
                  } else {
                    console.log(`[Rename] File has no emailId in frontmatter, not adding to cache`);
                  }
                } else {
                  console.log(`[Rename] File has no frontmatter, not adding to cache`);
                }
              } catch (error) {
                console.error(`[Rename] Error reading file content:`, error);
              }
            }
          }
        }
      })
    );
    this.registerObsidianProtocolHandler("meeting-tasks-oauth", async (params) => {
      if (params.code) {
        try {
          if (!this.gmailService) {
            new import_obsidian4.Notice("Gmail service not initialized");
            return;
          }
          await this.gmailService.exchangeCodeForToken(params.code);
          new import_obsidian4.Notice("\u2705 Successfully authenticated with Gmail!");
          await this.initializeServices();
          this.app.workspace.trigger("meeting-tasks:auth-complete");
        } catch (error) {
          new import_obsidian4.Notice(`Authentication failed: ${error.message}`);
          console.error("OAuth callback error:", error);
        }
      } else if (params.error) {
        new import_obsidian4.Notice(`Authentication failed: ${params.error}`);
      }
    });
    (0, import_obsidian4.addIcon)(
      "mail-check",
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>'
    );
    const ribbonIconEl = this.addRibbonIcon("mail-check", "Process meeting emails", async () => {
      await this.processEmails();
    });
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatus("Ready");
    this.addCommand({
      id: "process-meeting-emails",
      name: "\u{1F4E7} Process meeting emails now",
      callback: async () => {
        await this.processEmails();
      },
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "M"
        }
      ]
    });
    this.addCommand({
      id: "open-task-dashboard",
      name: "Open task dashboard",
      callback: () => {
        this.openTaskDashboard();
      }
    });
    this.addCommand({
      id: "quick-process-emails",
      name: "\u26A1 Quick process (last 24 hours)",
      callback: async () => {
        const originalLookback = this.settings.lookbackTime;
        this.settings.lookbackTime = "24h";
        await this.processEmails();
        this.settings.lookbackTime = originalLookback;
      }
    });
    this.addCommand({
      id: "reset-processed-emails",
      name: "Reset processed emails",
      callback: async () => {
        await this.resetProcessedEmails();
      }
    });
    this.addCommand({
      id: "reprocess-meeting-note",
      name: "\u{1F504} Reprocess current meeting note",
      callback: async () => {
        await this.reprocessCurrentMeetingNote();
      }
    });
    this.addCommand({
      id: "reprocess-email-by-id",
      name: "\u{1F4E7} Reprocess email by ID",
      callback: async () => {
        await this.reprocessEmailById("1995cbb7415c015f");
      }
    });
    this.registerView(TASK_DASHBOARD_VIEW_TYPE, (leaf) => new TaskDashboardView(leaf, this));
    this.addRibbonIcon("layout-dashboard", "Open task dashboard", () => {
      this.openTaskDashboard();
    });
    await this.initializeServices();
    this.addSettingTab(new MeetingTasksSettingTab(this.app, this));
  }
  async initializeServices() {
    try {
      this.gmailService = new GmailService(
        () => this.settings.gmailToken,
        async (token) => {
          this.settings.gmailToken = token;
          await this.saveSettings();
        }
      );
      if (this.settings.googleClientId && this.settings.googleClientSecret) {
        this.gmailService.setCredentials(
          this.settings.googleClientId,
          this.settings.googleClientSecret
        );
        if (this.gmailService.isAuthenticated()) {
          const connected = await this.gmailService.testConnection();
          if (connected) {
            this.updateStatus("Gmail connected");
          } else {
            this.updateStatus("Gmail auth needed");
          }
        } else {
          this.updateStatus("Gmail not authenticated");
        }
      } else {
        this.updateStatus("Gmail setup needed");
      }
      if (this.settings.anthropicApiKey) {
        this.claudeExtractor = new ClaudeTaskExtractor(
          this.settings.anthropicApiKey,
          this.settings.claudeModel
        );
      }
    } catch (error) {
      console.error("Failed to initialize services:", error);
      new import_obsidian4.Notice(`Error: ${error.message}`);
    }
  }
  async processEmails() {
    console.log("[processEmails] Starting email processing");
    try {
      this.updateStatus("\u{1F504} Starting email processing...");
      new import_obsidian4.Notice("\u{1F4E7} Starting email processing...");
      if (this.emailIdCache.size === 0 && this.app.vault.getMarkdownFiles().length > 0) {
        console.log("[processEmails] Cache empty, loading from vault...");
        await this.loadEmailIdCache();
      }
      if (!this.gmailService) {
        this.updateStatus("\u274C Gmail service not initialized");
        new import_obsidian4.Notice("Gmail service not initialized");
        return;
      }
      if (!this.gmailService.isAuthenticated()) {
        this.updateStatus("\u274C Not authenticated");
        new import_obsidian4.Notice("Please authenticate with Gmail first (see plugin settings)");
        return;
      }
      const lookbackHours = this.parseTimeToHours(this.settings.lookbackTime);
      this.updateStatus(`\u{1F50D} Searching emails (${this.settings.lookbackTime})...`);
      new import_obsidian4.Notice(
        `\u{1F504} Searching for meeting emails from the last ${this.settings.lookbackTime}...`
      );
      const emails = await this.gmailService.fetchRecentMeetingEmails(
        lookbackHours,
        this.settings.gmailLabels
      );
      if (emails.length === 0) {
        this.updateStatus("\u2705 No new emails found");
        new import_obsidian4.Notice(`\u2705 No meeting emails found in the last ${this.settings.lookbackTime}`);
        return;
      }
      this.updateStatus(`\u{1F4CA} Found ${emails.length} emails`);
      new import_obsidian4.Notice(`\u{1F4CA} Found ${emails.length} meeting emails. Processing...`);
      let notesCreated = 0;
      let totalTasks = 0;
      let highPriorityTasks = 0;
      let processedCount = 0;
      let skippedCount = 0;
      console.log(`[Process] Cache contains ${this.emailIdCache.size} processed email IDs`);
      console.log(`[Process] First 5 cache entries:`, Array.from(this.emailIdCache).slice(0, 5));
      const emailsToProcess = emails.filter((email) => {
        if (this.emailIdCache.has(email.id)) {
          skippedCount++;
          console.log(`[Process] Skipping already processed email: ${email.id} - "${email.subject}"`);
          return false;
        }
        console.log(`[Process] Will process new email: ${email.id} - "${email.subject}"`);
        return true;
      });
      console.log(`[Process] Processing ${emailsToProcess.length} new emails (${skippedCount} skipped)`);
      const batchSize = 3;
      const totalBatches = Math.ceil(emailsToProcess.length / batchSize);
      console.log(`[Process] Will process in ${totalBatches} batches of up to ${batchSize} emails each`);
      for (let i = 0; i < emailsToProcess.length; i += batchSize) {
        const batch = emailsToProcess.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const batchTitles = batch.map((e) => e.subject || "Untitled").join(", ");
        const statusMsg = this.settings.showDetailedNotifications ? `\u{1F4DD} Processing: ${batchTitles.substring(0, 50)}${batchTitles.length > 50 ? "..." : ""}` : `\u{1F4DD} Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)...`;
        this.updateStatus(statusMsg);
        console.log(`
[Process] === Starting Batch ${batchNum}/${totalBatches} ===`);
        console.log(`[Process] Batch contains ${batch.length} emails:`);
        batch.forEach((email, idx) => {
          console.log(`[Process]   ${idx + 1}. ${email.subject || "No subject"} (ID: ${email.id})`);
        });
        const startTime = Date.now();
        console.log(`[Process] Starting parallel processing at ${new Date(startTime).toISOString()}`);
        const batchPromises = batch.map(async (email, idx) => {
          const emailStartTime = Date.now();
          console.log(`[Process] Starting email ${idx + 1}/${batch.length}: ${email.id}`);
          try {
            const result = await this.processTranscriptEmail(email);
            const elapsed = Date.now() - emailStartTime;
            if (result.success) {
              const successMsg = this.settings.showDetailedNotifications && result.emailTitle ? `[Process] \u2705 "${result.emailTitle}" succeeded in ${elapsed}ms (${result.taskCount} tasks, ${result.confidence}% confidence)` : `[Process] \u2705 Email ${idx + 1} succeeded in ${elapsed}ms (${result.taskCount} tasks, ${result.confidence}% confidence)`;
              console.log(successMsg);
              return result;
            } else {
              const failMsg = this.settings.showDetailedNotifications && email.subject ? `[Process] \u274C "${email.subject.substring(0, 50)}" failed in ${elapsed}ms` : `[Process] \u274C Email ${idx + 1} failed in ${elapsed}ms`;
              console.log(failMsg);
              return null;
            }
          } catch (error) {
            const elapsed = Date.now() - emailStartTime;
            console.error(`[Process] \u274C Email ${idx + 1} errored in ${elapsed}ms:`, error);
            return null;
          }
        });
        console.log(`[Process] Waiting for all ${batch.length} emails to complete...`);
        const batchResults = await Promise.all(batchPromises);
        const batchElapsed = Date.now() - startTime;
        const successCount = batchResults.filter((r) => r && r.success).length;
        console.log(`[Process] Batch ${batchNum} complete: ${successCount}/${batch.length} successful in ${batchElapsed}ms`);
        console.log(`[Process] Average time per email: ${Math.round(batchElapsed / batch.length)}ms`);
        for (const result of batchResults) {
          if (result && result.success) {
            notesCreated++;
            totalTasks += result.taskCount || 0;
            highPriorityTasks += result.highPriorityCount || 0;
            processedCount++;
            if (result.taskCount && result.taskCount > 0) {
              if (this.settings.showDetailedNotifications && result.emailTitle) {
                new import_obsidian4.Notice(`\u2705 ${result.emailTitle}: ${result.taskCount} tasks extracted`);
              } else {
                new import_obsidian4.Notice(`\u2705 Batch ${batchNum}: Created note with ${result.taskCount} tasks`);
              }
            }
          }
        }
      }
      console.log(`
[Process] === Processing Complete ===`);
      console.log(`[Process] Notes created: ${notesCreated}`);
      console.log(`[Process] Total tasks: ${totalTasks}`);
      console.log(`[Process] High priority tasks: ${highPriorityTasks}`);
      if (skippedCount > 0 && notesCreated === 0) {
        this.updateStatus(`\u2705 All ${skippedCount} emails already processed`);
        new import_obsidian4.Notice(`\u2705 All ${skippedCount} emails were already processed`);
      } else if (notesCreated > 0) {
        this.updateStatus(`\u2705 Created ${notesCreated} notes (${totalTasks} tasks)`);
        let message = `\u2705 Successfully created ${notesCreated} meeting notes with ${totalTasks} tasks`;
        if (highPriorityTasks > 0) {
          message += ` (${highPriorityTasks} high priority)`;
        }
        new import_obsidian4.Notice(message, 5e3);
      } else {
        this.updateStatus("\u2705 Processing complete");
        new import_obsidian4.Notice("\u2705 Email processing complete (no new notes created)");
      }
    } catch (error) {
      console.error("Error processing emails:", error);
      this.updateStatus("\u274C Error processing emails");
      new import_obsidian4.Notice(`\u274C Error: ${error.message}`);
    }
  }
  async processTranscriptEmail(email) {
    try {
      console.log(`[Extract] Starting processing for: ${email.subject} (ID: ${email.id})`);
      let emailContent = email.body;
      if (typeof emailContent === "object") {
        emailContent = JSON.stringify(emailContent);
      }
      if (!emailContent || emailContent === "{}" || emailContent === "[object Object]") {
        console.warn("No valid email content available");
        return { success: false };
      }
      let extraction;
      if (this.claudeExtractor && this.settings.anthropicApiKey) {
        console.log(`[Extract] Starting Claude AI extraction for email ${email.id}...`);
        const aiStartTime = Date.now();
        extraction = await this.claudeExtractor.extractTasks(emailContent, email.subject);
        const aiElapsed = Date.now() - aiStartTime;
        console.log(
          `[Extract] Claude extraction complete in ${aiElapsed}ms: ${extraction.tasks.length} tasks with ${extraction.confidence}% confidence`
        );
      } else {
        console.log("No Claude API key, skipping task extraction");
        extraction = {
          tasks: [],
          summary: email.subject || "Meeting notes",
          participants: [],
          meetingDate: email.date ? new Date(email.date) : /* @__PURE__ */ new Date(),
          keyDecisions: [],
          nextSteps: [],
          confidence: 0
        };
      }
      const noteCreated = await this.createMeetingNote(email, extraction);
      if (noteCreated) {
        const highPriorityCount = extraction.tasks.filter((t) => t.priority === "high").length;
        const emailTitle = email.subject || "Untitled";
        return {
          success: true,
          taskCount: extraction.tasks.length,
          highPriorityCount,
          confidence: extraction.confidence,
          obsidianPath: noteCreated,
          emailTitle: emailTitle.substring(0, 50)
        };
      }
      return { success: false };
    } catch (error) {
      console.error("Failed to process transcript email:", error);
      return { success: false };
    }
  }
  async createMeetingNote(email, extraction) {
    try {
      const year = extraction.meetingDate.getFullYear();
      const month = String(extraction.meetingDate.getMonth() + 1).padStart(2, "0");
      const folderPath = (0, import_obsidian4.normalizePath)(`${this.settings.notesFolder}/${year}/${month}`);
      const yearFolder = (0, import_obsidian4.normalizePath)(`${this.settings.notesFolder}/${year}`);
      if (!this.app.vault.getAbstractFileByPath(yearFolder)) {
        await this.app.vault.createFolder(yearFolder);
      }
      if (!this.app.vault.getAbstractFileByPath(folderPath)) {
        await this.app.vault.createFolder(folderPath);
      }
      const date = extraction.meetingDate.toISOString().split("T")[0];
      const subject = (email.subject || "Meeting").replace(/[\\/:*?"<>|]/g, "-").substring(0, 50);
      const fileName = `${date} - ${subject}.md`;
      const filePath = (0, import_obsidian4.normalizePath)(`${folderPath}/${fileName}`);
      if (this.app.vault.getAbstractFileByPath(filePath)) {
        console.log("Note already exists:", filePath);
        return false;
      }
      let noteContent = this.formatMeetingNote(email, extraction);
      await this.app.vault.create(filePath, noteContent);
      console.log("Created note:", filePath);
      this.emailIdCache.add(email.id);
      this.settings.processedEmails = Array.from(this.emailIdCache);
      await this.saveSettings();
      return filePath;
    } catch (error) {
      console.error("Failed to create note:", error);
      return false;
    }
  }
  formatMeetingNote(email, extraction) {
    const date = extraction.meetingDate.toISOString().split("T")[0];
    let content = `---
title: ${email.subject || "Meeting Notes"}
date: ${date}
type: meeting
source: Gmail
emailId: ${email.id}
participants: [${extraction.participants.map((p) => `"${p}"`).join(", ")}]
confidence: ${extraction.confidence}
tags: [meeting, ${extraction.tasks.length > 0 ? "has-tasks" : "no-tasks"}]
created: ${(/* @__PURE__ */ new Date()).toISOString()}
---

# ${email.subject || "Meeting Notes"}

**Date:** ${extraction.meetingDate.toLocaleDateString()}
**From:** ${email.from || "Unknown"}
`;
    if (extraction.participants.length > 0) {
      content += `**Participants:** ${extraction.participants.map((p) => `[[${p}]]`).join(", ")}
`;
    }
    content += `**Confidence:** ${extraction.confidence}%

`;
    if (extraction.summary) {
      content += `## Summary
${extraction.summary}

`;
    }
    if (extraction.keyDecisions.length > 0) {
      content += `## Key Decisions
`;
      for (const decision of extraction.keyDecisions) {
        content += `- ${decision}
`;
      }
      content += "\n";
    }
    if (extraction.tasks.length > 0) {
      content += `## Action Items

`;
      const highPriority = extraction.tasks.filter((t) => t.priority === "high");
      const mediumPriority = extraction.tasks.filter((t) => t.priority === "medium");
      const lowPriority = extraction.tasks.filter((t) => t.priority === "low");
      if (highPriority.length > 0) {
        content += `### \u{1F534} High Priority
`;
        for (const task of highPriority) {
          content += this.formatTask(task);
        }
        content += "\n";
      }
      if (mediumPriority.length > 0) {
        content += `### \u{1F7E1} Medium Priority
`;
        for (const task of mediumPriority) {
          content += this.formatTask(task);
        }
        content += "\n";
      }
      if (lowPriority.length > 0) {
        content += `### \u{1F7E2} Low Priority
`;
        for (const task of lowPriority) {
          content += this.formatTask(task);
        }
        content += "\n";
      }
    }
    if (extraction.nextSteps.length > 0) {
      content += `## Next Steps
`;
      for (const step of extraction.nextSteps) {
        content += `- ${step}
`;
      }
      content += "\n";
    }
    if (email.body) {
      content += `## Original Email
\`\`\`
${email.body.substring(0, 1e3)}${email.body.length > 1e3 ? "..." : ""}
\`\`\`
`;
    }
    content += `
---
*Imported from Gmail on ${(/* @__PURE__ */ new Date()).toLocaleString()}*`;
    return content;
  }
  formatTask(task) {
    const dueDate = task.dueDate || this.getDefaultDueDate();
    let taskLine = `- [ ] ${task.description} [[@${task.assignee}]] \u{1F4C5} ${dueDate}`;
    if (task.confidence < 70) {
      taskLine += ` \u26A0\uFE0F ${task.confidence}%`;
    }
    if (task.category && task.category !== "other") {
      taskLine += ` #${task.category}`;
    }
    taskLine += "\n";
    if (task.context) {
      taskLine += `  - Context: ${task.context}
`;
    }
    if (task.rawText && task.rawText !== task.description) {
      taskLine += `  > "${task.rawText}"
`;
    }
    return taskLine;
  }
  getDefaultDueDate() {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0];
  }
  updateStatus(status) {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`\u{1F4E7} ${status}`);
    }
  }
  async openTaskDashboard() {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(TASK_DASHBOARD_VIEW_TYPE);
    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]);
    } else {
      const leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: TASK_DASHBOARD_VIEW_TYPE,
          active: true
        });
        workspace.revealLeaf(leaf);
      }
    }
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async reprocessEmailById(emailId) {
    try {
      console.log(`[reprocessEmailById] Reprocessing email: ${emailId}`);
      if (!this.gmailService || !this.gmailService.isAuthenticated()) {
        new import_obsidian4.Notice("Gmail service not authenticated");
        return;
      }
      if (!this.claudeExtractor && this.settings.anthropicApiKey) {
        this.claudeExtractor = new ClaudeTaskExtractor(
          this.settings.anthropicApiKey,
          this.settings.claudeModel
        );
        console.log("[reprocessEmailById] Initialized Claude extractor");
      }
      this.updateStatus(`\u{1F504} Fetching email ${emailId}...`);
      const email = await this.gmailService.getEmailById(emailId);
      if (!email) {
        new import_obsidian4.Notice(`Email ${emailId} not found`);
        return;
      }
      this.emailIdCache.delete(emailId);
      const result = await this.processTranscriptEmail(email);
      if (result.success) {
        this.emailIdCache.add(emailId);
        this.settings.processedEmails = Array.from(this.emailIdCache);
        await this.saveSettings();
        new import_obsidian4.Notice(`\u2705 Reprocessed email with ${result.taskCount || 0} tasks (Confidence: ${result.confidence}%)`);
        this.updateStatus(`\u2705 Reprocessed with ${result.taskCount || 0} tasks`);
      } else {
        new import_obsidian4.Notice("\u274C Failed to reprocess email");
        this.updateStatus("\u274C Reprocessing failed");
      }
    } catch (error) {
      console.error("Error reprocessing email:", error);
      new import_obsidian4.Notice(`\u274C Error: ${error.message}`);
      this.updateStatus("\u274C Error reprocessing");
    }
  }
  async reprocessCurrentMeetingNote() {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new import_obsidian4.Notice("No active file. Please open a meeting note to reprocess.");
        return;
      }
      const content = await this.app.vault.read(activeFile);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        new import_obsidian4.Notice("This file does not appear to be a meeting note (no frontmatter).");
        return;
      }
      const frontmatter = frontmatterMatch[1];
      const emailIdMatch = frontmatter.match(/emailId:\s*(.+)/);
      if (!emailIdMatch || !emailIdMatch[1]) {
        new import_obsidian4.Notice("No email ID found in this meeting note. Cannot reprocess.");
        return;
      }
      const emailId = emailIdMatch[1].trim();
      const confirmed = confirm(
        `Reprocess Meeting Note?

This will fetch the original email and regenerate the summary and tasks.

Email ID: ${emailId}`
      );
      if (!confirmed) {
        return;
      }
      this.updateStatus("Reprocessing...");
      new import_obsidian4.Notice("Fetching original email...");
      if (!this.gmailService || !this.gmailService.isAuthenticated()) {
        new import_obsidian4.Notice("Gmail not connected. Please authenticate first.");
        this.updateStatus("Gmail not connected");
        return;
      }
      console.log(`Reading email with ID: ${emailId}`);
      const email = await this.gmailService.getEmailById(emailId);
      if (!email) {
        new import_obsidian4.Notice("Could not find the original email. It may have been deleted.");
        this.updateStatus("Ready");
        return;
      }
      console.log("Found email:", email.subject);
      new import_obsidian4.Notice("Extracting tasks and summary...");
      const emailContent = email.body || email.snippet || "";
      let extraction;
      if (this.claudeExtractor && this.settings.anthropicApiKey) {
        console.log("Reprocessing with Claude...");
        extraction = await this.claudeExtractor.extractTasks(emailContent, email.subject);
        console.log(
          `Extracted ${extraction.tasks.length} tasks with ${extraction.confidence}% confidence`
        );
      } else {
        console.log("Claude extractor not available for reprocessing");
        new import_obsidian4.Notice("\u274C Claude AI not configured - cannot reprocess");
        return;
      }
      const newContent = this.formatMeetingNote(email, extraction);
      await this.app.vault.modify(activeFile, newContent);
      const taskCount = extraction.tasks.length;
      const highPriorityCount = extraction.tasks.filter((t) => t.priority === "high").length;
      this.updateStatus(`Reprocessed: ${taskCount} tasks`);
      new import_obsidian4.Notice(
        `\u2705 Reprocessed successfully! Found ${taskCount} task${taskCount !== 1 ? "s" : ""} (${highPriorityCount} high priority)`
      );
    } catch (error) {
      console.error("Failed to reprocess meeting note:", error);
      new import_obsidian4.Notice(`Error reprocessing: ${error.message}`);
      this.updateStatus("Error");
    }
  }
  async resetProcessedEmails() {
    console.log("Reset function called");
    try {
      this.updateStatus("Resetting...");
      const confirmed = confirm(
        "Reset Processed Emails?\n\nThis will clear all processed email records, allowing them to be processed again."
      );
      if (!confirmed) {
        console.log("User cancelled reset");
        this.updateStatus("Ready");
        return;
      }
      console.log("User confirmed reset");
      new import_obsidian4.Notice("Resetting processed emails...");
      this.emailIdCache.clear();
      this.settings.processedEmails = [];
      await this.saveSettings();
      await this.loadEmailIdCache();
      new import_obsidian4.Notice("\u2705 Cache refreshed. Existing notes will prevent duplicate processing.");
      this.updateStatus("Ready");
    } catch (error) {
      console.error("Reset failed:", error);
      new import_obsidian4.Notice(`Reset failed: ${error.message}`);
      this.updateStatus("Error");
    }
  }
  onunload() {
    console.log("Unloading Meeting Tasks Plugin...");
  }
};
var MeetingTasksSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    var _a, _b;
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Meeting Tasks Settings" });
    containerEl.createEl("h3", { text: "Google OAuth Settings" });
    containerEl.createEl("p", {
      text: "Create OAuth credentials in Google Cloud Console. Follow the guide for detailed instructions.",
      cls: "setting-item-description"
    });
    new import_obsidian4.Setting(containerEl).setName("Google Client ID").setDesc("Your Google OAuth Client ID (from Google Cloud Console)").addText(
      (text) => text.setPlaceholder("1234567890-abc...apps.googleusercontent.com").setValue(this.plugin.settings.googleClientId).onChange(async (value) => {
        this.plugin.settings.googleClientId = value;
        await this.plugin.saveSettings();
        await this.plugin.initializeServices();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Google Client Secret").setDesc("Your Google OAuth Client Secret").addText((text) => {
      text.setPlaceholder("GOCSPX-...").setValue(this.plugin.settings.googleClientSecret).onChange(async (value) => {
        this.plugin.settings.googleClientSecret = value;
        await this.plugin.saveSettings();
        await this.plugin.initializeServices();
      });
      text.inputEl.type = "password";
      return text;
    });
    containerEl.createEl("h3", { text: "Gmail Authentication" });
    const authStatusEl = containerEl.createEl("p", {
      text: "\u23F3 Checking authentication status...",
      cls: "mod-warning setting-item-description"
    });
    const checkAuthStatus = () => {
      if (!this.plugin.gmailService) {
        authStatusEl.textContent = "\u274C Gmail service not initialized";
        authStatusEl.className = "mod-warning setting-item-description";
        return;
      }
      if (this.plugin.gmailService.isAuthenticated()) {
        if (this.plugin.gmailService.hasRefreshToken()) {
          authStatusEl.textContent = "\u2705 Authenticated with Gmail";
          authStatusEl.className = "mod-success setting-item-description";
        } else {
          authStatusEl.textContent = "\u26A0\uFE0F Authenticated but missing refresh token";
          authStatusEl.className = "mod-warning setting-item-description";
        }
      } else {
        authStatusEl.textContent = "\u274C Not authenticated with Gmail";
        authStatusEl.className = "mod-warning setting-item-description";
      }
    };
    checkAuthStatus();
    new import_obsidian4.Setting(containerEl).setName("Authenticate with Gmail").setDesc("Click to start the Gmail authentication process").addButton((button) => {
      var _a2;
      const authButton = button;
      if ((_a2 = this.plugin.gmailService) == null ? void 0 : _a2.isAuthenticated()) {
        authButton.setButtonText("Re-authenticate");
      } else {
        authButton.setButtonText("Authenticate");
      }
      authButton.onClick(async () => {
        var _a3;
        if (!this.plugin.gmailService) {
          new import_obsidian4.Notice("Please configure Client ID and Secret first");
          return;
        }
        try {
          if (!this.plugin.oauthServer) {
            this.plugin.oauthServer = new OAuthServer();
          }
          if (!this.plugin.oauthServer.isRunning()) {
            try {
              await this.plugin.oauthServer.start();
              new import_obsidian4.Notice("Starting authentication server...");
            } catch (error) {
              new import_obsidian4.Notice(`Failed to start OAuth server: ${error.message}`);
              return;
            }
          }
          const redirectUri = this.plugin.oauthServer.getRedirectUri();
          this.plugin.gmailService.setCredentials(
            this.plugin.settings.googleClientId,
            this.plugin.settings.googleClientSecret,
            redirectUri
          );
          const authUrl = this.plugin.gmailService.getAuthorizationUrl();
          window.open(authUrl, "_blank");
          const modal = new import_obsidian4.Modal(this.app);
          modal.contentEl.addClass("gmail-auth-modal");
          modal.contentEl.createEl("h2", { text: "\u{1F510} Authenticating with Gmail..." });
          const instructionsEl = modal.contentEl.createDiv("auth-instructions");
          instructionsEl.createEl("p", {
            text: "Please complete the authorization in your browser."
          });
          instructionsEl.createEl("p", {
            text: "This window will close automatically when authentication is complete."
          });
          const loadingEl = modal.contentEl.createDiv("auth-loading");
          loadingEl.style.textAlign = "center";
          loadingEl.style.marginTop = "20px";
          loadingEl.createEl("span", { text: "\u23F3 Waiting for authorization..." });
          const cancelBtn = modal.contentEl.createEl("button", {
            text: "Cancel",
            cls: "auth-cancel-btn"
          });
          cancelBtn.style.marginTop = "20px";
          cancelBtn.onclick = async () => {
            var _a4;
            modal.close();
            await ((_a4 = this.plugin.oauthServer) == null ? void 0 : _a4.stop());
          };
          modal.open();
          try {
            const code = await this.plugin.oauthServer.waitForAuthCode();
            if (!code) {
              new import_obsidian4.Notice("No authorization code received");
              modal.close();
              await this.plugin.oauthServer.stop();
              return;
            }
            modal.close();
            new import_obsidian4.Notice("Processing authentication...");
            await this.plugin.gmailService.exchangeCodeForToken(code);
            new import_obsidian4.Notice("\u2705 Successfully authenticated with Gmail!");
            checkAuthStatus();
            await this.plugin.initializeServices();
            await this.plugin.oauthServer.stop();
            authButton.setButtonText("Re-authenticate");
          } catch (error) {
            modal.close();
            console.error("Authentication error:", error);
            new import_obsidian4.Notice(`Authentication failed: ${error.message}`);
            await ((_a3 = this.plugin.oauthServer) == null ? void 0 : _a3.stop());
          }
        } catch (error) {
          new import_obsidian4.Notice(`Failed to start authentication: ${error.message}`);
        }
      });
    });
    new import_obsidian4.Setting(containerEl).setName("Clear authentication").setDesc("Remove stored Gmail authentication").addButton(
      (button) => button.setButtonText("Clear").setWarning().onClick(async () => {
        var _a2;
        (_a2 = this.plugin.gmailService) == null ? void 0 : _a2.clearAuthentication();
        this.plugin.settings.gmailToken = null;
        await this.plugin.saveSettings();
        new import_obsidian4.Notice("Gmail authentication cleared");
        checkAuthStatus();
      })
    );
    containerEl.createEl("h3", { text: "Email Processing" });
    new import_obsidian4.Setting(containerEl).setName("Lookback time").setDesc("How far back to search. Examples: 6h (6 hours), 3d (3 days), 2w (2 weeks), 1M (1 month)").addText(
      (text) => text.setPlaceholder("5d").setValue(this.plugin.settings.lookbackTime || "5d").onChange(async (value) => {
        const hours = this.plugin.parseTimeToHours(value);
        if (hours > 0) {
          this.plugin.settings.lookbackTime = value;
          this.plugin.settings.lookbackHours = hours;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Gmail Labels").setDesc("Gmail labels to filter emails (comma-separated)").addText(
      (text) => text.setPlaceholder("transcript").setValue(this.plugin.settings.gmailLabels).onChange(async (value) => {
        this.plugin.settings.gmailLabels = value || "transcript";
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Claude AI Settings" });
    new import_obsidian4.Setting(containerEl).setName("Anthropic API Key").setDesc("Your Claude API key for task extraction").addText(
      (text) => text.setPlaceholder("sk-ant-...").setValue(this.plugin.settings.anthropicApiKey).onChange(async (value) => {
        this.plugin.settings.anthropicApiKey = value;
        await this.plugin.saveSettings();
        if (value) {
          this.plugin.claudeExtractor = new ClaudeTaskExtractor(
            value,
            this.plugin.settings.claudeModel
          );
        }
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Claude Model").setDesc("Which Claude model to use").addDropdown(
      (dropdown) => dropdown.addOption("claude-3-5-haiku-20241022", "Claude 3.5 Haiku (Fast & Cheap)").addOption("claude-sonnet-4-20250514", "Claude Sonnet 4 (Balanced)").addOption("claude-opus-4-1-20250805", "Claude Opus 4.1 (Most Capable)").setValue(this.plugin.settings.claudeModel).onChange(async (value) => {
        this.plugin.settings.claudeModel = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Obsidian Settings" });
    new import_obsidian4.Setting(containerEl).setName("Notes folder").setDesc("Where to create meeting notes").addText(
      (text) => text.setPlaceholder("Meetings").setValue(this.plugin.settings.notesFolder).onChange(async (value) => {
        this.plugin.settings.notesFolder = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Dashboard Settings" });
    new import_obsidian4.Setting(containerEl).setName("Show only my tasks").setDesc("Filter dashboard to show only tasks assigned to you").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.dashboardShowOnlyMyTasks).onChange(async (value) => {
        this.plugin.settings.dashboardShowOnlyMyTasks = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("My name(s)").setDesc("Your name(s) for filtering tasks (comma-separated)").addText(
      (text) => text.setPlaceholder("Your name, other name").setValue(this.plugin.settings.dashboardMyName).onChange(async (value) => {
        this.plugin.settings.dashboardMyName = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Notification Settings" });
    new import_obsidian4.Setting(containerEl).setName("Show detailed notifications").setDesc("Show email titles in status messages while processing").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showDetailedNotifications).onChange(async (value) => {
        this.plugin.settings.showDetailedNotifications = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Actions" });
    new import_obsidian4.Setting(containerEl).setName("Process emails now").setDesc("Search for meeting emails and create notes").addButton(
      (button) => button.setButtonText("Process").setCta().onClick(async () => {
        await this.plugin.processEmails();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Reset processed emails").setDesc("Clear the list of already processed emails").addButton(
      (button) => button.setButtonText("Reset").setWarning().onClick(async () => {
        await this.plugin.resetProcessedEmails();
      })
    );
    const statusDiv = containerEl.createDiv("status-info");
    const gmailStatus = ((_a = this.plugin.gmailService) == null ? void 0 : _a.isAuthenticated()) ? "\u2705 Gmail authenticated" : "\u274C Gmail not authenticated";
    const claudeStatus = this.plugin.settings.anthropicApiKey ? "\u2705 Claude AI configured" : "\u26A0\uFE0F Claude AI not configured";
    statusDiv.createEl("p", {
      text: gmailStatus,
      cls: ((_b = this.plugin.gmailService) == null ? void 0 : _b.isAuthenticated()) ? "mod-success" : "mod-warning"
    });
    statusDiv.createEl("p", {
      text: claudeStatus,
      cls: this.plugin.settings.anthropicApiKey ? "mod-success" : "mod-warning"
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2NsYXVkZUV4dHJhY3Rvci50cyIsICIuLi9zcmMvdGFza0Rhc2hib2FyZC50cyIsICIuLi9zcmMvZ21haWxTZXJ2aWNlLnRzIiwgIi4uL3NyYy9vYXV0aFNlcnZlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgUGx1Z2luLFxuICBOb3RpY2UsXG4gIE1vZGFsLFxuICByZXF1ZXN0VXJsLFxuICBhZGRJY29uLFxuICBub3JtYWxpemVQYXRoLFxuICBQbHVnaW5TZXR0aW5nVGFiLFxuICBTZXR0aW5nLFxuICBBcHAsXG4gIFRGaWxlLFxufSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBDbGF1ZGVUYXNrRXh0cmFjdG9yLCBUYXNrRXh0cmFjdGlvblJlc3VsdCB9IGZyb20gJy4vY2xhdWRlRXh0cmFjdG9yJztcbmltcG9ydCB7IFRhc2tEYXNoYm9hcmRWaWV3LCBUQVNLX0RBU0hCT0FSRF9WSUVXX1RZUEUgfSBmcm9tICcuL3Rhc2tEYXNoYm9hcmQnO1xuaW1wb3J0IHsgR21haWxTZXJ2aWNlIH0gZnJvbSAnLi9nbWFpbFNlcnZpY2UnO1xuaW1wb3J0IHsgT0F1dGhTZXJ2ZXIgfSBmcm9tICcuL29hdXRoU2VydmVyJztcblxuaW50ZXJmYWNlIE1lZXRpbmdUYXNrc1NldHRpbmdzIHtcbiAgbG9va2JhY2tUaW1lOiBzdHJpbmc7XG4gIGxvb2tiYWNrSG91cnM6IG51bWJlcjsgLy8gS2VlcCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICBkZWJ1Z01vZGU6IGJvb2xlYW47XG4gIGFudGhyb3BpY0FwaUtleTogc3RyaW5nO1xuICBnb29nbGVDbGllbnRJZDogc3RyaW5nO1xuICBnb29nbGVDbGllbnRTZWNyZXQ6IHN0cmluZztcbiAgbm90ZXNGb2xkZXI6IHN0cmluZztcbiAgY2xhdWRlTW9kZWw6IHN0cmluZztcbiAgZGFzaGJvYXJkU2hvd09ubHlNeVRhc2tzOiBib29sZWFuO1xuICBkYXNoYm9hcmRNeU5hbWU6IHN0cmluZztcbiAgZ21haWxMYWJlbHM6IHN0cmluZztcbiAgZ21haWxUb2tlbj86IGFueTtcbiAgc2hvd0RldGFpbGVkTm90aWZpY2F0aW9uczogYm9vbGVhbjtcbiAgcHJvY2Vzc2VkRW1haWxzPzogc3RyaW5nW107IC8vIFRyYWNrIHdoaWNoIGVtYWlscyBoYXZlIGJlZW4gcHJvY2Vzc2VkXG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE1lZXRpbmdUYXNrc1NldHRpbmdzID0ge1xuICBsb29rYmFja1RpbWU6ICc1ZCcsXG4gIGxvb2tiYWNrSG91cnM6IDEyMCwgLy8gS2VlcCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICBkZWJ1Z01vZGU6IGZhbHNlLFxuICBhbnRocm9waWNBcGlLZXk6ICcnLFxuICBnb29nbGVDbGllbnRJZDogJycsXG4gIGdvb2dsZUNsaWVudFNlY3JldDogJycsXG4gIG5vdGVzRm9sZGVyOiAnTWVldGluZ3MnLFxuICBjbGF1ZGVNb2RlbDogJ2NsYXVkZS0zLTUtaGFpa3UtMjAyNDEwMjInLFxuICBkYXNoYm9hcmRTaG93T25seU15VGFza3M6IHRydWUsXG4gIGRhc2hib2FyZE15TmFtZTogJycsXG4gIGdtYWlsTGFiZWxzOiAndHJhbnNjcmlwdCcsXG4gIGdtYWlsVG9rZW46IG51bGwsXG4gIHNob3dEZXRhaWxlZE5vdGlmaWNhdGlvbnM6IHRydWUsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZWV0aW5nVGFza3NQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogTWVldGluZ1Rhc2tzU2V0dGluZ3M7XG4gIGdtYWlsU2VydmljZTogR21haWxTZXJ2aWNlIHwgbnVsbCA9IG51bGw7XG4gIGNsYXVkZUV4dHJhY3RvcjogQ2xhdWRlVGFza0V4dHJhY3RvciB8IG51bGwgPSBudWxsO1xuICBvYXV0aFNlcnZlcjogT0F1dGhTZXJ2ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0dXNCYXJJdGVtOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGVtYWlsSWRDYWNoZTogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7IC8vIENhY2hlIGZvciBwZXJmb3JtYW5jZVxuXG4gIHBhcnNlVGltZVRvSG91cnModGltZVN0cjogc3RyaW5nKTogbnVtYmVyIHtcbiAgICAvLyBQYXJzZSBmb3JtYXRzIGxpa2UgXCIxaFwiLCBcIjNkXCIsIFwiMndcIiwgXCIxTVwiXG4gICAgY29uc3QgbWF0Y2ggPSB0aW1lU3RyLm1hdGNoKC9eKFxcZCsoPzpcXC5cXGQrKT8pXFxzKihbaGR3TV0/KSQvKTtcblxuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIC8vIElmIG5vIHVuaXQsIGFzc3VtZSBob3VycyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgY29uc3QgbnVtID0gcGFyc2VGbG9hdCh0aW1lU3RyKTtcbiAgICAgIHJldHVybiBpc05hTihudW0pID8gMTIwIDogbnVtO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gICAgY29uc3QgdW5pdCA9IG1hdGNoWzJdIHx8ICdoJztcblxuICAgIHN3aXRjaCAodW5pdCkge1xuICAgICAgY2FzZSAnaCc6IHJldHVybiB2YWx1ZTtcbiAgICAgIGNhc2UgJ2QnOiByZXR1cm4gdmFsdWUgKiAyNDtcbiAgICAgIGNhc2UgJ3cnOiByZXR1cm4gdmFsdWUgKiAyNCAqIDc7XG4gICAgICBjYXNlICdNJzogcmV0dXJuIHZhbHVlICogMjQgKiAzMDsgLy8gQXBwcm94aW1hdGUgbW9udGggYXMgMzAgZGF5c1xuICAgICAgZGVmYXVsdDogcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZvcm1hdFRpbWVTdHJpbmcoaG91cnM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgLy8gQ29udmVydCBob3VycyBiYWNrIHRvIGEgcmVhZGFibGUgZm9ybWF0XG4gICAgaWYgKGhvdXJzIDwgMjQpIHtcbiAgICAgIHJldHVybiBgJHtob3Vyc31oYDtcbiAgICB9IGVsc2UgaWYgKGhvdXJzIDwgMjQgKiA3KSB7XG4gICAgICBjb25zdCBkYXlzID0gTWF0aC5yb3VuZChob3VycyAvIDI0KTtcbiAgICAgIHJldHVybiBgJHtkYXlzfWRgO1xuICAgIH0gZWxzZSBpZiAoaG91cnMgPCAyNCAqIDMwKSB7XG4gICAgICBjb25zdCB3ZWVrcyA9IE1hdGgucm91bmQoaG91cnMgLyAoMjQgKiA3KSk7XG4gICAgICByZXR1cm4gYCR7d2Vla3N9d2A7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG1vbnRocyA9IE1hdGgucm91bmQoaG91cnMgLyAoMjQgKiAzMCkpO1xuICAgICAgcmV0dXJuIGAke21vbnRoc31NYDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBsb2FkRW1haWxJZENhY2hlKCkge1xuICAgIC8vIExvYWQgYWxsIGVtYWlsIElEcyBmcm9tIGV4aXN0aW5nIG1lZXRpbmcgbm90ZXNcbiAgICBjb25zb2xlLmxvZygnW0xvYWRDYWNoZV0gU3RhcnRpbmcgdG8gbG9hZCBlbWFpbCBJRHMgZnJvbSB2YXVsdCBub3Rlcy4uLicpO1xuICAgIHRoaXMuZW1haWxJZENhY2hlLmNsZWFyKCk7XG5cbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgICBjb25zb2xlLmxvZyhgW0xvYWRDYWNoZV0gRm91bmQgJHtmaWxlcy5sZW5ndGh9IHRvdGFsIG1hcmtkb3duIGZpbGVzIGluIHZhdWx0YCk7XG5cbiAgICBsZXQgbWVldGluZ05vdGVDb3VudCA9IDA7XG4gICAgbGV0IGVtYWlsSWRDb3VudCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIC8vIE9ubHkgY2hlY2sgZmlsZXMgaW4gdGhlIG1lZXRpbmdzIGZvbGRlclxuICAgICAgaWYgKCFmaWxlLnBhdGguc3RhcnRzV2l0aCh0aGlzLnNldHRpbmdzLm5vdGVzRm9sZGVyKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgbWVldGluZ05vdGVDb3VudCsrO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgY29uc3QgZnJvbnRtYXR0ZXJNYXRjaCA9IGNvbnRlbnQubWF0Y2goL14tLS1cXG4oW1xcc1xcU10qPylcXG4tLS0vKTtcblxuICAgICAgICBpZiAoZnJvbnRtYXR0ZXJNYXRjaCkge1xuICAgICAgICAgIGNvbnN0IGVtYWlsSWRNYXRjaCA9IGZyb250bWF0dGVyTWF0Y2hbMV0ubWF0Y2goL2VtYWlsSWQ6XFxzKiguKykvKTtcbiAgICAgICAgICBpZiAoZW1haWxJZE1hdGNoICYmIGVtYWlsSWRNYXRjaFsxXSkge1xuICAgICAgICAgICAgY29uc3QgZW1haWxJZCA9IGVtYWlsSWRNYXRjaFsxXS50cmltKCk7XG4gICAgICAgICAgICB0aGlzLmVtYWlsSWRDYWNoZS5hZGQoZW1haWxJZCk7XG4gICAgICAgICAgICBlbWFpbElkQ291bnQrKztcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTG9hZENhY2hlXSBGb3VuZCBlbWFpbElkOiAke2VtYWlsSWR9IGluICR7ZmlsZS5wYXRofWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW0xvYWRDYWNoZV0gRXJyb3IgcmVhZGluZyBmaWxlICR7ZmlsZS5wYXRofTpgLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtMb2FkQ2FjaGVdIFNjYW5uZWQgJHttZWV0aW5nTm90ZUNvdW50fSBtZWV0aW5nIG5vdGVzLCBmb3VuZCAke2VtYWlsSWRDb3VudH0gZW1haWwgSURzYCk7XG4gICAgY29uc29sZS5sb2coYFtMb2FkQ2FjaGVdIENhY2hlIG5vdyBjb250YWlucyAke3RoaXMuZW1haWxJZENhY2hlLnNpemV9IHVuaXF1ZSBlbWFpbCBJRHNgKTtcblxuICAgIC8vIFVwZGF0ZSBzZXR0aW5ncyB3aXRoIHRoZSBsb2FkZWQgZW1haWwgSURzXG4gICAgdGhpcy5zZXR0aW5ncy5wcm9jZXNzZWRFbWFpbHMgPSBBcnJheS5mcm9tKHRoaXMuZW1haWxJZENhY2hlKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIGNvbnNvbGUubG9nKGBbTG9hZENhY2hlXSBTYXZlZCAke3RoaXMuc2V0dGluZ3MucHJvY2Vzc2VkRW1haWxzLmxlbmd0aH0gZW1haWwgSURzIHRvIHNldHRpbmdzYCk7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coJ0xvYWRpbmcgTWVldGluZyBUYXNrcyBQbHVnaW4uLi4nKTtcbiAgICBjb25zb2xlLmxvZygnUGx1Z2luIHZlcnNpb246IDIuMC4wJyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpO1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBkYXRhKTtcblxuICAgIC8vIEhhbmRsZSBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgaWYgKGRhdGE/Lmxvb2tiYWNrSG91cnMgJiYgIWRhdGE/Lmxvb2tiYWNrVGltZSkge1xuICAgICAgdGhpcy5zZXR0aW5ncy5sb29rYmFja1RpbWUgPSB0aGlzLmZvcm1hdFRpbWVTdHJpbmcoZGF0YS5sb29rYmFja0hvdXJzKTtcbiAgICAgIHRoaXMuc2V0dGluZ3MubG9va2JhY2tIb3VycyA9IGRhdGEubG9va2JhY2tIb3VycztcbiAgICB9IGVsc2UgaWYgKHRoaXMuc2V0dGluZ3MubG9va2JhY2tUaW1lKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmxvb2tiYWNrSG91cnMgPSB0aGlzLnBhcnNlVGltZVRvSG91cnModGhpcy5zZXR0aW5ncy5sb29rYmFja1RpbWUpO1xuICAgIH1cblxuICAgIC8vIEluaXRpYWxpemUgY2FjaGUgZnJvbSBzZXR0aW5ncyBmaXJzdCAoZm9yIHF1aWNrIGFjY2VzcylcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5wcm9jZXNzZWRFbWFpbHMpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MucHJvY2Vzc2VkRW1haWxzLmZvckVhY2goaWQgPT4gdGhpcy5lbWFpbElkQ2FjaGUuYWRkKGlkKSk7XG4gICAgICBjb25zb2xlLmxvZyhgW1BsdWdpbl0gTG9hZGVkICR7dGhpcy5lbWFpbElkQ2FjaGUuc2l6ZX0gZW1haWwgSURzIGZyb20gc2V0dGluZ3NgKTtcbiAgICB9XG5cbiAgICAvLyBEZWZlciBsb2FkaW5nIGZyb20gdmF1bHQgdW50aWwgd29ya3NwYWNlIGlzIHJlYWR5XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gTG9hZCBjYWNoZSBvZiBleGlzdGluZyBlbWFpbCBJRHMgZnJvbSB2YXVsdCAod2lsbCB1cGRhdGUgc2V0dGluZ3MpXG4gICAgICBhd2FpdCB0aGlzLmxvYWRFbWFpbElkQ2FjaGUoKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbUGx1Z2luXSBGb3VuZCAke3RoaXMuZW1haWxJZENhY2hlLnNpemV9IGV4aXN0aW5nIG1lZXRpbmcgbm90ZXMgaW4gdmF1bHRgKTtcbiAgICB9KTtcblxuICAgIC8vIFJlZ2lzdGVyIGRlbGV0ZSBldmVudCBoYW5kbGVyIGZvciBtZWV0aW5nIG5vdGVzXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsIGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09ICdtZCcgJiYgZmlsZS5wYXRoLnN0YXJ0c1dpdGgodGhpcy5zZXR0aW5ncy5ub3Rlc0ZvbGRlcikpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlbGV0ZV0gTWVldGluZyBub3RlIGRlbGV0ZWQ6ICR7ZmlsZS5wYXRofWApO1xuXG4gICAgICAgICAgLy8gVHJ5IHRvIGV4dHJhY3QgZW1haWwgSUQgZnJvbSB0aGUgZGVsZXRlZCBmaWxlJ3MgY2FjaGVcbiAgICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgICAgIGlmIChjYWNoZT8uZnJvbnRtYXR0ZXI/LmVtYWlsSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGVtYWlsSWQgPSBjYWNoZS5mcm9udG1hdHRlci5lbWFpbElkO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtEZWxldGVdIFJlbW92aW5nIGVtYWlsSWQgZnJvbSBjYWNoZTogJHtlbWFpbElkfWApO1xuXG4gICAgICAgICAgICAvLyBSZW1vdmUgZnJvbSBjYWNoZVxuICAgICAgICAgICAgdGhpcy5lbWFpbElkQ2FjaGUuZGVsZXRlKGVtYWlsSWQpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgc2V0dGluZ3NcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MucHJvY2Vzc2VkRW1haWxzID0gQXJyYXkuZnJvbSh0aGlzLmVtYWlsSWRDYWNoZSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RlbGV0ZV0gVXBkYXRlZCBjYWNoZSwgbm93IGNvbnRhaW5zICR7dGhpcy5lbWFpbElkQ2FjaGUuc2l6ZX0gZW1haWwgSURzYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBSZWdpc3RlciByZW5hbWUgZXZlbnQgaGFuZGxlciB0byB0cmFjayBtb3ZlZCBmaWxlc1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdyZW5hbWUnLCBhc3luYyAoZmlsZSwgb2xkUGF0aCkgPT4ge1xuICAgICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uID09PSAnbWQnKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgaWYgZmlsZSBtb3ZlZCBvdXQgb2YgbWVldGluZ3MgZm9sZGVyXG4gICAgICAgICAgY29uc3Qgd2FzSW5NZWV0aW5ncyA9IG9sZFBhdGguc3RhcnRzV2l0aCh0aGlzLnNldHRpbmdzLm5vdGVzRm9sZGVyKTtcbiAgICAgICAgICBjb25zdCBub3dJbk1lZXRpbmdzID0gZmlsZS5wYXRoLnN0YXJ0c1dpdGgodGhpcy5zZXR0aW5ncy5ub3Rlc0ZvbGRlcik7XG5cbiAgICAgICAgICBpZiAod2FzSW5NZWV0aW5ncyAmJiAhbm93SW5NZWV0aW5ncykge1xuICAgICAgICAgICAgLy8gRmlsZSBtb3ZlZCBvdXQgb2YgbWVldGluZ3MgZm9sZGVyIC0gcmVtb3ZlIGZyb20gY2FjaGVcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUmVuYW1lXSBGaWxlIG1vdmVkIG91dCBvZiBtZWV0aW5ncyBmb2xkZXI6ICR7b2xkUGF0aH0gLT4gJHtmaWxlLnBhdGh9YCk7XG4gICAgICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgICAgICAgaWYgKGNhY2hlPy5mcm9udG1hdHRlcj8uZW1haWxJZCkge1xuICAgICAgICAgICAgICBjb25zdCBlbWFpbElkID0gY2FjaGUuZnJvbnRtYXR0ZXIuZW1haWxJZDtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtSZW5hbWVdIFJlbW92aW5nIGVtYWlsSWQgZnJvbSBjYWNoZTogJHtlbWFpbElkfWApO1xuXG4gICAgICAgICAgICAgIHRoaXMuZW1haWxJZENhY2hlLmRlbGV0ZShlbWFpbElkKTtcbiAgICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5wcm9jZXNzZWRFbWFpbHMgPSBBcnJheS5mcm9tKHRoaXMuZW1haWxJZENhY2hlKTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtSZW5hbWVdIENhY2hlIHVwZGF0ZWQsIG5vdyBjb250YWlucyAke3RoaXMuZW1haWxJZENhY2hlLnNpemV9IGVtYWlsIElEc2ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtSZW5hbWVdIEZpbGUgaGFzIG5vIGVtYWlsSWQgaW4gZnJvbnRtYXR0ZXIsIHNraXBwaW5nIGNhY2hlIHVwZGF0ZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIXdhc0luTWVldGluZ3MgJiYgbm93SW5NZWV0aW5ncykge1xuICAgICAgICAgICAgLy8gRmlsZSBtb3ZlZCBpbnRvIG1lZXRpbmdzIGZvbGRlciAtIGFkZCB0byBjYWNoZSBpZiBpdCBoYXMgYW4gZW1haWxJZFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtSZW5hbWVdIEZpbGUgbW92ZWQgaW50byBtZWV0aW5ncyBmb2xkZXI6ICR7b2xkUGF0aH0gLT4gJHtmaWxlLnBhdGh9YCk7XG5cbiAgICAgICAgICAgIC8vIFdhaXQgYSBtb21lbnQgZm9yIG1ldGFkYXRhIGNhY2hlIHRvIHVwZGF0ZVxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMCkpO1xuXG4gICAgICAgICAgICAvLyBUcnkgbWV0YWRhdGEgY2FjaGUgZmlyc3QgKG1vcmUgcmVsaWFibGUpXG4gICAgICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgICAgICAgICAgaWYgKGNhY2hlPy5mcm9udG1hdHRlcj8uZW1haWxJZCkge1xuICAgICAgICAgICAgICBjb25zdCBlbWFpbElkID0gY2FjaGUuZnJvbnRtYXR0ZXIuZW1haWxJZDtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtSZW5hbWVdIEFkZGluZyBlbWFpbElkIHRvIGNhY2hlOiAke2VtYWlsSWR9YCk7XG5cbiAgICAgICAgICAgICAgdGhpcy5lbWFpbElkQ2FjaGUuYWRkKGVtYWlsSWQpO1xuICAgICAgICAgICAgICB0aGlzLnNldHRpbmdzLnByb2Nlc3NlZEVtYWlscyA9IEFycmF5LmZyb20odGhpcy5lbWFpbElkQ2FjaGUpO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1JlbmFtZV0gQ2FjaGUgdXBkYXRlZCwgbm93IGNvbnRhaW5zICR7dGhpcy5lbWFpbElkQ2FjaGUuc2l6ZX0gZW1haWwgSURzYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBGYWxsYmFjayB0byByZWFkaW5nIGZpbGUgY29udGVudCBpZiBjYWNoZSBub3QgYXZhaWxhYmxlXG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJvbnRtYXR0ZXJNYXRjaCA9IGNvbnRlbnQubWF0Y2goL14tLS1cXG4oW1xcc1xcU10qPylcXG4tLS0vKTtcblxuICAgICAgICAgICAgICAgIGlmIChmcm9udG1hdHRlck1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbWFpbElkTWF0Y2ggPSBmcm9udG1hdHRlck1hdGNoWzFdLm1hdGNoKC9lbWFpbElkOlxccyooLispLyk7XG4gICAgICAgICAgICAgICAgICBpZiAoZW1haWxJZE1hdGNoICYmIGVtYWlsSWRNYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbWFpbElkID0gZW1haWxJZE1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtSZW5hbWVdIEFkZGluZyBlbWFpbElkIHRvIGNhY2hlIChmcm9tIGZpbGUgY29udGVudCk6ICR7ZW1haWxJZH1gKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtYWlsSWRDYWNoZS5hZGQoZW1haWxJZCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MucHJvY2Vzc2VkRW1haWxzID0gQXJyYXkuZnJvbSh0aGlzLmVtYWlsSWRDYWNoZSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUmVuYW1lXSBDYWNoZSB1cGRhdGVkLCBub3cgY29udGFpbnMgJHt0aGlzLmVtYWlsSWRDYWNoZS5zaXplfSBlbWFpbCBJRHNgKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUmVuYW1lXSBGaWxlIGhhcyBubyBlbWFpbElkIGluIGZyb250bWF0dGVyLCBub3QgYWRkaW5nIHRvIGNhY2hlYCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUmVuYW1lXSBGaWxlIGhhcyBubyBmcm9udG1hdHRlciwgbm90IGFkZGluZyB0byBjYWNoZWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbUmVuYW1lXSBFcnJvciByZWFkaW5nIGZpbGUgY29udGVudDpgLCBlcnJvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFJlZ2lzdGVyIHByb3RvY29sIGhhbmRsZXIgZm9yIE9BdXRoIGNhbGxiYWNrXG4gICAgdGhpcy5yZWdpc3Rlck9ic2lkaWFuUHJvdG9jb2xIYW5kbGVyKCdtZWV0aW5nLXRhc2tzLW9hdXRoJywgYXN5bmMgKHBhcmFtcykgPT4ge1xuICAgICAgaWYgKHBhcmFtcy5jb2RlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKCF0aGlzLmdtYWlsU2VydmljZSkge1xuICAgICAgICAgICAgbmV3IE5vdGljZSgnR21haWwgc2VydmljZSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCB0aGlzLmdtYWlsU2VydmljZS5leGNoYW5nZUNvZGVGb3JUb2tlbihwYXJhbXMuY29kZSk7XG4gICAgICAgICAgbmV3IE5vdGljZSgnXHUyNzA1IFN1Y2Nlc3NmdWxseSBhdXRoZW50aWNhdGVkIHdpdGggR21haWwhJyk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplU2VydmljZXMoKTtcblxuICAgICAgICAgIC8vIFVwZGF0ZSBhbnkgb3BlbiBzZXR0aW5ncyB0YWJzXG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoJ21lZXRpbmctdGFza3M6YXV0aC1jb21wbGV0ZScpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIG5ldyBOb3RpY2UoYEF1dGhlbnRpY2F0aW9uIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ09BdXRoIGNhbGxiYWNrIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwYXJhbXMuZXJyb3IpIHtcbiAgICAgICAgbmV3IE5vdGljZShgQXV0aGVudGljYXRpb24gZmFpbGVkOiAke3BhcmFtcy5lcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGFkZEljb24oXG4gICAgICAnbWFpbC1jaGVjaycsXG4gICAgICAnPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIxMDBcIiBoZWlnaHQ9XCIxMDBcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIk0yMiAxM1Y2YTIgMiAwIDAgMC0yLTJINGEyIDIgMCAwIDAtMiAydjEyYzAgMS4xLjkgMiAyIDJoOFwiLz48cGF0aCBkPVwibTIyIDctOC45NyA1LjdhMS45NCAxLjk0IDAgMCAxLTIuMDYgMEwyIDdcIi8+PHBhdGggZD1cIm0xNiAxOSAyIDIgNC00XCIvPjwvc3ZnPidcbiAgICApO1xuXG4gICAgY29uc3QgcmliYm9uSWNvbkVsID0gdGhpcy5hZGRSaWJib25JY29uKCdtYWlsLWNoZWNrJywgJ1Byb2Nlc3MgbWVldGluZyBlbWFpbHMnLCBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB0aGlzLnByb2Nlc3NFbWFpbHMoKTtcbiAgICB9KTtcblxuICAgIHRoaXMuc3RhdHVzQmFySXRlbSA9IHRoaXMuYWRkU3RhdHVzQmFySXRlbSgpO1xuICAgIHRoaXMudXBkYXRlU3RhdHVzKCdSZWFkeScpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAncHJvY2Vzcy1tZWV0aW5nLWVtYWlscycsXG4gICAgICBuYW1lOiAnXHVEODNEXHVEQ0U3IFByb2Nlc3MgbWVldGluZyBlbWFpbHMgbm93JyxcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMucHJvY2Vzc0VtYWlscygpO1xuICAgICAgfSxcbiAgICAgIGhvdGtleXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG1vZGlmaWVyczogWydNb2QnLCAnU2hpZnQnXSxcbiAgICAgICAgICBrZXk6ICdNJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLXRhc2stZGFzaGJvYXJkJyxcbiAgICAgIG5hbWU6ICdPcGVuIHRhc2sgZGFzaGJvYXJkJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMub3BlblRhc2tEYXNoYm9hcmQoKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdxdWljay1wcm9jZXNzLWVtYWlscycsXG4gICAgICBuYW1lOiAnXHUyNkExIFF1aWNrIHByb2Nlc3MgKGxhc3QgMjQgaG91cnMpJyxcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsTG9va2JhY2sgPSB0aGlzLnNldHRpbmdzLmxvb2tiYWNrVGltZTtcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5sb29rYmFja1RpbWUgPSAnMjRoJztcbiAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzRW1haWxzKCk7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MubG9va2JhY2tUaW1lID0gb3JpZ2luYWxMb29rYmFjaztcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdyZXNldC1wcm9jZXNzZWQtZW1haWxzJyxcbiAgICAgIG5hbWU6ICdSZXNldCBwcm9jZXNzZWQgZW1haWxzJyxcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVzZXRQcm9jZXNzZWRFbWFpbHMoKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdyZXByb2Nlc3MtbWVldGluZy1ub3RlJyxcbiAgICAgIG5hbWU6ICdcdUQ4M0RcdUREMDQgUmVwcm9jZXNzIGN1cnJlbnQgbWVldGluZyBub3RlJyxcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVwcm9jZXNzQ3VycmVudE1lZXRpbmdOb3RlKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAncmVwcm9jZXNzLWVtYWlsLWJ5LWlkJyxcbiAgICAgIG5hbWU6ICdcdUQ4M0RcdURDRTcgUmVwcm9jZXNzIGVtYWlsIGJ5IElEJyxcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIEZvciBub3csIGxldCdzIHJlcHJvY2VzcyB0aGUgc3BlY2lmaWMgZW1haWwgd2UncmUgdGVzdGluZ1xuICAgICAgICBhd2FpdCB0aGlzLnJlcHJvY2Vzc0VtYWlsQnlJZCgnMTk5NWNiYjc0MTVjMDE1ZicpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFRBU0tfREFTSEJPQVJEX1ZJRVdfVFlQRSwgbGVhZiA9PiBuZXcgVGFza0Rhc2hib2FyZFZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKCdsYXlvdXQtZGFzaGJvYXJkJywgJ09wZW4gdGFzayBkYXNoYm9hcmQnLCAoKSA9PiB7XG4gICAgICB0aGlzLm9wZW5UYXNrRGFzaGJvYXJkKCk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVTZXJ2aWNlcygpO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNZWV0aW5nVGFza3NTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gIH1cblxuICBhc3luYyBpbml0aWFsaXplU2VydmljZXMoKSB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuZ21haWxTZXJ2aWNlID0gbmV3IEdtYWlsU2VydmljZShcbiAgICAgICAgKCkgPT4gdGhpcy5zZXR0aW5ncy5nbWFpbFRva2VuLFxuICAgICAgICBhc3luYyAodG9rZW4pID0+IHtcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmdtYWlsVG9rZW4gPSB0b2tlbjtcbiAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5nb29nbGVDbGllbnRJZCAmJiB0aGlzLnNldHRpbmdzLmdvb2dsZUNsaWVudFNlY3JldCkge1xuICAgICAgICB0aGlzLmdtYWlsU2VydmljZS5zZXRDcmVkZW50aWFscyhcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmdvb2dsZUNsaWVudElkLFxuICAgICAgICAgIHRoaXMuc2V0dGluZ3MuZ29vZ2xlQ2xpZW50U2VjcmV0XG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKHRoaXMuZ21haWxTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgY29uc3QgY29ubmVjdGVkID0gYXdhaXQgdGhpcy5nbWFpbFNlcnZpY2UudGVzdENvbm5lY3Rpb24oKTtcbiAgICAgICAgICBpZiAoY29ubmVjdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR21haWwgY29ubmVjdGVkJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdHbWFpbCBhdXRoIG5lZWRlZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR21haWwgbm90IGF1dGhlbnRpY2F0ZWQnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ0dtYWlsIHNldHVwIG5lZWRlZCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5hbnRocm9waWNBcGlLZXkpIHtcbiAgICAgICAgdGhpcy5jbGF1ZGVFeHRyYWN0b3IgPSBuZXcgQ2xhdWRlVGFza0V4dHJhY3RvcihcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmFudGhyb3BpY0FwaUtleSxcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmNsYXVkZU1vZGVsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBpbml0aWFsaXplIHNlcnZpY2VzOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcHJvY2Vzc0VtYWlscygpIHtcbiAgICBjb25zb2xlLmxvZygnW3Byb2Nlc3NFbWFpbHNdIFN0YXJ0aW5nIGVtYWlsIHByb2Nlc3NpbmcnKTtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnXHVEODNEXHVERDA0IFN0YXJ0aW5nIGVtYWlsIHByb2Nlc3NpbmcuLi4nKTtcbiAgICAgIG5ldyBOb3RpY2UoJ1x1RDgzRFx1RENFNyBTdGFydGluZyBlbWFpbCBwcm9jZXNzaW5nLi4uJyk7XG5cbiAgICAgIC8vIEVuc3VyZSBjYWNoZSBpcyBsb2FkZWQgZnJvbSB2YXVsdFxuICAgICAgaWYgKHRoaXMuZW1haWxJZENhY2hlLnNpemUgPT09IDAgJiYgdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1twcm9jZXNzRW1haWxzXSBDYWNoZSBlbXB0eSwgbG9hZGluZyBmcm9tIHZhdWx0Li4uJyk7XG4gICAgICAgIGF3YWl0IHRoaXMubG9hZEVtYWlsSWRDYWNoZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuZ21haWxTZXJ2aWNlKSB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdcdTI3NEMgR21haWwgc2VydmljZSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgbmV3IE5vdGljZSgnR21haWwgc2VydmljZSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuZ21haWxTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdcdTI3NEMgTm90IGF1dGhlbnRpY2F0ZWQnKTtcbiAgICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIGF1dGhlbnRpY2F0ZSB3aXRoIEdtYWlsIGZpcnN0IChzZWUgcGx1Z2luIHNldHRpbmdzKScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxvb2tiYWNrSG91cnMgPSB0aGlzLnBhcnNlVGltZVRvSG91cnModGhpcy5zZXR0aW5ncy5sb29rYmFja1RpbWUpO1xuXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgXHVEODNEXHVERDBEIFNlYXJjaGluZyBlbWFpbHMgKCR7dGhpcy5zZXR0aW5ncy5sb29rYmFja1RpbWV9KS4uLmApO1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgYFx1RDgzRFx1REQwNCBTZWFyY2hpbmcgZm9yIG1lZXRpbmcgZW1haWxzIGZyb20gdGhlIGxhc3QgJHt0aGlzLnNldHRpbmdzLmxvb2tiYWNrVGltZX0uLi5gXG4gICAgICApO1xuXG4gICAgICBjb25zdCBlbWFpbHMgPSBhd2FpdCB0aGlzLmdtYWlsU2VydmljZS5mZXRjaFJlY2VudE1lZXRpbmdFbWFpbHMoXG4gICAgICAgIGxvb2tiYWNrSG91cnMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MuZ21haWxMYWJlbHNcbiAgICAgICk7XG5cbiAgICAgIGlmIChlbWFpbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdcdTI3MDUgTm8gbmV3IGVtYWlscyBmb3VuZCcpO1xuICAgICAgICBuZXcgTm90aWNlKGBcdTI3MDUgTm8gbWVldGluZyBlbWFpbHMgZm91bmQgaW4gdGhlIGxhc3QgJHt0aGlzLnNldHRpbmdzLmxvb2tiYWNrVGltZX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgXHVEODNEXHVEQ0NBIEZvdW5kICR7ZW1haWxzLmxlbmd0aH0gZW1haWxzYCk7XG4gICAgICBuZXcgTm90aWNlKGBcdUQ4M0RcdURDQ0EgRm91bmQgJHtlbWFpbHMubGVuZ3RofSBtZWV0aW5nIGVtYWlscy4gUHJvY2Vzc2luZy4uLmApO1xuXG4gICAgICBsZXQgbm90ZXNDcmVhdGVkID0gMDtcbiAgICAgIGxldCB0b3RhbFRhc2tzID0gMDtcbiAgICAgIGxldCBoaWdoUHJpb3JpdHlUYXNrcyA9IDA7XG4gICAgICBsZXQgcHJvY2Vzc2VkQ291bnQgPSAwO1xuICAgICAgbGV0IHNraXBwZWRDb3VudCA9IDA7XG5cbiAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gQ2FjaGUgY29udGFpbnMgJHt0aGlzLmVtYWlsSWRDYWNoZS5zaXplfSBwcm9jZXNzZWQgZW1haWwgSURzYCk7XG4gICAgICBjb25zb2xlLmxvZyhgW1Byb2Nlc3NdIEZpcnN0IDUgY2FjaGUgZW50cmllczpgLCBBcnJheS5mcm9tKHRoaXMuZW1haWxJZENhY2hlKS5zbGljZSgwLCA1KSk7XG5cbiAgICAgIGNvbnN0IGVtYWlsc1RvUHJvY2VzcyA9IGVtYWlscy5maWx0ZXIoZW1haWwgPT4ge1xuICAgICAgICBpZiAodGhpcy5lbWFpbElkQ2FjaGUuaGFzKGVtYWlsLmlkKSkge1xuICAgICAgICAgIHNraXBwZWRDb3VudCsrO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gU2tpcHBpbmcgYWxyZWFkeSBwcm9jZXNzZWQgZW1haWw6ICR7ZW1haWwuaWR9IC0gXCIke2VtYWlsLnN1YmplY3R9XCJgKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coYFtQcm9jZXNzXSBXaWxsIHByb2Nlc3MgbmV3IGVtYWlsOiAke2VtYWlsLmlkfSAtIFwiJHtlbWFpbC5zdWJqZWN0fVwiYCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gUHJvY2Vzc2luZyAke2VtYWlsc1RvUHJvY2Vzcy5sZW5ndGh9IG5ldyBlbWFpbHMgKCR7c2tpcHBlZENvdW50fSBza2lwcGVkKWApO1xuXG4gICAgICBjb25zdCBiYXRjaFNpemUgPSAzO1xuICAgICAgY29uc3QgdG90YWxCYXRjaGVzID0gTWF0aC5jZWlsKGVtYWlsc1RvUHJvY2Vzcy5sZW5ndGggLyBiYXRjaFNpemUpO1xuICAgICAgY29uc29sZS5sb2coYFtQcm9jZXNzXSBXaWxsIHByb2Nlc3MgaW4gJHt0b3RhbEJhdGNoZXN9IGJhdGNoZXMgb2YgdXAgdG8gJHtiYXRjaFNpemV9IGVtYWlscyBlYWNoYCk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW1haWxzVG9Qcm9jZXNzLmxlbmd0aDsgaSArPSBiYXRjaFNpemUpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSBlbWFpbHNUb1Byb2Nlc3Muc2xpY2UoaSwgaSArIGJhdGNoU2l6ZSk7XG4gICAgICAgIGNvbnN0IGJhdGNoTnVtID0gTWF0aC5mbG9vcihpIC8gYmF0Y2hTaXplKSArIDE7XG5cbiAgICAgICAgY29uc3QgYmF0Y2hUaXRsZXMgPSBiYXRjaC5tYXAoZSA9PiBlLnN1YmplY3QgfHwgJ1VudGl0bGVkJykuam9pbignLCAnKTtcbiAgICAgICAgY29uc3Qgc3RhdHVzTXNnID0gdGhpcy5zZXR0aW5ncy5zaG93RGV0YWlsZWROb3RpZmljYXRpb25zXG4gICAgICAgICAgPyBgXHVEODNEXHVEQ0REIFByb2Nlc3Npbmc6ICR7YmF0Y2hUaXRsZXMuc3Vic3RyaW5nKDAsIDUwKX0ke2JhdGNoVGl0bGVzLmxlbmd0aCA+IDUwID8gJy4uLicgOiAnJ31gXG4gICAgICAgICAgOiBgXHVEODNEXHVEQ0REIFByb2Nlc3NpbmcgYmF0Y2ggJHtiYXRjaE51bX0vJHt0b3RhbEJhdGNoZXN9ICgke2JhdGNoLmxlbmd0aH0gZW1haWxzKS4uLmA7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKHN0YXR1c01zZyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coYFxcbltQcm9jZXNzXSA9PT0gU3RhcnRpbmcgQmF0Y2ggJHtiYXRjaE51bX0vJHt0b3RhbEJhdGNoZXN9ID09PWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1Byb2Nlc3NdIEJhdGNoIGNvbnRhaW5zICR7YmF0Y2gubGVuZ3RofSBlbWFpbHM6YCk7XG4gICAgICAgIGJhdGNoLmZvckVhY2goKGVtYWlsLCBpZHgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1Byb2Nlc3NdICAgJHtpZHggKyAxfS4gJHtlbWFpbC5zdWJqZWN0IHx8ICdObyBzdWJqZWN0J30gKElEOiAke2VtYWlsLmlkfSlgKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtQcm9jZXNzXSBTdGFydGluZyBwYXJhbGxlbCBwcm9jZXNzaW5nIGF0ICR7bmV3IERhdGUoc3RhcnRUaW1lKS50b0lTT1N0cmluZygpfWApO1xuXG4gICAgICAgIGNvbnN0IGJhdGNoUHJvbWlzZXMgPSBiYXRjaC5tYXAoYXN5bmMgKGVtYWlsLCBpZHgpID0+IHtcbiAgICAgICAgICBjb25zdCBlbWFpbFN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtQcm9jZXNzXSBTdGFydGluZyBlbWFpbCAke2lkeCArIDF9LyR7YmF0Y2gubGVuZ3RofTogJHtlbWFpbC5pZH1gKTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnByb2Nlc3NUcmFuc2NyaXB0RW1haWwoZW1haWwpO1xuICAgICAgICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBlbWFpbFN0YXJ0VGltZTtcblxuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3NNc2cgPSB0aGlzLnNldHRpbmdzLnNob3dEZXRhaWxlZE5vdGlmaWNhdGlvbnMgJiYgcmVzdWx0LmVtYWlsVGl0bGVcbiAgICAgICAgICAgICAgICA/IGBbUHJvY2Vzc10gXHUyNzA1IFwiJHtyZXN1bHQuZW1haWxUaXRsZX1cIiBzdWNjZWVkZWQgaW4gJHtlbGFwc2VkfW1zICgke3Jlc3VsdC50YXNrQ291bnR9IHRhc2tzLCAke3Jlc3VsdC5jb25maWRlbmNlfSUgY29uZmlkZW5jZSlgXG4gICAgICAgICAgICAgICAgOiBgW1Byb2Nlc3NdIFx1MjcwNSBFbWFpbCAke2lkeCArIDF9IHN1Y2NlZWRlZCBpbiAke2VsYXBzZWR9bXMgKCR7cmVzdWx0LnRhc2tDb3VudH0gdGFza3MsICR7cmVzdWx0LmNvbmZpZGVuY2V9JSBjb25maWRlbmNlKWA7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKHN1Y2Nlc3NNc2cpO1xuICAgICAgICAgICAgICAvLyBOb3RlOiBXZSBkb24ndCBhZGQgdG8gY2FjaGUgaGVyZSBhcyBjcmVhdGVNZWV0aW5nTm90ZSBoYW5kbGVzIGl0XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBmYWlsTXNnID0gdGhpcy5zZXR0aW5ncy5zaG93RGV0YWlsZWROb3RpZmljYXRpb25zICYmIGVtYWlsLnN1YmplY3RcbiAgICAgICAgICAgICAgICA/IGBbUHJvY2Vzc10gXHUyNzRDIFwiJHtlbWFpbC5zdWJqZWN0LnN1YnN0cmluZygwLCA1MCl9XCIgZmFpbGVkIGluICR7ZWxhcHNlZH1tc2BcbiAgICAgICAgICAgICAgICA6IGBbUHJvY2Vzc10gXHUyNzRDIEVtYWlsICR7aWR4ICsgMX0gZmFpbGVkIGluICR7ZWxhcHNlZH1tc2A7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGZhaWxNc2cpO1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBlbWFpbFN0YXJ0VGltZTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcm9jZXNzXSBcdTI3NEMgRW1haWwgJHtpZHggKyAxfSBlcnJvcmVkIGluICR7ZWxhcHNlZH1tczpgLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gV2FpdGluZyBmb3IgYWxsICR7YmF0Y2gubGVuZ3RofSBlbWFpbHMgdG8gY29tcGxldGUuLi5gKTtcbiAgICAgICAgY29uc3QgYmF0Y2hSZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2hQcm9taXNlcyk7XG4gICAgICAgIGNvbnN0IGJhdGNoRWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG5cbiAgICAgICAgY29uc3Qgc3VjY2Vzc0NvdW50ID0gYmF0Y2hSZXN1bHRzLmZpbHRlcihyID0+IHIgJiYgci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gQmF0Y2ggJHtiYXRjaE51bX0gY29tcGxldGU6ICR7c3VjY2Vzc0NvdW50fS8ke2JhdGNoLmxlbmd0aH0gc3VjY2Vzc2Z1bCBpbiAke2JhdGNoRWxhcHNlZH1tc2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1Byb2Nlc3NdIEF2ZXJhZ2UgdGltZSBwZXIgZW1haWw6ICR7TWF0aC5yb3VuZChiYXRjaEVsYXBzZWQgLyBiYXRjaC5sZW5ndGgpfW1zYCk7XG5cbiAgICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgYmF0Y2hSZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbm90ZXNDcmVhdGVkKys7XG4gICAgICAgICAgICB0b3RhbFRhc2tzICs9IHJlc3VsdC50YXNrQ291bnQgfHwgMDtcbiAgICAgICAgICAgIGhpZ2hQcmlvcml0eVRhc2tzICs9IHJlc3VsdC5oaWdoUHJpb3JpdHlDb3VudCB8fCAwO1xuICAgICAgICAgICAgcHJvY2Vzc2VkQ291bnQrKztcblxuICAgICAgICAgICAgaWYgKHJlc3VsdC50YXNrQ291bnQgJiYgcmVzdWx0LnRhc2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Muc2hvd0RldGFpbGVkTm90aWZpY2F0aW9ucyAmJiByZXN1bHQuZW1haWxUaXRsZSkge1xuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoYFx1MjcwNSAke3Jlc3VsdC5lbWFpbFRpdGxlfTogJHtyZXN1bHQudGFza0NvdW50fSB0YXNrcyBleHRyYWN0ZWRgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKGBcdTI3MDUgQmF0Y2ggJHtiYXRjaE51bX06IENyZWF0ZWQgbm90ZSB3aXRoICR7cmVzdWx0LnRhc2tDb3VudH0gdGFza3NgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZyhgXFxuW1Byb2Nlc3NdID09PSBQcm9jZXNzaW5nIENvbXBsZXRlID09PWApO1xuICAgICAgY29uc29sZS5sb2coYFtQcm9jZXNzXSBOb3RlcyBjcmVhdGVkOiAke25vdGVzQ3JlYXRlZH1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gVG90YWwgdGFza3M6ICR7dG90YWxUYXNrc31gKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbUHJvY2Vzc10gSGlnaCBwcmlvcml0eSB0YXNrczogJHtoaWdoUHJpb3JpdHlUYXNrc31gKTtcblxuICAgICAgLy8gTm8gbmVlZCB0byBzYXZlIHByb2Nlc3NlZCBlbWFpbHMgLSB0aGV5J3JlIHRyYWNrZWQgYnkgZXhpc3Rpbmcgbm90ZXNcblxuICAgICAgaWYgKHNraXBwZWRDb3VudCA+IDAgJiYgbm90ZXNDcmVhdGVkID09PSAwKSB7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBcdTI3MDUgQWxsICR7c2tpcHBlZENvdW50fSBlbWFpbHMgYWxyZWFkeSBwcm9jZXNzZWRgKTtcbiAgICAgICAgbmV3IE5vdGljZShgXHUyNzA1IEFsbCAke3NraXBwZWRDb3VudH0gZW1haWxzIHdlcmUgYWxyZWFkeSBwcm9jZXNzZWRgKTtcbiAgICAgIH0gZWxzZSBpZiAobm90ZXNDcmVhdGVkID4gMCkge1xuICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgXHUyNzA1IENyZWF0ZWQgJHtub3Rlc0NyZWF0ZWR9IG5vdGVzICgke3RvdGFsVGFza3N9IHRhc2tzKWApO1xuICAgICAgICBsZXQgbWVzc2FnZSA9IGBcdTI3MDUgU3VjY2Vzc2Z1bGx5IGNyZWF0ZWQgJHtub3Rlc0NyZWF0ZWR9IG1lZXRpbmcgbm90ZXMgd2l0aCAke3RvdGFsVGFza3N9IHRhc2tzYDtcbiAgICAgICAgaWYgKGhpZ2hQcmlvcml0eVRhc2tzID4gMCkge1xuICAgICAgICAgIG1lc3NhZ2UgKz0gYCAoJHtoaWdoUHJpb3JpdHlUYXNrc30gaGlnaCBwcmlvcml0eSlgO1xuICAgICAgICB9XG4gICAgICAgIG5ldyBOb3RpY2UobWVzc2FnZSwgNTAwMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnXHUyNzA1IFByb2Nlc3NpbmcgY29tcGxldGUnKTtcbiAgICAgICAgbmV3IE5vdGljZSgnXHUyNzA1IEVtYWlsIHByb2Nlc3NpbmcgY29tcGxldGUgKG5vIG5ldyBub3RlcyBjcmVhdGVkKScpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBwcm9jZXNzaW5nIGVtYWlsczonLCBlcnJvcik7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnXHUyNzRDIEVycm9yIHByb2Nlc3NpbmcgZW1haWxzJyk7XG4gICAgICBuZXcgTm90aWNlKGBcdTI3NEMgRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NUcmFuc2NyaXB0RW1haWwoZW1haWw6IGFueSk6IFByb21pc2U8e1xuICAgIHN1Y2Nlc3M6IGJvb2xlYW47XG4gICAgdGFza0NvdW50PzogbnVtYmVyO1xuICAgIGhpZ2hQcmlvcml0eUNvdW50PzogbnVtYmVyO1xuICAgIGNvbmZpZGVuY2U/OiBudW1iZXI7XG4gICAgb2JzaWRpYW5QYXRoPzogc3RyaW5nO1xuICAgIGVtYWlsVGl0bGU/OiBzdHJpbmc7XG4gIH0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFtFeHRyYWN0XSBTdGFydGluZyBwcm9jZXNzaW5nIGZvcjogJHtlbWFpbC5zdWJqZWN0fSAoSUQ6ICR7ZW1haWwuaWR9KWApO1xuXG4gICAgICBsZXQgZW1haWxDb250ZW50ID0gZW1haWwuYm9keTtcbiAgICAgIGlmICh0eXBlb2YgZW1haWxDb250ZW50ID09PSAnb2JqZWN0Jykge1xuICAgICAgICBlbWFpbENvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShlbWFpbENvbnRlbnQpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVtYWlsQ29udGVudCB8fCBlbWFpbENvbnRlbnQgPT09ICd7fScgfHwgZW1haWxDb250ZW50ID09PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgICAgICBjb25zb2xlLndhcm4oJ05vIHZhbGlkIGVtYWlsIGNvbnRlbnQgYXZhaWxhYmxlJyk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgICB9XG5cbiAgICAgIGxldCBleHRyYWN0aW9uOiBUYXNrRXh0cmFjdGlvblJlc3VsdDtcblxuICAgICAgaWYgKHRoaXMuY2xhdWRlRXh0cmFjdG9yICYmIHRoaXMuc2V0dGluZ3MuYW50aHJvcGljQXBpS2V5KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbRXh0cmFjdF0gU3RhcnRpbmcgQ2xhdWRlIEFJIGV4dHJhY3Rpb24gZm9yIGVtYWlsICR7ZW1haWwuaWR9Li4uYCk7XG4gICAgICAgIGNvbnN0IGFpU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgZXh0cmFjdGlvbiA9IGF3YWl0IHRoaXMuY2xhdWRlRXh0cmFjdG9yLmV4dHJhY3RUYXNrcyhlbWFpbENvbnRlbnQsIGVtYWlsLnN1YmplY3QpO1xuICAgICAgICBjb25zdCBhaUVsYXBzZWQgPSBEYXRlLm5vdygpIC0gYWlTdGFydFRpbWU7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbRXh0cmFjdF0gQ2xhdWRlIGV4dHJhY3Rpb24gY29tcGxldGUgaW4gJHthaUVsYXBzZWR9bXM6ICR7ZXh0cmFjdGlvbi50YXNrcy5sZW5ndGh9IHRhc2tzIHdpdGggJHtleHRyYWN0aW9uLmNvbmZpZGVuY2V9JSBjb25maWRlbmNlYFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vIENsYXVkZSBBUEkga2V5LCBza2lwcGluZyB0YXNrIGV4dHJhY3Rpb24nKTtcbiAgICAgICAgZXh0cmFjdGlvbiA9IHtcbiAgICAgICAgICB0YXNrczogW10sXG4gICAgICAgICAgc3VtbWFyeTogZW1haWwuc3ViamVjdCB8fCAnTWVldGluZyBub3RlcycsXG4gICAgICAgICAgcGFydGljaXBhbnRzOiBbXSxcbiAgICAgICAgICBtZWV0aW5nRGF0ZTogZW1haWwuZGF0ZSA/IG5ldyBEYXRlKGVtYWlsLmRhdGUpIDogbmV3IERhdGUoKSxcbiAgICAgICAgICBrZXlEZWNpc2lvbnM6IFtdLFxuICAgICAgICAgIG5leHRTdGVwczogW10sXG4gICAgICAgICAgY29uZmlkZW5jZTogMCxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgbm90ZUNyZWF0ZWQgPSBhd2FpdCB0aGlzLmNyZWF0ZU1lZXRpbmdOb3RlKGVtYWlsLCBleHRyYWN0aW9uKTtcblxuICAgICAgaWYgKG5vdGVDcmVhdGVkKSB7XG4gICAgICAgIGNvbnN0IGhpZ2hQcmlvcml0eUNvdW50ID0gZXh0cmFjdGlvbi50YXNrcy5maWx0ZXIodCA9PiB0LnByaW9yaXR5ID09PSAnaGlnaCcpLmxlbmd0aDtcbiAgICAgICAgY29uc3QgZW1haWxUaXRsZSA9IGVtYWlsLnN1YmplY3QgfHwgJ1VudGl0bGVkJztcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgdGFza0NvdW50OiBleHRyYWN0aW9uLnRhc2tzLmxlbmd0aCxcbiAgICAgICAgICBoaWdoUHJpb3JpdHlDb3VudCxcbiAgICAgICAgICBjb25maWRlbmNlOiBleHRyYWN0aW9uLmNvbmZpZGVuY2UsXG4gICAgICAgICAgb2JzaWRpYW5QYXRoOiBub3RlQ3JlYXRlZCxcbiAgICAgICAgICBlbWFpbFRpdGxlOiBlbWFpbFRpdGxlLnN1YnN0cmluZygwLCA1MCksXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBwcm9jZXNzIHRyYW5zY3JpcHQgZW1haWw6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZU1lZXRpbmdOb3RlKFxuICAgIGVtYWlsOiBhbnksXG4gICAgZXh0cmFjdGlvbjogVGFza0V4dHJhY3Rpb25SZXN1bHRcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCBmYWxzZT4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBDcmVhdGUgeWVhci9tb250aCBmb2xkZXIgc3RydWN0dXJlXG4gICAgICBjb25zdCB5ZWFyID0gZXh0cmFjdGlvbi5tZWV0aW5nRGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgY29uc3QgbW9udGggPSBTdHJpbmcoZXh0cmFjdGlvbi5tZWV0aW5nRGF0ZS5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgIGNvbnN0IGZvbGRlclBhdGggPSBub3JtYWxpemVQYXRoKGAke3RoaXMuc2V0dGluZ3Mubm90ZXNGb2xkZXJ9LyR7eWVhcn0vJHttb250aH1gKTtcblxuICAgICAgLy8gRW5zdXJlIGZvbGRlciBzdHJ1Y3R1cmUgZXhpc3RzXG4gICAgICBjb25zdCB5ZWFyRm9sZGVyID0gbm9ybWFsaXplUGF0aChgJHt0aGlzLnNldHRpbmdzLm5vdGVzRm9sZGVyfS8ke3llYXJ9YCk7XG4gICAgICBpZiAoIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh5ZWFyRm9sZGVyKSkge1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIoeWVhckZvbGRlcik7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmb2xkZXJQYXRoKSkge1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIoZm9sZGVyUGF0aCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGUgPSBleHRyYWN0aW9uLm1lZXRpbmdEYXRlLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXTtcbiAgICAgIGNvbnN0IHN1YmplY3QgPSAoZW1haWwuc3ViamVjdCB8fCAnTWVldGluZycpLnJlcGxhY2UoL1tcXFxcLzoqP1wiPD58XS9nLCAnLScpLnN1YnN0cmluZygwLCA1MCk7XG4gICAgICBjb25zdCBmaWxlTmFtZSA9IGAke2RhdGV9IC0gJHtzdWJqZWN0fS5tZGA7XG4gICAgICBjb25zdCBmaWxlUGF0aCA9IG5vcm1hbGl6ZVBhdGgoYCR7Zm9sZGVyUGF0aH0vJHtmaWxlTmFtZX1gKTtcblxuICAgICAgaWYgKHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vdGUgYWxyZWFkeSBleGlzdHM6JywgZmlsZVBhdGgpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGxldCBub3RlQ29udGVudCA9IHRoaXMuZm9ybWF0TWVldGluZ05vdGUoZW1haWwsIGV4dHJhY3Rpb24pO1xuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGZpbGVQYXRoLCBub3RlQ29udGVudCk7XG4gICAgICBjb25zb2xlLmxvZygnQ3JlYXRlZCBub3RlOicsIGZpbGVQYXRoKTtcblxuICAgICAgLy8gQWRkIHRvIGNhY2hlIGFuZCBwZXJzaXN0IHRvIHNldHRpbmdzXG4gICAgICB0aGlzLmVtYWlsSWRDYWNoZS5hZGQoZW1haWwuaWQpO1xuICAgICAgdGhpcy5zZXR0aW5ncy5wcm9jZXNzZWRFbWFpbHMgPSBBcnJheS5mcm9tKHRoaXMuZW1haWxJZENhY2hlKTtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZVNldHRpbmdzKCk7XG5cbiAgICAgIHJldHVybiBmaWxlUGF0aDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGNyZWF0ZSBub3RlOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGZvcm1hdE1lZXRpbmdOb3RlKGVtYWlsOiBhbnksIGV4dHJhY3Rpb246IFRhc2tFeHRyYWN0aW9uUmVzdWx0KTogc3RyaW5nIHtcbiAgICBjb25zdCBkYXRlID0gZXh0cmFjdGlvbi5tZWV0aW5nRGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF07XG5cbiAgICBsZXQgY29udGVudCA9IGAtLS1cbnRpdGxlOiAke2VtYWlsLnN1YmplY3QgfHwgJ01lZXRpbmcgTm90ZXMnfVxuZGF0ZTogJHtkYXRlfVxudHlwZTogbWVldGluZ1xuc291cmNlOiBHbWFpbFxuZW1haWxJZDogJHtlbWFpbC5pZH1cbnBhcnRpY2lwYW50czogWyR7ZXh0cmFjdGlvbi5wYXJ0aWNpcGFudHMubWFwKHAgPT4gYFwiJHtwfVwiYCkuam9pbignLCAnKX1dXG5jb25maWRlbmNlOiAke2V4dHJhY3Rpb24uY29uZmlkZW5jZX1cbnRhZ3M6IFttZWV0aW5nLCAke2V4dHJhY3Rpb24udGFza3MubGVuZ3RoID4gMCA/ICdoYXMtdGFza3MnIDogJ25vLXRhc2tzJ31dXG5jcmVhdGVkOiAke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKX1cbi0tLVxuXG4jICR7ZW1haWwuc3ViamVjdCB8fCAnTWVldGluZyBOb3Rlcyd9XG5cbioqRGF0ZToqKiAke2V4dHJhY3Rpb24ubWVldGluZ0RhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCl9XG4qKkZyb206KiogJHtlbWFpbC5mcm9tIHx8ICdVbmtub3duJ31cbmA7XG5cbiAgICBpZiAoZXh0cmFjdGlvbi5wYXJ0aWNpcGFudHMubGVuZ3RoID4gMCkge1xuICAgICAgY29udGVudCArPSBgKipQYXJ0aWNpcGFudHM6KiogJHtleHRyYWN0aW9uLnBhcnRpY2lwYW50cy5tYXAocCA9PiBgW1ske3B9XV1gKS5qb2luKCcsICcpfVxcbmA7XG4gICAgfVxuXG4gICAgY29udGVudCArPSBgKipDb25maWRlbmNlOioqICR7ZXh0cmFjdGlvbi5jb25maWRlbmNlfSVcXG5cXG5gO1xuXG4gICAgaWYgKGV4dHJhY3Rpb24uc3VtbWFyeSkge1xuICAgICAgY29udGVudCArPSBgIyMgU3VtbWFyeVxcbiR7ZXh0cmFjdGlvbi5zdW1tYXJ5fVxcblxcbmA7XG4gICAgfVxuXG4gICAgaWYgKGV4dHJhY3Rpb24ua2V5RGVjaXNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnRlbnQgKz0gYCMjIEtleSBEZWNpc2lvbnNcXG5gO1xuICAgICAgZm9yIChjb25zdCBkZWNpc2lvbiBvZiBleHRyYWN0aW9uLmtleURlY2lzaW9ucykge1xuICAgICAgICBjb250ZW50ICs9IGAtICR7ZGVjaXNpb259XFxuYDtcbiAgICAgIH1cbiAgICAgIGNvbnRlbnQgKz0gJ1xcbic7XG4gICAgfVxuXG4gICAgaWYgKGV4dHJhY3Rpb24udGFza3MubGVuZ3RoID4gMCkge1xuICAgICAgY29udGVudCArPSBgIyMgQWN0aW9uIEl0ZW1zXFxuXFxuYDtcblxuICAgICAgY29uc3QgaGlnaFByaW9yaXR5ID0gZXh0cmFjdGlvbi50YXNrcy5maWx0ZXIodCA9PiB0LnByaW9yaXR5ID09PSAnaGlnaCcpO1xuICAgICAgY29uc3QgbWVkaXVtUHJpb3JpdHkgPSBleHRyYWN0aW9uLnRhc2tzLmZpbHRlcih0ID0+IHQucHJpb3JpdHkgPT09ICdtZWRpdW0nKTtcbiAgICAgIGNvbnN0IGxvd1ByaW9yaXR5ID0gZXh0cmFjdGlvbi50YXNrcy5maWx0ZXIodCA9PiB0LnByaW9yaXR5ID09PSAnbG93Jyk7XG5cbiAgICAgIGlmIChoaWdoUHJpb3JpdHkubGVuZ3RoID4gMCkge1xuICAgICAgICBjb250ZW50ICs9IGAjIyMgXHVEODNEXHVERDM0IEhpZ2ggUHJpb3JpdHlcXG5gO1xuICAgICAgICBmb3IgKGNvbnN0IHRhc2sgb2YgaGlnaFByaW9yaXR5KSB7XG4gICAgICAgICAgY29udGVudCArPSB0aGlzLmZvcm1hdFRhc2sodGFzayk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGVudCArPSAnXFxuJztcbiAgICAgIH1cblxuICAgICAgaWYgKG1lZGl1bVByaW9yaXR5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29udGVudCArPSBgIyMjIFx1RDgzRFx1REZFMSBNZWRpdW0gUHJpb3JpdHlcXG5gO1xuICAgICAgICBmb3IgKGNvbnN0IHRhc2sgb2YgbWVkaXVtUHJpb3JpdHkpIHtcbiAgICAgICAgICBjb250ZW50ICs9IHRoaXMuZm9ybWF0VGFzayh0YXNrKTtcbiAgICAgICAgfVxuICAgICAgICBjb250ZW50ICs9ICdcXG4nO1xuICAgICAgfVxuXG4gICAgICBpZiAobG93UHJpb3JpdHkubGVuZ3RoID4gMCkge1xuICAgICAgICBjb250ZW50ICs9IGAjIyMgXHVEODNEXHVERkUyIExvdyBQcmlvcml0eVxcbmA7XG4gICAgICAgIGZvciAoY29uc3QgdGFzayBvZiBsb3dQcmlvcml0eSkge1xuICAgICAgICAgIGNvbnRlbnQgKz0gdGhpcy5mb3JtYXRUYXNrKHRhc2spO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRlbnQgKz0gJ1xcbic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGV4dHJhY3Rpb24ubmV4dFN0ZXBzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnRlbnQgKz0gYCMjIE5leHQgU3RlcHNcXG5gO1xuICAgICAgZm9yIChjb25zdCBzdGVwIG9mIGV4dHJhY3Rpb24ubmV4dFN0ZXBzKSB7XG4gICAgICAgIGNvbnRlbnQgKz0gYC0gJHtzdGVwfVxcbmA7XG4gICAgICB9XG4gICAgICBjb250ZW50ICs9ICdcXG4nO1xuICAgIH1cblxuICAgIGlmIChlbWFpbC5ib2R5KSB7XG4gICAgICBjb250ZW50ICs9IGAjIyBPcmlnaW5hbCBFbWFpbFxcblxcYFxcYFxcYFxcbiR7ZW1haWwuYm9keS5zdWJzdHJpbmcoMCwgMTAwMCl9JHtlbWFpbC5ib2R5Lmxlbmd0aCA+IDEwMDAgPyAnLi4uJyA6ICcnfVxcblxcYFxcYFxcYFxcbmA7XG4gICAgfVxuXG4gICAgY29udGVudCArPSBgXFxuLS0tXFxuKkltcG9ydGVkIGZyb20gR21haWwgb24gJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCl9KmA7XG5cbiAgICByZXR1cm4gY29udGVudDtcbiAgfVxuXG4gIHByaXZhdGUgZm9ybWF0VGFzayh0YXNrOiBhbnkpOiBzdHJpbmcge1xuICAgIGNvbnN0IGR1ZURhdGUgPSB0YXNrLmR1ZURhdGUgfHwgdGhpcy5nZXREZWZhdWx0RHVlRGF0ZSgpO1xuICAgIGxldCB0YXNrTGluZSA9IGAtIFsgXSAke3Rhc2suZGVzY3JpcHRpb259IFtbQCR7dGFzay5hc3NpZ25lZX1dXSBcdUQ4M0RcdURDQzUgJHtkdWVEYXRlfWA7XG5cbiAgICBpZiAodGFzay5jb25maWRlbmNlIDwgNzApIHtcbiAgICAgIHRhc2tMaW5lICs9IGAgXHUyNkEwXHVGRTBGICR7dGFzay5jb25maWRlbmNlfSVgO1xuICAgIH1cblxuICAgIGlmICh0YXNrLmNhdGVnb3J5ICYmIHRhc2suY2F0ZWdvcnkgIT09ICdvdGhlcicpIHtcbiAgICAgIHRhc2tMaW5lICs9IGAgIyR7dGFzay5jYXRlZ29yeX1gO1xuICAgIH1cblxuICAgIHRhc2tMaW5lICs9ICdcXG4nO1xuXG4gICAgaWYgKHRhc2suY29udGV4dCkge1xuICAgICAgdGFza0xpbmUgKz0gYCAgLSBDb250ZXh0OiAke3Rhc2suY29udGV4dH1cXG5gO1xuICAgIH1cblxuICAgIGlmICh0YXNrLnJhd1RleHQgJiYgdGFzay5yYXdUZXh0ICE9PSB0YXNrLmRlc2NyaXB0aW9uKSB7XG4gICAgICB0YXNrTGluZSArPSBgICA+IFwiJHt0YXNrLnJhd1RleHR9XCJcXG5gO1xuICAgIH1cblxuICAgIHJldHVybiB0YXNrTGluZTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RGVmYXVsdER1ZURhdGUoKTogc3RyaW5nIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoKTtcbiAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyA3KTtcbiAgICByZXR1cm4gZGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF07XG4gIH1cblxuICB1cGRhdGVTdGF0dXMoc3RhdHVzOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5zdGF0dXNCYXJJdGVtKSB7XG4gICAgICB0aGlzLnN0YXR1c0Jhckl0ZW0uc2V0VGV4dChgXHVEODNEXHVEQ0U3ICR7c3RhdHVzfWApO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG9wZW5UYXNrRGFzaGJvYXJkKCkge1xuICAgIGNvbnN0IHsgd29ya3NwYWNlIH0gPSB0aGlzLmFwcDtcbiAgICBjb25zdCBsZWF2ZXMgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFRBU0tfREFTSEJPQVJEX1ZJRVdfVFlQRSk7XG5cbiAgICBpZiAobGVhdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYXZlc1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICAgIGlmIChsZWFmKSB7XG4gICAgICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgICAgICB0eXBlOiBUQVNLX0RBU0hCT0FSRF9WSUVXX1RZUEUsXG4gICAgICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgICAgd29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGRhdGEpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBhc3luYyByZXByb2Nlc3NFbWFpbEJ5SWQoZW1haWxJZDogc3RyaW5nKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcmVwcm9jZXNzRW1haWxCeUlkXSBSZXByb2Nlc3NpbmcgZW1haWw6ICR7ZW1haWxJZH1gKTtcblxuICAgICAgaWYgKCF0aGlzLmdtYWlsU2VydmljZSB8fCAhdGhpcy5nbWFpbFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgbmV3IE5vdGljZSgnR21haWwgc2VydmljZSBub3QgYXV0aGVudGljYXRlZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgQ2xhdWRlIGV4dHJhY3RvciBpZiBub3QgYWxyZWFkeSBkb25lXG4gICAgICBpZiAoIXRoaXMuY2xhdWRlRXh0cmFjdG9yICYmIHRoaXMuc2V0dGluZ3MuYW50aHJvcGljQXBpS2V5KSB7XG4gICAgICAgIHRoaXMuY2xhdWRlRXh0cmFjdG9yID0gbmV3IENsYXVkZVRhc2tFeHRyYWN0b3IoXG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5hbnRocm9waWNBcGlLZXksXG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5jbGF1ZGVNb2RlbFxuICAgICAgICApO1xuICAgICAgICBjb25zb2xlLmxvZygnW3JlcHJvY2Vzc0VtYWlsQnlJZF0gSW5pdGlhbGl6ZWQgQ2xhdWRlIGV4dHJhY3RvcicpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgXHVEODNEXHVERDA0IEZldGNoaW5nIGVtYWlsICR7ZW1haWxJZH0uLi5gKTtcblxuICAgICAgLy8gRmV0Y2ggdGhlIHNwZWNpZmljIGVtYWlsIGJ5IElEXG4gICAgICBjb25zdCBlbWFpbCA9IGF3YWl0IHRoaXMuZ21haWxTZXJ2aWNlLmdldEVtYWlsQnlJZChlbWFpbElkKTtcblxuICAgICAgaWYgKCFlbWFpbCkge1xuICAgICAgICBuZXcgTm90aWNlKGBFbWFpbCAke2VtYWlsSWR9IG5vdCBmb3VuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW92ZSBmcm9tIHByb2Nlc3NlZCBsaXN0IHRvIGFsbG93IHJlcHJvY2Vzc2luZ1xuICAgICAgdGhpcy5lbWFpbElkQ2FjaGUuZGVsZXRlKGVtYWlsSWQpO1xuXG4gICAgICAvLyBQcm9jZXNzIHRoZSBlbWFpbFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wcm9jZXNzVHJhbnNjcmlwdEVtYWlsKGVtYWlsKTtcblxuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgIHRoaXMuZW1haWxJZENhY2hlLmFkZChlbWFpbElkKTtcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5wcm9jZXNzZWRFbWFpbHMgPSBBcnJheS5mcm9tKHRoaXMuZW1haWxJZENhY2hlKTtcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcblxuICAgICAgICBuZXcgTm90aWNlKGBcdTI3MDUgUmVwcm9jZXNzZWQgZW1haWwgd2l0aCAke3Jlc3VsdC50YXNrQ291bnQgfHwgMH0gdGFza3MgKENvbmZpZGVuY2U6ICR7cmVzdWx0LmNvbmZpZGVuY2V9JSlgKTtcbiAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFx1MjcwNSBSZXByb2Nlc3NlZCB3aXRoICR7cmVzdWx0LnRhc2tDb3VudCB8fCAwfSB0YXNrc2ApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3IE5vdGljZSgnXHUyNzRDIEZhaWxlZCB0byByZXByb2Nlc3MgZW1haWwnKTtcbiAgICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1x1Mjc0QyBSZXByb2Nlc3NpbmcgZmFpbGVkJyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJlcHJvY2Vzc2luZyBlbWFpbDonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKGBcdTI3NEMgRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdcdTI3NEMgRXJyb3IgcmVwcm9jZXNzaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcmVwcm9jZXNzQ3VycmVudE1lZXRpbmdOb3RlKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblxuICAgICAgaWYgKCFhY3RpdmVGaWxlKSB7XG4gICAgICAgIG5ldyBOb3RpY2UoJ05vIGFjdGl2ZSBmaWxlLiBQbGVhc2Ugb3BlbiBhIG1lZXRpbmcgbm90ZSB0byByZXByb2Nlc3MuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoYWN0aXZlRmlsZSk7XG4gICAgICBjb25zdCBmcm9udG1hdHRlck1hdGNoID0gY29udGVudC5tYXRjaCgvXi0tLVxcbihbXFxzXFxTXSo/KVxcbi0tLS8pO1xuXG4gICAgICBpZiAoIWZyb250bWF0dGVyTWF0Y2gpIHtcbiAgICAgICAgbmV3IE5vdGljZSgnVGhpcyBmaWxlIGRvZXMgbm90IGFwcGVhciB0byBiZSBhIG1lZXRpbmcgbm90ZSAobm8gZnJvbnRtYXR0ZXIpLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZyb250bWF0dGVyID0gZnJvbnRtYXR0ZXJNYXRjaFsxXTtcbiAgICAgIGNvbnN0IGVtYWlsSWRNYXRjaCA9IGZyb250bWF0dGVyLm1hdGNoKC9lbWFpbElkOlxccyooLispLyk7XG5cbiAgICAgIGlmICghZW1haWxJZE1hdGNoIHx8ICFlbWFpbElkTWF0Y2hbMV0pIHtcbiAgICAgICAgbmV3IE5vdGljZSgnTm8gZW1haWwgSUQgZm91bmQgaW4gdGhpcyBtZWV0aW5nIG5vdGUuIENhbm5vdCByZXByb2Nlc3MuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZW1haWxJZCA9IGVtYWlsSWRNYXRjaFsxXS50cmltKCk7XG5cbiAgICAgIGNvbnN0IGNvbmZpcm1lZCA9IGNvbmZpcm0oXG4gICAgICAgIGBSZXByb2Nlc3MgTWVldGluZyBOb3RlP1xcblxcblRoaXMgd2lsbCBmZXRjaCB0aGUgb3JpZ2luYWwgZW1haWwgYW5kIHJlZ2VuZXJhdGUgdGhlIHN1bW1hcnkgYW5kIHRhc2tzLlxcblxcbkVtYWlsIElEOiAke2VtYWlsSWR9YFxuICAgICAgKTtcblxuICAgICAgaWYgKCFjb25maXJtZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnUmVwcm9jZXNzaW5nLi4uJyk7XG4gICAgICBuZXcgTm90aWNlKCdGZXRjaGluZyBvcmlnaW5hbCBlbWFpbC4uLicpO1xuXG4gICAgICBpZiAoIXRoaXMuZ21haWxTZXJ2aWNlIHx8ICF0aGlzLmdtYWlsU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICBuZXcgTm90aWNlKCdHbWFpbCBub3QgY29ubmVjdGVkLiBQbGVhc2UgYXV0aGVudGljYXRlIGZpcnN0LicpO1xuICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR21haWwgbm90IGNvbm5lY3RlZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKGBSZWFkaW5nIGVtYWlsIHdpdGggSUQ6ICR7ZW1haWxJZH1gKTtcbiAgICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgdGhpcy5nbWFpbFNlcnZpY2UuZ2V0RW1haWxCeUlkKGVtYWlsSWQpO1xuXG4gICAgICBpZiAoIWVtYWlsKSB7XG4gICAgICAgIG5ldyBOb3RpY2UoJ0NvdWxkIG5vdCBmaW5kIHRoZSBvcmlnaW5hbCBlbWFpbC4gSXQgbWF5IGhhdmUgYmVlbiBkZWxldGVkLicpO1xuICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnUmVhZHknKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnRm91bmQgZW1haWw6JywgZW1haWwuc3ViamVjdCk7XG4gICAgICBuZXcgTm90aWNlKCdFeHRyYWN0aW5nIHRhc2tzIGFuZCBzdW1tYXJ5Li4uJyk7XG5cbiAgICAgIGNvbnN0IGVtYWlsQ29udGVudCA9IGVtYWlsLmJvZHkgfHwgZW1haWwuc25pcHBldCB8fCAnJztcblxuICAgICAgbGV0IGV4dHJhY3Rpb246IFRhc2tFeHRyYWN0aW9uUmVzdWx0O1xuXG4gICAgICBpZiAodGhpcy5jbGF1ZGVFeHRyYWN0b3IgJiYgdGhpcy5zZXR0aW5ncy5hbnRocm9waWNBcGlLZXkpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1JlcHJvY2Vzc2luZyB3aXRoIENsYXVkZS4uLicpO1xuICAgICAgICBleHRyYWN0aW9uID0gYXdhaXQgdGhpcy5jbGF1ZGVFeHRyYWN0b3IuZXh0cmFjdFRhc2tzKGVtYWlsQ29udGVudCwgZW1haWwuc3ViamVjdCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBFeHRyYWN0ZWQgJHtleHRyYWN0aW9uLnRhc2tzLmxlbmd0aH0gdGFza3Mgd2l0aCAke2V4dHJhY3Rpb24uY29uZmlkZW5jZX0lIGNvbmZpZGVuY2VgXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnQ2xhdWRlIGV4dHJhY3RvciBub3QgYXZhaWxhYmxlIGZvciByZXByb2Nlc3NpbmcnKTtcbiAgICAgICAgbmV3IE5vdGljZSgnXHUyNzRDIENsYXVkZSBBSSBub3QgY29uZmlndXJlZCAtIGNhbm5vdCByZXByb2Nlc3MnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBuZXdDb250ZW50ID0gdGhpcy5mb3JtYXRNZWV0aW5nTm90ZShlbWFpbCwgZXh0cmFjdGlvbik7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoYWN0aXZlRmlsZSwgbmV3Q29udGVudCk7XG5cbiAgICAgIGNvbnN0IHRhc2tDb3VudCA9IGV4dHJhY3Rpb24udGFza3MubGVuZ3RoO1xuICAgICAgY29uc3QgaGlnaFByaW9yaXR5Q291bnQgPSBleHRyYWN0aW9uLnRhc2tzLmZpbHRlcih0ID0+IHQucHJpb3JpdHkgPT09ICdoaWdoJykubGVuZ3RoO1xuXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgUmVwcm9jZXNzZWQ6ICR7dGFza0NvdW50fSB0YXNrc2ApO1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgYFx1MjcwNSBSZXByb2Nlc3NlZCBzdWNjZXNzZnVsbHkhIEZvdW5kICR7dGFza0NvdW50fSB0YXNrJHt0YXNrQ291bnQgIT09IDEgPyAncycgOiAnJ30gKCR7aGlnaFByaW9yaXR5Q291bnR9IGhpZ2ggcHJpb3JpdHkpYFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHJlcHJvY2VzcyBtZWV0aW5nIG5vdGU6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRXJyb3IgcmVwcm9jZXNzaW5nOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnRXJyb3InKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyByZXNldFByb2Nlc3NlZEVtYWlscygpIHtcbiAgICBjb25zb2xlLmxvZygnUmVzZXQgZnVuY3Rpb24gY2FsbGVkJyk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdSZXNldHRpbmcuLi4nKTtcblxuICAgICAgY29uc3QgY29uZmlybWVkID0gY29uZmlybShcbiAgICAgICAgJ1Jlc2V0IFByb2Nlc3NlZCBFbWFpbHM/XFxuXFxuVGhpcyB3aWxsIGNsZWFyIGFsbCBwcm9jZXNzZWQgZW1haWwgcmVjb3JkcywgYWxsb3dpbmcgdGhlbSB0byBiZSBwcm9jZXNzZWQgYWdhaW4uJ1xuICAgICAgKTtcblxuICAgICAgaWYgKCFjb25maXJtZWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1VzZXIgY2FuY2VsbGVkIHJlc2V0Jyk7XG4gICAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdSZWFkeScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCdVc2VyIGNvbmZpcm1lZCByZXNldCcpO1xuICAgICAgbmV3IE5vdGljZSgnUmVzZXR0aW5nIHByb2Nlc3NlZCBlbWFpbHMuLi4nKTtcblxuICAgICAgLy8gQ2xlYXIgdGhlIGNhY2hlIGFuZCBzZXR0aW5ncyAtIG5vdGVzIHRoZW1zZWx2ZXMgcmVtYWluIGFzIHRoZSBzb3VyY2Ugb2YgdHJ1dGhcbiAgICAgIHRoaXMuZW1haWxJZENhY2hlLmNsZWFyKCk7XG4gICAgICB0aGlzLnNldHRpbmdzLnByb2Nlc3NlZEVtYWlscyA9IFtdO1xuICAgICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3MoKTtcblxuICAgICAgLy8gUmVsb2FkIGZyb20gdmF1bHQgbm90ZXNcbiAgICAgIGF3YWl0IHRoaXMubG9hZEVtYWlsSWRDYWNoZSgpO1xuXG4gICAgICBuZXcgTm90aWNlKCdcdTI3MDUgQ2FjaGUgcmVmcmVzaGVkLiBFeGlzdGluZyBub3RlcyB3aWxsIHByZXZlbnQgZHVwbGljYXRlIHByb2Nlc3NpbmcuJyk7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnUmVhZHknKTtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdSZXNldCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgUmVzZXQgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnRXJyb3InKTtcbiAgICB9XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZygnVW5sb2FkaW5nIE1lZXRpbmcgVGFza3MgUGx1Z2luLi4uJyk7XG4gIH1cbn1cblxuY2xhc3MgTWVldGluZ1Rhc2tzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IE1lZXRpbmdUYXNrc1BsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNZWV0aW5nVGFza3NQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ01lZXRpbmcgVGFza3MgU2V0dGluZ3MnIH0pO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnR29vZ2xlIE9BdXRoIFNldHRpbmdzJyB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6ICdDcmVhdGUgT0F1dGggY3JlZGVudGlhbHMgaW4gR29vZ2xlIENsb3VkIENvbnNvbGUuIEZvbGxvdyB0aGUgZ3VpZGUgZm9yIGRldGFpbGVkIGluc3RydWN0aW9ucy4nLFxuICAgICAgY2xzOiAnc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0dvb2dsZSBDbGllbnQgSUQnKVxuICAgICAgLnNldERlc2MoJ1lvdXIgR29vZ2xlIE9BdXRoIENsaWVudCBJRCAoZnJvbSBHb29nbGUgQ2xvdWQgQ29uc29sZSknKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCcxMjM0NTY3ODkwLWFiYy4uLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZ29vZ2xlQ2xpZW50SWQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdvb2dsZUNsaWVudElkID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmluaXRpYWxpemVTZXJ2aWNlcygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnR29vZ2xlIENsaWVudCBTZWNyZXQnKVxuICAgICAgLnNldERlc2MoJ1lvdXIgR29vZ2xlIE9BdXRoIENsaWVudCBTZWNyZXQnKVxuICAgICAgLmFkZFRleHQodGV4dCA9PiB7XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0dPQ1NQWC0uLi4nKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5nb29nbGVDbGllbnRTZWNyZXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdvb2dsZUNsaWVudFNlY3JldCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0aWFsaXplU2VydmljZXMoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgdGV4dC5pbnB1dEVsLnR5cGUgPSAncGFzc3dvcmQnO1xuICAgICAgICByZXR1cm4gdGV4dDtcbiAgICAgIH0pO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnR21haWwgQXV0aGVudGljYXRpb24nIH0pO1xuXG4gICAgY29uc3QgYXV0aFN0YXR1c0VsID0gY29udGFpbmVyRWwuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICB0ZXh0OiAnXHUyM0YzIENoZWNraW5nIGF1dGhlbnRpY2F0aW9uIHN0YXR1cy4uLicsXG4gICAgICBjbHM6ICdtb2Qtd2FybmluZyBzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb24nLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2hlY2tBdXRoU3RhdHVzID0gKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnBsdWdpbi5nbWFpbFNlcnZpY2UpIHtcbiAgICAgICAgYXV0aFN0YXR1c0VsLnRleHRDb250ZW50ID0gJ1x1Mjc0QyBHbWFpbCBzZXJ2aWNlIG5vdCBpbml0aWFsaXplZCc7XG4gICAgICAgIGF1dGhTdGF0dXNFbC5jbGFzc05hbWUgPSAnbW9kLXdhcm5pbmcgc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJztcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5wbHVnaW4uZ21haWxTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5nbWFpbFNlcnZpY2UuaGFzUmVmcmVzaFRva2VuKCkpIHtcbiAgICAgICAgICBhdXRoU3RhdHVzRWwudGV4dENvbnRlbnQgPSAnXHUyNzA1IEF1dGhlbnRpY2F0ZWQgd2l0aCBHbWFpbCc7XG4gICAgICAgICAgYXV0aFN0YXR1c0VsLmNsYXNzTmFtZSA9ICdtb2Qtc3VjY2VzcyBzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb24nO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF1dGhTdGF0dXNFbC50ZXh0Q29udGVudCA9ICdcdTI2QTBcdUZFMEYgQXV0aGVudGljYXRlZCBidXQgbWlzc2luZyByZWZyZXNoIHRva2VuJztcbiAgICAgICAgICBhdXRoU3RhdHVzRWwuY2xhc3NOYW1lID0gJ21vZC13YXJuaW5nIHNldHRpbmctaXRlbS1kZXNjcmlwdGlvbic7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF1dGhTdGF0dXNFbC50ZXh0Q29udGVudCA9ICdcdTI3NEMgTm90IGF1dGhlbnRpY2F0ZWQgd2l0aCBHbWFpbCc7XG4gICAgICAgIGF1dGhTdGF0dXNFbC5jbGFzc05hbWUgPSAnbW9kLXdhcm5pbmcgc2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uJztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY2hlY2tBdXRoU3RhdHVzKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdBdXRoZW50aWNhdGUgd2l0aCBHbWFpbCcpXG4gICAgICAuc2V0RGVzYygnQ2xpY2sgdG8gc3RhcnQgdGhlIEdtYWlsIGF1dGhlbnRpY2F0aW9uIHByb2Nlc3MnKVxuICAgICAgLmFkZEJ1dHRvbihidXR0b24gPT4ge1xuICAgICAgICAvLyBTdG9yZSBidXR0b24gcmVmZXJlbmNlIHRvIHVwZGF0ZSBsYXRlclxuICAgICAgICBjb25zdCBhdXRoQnV0dG9uID0gYnV0dG9uO1xuXG4gICAgICAgIC8vIFNldCBpbml0aWFsIGJ1dHRvbiB0ZXh0IGJhc2VkIG9uIGF1dGggc3RhdHVzXG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5nbWFpbFNlcnZpY2U/LmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgYXV0aEJ1dHRvbi5zZXRCdXR0b25UZXh0KCdSZS1hdXRoZW50aWNhdGUnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhdXRoQnV0dG9uLnNldEJ1dHRvblRleHQoJ0F1dGhlbnRpY2F0ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXV0aEJ1dHRvbi5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBpZiAoIXRoaXMucGx1Z2luLmdtYWlsU2VydmljZSkge1xuICAgICAgICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIGNvbmZpZ3VyZSBDbGllbnQgSUQgYW5kIFNlY3JldCBmaXJzdCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBJbml0aWFsaXplIE9BdXRoIHNlcnZlciBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5wbHVnaW4ub2F1dGhTZXJ2ZXIpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ub2F1dGhTZXJ2ZXIgPSBuZXcgT0F1dGhTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU3RhcnQgdGhlIE9BdXRoIHNlcnZlclxuICAgICAgICAgICAgaWYgKCF0aGlzLnBsdWdpbi5vYXV0aFNlcnZlci5pc1J1bm5pbmcoKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLm9hdXRoU2VydmVyLnN0YXJ0KCk7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnU3RhcnRpbmcgYXV0aGVudGljYXRpb24gc2VydmVyLi4uJyk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZShgRmFpbGVkIHRvIHN0YXJ0IE9BdXRoIHNlcnZlcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTZXQgY3JlZGVudGlhbHMgd2l0aCB0aGUgT0F1dGggc2VydmVyIHJlZGlyZWN0IFVSSVxuICAgICAgICAgICAgY29uc3QgcmVkaXJlY3RVcmkgPSB0aGlzLnBsdWdpbi5vYXV0aFNlcnZlci5nZXRSZWRpcmVjdFVyaSgpO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uZ21haWxTZXJ2aWNlLnNldENyZWRlbnRpYWxzKFxuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5nb29nbGVDbGllbnRJZCxcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZ29vZ2xlQ2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgICByZWRpcmVjdFVyaVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gR2V0IGF1dGhvcml6YXRpb24gVVJMIGFuZCBvcGVuIGl0XG4gICAgICAgICAgICBjb25zdCBhdXRoVXJsID0gdGhpcy5wbHVnaW4uZ21haWxTZXJ2aWNlLmdldEF1dGhvcml6YXRpb25VcmwoKTtcbiAgICAgICAgICAgIHdpbmRvdy5vcGVuKGF1dGhVcmwsICdfYmxhbmsnKTtcblxuICAgICAgICAgICAgLy8gU2hvdyB3YWl0aW5nIG1vZGFsXG4gICAgICAgICAgICBjb25zdCBtb2RhbCA9IG5ldyBNb2RhbCh0aGlzLmFwcCk7XG4gICAgICAgICAgICBtb2RhbC5jb250ZW50RWwuYWRkQ2xhc3MoJ2dtYWlsLWF1dGgtbW9kYWwnKTtcblxuICAgICAgICAgICAgbW9kYWwuY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1x1RDgzRFx1REQxMCBBdXRoZW50aWNhdGluZyB3aXRoIEdtYWlsLi4uJyB9KTtcblxuICAgICAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb25zRWwgPSBtb2RhbC5jb250ZW50RWwuY3JlYXRlRGl2KCdhdXRoLWluc3RydWN0aW9ucycpO1xuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zRWwuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICAgICAgICAgIHRleHQ6ICdQbGVhc2UgY29tcGxldGUgdGhlIGF1dGhvcml6YXRpb24gaW4geW91ciBicm93c2VyLidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zRWwuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICAgICAgICAgIHRleHQ6ICdUaGlzIHdpbmRvdyB3aWxsIGNsb3NlIGF1dG9tYXRpY2FsbHkgd2hlbiBhdXRoZW50aWNhdGlvbiBpcyBjb21wbGV0ZS4nXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgbG9hZGluZ0VsID0gbW9kYWwuY29udGVudEVsLmNyZWF0ZURpdignYXV0aC1sb2FkaW5nJyk7XG4gICAgICAgICAgICBsb2FkaW5nRWwuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICAgICAgICBsb2FkaW5nRWwuc3R5bGUubWFyZ2luVG9wID0gJzIwcHgnO1xuICAgICAgICAgICAgbG9hZGluZ0VsLmNyZWF0ZUVsKCdzcGFuJywgeyB0ZXh0OiAnXHUyM0YzIFdhaXRpbmcgZm9yIGF1dGhvcml6YXRpb24uLi4nIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBjYW5jZWxCdG4gPSBtb2RhbC5jb250ZW50RWwuY3JlYXRlRWwoJ2J1dHRvbicsIHtcbiAgICAgICAgICAgICAgdGV4dDogJ0NhbmNlbCcsXG4gICAgICAgICAgICAgIGNsczogJ2F1dGgtY2FuY2VsLWJ0bidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2FuY2VsQnRuLnN0eWxlLm1hcmdpblRvcCA9ICcyMHB4JztcbiAgICAgICAgICAgIGNhbmNlbEJ0bi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICBtb2RhbC5jbG9zZSgpO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5vYXV0aFNlcnZlcj8uc3RvcCgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgbW9kYWwub3BlbigpO1xuXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBhdXRob3JpemF0aW9uIGNvZGVcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGNvZGUgPSBhd2FpdCB0aGlzLnBsdWdpbi5vYXV0aFNlcnZlci53YWl0Rm9yQXV0aENvZGUoKTtcblxuICAgICAgICAgICAgICBpZiAoIWNvZGUpIHtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdObyBhdXRob3JpemF0aW9uIGNvZGUgcmVjZWl2ZWQnKTtcbiAgICAgICAgICAgICAgICBtb2RhbC5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLm9hdXRoU2VydmVyLnN0b3AoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBFeGNoYW5nZSBjb2RlIGZvciB0b2tlblxuICAgICAgICAgICAgICBtb2RhbC5jbG9zZSgpO1xuICAgICAgICAgICAgICBuZXcgTm90aWNlKCdQcm9jZXNzaW5nIGF1dGhlbnRpY2F0aW9uLi4uJyk7XG5cbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uZ21haWxTZXJ2aWNlIS5leGNoYW5nZUNvZGVGb3JUb2tlbihjb2RlKTtcbiAgICAgICAgICAgICAgbmV3IE5vdGljZSgnXHUyNzA1IFN1Y2Nlc3NmdWxseSBhdXRoZW50aWNhdGVkIHdpdGggR21haWwhJyk7XG4gICAgICAgICAgICAgIGNoZWNrQXV0aFN0YXR1cygpO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5pbml0aWFsaXplU2VydmljZXMoKTtcblxuICAgICAgICAgICAgICAvLyBTdG9wIHRoZSBPQXV0aCBzZXJ2ZXJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4ub2F1dGhTZXJ2ZXIuc3RvcCgpO1xuXG4gICAgICAgICAgICAgIC8vIFVwZGF0ZSBidXR0b24gdGV4dCBhZnRlciBzdWNjZXNzZnVsIGF1dGhcbiAgICAgICAgICAgICAgYXV0aEJ1dHRvbi5zZXRCdXR0b25UZXh0KCdSZS1hdXRoZW50aWNhdGUnKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0F1dGhlbnRpY2F0aW9uIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgbmV3IE5vdGljZShgQXV0aGVudGljYXRpb24gZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLm9hdXRoU2VydmVyPy5zdG9wKCk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbmV3IE5vdGljZShgRmFpbGVkIHRvIHN0YXJ0IGF1dGhlbnRpY2F0aW9uOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG5cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdDbGVhciBhdXRoZW50aWNhdGlvbicpXG4gICAgICAuc2V0RGVzYygnUmVtb3ZlIHN0b3JlZCBHbWFpbCBhdXRoZW50aWNhdGlvbicpXG4gICAgICAuYWRkQnV0dG9uKGJ1dHRvbiA9PlxuICAgICAgICBidXR0b25cbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dCgnQ2xlYXInKVxuICAgICAgICAgIC5zZXRXYXJuaW5nKClcbiAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5nbWFpbFNlcnZpY2U/LmNsZWFyQXV0aGVudGljYXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdtYWlsVG9rZW4gPSBudWxsO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICBuZXcgTm90aWNlKCdHbWFpbCBhdXRoZW50aWNhdGlvbiBjbGVhcmVkJyk7XG4gICAgICAgICAgICBjaGVja0F1dGhTdGF0dXMoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ0VtYWlsIFByb2Nlc3NpbmcnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnTG9va2JhY2sgdGltZScpXG4gICAgICAuc2V0RGVzYygnSG93IGZhciBiYWNrIHRvIHNlYXJjaC4gRXhhbXBsZXM6IDZoICg2IGhvdXJzKSwgM2QgKDMgZGF5cyksIDJ3ICgyIHdlZWtzKSwgMU0gKDEgbW9udGgpJylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignNWQnKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sb29rYmFja1RpbWUgfHwgJzVkJylcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgdmFsdWUgPT4ge1xuICAgICAgICAgICAgLy8gVmFsaWRhdGUgdGhlIGZvcm1hdFxuICAgICAgICAgICAgY29uc3QgaG91cnMgPSB0aGlzLnBsdWdpbi5wYXJzZVRpbWVUb0hvdXJzKHZhbHVlKTtcbiAgICAgICAgICAgIGlmIChob3VycyA+IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubG9va2JhY2tUaW1lID0gdmFsdWU7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmxvb2tiYWNrSG91cnMgPSBob3VyczsgLy8gS2VlcCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0dtYWlsIExhYmVscycpXG4gICAgICAuc2V0RGVzYygnR21haWwgbGFiZWxzIHRvIGZpbHRlciBlbWFpbHMgKGNvbW1hLXNlcGFyYXRlZCknKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCd0cmFuc2NyaXB0JylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZ21haWxMYWJlbHMpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmdtYWlsTGFiZWxzID0gdmFsdWUgfHwgJ3RyYW5zY3JpcHQnO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdDbGF1ZGUgQUkgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnQW50aHJvcGljIEFQSSBLZXknKVxuICAgICAgLnNldERlc2MoJ1lvdXIgQ2xhdWRlIEFQSSBrZXkgZm9yIHRhc2sgZXh0cmFjdGlvbicpXG4gICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ3NrLWFudC0uLi4nKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hbnRocm9waWNBcGlLZXkpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFudGhyb3BpY0FwaUtleSA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5jbGF1ZGVFeHRyYWN0b3IgPSBuZXcgQ2xhdWRlVGFza0V4dHJhY3RvcihcbiAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jbGF1ZGVNb2RlbFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnQ2xhdWRlIE1vZGVsJylcbiAgICAgIC5zZXREZXNjKCdXaGljaCBDbGF1ZGUgbW9kZWwgdG8gdXNlJylcbiAgICAgIC5hZGREcm9wZG93bihkcm9wZG93biA9PlxuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb24oJ2NsYXVkZS0zLTUtaGFpa3UtMjAyNDEwMjInLCAnQ2xhdWRlIDMuNSBIYWlrdSAoRmFzdCAmIENoZWFwKScpXG4gICAgICAgICAgLmFkZE9wdGlvbignY2xhdWRlLXNvbm5ldC00LTIwMjUwNTE0JywgJ0NsYXVkZSBTb25uZXQgNCAoQmFsYW5jZWQpJylcbiAgICAgICAgICAuYWRkT3B0aW9uKCdjbGF1ZGUtb3B1cy00LTEtMjAyNTA4MDUnLCAnQ2xhdWRlIE9wdXMgNC4xIChNb3N0IENhcGFibGUpJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY2xhdWRlTW9kZWwpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNsYXVkZU1vZGVsID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ09ic2lkaWFuIFNldHRpbmdzJyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ05vdGVzIGZvbGRlcicpXG4gICAgICAuc2V0RGVzYygnV2hlcmUgdG8gY3JlYXRlIG1lZXRpbmcgbm90ZXMnKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdNZWV0aW5ncycpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVzRm9sZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3Rlc0ZvbGRlciA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6ICdEYXNoYm9hcmQgU2V0dGluZ3MnIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnU2hvdyBvbmx5IG15IHRhc2tzJylcbiAgICAgIC5zZXREZXNjKCdGaWx0ZXIgZGFzaGJvYXJkIHRvIHNob3cgb25seSB0YXNrcyBhc3NpZ25lZCB0byB5b3UnKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhc2hib2FyZFNob3dPbmx5TXlUYXNrcykub25DaGFuZ2UoYXN5bmMgdmFsdWUgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhc2hib2FyZFNob3dPbmx5TXlUYXNrcyA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ015IG5hbWUocyknKVxuICAgICAgLnNldERlc2MoJ1lvdXIgbmFtZShzKSBmb3IgZmlsdGVyaW5nIHRhc2tzIChjb21tYS1zZXBhcmF0ZWQpJylcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcignWW91ciBuYW1lLCBvdGhlciBuYW1lJylcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGFzaGJvYXJkTXlOYW1lKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXNoYm9hcmRNeU5hbWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnTm90aWZpY2F0aW9uIFNldHRpbmdzJyB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1Nob3cgZGV0YWlsZWQgbm90aWZpY2F0aW9ucycpXG4gICAgICAuc2V0RGVzYygnU2hvdyBlbWFpbCB0aXRsZXMgaW4gc3RhdHVzIG1lc3NhZ2VzIHdoaWxlIHByb2Nlc3NpbmcnKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dEZXRhaWxlZE5vdGlmaWNhdGlvbnMpLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93RGV0YWlsZWROb3RpZmljYXRpb25zID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywgeyB0ZXh0OiAnQWN0aW9ucycgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdQcm9jZXNzIGVtYWlscyBub3cnKVxuICAgICAgLnNldERlc2MoJ1NlYXJjaCBmb3IgbWVldGluZyBlbWFpbHMgYW5kIGNyZWF0ZSBub3RlcycpXG4gICAgICAuYWRkQnV0dG9uKGJ1dHRvbiA9PlxuICAgICAgICBidXR0b25cbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dCgnUHJvY2VzcycpXG4gICAgICAgICAgLnNldEN0YSgpXG4gICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4ucHJvY2Vzc0VtYWlscygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUmVzZXQgcHJvY2Vzc2VkIGVtYWlscycpXG4gICAgICAuc2V0RGVzYygnQ2xlYXIgdGhlIGxpc3Qgb2YgYWxyZWFkeSBwcm9jZXNzZWQgZW1haWxzJylcbiAgICAgIC5hZGRCdXR0b24oYnV0dG9uID0+XG4gICAgICAgIGJ1dHRvblxuICAgICAgICAgIC5zZXRCdXR0b25UZXh0KCdSZXNldCcpXG4gICAgICAgICAgLnNldFdhcm5pbmcoKVxuICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnJlc2V0UHJvY2Vzc2VkRW1haWxzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBjb25zdCBzdGF0dXNEaXYgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoJ3N0YXR1cy1pbmZvJyk7XG4gICAgY29uc3QgZ21haWxTdGF0dXMgPSB0aGlzLnBsdWdpbi5nbWFpbFNlcnZpY2U/LmlzQXV0aGVudGljYXRlZCgpXG4gICAgICA/ICdcdTI3MDUgR21haWwgYXV0aGVudGljYXRlZCdcbiAgICAgIDogJ1x1Mjc0QyBHbWFpbCBub3QgYXV0aGVudGljYXRlZCc7XG4gICAgY29uc3QgY2xhdWRlU3RhdHVzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuYW50aHJvcGljQXBpS2V5XG4gICAgICA/ICdcdTI3MDUgQ2xhdWRlIEFJIGNvbmZpZ3VyZWQnXG4gICAgICA6ICdcdTI2QTBcdUZFMEYgQ2xhdWRlIEFJIG5vdCBjb25maWd1cmVkJztcblxuICAgIHN0YXR1c0Rpdi5jcmVhdGVFbCgncCcsIHtcbiAgICAgIHRleHQ6IGdtYWlsU3RhdHVzLFxuICAgICAgY2xzOiB0aGlzLnBsdWdpbi5nbWFpbFNlcnZpY2U/LmlzQXV0aGVudGljYXRlZCgpID8gJ21vZC1zdWNjZXNzJyA6ICdtb2Qtd2FybmluZycsXG4gICAgfSk7XG5cbiAgICBzdGF0dXNEaXYuY3JlYXRlRWwoJ3AnLCB7XG4gICAgICB0ZXh0OiBjbGF1ZGVTdGF0dXMsXG4gICAgICBjbHM6IHRoaXMucGx1Z2luLnNldHRpbmdzLmFudGhyb3BpY0FwaUtleSA/ICdtb2Qtc3VjY2VzcycgOiAnbW9kLXdhcm5pbmcnLFxuICAgIH0pO1xuICB9XG59IiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tICdvYnNpZGlhbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0cmFjdGVkVGFzayB7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIGFzc2lnbmVlOiBzdHJpbmc7XG4gIHByaW9yaXR5OiAnaGlnaCcgfCAnbWVkaXVtJyB8ICdsb3cnO1xuICBjb25maWRlbmNlOiBudW1iZXI7XG4gIGR1ZURhdGU/OiBzdHJpbmc7XG4gIGNhdGVnb3J5Pzogc3RyaW5nO1xuICBjb250ZXh0Pzogc3RyaW5nO1xuICByYXdUZXh0Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhc2tFeHRyYWN0aW9uUmVzdWx0IHtcbiAgdGFza3M6IEV4dHJhY3RlZFRhc2tbXTtcbiAgc3VtbWFyeTogc3RyaW5nO1xuICBwYXJ0aWNpcGFudHM6IHN0cmluZ1tdO1xuICBtZWV0aW5nRGF0ZTogRGF0ZTtcbiAga2V5RGVjaXNpb25zOiBzdHJpbmdbXTtcbiAgbmV4dFN0ZXBzOiBzdHJpbmdbXTtcbiAgY29uZmlkZW5jZTogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhdWRlVGFza0V4dHJhY3RvciB7XG4gIHByaXZhdGUgYXBpS2V5OiBzdHJpbmc7XG4gIHByaXZhdGUgbW9kZWw6IHN0cmluZztcbiAgcHJpdmF0ZSBhcGlVcmw6IHN0cmluZyA9ICdodHRwczovL2FwaS5hbnRocm9waWMuY29tL3YxL21lc3NhZ2VzJztcblxuICBjb25zdHJ1Y3RvcihhcGlLZXk6IHN0cmluZywgbW9kZWw6IHN0cmluZyA9ICdjbGF1ZGUtMy01LWhhaWt1LTIwMjQxMDIyJykge1xuICAgIHRoaXMuYXBpS2V5ID0gYXBpS2V5O1xuICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IHRhc2tzIHVzaW5nIENsYXVkZSBBUEkgLSB1c2luZyB0aGUgc2FtZSBhcHByb2FjaCBhcyB0aGUgZGFlbW9uXG4gICAqL1xuICBhc3luYyBleHRyYWN0VGFza3MoZW1haWxDb250ZW50OiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZyk6IFByb21pc2U8VGFza0V4dHJhY3Rpb25SZXN1bHQ+IHtcbiAgICBpZiAoIXRoaXMuYXBpS2V5KSB7XG4gICAgICBjb25zb2xlLndhcm4oJ05vIENsYXVkZSBBUEkga2V5IGZvdW5kLCB1c2luZyBmYWxsYmFjayBleHRyYWN0aW9uJyk7XG4gICAgICByZXR1cm4gdGhpcy5mYWxsYmFja0V4dHJhY3Rpb24oZW1haWxDb250ZW50LCBzdWJqZWN0KTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcHJvbXB0ID0gdGhpcy5idWlsZFByb21wdChlbWFpbENvbnRlbnQsIHN1YmplY3QpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNhbGxDbGF1ZGUocHJvbXB0KTtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlUmVzcG9uc2UocmVzcG9uc2UsIGVtYWlsQ29udGVudCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NsYXVkZSB0YXNrIGV4dHJhY3Rpb24gZmFpbGVkLCB1c2luZyBmYWxsYmFjaycsIGVycm9yKTtcbiAgICAgIHJldHVybiB0aGlzLmZhbGxiYWNrRXh0cmFjdGlvbihlbWFpbENvbnRlbnQsIHN1YmplY3QpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZCB0aGUgZXh0cmFjdGlvbiBwcm9tcHQgLSBzYW1lIGFzIGRhZW1vblxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFByb21wdChlbWFpbENvbnRlbnQ6IHN0cmluZywgc3ViamVjdDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBFbnN1cmUgZW1haWxDb250ZW50IGlzIGEgc3RyaW5nXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBlbWFpbENvbnRlbnQgPT09ICdzdHJpbmcnID8gZW1haWxDb250ZW50IDogSlNPTi5zdHJpbmdpZnkoZW1haWxDb250ZW50KTtcbiAgICBcbiAgICByZXR1cm4gYFlvdSBhcmUgYW4gZXhwZXJ0IGF0IGV4dHJhY3RpbmcgYWN0aW9uYWJsZSB0YXNrcyBmcm9tIG1lZXRpbmcgdHJhbnNjcmlwdHMuIEFuYWx5emUgdGhlIGZvbGxvd2luZyBtZWV0aW5nIHRyYW5zY3JpcHQgYW5kIGV4dHJhY3QgYWxsIHRhc2tzLCBhY3Rpb24gaXRlbXMsIGFuZCBjb21taXRtZW50cy5cblxuTUVFVElORyBTVUJKRUNUOiAke3N1YmplY3R9XG5cblRSQU5TQ1JJUFQ6XG4ke2NvbnRlbnQuc3Vic3RyaW5nKDAsIDE1MDAwKX0gJHtjb250ZW50Lmxlbmd0aCA+IDE1MDAwID8gJy4uLiBbdHJ1bmNhdGVkXScgOiAnJ31cblxuRXh0cmFjdCB0aGUgZm9sbG93aW5nIGluZm9ybWF0aW9uIGFuZCByZXR1cm4gYXMgSlNPTjpcblxuMS4gKip0YXNrcyoqIC0gQXJyYXkgb2YgdGFzayBvYmplY3RzIHdpdGg6XG4gICAtIGRlc2NyaXB0aW9uOiBDbGVhciwgYWN0aW9uYWJsZSB0YXNrIGRlc2NyaXB0aW9uXG4gICAtIGFzc2lnbmVlOiBQZXJzb24gcmVzcG9uc2libGUgKHVzZSBhY3R1YWwgbmFtZXMgZnJvbSB0aGUgbWVldGluZywgZGVmYXVsdCBcIlVuYXNzaWduZWRcIiBpZiB1bmNsZWFyKVxuICAgLSBwcmlvcml0eTogXCJoaWdoXCIsIFwibWVkaXVtXCIsIG9yIFwibG93XCIgYmFzZWQgb24gdXJnZW5jeS9pbXBvcnRhbmNlXG4gICAtIGNvbmZpZGVuY2U6IDAtMTAwIHNjb3JlIG9mIGhvdyBjb25maWRlbnQgeW91IGFyZSB0aGlzIGlzIGEgcmVhbCB0YXNrXG4gICAtIGR1ZURhdGU6IElTTyBkYXRlIHN0cmluZyBpZiBtZW50aW9uZWQgKG9wdGlvbmFsKVxuICAgLSBjYXRlZ29yeTogZW5naW5lZXJpbmcvcHJvZHVjdC9kZXNpZ24vZG9jdW1lbnRhdGlvbi9jb21tdW5pY2F0aW9uL290aGVyXG4gICAtIGNvbnRleHQ6IEJyaWVmIGNvbnRleHQgYWJvdXQgd2h5IHRoaXMgdGFzayBleGlzdHNcbiAgIC0gcmF3VGV4dDogVGhlIG9yaWdpbmFsIHRleHQgdGhhdCBsZWQgdG8gdGhpcyB0YXNrXG5cbjIuICoqc3VtbWFyeSoqIC0gMi0zIHNlbnRlbmNlIG1lZXRpbmcgc3VtbWFyeVxuXG4zLiAqKnBhcnRpY2lwYW50cyoqIC0gQXJyYXkgb2YgcGFydGljaXBhbnQgbmFtZXMgKGV4dHJhY3QgYWxsIG5hbWVzIG1lbnRpb25lZClcblxuNC4gKiptZWV0aW5nRGF0ZSoqIC0gSVNPIGRhdGUgc3RyaW5nICh1c2UgdG9kYXkgaWYgbm90IHNwZWNpZmllZClcblxuNS4gKiprZXlEZWNpc2lvbnMqKiAtIEFycmF5IG9mIGltcG9ydGFudCBkZWNpc2lvbnMgbWFkZVxuXG42LiAqKm5leHRTdGVwcyoqIC0gQXJyYXkgb2YgZ2VuZXJhbCBuZXh0IHN0ZXBzIGJleW9uZCBzcGVjaWZpYyB0YXNrc1xuXG5HdWlkZWxpbmVzOlxuLSBGb2N1cyBvbiBleHBsaWNpdCBjb21taXRtZW50cyAoXCJJIHdpbGxcIiwgXCJJJ2xsXCIsIFwiTGV0IG1lXCIsIFwiSSBjYW5cIiwgXCJbTmFtZV0gd2lsbFwiKVxuLSBJbmNsdWRlIHRhc2tzIHdpdGggZGVhZGxpbmVzIG9yIHRpbWUgY29uc3RyYWludHNcbi0gQ2FwdHVyZSBmb2xsb3ctdXBzIGFuZCBhY3Rpb24gaXRlbXNcbi0gSWdub3JlIGdlbmVyYWwgZGlzY3Vzc2lvbnMgb3IgcGFzdCB3b3JrXG4tIEJlIGNvbnNlcnZhdGl2ZSAtIG9ubHkgZXh0cmFjdCBjbGVhciB0YXNrc1xuLSBPbmx5IHVzZSBuYW1lcyB0aGF0IGFjdHVhbGx5IGFwcGVhciBpbiB0aGUgdHJhbnNjcmlwdFxuLSBEZWZhdWx0IGFzc2lnbmVlIHNob3VsZCBiZSBcIlVuYXNzaWduZWRcIiBmb3IgdW5jbGVhciBvd25lcnNoaXBcblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiwgbm8gb3RoZXIgdGV4dDpgO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGwgQ2xhdWRlIEFQSVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjYWxsQ2xhdWRlKHByb21wdDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiB0aGlzLmFwaVVybCxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAneC1hcGkta2V5JzogdGhpcy5hcGlLZXksXG4gICAgICAgICAgJ2FudGhyb3BpYy12ZXJzaW9uJzogJzIwMjMtMDYtMDEnLFxuICAgICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLFxuICAgICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHJvbGU6ICd1c2VyJyxcbiAgICAgICAgICAgICAgY29udGVudDogcHJvbXB0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgXSxcbiAgICAgICAgICBtYXhfdG9rZW5zOiA0MDAwLFxuICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjIsXG4gICAgICAgICAgc3lzdGVtOiAnWW91IGFyZSBhIHRhc2sgZXh0cmFjdGlvbiBhc3Npc3RhbnQuIEFsd2F5cyByZXNwb25kIHdpdGggdmFsaWQgSlNPTiBvbmx5LCBubyBtYXJrZG93biBvciBleHBsYW5hdGlvbnMuJ1xuICAgICAgICB9KVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZXNwb25zZS5qc29uPy5jb250ZW50Py5bMF0/LnRleHQpIHtcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24uY29udGVudFswXS50ZXh0O1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQ2xhdWRlIEFQSSByZXNwb25zZSBzdHJ1Y3R1cmUnKTtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDAxKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ludmFsaWQgQ2xhdWRlIEFQSSBrZXknKTtcbiAgICAgIH0gZWxzZSBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDI5KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NsYXVkZSBBUEkgcmF0ZSBsaW1pdCBleGNlZWRlZCcpO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIENsYXVkZSdzIHJlc3BvbnNlXG4gICAqL1xuICBwcml2YXRlIHBhcnNlUmVzcG9uc2UocmVzcG9uc2U6IHN0cmluZywgZW1haWxDb250ZW50OiBzdHJpbmcpOiBUYXNrRXh0cmFjdGlvblJlc3VsdCB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEV4dHJhY3QgSlNPTiBmcm9tIHJlc3BvbnNlIChpbiBjYXNlIHRoZXJlJ3MgYW55IHN1cnJvdW5kaW5nIHRleHQpXG4gICAgICBjb25zdCBqc29uTWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvXFx7W1xcc1xcU10qXFx9Lyk7XG4gICAgICBpZiAoIWpzb25NYXRjaCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEpTT04gZm91bmQgaW4gcmVzcG9uc2UnKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uTWF0Y2hbMF0pO1xuICAgICAgXG4gICAgICAvLyBOb3JtYWxpemUgYW5kIHZhbGlkYXRlXG4gICAgICBjb25zdCB0YXNrcyA9IHRoaXMubm9ybWFsaXplVGFza3MocGFyc2VkLnRhc2tzIHx8IFtdKTtcbiAgICAgIGNvbnN0IHBhcnRpY2lwYW50cyA9IHBhcnNlZC5wYXJ0aWNpcGFudHMgfHwgW107XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRhc2tzOiB0aGlzLmRlZHVwbGljYXRlVGFza3ModGFza3MpLFxuICAgICAgICBzdW1tYXJ5OiBwYXJzZWQuc3VtbWFyeSB8fCAnTWVldGluZyB0cmFuc2NyaXB0IHByb2Nlc3NlZCcsXG4gICAgICAgIHBhcnRpY2lwYW50cyxcbiAgICAgICAgbWVldGluZ0RhdGU6IHRoaXMucGFyc2VEYXRlKHBhcnNlZC5tZWV0aW5nRGF0ZSkgfHwgbmV3IERhdGUoKSxcbiAgICAgICAga2V5RGVjaXNpb25zOiBwYXJzZWQua2V5RGVjaXNpb25zIHx8IFtdLFxuICAgICAgICBuZXh0U3RlcHM6IHBhcnNlZC5uZXh0U3RlcHMgfHwgW10sXG4gICAgICAgIGNvbmZpZGVuY2U6IHRoaXMuY2FsY3VsYXRlT3ZlcmFsbENvbmZpZGVuY2UodGFza3MpXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gcGFyc2UgQ2xhdWRlIHJlc3BvbnNlJywgZXJyb3IpO1xuICAgICAgY29uc29sZS5kZWJ1ZygnUmF3IHJlc3BvbnNlOicsIHJlc3BvbnNlKTtcbiAgICAgIHJldHVybiB0aGlzLmZhbGxiYWNrRXh0cmFjdGlvbihlbWFpbENvbnRlbnQsICcnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTm9ybWFsaXplIHRhc2sgb2JqZWN0c1xuICAgKi9cbiAgcHJpdmF0ZSBub3JtYWxpemVUYXNrcyh0YXNrczogYW55W10pOiBFeHRyYWN0ZWRUYXNrW10ge1xuICAgIHJldHVybiB0YXNrcy5tYXAodGFzayA9PiAoe1xuICAgICAgZGVzY3JpcHRpb246IHRoaXMuY2xlYW5EZXNjcmlwdGlvbih0YXNrLmRlc2NyaXB0aW9uIHx8ICcnKSxcbiAgICAgIGFzc2lnbmVlOiB0YXNrLmFzc2lnbmVlIHx8ICdVbmFzc2lnbmVkJyxcbiAgICAgIHByaW9yaXR5OiB0aGlzLm5vcm1hbGl6ZVByaW9yaXR5KHRhc2sucHJpb3JpdHkpLFxuICAgICAgY29uZmlkZW5jZTogdGhpcy5ub3JtYWxpemVDb25maWRlbmNlKHRhc2suY29uZmlkZW5jZSksXG4gICAgICBkdWVEYXRlOiB0YXNrLmR1ZURhdGUsXG4gICAgICBjYXRlZ29yeTogdGFzay5jYXRlZ29yeSB8fCAnb3RoZXInLFxuICAgICAgY29udGV4dDogdGFzay5jb250ZXh0LFxuICAgICAgcmF3VGV4dDogdGFzay5yYXdUZXh0XG4gICAgfSkpLmZpbHRlcih0YXNrID0+IHRhc2suZGVzY3JpcHRpb24gJiYgdGFzay5kZXNjcmlwdGlvbi5sZW5ndGggPiA1KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbiB0YXNrIGRlc2NyaXB0aW9uXG4gICAqL1xuICBwcml2YXRlIGNsZWFuRGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGRlc2NyaXB0aW9uXG4gICAgICAucmVwbGFjZSgvXlstKlx1MjAyMl1cXHMqLywgJycpXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgICAudHJpbSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZSBwcmlvcml0eVxuICAgKi9cbiAgcHJpdmF0ZSBub3JtYWxpemVQcmlvcml0eShwcmlvcml0eTogYW55KTogJ2hpZ2gnIHwgJ21lZGl1bScgfCAnbG93JyB7XG4gICAgY29uc3QgcCA9IFN0cmluZyhwcmlvcml0eSkudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAocC5pbmNsdWRlcygnaGlnaCcpIHx8IHAgPT09ICczJykgcmV0dXJuICdoaWdoJztcbiAgICBpZiAocC5pbmNsdWRlcygnbG93JykgfHwgcCA9PT0gJzEnKSByZXR1cm4gJ2xvdyc7XG4gICAgcmV0dXJuICdtZWRpdW0nO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZSBjb25maWRlbmNlIHNjb3JlXG4gICAqL1xuICBwcml2YXRlIG5vcm1hbGl6ZUNvbmZpZGVuY2UoY29uZmlkZW5jZTogYW55KTogbnVtYmVyIHtcbiAgICBjb25zdCBjID0gTnVtYmVyKGNvbmZpZGVuY2UpO1xuICAgIGlmIChpc05hTihjKSkgcmV0dXJuIDc1O1xuICAgIHJldHVybiBNYXRoLm1pbigxMDAsIE1hdGgubWF4KDAsIGMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBkYXRlIHN0cmluZ1xuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZURhdGUoZGF0ZVN0cjogYW55KTogRGF0ZSB8IG51bGwge1xuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIHJldHVybiBpc05hTihkYXRlLmdldFRpbWUoKSkgPyBudWxsIDogZGF0ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZHVwbGljYXRlIHRhc2tzXG4gICAqL1xuICBwcml2YXRlIGRlZHVwbGljYXRlVGFza3ModGFza3M6IEV4dHJhY3RlZFRhc2tbXSk6IEV4dHJhY3RlZFRhc2tbXSB7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIHJldHVybiB0YXNrcy5maWx0ZXIodGFzayA9PiB7XG4gICAgICBjb25zdCBrZXkgPSBgJHt0YXNrLmRlc2NyaXB0aW9uLnRvTG93ZXJDYXNlKCl9LSR7dGFzay5hc3NpZ25lZS50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICBpZiAoc2Vlbi5oYXMoa2V5KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgc2Vlbi5hZGQoa2V5KTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSBvdmVyYWxsIGNvbmZpZGVuY2VcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlT3ZlcmFsbENvbmZpZGVuY2UodGFza3M6IEV4dHJhY3RlZFRhc2tbXSk6IG51bWJlciB7XG4gICAgaWYgKHRhc2tzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG4gICAgY29uc3Qgc3VtID0gdGFza3MucmVkdWNlKChhY2MsIHRhc2spID0+IGFjYyArIHRhc2suY29uZmlkZW5jZSwgMCk7XG4gICAgcmV0dXJuIE1hdGgucm91bmQoc3VtIC8gdGFza3MubGVuZ3RoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGYWxsYmFjayBleHRyYWN0aW9uIHdoZW4gQ2xhdWRlIGlzIHVuYXZhaWxhYmxlXG4gICAqL1xuICBwcml2YXRlIGZhbGxiYWNrRXh0cmFjdGlvbihlbWFpbENvbnRlbnQ6IHN0cmluZywgc3ViamVjdDogc3RyaW5nKTogVGFza0V4dHJhY3Rpb25SZXN1bHQge1xuICAgIGNvbnN0IHRhc2tzOiBFeHRyYWN0ZWRUYXNrW10gPSBbXTtcbiAgICBjb25zdCBsaW5lcyA9IGVtYWlsQ29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgXG4gICAgLy8gU2ltcGxlIHBhdHRlcm4gbWF0Y2hpbmcgZm9yIHRhc2tzXG4gICAgY29uc3QgdGFza1BhdHRlcm5zID0gW1xuICAgICAgLyg/Okkgd2lsbHxJJ2xsfEkgY2FufExldCBtZXxJIG5lZWQgdG98SSBzaG91bGR8SSBoYXZlIHRvKVxccysoLispL2ksXG4gICAgICAvKD86VE9ET3xBY3Rpb258VGFza3xGb2xsb3cuP3VwKTpcXHMqKC4rKS9pLFxuICAgICAgLyg/Ok5leHQgc3RlcHM/fEFjdGlvbiBpdGVtcz8pOlxccyooLispL2ksXG4gICAgICAvXFxbIFxcXVxccysoLispLyxcbiAgICAgIC9eWy0qXHUyMDIyXVxccyooLisoPzp3aWxsfG5lZWQgdG98c2hvdWxkfG11c3QpLispL2lcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgdGFza1BhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaChwYXR0ZXJuKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgdGFza3MucHVzaCh7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogdGhpcy5jbGVhbkRlc2NyaXB0aW9uKG1hdGNoWzFdKSxcbiAgICAgICAgICAgIGFzc2lnbmVlOiAnVW5hc3NpZ25lZCcsXG4gICAgICAgICAgICBwcmlvcml0eTogJ21lZGl1bScsXG4gICAgICAgICAgICBjb25maWRlbmNlOiA1MCxcbiAgICAgICAgICAgIGNhdGVnb3J5OiAnb3RoZXInLFxuICAgICAgICAgICAgcmF3VGV4dDogbGluZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRXh0cmFjdCBwYXJ0aWNpcGFudCBuYW1lcyAoc2ltcGxlIGFwcHJvYWNoKVxuICAgIGNvbnN0IHBhcnRpY2lwYW50czogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBuYW1lUGF0dGVybiA9IC8oPzp3aXRofGZyb218dG98Y2N8YXR0ZW5kZWVzPzopXFxzKihbQS1aXVthLXpdKyg/OlxccytbQS1aXVthLXpdKykqKS9naTtcbiAgICBsZXQgbWF0Y2g7XG4gICAgd2hpbGUgKChtYXRjaCA9IG5hbWVQYXR0ZXJuLmV4ZWMoZW1haWxDb250ZW50KSkgIT09IG51bGwpIHtcbiAgICAgIGlmICghcGFydGljaXBhbnRzLmluY2x1ZGVzKG1hdGNoWzFdKSkge1xuICAgICAgICBwYXJ0aWNpcGFudHMucHVzaChtYXRjaFsxXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHRhc2tzOiB0aGlzLmRlZHVwbGljYXRlVGFza3ModGFza3MpLFxuICAgICAgc3VtbWFyeTogc3ViamVjdCB8fCAnTWVldGluZyBub3RlcycsXG4gICAgICBwYXJ0aWNpcGFudHMsXG4gICAgICBtZWV0aW5nRGF0ZTogbmV3IERhdGUoKSxcbiAgICAgIGtleURlY2lzaW9uczogW10sXG4gICAgICBuZXh0U3RlcHM6IFtdLFxuICAgICAgY29uZmlkZW5jZTogMzBcbiAgICB9O1xuICB9XG59IiwgImltcG9ydCB7IFxuICBJdGVtVmlldywgXG4gIFdvcmtzcGFjZUxlYWYsXG4gIFRGaWxlLFxuICBOb3RpY2UsXG4gIE1hcmtkb3duUmVuZGVyZXIsXG4gIENvbXBvbmVudFxufSBmcm9tICdvYnNpZGlhbic7XG5cbmV4cG9ydCBjb25zdCBUQVNLX0RBU0hCT0FSRF9WSUVXX1RZUEUgPSAndGFzay1kYXNoYm9hcmQtdmlldyc7XG5cbmludGVyZmFjZSBUYXNrIHtcbiAgdGV4dDogc3RyaW5nO1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGFzc2lnbmVlOiBzdHJpbmc7XG4gIGR1ZURhdGU6IHN0cmluZztcbiAgcHJpb3JpdHk6ICdoaWdoJyB8ICdtZWRpdW0nIHwgJ2xvdyc7XG4gIGNvbmZpZGVuY2U/OiBudW1iZXI7XG4gIGNhdGVnb3J5Pzogc3RyaW5nO1xuICBmaWxlOiBURmlsZTtcbiAgbGluZTogbnVtYmVyO1xuICByYXdMaW5lOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBHcm91cGVkVGFza3Mge1xuICBba2V5OiBzdHJpbmddOiBUYXNrW107XG59XG5cbmludGVyZmFjZSBGaWx0ZXJDb3VudHMge1xuICBoaWdoOiBudW1iZXI7XG4gIG1lZGl1bTogbnVtYmVyO1xuICBsb3c6IG51bWJlcjtcbiAgdG9kYXk6IG51bWJlcjtcbiAgd2VlazogbnVtYmVyO1xuICBvdmVyZHVlOiBudW1iZXI7XG4gIGNvbXBsZXRlZDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICBkYXNoYm9hcmRNeU5hbWU/OiBzdHJpbmc7XG4gIGRhc2hib2FyZFNob3dPbmx5TXlUYXNrcz86IGJvb2xlYW47XG4gIG5vdGVzRm9sZGVyPzogc3RyaW5nO1xuICBsb29rYmFja0hvdXJzPzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgTWVldGluZ1Rhc2tzUGx1Z2luIHtcbiAgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xufVxuXG5leHBvcnQgY2xhc3MgVGFza0Rhc2hib2FyZFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgY29tcG9uZW50OiBDb21wb25lbnQ7XG4gIHByaXZhdGUgcGx1Z2luOiBNZWV0aW5nVGFza3NQbHVnaW4gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgc2hvd09ubHlNeVRhc2tzOiBib29sZWFuID0gdHJ1ZTtcbiAgcHJpdmF0ZSBhbGxUYXNrczogVGFza1tdID0gW107XG4gIHByaXZhdGUgaXNMb2FkaW5nOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgZmlsdGVyQ291bnRzOiBGaWx0ZXJDb3VudHMgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBiYWRnZUVsZW1lbnRzOiBNYXA8c3RyaW5nLCBIVE1MRWxlbWVudD4gPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgdXBkYXRlQ291bnRzRGVib3VuY2VUaW1lcjogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwbHVnaW4/OiBNZWV0aW5nVGFza3NQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgICB0aGlzLmNvbXBvbmVudCA9IG5ldyBDb21wb25lbnQoKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLnNob3dPbmx5TXlUYXNrcyA9IHRydWU7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpIHtcbiAgICByZXR1cm4gVEFTS19EQVNIQk9BUkRfVklFV19UWVBFO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKSB7XG4gICAgcmV0dXJuICdUYXNrIERhc2hib2FyZCc7XG4gIH1cblxuICBnZXRJY29uKCkge1xuICAgIHJldHVybiAnY2hlY2stc3F1YXJlJztcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpIHtcbiAgICBhd2FpdCB0aGlzLnJlZnJlc2goKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKSB7XG4gICAgLy8gQ2xlYXIgYW55IHBlbmRpbmcgZGVib3VuY2UgdGltZXJcbiAgICBpZiAodGhpcy51cGRhdGVDb3VudHNEZWJvdW5jZVRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy51cGRhdGVDb3VudHNEZWJvdW5jZVRpbWVyKTtcbiAgICAgIHRoaXMudXBkYXRlQ291bnRzRGVib3VuY2VUaW1lciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuY29tcG9uZW50LnVubG9hZCgpO1xuICB9XG5cbiAgYXN5bmMgcmVmcmVzaCgpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIFxuICAgIC8vIEFkZCBkYXNoYm9hcmQgY2xhc3MgZm9yIHN0eWxpbmdcbiAgICBjb250YWluZXIuYWRkQ2xhc3MoJ2Rhc2hib2FyZCcpO1xuICAgIGNvbnRhaW5lci5hZGRDbGFzcygnbWFya2Rvd24tcHJldmlldy12aWV3Jyk7XG4gICAgXG4gICAgLy8gU2hvdyBsb2FkaW5nIHN0YXRlXG4gICAgdGhpcy5zaG93TG9hZGluZ1N0YXRlKGNvbnRhaW5lcik7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMubG9hZEFuZERpc3BsYXlEYXNoYm9hcmQoY29udGFpbmVyKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHJlZnJlc2ggZGFzaGJvYXJkOicsIGVycm9yKTtcbiAgICAgIHRoaXMuc2hvd0Vycm9yU3RhdGUoY29udGFpbmVyLCBlcnJvcik7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIHNob3dMb2FkaW5nU3RhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuICAgIGNvbnN0IGxvYWRpbmdEaXYgPSBjb250YWluZXIuY3JlYXRlRGl2KCdkYXNoYm9hcmQtbG9hZGluZycpO1xuICAgIGxvYWRpbmdEaXYuY3JlYXRlRWwoJ2RpdicsIHsgY2xzOiAnbG9hZGluZy1zcGlubmVyJyB9KTtcbiAgICBsb2FkaW5nRGl2LmNyZWF0ZUVsKCdwJywgeyB0ZXh0OiAnTG9hZGluZyB0YXNrcy4uLicsIGNsczogJ2xvYWRpbmctdGV4dCcgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgc2hvd0Vycm9yU3RhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZXJyb3I6IGFueSkge1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIGNvbnN0IGVycm9yRGl2ID0gY29udGFpbmVyLmNyZWF0ZURpdignZGFzaGJvYXJkLWVycm9yJyk7XG4gICAgZXJyb3JEaXYuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnXHUyNkEwXHVGRTBGIEVycm9yIExvYWRpbmcgRGFzaGJvYXJkJyB9KTtcbiAgICBlcnJvckRpdi5jcmVhdGVFbCgncCcsIHsgdGV4dDogJ0ZhaWxlZCB0byBsb2FkIHRhc2tzLiBQbGVhc2UgdHJ5IHJlZnJlc2hpbmcuJyB9KTtcbiAgICBlcnJvckRpdi5jcmVhdGVFbCgncHJlJywgeyB0ZXh0OiBlcnJvcj8ubWVzc2FnZSB8fCAnVW5rbm93biBlcnJvcicsIGNsczogJ2Vycm9yLWRldGFpbHMnIH0pO1xuICAgIFxuICAgIGNvbnN0IHJldHJ5QnRuID0gZXJyb3JEaXYuY3JlYXRlRWwoJ2J1dHRvbicsIHtcbiAgICAgIHRleHQ6ICdcdUQ4M0RcdUREMDQgUmV0cnknLFxuICAgICAgY2xzOiAnZGFzaGJvYXJkLWNvbnRyb2wtYnRuJ1xuICAgIH0pO1xuICAgIHJldHJ5QnRuLm9uY2xpY2sgPSAoKSA9PiB0aGlzLnJlZnJlc2goKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBsb2FkQW5kRGlzcGxheURhc2hib2FyZChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgLy8gQ2xlYXIgbG9hZGluZyBzdGF0ZVxuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIFxuICAgIC8vIENyZWF0ZSBoZWFkZXJcbiAgICBjb25zdCBoZWFkZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KCdkYXNoYm9hcmQtaGVhZGVyJyk7XG4gICAgaGVhZGVyLmNyZWF0ZUVsKCdoMScsIHsgdGV4dDogJ1RBU0sgREFTSEJPQVJEJywgY2xzOiAndGl0bGUnIH0pO1xuICAgIFxuICAgIC8vIEFkZCBjb250cm9sIGJ1dHRvbnNcbiAgICBjb25zdCBjb250cm9scyA9IGhlYWRlci5jcmVhdGVEaXYoJ2Rhc2hib2FyZC1jb250cm9scycpO1xuICAgIFxuICAgIC8vIEFkZCB0b2dnbGUgYnV0dG9uIGZvciBteSB0YXNrcy9hbGwgdGFza3MgKG9ubHkgaWYgdXNlciBuYW1lIGlzIGNvbmZpZ3VyZWQpXG4gICAgaWYgKHRoaXMucGx1Z2luPy5zZXR0aW5ncz8uZGFzaGJvYXJkTXlOYW1lKSB7XG4gICAgICBjb25zdCB0b2dnbGVCdG4gPSBjb250cm9scy5jcmVhdGVFbCgnYnV0dG9uJywge1xuICAgICAgICB0ZXh0OiB0aGlzLnNob3dPbmx5TXlUYXNrcyA/ICdcdUQ4M0RcdURDNjUgU2hvdyBBbGwgVGFza3MnIDogJ1x1RDgzRFx1REM2NCBTaG93IE15IFRhc2tzJyxcbiAgICAgICAgY2xzOiAnZGFzaGJvYXJkLWNvbnRyb2wtYnRuIGRhc2hib2FyZC10b2dnbGUtYnRuJ1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHRvZ2dsZUJ0bi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICB0aGlzLnNob3dPbmx5TXlUYXNrcyA9ICF0aGlzLnNob3dPbmx5TXlUYXNrcztcbiAgICAgICAgdG9nZ2xlQnRuLnRleHRDb250ZW50ID0gdGhpcy5zaG93T25seU15VGFza3MgPyAnXHVEODNEXHVEQzY1IFNob3cgQWxsIFRhc2tzJyA6ICdcdUQ4M0RcdURDNjQgU2hvdyBNeSBUYXNrcyc7XG4gICAgICAgIHRoaXMudXBkYXRlRmlsdGVyQ291bnRzKHRydWUpOyAvLyBVcGRhdGUgY291bnRzIGZvciBuZXcgdmlldyBtb2RlIChpbW1lZGlhdGUpXG4gICAgICAgIHRoaXMudXBkYXRlVGFza0Rpc3BsYXkoKTtcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIEFkZCByZWZyZXNoIGJ1dHRvblxuICAgIGNvbnN0IHJlZnJlc2hCdG4gPSBjb250cm9scy5jcmVhdGVFbCgnYnV0dG9uJywge1xuICAgICAgdGV4dDogJ1x1RDgzRFx1REQwNCBSZWZyZXNoJyxcbiAgICAgIGNsczogJ2Rhc2hib2FyZC1jb250cm9sLWJ0biBkYXNoYm9hcmQtcmVmcmVzaC1idG4nXG4gICAgfSk7XG4gICAgXG4gICAgcmVmcmVzaEJ0bi5vbmNsaWNrID0gKCkgPT4gdGhpcy5yZWZyZXNoKCk7XG4gICAgXG4gICAgLy8gQWRkIGZpbHRlciBidXR0b25zXG4gICAgY29uc3QgZmlsdGVycyA9IGNvbnRhaW5lci5jcmVhdGVEaXYoJ2Rhc2hib2FyZC1maWx0ZXJzJyk7XG4gICAgdGhpcy5jcmVhdGVGaWx0ZXJCdXR0b25zKGZpbHRlcnMpO1xuICAgIFxuICAgIC8vIExvYWQgYWxsIHRhc2tzIHdpdGggZXJyb3IgaGFuZGxpbmdcbiAgICB0cnkge1xuICAgICAgdGhpcy5pc0xvYWRpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5hbGxUYXNrcyA9IGF3YWl0IHRoaXMubG9hZFRhc2tzKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHRhc2tzOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBsb2FkIHRhc2tzLiBDaGVjayBjb25zb2xlIGZvciBkZXRhaWxzLicpO1xuICAgICAgdGhpcy5hbGxUYXNrcyA9IFtdO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmlzTG9hZGluZyA9IGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICAvLyBVcGRhdGUgZmlsdGVyIGNvdW50cyBhZnRlciBsb2FkaW5nIHRhc2tzIChpbW1lZGlhdGUgdXBkYXRlKVxuICAgIHRoaXMudXBkYXRlRmlsdGVyQ291bnRzKHRydWUpO1xuICAgIFxuICAgIC8vIEdldCBmaWx0ZXJlZCB0YXNrcyBiYXNlZCBvbiBjdXJyZW50IHZpZXcgbW9kZVxuICAgIGNvbnN0IGRpc3BsYXlUYXNrcyA9IHRoaXMuZ2V0RmlsdGVyZWRUYXNrcygpO1xuICAgIFxuICAgIC8vIENyZWF0ZSB0YXNrIHNlY3Rpb25zXG4gICAgYXdhaXQgdGhpcy5kaXNwbGF5VGFza3MoY29udGFpbmVyLCBkaXNwbGF5VGFza3MpO1xuICAgIFxuICAgIC8vIEFwcGx5IGN1c3RvbSBDU1NcbiAgICB0aGlzLmFwcGx5RGFzaGJvYXJkU3R5bGVzKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJhZGdlRWxlbWVudChjb3VudDogbnVtYmVyLCBmaWx0ZXJUeXBlOiBzdHJpbmcpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAgIC8vIERvbid0IGNyZWF0ZSBiYWRnZSBpZiBjb3VudCBpcyB6ZXJvXG4gICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgYmFkZ2UuY2xhc3NOYW1lID0gJ2ZpbHRlci1iYWRnZSc7XG4gICAgYmFkZ2Uuc2V0QXR0cmlidXRlKCdkYXRhLWZpbHRlci10eXBlJywgZmlsdGVyVHlwZSk7XG4gICAgYmFkZ2UudGV4dENvbnRlbnQgPSBjb3VudC50b1N0cmluZygpO1xuICAgIFxuICAgIHJldHVybiBiYWRnZTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRmlsdGVyQnV0dG9ucyhjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgY29uc3QgZmlsdGVyR3JvdXAgPSBjb250YWluZXIuY3JlYXRlRGl2KCdmaWx0ZXItZ3JvdXAnKTtcbiAgICBcbiAgICAvLyBDbGVhciBleGlzdGluZyBiYWRnZSByZWZlcmVuY2VzXG4gICAgdGhpcy5iYWRnZUVsZW1lbnRzLmNsZWFyKCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIGN1cnJlbnQgZmlsdGVyIGNvdW50c1xuICAgIGNvbnN0IGNvdW50cyA9IHRoaXMuZ2V0Q3VycmVudEZpbHRlckNvdW50cygpO1xuICAgIHRoaXMuZmlsdGVyQ291bnRzID0gY291bnRzOyAvLyBDYWNoZSB0aGUgY291bnRzXG4gICAgXG4gICAgY29uc3QgZmlsdGVycyA9IFtcbiAgICAgIHsgbGFiZWw6ICdIaWdoIFByaW9yaXR5JywgZmlsdGVyOiAnaGlnaCcsIGFjdGl2ZTogdHJ1ZSwgZGF0YUF0dHI6ICdoaWdoJywgY291bnQ6IGNvdW50cy5oaWdoIH0sXG4gICAgICB7IGxhYmVsOiAnTWVkaXVtIFByaW9yaXR5JywgZmlsdGVyOiAnbWVkaXVtJywgZGF0YUF0dHI6ICdtZWRpdW0nLCBjb3VudDogY291bnRzLm1lZGl1bSB9LFxuICAgICAgeyBsYWJlbDogJ0xvdyBQcmlvcml0eScsIGZpbHRlcjogJ2xvdycsIGRhdGFBdHRyOiAnbG93JywgY291bnQ6IGNvdW50cy5sb3cgfSxcbiAgICAgIHsgbGFiZWw6ICdQYXN0IER1ZScsIGZpbHRlcjogJ292ZXJkdWUnLCBkYXRhQXR0cjogJ292ZXJkdWUnLCBjb3VudDogY291bnRzLm92ZXJkdWUgfSxcbiAgICAgIHsgbGFiZWw6ICdEdWUgVG9kYXknLCBmaWx0ZXI6ICd0b2RheScsIGRhdGFBdHRyOiAnZHVlLXRvZGF5JywgY291bnQ6IGNvdW50cy50b2RheSB9LFxuICAgICAgeyBsYWJlbDogJ0R1ZSBUaGlzIFdlZWsnLCBmaWx0ZXI6ICd3ZWVrJywgZGF0YUF0dHI6ICdkdWUtd2VlaycsIGNvdW50OiBjb3VudHMud2VlayB9LFxuICAgICAgeyBsYWJlbDogJ0NvbXBsZXRlZCcsIGZpbHRlcjogJ2NvbXBsZXRlZCcsIGRhdGFBdHRyOiAnY29tcGxldGVkJywgY291bnQ6IGNvdW50cy5jb21wbGV0ZWQgfVxuICAgIF07XG4gICAgXG4gICAgZmlsdGVycy5mb3JFYWNoKGYgPT4ge1xuICAgICAgY29uc3QgYnRuID0gZmlsdGVyR3JvdXAuY3JlYXRlRWwoJ2J1dHRvbicsIHtcbiAgICAgICAgY2xzOiBmLmFjdGl2ZSA/ICdmaWx0ZXItYnRuIGFjdGl2ZScgOiAnZmlsdGVyLWJ0bidcbiAgICAgIH0pO1xuICAgICAgYnRuLnNldEF0dHJpYnV0ZSgnZGF0YS1maWx0ZXInLCBmLmRhdGFBdHRyKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGEgd3JhcHBlciBzcGFuIGZvciB0aGUgbGFiZWwgYW5kIGJhZGdlXG4gICAgICBjb25zdCBsYWJlbFNwYW4gPSBidG4uY3JlYXRlRWwoJ3NwYW4nLCB7XG4gICAgICAgIHRleHQ6IGYubGFiZWwsXG4gICAgICAgIGNsczogJ2ZpbHRlci1idG4tbGFiZWwnXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gQWRkIGJhZGdlIGlmIGNvdW50ID4gMFxuICAgICAgY29uc3QgYmFkZ2UgPSB0aGlzLmNyZWF0ZUJhZGdlRWxlbWVudChmLmNvdW50LCBmLmRhdGFBdHRyKTtcbiAgICAgIGlmIChiYWRnZSkge1xuICAgICAgICBidG4uYXBwZW5kQ2hpbGQoYmFkZ2UpO1xuICAgICAgICAvLyBTdG9yZSByZWZlcmVuY2UgdG8gYmFkZ2UgZWxlbWVudCBmb3IgZHluYW1pYyB1cGRhdGVzXG4gICAgICAgIHRoaXMuYmFkZ2VFbGVtZW50cy5zZXQoZi5maWx0ZXIsIGJhZGdlKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgYnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgIC8vIFRvZ2dsZSBmaWx0ZXIgLSBjbGljayBhY3RpdmUgYnV0dG9uIHRvIHNob3cgYWxsXG4gICAgICAgIGlmIChidG4uaGFzQ2xhc3MoJ2FjdGl2ZScpKSB7XG4gICAgICAgICAgYnRuLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAgICAgICB0aGlzLmFwcGx5RmlsdGVyKCdhbGwnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZW1vdmUgYWN0aXZlIGZyb20gYWxsIGJ1dHRvbnNcbiAgICAgICAgICBmaWx0ZXJHcm91cC5xdWVyeVNlbGVjdG9yQWxsKCcuZmlsdGVyLWJ0bicpLmZvckVhY2goYiA9PiB7XG4gICAgICAgICAgICBpZiAoYiBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgICAgICAgIGIucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGJ0bi5hZGRDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmLmZpbHRlcik7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGxvYWRUYXNrcygpOiBQcm9taXNlPFRhc2tbXT4ge1xuICAgIGNvbnN0IHRhc2tzOiBUYXNrW10gPSBbXTtcbiAgICBcbiAgICAvLyBHZXQgYWxsIG1hcmtkb3duIGZpbGVzIGluIHRoZSB2YXVsdFxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgZmlsZVRhc2tzID0gYXdhaXQgdGhpcy5leHRyYWN0VGFza3NGcm9tRmlsZShmaWxlKTtcbiAgICAgIHRhc2tzLnB1c2goLi4uZmlsZVRhc2tzKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRhc2tzO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBleHRyYWN0VGFza3NGcm9tRmlsZShmaWxlOiBURmlsZSk6IFByb21pc2U8VGFza1tdPiB7XG4gICAgY29uc3QgdGFza3M6IFRhc2tbXSA9IFtdO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgICBcbiAgICAgICAgLy8gTWF0Y2ggdGFzayBsaW5lcyB3aXRoIGNoZWNrYm94XG4gICAgICAgIGNvbnN0IHRhc2tNYXRjaCA9IGxpbmUubWF0Y2goL15bXFxzLV0qXFxbKFsgeF0pXFxdXFxzKyguKykvKTtcbiAgICAgICAgaWYgKHRhc2tNYXRjaCkge1xuICAgICAgICAgIGNvbnN0IGNvbXBsZXRlZCA9IHRhc2tNYXRjaFsxXSA9PT0gJ3gnO1xuICAgICAgICAgIGNvbnN0IHRhc2tUZXh0ID0gdGFza01hdGNoWzJdO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEV4dHJhY3QgcHJpb3JpdHkgLSBTdXBwb3J0IGJvdGggT2JzaWRpYW4ncyBidWlsdC1pbiBzeW50YXggYW5kIGN1c3RvbSBlbW9qaXNcbiAgICAgICAgICBsZXQgcHJpb3JpdHk6ICdoaWdoJyB8ICdtZWRpdW0nIHwgJ2xvdycgPSAnbWVkaXVtJztcbiAgICAgICAgICAvLyBIaWdoIHByaW9yaXR5OiBPYnNpZGlhbidzIFx1MjNFQiAoaGlnaGVzdCkgYW5kIFx1RDgzRFx1REQzQyAoaGlnaCksIG9yIGN1c3RvbSBcdUQ4M0RcdUREMzRcbiAgICAgICAgICBpZiAobGluZS5pbmNsdWRlcygnXHUyM0VCJykgfHwgbGluZS5pbmNsdWRlcygnXHVEODNEXHVERDNDJykgfHwgbGluZS5pbmNsdWRlcygnXHVEODNEXHVERDM0JykgfHwgdGFza1RleHQuaW5jbHVkZXMoJ0hpZ2ggUHJpb3JpdHknKSkge1xuICAgICAgICAgICAgcHJpb3JpdHkgPSAnaGlnaCc7XG4gICAgICAgICAgfSBcbiAgICAgICAgICAvLyBMb3cgcHJpb3JpdHk6IE9ic2lkaWFuJ3MgXHUyM0VDIChsb3dlc3QpIGFuZCBcdUQ4M0RcdUREM0QgKGxvdyksIG9yIGN1c3RvbSBcdUQ4M0RcdURGRTJcbiAgICAgICAgICBlbHNlIGlmIChsaW5lLmluY2x1ZGVzKCdcdTIzRUMnKSB8fCBsaW5lLmluY2x1ZGVzKCdcdUQ4M0RcdUREM0QnKSB8fCBsaW5lLmluY2x1ZGVzKCdcdUQ4M0RcdURGRTInKSB8fCB0YXNrVGV4dC5pbmNsdWRlcygnTG93IFByaW9yaXR5JykpIHtcbiAgICAgICAgICAgIHByaW9yaXR5ID0gJ2xvdyc7XG4gICAgICAgICAgfSBcbiAgICAgICAgICAvLyBNZWRpdW0gcHJpb3JpdHk6IGN1c3RvbSBcdUQ4M0RcdURGRTEgb3IgZGVmYXVsdFxuICAgICAgICAgIGVsc2UgaWYgKGxpbmUuaW5jbHVkZXMoJ1x1RDgzRFx1REZFMScpKSB7XG4gICAgICAgICAgICBwcmlvcml0eSA9ICdtZWRpdW0nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBFeHRyYWN0IGFzc2lnbmVlXG4gICAgICAgICAgY29uc3QgYXNzaWduZWVNYXRjaCA9IHRhc2tUZXh0Lm1hdGNoKC9cXFtcXFtAPyhbXlxcXV0rKVxcXVxcXS8pO1xuICAgICAgICAgIGNvbnN0IGFzc2lnbmVlID0gYXNzaWduZWVNYXRjaCA/IGFzc2lnbmVlTWF0Y2hbMV0gOiAnVW5hc3NpZ25lZCc7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gRXh0cmFjdCBkdWUgZGF0ZVxuICAgICAgICAgIGNvbnN0IGRhdGVNYXRjaCA9IHRhc2tUZXh0Lm1hdGNoKC9cdUQ4M0RcdURDQzVcXHMqKFxcZHs0fS1cXGR7Mn0tXFxkezJ9KS8pO1xuICAgICAgICAgIGNvbnN0IGR1ZURhdGUgPSBkYXRlTWF0Y2ggPyBkYXRlTWF0Y2hbMV0gOiAnJztcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBFeHRyYWN0IGNvbmZpZGVuY2VcbiAgICAgICAgICBjb25zdCBjb25maWRlbmNlTWF0Y2ggPSB0YXNrVGV4dC5tYXRjaCgvXHUyNkEwXHVGRTBGXFxzKihcXGQrKSUvKTtcbiAgICAgICAgICBjb25zdCBjb25maWRlbmNlID0gY29uZmlkZW5jZU1hdGNoID8gcGFyc2VJbnQoY29uZmlkZW5jZU1hdGNoWzFdKSA6IDEwMDtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBFeHRyYWN0IGNhdGVnb3J5XG4gICAgICAgICAgY29uc3QgY2F0ZWdvcnlNYXRjaCA9IHRhc2tUZXh0Lm1hdGNoKC8jKFxcdyspLyk7XG4gICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBjYXRlZ29yeU1hdGNoID8gY2F0ZWdvcnlNYXRjaFsxXSA6ICdnZW5lcmFsJztcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBDbGVhbiB0YXNrIHRleHRcbiAgICAgICAgICBjb25zdCBjbGVhblRleHQgPSB0YXNrVGV4dFxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcW1xcW0A/W15cXF1dK1xcXVxcXS9nLCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cdUQ4M0RcdURDQzVcXHMqXFxkezR9LVxcZHsyfS1cXGR7Mn0vZywgJycpXG4gICAgICAgICAgICAucmVwbGFjZSgvW1x1RDgzRFx1REQzNFx1RDgzRFx1REZFMVx1RDgzRFx1REZFMl0vZywgJycpXG4gICAgICAgICAgICAucmVwbGFjZSgvXHUyNkEwXHVGRTBGXFxzKlxcZCslL2csICcnKVxuICAgICAgICAgICAgLnJlcGxhY2UoLyNcXHcrL2csICcnKVxuICAgICAgICAgICAgLnRyaW0oKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0YXNrcy5wdXNoKHtcbiAgICAgICAgICAgIHRleHQ6IGNsZWFuVGV4dCxcbiAgICAgICAgICAgIGNvbXBsZXRlZCxcbiAgICAgICAgICAgIGFzc2lnbmVlLFxuICAgICAgICAgICAgZHVlRGF0ZSxcbiAgICAgICAgICAgIHByaW9yaXR5LFxuICAgICAgICAgICAgY29uZmlkZW5jZSxcbiAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgIGxpbmU6IGksXG4gICAgICAgICAgICByYXdMaW5lOiBsaW5lXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHJlYWQgZmlsZSAke2ZpbGUucGF0aH06YCwgZXJyb3IpO1xuICAgICAgLy8gUmV0dXJuIGVtcHR5IGFycmF5IGZvciB0aGlzIGZpbGUsIGNvbnRpbnVlIHdpdGggb3RoZXJzXG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0YXNrcztcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZGlzcGxheVRhc2tzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHRhc2tzOiBUYXNrW10pIHtcbiAgICAvLyBHcm91cCB0YXNrcyBieSBwcmlvcml0eVxuICAgIGNvbnN0IGhpZ2hQcmlvcml0eSA9IHRhc2tzLmZpbHRlcih0ID0+IHQucHJpb3JpdHkgPT09ICdoaWdoJyAmJiAhdC5jb21wbGV0ZWQpO1xuICAgIGNvbnN0IG1lZGl1bVByaW9yaXR5ID0gdGFza3MuZmlsdGVyKHQgPT4gdC5wcmlvcml0eSA9PT0gJ21lZGl1bScgJiYgIXQuY29tcGxldGVkKTtcbiAgICBjb25zdCBsb3dQcmlvcml0eSA9IHRhc2tzLmZpbHRlcih0ID0+IHQucHJpb3JpdHkgPT09ICdsb3cnICYmICF0LmNvbXBsZXRlZCk7XG4gICAgY29uc3QgY29tcGxldGVkVGFza3MgPSB0YXNrcy5maWx0ZXIodCA9PiB0LmNvbXBsZXRlZCk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHNlY3Rpb25zXG4gICAgaWYgKGhpZ2hQcmlvcml0eS5sZW5ndGggPiAwKSB7XG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZVRhc2tTZWN0aW9uKGNvbnRhaW5lciwgJ1x1RDgzRFx1REQzNCBIaWdoIFByaW9yaXR5JywgaGlnaFByaW9yaXR5LCAnaGlnaCcpO1xuICAgIH1cbiAgICBcbiAgICBpZiAobWVkaXVtUHJpb3JpdHkubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVUYXNrU2VjdGlvbihjb250YWluZXIsICdcdUQ4M0RcdURGRTEgTWVkaXVtIFByaW9yaXR5JywgbWVkaXVtUHJpb3JpdHksICdtZWRpdW0nKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGxvd1ByaW9yaXR5Lmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlVGFza1NlY3Rpb24oY29udGFpbmVyLCAnXHVEODNEXHVERkUyIExvdyBQcmlvcml0eScsIGxvd1ByaW9yaXR5LCAnbG93Jyk7XG4gICAgfVxuICAgIFxuICAgIC8vIENvbXBsZXRlZCBzZWN0aW9uIChjb2xsYXBzZWQgYnkgZGVmYXVsdClcbiAgICBpZiAoY29tcGxldGVkVGFza3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3Qgc2VjdGlvbiA9IGNvbnRhaW5lci5jcmVhdGVEaXYoJ3Rhc2stc2VjdGlvbiBjb21wbGV0ZWQtc2VjdGlvbicpO1xuICAgICAgY29uc3QgaGVhZGVyID0gc2VjdGlvbi5jcmVhdGVFbCgnaDInLCB7IFxuICAgICAgICB0ZXh0OiBgXHUyNzA1IENvbXBsZXRlZCAoJHtjb21wbGV0ZWRUYXNrcy5sZW5ndGh9KWAsXG4gICAgICAgIGNsczogJ2NvbGxhcHNpYmxlJ1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBzZWN0aW9uLmNyZWF0ZURpdigndGFzay1ncmlkIGNvbGxhcHNlZCcpO1xuICAgICAgXG4gICAgICBoZWFkZXIub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgaXNDb2xsYXBzZWQgPSBjb250ZW50Lmhhc0NsYXNzKCdjb2xsYXBzZWQnKTtcbiAgICAgICAgaWYgKGlzQ29sbGFwc2VkKSB7XG4gICAgICAgICAgY29udGVudC5yZW1vdmVDbGFzcygnY29sbGFwc2VkJyk7XG4gICAgICAgICAgaGVhZGVyLnJlbW92ZUNsYXNzKCdjb2xsYXBzZWQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250ZW50LmFkZENsYXNzKCdjb2xsYXBzZWQnKTtcbiAgICAgICAgICBoZWFkZXIuYWRkQ2xhc3MoJ2NvbGxhcHNlZCcpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgXG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZVRhc2tDYXJkcyhjb250ZW50LCBjb21wbGV0ZWRUYXNrcywgJ2NvbXBsZXRlZCcpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlVGFza1NlY3Rpb24oXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCwgXG4gICAgdGl0bGU6IHN0cmluZywgXG4gICAgdGFza3M6IFRhc2tbXSwgXG4gICAgcHJpb3JpdHk6IHN0cmluZ1xuICApIHtcbiAgICBjb25zdCBzZWN0aW9uID0gY29udGFpbmVyLmNyZWF0ZURpdihgdGFzay1zZWN0aW9uICR7cHJpb3JpdHl9LXNlY3Rpb25gKTtcbiAgICBzZWN0aW9uLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogYCR7dGl0bGV9ICgke3Rhc2tzLmxlbmd0aH0pYCB9KTtcbiAgICBcbiAgICBjb25zdCBncmlkID0gc2VjdGlvbi5jcmVhdGVEaXYoJ3Rhc2stZ3JpZCcpO1xuICAgIGF3YWl0IHRoaXMuY3JlYXRlVGFza0NhcmRzKGdyaWQsIHRhc2tzLCBwcmlvcml0eSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZVRhc2tDYXJkcyhjb250YWluZXI6IEhUTUxFbGVtZW50LCB0YXNrczogVGFza1tdLCBwcmlvcml0eTogc3RyaW5nKSB7XG4gICAgLy8gR3JvdXAgdGFza3MgYnkgYXNzaWduZWVcbiAgICBjb25zdCBncm91cGVkOiBHcm91cGVkVGFza3MgPSB7fTtcbiAgICBcbiAgICB0YXNrcy5mb3JFYWNoKHRhc2sgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gdGFzay5hc3NpZ25lZSB8fCAnVW5hc3NpZ25lZCc7XG4gICAgICBpZiAoIWdyb3VwZWRba2V5XSkgZ3JvdXBlZFtrZXldID0gW107XG4gICAgICBncm91cGVkW2tleV0ucHVzaCh0YXNrKTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBTb3J0IGFzc2lnbmVlcyBhbHBoYWJldGljYWxseSAodXNlcidzIG5hbWVzIGZpcnN0IGlmIGNvbmZpZ3VyZWQpXG4gICAgY29uc3QgYXNzaWduZWVzID0gT2JqZWN0LmtleXMoZ3JvdXBlZCkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgbXlOYW1lc1N0ciA9IHRoaXMucGx1Z2luPy5zZXR0aW5ncz8uZGFzaGJvYXJkTXlOYW1lPy50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKG15TmFtZXNTdHIpIHtcbiAgICAgICAgLy8gU3VwcG9ydCBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBuYW1lc1xuICAgICAgICBjb25zdCBteU5hbWVzID0gbXlOYW1lc1N0clxuICAgICAgICAgIC5zcGxpdCgnLCcpXG4gICAgICAgICAgLm1hcChuYW1lID0+IG5hbWUudHJpbSgpKVxuICAgICAgICAgIC5maWx0ZXIobmFtZSA9PiBuYW1lLmxlbmd0aCA+IDApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgYUxvd2VyID0gYS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBiTG93ZXIgPSBiLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBpZiBlaXRoZXIgYXNzaWduZWUgbWF0Y2hlcyBhbnkgb2YgdGhlIG5hbWVzXG4gICAgICAgIGNvbnN0IGFJc01lID0gbXlOYW1lcy5zb21lKG5hbWUgPT4gYUxvd2VyLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgY29uc3QgYklzTWUgPSBteU5hbWVzLnNvbWUobmFtZSA9PiBiTG93ZXIuaW5jbHVkZXMobmFtZSkpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGFJc01lICYmICFiSXNNZSkgcmV0dXJuIC0xO1xuICAgICAgICBpZiAoYklzTWUgJiYgIWFJc01lKSByZXR1cm4gMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhLmxvY2FsZUNvbXBhcmUoYik7XG4gICAgfSk7XG4gICAgXG4gICAgZm9yIChjb25zdCBhc3NpZ25lZSBvZiBhc3NpZ25lZXMpIHtcbiAgICAgIGNvbnN0IGNhcmQgPSBjb250YWluZXIuY3JlYXRlRGl2KGB0YXNrLWNhcmQgJHtwcmlvcml0eX0tY2FyZGApO1xuICAgICAgXG4gICAgICAvLyBDYXJkIGhlYWRlciB3aXRoIGFzc2lnbmVlIG5hbWVcbiAgICAgIGNvbnN0IGhlYWRlciA9IGNhcmQuY3JlYXRlRGl2KCdjYXJkLWhlYWRlcicpO1xuICAgICAgXG4gICAgICAvLyBBc3NpZ25lZSBuYW1lXG4gICAgICBjb25zdCBhc3NpZ25lZVRpdGxlID0gaGVhZGVyLmNyZWF0ZUVsKCdoMycsIHtcbiAgICAgICAgdGV4dDogYFx1RDgzRFx1REM2NCAke2Fzc2lnbmVlfWAsXG4gICAgICAgIGNsczogJ2NhcmQtYXNzaWduZWUtdGl0bGUnXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVGFzayBsaXN0XG4gICAgICBjb25zdCB0YXNrTGlzdCA9IGNhcmQuY3JlYXRlRWwoJ3VsJywgeyBjbHM6ICd0YXNrLWxpc3QnIH0pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhc2sgb2YgZ3JvdXBlZFthc3NpZ25lZV0pIHtcbiAgICAgICAgY29uc3QgbGkgPSB0YXNrTGlzdC5jcmVhdGVFbCgnbGknLCB7IGNsczogJ3Rhc2stbGlzdC1pdGVtJyB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIENyZWF0ZSBjaGVja2JveFxuICAgICAgICBjb25zdCBjaGVja2JveCA9IGxpLmNyZWF0ZUVsKCdpbnB1dCcsIHsgXG4gICAgICAgICAgdHlwZTogJ2NoZWNrYm94JyxcbiAgICAgICAgICBjbHM6ICd0YXNrLWNoZWNrYm94J1xuICAgICAgICB9KTtcbiAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IHRhc2suY29tcGxldGVkO1xuICAgICAgICBjaGVja2JveC5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMudG9nZ2xlVGFzayh0YXNrLCBjaGVja2JveC5jaGVja2VkLCBsaSk7XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBUYXNrIGNvbnRlbnQgd3JhcHBlclxuICAgICAgICBjb25zdCBjb250ZW50ID0gbGkuY3JlYXRlRGl2KCd0YXNrLWNvbnRlbnQnKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFRhc2sgdGV4dCAtIG1ha2UgaXQgY2xpY2thYmxlIHRvIG5hdmlnYXRlIHRvIHRoZSBtZWV0aW5nIG5vdGVcbiAgICAgICAgY29uc3QgdGV4dFNwYW4gPSBjb250ZW50LmNyZWF0ZUVsKCdzcGFuJywgeyBcbiAgICAgICAgICB0ZXh0OiB0YXNrLnRleHQsXG4gICAgICAgICAgY2xzOiB0YXNrLmNvbXBsZXRlZCA/ICd0YXNrLXRleHQgY29tcGxldGVkIGNsaWNrYWJsZScgOiAndGFzay10ZXh0IGNsaWNrYWJsZSdcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBBZGQgY2xpY2sgaGFuZGxlciB0byBuYXZpZ2F0ZSB0byB0aGUgbWVldGluZyBub3RlXG4gICAgICAgIHRleHRTcGFuLm9uY2xpY2sgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAvLyBPcGVuIHRoZSBmaWxlIGF0IHRoZSBzcGVjaWZpYyBsaW5lXG4gICAgICAgICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKGZhbHNlKTtcbiAgICAgICAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKHRhc2suZmlsZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU2Nyb2xsIHRvIHRoZSB0YXNrIGxpbmUgaWYgcG9zc2libGVcbiAgICAgICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xuICAgICAgICAgIGlmICh2aWV3ICYmICdlZGl0b3InIGluIHZpZXcpIHtcbiAgICAgICAgICAgIGNvbnN0IGVkaXRvciA9ICh2aWV3IGFzIHsgZWRpdG9yPzogQ29kZU1pcnJvci5FZGl0b3IgfSkuZWRpdG9yO1xuICAgICAgICAgICAgaWYgKGVkaXRvcikge1xuICAgICAgICAgICAgICAvLyBTZXQgY3Vyc29yIHRvIHRoZSB0YXNrIGxpbmVcbiAgICAgICAgICAgICAgZWRpdG9yLnNldEN1cnNvcih0YXNrLmxpbmUsIDApO1xuICAgICAgICAgICAgICBlZGl0b3Iuc2Nyb2xsSW50b1ZpZXcoe1xuICAgICAgICAgICAgICAgIGZyb206IHsgbGluZTogTWF0aC5tYXgoMCwgdGFzay5saW5lIC0gNSksIGNoOiAwIH0sXG4gICAgICAgICAgICAgICAgdG86IHsgbGluZTogTWF0aC5taW4oZWRpdG9yLmxpbmVDb3VudCgpIC0gMSwgdGFzay5saW5lICsgNSksIGNoOiAwIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIHRpdGxlIGF0dHJpYnV0ZSBmb3IgdG9vbHRpcFxuICAgICAgICB0ZXh0U3Bhbi50aXRsZSA9IGBDbGljayB0byBvcGVuOiAke3Rhc2suZmlsZS5iYXNlbmFtZX1gO1xuICAgICAgICBcbiAgICAgICAgLy8gVGFzayBtZXRhZGF0YVxuICAgICAgICBjb25zdCBtZXRhID0gY29udGVudC5jcmVhdGVEaXYoJ3Rhc2stbWV0YScpO1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIG1lZXRpbmcgc291cmNlXG4gICAgICAgIGNvbnN0IHNvdXJjZVNwYW4gPSBtZXRhLmNyZWF0ZUVsKCdzcGFuJywgeyBcbiAgICAgICAgICBjbHM6ICd0YXNrLXNvdXJjZSBjbGlja2FibGUnLFxuICAgICAgICAgIHRleHQ6IGBcdUQ4M0RcdURDQzQgJHt0YXNrLmZpbGUuYmFzZW5hbWV9YFxuICAgICAgICB9KTtcbiAgICAgICAgc291cmNlU3Bhbi5vbmNsaWNrID0gdGV4dFNwYW4ub25jbGljazsgLy8gU2FtZSBjbGljayBoYW5kbGVyXG4gICAgICAgIHNvdXJjZVNwYW4udGl0bGUgPSBgQ2xpY2sgdG8gb3BlbjogJHt0YXNrLmZpbGUuYmFzZW5hbWV9YDtcbiAgICAgICAgXG4gICAgICAgIGlmICh0YXNrLmR1ZURhdGUpIHtcbiAgICAgICAgICBjb25zdCBkdWVTcGFuID0gbWV0YS5jcmVhdGVFbCgnc3BhbicsIHsgY2xzOiAndGFzay1kdWUnIH0pO1xuICAgICAgICAgIGR1ZVNwYW4uc2V0VGV4dChgXHVEODNEXHVEQ0M1ICR7dGFzay5kdWVEYXRlfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIENoZWNrIGlmIG92ZXJkdWVcbiAgICAgICAgICBpZiAoIXRhc2suY29tcGxldGVkICYmIG5ldyBEYXRlKHRhc2suZHVlRGF0ZSkgPCBuZXcgRGF0ZSgpKSB7XG4gICAgICAgICAgICBkdWVTcGFuLmFkZENsYXNzKCdvdmVyZHVlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAodGFzay5jYXRlZ29yeSkge1xuICAgICAgICAgIG1ldGEuY3JlYXRlRWwoJ3NwYW4nLCB7IFxuICAgICAgICAgICAgdGV4dDogYCMke3Rhc2suY2F0ZWdvcnl9YCxcbiAgICAgICAgICAgIGNsczogJ3Rhc2stY2F0ZWdvcnknXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmICh0YXNrLmNvbmZpZGVuY2UgJiYgdGFzay5jb25maWRlbmNlIDwgNzApIHtcbiAgICAgICAgICBtZXRhLmNyZWF0ZUVsKCdzcGFuJywgeyBcbiAgICAgICAgICAgIHRleHQ6IGBcdTI2QTBcdUZFMEYgJHt0YXNrLmNvbmZpZGVuY2V9JWAsXG4gICAgICAgICAgICBjbHM6ICd0YXNrLWNvbmZpZGVuY2UnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFNvdXJjZSBmaWxlIGxpbmtcbiAgICAgICAgY29uc3QgZmlsZUxpbmsgPSBtZXRhLmNyZWF0ZUVsKCdhJywge1xuICAgICAgICAgIHRleHQ6ICdcdUQ4M0RcdURDQzQnLFxuICAgICAgICAgIGNsczogJ3Rhc2stc291cmNlJyxcbiAgICAgICAgICB0aXRsZTogdGFzay5maWxlLmJhc2VuYW1lXG4gICAgICAgIH0pO1xuICAgICAgICBmaWxlTGluay5vbmNsaWNrID0gKGUpID0+IHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZSh0YXNrLmZpbGUpO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkIGVkaXQgYnV0dG9uIGFzIGEgc2VwYXJhdGUgZWxlbWVudCBhdCB0aGUgZW5kXG4gICAgICAgIGNvbnN0IHRhc2tFZGl0QnRuID0gbGkuY3JlYXRlRWwoJ2J1dHRvbicsIHsgXG4gICAgICAgICAgY2xzOiAndGFzay1lZGl0LWJ0bicsXG4gICAgICAgICAgdGV4dDogJ1x1MjcwRlx1RkUwRicsXG4gICAgICAgICAgdGl0bGU6ICdFZGl0IHRhc2snXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gRWRpdCBjb250cm9scyBmb3IgdGhpcyBzcGVjaWZpYyB0YXNrIChoaWRkZW4gYnkgZGVmYXVsdClcbiAgICAgICAgY29uc3QgZWRpdENvbnRyb2xzID0gbGkuY3JlYXRlRWwoJ2RpdicsIHsgY2xzOiAndGFzay1lZGl0LWNvbnRyb2xzJyB9KTtcbiAgICAgICAgZWRpdENvbnRyb2xzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIFxuICAgICAgICBsZXQgZWRpdE1vZGUgPSBmYWxzZTtcbiAgICAgICAgdGFza0VkaXRCdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICBlZGl0TW9kZSA9ICFlZGl0TW9kZTtcbiAgICAgICAgICBlZGl0Q29udHJvbHMuc3R5bGUuZGlzcGxheSA9IGVkaXRNb2RlID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgICAgICAgICB0YXNrRWRpdEJ0bi5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnLCBlZGl0TW9kZSk7XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBBZGQgZWRpdCBjb250cm9scyBmb3IgdGhpcyB0YXNrXG4gICAgICAgIGlmIChlZGl0Q29udHJvbHMpIHtcbiAgICAgICAgICBjb25zdCB0YXNrRWRpdFJvdyA9IGVkaXRDb250cm9scy5jcmVhdGVEaXYoJ3Rhc2stZWRpdC1yb3cnKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBQcmlvcml0eSBzZWxlY3RvclxuICAgICAgICAgIGNvbnN0IHByaW9yaXR5U2VsZWN0ID0gdGFza0VkaXRSb3cuY3JlYXRlRWwoJ3NlbGVjdCcsIHsgY2xzOiAndGFzay1wcmlvcml0eS1zZWxlY3QnIH0pO1xuICAgICAgICAgIFsnaGlnaCcsICdtZWRpdW0nLCAnbG93J10uZm9yRWFjaChwID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbiA9IHByaW9yaXR5U2VsZWN0LmNyZWF0ZUVsKCdvcHRpb24nLCB7IHRleHQ6IHAsIHZhbHVlOiBwIH0pO1xuICAgICAgICAgICAgaWYgKHAgPT09IHRhc2sucHJpb3JpdHkpIG9wdGlvbi5zZWxlY3RlZCA9IHRydWU7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJpb3JpdHlTZWxlY3Qub25jaGFuZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVRhc2tQcmlvcml0eSh0YXNrLCBwcmlvcml0eVNlbGVjdC52YWx1ZSBhcyAnaGlnaCcgfCAnbWVkaXVtJyB8ICdsb3cnLCBsaSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBBc3NpZ25lZSBpbnB1dFxuICAgICAgICAgIGNvbnN0IGFzc2lnbmVlSW5wdXQgPSB0YXNrRWRpdFJvdy5jcmVhdGVFbCgnaW5wdXQnLCB7IFxuICAgICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgICAgY2xzOiAndGFzay1hc3NpZ25lZS1pbnB1dCcsXG4gICAgICAgICAgICBwbGFjZWhvbGRlcjogJ0Fzc2lnbiB0by4uLicsXG4gICAgICAgICAgICB2YWx1ZTogdGFzay5hc3NpZ25lZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNhdmUgYnV0dG9uIGZvciBhc3NpZ25lZVxuICAgICAgICAgIGNvbnN0IHNhdmVCdG4gPSB0YXNrRWRpdFJvdy5jcmVhdGVFbCgnYnV0dG9uJywgeyBcbiAgICAgICAgICAgIHRleHQ6ICdcdTI3MTMnLFxuICAgICAgICAgICAgY2xzOiAndGFzay1zYXZlLWJ0bicsXG4gICAgICAgICAgICB0aXRsZTogJ1NhdmUgYXNzaWduZWUnXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2F2ZUJ0bi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVUYXNrQXNzaWduZWUodGFzaywgYXNzaWduZWVJbnB1dC52YWx1ZSwgbGkpO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHRvZ2dsZVRhc2sodGFzazogVGFzaywgY29tcGxldGVkOiBib29sZWFuLCBsaXN0SXRlbT86IEhUTUxFbGVtZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHRhc2suZmlsZSk7XG4gICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIGNoZWNrYm94XG4gICAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICAgIGxpbmVzW3Rhc2subGluZV0gPSB0YXNrLnJhd0xpbmUucmVwbGFjZSgnWyBdJywgJ1t4XScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGluZXNbdGFzay5saW5lXSA9IHRhc2sucmF3TGluZS5yZXBsYWNlKCdbeF0nLCAnWyBdJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeSh0YXNrLmZpbGUsIGxpbmVzLmpvaW4oJ1xcbicpKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIHRoZSB0YXNrIGluIG91ciBkYXRhXG4gICAgICB0YXNrLmNvbXBsZXRlZCA9IGNvbXBsZXRlZDtcbiAgICAgIFxuICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgbGlzdCBpdGVtIGVsZW1lbnQgYW5kIHRhc2sgaXMgY29tcGxldGVkLCBhbmltYXRlIGFuZCByZW1vdmUgaXRcbiAgICAgIGlmIChsaXN0SXRlbSAmJiBjb21wbGV0ZWQpIHtcbiAgICAgICAgLy8gQWRkIGZhZGUtb3V0IGFuaW1hdGlvblxuICAgICAgICBsaXN0SXRlbS5zdHlsZS50cmFuc2l0aW9uID0gJ29wYWNpdHkgMC4zcyBlYXNlLW91dCwgdHJhbnNmb3JtIDAuM3MgZWFzZS1vdXQnO1xuICAgICAgICBsaXN0SXRlbS5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBsaXN0SXRlbS5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlWCgtMTBweCknO1xuICAgICAgICBcbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBlbGVtZW50IGFmdGVyIGFuaW1hdGlvbiBjb21wbGV0ZXNcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgbGlzdEl0ZW0ucmVtb3ZlKCk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGNhcmQgaGFzIG5vIG1vcmUgdGFza3MgYW5kIHJlbW92ZSBpdFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBsaXN0SXRlbS5jbG9zZXN0KCcudGFzay1jYXJkJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgaWYgKGNhcmQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbWFpbmluZ1Rhc2tzID0gY2FyZC5xdWVyeVNlbGVjdG9yQWxsKCcudGFzay1saXN0LWl0ZW0nKTtcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmdUYXNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgY2FyZC5zdHlsZS50cmFuc2l0aW9uID0gJ29wYWNpdHkgMC4zcyBlYXNlLW91dCc7XG4gICAgICAgICAgICAgIGNhcmQuc3R5bGUub3BhY2l0eSA9ICcwJztcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY2FyZC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgc2VjdGlvbiBpcyBub3cgZW1wdHkgYW5kIGhpZGUgaXRcbiAgICAgICAgICAgICAgICBjb25zdCBzZWN0aW9uID0gY2FyZC5jbG9zZXN0KCcudGFzay1zZWN0aW9uJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgaWYgKHNlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbWFpbmluZ0NhcmRzID0gc2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCcudGFzay1jYXJkJyk7XG4gICAgICAgICAgICAgICAgICBpZiAocmVtYWluaW5nQ2FyZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlY3Rpb24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sIDMwMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc3RhdHMgd2l0aG91dCBmdWxsIHJlZnJlc2hcbiAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRzT25seSgpO1xuICAgICAgICAgIC8vIFVwZGF0ZSBmaWx0ZXIgY291bnRzIGFmdGVyIHRhc2sgY29tcGxldGlvblxuICAgICAgICAgIHRoaXMudXBkYXRlRmlsdGVyQ291bnRzKCk7XG4gICAgICAgIH0sIDMwMCk7XG4gICAgICB9IGVsc2UgaWYgKCFjb21wbGV0ZWQpIHtcbiAgICAgICAgLy8gSWYgdW5jaGVja2luZywgd2UgbmVlZCB0byByZWZyZXNoIHRvIHNob3cgaXQgYWdhaW5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLnJlZnJlc2goKSwgNTAwKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHRvZ2dsZSB0YXNrOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byB1cGRhdGUgdGFzay4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHVwZGF0ZVRhc2tQcmlvcml0eSh0YXNrOiBUYXNrLCBuZXdQcmlvcml0eTogJ2hpZ2gnIHwgJ21lZGl1bScgfCAnbG93JywgdGFza0VsZW1lbnQ/OiBIVE1MRWxlbWVudCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0YXNrLmZpbGUpO1xuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICBcbiAgICAvLyBHZXQgdGhlIGN1cnJlbnQgbGluZVxuICAgIGxldCBsaW5lID0gbGluZXNbdGFzay5saW5lXTtcbiAgICBcbiAgICAvLyBSZW1vdmUgb2xkIHByaW9yaXR5IGluZGljYXRvcnNcbiAgICBsaW5lID0gbGluZS5yZXBsYWNlKC9cdUQ4M0RcdUREMzRcXHMqL2csICcnKS5yZXBsYWNlKC9cdUQ4M0RcdURGRTFcXHMqL2csICcnKS5yZXBsYWNlKC9cdUQ4M0RcdURGRTJcXHMqL2csICcnKTtcbiAgICBsaW5lID0gbGluZS5yZXBsYWNlKC9IaWdoIFByaW9yaXR5L2dpLCAnJykucmVwbGFjZSgvTWVkaXVtIFByaW9yaXR5L2dpLCAnJykucmVwbGFjZSgvTG93IFByaW9yaXR5L2dpLCAnJyk7XG4gICAgXG4gICAgLy8gQWRkIG5ldyBwcmlvcml0eSBpbmRpY2F0b3IgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgdGFzayB0ZXh0XG4gICAgY29uc3QgY2hlY2tib3hNYXRjaCA9IGxpbmUubWF0Y2goL14oW1xccy1dKilcXFsoW3ggXT8pXFxdXFxzKi8pO1xuICAgIGlmIChjaGVja2JveE1hdGNoKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBjaGVja2JveE1hdGNoWzBdO1xuICAgICAgY29uc3QgcmVzdE9mTGluZSA9IGxpbmUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGgpO1xuICAgICAgXG4gICAgICBsZXQgcHJpb3JpdHlJbmRpY2F0b3IgPSAnJztcbiAgICAgIGlmIChuZXdQcmlvcml0eSA9PT0gJ2hpZ2gnKSB7XG4gICAgICAgIHByaW9yaXR5SW5kaWNhdG9yID0gJ1x1RDgzRFx1REQzNCAnO1xuICAgICAgfSBlbHNlIGlmIChuZXdQcmlvcml0eSA9PT0gJ21lZGl1bScpIHtcbiAgICAgICAgcHJpb3JpdHlJbmRpY2F0b3IgPSAnXHVEODNEXHVERkUxICc7XG4gICAgICB9IGVsc2UgaWYgKG5ld1ByaW9yaXR5ID09PSAnbG93Jykge1xuICAgICAgICBwcmlvcml0eUluZGljYXRvciA9ICdcdUQ4M0RcdURGRTIgJztcbiAgICAgIH1cbiAgICAgIFxuICAgICAgbGluZXNbdGFzay5saW5lXSA9IHByZWZpeCArIHByaW9yaXR5SW5kaWNhdG9yICsgcmVzdE9mTGluZS50cmltKCk7XG4gICAgfVxuICAgIFxuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHRhc2suZmlsZSwgbGluZXMuam9pbignXFxuJykpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGFzayBkYXRhXG4gICAgICB0YXNrLnByaW9yaXR5ID0gbmV3UHJpb3JpdHk7XG4gICAgICBcbiAgICAgIC8vIElmIHdlIGhhdmUgdGhlIHRhc2sgZWxlbWVudCwgbW92ZSBpdCB0byB0aGUgbmV3IHByaW9yaXR5IHNlY3Rpb25cbiAgICAgIGlmICh0YXNrRWxlbWVudCkge1xuICAgICAgICBjb25zdCBjdXJyZW50Q2FyZCA9IHRhc2tFbGVtZW50LmNsb3Nlc3QoJy50YXNrLWNhcmQnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgY29uc3QgY3VycmVudFNlY3Rpb24gPSBjdXJyZW50Q2FyZD8uY2xvc2VzdCgnLnRhc2stc2VjdGlvbicpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICBcbiAgICAgICAgaWYgKGN1cnJlbnRDYXJkICYmIGN1cnJlbnRTZWN0aW9uKSB7XG4gICAgICAgICAgLy8gRmluZCB0aGUgdGFyZ2V0IHNlY3Rpb25cbiAgICAgICAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgIGxldCB0YXJnZXRTZWN0aW9uQ2xhc3MgPSAnJztcbiAgICAgICAgICBpZiAobmV3UHJpb3JpdHkgPT09ICdoaWdoJykgdGFyZ2V0U2VjdGlvbkNsYXNzID0gJ2hpZ2gtcHJpb3JpdHknO1xuICAgICAgICAgIGVsc2UgaWYgKG5ld1ByaW9yaXR5ID09PSAnbWVkaXVtJykgdGFyZ2V0U2VjdGlvbkNsYXNzID0gJ21lZGl1bS1wcmlvcml0eSc7XG4gICAgICAgICAgZWxzZSB0YXJnZXRTZWN0aW9uQ2xhc3MgPSAnbG93LXByaW9yaXR5JztcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCB0YXJnZXRTZWN0aW9uID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoYC50YXNrLXNlY3Rpb24uJHt0YXJnZXRTZWN0aW9uQ2xhc3N9YCkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHRhcmdldFNlY3Rpb24gJiYgdGFyZ2V0U2VjdGlvbiAhPT0gY3VycmVudFNlY3Rpb24pIHtcbiAgICAgICAgICAgIC8vIEFuaW1hdGUgdGhlIG1vdmVcbiAgICAgICAgICAgIHRhc2tFbGVtZW50LnN0eWxlLnRyYW5zaXRpb24gPSAnb3BhY2l0eSAwLjNzIGVhc2Utb3V0JztcbiAgICAgICAgICAgIHRhc2tFbGVtZW50LnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAvLyBSZW1vdmUgZnJvbSBjdXJyZW50IGNhcmRcbiAgICAgICAgICAgICAgdGFza0VsZW1lbnQucmVtb3ZlKCk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBDaGVjayBpZiBjdXJyZW50IGNhcmQgaXMgbm93IGVtcHR5XG4gICAgICAgICAgICAgIGNvbnN0IHJlbWFpbmluZ1Rhc2tzID0gY3VycmVudENhcmQucXVlcnlTZWxlY3RvckFsbCgnLnRhc2stbGlzdC1pdGVtJyk7XG4gICAgICAgICAgICAgIGlmIChyZW1haW5pbmdUYXNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50Q2FyZC5zdHlsZS50cmFuc2l0aW9uID0gJ29wYWNpdHkgMC4zcyBlYXNlLW91dCc7XG4gICAgICAgICAgICAgICAgY3VycmVudENhcmQuc3R5bGUub3BhY2l0eSA9ICcwJztcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IGN1cnJlbnRDYXJkLnJlbW92ZSgpLCAzMDApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBGaW5kIG9yIGNyZWF0ZSBhc3NpZ25lZSBjYXJkIGluIHRhcmdldCBzZWN0aW9uXG4gICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVlID0gdGFzay5hc3NpZ25lZTtcbiAgICAgICAgICAgICAgbGV0IHRhcmdldENhcmQgPSBBcnJheS5mcm9tKHRhcmdldFNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCgnLnRhc2stY2FyZCcpKS5maW5kKGNhcmQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpdGxlID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdoMycpPy50ZXh0Q29udGVudDtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGl0bGU/LmluY2x1ZGVzKGFzc2lnbmVlKTtcbiAgICAgICAgICAgICAgfSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBpZiAoIXRhcmdldENhcmQpIHtcbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgbmV3IGNhcmRcbiAgICAgICAgICAgICAgICB0YXJnZXRDYXJkID0gdGFyZ2V0U2VjdGlvbi5jcmVhdGVEaXYoYHRhc2stY2FyZCAke25ld1ByaW9yaXR5fS1jYXJkYCk7XG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyID0gdGFyZ2V0Q2FyZC5jcmVhdGVEaXYoJ2NhcmQtaGVhZGVyJyk7XG4gICAgICAgICAgICAgICAgaGVhZGVyLmNyZWF0ZUVsKCdoMycsIHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6IGBcdUQ4M0RcdURDNjQgJHthc3NpZ25lZX1gLFxuICAgICAgICAgICAgICAgICAgY2xzOiAnY2FyZC1hc3NpZ25lZS10aXRsZSdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0YXJnZXRDYXJkLmNyZWF0ZUVsKCd1bCcsIHsgY2xzOiAndGFzay1saXN0JyB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gQWRkIHRhc2sgdG8gdGFyZ2V0IGNhcmRcbiAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0TGlzdCA9IHRhcmdldENhcmQucXVlcnlTZWxlY3RvcignLnRhc2stbGlzdCcpO1xuICAgICAgICAgICAgICBpZiAodGFyZ2V0TGlzdCkge1xuICAgICAgICAgICAgICAgIC8vIENsb25lIHRoZSB0YXNrIGVsZW1lbnQgc3RydWN0dXJlXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TGkgPSB0YXJnZXRMaXN0LmNyZWF0ZUVsKCdsaScsIHsgY2xzOiAndGFzay1saXN0LWl0ZW0nIH0pO1xuICAgICAgICAgICAgICAgIG5ld0xpLmlubmVySFRNTCA9IHRhc2tFbGVtZW50LmlubmVySFRNTDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZWF0dGFjaCBldmVudCBoYW5kbGVyc1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoZWNrYm94ID0gbmV3TGkucXVlcnlTZWxlY3RvcignLnRhc2stY2hlY2tib3gnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgICAgICAgICAgICAgIGlmIChjaGVja2JveCkge1xuICAgICAgICAgICAgICAgICAgY2hlY2tib3gub25jbGljayA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy50b2dnbGVUYXNrKHRhc2ssIGNoZWNrYm94LmNoZWNrZWQsIG5ld0xpKTtcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEZhZGUgaW5cbiAgICAgICAgICAgICAgICBuZXdMaS5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgbmV3TGkuc3R5bGUudHJhbnNpdGlvbiA9ICdvcGFjaXR5IDAuM3MgZWFzZS1pbic7XG4gICAgICAgICAgICAgICAgICBuZXdMaS5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgICAgICAgICAgICAgIH0sIDEwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gVXBkYXRlIHN0YXRzXG4gICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHNPbmx5KCk7XG4gICAgICAgICAgICB9LCAzMDApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRmFsbGJhY2sgdG8gcmVmcmVzaCBpZiBubyBlbGVtZW50IHByb3ZpZGVkXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5yZWZyZXNoKCksIDUwMCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgdGFzayBwcmlvcml0eTonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKCdGYWlsZWQgdG8gdXBkYXRlIHByaW9yaXR5LiBQbGVhc2UgdHJ5IGFnYWluLicpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgdXBkYXRlVGFza0Fzc2lnbmVlKHRhc2s6IFRhc2ssIG5ld0Fzc2lnbmVlOiBzdHJpbmcsIHRhc2tFbGVtZW50PzogSFRNTEVsZW1lbnQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGFzay5maWxlKTtcbiAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgXG4gICAgLy8gR2V0IHRoZSBjdXJyZW50IGxpbmVcbiAgICBsZXQgbGluZSA9IGxpbmVzW3Rhc2subGluZV07XG4gICAgXG4gICAgLy8gUmVtb3ZlIG9sZCBhc3NpZ25lZVxuICAgIGxpbmUgPSBsaW5lLnJlcGxhY2UoL1xcW1xcW0A/W15cXF1dK1xcXVxcXS9nLCAnJyk7XG4gICAgXG4gICAgLy8gQWRkIG5ldyBhc3NpZ25lZSBiZWZvcmUgdGhlIGRhdGUgaWYgcHJlc2VudCwgb3RoZXJ3aXNlIGF0IHRoZSBlbmRcbiAgICBjb25zdCBkYXRlTWF0Y2ggPSBsaW5lLm1hdGNoKC9cdUQ4M0RcdURDQzVcXHMqXFxkezR9LVxcZHsyfS1cXGR7Mn0vKTtcbiAgICBpZiAoZGF0ZU1hdGNoICYmIGRhdGVNYXRjaC5pbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBJbnNlcnQgYmVmb3JlIGRhdGVcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cmluZygwLCBkYXRlTWF0Y2guaW5kZXgpICsgXG4gICAgICAgICAgICAgYFtbQCR7bmV3QXNzaWduZWUudHJpbSgpfV1dIGAgKyBcbiAgICAgICAgICAgICBsaW5lLnN1YnN0cmluZyhkYXRlTWF0Y2guaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBZGQgYXQgdGhlIGVuZFxuICAgICAgbGluZSA9IGxpbmUudHJpbSgpICsgYCBbW0Ake25ld0Fzc2lnbmVlLnRyaW0oKX1dXWA7XG4gICAgfVxuICAgIFxuICAgIGxpbmVzW3Rhc2subGluZV0gPSBsaW5lO1xuICAgIFxuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHRhc2suZmlsZSwgbGluZXMuam9pbignXFxuJykpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGFzayBkYXRhXG4gICAgICBjb25zdCBvbGRBc3NpZ25lZSA9IHRhc2suYXNzaWduZWU7XG4gICAgICB0YXNrLmFzc2lnbmVlID0gbmV3QXNzaWduZWUudHJpbSgpO1xuICAgICAgXG4gICAgICAvLyBJZiB3ZSBoYXZlIHRoZSB0YXNrIGVsZW1lbnQsIG1vdmUgaXQgdG8gdGhlIG5ldyBhc3NpZ25lZSdzIGNhcmRcbiAgICAgIGlmICh0YXNrRWxlbWVudCAmJiBvbGRBc3NpZ25lZSAhPT0gdGFzay5hc3NpZ25lZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50Q2FyZCA9IHRhc2tFbGVtZW50LmNsb3Nlc3QoJy50YXNrLWNhcmQnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgY29uc3QgY3VycmVudFNlY3Rpb24gPSBjdXJyZW50Q2FyZD8uY2xvc2VzdCgnLnRhc2stc2VjdGlvbicpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICBcbiAgICAgICAgaWYgKGN1cnJlbnRDYXJkICYmIGN1cnJlbnRTZWN0aW9uKSB7XG4gICAgICAgICAgLy8gQW5pbWF0ZSB0aGUgbW92ZVxuICAgICAgICAgIHRhc2tFbGVtZW50LnN0eWxlLnRyYW5zaXRpb24gPSAnb3BhY2l0eSAwLjNzIGVhc2Utb3V0JztcbiAgICAgICAgICB0YXNrRWxlbWVudC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICAgIFxuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIGZyb20gY3VycmVudCBjYXJkXG4gICAgICAgICAgICB0YXNrRWxlbWVudC5yZW1vdmUoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgY3VycmVudCBjYXJkIGlzIG5vdyBlbXB0eVxuICAgICAgICAgICAgY29uc3QgcmVtYWluaW5nVGFza3MgPSBjdXJyZW50Q2FyZC5xdWVyeVNlbGVjdG9yQWxsKCcudGFzay1saXN0LWl0ZW0nKTtcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmdUYXNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgY3VycmVudENhcmQuc3R5bGUudHJhbnNpdGlvbiA9ICdvcGFjaXR5IDAuM3MgZWFzZS1vdXQnO1xuICAgICAgICAgICAgICBjdXJyZW50Q2FyZC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IGN1cnJlbnRDYXJkLnJlbW92ZSgpLCAzMDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGaW5kIG9yIGNyZWF0ZSBhc3NpZ25lZSBjYXJkIGluIHRoZSBzYW1lIHNlY3Rpb25cbiAgICAgICAgICAgIGxldCB0YXJnZXRDYXJkID0gQXJyYXkuZnJvbShjdXJyZW50U2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCcudGFzay1jYXJkJykpLmZpbmQoY2FyZCA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHRpdGxlID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdoMycpPy50ZXh0Q29udGVudDtcbiAgICAgICAgICAgICAgcmV0dXJuIHRpdGxlPy5pbmNsdWRlcyh0YXNrLmFzc2lnbmVlKTtcbiAgICAgICAgICAgIH0pIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXRhcmdldENhcmQpIHtcbiAgICAgICAgICAgICAgLy8gQ3JlYXRlIG5ldyBjYXJkIGZvciB0aGUgbmV3IGFzc2lnbmVlXG4gICAgICAgICAgICAgIGNvbnN0IHByaW9yaXR5ID0gdGFzay5wcmlvcml0eSB8fCAnbWVkaXVtJztcbiAgICAgICAgICAgICAgdGFyZ2V0Q2FyZCA9IGN1cnJlbnRTZWN0aW9uLmNyZWF0ZURpdihgdGFzay1jYXJkICR7cHJpb3JpdHl9LWNhcmRgKTtcbiAgICAgICAgICAgICAgY29uc3QgaGVhZGVyID0gdGFyZ2V0Q2FyZC5jcmVhdGVEaXYoJ2NhcmQtaGVhZGVyJyk7XG4gICAgICAgICAgICAgIGhlYWRlci5jcmVhdGVFbCgnaDMnLCB7XG4gICAgICAgICAgICAgICAgdGV4dDogYFx1RDgzRFx1REM2NCAke3Rhc2suYXNzaWduZWV9YCxcbiAgICAgICAgICAgICAgICBjbHM6ICdjYXJkLWFzc2lnbmVlLXRpdGxlJ1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgdGFyZ2V0Q2FyZC5jcmVhdGVFbCgndWwnLCB7IGNsczogJ3Rhc2stbGlzdCcgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEFkZCB0YXNrIHRvIHRhcmdldCBjYXJkXG4gICAgICAgICAgICBjb25zdCB0YXJnZXRMaXN0ID0gdGFyZ2V0Q2FyZC5xdWVyeVNlbGVjdG9yKCcudGFzay1saXN0Jyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0TGlzdCkge1xuICAgICAgICAgICAgICAvLyBDbG9uZSB0aGUgdGFzayBlbGVtZW50IHN0cnVjdHVyZVxuICAgICAgICAgICAgICBjb25zdCBuZXdMaSA9IHRhcmdldExpc3QuY3JlYXRlRWwoJ2xpJywgeyBjbHM6ICd0YXNrLWxpc3QtaXRlbScgfSk7XG4gICAgICAgICAgICAgIG5ld0xpLmlubmVySFRNTCA9IHRhc2tFbGVtZW50LmlubmVySFRNTDtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgZGlzcGxheWVkIGFzc2lnbmVlIGluIHRoZSBtZXRhZGF0YVxuICAgICAgICAgICAgICBjb25zdCBtZXRhZGF0YVNwYW4gPSBuZXdMaS5xdWVyeVNlbGVjdG9yKCcudGFzay1tZXRhZGF0YScpO1xuICAgICAgICAgICAgICBpZiAobWV0YWRhdGFTcGFuKSB7XG4gICAgICAgICAgICAgICAgbWV0YWRhdGFTcGFuLmlubmVySFRNTCA9IG1ldGFkYXRhU3Bhbi5pbm5lckhUTUwucmVwbGFjZSgvXHVEODNEXHVEQzY0XFxzKltePF0qL2csIGBcdUQ4M0RcdURDNjQgJHt0YXNrLmFzc2lnbmVlfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBSZWF0dGFjaCBldmVudCBoYW5kbGVyc1xuICAgICAgICAgICAgICBjb25zdCBjaGVja2JveCA9IG5ld0xpLnF1ZXJ5U2VsZWN0b3IoJy50YXNrLWNoZWNrYm94JykgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICAgICAgICAgICAgaWYgKGNoZWNrYm94KSB7XG4gICAgICAgICAgICAgICAgY2hlY2tib3gub25jbGljayA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudG9nZ2xlVGFzayh0YXNrLCBjaGVja2JveC5jaGVja2VkLCBuZXdMaSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgLy8gUmVhdHRhY2ggZWRpdCBidXR0b24gaGFuZGxlclxuICAgICAgICAgICAgICBjb25zdCBlZGl0QnRuID0gbmV3TGkucXVlcnlTZWxlY3RvcignLmVkaXQtYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgICAgIGlmIChlZGl0QnRuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWRpdENvbnRhaW5lciA9IG5ld0xpLnF1ZXJ5U2VsZWN0b3IoJy5lZGl0LWNvbnRhaW5lcicpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgICAgICAgIGlmIChlZGl0Q29udGFpbmVyKSB7XG4gICAgICAgICAgICAgICAgICBlZGl0QnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGVkaXRDb250YWluZXIuc3R5bGUuZGlzcGxheSA9IGVkaXRDb250YWluZXIuc3R5bGUuZGlzcGxheSA9PT0gJ25vbmUnID8gJ2ZsZXgnIDogJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgLy8gUmVhdHRhY2ggcHJpb3JpdHkgYW5kIGFzc2lnbmVlIGhhbmRsZXJzXG4gICAgICAgICAgICAgICAgICBjb25zdCBwcmlvcml0eVNlbGVjdCA9IGVkaXRDb250YWluZXIucXVlcnlTZWxlY3Rvcignc2VsZWN0JykgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICBpZiAocHJpb3JpdHlTZWxlY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHlTZWxlY3Qub25jaGFuZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVUYXNrUHJpb3JpdHkodGFzaywgcHJpb3JpdHlTZWxlY3QudmFsdWUgYXMgJ2hpZ2gnIHwgJ21lZGl1bScgfCAnbG93JywgbmV3TGkpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICBjb25zdCBzYXZlQnRuID0gZWRpdENvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdidXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVlSW5wdXQgPSBlZGl0Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0JykgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICAgICAgICAgICAgICAgIGlmIChzYXZlQnRuICYmIGFzc2lnbmVlSW5wdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2F2ZUJ0bi5vbmNsaWNrID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudXBkYXRlVGFza0Fzc2lnbmVlKHRhc2ssIGFzc2lnbmVlSW5wdXQudmFsdWUsIG5ld0xpKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIEZhZGUgaW5cbiAgICAgICAgICAgICAgbmV3TGkuc3R5bGUub3BhY2l0eSA9ICcwJztcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgbmV3TGkuc3R5bGUudHJhbnNpdGlvbiA9ICdvcGFjaXR5IDAuM3MgZWFzZS1pbic7XG4gICAgICAgICAgICAgICAgbmV3TGkuc3R5bGUub3BhY2l0eSA9ICcxJztcbiAgICAgICAgICAgICAgfSwgMTApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBVcGRhdGUgc3RhdHNcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHNPbmx5KCk7XG4gICAgICAgICAgfSwgMzAwKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdGFza0VsZW1lbnQpIHtcbiAgICAgICAgLy8gRmFsbGJhY2sgdG8gcmVmcmVzaCBpZiBubyBlbGVtZW50IHByb3ZpZGVkXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5yZWZyZXNoKCksIDUwMCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgdGFzayBhc3NpZ25lZTonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKCdGYWlsZWQgdG8gdXBkYXRlIGFzc2lnbmVlLiBQbGVhc2UgdHJ5IGFnYWluLicpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlGaWx0ZXIoZmlsdGVyOiBzdHJpbmcpIHtcbiAgICBjb25zdCBzZWN0aW9ucyA9IHRoaXMuY29udGFpbmVyRWwucXVlcnlTZWxlY3RvckFsbCgnLnRhc2stc2VjdGlvbicpO1xuICAgIFxuICAgIHNlY3Rpb25zLmZvckVhY2goKHNlY3Rpb246IEVsZW1lbnQpID0+IHtcbiAgICAgIGlmICghKHNlY3Rpb24gaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHJldHVybjtcbiAgICAgIGNvbnN0IGNhcmRzID0gc2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCcudGFzay1jYXJkJyk7XG4gICAgICBsZXQgc2VjdGlvbkhhc1Zpc2libGVDYXJkcyA9IGZhbHNlO1xuICAgICAgXG4gICAgICBjYXJkcy5mb3JFYWNoKChjYXJkOiBFbGVtZW50KSA9PiB7XG4gICAgICAgIGlmICghKGNhcmQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHJldHVybjtcbiAgICAgICAgbGV0IHNob3cgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgc3dpdGNoKGZpbHRlcikge1xuICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICBzaG93ID0gdHJ1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2hpZ2gnOlxuICAgICAgICAgICAgc2hvdyA9IGNhcmQuaGFzQ2xhc3MoJ2hpZ2gtY2FyZCcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbWVkaXVtJzpcbiAgICAgICAgICAgIHNob3cgPSBjYXJkLmhhc0NsYXNzKCdtZWRpdW0tY2FyZCcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbG93JzpcbiAgICAgICAgICAgIHNob3cgPSBjYXJkLmhhc0NsYXNzKCdsb3ctY2FyZCcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnY29tcGxldGVkJzpcbiAgICAgICAgICAgIHNob3cgPSBjYXJkLmhhc0NsYXNzKCdjb21wbGV0ZWQtY2FyZCcpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbWluZSc6XG4gICAgICAgICAgICBjb25zdCBhc3NpZ25lZUVsID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdoMycpO1xuICAgICAgICAgICAgaWYgKGFzc2lnbmVlRWwgJiYgYXNzaWduZWVFbC50ZXh0Q29udGVudCkge1xuICAgICAgICAgICAgICAvLyBSZW1vdmUgZW1vamkgcHJlZml4IGFuZCB0cmltXG4gICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVlID0gYXNzaWduZWVFbC50ZXh0Q29udGVudC5yZXBsYWNlKC9eXHVEODNEXHVEQzY0XFxzKi8sICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgY29uc3QgbXlOYW1lc1N0ciA9IHRoaXMucGx1Z2luPy5zZXR0aW5ncz8uZGFzaGJvYXJkTXlOYW1lPy50b0xvd2VyQ2FzZSgpPy50cmltKCk7XG4gICAgICAgICAgICAgIGlmIChteU5hbWVzU3RyKSB7XG4gICAgICAgICAgICAgICAgLy8gU3VwcG9ydCBjb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBuYW1lc1xuICAgICAgICAgICAgICAgIGNvbnN0IG15TmFtZXMgPSBteU5hbWVzU3RyXG4gICAgICAgICAgICAgICAgICAuc3BsaXQoJywnKVxuICAgICAgICAgICAgICAgICAgLm1hcChuYW1lID0+IG5hbWUudHJpbSgpKVxuICAgICAgICAgICAgICAgICAgLmZpbHRlcihuYW1lID0+IG5hbWUubGVuZ3RoID4gMCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYXNzaWduZWUgbWF0Y2hlcyBhbnkgb2YgdGhlIG5hbWVzXG4gICAgICAgICAgICAgICAgc2hvdyA9IG15TmFtZXMuc29tZShuYW1lID0+IFxuICAgICAgICAgICAgICAgICAgYXNzaWduZWUgPT09IG5hbWUgfHwgYXNzaWduZWUuaW5jbHVkZXMobmFtZSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNob3cgPSBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc2hvdyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnb3ZlcmR1ZSc6XG4gICAgICAgICAgICBzaG93ID0gdGhpcy5oYXNUYXNrc092ZXJkdWUoY2FyZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICd0b2RheSc6XG4gICAgICAgICAgICBzaG93ID0gdGhpcy5oYXNUYXNrc0R1ZVRvZGF5KGNhcmQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnd2Vlayc6XG4gICAgICAgICAgICBzaG93ID0gdGhpcy5oYXNUYXNrc0R1ZVRoaXNXZWVrKGNhcmQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNhcmQuc3R5bGUuZGlzcGxheSA9IHNob3cgPyAnYmxvY2snIDogJ25vbmUnO1xuICAgICAgICBpZiAoc2hvdykgc2VjdGlvbkhhc1Zpc2libGVDYXJkcyA9IHRydWU7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gSGlkZSBzZWN0aW9uIGlmIG5vIGNhcmRzIGFyZSB2aXNpYmxlXG4gICAgICBzZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBzZWN0aW9uSGFzVmlzaWJsZUNhcmRzID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgICB9KTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYXNUYXNrc0R1ZVRvZGF5KGNhcmQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIGNvbXBsZXRlZCBjYXJkIC0gbmV2ZXIgc2hvdyBjb21wbGV0ZWQgY2FyZHMgZm9yIGRhdGUgZmlsdGVyc1xuICAgIGlmIChjYXJkLmNsYXNzTGlzdC5jb250YWlucygnY29tcGxldGVkLWNhcmQnKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB0YXNrSXRlbXMgPSBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJy50YXNrLWxpc3QtaXRlbScpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICB0b2RheS5zZXRIb3VycygwLCAwLCAwLCAwKTtcbiAgICBjb25zdCB0b21vcnJvdyA9IG5ldyBEYXRlKHRvZGF5KTtcbiAgICB0b21vcnJvdy5zZXREYXRlKHRvbW9ycm93LmdldERhdGUoKSArIDEpO1xuICAgIFxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBBcnJheS5mcm9tKHRhc2tJdGVtcykpIHtcbiAgICAgIC8vIFNraXAgaWYgdGFzayBpcyBjb21wbGV0ZWRcbiAgICAgIGNvbnN0IGNoZWNrYm94ID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcudGFzay1jaGVja2JveCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICBpZiAoY2hlY2tib3ggJiYgY2hlY2tib3guY2hlY2tlZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTG9vayBmb3IgZHVlIGRhdGUgaW4gdGhlIHRhc2sgbWV0YWRhdGFcbiAgICAgIGNvbnN0IGR1ZURhdGVFbGVtID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcudGFzay1kdWUnKTtcbiAgICAgIGlmIChkdWVEYXRlRWxlbSkge1xuICAgICAgICBjb25zdCBkYXRlVGV4dCA9IGR1ZURhdGVFbGVtLnRleHRDb250ZW50Py5tYXRjaCgvXFxkezR9LVxcZHsyfS1cXGR7Mn0vKTtcbiAgICAgICAgaWYgKGRhdGVUZXh0KSB7XG4gICAgICAgICAgY29uc3QgZHVlRGF0ZSA9IG5ldyBEYXRlKGRhdGVUZXh0WzBdICsgJ1QwMDowMDowMCcpO1xuICAgICAgICAgIGR1ZURhdGUuc2V0SG91cnMoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGR1ZURhdGUgPj0gdG9kYXkgJiYgZHVlRGF0ZSA8IHRvbW9ycm93KSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gRm91bmQgYXQgbGVhc3Qgb25lIHRhc2sgZHVlIHRvZGF5XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYXNUYXNrc0R1ZVRoaXNXZWVrKGNhcmQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIGNvbXBsZXRlZCBjYXJkIC0gbmV2ZXIgc2hvdyBjb21wbGV0ZWQgY2FyZHMgZm9yIGRhdGUgZmlsdGVyc1xuICAgIGlmIChjYXJkLmNsYXNzTGlzdC5jb250YWlucygnY29tcGxldGVkLWNhcmQnKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB0YXNrSXRlbXMgPSBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJy50YXNrLWxpc3QtaXRlbScpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICB0b2RheS5zZXRIb3VycygwLCAwLCAwLCAwKTtcbiAgICBjb25zdCB3ZWVrRnJvbU5vdyA9IG5ldyBEYXRlKHRvZGF5KTtcbiAgICB3ZWVrRnJvbU5vdy5zZXREYXRlKHdlZWtGcm9tTm93LmdldERhdGUoKSArIDcpO1xuICAgIFxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBBcnJheS5mcm9tKHRhc2tJdGVtcykpIHtcbiAgICAgIC8vIFNraXAgaWYgdGFzayBpcyBjb21wbGV0ZWRcbiAgICAgIGNvbnN0IGNoZWNrYm94ID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcudGFzay1jaGVja2JveCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICBpZiAoY2hlY2tib3ggJiYgY2hlY2tib3guY2hlY2tlZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTG9vayBmb3IgZHVlIGRhdGUgaW4gdGhlIHRhc2sgbWV0YWRhdGFcbiAgICAgIGNvbnN0IGR1ZURhdGVFbGVtID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcudGFzay1kdWUnKTtcbiAgICAgIGlmIChkdWVEYXRlRWxlbSkge1xuICAgICAgICBjb25zdCBkYXRlVGV4dCA9IGR1ZURhdGVFbGVtLnRleHRDb250ZW50Py5tYXRjaCgvXFxkezR9LVxcZHsyfS1cXGR7Mn0vKTtcbiAgICAgICAgaWYgKGRhdGVUZXh0KSB7XG4gICAgICAgICAgY29uc3QgZHVlRGF0ZSA9IG5ldyBEYXRlKGRhdGVUZXh0WzBdICsgJ1QwMDowMDowMCcpO1xuICAgICAgICAgIGR1ZURhdGUuc2V0SG91cnMoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGR1ZURhdGUgPj0gdG9kYXkgJiYgZHVlRGF0ZSA8PSB3ZWVrRnJvbU5vdykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIEZvdW5kIGF0IGxlYXN0IG9uZSB0YXNrIGR1ZSB0aGlzIHdlZWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICBwcml2YXRlIGhhc1Rhc2tzT3ZlcmR1ZShjYXJkOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICAgIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBjb21wbGV0ZWQgY2FyZCAtIG5ldmVyIHNob3cgY29tcGxldGVkIGNhcmRzIGZvciBvdmVyZHVlIGZpbHRlclxuICAgIGlmIChjYXJkLmNsYXNzTGlzdC5jb250YWlucygnY29tcGxldGVkLWNhcmQnKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB0YXNrSXRlbXMgPSBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJy50YXNrLWxpc3QtaXRlbScpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICB0b2RheS5zZXRIb3VycygwLCAwLCAwLCAwKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgQXJyYXkuZnJvbSh0YXNrSXRlbXMpKSB7XG4gICAgICAvLyBTa2lwIGlmIHRhc2sgaXMgY29tcGxldGVkXG4gICAgICBjb25zdCBjaGVja2JveCA9IGl0ZW0ucXVlcnlTZWxlY3RvcignLnRhc2stY2hlY2tib3gnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgICAgaWYgKGNoZWNrYm94ICYmIGNoZWNrYm94LmNoZWNrZWQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIExvb2sgZm9yIGR1ZSBkYXRlIGluIHRoZSB0YXNrIG1ldGFkYXRhXG4gICAgICBjb25zdCBkdWVEYXRlRWxlbSA9IGl0ZW0ucXVlcnlTZWxlY3RvcignLnRhc2stZHVlJyk7XG4gICAgICBpZiAoZHVlRGF0ZUVsZW0pIHtcbiAgICAgICAgY29uc3QgZGF0ZVRleHQgPSBkdWVEYXRlRWxlbS50ZXh0Q29udGVudD8ubWF0Y2goL1xcZHs0fS1cXGR7Mn0tXFxkezJ9Lyk7XG4gICAgICAgIGlmIChkYXRlVGV4dCkge1xuICAgICAgICAgIGNvbnN0IGR1ZURhdGUgPSBuZXcgRGF0ZShkYXRlVGV4dFswXSArICdUMDA6MDA6MDAnKTtcbiAgICAgICAgICBkdWVEYXRlLnNldEhvdXJzKDAsIDAsIDAsIDApO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSB0YXNrIGlzIG92ZXJkdWUgKHBhc3QgZHVlIGRhdGUpXG4gICAgICAgICAgaWYgKGR1ZURhdGUgPCB0b2RheSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIEZvdW5kIGF0IGxlYXN0IG9uZSBvdmVyZHVlIHRhc2tcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVTdGF0c09ubHkoKSB7XG4gICAgLy8gU3RhdHMgc2VjdGlvbiBoYXMgYmVlbiByZW1vdmVkIC0gY291bnRlcnMgYXJlIG5vdyBzaG93biBpbiBmaWx0ZXIgYnV0dG9uc1xuICAgIC8vIFRoaXMgbWV0aG9kIGlzIGtlcHQgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgYnV0IGRvZXMgbm90aGluZ1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRGaWx0ZXJlZFRhc2tzKCk6IFRhc2tbXSB7XG4gICAgaWYgKHRoaXMuc2hvd09ubHlNeVRhc2tzICYmIHRoaXMucGx1Z2luPy5zZXR0aW5ncz8uZGFzaGJvYXJkTXlOYW1lKSB7XG4gICAgICAvLyBTdXBwb3J0IGNvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIG5hbWVzXG4gICAgICBjb25zdCBteU5hbWVzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGFzaGJvYXJkTXlOYW1lXG4gICAgICAgIC5zcGxpdCgnLCcpXG4gICAgICAgIC5tYXAobmFtZSA9PiBuYW1lLnRvTG93ZXJDYXNlKCkudHJpbSgpKVxuICAgICAgICAuZmlsdGVyKG5hbWUgPT4gbmFtZS5sZW5ndGggPiAwKTtcbiAgICAgIFxuICAgICAgaWYgKG15TmFtZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFsbFRhc2tzO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gdGhpcy5hbGxUYXNrcy5maWx0ZXIodCA9PiB7XG4gICAgICAgIGNvbnN0IGFzc2lnbmVlID0gdC5hc3NpZ25lZS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgLy8gQ2hlY2sgaWYgYXNzaWduZWUgbWF0Y2hlcyBhbnkgb2YgdGhlIG5hbWVzXG4gICAgICAgIHJldHVybiBteU5hbWVzLnNvbWUobmFtZSA9PiBcbiAgICAgICAgICBhc3NpZ25lZSA9PT0gbmFtZSB8fCBhc3NpZ25lZS5pbmNsdWRlcyhuYW1lKVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFsbFRhc2tzO1xuICB9XG4gIFxuICBwcml2YXRlIGNhbGN1bGF0ZUZpbHRlckNvdW50cyh0YXNrczogVGFza1tdKTogRmlsdGVyQ291bnRzIHtcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUobm93LmdldEZ1bGxZZWFyKCksIG5vdy5nZXRNb250aCgpLCBub3cuZ2V0RGF0ZSgpKTtcbiAgICBjb25zdCBlbmRPZlRvZGF5ID0gbmV3IERhdGUodG9kYXkuZ2V0VGltZSgpICsgMjQgKiA2MCAqIDYwICogMTAwMCAtIDEpO1xuICAgIGNvbnN0IHdlZWtGcm9tTm93ID0gbmV3IERhdGUodG9kYXkuZ2V0VGltZSgpICsgNyAqIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgIFxuICAgIGNvbnN0IGNvdW50czogRmlsdGVyQ291bnRzID0ge1xuICAgICAgaGlnaDogMCxcbiAgICAgIG1lZGl1bTogMCxcbiAgICAgIGxvdzogMCxcbiAgICAgIHRvZGF5OiAwLFxuICAgICAgd2VlazogMCxcbiAgICAgIG92ZXJkdWU6IDAsXG4gICAgICBjb21wbGV0ZWQ6IDBcbiAgICB9O1xuICAgIFxuICAgIGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuICAgICAgLy8gUHJpb3JpdHkgY291bnRzIChvbmx5IGZvciBub24tY29tcGxldGVkIHRhc2tzKVxuICAgICAgaWYgKCF0YXNrLmNvbXBsZXRlZCkge1xuICAgICAgICBpZiAodGFzay5wcmlvcml0eSA9PT0gJ2hpZ2gnKSBjb3VudHMuaGlnaCsrO1xuICAgICAgICBlbHNlIGlmICh0YXNrLnByaW9yaXR5ID09PSAnbWVkaXVtJykgY291bnRzLm1lZGl1bSsrO1xuICAgICAgICBlbHNlIGlmICh0YXNrLnByaW9yaXR5ID09PSAnbG93JykgY291bnRzLmxvdysrO1xuICAgICAgICBcbiAgICAgICAgLy8gRHVlIGRhdGUgY291bnRzXG4gICAgICAgIGlmICh0YXNrLmR1ZURhdGUpIHtcbiAgICAgICAgICBjb25zdCBkdWVEYXRlID0gbmV3IERhdGUodGFzay5kdWVEYXRlKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBPdmVyZHVlIC0gcGFzdCBkdWUgZGF0ZSBhbmQgbm90IGNvbXBsZXRlZFxuICAgICAgICAgIGlmIChkdWVEYXRlIDwgdG9kYXkpIHtcbiAgICAgICAgICAgIGNvdW50cy5vdmVyZHVlKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIER1ZSB0b2RheVxuICAgICAgICAgIGVsc2UgaWYgKGR1ZURhdGUgPj0gdG9kYXkgJiYgZHVlRGF0ZSA8PSBlbmRPZlRvZGF5KSB7XG4gICAgICAgICAgICBjb3VudHMudG9kYXkrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRHVlIHRoaXMgd2VlayAoaW5jbHVkaW5nIHRvZGF5KVxuICAgICAgICAgIGlmIChkdWVEYXRlID49IHRvZGF5ICYmIGR1ZURhdGUgPD0gd2Vla0Zyb21Ob3cpIHtcbiAgICAgICAgICAgIGNvdW50cy53ZWVrKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENvbXBsZXRlZCBjb3VudFxuICAgICAgaWYgKHRhc2suY29tcGxldGVkKSB7XG4gICAgICAgIGNvdW50cy5jb21wbGV0ZWQrKztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNvdW50cztcbiAgfVxuICBcbiAgcHJpdmF0ZSBnZXRDdXJyZW50RmlsdGVyQ291bnRzKCk6IEZpbHRlckNvdW50cyB7XG4gICAgLy8gR2V0IHRoZSBhcHByb3ByaWF0ZSB0YXNrIGxpc3QgYmFzZWQgb24gY3VycmVudCB2aWV3IG1vZGVcbiAgICBjb25zdCB0YXNrc1RvQ291bnQgPSB0aGlzLmdldEZpbHRlcmVkVGFza3MoKTtcbiAgICByZXR1cm4gdGhpcy5jYWxjdWxhdGVGaWx0ZXJDb3VudHModGFza3NUb0NvdW50KTtcbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVGaWx0ZXJDb3VudHNJbW1lZGlhdGUoKTogdm9pZCB7XG4gICAgLy8gUmVjYWxjdWxhdGUgY291bnRzXG4gICAgY29uc3QgbmV3Q291bnRzID0gdGhpcy5nZXRDdXJyZW50RmlsdGVyQ291bnRzKCk7XG4gICAgdGhpcy5maWx0ZXJDb3VudHMgPSBuZXdDb3VudHM7XG4gICAgXG4gICAgLy8gVXBkYXRlIGVhY2ggYmFkZ2UgZWxlbWVudFxuICAgIGNvbnN0IHVwZGF0ZUJhZGdlID0gKGZpbHRlcktleTogc3RyaW5nLCBjb3VudDogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCBiYWRnZSA9IHRoaXMuYmFkZ2VFbGVtZW50cy5nZXQoZmlsdGVyS2V5KTtcbiAgICAgIGlmIChiYWRnZSkge1xuICAgICAgICBpZiAoY291bnQgPiAwKSB7XG4gICAgICAgICAgYmFkZ2UudGV4dENvbnRlbnQgPSBjb3VudC50b1N0cmluZygpO1xuICAgICAgICAgIGJhZGdlLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWZsZXgnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJhZGdlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY291bnQgPiAwKSB7XG4gICAgICAgIC8vIEJhZGdlIGRvZXNuJ3QgZXhpc3QgYnV0IHdlIGhhdmUgYSBjb3VudCwgbmVlZCB0byBjcmVhdGUgaXRcbiAgICAgICAgY29uc3QgYnV0dG9uID0gdGhpcy5jb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKGBbZGF0YS1maWx0ZXI9XCIke3RoaXMuZ2V0RGF0YUF0dHIoZmlsdGVyS2V5KX1cIl1gKTtcbiAgICAgICAgaWYgKGJ1dHRvbikge1xuICAgICAgICAgIGNvbnN0IG5ld0JhZGdlID0gdGhpcy5jcmVhdGVCYWRnZUVsZW1lbnQoY291bnQsIHRoaXMuZ2V0RGF0YUF0dHIoZmlsdGVyS2V5KSk7XG4gICAgICAgICAgaWYgKG5ld0JhZGdlKSB7XG4gICAgICAgICAgICBidXR0b24uYXBwZW5kQ2hpbGQobmV3QmFkZ2UpO1xuICAgICAgICAgICAgdGhpcy5iYWRnZUVsZW1lbnRzLnNldChmaWx0ZXJLZXksIG5ld0JhZGdlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIC8vIFVwZGF0ZSBhbGwgZmlsdGVyIGJhZGdlc1xuICAgIHVwZGF0ZUJhZGdlKCdoaWdoJywgbmV3Q291bnRzLmhpZ2gpO1xuICAgIHVwZGF0ZUJhZGdlKCdtZWRpdW0nLCBuZXdDb3VudHMubWVkaXVtKTtcbiAgICB1cGRhdGVCYWRnZSgnbG93JywgbmV3Q291bnRzLmxvdyk7XG4gICAgdXBkYXRlQmFkZ2UoJ292ZXJkdWUnLCBuZXdDb3VudHMub3ZlcmR1ZSk7XG4gICAgdXBkYXRlQmFkZ2UoJ3RvZGF5JywgbmV3Q291bnRzLnRvZGF5KTtcbiAgICB1cGRhdGVCYWRnZSgnd2VlaycsIG5ld0NvdW50cy53ZWVrKTtcbiAgICB1cGRhdGVCYWRnZSgnY29tcGxldGVkJywgbmV3Q291bnRzLmNvbXBsZXRlZCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgdXBkYXRlRmlsdGVyQ291bnRzKGltbWVkaWF0ZTogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG4gICAgaWYgKGltbWVkaWF0ZSkge1xuICAgICAgLy8gVXBkYXRlIGltbWVkaWF0ZWx5IHdpdGhvdXQgZGVib3VuY2luZ1xuICAgICAgdGhpcy51cGRhdGVGaWx0ZXJDb3VudHNJbW1lZGlhdGUoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xlYXIgZXhpc3RpbmcgdGltZXJcbiAgICBpZiAodGhpcy51cGRhdGVDb3VudHNEZWJvdW5jZVRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy51cGRhdGVDb3VudHNEZWJvdW5jZVRpbWVyKTtcbiAgICB9XG4gICAgXG4gICAgLy8gU2V0IG5ldyBkZWJvdW5jZWQgdXBkYXRlXG4gICAgdGhpcy51cGRhdGVDb3VudHNEZWJvdW5jZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZUZpbHRlckNvdW50c0ltbWVkaWF0ZSgpO1xuICAgICAgdGhpcy51cGRhdGVDb3VudHNEZWJvdW5jZVRpbWVyID0gbnVsbDtcbiAgICB9LCAxNTApOyAvLyAxNTBtcyBkZWJvdW5jZSBkZWxheVxuICB9XG4gIFxuICBwcml2YXRlIGdldERhdGFBdHRyKGZpbHRlcktleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBtYXBwaW5nOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgJ2hpZ2gnOiAnaGlnaCcsXG4gICAgICAnbWVkaXVtJzogJ21lZGl1bScsXG4gICAgICAnbG93JzogJ2xvdycsXG4gICAgICAnb3ZlcmR1ZSc6ICdvdmVyZHVlJyxcbiAgICAgICd0b2RheSc6ICdkdWUtdG9kYXknLFxuICAgICAgJ3dlZWsnOiAnZHVlLXdlZWsnLFxuICAgICAgJ2NvbXBsZXRlZCc6ICdjb21wbGV0ZWQnXG4gICAgfTtcbiAgICByZXR1cm4gbWFwcGluZ1tmaWx0ZXJLZXldIHx8IGZpbHRlcktleTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyB1cGRhdGVUYXNrRGlzcGxheSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIFxuICAgICAgLy8gRmluZCBhbmQgY2xlYXIgdGhlIHRhc2sgc2VjdGlvbnNcbiAgICAgIGNvbnN0IHRhc2tTZWN0aW9ucyA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcudGFzay1zZWN0aW9uJyk7XG4gICAgICBcbiAgICAgIC8vIFJlbW92ZSBvbGQgdGFzayBzZWN0aW9uc1xuICAgICAgdGFza1NlY3Rpb25zLmZvckVhY2goc2VjdGlvbiA9PiBzZWN0aW9uLnJlbW92ZSgpKTtcbiAgICAgIFxuICAgICAgLy8gUmUtZGlzcGxheSB0YXNrcyB3aXRoIGN1cnJlbnQgZmlsdGVyXG4gICAgICBjb25zdCBkaXNwbGF5VGFza3MgPSB0aGlzLmdldEZpbHRlcmVkVGFza3MoKTtcbiAgICAgIGF3YWl0IHRoaXMuZGlzcGxheVRhc2tzKGNvbnRhaW5lciwgZGlzcGxheVRhc2tzKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSB0YXNrIGRpc3BsYXk6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZSgnRmFpbGVkIHRvIHVwZGF0ZSBkaXNwbGF5LiBQbGVhc2UgcmVmcmVzaC4nKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXBwbHlEYXNoYm9hcmRTdHlsZXMoKSB7XG4gICAgLy8gVGhlIENTUyB3aWxsIGJlIGFkZGVkIHNlcGFyYXRlbHlcbiAgfVxufSIsICJpbXBvcnQgeyByZXF1ZXN0VXJsLCBOb3RpY2UsIFJlcXVlc3RVcmxQYXJhbSB9IGZyb20gJ29ic2lkaWFuJztcblxuaW50ZXJmYWNlIEdtYWlsVG9rZW4ge1xuICBhY2Nlc3NfdG9rZW46IHN0cmluZztcbiAgcmVmcmVzaF90b2tlbj86IHN0cmluZztcbiAgZXhwaXJ5X2RhdGU/OiBudW1iZXI7XG4gIHRva2VuX3R5cGU/OiBzdHJpbmc7XG4gIHNjb3BlPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgR21haWxNZXNzYWdlIHtcbiAgaWQ6IHN0cmluZztcbiAgc3ViamVjdDogc3RyaW5nO1xuICBmcm9tOiBzdHJpbmc7XG4gIHRvOiBzdHJpbmc7XG4gIGRhdGU6IHN0cmluZztcbiAgYm9keTogc3RyaW5nO1xuICBzbmlwcGV0OiBzdHJpbmc7XG4gIGF0dGFjaG1lbnRzPzogYW55W107XG59XG5cbmludGVyZmFjZSBHbWFpbENyZWRlbnRpYWxzIHtcbiAgY2xpZW50X2lkOiBzdHJpbmc7XG4gIGNsaWVudF9zZWNyZXQ6IHN0cmluZztcbiAgcmVkaXJlY3RfdXJpPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgR21haWxTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBjcmVkZW50aWFsczogR21haWxDcmVkZW50aWFscyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHRva2VuOiBHbWFpbFRva2VuIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYmFzZVVybCA9ICdodHRwczovL2dtYWlsLmdvb2dsZWFwaXMuY29tL2dtYWlsL3YxJztcbiAgcHJpdmF0ZSBhdXRoQmFzZVVybCA9ICdodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDInO1xuICBwcml2YXRlIHRva2VuVXJsID0gJ2h0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuJztcbiAgcHJpdmF0ZSByZWRpcmVjdFVyaTogc3RyaW5nID0gJ2h0dHA6Ly9sb2NhbGhvc3QnO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgZ2V0U3RvcmVkVG9rZW46ICgpID0+IEdtYWlsVG9rZW4gfCBudWxsLFxuICAgIHByaXZhdGUgc2F2ZVRva2VuOiAodG9rZW46IEdtYWlsVG9rZW4pID0+IFByb21pc2U8dm9pZD5cbiAgKSB7XG4gICAgdGhpcy50b2tlbiA9IHRoaXMuZ2V0U3RvcmVkVG9rZW4oKTtcbiAgfVxuXG4gIHNldENyZWRlbnRpYWxzKGNsaWVudElkOiBzdHJpbmcsIGNsaWVudFNlY3JldDogc3RyaW5nLCByZWRpcmVjdFVyaT86IHN0cmluZykge1xuICAgIHRoaXMucmVkaXJlY3RVcmkgPSByZWRpcmVjdFVyaSB8fCAnaHR0cDovL2xvY2FsaG9zdCc7XG4gICAgdGhpcy5jcmVkZW50aWFscyA9IHtcbiAgICAgIGNsaWVudF9pZDogY2xpZW50SWQsXG4gICAgICBjbGllbnRfc2VjcmV0OiBjbGllbnRTZWNyZXQsXG4gICAgICByZWRpcmVjdF91cmk6IHRoaXMucmVkaXJlY3RVcmlcbiAgICB9O1xuICB9XG5cbiAgZ2V0QXV0aG9yaXphdGlvblVybCgpOiBzdHJpbmcge1xuICAgIGlmICghdGhpcy5jcmVkZW50aWFscykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDcmVkZW50aWFscyBub3Qgc2V0LiBQbGVhc2UgY29uZmlndXJlIEdvb2dsZSBPQXV0aCBpbiBzZXR0aW5ncy4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgIGNsaWVudF9pZDogdGhpcy5jcmVkZW50aWFscy5jbGllbnRfaWQsXG4gICAgICByZWRpcmVjdF91cmk6IHRoaXMucmVkaXJlY3RVcmksXG4gICAgICByZXNwb25zZV90eXBlOiAnY29kZScsXG4gICAgICBzY29wZTogJ2h0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvZ21haWwucmVhZG9ubHknLFxuICAgICAgYWNjZXNzX3R5cGU6ICdvZmZsaW5lJyxcbiAgICAgIHByb21wdDogJ2NvbnNlbnQnXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYCR7dGhpcy5hdXRoQmFzZVVybH0vYXV0aD8ke3BhcmFtcy50b1N0cmluZygpfWA7XG4gIH1cblxuICBhc3luYyBleGNoYW5nZUNvZGVGb3JUb2tlbihjb2RlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuY3JlZGVudGlhbHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ3JlZGVudGlhbHMgbm90IHNldCcpO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgICB1cmw6IHRoaXMudG9rZW5VcmwsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgICAgICBjb2RlLFxuICAgICAgICAgIGNsaWVudF9pZDogdGhpcy5jcmVkZW50aWFscy5jbGllbnRfaWQsXG4gICAgICAgICAgY2xpZW50X3NlY3JldDogdGhpcy5jcmVkZW50aWFscy5jbGllbnRfc2VjcmV0LFxuICAgICAgICAgIHJlZGlyZWN0X3VyaTogdGhpcy5yZWRpcmVjdFVyaSxcbiAgICAgICAgICBncmFudF90eXBlOiAnYXV0aG9yaXphdGlvbl9jb2RlJ1xuICAgICAgICB9KS50b1N0cmluZygpXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgIGNvbnN0IHRva2VuRGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgICAgIHRoaXMudG9rZW4gPSB7XG4gICAgICAgICAgYWNjZXNzX3Rva2VuOiB0b2tlbkRhdGEuYWNjZXNzX3Rva2VuLFxuICAgICAgICAgIHJlZnJlc2hfdG9rZW46IHRva2VuRGF0YS5yZWZyZXNoX3Rva2VuLFxuICAgICAgICAgIGV4cGlyeV9kYXRlOiBEYXRlLm5vdygpICsgKHRva2VuRGF0YS5leHBpcmVzX2luICogMTAwMCksXG4gICAgICAgICAgdG9rZW5fdHlwZTogdG9rZW5EYXRhLnRva2VuX3R5cGUsXG4gICAgICAgICAgc2NvcGU6IHRva2VuRGF0YS5zY29wZVxuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZVRva2VuKHRoaXMudG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZXhjaGFuZ2UgY29kZTogJHtyZXNwb25zZS50ZXh0fWApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdPQXV0aCB0b2tlbiBleGNoYW5nZSBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWZyZXNoQWNjZXNzVG9rZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLmNyZWRlbnRpYWxzIHx8ICF0aGlzLnRva2VuPy5yZWZyZXNoX3Rva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZWZyZXNoIHRva2VuOiBtaXNzaW5nIGNyZWRlbnRpYWxzIG9yIHJlZnJlc2ggdG9rZW4nKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiB0aGlzLnRva2VuVXJsLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICAgICAgcmVmcmVzaF90b2tlbjogdGhpcy50b2tlbi5yZWZyZXNoX3Rva2VuLFxuICAgICAgICAgIGNsaWVudF9pZDogdGhpcy5jcmVkZW50aWFscy5jbGllbnRfaWQsXG4gICAgICAgICAgY2xpZW50X3NlY3JldDogdGhpcy5jcmVkZW50aWFscy5jbGllbnRfc2VjcmV0LFxuICAgICAgICAgIGdyYW50X3R5cGU6ICdyZWZyZXNoX3Rva2VuJ1xuICAgICAgICB9KS50b1N0cmluZygpXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgIGNvbnN0IHRva2VuRGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgICAgIHRoaXMudG9rZW4gPSB7XG4gICAgICAgICAgLi4udGhpcy50b2tlbixcbiAgICAgICAgICBhY2Nlc3NfdG9rZW46IHRva2VuRGF0YS5hY2Nlc3NfdG9rZW4sXG4gICAgICAgICAgZXhwaXJ5X2RhdGU6IERhdGUubm93KCkgKyAodG9rZW5EYXRhLmV4cGlyZXNfaW4gKiAxMDAwKSxcbiAgICAgICAgfTtcblxuICAgICAgICBhd2FpdCB0aGlzLnNhdmVUb2tlbih0aGlzLnRva2VuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHJlZnJlc2ggdG9rZW46ICR7cmVzcG9uc2UudGV4dH1gKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignVG9rZW4gcmVmcmVzaCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBlbnN1cmVWYWxpZFRva2VuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy50b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgYXV0aGVudGljYXRlZC4gUGxlYXNlIGF1dGhlbnRpY2F0ZSB3aXRoIEdtYWlsIGZpcnN0LicpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnRva2VuLmV4cGlyeV9kYXRlICYmIERhdGUubm93KCkgPj0gdGhpcy50b2tlbi5leHBpcnlfZGF0ZSAtIDYwMDAwKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0dtYWlsXSBUb2tlbiBleHBpcmVkIG9yIGV4cGlyaW5nIHNvb24sIHJlZnJlc2hpbmcuLi4nKTtcbiAgICAgIGF3YWl0IHRoaXMucmVmcmVzaEFjY2Vzc1Rva2VuKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBtYWtlR21haWxSZXF1ZXN0KFxuICAgIGVuZHBvaW50OiBzdHJpbmcsXG4gICAgb3B0aW9uczogUGFydGlhbDxSZXF1ZXN0VXJsUGFyYW0+ID0ge31cbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZVZhbGlkVG9rZW4oKTtcblxuICAgIGNvbnN0IHVybCA9IGVuZHBvaW50LnN0YXJ0c1dpdGgoJ2h0dHAnKSA/IGVuZHBvaW50IDogYCR7dGhpcy5iYXNlVXJsfSR7ZW5kcG9pbnR9YDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgICB1cmwsXG4gICAgICAgIG1ldGhvZDogb3B0aW9ucy5tZXRob2QgfHwgJ0dFVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLnRva2VuIS5hY2Nlc3NfdG9rZW59YCxcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgIC4uLm9wdGlvbnMuaGVhZGVyc1xuICAgICAgICB9LFxuICAgICAgICAuLi5vcHRpb25zXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbR21haWxdIFJlY2VpdmVkIDQwMSwgYXR0ZW1wdGluZyB0b2tlbiByZWZyZXNoLi4uJyk7XG4gICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaEFjY2Vzc1Rva2VuKCk7XG5cbiAgICAgICAgY29uc3QgcmV0cnlSZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgICAgIHVybCxcbiAgICAgICAgICBtZXRob2Q6IG9wdGlvbnMubWV0aG9kIHx8ICdHRVQnLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3RoaXMudG9rZW4hLmFjY2Vzc190b2tlbn1gLFxuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMuaGVhZGVyc1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLi4ub3B0aW9uc1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmV0cnlSZXNwb25zZS5qc29uO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzcG9uc2UuanNvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgR21haWwgQVBJIHJlcXVlc3QgZmFpbGVkOiAke2VuZHBvaW50fWAsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNlYXJjaEVtYWlscyhxdWVyeTogc3RyaW5nLCBtYXhSZXN1bHRzOiBudW1iZXIgPSAxMDAsIGJhdGNoU2l6ZTogbnVtYmVyID0gNSk6IFByb21pc2U8R21haWxNZXNzYWdlW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFtHbWFpbF0gU2VhcmNoaW5nIHdpdGggcXVlcnk6ICR7cXVlcnl9YCk7XG5cbiAgICAgIGNvbnN0IGxpc3RSZXNwb25zZSA9IGF3YWl0IHRoaXMubWFrZUdtYWlsUmVxdWVzdChcbiAgICAgICAgYC91c2Vycy9tZS9tZXNzYWdlcz9xPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5KX0mbWF4UmVzdWx0cz0ke21heFJlc3VsdHN9YFxuICAgICAgKTtcblxuICAgICAgaWYgKCFsaXN0UmVzcG9uc2UubWVzc2FnZXMgfHwgbGlzdFJlc3BvbnNlLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0dtYWlsXSBObyBtZXNzYWdlcyBmb3VuZCcpO1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKGBbR21haWxdIEZvdW5kICR7bGlzdFJlc3BvbnNlLm1lc3NhZ2VzLmxlbmd0aH0gbWVzc2FnZXMsIGZldGNoaW5nIGluIGJhdGNoZXMgb2YgJHtiYXRjaFNpemV9YCk7XG5cbiAgICAgIGNvbnN0IG1lc3NhZ2VzOiBHbWFpbE1lc3NhZ2VbXSA9IFtdO1xuICAgICAgY29uc3QgbWVzc2FnZVJlZnMgPSBsaXN0UmVzcG9uc2UubWVzc2FnZXMuZmlsdGVyKChyZWY6IGFueSkgPT4gcmVmLmlkKTtcbiAgICAgIGNvbnN0IHRvdGFsQmF0Y2hlcyA9IE1hdGguY2VpbChtZXNzYWdlUmVmcy5sZW5ndGggLyBiYXRjaFNpemUpO1xuXG4gICAgICBjb25zb2xlLmxvZyhgW0dtYWlsXSBTdGFydGluZyBwYXJhbGxlbCBmZXRjaDogJHttZXNzYWdlUmVmcy5sZW5ndGh9IGVtYWlscyBpbiAke3RvdGFsQmF0Y2hlc30gYmF0Y2hlc2ApO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc3NhZ2VSZWZzLmxlbmd0aDsgaSArPSBiYXRjaFNpemUpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSBtZXNzYWdlUmVmcy5zbGljZShpLCBpICsgYmF0Y2hTaXplKTtcbiAgICAgICAgY29uc3QgYmF0Y2hOdW0gPSBNYXRoLmZsb29yKGkgLyBiYXRjaFNpemUpICsgMTtcblxuICAgICAgICBjb25zb2xlLmxvZyhgW0dtYWlsXSBGZXRjaGluZyBiYXRjaCAke2JhdGNoTnVtfS8ke3RvdGFsQmF0Y2hlc30gKCR7YmF0Y2gubGVuZ3RofSBlbWFpbHMgaW4gcGFyYWxsZWwpLi4uYCk7XG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cbiAgICAgICAgY29uc3QgYmF0Y2hQcm9taXNlcyA9IGJhdGNoLm1hcCgobWVzc2FnZVJlZjogYW55KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtHbWFpbF0gU3RhcnRpbmcgZmV0Y2ggZm9yIGVtYWlsICR7bWVzc2FnZVJlZi5pZH1gKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRFbWFpbEJ5SWQobWVzc2FnZVJlZi5pZCkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW0dtYWlsXSBGYWlsZWQgdG8gZmV0Y2ggbWVzc2FnZSAke21lc3NhZ2VSZWYuaWR9OmAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBiYXRjaFJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChiYXRjaFByb21pc2VzKTtcbiAgICAgICAgY29uc3Qgc3VjY2Vzc2Z1bFJlc3VsdHMgPSBiYXRjaFJlc3VsdHMuZmlsdGVyKG1zZyA9PiBtc2cgIT09IG51bGwpO1xuICAgICAgICBtZXNzYWdlcy5wdXNoKC4uLnN1Y2Nlc3NmdWxSZXN1bHRzKTtcblxuICAgICAgICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgY29uc29sZS5sb2coYFtHbWFpbF0gQmF0Y2ggJHtiYXRjaE51bX0gY29tcGxldGU6ICR7c3VjY2Vzc2Z1bFJlc3VsdHMubGVuZ3RofS8ke2JhdGNoLmxlbmd0aH0gc3VjY2Vzc2Z1bCBpbiAke2VsYXBzZWR9bXNgKTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coYFtHbWFpbF0gQWxsIGJhdGNoZXMgY29tcGxldGU6ICR7bWVzc2FnZXMubGVuZ3RofSBlbWFpbHMgZmV0Y2hlZCBzdWNjZXNzZnVsbHlgKTtcblxuICAgICAgcmV0dXJuIG1lc3NhZ2VzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFbWFpbCBzZWFyY2ggZmFpbGVkOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldEVtYWlsQnlJZChtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8R21haWxNZXNzYWdlPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCB0aGlzLm1ha2VHbWFpbFJlcXVlc3QoXG4gICAgICAgIGAvdXNlcnMvbWUvbWVzc2FnZXMvJHttZXNzYWdlSWR9P2Zvcm1hdD1mdWxsYFxuICAgICAgKTtcblxuICAgICAgY29uc3QgaGVhZGVycyA9IG1lc3NhZ2UucGF5bG9hZD8uaGVhZGVycyB8fCBbXTtcbiAgICAgIGNvbnN0IGdldEhlYWRlciA9IChuYW1lOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgICAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJzLmZpbmQoKGg6IGFueSkgPT5cbiAgICAgICAgICBoLm5hbWU/LnRvTG93ZXJDYXNlKCkgPT09IG5hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gaGVhZGVyPy52YWx1ZSB8fCAnJztcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLmV4dHJhY3RCb2R5KG1lc3NhZ2UucGF5bG9hZCk7XG5cbiAgICAgIGNvbnN0IGF0dGFjaG1lbnRzOiBhbnlbXSA9IFtdO1xuICAgICAgaWYgKG1lc3NhZ2UucGF5bG9hZD8ucGFydHMpIHtcbiAgICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIG1lc3NhZ2UucGF5bG9hZC5wYXJ0cykge1xuICAgICAgICAgIGlmIChwYXJ0LmZpbGVuYW1lICYmIHBhcnQuYm9keT8uYXR0YWNobWVudElkKSB7XG4gICAgICAgICAgICBhdHRhY2htZW50cy5wdXNoKHtcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IHBhcnQuZmlsZW5hbWUsXG4gICAgICAgICAgICAgIG1pbWVUeXBlOiBwYXJ0Lm1pbWVUeXBlLFxuICAgICAgICAgICAgICBzaXplOiBwYXJ0LmJvZHkuc2l6ZSxcbiAgICAgICAgICAgICAgYXR0YWNobWVudElkOiBwYXJ0LmJvZHkuYXR0YWNobWVudElkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IG1lc3NhZ2VJZCxcbiAgICAgICAgc3ViamVjdDogZ2V0SGVhZGVyKCdzdWJqZWN0JyksXG4gICAgICAgIGZyb206IGdldEhlYWRlcignZnJvbScpLFxuICAgICAgICB0bzogZ2V0SGVhZGVyKCd0bycpLFxuICAgICAgICBkYXRlOiBnZXRIZWFkZXIoJ2RhdGUnKSxcbiAgICAgICAgYm9keSxcbiAgICAgICAgc25pcHBldDogbWVzc2FnZS5zbmlwcGV0IHx8ICcnLFxuICAgICAgICBhdHRhY2htZW50c1xuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGdldCBlbWFpbCAke21lc3NhZ2VJZH06YCwgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0Qm9keShwYXlsb2FkOiBhbnkpOiBzdHJpbmcge1xuICAgIGlmICghcGF5bG9hZCkgcmV0dXJuICcnO1xuXG4gICAgaWYgKHBheWxvYWQuYm9keT8uZGF0YSkge1xuICAgICAgcmV0dXJuIGF0b2IocGF5bG9hZC5ib2R5LmRhdGEucmVwbGFjZSgvLS9nLCAnKycpLnJlcGxhY2UoL18vZywgJy8nKSk7XG4gICAgfVxuXG4gICAgaWYgKHBheWxvYWQucGFydHMpIHtcbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXlsb2FkLnBhcnRzKSB7XG4gICAgICAgIGlmIChwYXJ0Lm1pbWVUeXBlID09PSAndGV4dC9wbGFpbicgJiYgcGFydC5ib2R5Py5kYXRhKSB7XG4gICAgICAgICAgcmV0dXJuIGF0b2IocGFydC5ib2R5LmRhdGEucmVwbGFjZSgvLS9nLCAnKycpLnJlcGxhY2UoL18vZywgJy8nKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIHBheWxvYWQucGFydHMpIHtcbiAgICAgICAgaWYgKHBhcnQubWltZVR5cGUgPT09ICd0ZXh0L2h0bWwnICYmIHBhcnQuYm9keT8uZGF0YSkge1xuICAgICAgICAgIGNvbnN0IGh0bWxCb2R5ID0gYXRvYihwYXJ0LmJvZHkuZGF0YS5yZXBsYWNlKC8tL2csICcrJykucmVwbGFjZSgvXy9nLCAnLycpKTtcbiAgICAgICAgICByZXR1cm4gaHRtbEJvZHkucmVwbGFjZSgvPFtePl0qPi9nLCAnJykudHJpbSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXlsb2FkLnBhcnRzKSB7XG4gICAgICAgIGNvbnN0IG5lc3RlZEJvZHkgPSB0aGlzLmV4dHJhY3RCb2R5KHBhcnQpO1xuICAgICAgICBpZiAobmVzdGVkQm9keSkgcmV0dXJuIG5lc3RlZEJvZHk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgYXN5bmMgZmV0Y2hSZWNlbnRNZWV0aW5nRW1haWxzKGhvdXJzQmFjazogbnVtYmVyLCBsYWJlbHM/OiBzdHJpbmcpOiBQcm9taXNlPEdtYWlsTWVzc2FnZVtdPiB7XG4gICAgY29uc3QgYWZ0ZXJEYXRlID0gbmV3IERhdGUoKTtcbiAgICBhZnRlckRhdGUuc2V0VGltZShhZnRlckRhdGUuZ2V0VGltZSgpIC0gaG91cnNCYWNrICogNjAgKiA2MCAqIDEwMDApO1xuICAgIGNvbnN0IGRhdGVTdHIgPSBhZnRlckRhdGUudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdO1xuXG4gICAgY29uc3QgbGFiZWxMaXN0ID0gKGxhYmVscyB8fCAndHJhbnNjcmlwdCcpXG4gICAgICAuc3BsaXQoJywnKVxuICAgICAgLm1hcChsID0+IGwudHJpbSgpKVxuICAgICAgLmZpbHRlcihsID0+IGwpO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0dtYWlsXSBMb29raW5nIGZvciBlbWFpbHMgd2l0aCBsYWJlbHM6ICR7bGFiZWxMaXN0LmpvaW4oJywgJyl9IGFmdGVyICR7ZGF0ZVN0cn0gKCR7aG91cnNCYWNrfSBob3VycyBiYWNrKWBcbiAgICApO1xuXG4gICAgbGV0IGxhYmVsUXVlcnkgPSAnJztcbiAgICBpZiAobGFiZWxMaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGFiZWxRdWVyeSA9IGBsYWJlbDoke2xhYmVsTGlzdFswXX1gO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYWJlbFF1ZXJ5ID0gYCgke2xhYmVsTGlzdC5tYXAobCA9PiBgbGFiZWw6JHtsfWApLmpvaW4oJyBPUiAnKX0pYDtcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9IGAke2xhYmVsUXVlcnl9IGFmdGVyOiR7ZGF0ZVN0cn1gO1xuXG4gICAgcmV0dXJuIHRoaXMuc2VhcmNoRW1haWxzKHF1ZXJ5LCAxMDApO1xuICB9XG5cbiAgaXNBdXRoZW50aWNhdGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMudG9rZW4/LmFjY2Vzc190b2tlbjtcbiAgfVxuXG4gIGhhc1JlZnJlc2hUb2tlbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISF0aGlzLnRva2VuPy5yZWZyZXNoX3Rva2VuO1xuICB9XG5cbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZW5zdXJlVmFsaWRUb2tlbigpO1xuICAgICAgY29uc3QgcHJvZmlsZSA9IGF3YWl0IHRoaXMubWFrZUdtYWlsUmVxdWVzdCgnL3VzZXJzL21lL3Byb2ZpbGUnKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbR21haWxdIENvbm5lY3Rpb24gdGVzdCBzdWNjZXNzZnVsOicsIHByb2ZpbGUuZW1haWxBZGRyZXNzKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbR21haWxdIENvbm5lY3Rpb24gdGVzdCBmYWlsZWQ6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyQXV0aGVudGljYXRpb24oKSB7XG4gICAgdGhpcy50b2tlbiA9IG51bGw7XG4gIH1cbn0iLCAiaW50ZXJmYWNlIE9BdXRoUmVzcG9uc2Uge1xuICBjb2RlPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE9BdXRoU2VydmVyIHtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IGFueSA9IG51bGw7XG4gIHByaXZhdGUgcG9ydCA9IDQyODEzO1xuICBwcml2YXRlIGF1dGhDb2RlUHJvbWlzZTogUHJvbWlzZTxzdHJpbmc+IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYXV0aENvZGVSZXNvbHZlOiAoKGNvZGU6IHN0cmluZykgPT4gdm9pZCkgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBhdXRoQ29kZVJlamVjdDogKChlcnJvcjogRXJyb3IpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoKSB7fVxuXG4gIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnNlcnZlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBVc2UgTm9kZS5qcyBodHRwIG1vZHVsZSBhdmFpbGFibGUgaW4gRWxlY3Ryb25cbiAgICAgICAgY29uc3QgaHR0cCA9ICh3aW5kb3cgYXMgYW55KS5yZXF1aXJlKCdodHRwJyk7XG5cbiAgICAgICAgdGhpcy5zZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcigocmVxOiBhbnksIHJlczogYW55KSA9PiB7XG4gICAgICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsLCBgaHR0cDovL2xvY2FsaG9zdDoke3RoaXMucG9ydH1gKTtcblxuICAgICAgICAgIGlmICh1cmwucGF0aG5hbWUgPT09ICcvY2FsbGJhY2snKSB7XG4gICAgICAgICAgICBjb25zdCBjb2RlID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ2NvZGUnKTtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ2Vycm9yJyk7XG5cbiAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyB9KTtcblxuICAgICAgICAgICAgaWYgKGNvZGUpIHtcbiAgICAgICAgICAgICAgcmVzLmVuZChgXG4gICAgICAgICAgICAgICAgPCFET0NUWVBFIGh0bWw+XG4gICAgICAgICAgICAgICAgPGh0bWw+XG4gICAgICAgICAgICAgICAgPGhlYWQ+XG4gICAgICAgICAgICAgICAgICA8dGl0bGU+QXV0aGVudGljYXRpb24gU3VjY2Vzc2Z1bDwvdGl0bGU+XG4gICAgICAgICAgICAgICAgICA8c3R5bGU+XG4gICAgICAgICAgICAgICAgICAgIGJvZHkge1xuICAgICAgICAgICAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIHNhbnMtc2VyaWY7XG4gICAgICAgICAgICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgICAgICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgICAgICAgICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICAgICAgICAgICAgICAgIG1pbi1oZWlnaHQ6IDEwMHZoO1xuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjNjY3ZWVhIDAlLCAjNzY0YmEyIDEwMCUpO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAuY29udGFpbmVyIHtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogMnJlbTtcbiAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7XG4gICAgICAgICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgICAgICAgICAgICAgICAgICAgICBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoMTBweCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLnN1Y2Nlc3MtaWNvbiB7XG4gICAgICAgICAgICAgICAgICAgICAgZm9udC1zaXplOiA0cmVtO1xuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaDEge1xuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMCAwIDAuNXJlbSAwO1xuICAgICAgICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMnJlbTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwIHtcbiAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAuNXJlbSAwO1xuICAgICAgICAgICAgICAgICAgICAgIG9wYWNpdHk6IDAuOTtcbiAgICAgICAgICAgICAgICAgICAgICBmb250LXNpemU6IDEuMXJlbTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAuY2xvc2UtaGludCB7XG4gICAgICAgICAgICAgICAgICAgICAgbWFyZ2luLXRvcDogMnJlbTtcbiAgICAgICAgICAgICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiAwLjc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDwvc3R5bGU+XG4gICAgICAgICAgICAgICAgPC9oZWFkPlxuICAgICAgICAgICAgICAgIDxib2R5PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3VjY2Vzcy1pY29uXCI+XHUyNzA1PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxoMT5BdXRoZW50aWNhdGlvbiBTdWNjZXNzZnVsITwvaDE+XG4gICAgICAgICAgICAgICAgICAgIDxwPllvdSBjYW4gbm93IGNsb3NlIHRoaXMgd2luZG93IGFuZCByZXR1cm4gdG8gT2JzaWRpYW4uPC9wPlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzcz1cImNsb3NlLWhpbnRcIj5UaGlzIHdpbmRvdyB3aWxsIGNsb3NlIGF1dG9tYXRpY2FsbHkgaW4gMyBzZWNvbmRzLi4uPC9wPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8c2NyaXB0PlxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5jbG9zZSgpLCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgIDwvc2NyaXB0PlxuICAgICAgICAgICAgICAgIDwvYm9keT5cbiAgICAgICAgICAgICAgICA8L2h0bWw+XG4gICAgICAgICAgICAgIGApO1xuXG4gICAgICAgICAgICAgIGlmICh0aGlzLmF1dGhDb2RlUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXV0aENvZGVSZXNvbHZlKGNvZGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXV0aENvZGVSZXNvbHZlID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGhDb2RlUmVqZWN0ID0gbnVsbDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzLmVuZChgXG4gICAgICAgICAgICAgICAgPCFET0NUWVBFIGh0bWw+XG4gICAgICAgICAgICAgICAgPGh0bWw+XG4gICAgICAgICAgICAgICAgPGhlYWQ+XG4gICAgICAgICAgICAgICAgICA8dGl0bGU+QXV0aGVudGljYXRpb24gRmFpbGVkPC90aXRsZT5cbiAgICAgICAgICAgICAgICAgIDxzdHlsZT5cbiAgICAgICAgICAgICAgICAgICAgYm9keSB7XG4gICAgICAgICAgICAgICAgICAgICAgZm9udC1mYW1pbHk6IC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgc2Fucy1zZXJpZjtcbiAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgbWluLWhlaWdodDogMTAwdmg7XG4gICAgICAgICAgICAgICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICNmNTU3NmMgMCUsICNmMDkzZmIgMTAwJSk7XG4gICAgICAgICAgICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC5jb250YWluZXIge1xuICAgICAgICAgICAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAycmVtO1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKTtcbiAgICAgICAgICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cigxMHB4KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAuZXJyb3ItaWNvbiB7XG4gICAgICAgICAgICAgICAgICAgICAgZm9udC1zaXplOiA0cmVtO1xuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaDEge1xuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMCAwIDAuNXJlbSAwO1xuICAgICAgICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMnJlbTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwIHtcbiAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46IDAuNXJlbSAwO1xuICAgICAgICAgICAgICAgICAgICAgIG9wYWNpdHk6IDAuOTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAuZXJyb3ItbXNnIHtcbiAgICAgICAgICAgICAgICAgICAgICBtYXJnaW4tdG9wOiAxcmVtO1xuICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IDFyZW07XG4gICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICAgICAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgICAgICAgICAgICBmb250LWZhbWlseTogbW9ub3NwYWNlO1xuICAgICAgICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICA8L3N0eWxlPlxuICAgICAgICAgICAgICAgIDwvaGVhZD5cbiAgICAgICAgICAgICAgICA8Ym9keT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImVycm9yLWljb25cIj5cdTI3NEM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGgxPkF1dGhlbnRpY2F0aW9uIEZhaWxlZDwvaDE+XG4gICAgICAgICAgICAgICAgICAgIDxwPlRoZXJlIHdhcyBhbiBlcnJvciBkdXJpbmcgYXV0aGVudGljYXRpb24uPC9wPlxuICAgICAgICAgICAgICAgICAgICAke2Vycm9yID8gYDxkaXYgY2xhc3M9XCJlcnJvci1tc2dcIj5FcnJvcjogJHtlcnJvcn08L2Rpdj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIDxwPlBsZWFzZSBjbG9zZSB0aGlzIHdpbmRvdyBhbmQgdHJ5IGFnYWluLjwvcD5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvYm9keT5cbiAgICAgICAgICAgICAgICA8L2h0bWw+XG4gICAgICAgICAgICAgIGApO1xuXG4gICAgICAgICAgICAgIGlmICh0aGlzLmF1dGhDb2RlUmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdXRoQ29kZVJlamVjdChuZXcgRXJyb3IoZXJyb3IgfHwgJ0F1dGhlbnRpY2F0aW9uIGZhaWxlZCcpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGhDb2RlUmVzb2x2ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5hdXRoQ29kZVJlamVjdCA9IG51bGw7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQpO1xuICAgICAgICAgICAgcmVzLmVuZCgnTm90IGZvdW5kJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnNlcnZlci5saXN0ZW4odGhpcy5wb3J0LCAnMTI3LjAuMC4xJywgKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbT0F1dGggU2VydmVyXSBTdGFydGVkIG9uIGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnBvcnR9YCk7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnNlcnZlci5vbignZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoZXJyLmNvZGUgPT09ICdFQUREUklOVVNFJykge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW09BdXRoIFNlcnZlcl0gUG9ydCAke3RoaXMucG9ydH0gaXMgYWxyZWFkeSBpbiB1c2VgKTtcbiAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFBvcnQgJHt0aGlzLnBvcnR9IGlzIGFscmVhZHkgaW4gdXNlLiBQbGVhc2UgY2xvc2UgYW55IG90aGVyIGFwcGxpY2F0aW9ucyB1c2luZyB0aGlzIHBvcnQuYCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gQ2xlYXIgYW55IHBlbmRpbmcgdGltZW91dHNcbiAgICBpZiAoKHRoaXMgYXMgYW55KS50aW1lb3V0SWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCgodGhpcyBhcyBhbnkpLnRpbWVvdXRJZCk7XG4gICAgICAodGhpcyBhcyBhbnkpLnRpbWVvdXRJZCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgYW55IHBlbmRpbmcgcHJvbWlzZXNcbiAgICB0aGlzLmF1dGhDb2RlUmVzb2x2ZSA9IG51bGw7XG4gICAgdGhpcy5hdXRoQ29kZVJlamVjdCA9IG51bGw7XG4gICAgdGhpcy5hdXRoQ29kZVByb21pc2UgPSBudWxsO1xuXG4gICAgaWYgKHRoaXMuc2VydmVyKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgdGhpcy5zZXJ2ZXIuY2xvc2UoKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdbT0F1dGggU2VydmVyXSBTdG9wcGVkJyk7XG4gICAgICAgICAgdGhpcy5zZXJ2ZXIgPSBudWxsO1xuICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyB3YWl0Rm9yQXV0aENvZGUoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBpZiAoIXRoaXMuc2VydmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ09BdXRoIHNlcnZlciBub3Qgc3RhcnRlZCcpO1xuICAgIH1cblxuICAgIC8vIENsZWFyIGFueSBleGlzdGluZyBwcm9taXNlc1xuICAgIHRoaXMuYXV0aENvZGVSZXNvbHZlID0gbnVsbDtcbiAgICB0aGlzLmF1dGhDb2RlUmVqZWN0ID0gbnVsbDtcbiAgICB0aGlzLmF1dGhDb2RlUHJvbWlzZSA9IG51bGw7XG5cbiAgICB0aGlzLmF1dGhDb2RlUHJvbWlzZSA9IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5hdXRoQ29kZVJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgdGhpcy5hdXRoQ29kZVJlamVjdCA9IHJlamVjdDtcblxuICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuYXV0aENvZGVSZXNvbHZlID0gbnVsbDtcbiAgICAgICAgdGhpcy5hdXRoQ29kZVJlamVjdCA9IG51bGw7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ09BdXRoIHRpbWVvdXQgLSBubyByZXNwb25zZSByZWNlaXZlZCB3aXRoaW4gNSBtaW51dGVzJykpO1xuICAgICAgfSwgNSAqIDYwICogMTAwMCk7XG5cbiAgICAgIC8vIFN0b3JlIHRpbWVvdXQgSUQgZm9yIGNsZWFudXAgaWYgbmVlZGVkXG4gICAgICAodGhpcyBhcyBhbnkpLnRpbWVvdXRJZCA9IHRpbWVvdXRJZDtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLmF1dGhDb2RlUHJvbWlzZTtcbiAgfVxuXG4gIGdldFJlZGlyZWN0VXJpKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5wb3J0fS9jYWxsYmFja2A7XG4gIH1cblxuICBpc1J1bm5pbmcoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc2VydmVyICE9PSBudWxsO1xuICB9XG59Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFXTzs7O0FDWFAsc0JBQTJCO0FBdUJwQixJQUFNLHNCQUFOLE1BQTBCO0FBQUEsRUFLL0IsWUFBWSxRQUFnQixRQUFnQiw2QkFBNkI7QUFGekUsU0FBUSxTQUFpQjtBQUd2QixTQUFLLFNBQVM7QUFDZCxTQUFLLFFBQVE7QUFBQSxFQUNmO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxNQUFNLGFBQWEsY0FBc0IsU0FBZ0Q7QUFDdkYsUUFBSSxDQUFDLEtBQUssUUFBUTtBQUNoQixjQUFRLEtBQUssb0RBQW9EO0FBQ2pFLGFBQU8sS0FBSyxtQkFBbUIsY0FBYyxPQUFPO0FBQUEsSUFDdEQ7QUFFQSxRQUFJO0FBQ0YsWUFBTSxTQUFTLEtBQUssWUFBWSxjQUFjLE9BQU87QUFDckQsWUFBTSxXQUFXLE1BQU0sS0FBSyxXQUFXLE1BQU07QUFDN0MsYUFBTyxLQUFLLGNBQWMsVUFBVSxZQUFZO0FBQUEsSUFDbEQsU0FBUyxPQUFPO0FBQ2QsY0FBUSxNQUFNLGlEQUFpRCxLQUFLO0FBQ3BFLGFBQU8sS0FBSyxtQkFBbUIsY0FBYyxPQUFPO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLUSxZQUFZLGNBQXNCLFNBQXlCO0FBRWpFLFVBQU0sVUFBVSxPQUFPLGlCQUFpQixXQUFXLGVBQWUsS0FBSyxVQUFVLFlBQVk7QUFFN0YsV0FBTztBQUFBO0FBQUEsbUJBRVEsT0FBTztBQUFBO0FBQUE7QUFBQSxFQUd4QixRQUFRLFVBQVUsR0FBRyxJQUFLLENBQUMsSUFBSSxRQUFRLFNBQVMsT0FBUSxvQkFBb0IsRUFBRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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QixFQUN0QyxTQUFTLEtBQUssT0FBTyxTQUFTLGVBQWUsRUFDN0MsU0FBUyxPQUFNLFVBQVM7QUFDdkIsYUFBSyxPQUFPLFNBQVMsa0JBQWtCO0FBQ3ZDLGNBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxNQUNqQyxDQUFDO0FBQUEsSUFDTDtBQUVGLGdCQUFZLFNBQVMsTUFBTSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFFNUQsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEsNkJBQTZCLEVBQ3JDLFFBQVEsdURBQXVELEVBQy9EO0FBQUEsTUFBVSxZQUNULE9BQU8sU0FBUyxLQUFLLE9BQU8sU0FBUyx5QkFBeUIsRUFBRSxTQUFTLE9BQU0sVUFBUztBQUN0RixhQUFLLE9BQU8sU0FBUyw0QkFBNEI7QUFDakQsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2pDLENBQUM7QUFBQSxJQUNIO0FBRUYsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFOUMsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEsb0JBQW9CLEVBQzVCLFFBQVEsNENBQTRDLEVBQ3BEO0FBQUEsTUFBVSxZQUNULE9BQ0csY0FBYyxTQUFTLEVBQ3ZCLE9BQU8sRUFDUCxRQUFRLFlBQVk7QUFDbkIsY0FBTSxLQUFLLE9BQU8sY0FBYztBQUFBLE1BQ2xDLENBQUM7QUFBQSxJQUNMO0FBRUYsUUFBSSx5QkFBUSxXQUFXLEVBQ3BCLFFBQVEsd0JBQXdCLEVBQ2hDLFFBQVEsNENBQTRDLEVBQ3BEO0FBQUEsTUFBVSxZQUNULE9BQ0csY0FBYyxPQUFPLEVBQ3JCLFdBQVcsRUFDWCxRQUFRLFlBQVk7QUFDbkIsY0FBTSxLQUFLLE9BQU8scUJBQXFCO0FBQUEsTUFDekMsQ0FBQztBQUFBLElBQ0w7QUFFRixVQUFNLFlBQVksWUFBWSxVQUFVLGFBQWE7QUFDckQsVUFBTSxnQkFBYyxVQUFLLE9BQU8saUJBQVosbUJBQTBCLHFCQUMxQywrQkFDQTtBQUNKLFVBQU0sZUFBZSxLQUFLLE9BQU8sU0FBUyxrQkFDdEMsZ0NBQ0E7QUFFSixjQUFVLFNBQVMsS0FBSztBQUFBLE1BQ3RCLE1BQU07QUFBQSxNQUNOLE9BQUssVUFBSyxPQUFPLGlCQUFaLG1CQUEwQixxQkFBb0IsZ0JBQWdCO0FBQUEsSUFDckUsQ0FBQztBQUVELGNBQVUsU0FBUyxLQUFLO0FBQUEsTUFDdEIsTUFBTTtBQUFBLE1BQ04sS0FBSyxLQUFLLE9BQU8sU0FBUyxrQkFBa0IsZ0JBQWdCO0FBQUEsSUFDOUQsQ0FBQztBQUFBLEVBQ0g7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgIm1hdGNoIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiX2EiXQp9Cg==
