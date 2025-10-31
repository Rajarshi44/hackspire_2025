# Rate Limit Monitoring for Production

## 🔍 Monitoring GitHub API Rate Limits

### Quick Check Script

Create `check-rate-limit.ps1`:

```powershell
# Load GitHub token from environment
$token = $env:GITHUB_TOKEN

if (-not $token) {
    Write-Host "❌ GITHUB_TOKEN not found in environment" -ForegroundColor Red
    Write-Host "Set it with: `$env:GITHUB_TOKEN = 'your_token'" -ForegroundColor Yellow
    exit 1
}

# Check rate limit
$response = Invoke-RestMethod -Uri "https://api.github.com/rate_limit" `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Accept" = "application/vnd.github+json"
    }

Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          GitHub API Rate Limit Status                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Core API (most endpoints)
Write-Host "📊 Core API:" -ForegroundColor Yellow
Write-Host "   Limit:     $($response.resources.core.limit)" -ForegroundColor White
Write-Host "   Used:      $($response.resources.core.limit - $response.resources.core.remaining)" -ForegroundColor White
Write-Host "   Remaining: $($response.resources.core.remaining)" -ForegroundColor $(if ($response.resources.core.remaining -lt 100) { "Red" } elseif ($response.resources.core.remaining -lt 500) { "Yellow" } else { "Green" })
$resetTime = [DateTimeOffset]::FromUnixTimeSeconds($response.resources.core.reset).LocalDateTime
Write-Host "   Resets at: $resetTime" -ForegroundColor Gray

# Search API
Write-Host "`n🔍 Search API:" -ForegroundColor Yellow
Write-Host "   Limit:     $($response.resources.search.limit)" -ForegroundColor White
Write-Host "   Remaining: $($response.resources.search.remaining)" -ForegroundColor White

# Git Data API
Write-Host "`n🌿 Git Data API:" -ForegroundColor Yellow
Write-Host "   Limit:     $($response.resources.graphql.limit)" -ForegroundColor White
Write-Host "   Remaining: $($response.resources.graphql.remaining)" -ForegroundColor White

# Usage percentage
$usagePercent = [Math]::Round((($response.resources.core.limit - $response.resources.core.remaining) / $response.resources.core.limit) * 100, 2)
Write-Host "`n📈 Usage: $usagePercent%" -ForegroundColor Cyan

if ($response.resources.core.remaining -lt 100) {
    Write-Host "`n⚠️ WARNING: Rate limit critically low!" -ForegroundColor Red
    Write-Host "   Consider pausing MCP operations until reset." -ForegroundColor Yellow
} elseif ($response.resources.core.remaining -lt 500) {
    Write-Host "`n⚠️ CAUTION: Rate limit getting low." -ForegroundColor Yellow
}

Write-Host ""
```

### Automated Monitoring (Production)

Add to your monitoring service (e.g., Vercel cron, Cloud Functions):

```typescript
// src/lib/monitoring/rate-limit-monitor.ts

interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  usagePercent: number;
}

export async function checkRateLimit(): Promise<RateLimitStatus> {
  const response = await fetch('https://api.github.com/rate_limit', {
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  const data = await response.json();
  const core = data.resources.core;

  return {
    limit: core.limit,
    remaining: core.remaining,
    reset: core.reset,
    used: core.limit - core.remaining,
    usagePercent: ((core.limit - core.remaining) / core.limit) * 100,
  };
}

export async function logRateLimitToFirestore() {
  const status = await checkRateLimit();
  const { firestore } = initializeFirebase();
  
  await setDoc(doc(firestore, 'monitoring', 'rate_limits', 'github', `log-${Date.now()}`), {
    ...status,
    timestamp: Date.now(),
    resetTime: new Date(status.reset * 1000).toISOString(),
  });

  // Alert if low
  if (status.remaining < 100) {
    console.error('🚨 GitHub API rate limit critically low:', status);
    // Send alert (email, Slack, etc.)
  }

  return status;
}
```

### Production Rate Limit Strategy

#### 1. **Pre-Request Check**

Add to `src/lib/mcp/github-client.ts`:

```typescript
let cachedRateLimit: { remaining: number; reset: number; lastCheck: number } | null = null;

export async function checkRateLimitBeforeRequest(): Promise<boolean> {
  // Cache for 1 minute
  if (cachedRateLimit && Date.now() - cachedRateLimit.lastCheck < 60000) {
    return cachedRateLimit.remaining > 10; // Safety threshold
  }

  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    const data = await response.json();
    cachedRateLimit = {
      remaining: data.resources.core.remaining,
      reset: data.resources.core.reset,
      lastCheck: Date.now(),
    };

    if (cachedRateLimit.remaining < 10) {
      console.warn('⚠️ Rate limit low:', cachedRateLimit);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to check rate limit:', error);
    return true; // Allow request on check failure
  }
}
```

Update `executeCodeGeneration` in `agent-service.ts`:

```typescript
export async function executeCodeGeneration(request: MCPGenerateCodeRequest) {
  // Check rate limit before starting
  const hasCapacity = await checkRateLimitBeforeRequest();
  if (!hasCapacity) {
    throw new RateLimitError(cachedRateLimit?.reset || Date.now() / 1000);
  }

  // ... rest of implementation
}
```

#### 2. **Firestore Logging Dashboard**

Query rate limit logs:

```typescript
// Get recent rate limit history
const rateLimitLogs = await getDocs(
  query(
    collection(firestore, 'monitoring/rate_limits/github'),
    orderBy('timestamp', 'desc'),
    limit(100)
  )
);

const logs = rateLimitLogs.docs.map(doc => doc.data());
```

#### 3. **Alert Thresholds**

Set up alerts in your monitoring:

```typescript
const THRESHOLDS = {
  CRITICAL: 50,   // < 50 requests remaining
  WARNING: 500,   // < 500 requests remaining
  INFO: 1000,     // < 1000 requests remaining
};

if (status.remaining < THRESHOLDS.CRITICAL) {
  // Send urgent alert
  sendSlackAlert('🚨 CRITICAL: GitHub rate limit at ' + status.remaining);
} else if (status.remaining < THRESHOLDS.WARNING) {
  // Send warning
  sendSlackAlert('⚠️ WARNING: GitHub rate limit at ' + status.remaining);
}
```

#### 4. **Cron Job Monitoring**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/monitoring/rate-limit",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Create endpoint `src/app/api/monitoring/rate-limit/route.ts`:

```typescript
export async function GET() {
  const status = await logRateLimitToFirestore();
  
  return NextResponse.json({
    status: 'ok',
    rateLimit: status,
  });
}
```

### Optimization Tips

1. **Batch Operations**: Use Git Tree API (already implemented) to reduce API calls
2. **Cache Aggressively**: Cache repository data, file contents when possible
3. **Use Conditional Requests**: Send `If-None-Match` headers with ETags
4. **GitHub Apps**: Consider GitHub Apps for higher limits (5000 → 15000/hour)

### Emergency Response Plan

If rate limit is exhausted:

1. **Immediate**: Return 429 errors to clients
2. **Short-term**: Queue requests in Firestore, process after reset
3. **Long-term**: 
   - Implement request queuing system
   - Use multiple GitHub tokens (round-robin)
   - Migrate to GitHub App for higher limits

### Monitoring Dashboard

View in Firebase Console:
- Collection: `monitoring/rate_limits/github`
- Set up alerts based on `remaining` field
- Graph usage over time
- Export to external monitoring (DataDog, New Relic, etc.)
