# Product Requirements Document: Filter Button Counters

## Introduction/Overview
Add task count badges to the filter buttons in the Obsidian Meeting Tasks plugin dashboard, providing users with immediate visibility into task distribution across different categories. This enhancement will help users quickly understand their task landscape without needing to apply filters first.

## Current State Analysis
The dashboard currently features six filter buttons:
- High Priority, Medium Priority, Low Priority
- Due Today, Due This Week
- Completed

These buttons toggle task visibility but provide no indication of how many tasks match each filter. Users must click filters to discover task counts, reducing dashboard efficiency and requiring multiple interactions to understand task distribution.

**Existing Implementation:**
- Filter buttons are created in `createFilterButtons()` method
- Task counting logic already exists for statistics display
- Real-time updates occur when tasks are marked complete
- "My Tasks" toggle filters the entire view based on assignee

## Goals
1. **Improve Task Visibility**: Display task counts directly on filter buttons without requiring interaction
2. **Enhance User Efficiency**: Enable users to quickly assess workload distribution at a glance
3. **Maintain Context Awareness**: Show relevant counts based on current view mode (All Tasks vs My Tasks)
4. **Provide Visual Feedback**: Use styled badges with colors that complement the existing dark theme
5. **Support Real-time Updates**: Keep counters synchronized with task state changes

## User Stories
1. **As a project manager**, I want to see task counts on each priority filter so that I can quickly identify where team effort is concentrated
2. **As an individual contributor**, I want to see my personal task counts on filters so that I can prioritize my work effectively
3. **As a team lead**, I want to see at a glance how many high-priority items exist so that I can allocate resources appropriately
4. **As a user**, I want counters to update in real-time when I complete tasks so that I always have accurate information
5. **As a power user**, I want the counters to respect my "My Tasks" filter so that I see relevant counts for my context

## Functional Requirements
1. **Counter Display**
   - Display count as a badge/pill element within each filter button
   - Position badge to the right of the button label with appropriate spacing
   - Format: "High Priority" + badge with number (e.g., "High Priority [12]")

2. **Count Calculation**
   - Show total count of tasks matching each filter criterion regardless of active filters
   - Respect the current view mode (All Tasks vs My Tasks)
   - Exclude counts from calculation when zero to avoid clutter

3. **Visual Styling**
   - Badge background colors:
     - High Priority: Red-tinted (#ff6b6b or similar)
     - Medium Priority: Yellow-tinted (#ffd93d or similar)
     - Low Priority: Blue-tinted (#6bcf7f or similar)
     - Due Today: Orange-tinted (#ff9f43 or similar)
     - Due This Week: Purple-tinted (#a29bfe or similar)
     - Completed: Green-tinted (#1dd1a1 or similar)
   - Active filter badges: Brighter/more saturated colors
   - Inactive filter badges: Slightly muted colors
   - Text color: White or high-contrast color for readability

4. **Dynamic Updates**
   - Update counters when tasks are loaded initially
   - Recalculate when switching between "All Tasks" and "My Tasks"
   - Update in real-time when tasks are marked complete/incomplete
   - Refresh counts when dashboard is manually refreshed

5. **Zero Count Behavior**
   - Hide the counter badge completely when count is zero
   - Button remains clickable but without badge

6. **Performance Requirements**
   - Counter calculation must not block UI rendering
   - Use existing task array to avoid redundant file reads
   - Batch counter updates to prevent excessive redraws

## Integration Requirements
### Components to Modify
1. **taskDashboard.ts**
   - Extend `createFilterButtons()` to include badge elements
   - Add `calculateFilterCounts()` method for count computation
   - Update `updateTaskDisplay()` to refresh counters
   - Modify filter button click handlers to update active state styling

### New Components Needed
1. **Counter Calculation Logic**
   - Method to calculate counts for each filter type
   - Cache mechanism to avoid recalculation on every render

2. **Badge Rendering**
   - Helper function to create badge DOM elements
   - Style management for active/inactive states

### API Changes Required
- None - uses existing data structures

### Database Schema Changes
- None - operates on in-memory task array

## Non-Goals (Out of Scope)
1. Clicking on the counter badge itself (entire button remains clickable unit)
2. Animated transitions for counter changes
3. Showing counters in other views (only dashboard)
4. Persisting filter states between sessions
5. Custom color configuration for badges
6. Showing percentages or ratios
7. Tooltips with additional information

## Design Considerations
### UI/UX Requirements
- Badges must be clearly associated with their buttons
- Color scheme must work with both light and dark Obsidian themes
- Badge size must be large enough to read but not dominate button
- Maintain existing button spacing and layout

### Following Existing Patterns
- Use Obsidian's CSS variables where possible
- Match existing dashboard styling conventions
- Integrate with current theme-aware color system

## Technical Considerations
### Existing Constraints and Dependencies
- Must work within Obsidian plugin sandbox
- Cannot modify core Obsidian UI components
- Must respect existing TypeScript strict mode settings

### Performance Implications
- Task counting is O(n) where n is number of tasks
- With typical workloads (50-200 tasks), performance impact negligible
- Consider memoization for very large task lists (500+)

### Security Considerations
- No new security implications (uses existing data)

### Testing Strategy
1. **Unit Tests**
   - Test counter calculation logic with various task sets
   - Test zero count behavior
   - Test "My Tasks" filtering impact on counts

2. **Integration Tests**
   - Test counter updates when tasks marked complete
   - Test view mode switching updates
   - Test refresh button functionality

3. **Manual Testing**
   - Visual verification of badge styling
   - Theme compatibility testing
   - Performance testing with large task sets

## Success Metrics
1. **User Efficiency**: Reduction in filter clicks needed to understand task distribution
2. **Dashboard Load Time**: No measurable increase (< 50ms added)
3. **Visual Clarity**: Users can identify counts within 1 second of viewing
4. **Accuracy**: Counters always match actual filtered results
5. **User Satisfaction**: Positive feedback on improved dashboard usability

## Open Questions
1. Should we add a "total tasks" counter somewhere prominent on the dashboard?
2. Should the counter update with a subtle animation to draw attention to changes?
3. Should we consider adding keyboard shortcuts to toggle filters (e.g., Alt+1 for High Priority)?
4. Would users want an option to show/hide counters globally?
5. Should completed task count show total ever completed or just in current view?