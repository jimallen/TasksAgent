---
description: Generate PRD for new features in existing codebases
---

Generate a Product Requirements Document (PRD) for new features in existing codebases following the PRD generation process:

1. **Analyze Existing Codebase**: Understand the current architecture and patterns
2. **Check for Linear Ticket**: Ask if there's a Linear ticket to reference
3. **Receive Initial Prompt**: User provides a brief description or request for a new feature
4. **Ask Clarifying Questions**: Gather sufficient detail to understand the "what" and "why" (not the "how")
5. **Generate PRD**: Create a structured PRD document with integration considerations
6. **Save PRD**: Save as `prd-[feature-name].md` in `/tasks/` directory

## Step 1: Analyze Existing Codebase

**Before gathering requirements, understand the existing system:**
- Search for related functionality in the codebase
- Identify current architecture patterns and conventions
- Check for existing components that might be extended or reused
- Note any constraints or dependencies that affect the feature
- Review existing tests to understand quality standards

## Step 2: Check for Linear Ticket

**First, ask the user:**
> "Do you have a Linear ticket for this feature? If you have Linear configured via MCP, I can fetch the requirements directly."

**If Linear ticket exists:**
- If Linear MCP available: Fetch issue details via MCP
- Extract feature description and requirements
- Note acceptance criteria and user stories
- Check for linked design docs or mockups
- Use this information to inform PRD creation

**If no Linear ticket:**
- Proceed with manual requirements gathering
- Ask clarifying questions to understand the feature

## Clarifying Questions to Ask

**Standard questions:**
- **Problem/Goal**: What problem does this feature solve? What is the main goal?
- **Target User**: Who is the primary user of this feature?
- **Core Functionality**: What key actions should users be able to perform?
- **User Stories**: Provide user stories (As a [user], I want to [action] so that [benefit])
- **Acceptance Criteria**: How will we know when this is successfully implemented?
- **Scope/Boundaries**: What should this feature NOT do (non-goals)?
- **Data Requirements**: What data does this feature need to display or manipulate?
- **Design/UI**: Any existing mockups or UI guidelines to follow?
- **Edge Cases**: Any potential edge cases or error conditions to consider?

**Integration-specific questions (for existing codebases):**
- **Integration Points**: Which existing modules/components will this feature interact with?
- **Code Patterns**: Should this follow existing patterns in the codebase?
- **Migration**: Will this replace or work alongside existing functionality?
- **Backward Compatibility**: Must we maintain compatibility with existing features?
- **Performance Impact**: Are there performance considerations given current architecture?

## PRD Structure (For Existing Codebases)

1. **Introduction/Overview**: Feature description and problem it solves
2. **Current State Analysis**: Summary of existing related functionality
3. **Goals**: Specific, measurable objectives
4. **User Stories**: User narratives describing feature usage and benefits
5. **Functional Requirements**: Numbered list of specific functionalities
6. **Integration Requirements**: How the feature fits into existing architecture
   - Components to modify or extend
   - New components needed
   - API changes required
   - Database schema changes
7. **Non-Goals (Out of Scope)**: What this feature will NOT include
8. **Design Considerations**: UI/UX requirements, following existing patterns
9. **Technical Considerations**: 
   - Existing constraints and dependencies
   - Performance implications
   - Security considerations
   - Testing strategy (unit, integration, e2e)
10. **Success Metrics**: How success will be measured
11. **Open Questions**: Remaining questions needing clarification

## Important

- **ALWAYS** analyze the existing codebase first before gathering requirements
- Do NOT start implementing the PRD
- Ask clarifying questions that consider the existing system
- Incorporate both user answers and codebase analysis into the PRD
- Focus on how the new feature integrates with existing code