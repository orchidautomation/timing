# Self-Hosted GitHub Actions Runner Analysis for Hostinger VPS

## Executive Summary

Migrating to self-hosted GitHub Actions runners on your Hostinger VPS (2 vCPU, 8GB RAM, 100GB NVMe) is **technically feasible but comes with significant trade-offs**. While it eliminates GitHub Actions minute costs, it introduces complexity, security risks, and potential performance limitations.

**Recommendation:** Start with a **hybrid approach** - use self-hosted for simple, trusted workflows and GitHub-hosted for security-critical or resource-intensive tasks.

## VPS Specifications Analysis

### Your Hostinger VPS
- **CPU:** 2 vCPU cores
- **RAM:** 8 GB
- **Storage:** 100 GB NVMe
- **Bandwidth:** 8 TB/month

### Capability Assessment

| Workload Type | Feasibility | Concurrent Jobs | Notes |
|--------------|-------------|-----------------|-------|
| **Simple CI (linting, tests)** | ✅ Excellent | 2-3 | Low resource usage |
| **Node.js builds** | ✅ Good | 1-2 | 2-4GB RAM per job |
| **Docker builds** | ⚠️ Limited | 1 | Heavy on CPU/RAM |
| **OpenCode + AI API calls** | ✅ Good | 1-2 | Network-bound, not CPU |
| **Complex builds** | ❌ Poor | 1 | May hit resource limits |

## Cost Analysis

### Current Costs (GitHub-Hosted)

```
GitHub Actions (Private repos):
- Base: 2,000 free minutes/month
- Overage: $0.008/minute (Linux)
- Your usage: ~10,000 minutes/month
- Monthly cost: $64 [(10,000 - 2,000) × $0.008]

AI API Costs (Grok/Claude):
- Current: $200-300/month
- After migration to Grok: ~$8/month
```

### Self-Hosted Costs

```
Hostinger VPS:
- You already pay for this
- No additional GitHub costs
- Electricity/maintenance: $0

Hidden Costs:
- Setup time: ~8 hours
- Maintenance: ~2 hours/month
- Security monitoring: Ongoing
- Potential downtime: Variable
```

**Monthly Savings: $64** (GitHub Actions only)

## Implementation Guide

### Phase 1: Setup (Day 1)

#### 1. Prepare VPS
```bash
# SSH into your Hostinger VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker (required for many workflows)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install essential tools
apt install -y curl wget git build-essential nodejs npm
```

#### 2. Create Dedicated User
```bash
# Create non-root user for security
useradd -m -s /bin/bash github-runner
usermod -aG docker github-runner

# Set up runner directory
mkdir -p /opt/actions-runner
chown -R github-runner:github-runner /opt/actions-runner
```

#### 3. Install GitHub Runner
```bash
# Switch to runner user
su - github-runner
cd /opt/actions-runner

# Download runner (check GitHub for latest version)
curl -o actions-runner-linux-x64-2.322.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-x64-2.322.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.322.0.tar.gz

# Configure (get token from GitHub Settings > Actions > Runners)
./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO \
  --token YOUR_RUNNER_TOKEN \
  --name hostinger-runner-1 \
  --labels self-hosted,Linux,X64,hostinger
```

#### 4. Install as Service
```bash
# As root
cd /opt/actions-runner
./svc.sh install github-runner
./svc.sh start
```

### Phase 2: OpenCode Configuration

#### Update Workflow for Self-Hosted
```yaml
# .github/workflows/opencode.yml
name: OpenCode Self-Hosted

on:
  issue_comment:
    types: [created]

jobs:
  opencode:
    # Use self-hosted runner with fallback
    runs-on: [self-hosted, linux]
    # Fallback to GitHub-hosted if self-hosted unavailable
    # runs-on: ${{ matrix.runner }}
    # strategy:
    #   matrix:
    #     runner: [self-hosted, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Run OpenCode
        uses: sst/opencode/github@latest
        env:
          XAI_API_KEY: ${{ secrets.XAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          model: x-ai/grok-code-fast-1
```

### Phase 3: Security Hardening

#### 1. Network Security
```bash
# Configure UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow from github.com to any port 443
ufw enable

# Set up fail2ban
apt install fail2ban -y
```

#### 2. Runner Isolation
```bash
# Create runner-specific Docker network
docker network create runner-network --internal

# Limit runner resources
# Edit /etc/systemd/system/github-runner.service
[Service]
CPUQuota=150%  # 1.5 cores max
MemoryMax=6G   # Leave 2GB for system
```

#### 3. Monitoring Setup
```bash
# Install monitoring tools
apt install htop iftop nethogs -y

# Setup basic alerting
cat > /opt/monitor-runner.sh << 'EOF'
#!/bin/bash
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEM=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')

if (( $(echo "$CPU > 90" | bc -l) )); then
  echo "High CPU usage: $CPU%" | mail -s "VPS Alert" your@email.com
fi

if (( $(echo "$MEM > 85" | bc -l) )); then
  echo "High Memory usage: $MEM%" | mail -s "VPS Alert" your@email.com
fi
EOF

# Add to crontab
crontab -e
# */5 * * * * /opt/monitor-runner.sh
```

## Benefits vs Concerns

### ✅ Benefits

1. **Cost Savings**
   - Eliminate $64/month GitHub Actions costs
   - No per-minute billing anxiety
   - Predictable costs (VPS already paid)

