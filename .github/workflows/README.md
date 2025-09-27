# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated building, testing, and releasing of the OpenBafangTool Electron application.

## Workflows

### 1. `build.yml` - Continuous Integration
**Triggers:** Push to main/master/develop branches, Pull Requests

**Purpose:** 
- Runs tests and linting
- Builds the application on all platforms to ensure compatibility
- Validates that packaging works correctly

**What it does:**
- Installs dependencies and runs tests
- Builds the app for Windows, macOS, and Linux
- Tests Electron packaging without creating releases

### 2. `release.yml` - Automated Releases
**Triggers:** Git tags starting with `v*` (e.g., `v1.0.0`, `v2.1.0-rc`)

**Purpose:** 
- Creates official releases with downloadable binaries
- Builds for all supported platforms
- Uploads release assets to GitHub Releases

**What it does:**
- Builds signed/unsigned Electron apps for Windows, macOS, and Linux
- Creates GitHub release with generated release notes
- Uploads installation files (.exe, .dmg, .AppImage)

### 3. `release-signed.yml` - Code-Signed Releases (Optional)
**Triggers:** Manual dispatch or tags ending with `-signed`

**Purpose:** 
- Creates releases with code-signed binaries for enhanced security
- Requires code signing certificates to be configured

**What it does:**
- Same as regular release but with code signing enabled
- Windows: Authenticode signing
- macOS: Apple Developer ID signing and notarization
- Linux: Standard AppImage (no signing available)

### 4. `nightly.yml` - Nightly Development Builds
**Triggers:** Daily at 2 AM UTC, Manual dispatch

**Purpose:** 
- Creates automated nightly builds for testing latest changes
- Only builds if there were commits in the last 24 hours
- Helps with continuous testing of development changes

**What it does:**
- Checks for recent commits
- Builds development versions with nightly version numbers
- Creates pre-release with recent changes listed
- Automatically cleans up old nightly releases

### 5. `pr-validation.yml` - Pull Request Validation
**Triggers:** Pull request events (opened, synchronized, reopened)

**Purpose:** 
- Validates pull requests before they can be merged
- Ensures code quality and build compatibility
- Provides detailed feedback on PR status

**What it does:**
- Runs linting, tests, and builds
- Tests cross-platform compatibility
- Performs security checks
- Comments on PR with build summary and bundle size info

### 6. `security.yml` - Security & Dependency Monitoring
**Triggers:** Weekly schedule, Manual dispatch, Dependency file changes

**Purpose:** 
- Monitors project for security vulnerabilities
- Tracks dependency updates and license compliance
- Analyzes bundle size trends

**What it does:**
- Runs npm security audit
- Checks for outdated packages
- Validates license compatibility
- Analyzes bundle sizes
- Creates weekly summary issues

## Usage

### Creating a Regular Release

1. Ensure your code is ready for release
2. Create and push a version tag:
   ```bash
   git tag v2.2.2
   git push origin v2.2.2
   ```
3. The workflow will automatically build and create a release

### Creating a Pre-release

Use tags with pre-release identifiers:
```bash
git tag v2.2.2-rc
git tag v2.2.2-beta
git tag v2.2.2-alpha
```

These will be marked as pre-releases automatically.

### Manual Release

You can also trigger releases manually from the GitHub Actions tab using the "workflow_dispatch" trigger.

### Nightly Builds

Nightly builds are created automatically if there were commits in the last 24 hours. They can also be triggered manually. Nightly builds:

- Use version format: `nightly-YYYYMMDD-{commit-hash}`
- Are marked as pre-releases
- Include recent commit information
- Are automatically cleaned up (old nightlies are deleted)
- Are intended for testing and development only

## Code Signing Setup (Optional)

To enable code signing, you'll need to:

### For macOS:
1. Add these secrets to your GitHub repository:
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_ID_PASSWORD`: App-specific password
   - `CSC_LINK`: Base64-encoded .p12 certificate file
   - `CSC_KEY_PASSWORD`: Certificate password

### For Windows:
1. Add these secrets:
   - `CSC_LINK`: Base64-encoded .p12 certificate file  
   - `CSC_KEY_PASSWORD`: Certificate password

### Enable Code Signing:
1. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflows
2. Use the `release-signed.yml` workflow instead of `release.yml`

## Platform-Specific Notes

### Linux
- Requires `libudev-dev` system dependency
- Builds AppImage format
- No code signing available

### Windows  
- Builds NSIS installer (.exe)
- Can be code-signed with Authenticode certificates

### macOS
- Builds universal binaries (Intel + Apple Silicon)
- Creates DMG installer
- Can be signed and notarized with Apple Developer certificates
- Requires entitlements for certain features

## Output Files

The workflows produce these files:

- **Windows**: `OpenBafangTool-Setup-{version}-win-x64.exe`
- **macOS**: `OpenBafangTool-{version}-mac-universal.dmg`
- **Linux**: `OpenBafangTool-{version}-linux-x64.AppImage`

## Troubleshooting

### Build Failures
- Check the Actions logs for specific error messages
- Ensure all dependencies are properly listed in package.json
- Verify that the build works locally first

### Release Issues
- Make sure the tag follows the `v*` pattern
- Check that the repository has write permissions for the workflow
- Verify that secrets are properly configured if using code signing

### Platform-Specific Issues
- Linux: May need additional system dependencies
- macOS: Code signing requires valid Apple Developer account
- Windows: May need specific Visual Studio build tools for native modules