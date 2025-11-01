# ============================================================================
# MCP Endpoint Testing Guide - Complete Test Suite
# ============================================================================

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "          MCP ENDPOINT TESTING SUITE                            " -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# ============================================================================
# TEST 1: Health Check (GET Request)
# ============================================================================

Write-Host "TEST 1: Health Check" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:9002/api/mcp/generate-code" -Method GET
    Write-Host "[OK] Endpoint is accessible" -ForegroundColor Green
    Write-Host "   API Name: $($response.name)" -ForegroundColor White
    Write-Host "   Version: $($response.version)" -ForegroundColor White
} catch {
    Write-Host "[ERROR] Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure the dev server is running: pnpm run dev`n" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ============================================================================
# TEST 2: Validation Test (Should Return 400)
# ============================================================================

Write-Host "TEST 2: Request Validation" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$invalidRequest = @{
    owner = "test"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:9002/api/mcp/generate-code" `
        -Method POST `
        -ContentType "application/json" `
        -Body $invalidRequest `
        -ErrorAction Stop
    Write-Host "[ERROR] Validation should have failed" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "[OK] Validation working correctly (400 Bad Request)" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Unexpected status code: $statusCode" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================================================
# TEST 3: Setup Instructions for Full Test
# ============================================================================

Write-Host "TEST 3: Full MCP Request (Requires Setup)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "PREREQUISITES CHECKLIST:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create a test GitHub issue:" -ForegroundColor White
Write-Host "   → Go to: https://github.com/Rajarshi44/hackspire_2025/issues/new" -ForegroundColor Gray
Write-Host "   → Title: 'Test MCP Code Generation'" -ForegroundColor Gray
Write-Host "   → Body: 'Test issue for MCP. Fix bug in src/app/page.tsx'" -ForegroundColor Gray
Write-Host "   → Assign yourself to the issue" -ForegroundColor Gray
Write-Host "   → Note the issue number (e.g., #45)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configure GitHub Token:" -ForegroundColor White
Write-Host "   → Generate at: https://github.com/settings/tokens/new" -ForegroundColor Gray
Write-Host "   → Select scope: 'repo' (Full control)" -ForegroundColor Gray
Write-Host "   → Copy the token (ghp_...)" -ForegroundColor Gray
Write-Host "   → Add to .env.local: GITHUB_TOKEN=ghp_your_token" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Restart dev server:" -ForegroundColor White
Write-Host "   → Stop server (Ctrl+C)" -ForegroundColor Gray
Write-Host "   → Run: pnpm run dev" -ForegroundColor Gray
Write-Host ""

$continueTest = Read-Host "Have you completed the prerequisites? (y/n)"

if ($continueTest -ne "y") {
    Write-Host "`n[PAUSED] Test paused. Complete the prerequisites and run this script again.`n" -ForegroundColor Yellow
    exit 0
}

# Get test parameters from user
Write-Host ""
$issueNumber = Read-Host "Enter the issue number (e.g., 45)"
$githubUsername = Read-Host "Enter your GitHub username (e.g., Rajarshi44)"

Write-Host ""
Write-Host "Preparing test request..." -ForegroundColor Cyan

$testRequest = @{
    owner = "Rajarshi44"
    repo = "hackspire_2025"
    issue_number = [int]$issueNumber
    jobId = "test-job-$(Get-Date -Format 'yyyyMMddHHmmss')"
    requested_by = $githubUsername
    related_files = @("src/app/page.tsx")
} | ConvertTo-Json

Write-Host ""
Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $testRequest -ForegroundColor Gray
Write-Host ""
Write-Host "[WORKING] Sending request (this may take 1-3 minutes)..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:9002/api/mcp/generate-code" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testRequest `
        -TimeoutSec 300
    
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "                     SUCCESS!                               " -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    
    if ($response.success) {
        Write-Host "Pull Request Created:" -ForegroundColor Cyan
        Write-Host "   URL: $($response.pr_url)" -ForegroundColor White
        Write-Host "   PR Number: #$($response.pr_number)" -ForegroundColor White
        Write-Host "   Branch: $($response.branch)" -ForegroundColor White
        Write-Host "   Job ID: $($response.jobId)" -ForegroundColor White
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Yellow
        Write-Host "   1. Visit PR: $($response.pr_url)"
        Write-Host "   2. Review the AI-generated code"
        Write-Host "   3. Check issue #$issueNumber for comment"
        Write-Host "   4. Verify Firestore job status"
        Write-Host ""
        
        # Open PR in browser
        $openBrowser = Read-Host "Open PR in browser? (y/n)"
        if ($openBrowser -eq "y") {
            Start-Process $response.pr_url
        }
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "                      FAILED                                " -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    
    try {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error: $($errorResponse.error)" -ForegroundColor Red
        Write-Host "Details: $($errorResponse.details)" -ForegroundColor Yellow
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Cyan
    Write-Host ""
    
    switch ($statusCode) {
        403 {
            Write-Host "[ERROR] User not assigned to issue" -ForegroundColor Yellow
            Write-Host "   → Go to: https://github.com/Rajarshi44/hackspire_2025/issues/$issueNumber"
            Write-Host "   → Click 'Assignees' on the right"
            Write-Host "   → Select '$githubUsername'"
        }
        500 {
            Write-Host "[ERROR] Server error" -ForegroundColor Yellow
            Write-Host "   → Check if GITHUB_TOKEN is set in .env.local"
            Write-Host "   → Verify token has 'repo' scope"
            Write-Host "   → Check server logs in terminal"
            Write-Host "   → Restart server: pnpm run dev"
        }
        422 {
            Write-Host "[ERROR] TypeScript validation failed" -ForegroundColor Yellow
            Write-Host "   → Generated code has syntax errors"
            Write-Host "   → Check details above for specific errors"
            Write-Host "   → This is expected for complex issues"
        }
        429 {
            Write-Host "[ERROR] Rate limit exceeded" -ForegroundColor Yellow
            Write-Host "   → GitHub API limit reached"
            Write-Host "   → Wait for reset or use different token"
            Write-Host "   → Check limit: see MCP_TESTING_GUIDE.md"
        }
        default {
            Write-Host "[ERROR] Unexpected error (code: $statusCode)" -ForegroundColor Yellow
            Write-Host "   → Check server logs"
            Write-Host "   → Verify all prerequisites"
        }
    }
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "                    Testing Complete" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan
