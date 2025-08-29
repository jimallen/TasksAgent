# Task List: Filter Button Counters Implementation

## Relevant Files

- `obsidian-plugin/src/taskDashboard.ts` - Main dashboard component (MODIFIED - added filter count logic)
- `obsidian-plugin/src/taskDashboard.spec.ts` - Unit tests for dashboard functionality (TO BE CREATED)
- `obsidian-plugin/styles.css` - Styles for filter buttons and badges (MODIFIED - added badge styles)
- ~~`obsidian-plugin/src/types/dashboard.ts`~~ - Type definitions added directly to taskDashboard.ts

## Implementation Status

### ✅ COMPLETED FEATURES:
1. **Filter Counts Interface** - Added `FilterCounts` type with all count properties including overdue
2. **Count Calculation** - `calculateFilterCounts()` method handles all filter types
3. **Badge UI Components** - Created reusable `createBadgeElement()` with zero-count hiding
4. **Integration** - Badges integrated into filter buttons with proper data attributes
5. **Dynamic Styling** - Color-coded badges with active/inactive states and hover effects
6. **Real-time Updates** - Counts update on task changes with 150ms debouncing
7. **"My Tasks" Support** - Counts respect the current view mode filter
8. **Past Due Filter** - Added new "Past Due" filter button with overdue task support

### ⚠️ REQUIRES MANUAL TESTING:
- Theme compatibility (light/dark modes)
- Visual appearance in actual Obsidian environment
- Performance with large task counts (200+ tasks)

### 📝 TESTING NOTES:
- Unit tests require Jest setup in Obsidian plugin environment
- Manual testing needed for visual verification
- Follow existing TypeScript patterns and strict mode
- Ensure all changes are compatible with Obsidian's plugin API

## Tasks

- [x] **1.0 Create Counter Calculation Logic**
  - [x] 1.1 Add a `FilterCounts` interface to define the structure for storing counts (high, medium, low, today, week, overdue, completed)
  - [x] 1.2 Create `calculateFilterCounts()` method that takes the task array and returns FilterCounts object
  - [x] 1.3 Implement count calculation for priority filters (high, medium, low)
  - [x] 1.4 Implement count calculation for due date filters (today, this week, overdue)
  - [x] 1.5 Implement count calculation for completed tasks filter
  - [x] 1.6 Add logic to respect "My Tasks" mode when calculating counts
  - [x] 1.7 Add a private property `filterCounts: FilterCounts` to store cached counts

- [x] **2.0 Implement Badge UI Components**
  - [x] 2.1 Create `createBadgeElement()` helper method that returns an HTMLElement for the badge
  - [x] 2.2 Add badge HTML structure with appropriate CSS classes (filter-badge)
  - [x] 2.3 Implement logic to hide badge when count is zero
  - [x] 2.4 Add data attributes for filter type to enable styling

- [x] **3.0 Integrate Badges with Filter Buttons**
  - [x] 3.1 Modify `createFilterButtons()` to call badge creation for each button
  - [x] 3.2 Update button structure to include both label and badge elements
  - [x] 3.3 Ensure proper spacing between label and badge using flexbox
  - [x] 3.4 Add badge update logic to existing filter button click handlers
  - [x] 3.5 Store references to badge elements for dynamic updates

- [ ] **4.0 Add Dynamic Styling System**
  - [x] 4.1 Add CSS for `.filter-badge` base styles (padding, border-radius, font-size)
  - [x] 4.2 Define badge colors for each filter type using CSS custom properties
  - [x] 4.3 Add styles for active state badges (brighter colors)
  - [x] 4.4 Add styles for inactive state badges (muted colors)
  - [x] 4.5 Ensure badge text has high contrast (white or near-white)
  - [x] 4.6 Add hover effects for badges within buttons
  - [ ] 4.7 Test styling with both light and dark Obsidian themes (MANUAL TESTING REQUIRED)

- [x] **5.0 Implement Real-time Updates**
  - [x] 5.1 Add `updateFilterCounts()` method to recalculate and update badge displays
  - [x] 5.2 Call `updateFilterCounts()` after initial task load in `loadAndDisplayDashboard()`
  - [x] 5.3 Update counts when switching between "All Tasks" and "My Tasks" in toggle handler
  - [x] 5.4 Update counts after marking tasks complete/incomplete
  - [x] 5.5 Update counts after manual refresh button click
  - [x] 5.6 Implement debouncing for rapid updates to prevent UI flicker

- [ ] **6.0 Write Unit Tests**
  - [ ] 6.1 Create test file `taskDashboard.spec.ts` if it doesn't exist
  - [ ] 6.2 Write tests for `calculateFilterCounts()` with various task arrays
  - [ ] 6.3 Test zero count behavior (badge should be hidden)
  - [ ] 6.4 Test "My Tasks" mode filtering affects on counts
  - [ ] 6.5 Test count accuracy for each filter type
  - [ ] 6.6 Test edge cases (empty task array, all completed, no assignees)
  - [ ] 6.7 Mock DOM elements to test badge creation and updates

- [ ] **7.0 Manual Testing and Polish**
  - [ ] 7.1 Test visual appearance in Obsidian with default dark theme
  - [ ] 7.2 Test visual appearance with light theme
  - [ ] 7.3 Verify badge visibility and readability at different zoom levels
  - [ ] 7.4 Test with small task counts (1-9) and large counts (100+)
  - [ ] 7.5 Verify performance with 200+ tasks (should not lag)
  - [ ] 7.6 Test all filter combinations work correctly
  - [ ] 7.7 Document any edge cases or limitations discovered
  - [ ] 7.8 Create before/after screenshots for documentation