# API Integration Test Suite
# Tests all major API endpoints in the application

Write-Host "`n=== API Integration Test Suite ===" -ForegroundColor Cyan
Write-Host "Testing all major API endpoints`n" -ForegroundColor Yellow

$baseUrl = "http://localhost:9002"
$testResults = @{
    passed = 0
    failed = 0
    skipped = 0
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Green
    
    try {
        $params = @{
            Uri = "$baseUrl$Url"
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ PASSED - Status: $($response.StatusCode)" -ForegroundColor Green
            $script:testResults.passed++
            return $true
        } else {
            Write-Host "  ❌ FAILED - Expected: $ExpectedStatus, Got: $($response.StatusCode)" -ForegroundColor Red
            $script:testResults.failed++
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ PASSED - Status: $statusCode (Expected Error)" -ForegroundColor Green
            $script:testResults.passed++
            return $true
        } else {
            Write-Host "  ❌ FAILED - Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:testResults.failed++
            return $false
        }
    }
}

# Wait for server to be ready
Write-Host "Checking if server is running on port 9002..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "$baseUrl" -Method HEAD -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Server is running`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running. Please start with 'npm run dev'" -ForegroundColor Red
    exit 1
}

Write-Host "`n--- MCP API Tests ---" -ForegroundColor Cyan

# Test 1: MCP GET endpoint (documentation)
Test-Endpoint -Name "MCP GET /api/mcp/generate-code" `
    -Url "/api/mcp/generate-code" `
    -Method "GET" `
    -ExpectedStatus 200

# Test 2: MCP POST with invalid data
Test-Endpoint -Name "MCP POST with invalid data" `
    -Url "/api/mcp/generate-code" `
    -Method "POST" `
    -Body @{ invalid = "data" } `
    -ExpectedStatus 400

Write-Host "`n--- Slack API Tests ---" -ForegroundColor Cyan

# Test 3: Slack Events endpoint (without signature)
Test-Endpoint -Name "Slack Events POST (no signature)" `
    -Url "/api/slack/events" `
    -Method "POST" `
    -Body @{ type = "url_verification" } `
    -ExpectedStatus 401

# Test 4: Slack Commands endpoint (without signature)
Test-Endpoint -Name "Slack Commands POST (no signature)" `
    -Url "/api/slack/commands" `
    -Method "POST" `
    -Body @{ command = "/test" } `
    -ExpectedStatus 401

# Test 5: Slack Interactions endpoint (without signature)
Test-Endpoint -Name "Slack Interactions POST (no signature)" `
    -Url "/api/slack/interactions" `
    -Method "POST" `
    -Body @{ type = "block_actions" } `
    -ExpectedStatus 401

Write-Host "`n--- GitHub OAuth Tests ---" -ForegroundColor Cyan

# Test 6: GitHub OAuth callback (without code)
Test-Endpoint -Name "GitHub OAuth callback (no code)" `
    -Url "/api/auth/github/callback" `
    -Method "GET" `
    -ExpectedStatus 400

Write-Host "`n--- Health Check Tests ---" -ForegroundColor Cyan

# Test 7: Main page loads
Test-Endpoint -Name "Main page GET /" `
    -Url "/" `
    -Method "GET" `
    -ExpectedStatus 200

Write-Host "`n--- API Error Handling Tests ---" -ForegroundColor Cyan

# Test 8: Non-existent endpoint
Test-Endpoint -Name "Non-existent endpoint" `
    -Url "/api/nonexistent" `
    -Method "GET" `
    -ExpectedStatus 404

# Test 9: Method not allowed
Write-Host "Testing: Method not allowed" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/mcp/generate-code" -Method DELETE -ErrorAction Stop
    Write-Host "  ❌ FAILED - Should have returned 405" -ForegroundColor Red
    $script:testResults.failed++
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 405 -or $statusCode -eq 404) {
        Write-Host "  ✅ PASSED - Status: $statusCode (Method not allowed)" -ForegroundColor Green
        $script:testResults.passed++
    } else {
        Write-Host "  ❌ FAILED - Expected: 405, Got: $statusCode" -ForegroundColor Red
        $script:testResults.failed++
    }
}

# Test Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Total Tests: $($testResults.passed + $testResults.failed + $testResults.skipped)" -ForegroundColor White
Write-Host "Passed: $($testResults.passed)" -ForegroundColor Green
Write-Host "Failed: $($testResults.failed)" -ForegroundColor Red
Write-Host "Skipped: $($testResults.skipped)" -ForegroundColor Yellow

if ($testResults.failed -eq 0) {
    Write-Host "`n🎉 All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️ Some tests failed. Please review the output above." -ForegroundColor Yellow
    exit 1
}
