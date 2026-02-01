# Viral Traffic Capacity & Cost Analysis

## Executive Summary

This analysis examines what happens if SF Flight Sim goes viral. The **critical finding**: Google 3D Tiles API is your dominant cost driver, but their session-based pricing is surprisingly favorable. A viral launch with 50,000 users in a day could cost **$300-600 in Google API fees** plus **$50-100 in infrastructure**.

**Key Risk**: The Google API has a **10,000 sessions/day hard limit** by default. Without quota increases, you'd be blocked at ~10K daily users.

---

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   User Browser  │────────>│    Vercel       │         │    Fly.io       │
│                 │  Static │  (Frontend)     │         │  (WebSocket)    │
│  - Three.js     │  Assets │                 │         │                 │
│  - Game Logic   │<────────│  - HTML/JS/CSS  │         │  - GameServer   │
│  - 3D Rendering │         │  - ~2MB bundle  │         │  - Player sync  │
└────────┬────────┘         └─────────────────┘         └────────┬────────┘
         │                                                        │
         │ Direct API calls                          WebSocket    │
         │ (per-session billing)                     connection   │
         ▼                                                        │
┌─────────────────┐                                              │
│  Google Maps    │◄─────────────────────────────────────────────┘
│  3D Tiles API   │
│                 │
│  - Root tileset │
│  - Tile chunks  │
└─────────────────┘
```

---

## Service-by-Service Cost Analysis

### 1. Google Maps 3D Tiles API (Dominant Cost)

**Pricing Structure:**
| Volume (sessions/month) | Cost per 1,000 |
|------------------------|----------------|
| 0-1,000 | FREE |
| 1,001 - 100,000 | $6.00 |
| 100,001 - 500,000 | $5.10 |
| 500,001 - 1,000,000 | $4.20 |
| 1,000,001 - 5,000,000 | $3.30 |
| 5,000,000+ | $2.40 |

**Critical Understanding - Session-Based Billing:**
- A "session" = one root tileset request that grants 3 hours of unlimited tile downloads
- Each user starting the game = 1 session
- If user plays for 4 hours = 2 sessions (auto-refreshes at 3hr mark)
- **Individual tile downloads are FREE within a session**

**Default Quota Limits:**
- **10,000 root tileset requests/day** (hard cap without increase)
- Must request quota increase from Google for higher limits

**Cost Projections:**

| Daily Users | Sessions/Day | Sessions/Month | Monthly Cost |
|-------------|--------------|----------------|--------------|
| 100 | 100 | 3,000 | $12 |
| 1,000 | 1,000 | 30,000 | $174 |
| 5,000 | 5,000 | 150,000 | $856 |
| 10,000 | 10,000 | 300,000 | $1,620 |
| 50,000 | 50,000 | 1,500,000 | $6,270 |
| 100,000 | 100,000 | 3,000,000 | $11,940 |

*Note: Assumes 1 session per user per day (most users play < 3 hours)*

---

### 2. Fly.io WebSocket Server

**Current Configuration:**
```toml
# server/fly.toml
memory = '1gb'
cpu_kind = 'shared'
cpus = 1
primary_region = 'sjc'
min_machines_running = 1
```

**Base Pricing (SJC region):**
| Config | Monthly Cost |
|--------|--------------|
| shared-cpu-1x, 256MB | $2.02 |
| shared-cpu-1x, 512MB | $3.32 |
| **shared-cpu-1x, 1GB** | **$5.92** (current) |
| shared-cpu-2x, 2GB | $11.83 |
| shared-cpu-4x, 4GB | $23.66 |
| performance-1x, 2GB | ~$30 |

**Bandwidth Pricing:**
- Inbound: FREE
- Outbound (North America): $0.02/GB
- Outbound (APAC): $0.04/GB

**Server Capacity Analysis:**

The WebSocket server broadcasts player positions at 10Hz (100ms intervals). Each broadcast message contains ALL player data:

```javascript
// Message size per broadcast
{
  type: 'players',
  players: { /* ~200 bytes per player */ },
  scores: { /* ~50 bytes per player */ },
  count: N
}
```

| Concurrent Players | Message Size | Bandwidth per Client | Server Broadcasts |
|-------------------|--------------|---------------------|-------------------|
| 10 | ~2.5 KB | 25 KB/sec | 100 KB/sec total |
| 50 | ~12.5 KB | 125 KB/sec | 6.25 MB/sec total |
| 100 | ~25 KB | 250 KB/sec | 25 MB/sec total |
| 500 | ~125 KB | 1.25 MB/sec | 625 MB/sec total |

**Server Scaling Thresholds:**

| Concurrent Users | Required Config | Monthly Cost |
|-----------------|-----------------|--------------|
| 1-50 | shared-cpu-1x, 1GB | $5.92 |
| 50-150 | shared-cpu-2x, 2GB | $11.83 |
| 150-300 | shared-cpu-4x, 4GB | $23.66 |
| 300-500 | performance-1x, 4GB | ~$50 |
| 500+ | Multiple machines needed | $100+ |

**Bandwidth Cost at Scale:**

| Daily Users | Avg Session (min) | Data per User | Monthly Bandwidth | Cost |
|-------------|-------------------|---------------|-------------------|------|
| 1,000 | 15 | ~50 MB | 1.5 TB | $30 |
| 10,000 | 15 | ~50 MB | 15 TB | $300 |
| 50,000 | 15 | ~50 MB | 75 TB | $1,500 |

---

### 3. Vercel Frontend Hosting

**Plan Comparison:**

| Plan | Monthly Fee | Bandwidth | Overage |
|------|-------------|-----------|---------|
| Hobby (Free) | $0 | 100 GB | N/A (blocked) |
| Pro | $20 | 1 TB | $0.15/GB |
| Enterprise | Custom | Custom | Negotiated |

**Important:** Hobby plan cannot be used for commercial/revenue-generating projects per Vercel ToS.

**Static Asset Size:**
- Main bundle: ~2 MB (compressed)
- Three.js + dependencies: ~500 KB
- Total per page load: ~2.5 MB

**Bandwidth Projections:**

| Daily Users | Data per Load | Monthly Bandwidth | Pro Overage Cost |
|-------------|---------------|-------------------|------------------|
| 1,000 | 2.5 MB | 75 GB | $0 (within 1TB) |
| 10,000 | 2.5 MB | 750 GB | $0 (within 1TB) |
| 50,000 | 2.5 MB | 3.75 TB | $412 |
| 100,000 | 2.5 MB | 7.5 TB | $975 |

---

## Viral Scenario Analysis

### Scenario 1: Moderate Success (Hacker News Front Page)

**Profile:**
- Day 1: 5,000 users
- Week 1: 15,000 total users
- Month 1: 30,000 total users
- Peak concurrent: 200 users

**Monthly Costs:**
| Service | Cost |
|---------|------|
| Google 3D Tiles | $174 |
| Fly.io (compute) | $12 |
| Fly.io (bandwidth) | $30 |
| Vercel Pro | $20 |
| **Total** | **$236/month** |

---

### Scenario 2: Strong Viral (Levelsio Retweet)

**Profile:**
- Day 1: 20,000 users
- Week 1: 50,000 total users
- Month 1: 100,000 total users
- Peak concurrent: 500 users

**Monthly Costs:**
| Service | Cost |
|---------|------|
| Google 3D Tiles | $594 |
| Fly.io (compute) | $50 |
| Fly.io (bandwidth) | $100 |
| Vercel Pro | $20 |
| **Total** | **$764/month** |

**Risk:** 20,000 users on day 1 would exceed the 10,000/day quota limit!

---

### Scenario 3: Mega Viral (Elon Musk Retweet)

**Profile:**
- Day 1: 100,000+ users
- Week 1: 500,000 total users
- Month 1: 1,000,000+ total users
- Peak concurrent: 5,000+ users

**Monthly Costs:**
| Service | Cost |
|---------|------|
| Google 3D Tiles | $3,780 |
| Fly.io (compute) | $200+ |
| Fly.io (bandwidth) | $1,500 |
| Vercel Pro | $800 |
| **Total** | **$6,280/month** |

**Critical Issues:**
1. Would hit 10K/day quota immediately
2. WebSocket server would need horizontal scaling
3. Would need to request emergency quota increase from Google

---

## Hard Limits & Bottlenecks

### 1. Google API Quota (CRITICAL)

**Default Limit:** 10,000 root tileset requests/day

**Impact:** At 10,001 users in a day, new users get errors loading tiles.

**Solution:**
1. Request quota increase in Google Cloud Console BEFORE launch
2. Apply for higher limits citing expected traffic
3. Consider setting up billing alerts at 50%, 80%, 100% of quota

**How to Request:**
1. Go to Google Cloud Console > APIs & Services > Quotas
2. Find "Map Tiles API" quotas
3. Request increase for "Root tileset requests per day"
4. Justify with expected traffic numbers

---

### 2. WebSocket Server Capacity

**Current Limit:** ~200-300 concurrent connections on 1GB shared CPU

**Bottleneck:** JavaScript event loop becomes blocking when broadcasting to 500+ clients at 10Hz

**Scaling Options:**
1. **Vertical scaling:** Increase to performance-1x or larger ($30-100/mo)
2. **Horizontal scaling:** Multiple machines with load balancing ($100+/mo)
3. **Protocol optimization:** Switch to binary WebSocket (50% bandwidth reduction)
4. **Interest-based broadcasting:** Only send nearby player updates

---

### 3. Vercel Bandwidth

**Hobby Limit:** 100 GB/month (blocks at limit)
**Pro Limit:** 1 TB included, then $0.15/GB

**Mitigation:**
- Upgrade to Pro before launch ($20/mo)
- Use Cloudflare for additional caching (free tier available)

---

## Cost Optimization Strategies

### Immediate (Pre-Launch)

| Strategy | Savings | Effort |
|----------|---------|--------|
| Request Google quota increase | Avoids outage | 30 min |
| Upgrade to Vercel Pro | Avoids blocking | 5 min |
| Set up billing alerts | Early warning | 15 min |

### Short-Term (If Viral)

| Strategy | Savings | Effort |
|----------|---------|--------|
| Binary WebSocket protocol | 50% Fly.io bandwidth | 4-8 hours |
| Cloudflare CDN for static assets | 50% Vercel bandwidth | 2 hours |
| Interest-based multiplayer (only nearby players) | 70% bandwidth | 8-16 hours |

### Long-Term (Sustained Traffic)

| Strategy | Savings | Effort |
|----------|---------|--------|
| Tile proxy/caching server | 30-50% Google API | 16-40 hours |
| Regional WebSocket servers | Lower latency + distribute load | 8-16 hours |
| Volume discounts negotiation with Google | 15-60% Google API | Weeks |

---

## Emergency Response Playbook

### If You Hit Google Quota Limit

**Symptoms:** New users see black/empty terrain, console shows 429 errors

**Immediate Actions:**
1. Request emergency quota increase (Google Cloud Console)
2. Add queue/waiting room for new users
3. Tweet status update

**Fallback:**
```javascript
// Show graceful error
if (tilesLoadError) {
  showMessage("High traffic! You're #X in queue. Try again in 5 minutes.");
}
```

### If WebSocket Server Overloads

**Symptoms:** Players disconnect, high latency, server unresponsive

**Immediate Actions:**
1. Fly.io: `fly scale vm shared-cpu-4x` (instant upgrade)
2. If still overloaded: `fly scale count 2` (add second machine)
3. Tweet status update

### If Vercel Bandwidth Exceeded

**Symptoms:** Static assets fail to load (on Hobby plan)

**Immediate Actions:**
1. Upgrade to Pro immediately ($20)
2. Or: Deploy backup to Cloudflare Pages (free, 100GB bandwidth)

---

## Pre-Launch Checklist

### Critical (Do Before Launch)

- [ ] Request Google Maps API quota increase to 50,000/day
- [ ] Upgrade to Vercel Pro ($20/month)
- [ ] Set up Google Cloud billing alerts (50%, 80%, 100%)
- [ ] Set up Fly.io usage alerts
- [ ] Have credit card with high limit on file for all services

### Recommended

- [ ] Test with 50+ simultaneous connections
- [ ] Document emergency scaling commands
- [ ] Prepare status page/Twitter for outage communication
- [ ] Have backup deployment ready (Cloudflare Pages)

---

## Cost Summary Table

| Concurrent Users | Daily Users | Google API | Fly.io | Vercel | Total/Month |
|-----------------|-------------|------------|--------|--------|-------------|
| 10 | 100 | $0 | $6 | $0 | **$6** |
| 50 | 1,000 | $12 | $10 | $20 | **$42** |
| 100 | 5,000 | $174 | $30 | $20 | **$224** |
| 200 | 10,000 | $594 | $75 | $20 | **$689** |
| 500 | 50,000 | $2,970 | $200 | $450 | **$3,620** |
| 1,000+ | 100,000+ | $5,940+ | $500+ | $1,000+ | **$7,440+** |

---

## Conclusion

**The Good News:**
- Google's session-based pricing is favorable (not per-tile)
- Infrastructure costs (Fly.io, Vercel) are manageable
- Scaling is straightforward with money

**The Critical Risk:**
- **10,000/day quota limit on Google API** - must request increase before launch
- This is a hard block, not just a cost issue

**Recommended Budget:**
- Soft launch (testing): ~$50/month
- Successful HN launch: ~$250/month
- Viral success: ~$500-2,000/month
- Mega viral: $5,000+/month

**Action Items:**
1. Request Google quota increase NOW
2. Upgrade Vercel to Pro
3. Set up billing alerts
4. Have $500+ available for first month if it goes viral

---

## Sources

- [Google Maps Platform 3D Tiles Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Map Tiles API Usage and Billing](https://developers.google.com/maps/documentation/tile/usage-and-billing)
- [Fly.io Resource Pricing](https://fly.io/docs/about/pricing/)
- [Fly.io Pricing Calculator](https://fly.io/calculator)
- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Pro Plan Details](https://vercel.com/docs/plans/pro-plan)
