# Obsidian Meeting Tasks Plugin - Project Structure

## Directory Overview

```
obsidian-plugin/
├── src/                        # Source code
│   ├── main.ts                # Main plugin entry point
│   ├── api/                   # API and WebSocket layer
│   │   ├── client.ts          # HTTP API client with retry logic
│   │   ├── client.test.ts     # API client tests
│   │   ├── endpoints.ts       # API endpoint definitions
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── websocket.ts       # WebSocket connection manager
│   │   └── websocket.test.ts  # WebSocket tests
│   ├── services/              # Business logic services
│   │   ├── noteCreator.ts     # Note creation with Templater
│   │   ├── taskProcessor.ts   # Email/task processing
│   │   ├── scheduler.ts       # Automatic check scheduling
│   │   └── cache.ts           # Offline caching service
│   ├── ui/                    # User interface components
│   │   ├── ribbonIcon.ts      # Sidebar ribbon icon
│   │   ├── statusBar.ts       # Status bar component
│   │   ├── commands.ts        # Command palette commands
│   │   ├── modals.ts          # Progress/results/error modals
│   │   ├── notifications.ts   # Notification system
│   │   └── settingsTab.ts     # Settings UI implementation
│   ├── utils/                 # Utility functions
│   │   ├── errors.ts          # Custom error classes
│   │   ├── errorHandler.ts    # Global error handler
│   │   ├── logger.ts          # Logging service
│   │   ├── validators.ts      # Input validation
│   │   └── formatters.ts      # Text formatting utilities
│   └── settings.ts            # Settings types and defaults
├── manifest.json              # Plugin manifest
├── package.json               # Node dependencies
├── tsconfig.json              # TypeScript configuration
├── jest.config.js             # Jest test configuration
├── esbuild.config.js          # Build configuration
├── build.js                   # Release build script
├── styles.css                 # Plugin styles
└── README.md                  # Documentation

```

## Key Components

### Core Systems

1. **Plugin Lifecycle** (`main.ts`)
   - Initialization and cleanup
   - Service orchestration
   - Helper methods for UI components

2. **API Layer** (`api/`)
   - RESTful client with exponential backoff
   - WebSocket real-time updates
   - Type-safe interfaces for all data

3. **Services** (`services/`)
   - Note creation with duplicate detection
   - Task processing pipeline
   - Scheduled checks with quiet hours
   - Offline caching for resilience

4. **User Interface** (`ui/`)
   - Rich modal system
   - Status indicators
   - Command palette integration
   - Comprehensive settings UI

5. **Error Handling** (`utils/`)
   - Custom error types
   - Global error catching
   - User-friendly messages
   - Performance monitoring

## Data Flow

```
Gmail → TasksAgent Service → Plugin API Client → Task Processor
                                      ↓
                              Note Creator Service
                                      ↓
                              Obsidian Vault (Notes)
                                      ↓
                              User Notifications
```

## Configuration

### Required Settings
- `serviceUrl`: TasksAgent service endpoint
- `anthropicApiKey`: Claude API key
- `targetFolder`: Where to create notes

### Optional Features
- WebSocket real-time updates
- Automatic checking schedule
- Templater integration
- Quiet hours configuration
- Custom email patterns
- Notification preferences

## Build & Deployment

### Development
```bash
npm install
npm run dev
npm test
```

### Production
```bash
npm run build:release
# Creates dist/ with minified bundle
# Generates meeting-tasks-X.X.X.zip
```

### Testing
- Unit tests for all services
- WebSocket connection tests
- Settings validation tests
- API retry logic tests

## Integration Points

1. **TasksAgent Service**
   - HTTP API on port 3000
   - WebSocket for real-time updates
   - Gmail proxy authentication

2. **Obsidian API**
   - Vault file operations
   - Settings management
   - UI component registration
   - Plugin lifecycle hooks

3. **External Plugins**
   - Templater (optional)
   - Daily Notes (optional linking)

## Performance Characteristics

- **Memory**: ~50-100MB typical usage
- **Processing**: 2-5 seconds per transcript
- **Cache**: 1-hour expiry (configurable)
- **Batch Size**: 50 emails max per check
- **Lookback**: 5 days default window

## Security Considerations

- All processing local (no cloud)
- API keys in vault config only
- OAuth through TasksAgent proxy
- Optional transcript caching
- No telemetry by default

## Future Enhancements

- [ ] Multiple email account support
- [ ] Custom task extraction rules
- [ ] Meeting series detection
- [ ] Calendar integration
- [ ] Mobile app support
- [ ] Cloud sync options

---

Last Updated: 2024
Version: 1.0.0