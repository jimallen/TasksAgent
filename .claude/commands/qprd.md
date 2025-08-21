---
description: Generate PRD
---

Generate a Product Requirements Document (PRD) following the PRD generation process:

1. **Check for Linear Ticket**: Ask if there's a Linear ticket to reference
2. **Receive Initial Prompt**: User provides a brief description or request for a new feature
3. **Ask Clarifying Questions**: Gather sufficient detail to understand the "what" and "why" (not the "how")
4. **Generate PRD**: Create a structured PRD document with all required sections
5. **Save PRD**: Save as `prd-[feature-name].md` in `/tasks/` directory

## Step 1: Check for Linear Ticket

**First, ask the user:**
> "Do you have a Linear ticket for this feature? If you have Linear configured via MCP, I can fetch the requirements directly."

**If Linear ticket exists:**
- If Linear MCP available: Fetch issue details via MCP
- Extract feature description and requirements
- Note acceptance criteria and user stories
- Check for linked design docs or mockups
- Use this information to pre-fill PRD sections

**If no Linear ticket:**
- Proceed with manual requirements gathering
- Ask clarifying questions to understand the feature

## Clarifying Questions to Ask

- **Problem/Goal**: What problem does this feature solve? What is the main goal?
- **Target User**: Who is the primary user of this feature?
- **Core Functionality**: What key actions should users be able to perform?
- **User Stories**: Provide user stories (As a [user], I want to [action] so that [benefit])
- **Acceptance Criteria**: How will we know when this is successfully implemented?
- **Scope/Boundaries**: What should this feature NOT do (non-goals)?
- **Data Requirements**: What data does this feature need to display or manipulate?
- **Design/UI**: Any existing mockups or UI guidelines to follow?
- **Edge Cases**: Any potential edge cases or error conditions to consider?

## PRD Structure

1. **Introduction/Overview**: Feature description and problem it solves
2. **Goals**: Specific, measurable objectives
3. **User Stories**: User narratives describing feature usage and benefits
4. **Functional Requirements**: Numbered list of specific functionalities
5. **Non-Goals (Out of Scope)**: What this feature will NOT include
6. **Design Considerations** (Optional): UI/UX requirements, mockups
7. **Technical Considerations** (Optional): Constraints, dependencies
8. **Success Metrics**: How success will be measured
9. **Open Questions**: Remaining questions needing clarification

## Important

- Do NOT start implementing the PRD
- Always ask clarifying questions first
- Incorporate user answers to improve the PRD