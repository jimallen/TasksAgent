# Task Clustering Example

This example demonstrates how the AI-powered clustering feature automatically groups related tasks from multiple emails.

## Before Clustering (Normal View)

Tasks displayed in a simple list organized by assignee:

### Tasks assigned to @Mike Rodriguez
- [ ] Design offline data sync architecture 📅 2025-01-20 🔴
- [ ] Review database schema changes 📅 2025-01-22 🟡
- [ ] Document API endpoints for mobile sync 📅 2025-01-25 🟡

### Tasks assigned to @Alex Kim
- [ ] Implement biometric authentication for iOS 📅 2025-01-25 🔴
- [ ] Write unit tests for offline queue manager 📅 2025-01-30 🟡
- [ ] Update user session handling 📅 2025-01-28 🟡

### Tasks assigned to @DevOps Team
- [ ] Rotate all production API keys and secrets 📅 2025-01-17 🔴
- [ ] Enable database connection encryption 📅 2025-01-27 🟡

---

## After Clustering (Cluster View)

AI automatically identifies relationships and groups tasks together:

### 📦 Cluster: Offline Mode Implementation

**Cluster Description:** Tasks related to building offline functionality for the mobile app, including data sync architecture, local storage, and conflict resolution.

**Tasks:**
- [ ] Design offline data sync architecture [[@Mike Rodriguez]] 📅 2025-01-20 🔴 🧩 cluster:offline-mode
- [ ] Write unit tests for offline queue manager [[@Alex Kim]] 📅 2025-01-30 🟡 🧩 cluster:offline-mode
- [ ] Review database schema changes [[@Mike Rodriguez]] 📅 2025-01-22 🟡 🧩 cluster:offline-mode

**AI Suggestion:** 💡
*These tasks form a cohesive feature epic. Consider:*
- *Sequencing: Architecture design → Schema review → Testing*
- *Team coordination: Mike and Alex should sync daily*
- *Estimated completion: 2-3 sprints*
- *Confidence: 94%*

---

### 📦 Cluster: Security Critical Updates

**Cluster Description:** Urgent security vulnerabilities identified in Q4 audit requiring immediate remediation to prevent potential breaches.

**Tasks:**
- [ ] Rotate all production API keys and secrets [[@DevOps Team]] 📅 2025-01-17 🔴 🧩 cluster:security-critical
- [ ] Update authentication library to v4.2.1 [[@Backend Team]] 📅 2025-01-19 🔴 🧩 cluster:security-critical
- [ ] Implement rate limiting on login endpoint [[@API Team]] 📅 2025-01-20 🔴 🧩 cluster:security-critical
- [ ] Update user session handling [[@Alex Kim]] 📅 2025-01-28 🟡 🧩 cluster:security-critical

**AI Suggestion:** 💡
*Critical security cluster - all tasks marked high priority. Consider:*
- *All have tight deadlines (this week)*
- *Should be treated as single coordinated security release*
- *Recommend: War room coordination, shared Slack channel*
- *Risk: High impact if delayed*
- *Confidence: 97%*

---

### 📦 Cluster: Authentication & Authorization

**Cluster Description:** Authentication improvements including biometric support, session management, and access control enhancements.

**Tasks:**
- [ ] Implement biometric authentication for iOS [[@Alex Kim]] 📅 2025-01-25 🔴 🧩 cluster:auth-security
- [ ] Update user session handling [[@Alex Kim]] 📅 2025-01-28 🟡 🧩 cluster:auth-security
- [ ] Add security headers to all HTTP responses [[@Frontend Team]] 📅 2025-01-25 🟡 🧩 cluster:auth-security

**AI Suggestion:** 💡
*Auth cluster with @Alex Kim as primary owner. Consider:*
- *Two tasks assigned to same person - watch for capacity*
- *Biometric auth should be done first (dependency)*
- *Could combine session handling + security headers testing*
- *Confidence: 89%*

---

### 📦 Cluster: Database & Infrastructure

**Cluster Description:** Backend infrastructure improvements including database encryption, connection pooling, and performance optimization.

**Tasks:**
- [ ] Enable database connection encryption [[@DevOps Team]] 📅 2025-01-27 🟡 🧩 cluster:infrastructure
- [ ] Review database schema changes [[@Mike Rodriguez]] 📅 2025-01-22 🟡 🧩 cluster:infrastructure
- [ ] Document API endpoints for mobile sync [[@Mike Rodriguez]] 📅 2025-01-25 🟡 🧩 cluster:infrastructure

**AI Suggestion:** 💡
*Infrastructure cluster with backend focus. Consider:*
- *Schema review should happen before encryption changes*
- *API documentation can run in parallel*
- *All medium priority - schedule after critical security work*
- *Confidence: 85%*

---

## Clustering Features Demonstrated

### Smart Grouping
✅ Identifies related tasks across different emails and meetings
✅ Considers task descriptions, tags, assignees, and context
✅ Groups by project, feature area, or initiative

### Persistent Storage
✅ Cluster IDs saved in markdown: `🧩 cluster:offline-mode`
✅ Survives plugin reinstalls and Obsidian restarts
✅ Manually editable if needed

### AI Insights
✅ Explains why tasks were grouped together
✅ Suggests task sequencing and dependencies
✅ Identifies coordination needs across teams
✅ Provides confidence scores for groupings

### Editable Cluster Titles
✅ Click ✏️ button to customize cluster names
✅ Titles persist separately from task data
✅ Makes clusters more meaningful for your workflow

### Smart vs Force Re-clustering
✅ **Smart Mode:** Only clusters new tasks, preserves existing clusters
✅ **Force Mode:** Re-analyzes all tasks, creates fresh clusters
✅ Choose based on whether you want to refine or rebuild

---

## Using Clusters in Your Workflow

**View Toggle:**
- Switch between normal and cluster view instantly
- No API calls when toggling (clusters already computed)
- All filters work in both views

**Filter Integration:**
- Select "High Priority" to see only 🔴 tasks across clusters
- Use "This Week" to focus on near-term clustered work
- Combine filters: "High Priority + Past Due" for urgent items

**When to Re-cluster:**
- After processing large email batches
- When project priorities shift
- To identify new relationships between tasks
- Use **Smart Mode** for incremental updates
- Use **Force Mode** for complete reorganization
