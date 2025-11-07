# Release Process Guide

This guide explains how to create a new release for the TasksAgent plugin.

## Prerequisites

- [ ] All tests passing (`npm test`)
- [ ] Build successful (`npm run build`)
- [ ] CHANGELOG.md updated
- [ ] Version bumped in `manifest.json` and `package.json`
- [ ] All changes committed and pushed

## Step-by-Step Release Process

### 1. Update Version Numbers

Update version in both files to match (e.g., `3.5.0`):

**manifest.json:**
```json
{
  "version": "3.5.0"
}
```

**package.json:**
```json
{
  "version": "3.5.0"
}
```

### 2. Update CHANGELOG.md

Add a new section for this release:
```markdown
## [3.5.0] - 2025-01-15

### Added
- New feature description

### Fixed
- Bug fix description

### Changed
- Improvement description
```

### 3. Build Production Files

```bash
npm run build
```

Verify the following files exist:
- `main.js`
- `manifest.json`
- `styles.css`

### 4. Commit Version Changes

```bash
git add manifest.json package.json CHANGELOG.md
git commit -m "chore: bump version to 3.5.0"
git push origin master
```

### 5. Create Git Tag

```bash
git tag v3.5.0
git push origin v3.5.0
```

### 6. Create GitHub Release

#### Using GitHub CLI (Recommended):

```bash
# Copy the release template
cp .github/RELEASE_TEMPLATE.md /tmp/release-notes.md

# Edit the template with your release details
# Replace placeholders with actual content

# Create the release
gh release create v3.5.0 \
  --title "v3.5.0 - [Your Release Title]" \
  --notes-file /tmp/release-notes.md \
  main.js manifest.json styles.css
```

#### Using GitHub Web Interface:

1. Go to https://github.com/jimallen/TasksAgent/releases/new
2. Tag: `v3.5.0`
3. Title: `v3.5.0 - [Your Release Title]`
4. Copy content from `.github/RELEASE_TEMPLATE.md`
5. Replace all placeholders:
   - `[Release Title]` → Your title
   - `X.X.X` → `3.5.0`
   - Fill in features, fixes, improvements
   - Update test counts and metrics
6. Upload assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
7. Click "Publish release"

## Release Template Placeholders

When using the template, replace these placeholders:

| Placeholder | Example |
|------------|---------|
| `[Release Title]` | "Enhanced Task Clustering" |
| `X.X.X` | "3.5.0" |
| `[brief description]` | "improved AI-powered task grouping" |
| `[Feature Name]` | "Smart Re-clustering" |
| `**Feature highlight**` | Specific bullet points |
| `**X new tests**` | "15 new tests" |
| `**Total tests: X**` | "Total tests: 228" |
| Coverage metrics | "85% coverage on clustering module" |

## Release Checklist

Before publishing:

- [ ] Version numbers match in all files
- [ ] CHANGELOG.md is updated
- [ ] All tests pass
- [ ] Build artifacts exist and are correct
- [ ] Git tag created and pushed
- [ ] Release notes are complete (no placeholders)
- [ ] Installation instructions are accurate
- [ ] Documentation links work

After publishing:

- [ ] Test the one-liner install command
- [ ] Verify manual installation works
- [ ] Check that assets are downloadable
- [ ] Announce in relevant channels (if applicable)

## Testing the Release

### Test One-Liner Install

```bash
# From a fresh system (or container)
curl -fsSL https://raw.githubusercontent.com/jimallen/TasksAgent/master/install.sh | bash
```

### Test Manual Install

1. Download assets from release page
2. Install to a test vault
3. Verify plugin loads correctly
4. Test basic functionality

## Troubleshooting

### "Asset not found" errors

- Ensure all three files (`main.js`, `manifest.json`, `styles.css`) are uploaded
- Check file names match exactly (case-sensitive)

### One-liner install fails

- Verify `install.sh` is up to date on master branch
- Check repository name in script matches actual repo
- Test the raw URL works: `https://raw.githubusercontent.com/jimallen/TasksAgent/master/install.sh`

### Version mismatch

- Ensure `manifest.json` and `package.json` have the same version
- Git tag should match (with `v` prefix: `v3.5.0`)

## Hotfix Releases

For urgent bug fixes:

1. Create a hotfix branch: `git checkout -b hotfix/3.5.1`
2. Make the fix
3. Bump to patch version: `3.5.1`
4. Follow normal release process
5. Merge back to master: `git checkout master && git merge hotfix/3.5.1`

## Pre-releases

For testing new features:

```bash
# Tag with pre-release suffix
git tag v3.6.0-beta.1
git push origin v3.6.0-beta.1

# Create release with pre-release flag
gh release create v3.6.0-beta.1 \
  --title "v3.6.0-beta.1 - Testing New Feature" \
  --notes "This is a pre-release for testing. Use at your own risk." \
  --prerelease \
  main.js manifest.json styles.css
```

## Support

For questions about the release process:
- Review past releases for examples
- Check GitHub's [release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- Open an issue if something is unclear
