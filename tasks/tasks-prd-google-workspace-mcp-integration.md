# Task List: Google Workspace MCP Integration - Phase 1

## Relevant Files

- `src/daemon/gmailMcpService.ts` - Gmail MCP service manager (to be updated for Google Workspace MCP)
- `src/daemon/gmailMcpService.spec.ts` - Unit tests for MCP service
- `src/services/gmailService.ts` - Gmail service integration layer (endpoint mapping updates)
- `src/services/gmailService.spec.ts` - Unit tests for Gmail service
- `src/daemon/httpServer.ts` - HTTP server for proxying MCP requests
- `src/daemon/service.ts` - Main daemon service orchestration
- `package.json` - Dependencies and scripts configuration
- `docs/GMAIL_SETUP.md` - Gmail setup documentation (to be updated)
- `docs/google-workspace-mcp-research.md` - Research and compatibility assessment (created)
- `docs/api-differences-analysis.md` - Detailed API differences and adaptation strategy (created)
- `docs/oauth-scope-requirements.md` - Comprehensive OAuth scope documentation (created)
- `test-google-workspace-mcp/` - Test directory with MCP clone (created)
- `test-google-workspace-mcp/test-tool-compatibility.md` - Tool compatibility test results (created)
- `.env.example` - Environment configuration template

## Notes

- Unit tests should be placed alongside code files
- Use `npm test` to run the test suite
- Maintain backward compatibility throughout Phase 1
- Focus on direct replacement without new features

## Tasks

- [x] 1.0 Research and Setup Google Workspace MCP
  - [x] 1.1 Clone and review Google Workspace MCP repository documentation
  - [x] 1.2 Identify API differences between old Gmail MCP and new Google Workspace MCP
  - [x] 1.3 Document OAuth scope requirements for Gmail-only operations
  - [x] 1.4 Test Google Workspace MCP locally with minimal Gmail example
  - [x] 1.5 Create compatibility mapping document for endpoint changes

- [x] 2.0 Update Dependencies and Configuration
  - [x] 2.1 Remove `@gongrzhe/server-gmail-autoauth-mcp` from package.json dependencies
  - [x] 2.2 Add `taylorwilsdon/google_workspace_mcp` as new dependency (Note: Python package, not npm)
  - [x] 2.3 Update npm scripts to reference new MCP command if needed (Note: Will be Python command)
  - [x] 2.4 Update .env.example with any new configuration variables
  - [x] 2.5 Run `npm install` and verify dependency resolution

- [x] 3.0 Refactor Gmail MCP Service Layer
  - [x] 3.1 Update MCP server spawn command in `gmailMcpService.ts`
  - [x] 3.2 Modify MCP initialization parameters for Google Workspace MCP
  - [x] 3.3 Update error handling for new MCP response format
  - [x] 3.4 Adjust process lifecycle management for new MCP behavior
  - [x] 3.5 Update logging to capture new MCP debug information

- [x] 4.0 Update Gmail Service Integration
  - [x] 4.1 Map `search_emails` endpoint to new Google Workspace MCP structure
  - [x] 4.2 Map `read_email` endpoint to new MCP implementation
  - [x] 4.3 Update request/response interfaces to match new MCP format
  - [x] 4.4 Maintain existing rate limiting (250 units/sec) with new MCP
  - [x] 4.5 Ensure attachment handling works with new MCP (documented limitation)

- [ ] 5.0 Update HTTP API and Daemon Integration
  - [x] 5.1 Remove `/gmail/*` proxy endpoints (no longer needed)
  - [ ] 5.2 Update health check to validate new MCP status
  - [ ] 5.3 Ensure daemon startup sequence properly initializes new MCP
  - [ ] 5.4 Update shutdown handlers for clean MCP termination
  - [ ] 5.5 Test manual trigger endpoint with new MCP integration

- [ ] 6.0 Testing and Validation
  - [ ] 6.1 Update unit tests in `gmailMcpService.spec.ts` for new MCP
  - [ ] 6.2 Update unit tests in `gmailService.spec.ts` for new endpoints
  - [ ] 6.3 Run full test suite and fix any failures
  - [ ] 6.4 Perform manual end-to-end test with real Gmail account
  - [ ] 6.5 Test with existing OAuth tokens to verify compatibility
  - [ ] 6.6 Load test to ensure performance parity

- [ ] 7.0 Documentation and Deployment
  - [ ] 7.1 Update `docs/GMAIL_SETUP.md` with new MCP setup instructions
  - [ ] 7.2 Update README.md with new dependency information
  - [ ] 7.3 Create migration guide for users upgrading from old MCP
  - [ ] 7.4 Update CLAUDE.md with new architecture details
  - [ ] 7.5 Test installation process from scratch
  - [ ] 7.6 Document any breaking changes or required actions

## Phase 2 & 3 Tasks (Future)

### Phase 2: Calendar Integration
- Add calendar service layer
- Implement follow-up meeting suggestions
- Create calendar event generation logic

### Phase 3: Drive Integration
- Add Drive service layer
- Implement agenda document creation
- Create folder organization system

---

*Task List Generated: 2025-01-19*
*Based on PRD Version: 2.0 (Phased Approach)*