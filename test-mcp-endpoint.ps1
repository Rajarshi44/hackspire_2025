# MCP Endpoint Test Script
# This script tests the /api/mcp/generate-code endpoint

Write-Host "`n=== MCP Endpoint Test ===" -ForegroundColor Cyan
Write-Host "Testing POST /api/mcp/generate-code`n" -ForegroundColor Yellow

# Test 1: Check if endpoint exists (GET request for documentation)
Write-Host "Test 1: Checking endpoint availability..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:9002/api/mcp/generate-code" -Method GET
    Write-Host "✅ Endpoint is accessible" -ForegroundColor Green
    Write-Host "API Name: $($response.name)" -ForegroundColor White
    Write-Host "Version: $($response.version)" -ForegroundColor White
    Write-Host "Description: $($response.description)`n" -ForegroundColor White
} catch {
    Write-Host "❌ Failed to access endpoint: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Test with invalid request (missing fields)
Write-Host "Test 2: Testing validation (invalid request)..." -ForegroundColor Green
$invalidBody = @{
    owner = "test"
    # Missing required fields
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:9002/api/mcp/generate-code" `
        -Method POST `
        -ContentType "application/json" `
        -Body $invalidBody `
        -ErrorAction Stop
    Write-Host "❌ Should have failed validation" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "✅ Validation working correctly (400 Bad Request)`n" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Unexpected status code: $statusCode`n" -ForegroundColor Yellow
    }
}

# Test 3: Test with valid request structure (will fail if GitHub token not set or issue doesn't exist)
Write-Host "Test 3: Testing with valid request structure..." -ForegroundColor Green
Write-Host "Note: This will fail if:" -ForegroundColor Yellow
Write-Host "  - GITHUB_TOKEN is not set in .env.local" -ForegroundColor Yellow
Write-Host "  - Issue #1 doesn't exist in your repository" -ForegroundColor Yellow
Write-Host "  - User is not assigned to the issue`n" -ForegroundColor Yellow

$validBody = @{
    owner = "Rajarshi44"
    repo = "hackspire_2025"
    issue_number = 1
    jobId = "test-job-$(Get-Date -Format 'yyyyMMddHHmmss')"
    requested_by = "Rajarshi44"
    related_files = @("src/app/page.tsx")
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Cyan
Write-Host $validBody -ForegroundColor White
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:9002/api/mcp/generate-code" `
        -Method POST `
        -ContentType "application/json" `
        -Body $validBody `
        -ErrorAction Stop
    
    Write-Host "✅ Request succeeded!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor White
    
    if ($response.success) {
        Write-Host "`n🎉 MCP Code Generation Completed Successfully!" -ForegroundColor Green
        Write-Host "PR URL: $($response.pr_url)" -ForegroundColor Cyan
        Write-Host "PR Number: $($response.pr_number)" -ForegroundColor Cyan
        Write-Host "Branch: $($response.branch)" -ForegroundColor Cyan
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($errorBody.error)" -ForegroundColor Red
    Write-Host "Details: $($errorBody.details)" -ForegroundColor Yellow
    
    # Provide helpful messages based on error type
    switch ($statusCode) {
        403 {
            Write-Host "`n💡 Tip: Make sure the user '$($errorBody.jobId)' is assigned to issue #1" -ForegroundColor Cyan
        }
        422 {
            Write-Host "`n💡 Tip: Generated code failed TypeScript validation. Check the details above." -ForegroundColor Cyan
        }
        429 {
            Write-Host "`n💡 Tip: GitHub API rate limit exceeded. Wait for reset time." -ForegroundColor Cyan
        }
        500 {
            Write-Host "`n💡 Tip: Check if GITHUB_TOKEN is set in .env.local" -ForegroundColor Cyan
        }
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