2. **Control**
   - Custom environment setup
   - Pre-installed dependencies
   - Persistent cache between runs
   - No 6-hour job timeout

3. **Performance**
   - Lower latency to your services
   - Faster artifact caching
   - No queue wait times

### ⚠️ Major Concerns

1. **Security Risks** (CRITICAL)
   - **Arbitrary code execution** on your VPS
   - Potential for malicious PR attacks
   - API keys exposed if compromised
   - Same server hosts other services?

2. **Resource Limitations**
   - Only 1-2 concurrent jobs max
   - Docker builds will struggle
   - No auto-scaling capability
   - Shared with other VPS services?

3. **Reliability Issues**
   - Single point of failure
   - No automatic failover
   - Manual updates required
   - Network outages affect CI/CD

4. **Maintenance Burden**
   - OS and package updates
   - Runner software updates
   - Security patches
   - Debugging runner issues
   - Log rotation management

## Specific OpenCode + AI Considerations

### Network Requirements
```
AI API Calls (Grok/Claude):
- Bandwidth: ~10-100 MB/day per active runner
- Latency: Not critical (API calls are async)
- Your 8TB/month: More than sufficient ✅

OpenCode Tool Calls:
- Primarily outbound HTTPS
- GitHub API rate limits apply
- Caching helps reduce API calls
```

### Performance Impact
```
Typical OpenCode Job:
- CPU: 10-30% (mostly waiting for API)
- RAM: 1-2GB (Node.js + OpenCode)
- Disk: <1GB temporary files
- Duration: 2-10 minutes

Your VPS can handle: 1-2 concurrent OpenCode jobs
```

## Risk Mitigation Strategies

### 1. Hybrid Approach (RECOMMENDED)
```yaml
# Use self-hosted for trusted workflows only
jobs:
  safe-job:
    if: github.actor == 'trusted-user'
    runs-on: self-hosted
    
  risky-job:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest  # GitHub-hosted
```

### 2. Ephemeral Runners
Consider Hostinger's **Fireactions** (mentioned in their blog):
- MicroVM-based isolation
- Automatic cleanup after each job
- Better security than persistent runners
- Setup: https://fireactions.io

### 3. Resource Management
```bash
# Implement job queuing
cat > /opt/runner-queue.sh << 'EOF'
#!/bin/bash
RUNNING=$(pgrep -f "Runner.Listener" | wc -l)
if [ $RUNNING -gt 2 ]; then
  echo "Too many runners, waiting..."
  exit 1
fi
EOF
```

## Decision Matrix

| Factor | Self-Hosted | GitHub-Hosted | Winner |
|--------|------------|---------------|---------|
| **Cost** | $0 | $64/month | Self-Hosted |
| **Security** | High risk | Isolated | GitHub |
| **Performance** | Variable | Consistent | GitHub |
| **Maintenance** | 2+ hrs/month | Zero | GitHub |
| **Scalability** | Fixed | Unlimited | GitHub |
| **Control** | Full | Limited | Self-Hosted |

## Final Recommendation

### Start with Hybrid Approach

1. **Phase 1 (Immediate):**
   - Keep GitHub-hosted for production workflows
   - Set up self-hosted for development/testing
   - Monitor resource usage for 2 weeks

2. **Phase 2 (Week 3-4):**
   - Migrate non-critical workflows to self-hosted
   - Implement monitoring and alerting
   - Document common issues

3. **Phase 3 (Month 2):**
   - Evaluate performance and stability
   - Consider Fireactions for better isolation
   - Make final decision on full migration

### When to NOT Self-Host

- ❌ Public repositories (security nightmare)
- ❌ Untrusted contributors
- ❌ Resource-intensive builds (ML models, large Docker images)
- ❌ Need for multiple OS (Windows, macOS)
- ❌ Compliance requirements (SOC2, HIPAA)

### When Self-Hosting Makes Sense

- ✅ Private repos with trusted team
- ✅ Simple Node.js/Python workflows
- ✅ Cost is primary concern
- ✅ Need persistent environment
- ✅ Have DevOps expertise

## Alternative: Better VPS Strategy

If committed to self-hosting, consider:

1. **Dedicated Runner VPS**
   - Separate from production services
   - Can be reinstalled if compromised
   - Recommended: 4 vCPU, 16GB RAM

2. **Multiple Smaller VPS**
   - Distribute risk
   - Better concurrency
   - Easier to scale

3. **Container-Based Isolation**
   - Use Fireactions or similar
   - Docker-in-Docker with restrictions
   - Kubernetes with strict policies

## Conclusion

Your Hostinger VPS **can** run self-hosted GitHub Actions runners, but with significant limitations:

- ✅ **Works for:** Simple CI/CD, OpenCode automation, cost savings
- ⚠️ **Struggles with:** Concurrent jobs, Docker builds, security
- ❌ **Fails at:** High-scale operations, public repos, compliance

**Recommended Path:**
1. Start with hybrid approach
2. Use self-hosted for trusted, simple workflows
3. Keep GitHub-hosted for complex/sensitive jobs
4. Evaluate after 1 month of real usage
5. Consider dedicated infrastructure if successful

The $64/month savings might not justify the added complexity and security risks unless you have strong DevOps expertise and proper isolation strategies.

---

*Document Version: 1.0*  
*Last Updated: January 9, 2025*  
*Review After: 1 month of testing*