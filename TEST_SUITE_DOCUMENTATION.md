# Test Suite Documentation

## Overview
This document provides information about all available test scripts in the project.

## Available Tests

### 1. API Integration Test Suite (`test-api-integration.ps1`)
**Purpose**: Comprehensive integration testing of all major API endpoints

**What it tests**:
- ✅ MCP API endpoints (GET/POST)
- ✅ Slack integration endpoints (Events, Commands, Interactions)
- ✅ GitHub OAuth callback
- ✅ Health checks (main page)
- ✅ Error handling (404, 405, 401)
- ✅ Input validation

**How to run**:
```powershell
.\test-api-integration.ps1
```

**Requirements**:
- Server must be running on port 9002
- Run `npm run dev` before executing tests

**Expected Output**:
- Green ✅ for passing tests
- Red ❌ for failing tests
- Summary with pass/fail counts

---

### 2. MCP Endpoint Test (`test-mcp-endpoint.ps1`)
**Purpose**: Focused testing of the MCP code generation endpoint

**What it tests**:
- Endpoint availability
- Request validation
- Code generation workflow
- Error handling for various scenarios

**How to run**:
```powershell
.\test-mcp-endpoint.ps1
```

**Requirements**:
- Server running on port 9002
- Valid `GITHUB_TOKEN` in `.env.local`
- GitHub issue #1 must exist in repository

---

### 3. Full MCP Test Suite (`test-mcp-full.ps1`)
**Purpose**: Complete end-to-end MCP system testing

**What it tests**:
- Full code generation pipeline
- GitHub integration
- PR creation and validation
- Issue assignment verification

**How to run**:
```powershell
.\test-mcp-full.ps1
```

---

### 4. GitHub Tools Test (`test-github-tools.ts`)
**Purpose**: Unit testing for GitHub API integration tools

**How to run**:
```bash
npx tsx test-github-tools.ts
```

---

### 5. Slack Bot Test (`test-slack-bot.js`)
**Purpose**: Testing Slack bot functionality

**How to run**:
```bash
node test-slack-bot.js
```

---

### 6. Gemini Issue Detection Test (`test-gemini-issue-detection.js`)
**Purpose**: Testing AI-powered issue detection

**How to run**:
```bash
node test-gemini-issue-detection.js
```

---

### 7. MCP Issue #22 Test (`test-mcp-issue-22.ps1`)
**Purpose**: Specific test for issue #22 scenario

**How to run**:
```powershell
.\test-mcp-issue-22.ps1
```

## Test Workflow

### Pre-test Checklist
1. ✅ Start the development server: `npm run dev`
2. ✅ Verify server is running on port 9002
3. ✅ Ensure `.env.local` has required environment variables:
   - `GITHUB_TOKEN`
   - `SLACK_BOT_TOKEN` (for Slack tests)
   - `SLACK_SIGNING_SECRET` (for Slack tests)

### Running All Tests
To run the complete test suite:

```powershell
# Start the server
npm run dev

# In a new terminal, run tests sequentially
.\test-api-integration.ps1
.\test-mcp-endpoint.ps1
.\test-mcp-full.ps1
```

## Test Results Interpretation

### Success Indicators
- ✅ Green checkmarks
- Status codes matching expected values
- No error messages
- Exit code 0

### Failure Indicators
- ❌ Red X marks
- Unexpected status codes
- Error messages in output
- Exit code 1

## Common Issues and Solutions

### Issue: "Server is not running"
**Solution**: Start the dev server with `npm run dev`

### Issue: "GITHUB_TOKEN not set"
**Solution**: Add `GITHUB_TOKEN=your_token` to `.env.local`

### Issue: "User not assigned to issue"
**Solution**: Assign the user to the GitHub issue before testing

### Issue: "Rate limit exceeded"
**Solution**: Wait for GitHub API rate limit to reset (check headers)

### Issue: "Invalid Slack signature"
**Solution**: Ensure `SLACK_SIGNING_SECRET` is correctly set

## Contributing Tests

When adding new tests:
1. Follow the naming convention: `test-[feature-name].[ps1|ts|js]`
2. Include clear test descriptions
3. Add expected vs actual result validation
4. Document the test in this file
5. Use consistent color coding (Green=Pass, Red=Fail, Yellow=Warning)

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    npm run dev &
    sleep 5
    pwsh -File test-api-integration.ps1
```

## Test Coverage

Current coverage areas:
- ✅ API Endpoints
- ✅ Authentication/Authorization
- ✅ GitHub Integration
- ✅ Slack Integration
- ✅ Error Handling
- ✅ Input Validation

Future coverage needs:
- ⏳ Database operations
- ⏳ WebSocket connections
- ⏳ File upload/download
- ⏳ Performance benchmarks
