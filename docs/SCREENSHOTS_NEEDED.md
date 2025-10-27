# Screenshots Needed for README

## Required Screenshots

To complete the open source preparation, capture these screenshots and place them in `docs/images/`:

### 1. Dashboard - Task List View
**Filename:** `docs/images/dashboard-task-view.png`

**How to capture:**
1. Open Obsidian with the plugin installed
2. Click the dashboard icon or use command palette
3. Ensure you have some tasks loaded
4. Show filters in action (select "High Priority" or "This Week")
5. Capture full dashboard showing:
   - Task list organized by assignee
   - Filter buttons at top
   - Priority indicators (🔴 🟡)
   - Task checkboxes

**Tip:** Use sample/test data, not real work tasks!

---

### 2. Dashboard - Cluster View
**Filename:** `docs/images/dashboard-cluster-view.png`

**How to capture:**
1. In dashboard, click "Show Clusters" button
2. Ensure you have clustered tasks (run clustering if needed)
3. Capture showing:
   - Cluster cards with titles
   - Grouped tasks under each cluster
   - Cluster descriptions
   - Edit cluster title button (✏️)

---

### 3. Plugin Settings
**Filename:** `docs/images/settings-config.png`

**How to capture:**
1. Open Obsidian Settings
2. Navigate to Community Plugins → Meeting Tasks
3. Capture showing:
   - Gmail OAuth settings (with dummy/placeholder credentials shown)
   - Claude AI configuration
   - Label processors configuration
   - Dashboard preferences

**Important:** BLUR or replace any real API keys/credentials before publishing!

---

## After Capturing Screenshots

Once you have the images in `docs/images/`, run this to add them to README:

### Add to README after "Features" section:

\`\`\`markdown
## 📸 Screenshots

### Task Dashboard - List View
![Task Dashboard](./docs/images/dashboard-task-view.png)
*Organize and filter tasks with multi-filter support and priority indicators*

### Task Dashboard - Cluster View
![Cluster View](./docs/images/dashboard-cluster-view.png)
*AI-powered task clustering groups related tasks automatically*

### Plugin Configuration
![Settings](./docs/images/settings-config.png)
*Easy configuration through Obsidian's settings interface*
\`\`\`

---

## Optional: Demo GIF

For even better impact, create an animated GIF showing:
1. Processing emails
2. Opening dashboard
3. Toggling between views
4. Filtering tasks

**Tools:**
- macOS: QuickTime + [Gifski](https://gif.ski/)
- Windows: [ScreenToGif](https://www.screentogif.com/)
- Cross-platform: [LICEcap](https://www.cockos.com/licecap/)

Place as: `docs/images/demo.gif` and add to top of README.
