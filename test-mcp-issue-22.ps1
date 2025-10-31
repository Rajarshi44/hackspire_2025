# Test MCP Endpoint with Issue #22
# Run this in a SEPARATE PowerShell window (not in VS Code terminal)

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "  MCP Endpoint Test - Issue #22" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

# Check if server is running
Write-Host "[1/3] Checking if dev server is running..." -ForegroundColor Yellow
$serverRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 9002 -WarningAction SilentlyContinue -InformationLevel Quiet

if (-not $serverRunning) {
    Write-Host "      [ERROR] Dev server is not running on port 9002" -ForegroundColor Red
    Write-Host "      Please start it first: npm run dev`n" -ForegroundColor Yellow
    exit 1
}
Write-Host "      [OK] Server is running`n" -ForegroundColor Green

# Test GET endpoint
Write-Host "[2/3] Testing GET endpoint..." -ForegroundColor Yellow
try {
    $getResponse = Invoke-RestMethod -Uri 'http://localhost:9002/api/mcp/generate-code' -Method GET -TimeoutSec 5
    Write-Host "      [OK] GET endpoint working`n" -ForegroundColor Green
} catch {
    Write-Host "      [ERROR] GET failed: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Test POST endpoint with issue #22
Write-Host "[3/3] Testing POST endpoint with issue #22..." -ForegroundColor Yellow
Write-Host "      This will take 30-60 seconds...`n" -ForegroundColor Gray

$body = @{
    owner = 'Rajarshi44'
    repo = 'hackspire_2025'
    issue_number = 22
    jobId = "test-manual-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    requested_by = 'Rajarshi44'
} | ConvertTo-Json

Write-Host "Request body:" -ForegroundColor Gray
Write-Host $body -ForegroundColor DarkGray
Write-Host ""

try {
    $postResponse = Invoke-RestMethod `
        -Uri 'http://localhost:9002/api/mcp/generate-code' `
        -Method POST `
        -ContentType 'application/json' `
        -Body $body `
        -TimeoutSec 120
    
    Write-Host "`n===================================" -ForegroundColor Green
    Write-Host "  SUCCESS!" -ForegroundColor Green
    Write-Host "===================================`n" -ForegroundColor Green
    
    Write-Host "Response:" -ForegroundColor Yellow
    $postResponse | ConvertTo-Json -Depth 4
    
    if ($postResponse.pr_url) {
        Write-Host "`nPull Request created: $($postResponse.pr_url)" -ForegroundColor Cyan
        Write-Host "Branch: $($postResponse.branch)" -ForegroundColor Gray
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "`n===================================" -ForegroundColor Red
    Write-Host "  FAILED (HTTP $statusCode)" -ForegroundColor Red
    Write-Host "===================================`n" -ForegroundColor Red
    
    # Try to get error details
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        
        Write-Host "Error response:" -ForegroundColor Yellow
        $errorBody | ConvertFrom-Json | ConvertTo-Json -Depth 4
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nTest complete." -ForegroundColor Cyan
