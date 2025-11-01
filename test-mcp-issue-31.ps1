# Test MCP Endpoint for Issue #31
# Run this in a separate PowerShell window while the Next.js dev server (port 9002) is active.

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  MCP Endpoint Test - Issue #31" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Step 1: Check server availability
Write-Host "[1/3] Checking if dev server is running on http://localhost:9002 ..." -ForegroundColor Yellow
$serverRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 9002 -WarningAction SilentlyContinue -InformationLevel Quiet

if (-not $serverRunning) {
    Write-Host "      [ERROR] Dev server not detected. Start it with: pnpm dev" -ForegroundColor Red
    exit 1
}
Write-Host "      [OK] Server is live.`n" -ForegroundColor Green

# Step 2: Verify GET endpoint
Write-Host "[2/3] Verifying GET /api/mcp/generate-code ..." -ForegroundColor Yellow
try {
    $getResponse = Invoke-RestMethod -Uri 'http://localhost:9002/api/mcp/generate-code' -Method GET -TimeoutSec 5
    Write-Host "      [OK] Endpoint metadata returned:" -ForegroundColor Green
    Write-Host "           $($getResponse.name) v$($getResponse.version)" -ForegroundColor Gray
} catch {
    Write-Host "      [ERROR] GET request failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Trigger POST for issue #31
Write-Host "[3/3] Triggering POST for issue #31 ..." -ForegroundColor Yellow
Write-Host "      Ensure the requester is assigned to this issue on GitHub." -ForegroundColor Gray
Write-Host "      This run can take up to a minute. Please wait...`n" -ForegroundColor Gray

$body = @{
    owner = 'Rajarshi44'
    repo = 'hackspire_2025'
    issue_number = 31
    jobId = "test-issue31-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    requested_by = 'Rajarshi44'
} | ConvertTo-Json

Write-Host "Request payload:" -ForegroundColor Gray
Write-Host $body -ForegroundColor DarkGray
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri 'http://localhost:9002/api/mcp/generate-code' `
        -Method POST `
        -ContentType 'application/json' `
        -Body $body `
        -TimeoutSec 180

    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host "  POST Request Completed" -ForegroundColor Green
    Write-Host "==========================================`n" -ForegroundColor Green

    $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor White

    if ($response.pr_url) {
        Write-Host "`nPull Request created: $($response.pr_url)" -ForegroundColor Cyan
        Write-Host "Branch: $($response.branch)" -ForegroundColor Gray
    } else {
        Write-Host "`nNo PR URL returned. Inspect response above for details." -ForegroundColor Yellow
    }

} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "`n==========================================" -ForegroundColor Red
    Write-Host "  POST Request Failed (HTTP $statusCode)" -ForegroundColor Red
    Write-Host "==========================================`n" -ForegroundColor Red

    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $errorBody = $reader.ReadToEnd()
        $reader.Close()

        if ($errorBody) {
            Write-Host "Error payload:" -ForegroundColor Yellow
            ($errorBody | ConvertFrom-Json | ConvertTo-Json -Depth 5) | Write-Host -ForegroundColor Gray
        }
    } catch {
        Write-Host "Unable to parse error details: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nTest execution finished." -ForegroundColor Cyan
