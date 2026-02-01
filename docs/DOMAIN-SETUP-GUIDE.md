# Domain Setup Guide
## fly.alistairmcleay.com → Vercel + Fly.io

---

## Your Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                   │
│                           │                                     │
│                           ▼                                     │
│              fly.alistairmcleay.com                             │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     VERCEL                               │   │
│  │              (Frontend - Vite/Three.js)                  │   │
│  │                                                          │   │
│  │   Serves: HTML, JS, CSS, 3D models                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           │ WebSocket (wss://)                  │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      FLY.IO                              │   │
│  │           (WebSocket Server - Multiplayer)               │   │
│  │                                                          │   │
│  │   URL: wss://flysf-server.fly.dev                        │   │
│  │   Region: sjc (San Jose)                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Update Config (2 min)

Update your `src/config.js` share URL:

```javascript
// src/config.js - Line 160
share: {
  gameUrl: 'https://fly.alistairmcleay.com',  // ← CHANGE THIS
  twitterHashtags: ['flysf', 'flightsim', 'sanfrancisco'],
  twitterVia: 'alistairmcleay',  // ← Add your Twitter handle (optional)
  brandingText: 'FLY.ALISTAIRMCLEAY.COM'  // ← Update branding
}
```

---

## Step 2: Deploy to Vercel (5 min)

### Option A: If NOT already on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use GitHub)

2. Click **"Add New Project"**

3. Import your GitHub repo (or upload the folder)

4. Vercel auto-detects Vite. Confirm settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **Add Environment Variable** before deploying:
   - Click "Environment Variables"
   - Add:
     ```
     Name: VITE_WS_URL
     Value: wss://flysf-server.fly.dev
     ```

6. Click **Deploy**

### Option B: If already on Vercel

1. Go to your project dashboard

2. Go to **Settings → Environment Variables**

3. Add:
   ```
   Name: VITE_WS_URL
   Value: wss://flysf-server.fly.dev
   ```

4. **Redeploy** (Settings → Deployments → Redeploy)

---

## Step 3: Add Custom Domain in Vercel (2 min)

1. In Vercel dashboard, go to your project

2. Click **Settings → Domains**

3. Enter: `fly.alistairmcleay.com`

4. Click **Add**

5. Vercel will show you DNS records to add. You'll see something like:
   ```
   Type: CNAME
   Name: fly
   Value: cname.vercel-dns.com
   ```

   **Copy these values** - you'll need them for Step 4.

---

## Step 4: Configure DNS at Namecheap (5 min)

1. Log in to [namecheap.com](https://namecheap.com)

2. Go to **Domain List → alistairmcleay.com → Manage**

3. Click **Advanced DNS** tab

4. Click **Add New Record**:
   ```
   Type: CNAME
   Host: fly
   Value: cname.vercel-dns.com
   TTL: Automatic
   ```

5. Click the **checkmark** to save

---

## Step 5: Verify Setup (5-30 min)

### DNS Propagation
DNS can take 5-30 minutes to propagate. Check status:

1. In Vercel → Settings → Domains
   - Should show green checkmark ✓
   - SSL certificate auto-generated

2. Test in browser:
   - Go to `https://fly.alistairmcleay.com`
   - Should load your game with valid HTTPS

### Troubleshooting

**"DNS not configured" in Vercel:**
- Wait 10-15 minutes for DNS propagation
- Double-check CNAME record in Namecheap
- Make sure there's no conflicting A record for "fly"

**"SSL certificate pending":**
- Usually resolves automatically within 10 minutes
- Vercel handles Let's Encrypt certificates

**WebSocket not connecting:**
- Check browser console for errors
- Verify VITE_WS_URL is set in Vercel env vars
- Make sure Fly.io server is running: `fly status -a flysf-server`

---

## Step 6: Test Everything

### Checklist

- [ ] `https://fly.alistairmcleay.com` loads
- [ ] No SSL/HTTPS warnings
- [ ] Game renders (3D tiles load)
- [ ] Multiplayer works (see other planes)
- [ ] Share screenshots generate correctly
- [ ] Twitter share opens with correct URL

### Quick WebSocket Test

Open browser console and check for:
```
[Network] Connected to server
[Network] Authenticated as: YourName
```

If you see connection errors, check:
1. Fly.io server is running
2. VITE_WS_URL env var is correct in Vercel

---

## Quick Reference

| Service | URL | Dashboard |
|---------|-----|-----------|
| Frontend | https://fly.alistairmcleay.com | vercel.com/dashboard |
| WebSocket | wss://flysf-server.fly.dev | fly.io/dashboard |
| Domain | alistairmcleay.com | namecheap.com |

| Environment Variable | Value |
|---------------------|-------|
| VITE_WS_URL | wss://flysf-server.fly.dev |

---

## Commands Reference

### Vercel CLI (if using)
```bash
# Install
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod

# Add env var
vercel env add VITE_WS_URL
```

### Fly.io (for WebSocket server)
```bash
# Check server status
fly status -a flysf-server

# View logs
fly logs -a flysf-server

# SSH into server
fly ssh console -a flysf-server
```

---

## Timeline

| Step | Time |
|------|------|
| Update config.js | 2 min |
| Deploy to Vercel | 5 min |
| Add custom domain | 2 min |
| Configure Namecheap DNS | 5 min |
| Wait for propagation | 5-30 min |
| Test everything | 5 min |
| **Total** | **~30-45 min** |

---

## After Setup

Once `fly.alistairmcleay.com` is working:

1. Update your **launch tweets** to use this URL
2. Test on mobile (different network)
3. Test in incognito (no cache)
4. Ready for Sunday build-in-public posts! 🚀
