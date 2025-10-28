# Changelog

All notable changes to the Meeting Tasks plugin will be documented in this file.

## [3.4.0] - 2025-10-28

### Added - Mobile Support 🎉
- **Full mobile platform support** - Plugin now works on iOS and Android Obsidian apps
- **Platform detection system** - Automatic detection and optimization for mobile vs desktop
- **PKCE OAuth flow** - Secure mobile authentication using custom URL scheme (`obsidian://meeting-tasks-callback`)
- **Mobile-optimized constraints**:
  - 25 email batch limit (vs 500 on desktop)
  - 50 task clustering limit (vs unlimited on desktop)
  - 1-day default lookback (vs 3 days on desktop)
  - Network usage warnings on cellular
- **Touch-optimized UI**:
  - 44pt minimum touch targets (iOS HIG compliant)
  - 1.5x scaled buttons and checkboxes
  - Vertical stacked layouts for one-handed use
  - Improved tap margins and spacing
- **Desktop OAuth fix** - Changed to `http://127.0.0.1:3000/callback` (Google OAuth policy compliance)

### Changed
- OAuth server now uses port 3000 (was 42813) to match Google Cloud Console requirements
- Desktop OAuth callback updated to use loopback IP (127.0.0.1) instead of localhost
- Manifest flag `isDesktopOnly` set to `false` to enable mobile installations

### Technical
- Added `PlatformManager` class for platform detection and configuration
- Added `MobileOAuthHandler` class for PKCE authentication flow
- Added browser API mocks for testing (crypto, window, btoa)
- Added 80 new mobile-specific tests (213 total tests, all passing)
- Test coverage for PKCE security, platform constraints, and integration scenarios

### Fixed
- OAuth redirect URI mismatch errors on desktop
- Google Cloud Console compliance issues with localhost URLs

---

## [3.3.0] - 2025-01-27

### Added
- Advanced clustering features
- Enhanced dashboard UI
- Multi-filter support
- Dynamic label processor architecture

### Changed
- Improved clustering persistence
- Better task organization

---

## Earlier Versions

See git history for changes in versions prior to 3.3.0.
