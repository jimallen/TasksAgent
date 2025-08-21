---
description: Executive code review with historical analysis and visual reports
---

# Executive Code Review

Comprehensive strategic review providing historical context, architectural analysis, and visual documentation for management decisions.

## Review Pipeline

```mermaid
graph LR
    A[Review Request] --> B[Historical Analysis]
    B --> C[Architecture Assessment]
    C --> D[Generate Diagrams]
    D --> E[Risk Analysis]
    E --> F[Executive Report]
```

## Phase 1: Historical Context

### Analyze Recent Development Activity

1. **Pull Request History**
   ```bash
   # Check if GitHub CLI is available
   if ! command -v gh &> /dev/null; then
     echo "⚠️ GitHub CLI not installed. Install with: brew install gh (macOS) or see https://cli.github.com"
     echo "Skipping PR analysis..."
   else
     # Get recent PRs (last 10 or specified number)
     gh pr list --limit 10 --state all --json number,title,author,mergedAt,additions,deletions
     
     # Analyze PR patterns
     gh pr view [PR-NUMBER] --json files,reviews,comments
   fi
   ```

2. **Code Evolution Metrics**
   - Number of PRs in last 30/60/90 days
   - Average PR size (lines changed)
   - Most active contributors
   - Files with most changes (potential hotspots)
   - Time between PR creation and merge

3. **Commit Activity Analysis**
   ```bash
   # Check if git is available and in a git repository
   if ! command -v git &> /dev/null; then
     echo "⚠️ Git not installed"
     exit 1
   fi
   
   if ! git rev-parse --git-dir > /dev/null 2>&1; then
     echo "⚠️ Not in a git repository"
     exit 1
   fi
   
   # Recent commit activity
   git log --since="30 days ago" --pretty=format:"%h %an %ar - %s" --stat
   
   # Code churn by file
   git log --since="90 days ago" --pretty=format: --name-only | sort | uniq -c | sort -rg | head -20
   
   # Contributors and their impact
   git shortlog -sn --since="90 days ago"
   ```

## Phase 2: System Architecture Documentation

### Generate Visual Documentation

1. **Current System Architecture**
   ```mermaid
   graph TB
     subgraph "Frontend Layer"
       UI[User Interface]
       State[State Management]
     end
     
     subgraph "API Layer"
       REST[REST Endpoints]
       GQL[GraphQL]
       Auth[Authentication]
     end
     
     subgraph "Business Logic"
       Services[Service Layer]
       Domain[Domain Models]
     end
     
     subgraph "Data Layer"
       DB[(Database)]
       Cache[(Cache)]
       Queue[Message Queue]
     end
     
     UI --> REST
     UI --> GQL
     REST --> Services
     GQL --> Services
     Services --> Domain
     Services --> DB
     Services --> Cache
     Services --> Queue
   ```

2. **Data Flow Diagram**
   ```mermaid
   sequenceDiagram
     participant User
     participant Frontend
     participant API
     participant Service
     participant Database
     
     User->>Frontend: Action
     Frontend->>API: Request
     API->>Service: Process
     Service->>Database: Query/Update
     Database-->>Service: Result
     Service-->>API: Response
     API-->>Frontend: Data
     Frontend-->>User: Update UI
   ```

3. **Component Dependencies**
   - Identify tightly coupled components
   - Map service dependencies
   - Highlight circular dependencies
   - Show external service integrations

## Phase 3: Code Quality Metrics

### Gather Quantitative Data

1. **Technical Debt Indicators**
   ```bash
   # Check for grep availability
   if ! command -v grep &> /dev/null; then
     echo "⚠️ grep not available"
     exit 1
   fi
   
   # TODO/FIXME/HACK comments
   grep -r "TODO\|FIXME\|HACK" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0"
   
   # Test coverage trend (check if npm/package.json exists)
   if [ -f "package.json" ] && command -v npm &> /dev/null; then
     npm test -- --coverage 2>/dev/null || echo "⚠️ Coverage not configured"
     
     # Type coverage (optional tool)
     npx type-coverage 2>/dev/null || echo "⚠️ type-coverage not installed"
   else
     echo "⚠️ Not a Node.js project or npm not installed"
   fi
   ```

2. **Complexity Analysis**
   - Files over 500 lines (potential for splitting)
   - Functions over 50 lines (refactoring candidates)
   - Cyclomatic complexity scores
   - Duplicate code detection

3. **Dependency Health**
   ```bash
   # Check if Node.js project
   if [ -f "package.json" ] && command -v npm &> /dev/null; then
     # Outdated dependencies
     npm outdated 2>/dev/null || echo "⚠️ Unable to check outdated packages"
     
     # Security vulnerabilities
     npm audit 2>/dev/null || echo "⚠️ Unable to run security audit"
     
     # Bundle size analysis (if build script exists)
     if grep -q '"build"' package.json; then
       npm run build -- --analyze 2>/dev/null || echo "⚠️ Bundle analysis not configured"
     fi
   else
     echo "⚠️ Not a Node.js project or npm not installed"
   fi
   ```

## Phase 4: Strategic Assessment

### Review Checklist

#### 1. Architecture & Design
- **AD-1:** Alignment with long-term technical strategy
- **AD-2:** Scalability for 10x growth scenarios
- **AD-3:** Modularity and microservice readiness
- **AD-4:** API versioning and backward compatibility
- **AD-5:** Infrastructure as Code practices

#### 2. Technical Debt & Risk
- **TR-1:** Accumulated debt vs. velocity impact
- **TR-2:** Security vulnerability trends
- **TR-3:** Performance degradation patterns
- **TR-4:** Single points of failure
- **TR-5:** Bus factor (knowledge concentration)

#### 3. Team & Process Health
- **TP-1:** PR review turnaround times
- **TP-2:** Test coverage trends
- **TP-3:** Incident frequency and severity
- **TP-4:** Documentation completeness
- **TP-5:** Onboarding complexity for new developers

#### 4. Business Alignment
- **BA-1:** Feature delivery velocity
- **BA-2:** Time to market for changes
- **BA-3:** Operational costs projection
- **BA-4:** Compliance and regulatory readiness
- **BA-5:** Customer impact of technical decisions

## Phase 5: Executive Report Generation

### Comprehensive Report Structure

```markdown
# Executive Technical Review
**Date:** [Current Date]
**Repository:** [Repo Name]
**Review Period:** Last [N] days

## 📊 Development Velocity Dashboard

### Recent Activity (Last 30 Days)
- **Pull Requests Merged:** [Count]
- **Average PR Size:** [Lines]
- **Active Contributors:** [Count]
- **Average Time to Merge:** [Days]

### Code Health Metrics
- **Test Coverage:** [Percentage]%
- **Type Coverage:** [Percentage]%
- **Technical Debt Items:** [Count]
- **Security Vulnerabilities:** [Count]

## 🏗️ System Architecture

[Include generated architecture diagram]

### Key Architectural Decisions
1. [Decision 1 with rationale]
2. [Decision 2 with rationale]
3. [Decision 3 with rationale]

## 📈 Trend Analysis

### Positive Trends
- ✅ [Improvement 1]
- ✅ [Improvement 2]
- ✅ [Improvement 3]

### Areas of Concern
- ⚠️ **High Priority:** [Issue with impact]
- ⚠️ **Medium Priority:** [Issue with timeline]
- ⚠️ **Low Priority:** [Issue for consideration]

## 🎯 Strategic Recommendations

### Immediate Actions (This Sprint)
1. [Action 1 with expected outcome]
2. [Action 2 with expected outcome]

### Short-term (Next Quarter)
1. [Initiative 1 with business value]
2. [Initiative 2 with risk mitigation]

### Long-term (Next Year)
1. [Strategic direction 1]
2. [Strategic direction 2]

## 💰 Cost-Benefit Analysis

| Initiative | Cost (Dev Days) | Benefit | ROI |
|------------|----------------|---------|-----|
| [Project 1] | [Days] | [Impact] | [High/Medium/Low] |
| [Project 2] | [Days] | [Impact] | [High/Medium/Low] |

## 🚦 Risk Assessment

### Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | [H/M/L] | [H/M/L] | [Strategy] |
| [Risk 2] | [H/M/L] | [H/M/L] | [Strategy] |

### Operational Risks
- **Scalability:** [Assessment]
- **Reliability:** [Assessment]
- **Security:** [Assessment]

## 📋 Executive Summary

[2-3 paragraph summary of overall health, key achievements, main concerns, and recommended strategic direction]

**Overall Health Score:** [Excellent/Good/Fair/Needs Attention]
**Recommended Action:** [Continue/Monitor/Intervene]
**Next Review Date:** [Date]
```

## Quick Commands for Analysis

```bash
# Tool availability check function
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo "⚠️ $1 not installed. $2"
    return 1
  fi
  return 0
}

# Generate PR report
if check_tool "gh" "Install from https://cli.github.com"; then
  gh pr list --limit 20 --json number,title,author,mergedAt,additions,deletions > pr-report.json
fi

# Analyze code complexity (optional tools)
if [ -f "package.json" ]; then
  npx madge --circular --extensions ts,tsx src/ 2>/dev/null || echo "⚠️ madge not available"
  npx madge --image deps.svg src/ 2>/dev/null || echo "⚠️ Dependency graph generation skipped"
fi

# Check for security issues
if check_tool "npm" "Install Node.js"; then
  npm audit --json > security-report.json 2>/dev/null || echo "{}" > security-report.json
fi

# Analyze bundle size (if webpack is used)
if [ -f "webpack.config.js" ] || [ -f "stats.json" ]; then
  npx webpack-bundle-analyzer stats.json 2>/dev/null || echo "⚠️ Bundle analyzer not available"
fi

# Git statistics (with checks)
if check_tool "git" "Git is required"; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git log --format='%aN' | sort -u | wc -l  # Unique contributors
    git log --pretty=oneline --since="30 days ago" | wc -l  # Recent commits
  fi
fi
```

## Integration Points

### For Linear Issues

**Check MCP availability:**
```typescript
// Check if Linear MCP is configured for deeper integration
const linearAvailable = await checkMcpServer('linear');
if (linearAvailable) {
  // Can fetch comprehensive project metrics
  const projectMetrics = await fetchLinearProjectMetrics();
  // Can link PRs to Linear issues automatically
}
```

**If Linear MCP available:**
- Fetch project-level metrics and velocity
- Analyze cycle time trends
- Track feature delivery against roadmap
- Link PRs to business objectives automatically

**If GitHub CLI available:**
- Use `gh api` for advanced metrics
- Query PR/issue relationships
- Generate burndown charts

**Manual fallback:**
- Provide instructions for manual data gathering
- Suggest MCP setup for automation

### For CI/CD Metrics
- Build success rates
- Deployment frequency
- Mean time to recovery (MTTR)
- Change failure rate

## Success Metrics

An effective executive review provides:
1. Clear understanding of technical health
2. Quantified technical debt
3. Actionable recommendations
4. Risk visibility and mitigation plans
5. Alignment between technical and business strategy
6. Visual documentation for stakeholder communication

Remember: This review is for strategic decision-making, not code-level debugging. Focus on trends, patterns, and business impact.