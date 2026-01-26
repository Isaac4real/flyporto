# Stage 6: Deployment

## Goal

Deploy the flight simulator to a public URL so anyone can play it.

**Estimated time:** 10-15 minutes

---

## Prerequisites

- Stage 5 completed and verified
- All features working on desktop and mobile
- Performance acceptable
- No console errors

---

## Context from Stage 5

You have a polished, playable flight simulator. In this stage, you will:
1. Build for production
2. Configure environment variables for production
3. Deploy to Vercel (recommended) or alternative
4. Verify production deployment
5. Set up custom domain (optional)

---

## Tasks

### Task 6.1: Production Build Verification

Before deploying, verify the production build works locally:

```bash
npm run build
npm run preview
```

Check that:
- Build completes without errors
- Preview runs correctly
- All features work in preview mode
- API key is loaded correctly

### Task 6.2: Prepare for Vercel Deployment

Create `vercel.json` in project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

Ensure `.gitignore` includes:
```
node_modules
dist
.env
.DS_Store
```

### Task 6.3: Set Up Vercel

**Option A: Vercel CLI**

```bash
npm install -g vercel
vercel login
vercel
```

Follow the prompts:
- Link to existing project or create new
- Confirm build settings

**Option B: Vercel Dashboard**

1. Go to vercel.com
2. Connect your GitHub repository
3. Import the project
4. Configure environment variables

### Task 6.4: Configure Environment Variables

In Vercel dashboard or CLI, add:

```
VITE_GOOGLE_MAPS_API_KEY=your_production_api_key
```

**Important:** Consider using a separate API key for production with:
- HTTP referrer restrictions (your Vercel domain only)
- Lower quota limits as a safety measure

### Task 6.5: Deploy

```bash
vercel --prod
```

Or push to main branch if using GitHub integration.

### Task 6.6: Verify Production Deployment

Once deployed, verify:

1. Open the production URL
2. Wait for tiles to load
3. Test keyboard controls
4. Test on mobile device
5. Check attribution is visible
6. Check console for errors (especially API key issues)

### Task 6.7: API Key Security (Important)

In Google Cloud Console:

1. Go to APIs & Services > Credentials
2. Edit your API key
3. Under "Application restrictions":
   - Select "HTTP referrers"
   - Add your Vercel domain: `https://your-project.vercel.app/*`
4. Under "API restrictions":
   - Select "Restrict key"
   - Select only "Map Tiles API"
5. Save

This prevents your API key from being used on other domains.

---

## Alternative Deployment Options

### Cloudflare Pages

```bash
npm install -g wrangler
wrangler pages project create sf-flight-sim
wrangler pages deploy dist
```

### Netlify

1. Push to GitHub
2. Connect repository in Netlify dashboard
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variable in site settings

### GitHub Pages

Note: Requires base path configuration in vite.config.js

```javascript
export default defineConfig({
  base: '/sf-flight-sim/',
  // ... rest of config
});
```

Then deploy using `gh-pages` package or GitHub Actions.

---

## Acceptance Criteria

After this stage, verify:

- [ ] Production build completes without errors
- [ ] Site is accessible at public URL
- [ ] Tiles load correctly
- [ ] All controls work (keyboard and touch)
- [ ] HUD displays speed and altitude
- [ ] Attribution is visible
- [ ] API key is secured with referrer restrictions
- [ ] Works on desktop browsers (Chrome, Firefox, Safari)
- [ ] Works on mobile browsers (iOS Safari, Android Chrome)
- [ ] No console errors in production
- [ ] Performance is acceptable (30+ fps desktop, 20+ fps mobile)

---

## Verification Steps

1. Build locally: `npm run build`
2. Preview locally: `npm run preview`
3. Verify preview works
4. Deploy to Vercel
5. Open production URL on desktop
6. Test all controls
7. Open production URL on mobile
8. Test touch controls
9. Check Google Cloud Console for API usage
10. Verify API key restrictions are applied

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `vercel.json` | Create | Vercel configuration |
| `.gitignore` | Verify | Ensure .env not committed |
| Google Cloud Console | Configure | API key restrictions |

---

## Deployment Checklist

Before announcing:

- [ ] Tested on desktop Chrome
- [ ] Tested on desktop Firefox
- [ ] Tested on desktop Safari
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome
- [ ] API key restricted to production domain
- [ ] Attribution visible
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Build is production (minified)
- [ ] URL is memorable and shareable

---

## Custom Domain (Optional)

If you want a custom domain:

1. Purchase domain from registrar
2. In Vercel dashboard:
   - Go to project settings
   - Click "Domains"
   - Add your domain
   - Follow DNS configuration instructions
3. Update API key restrictions to include new domain

---

## Monitoring (Recommended)

### Google Cloud Console

Set up billing alerts:
1. Go to Billing > Budgets & alerts
2. Create budget for Maps API
3. Set alerts at $50, $100, $500

### Vercel Analytics (Optional)

Enable in Vercel dashboard to track:
- Page views
- Unique visitors
- Performance metrics

### Simple Analytics Alternative

Add to index.html (privacy-friendly):
```html
<script async defer src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
```

---

## What NOT to Do in This Stage

- ❌ Do not add new features
- ❌ Do not refactor code
- ❌ Do not change physics
- ❌ Do not commit .env files
- ❌ Do not expose API keys in client code (they're in env vars)

---

## Common Issues

### API key not working in production

- Check environment variable is set in Vercel
- Variable must be named `VITE_GOOGLE_MAPS_API_KEY`
- Redeploy after adding variable
- Check key is not restricted to localhost

### Tiles not loading (403 errors)

- API key restrictions may be blocking
- Add production domain to allowed referrers
- Check Map Tiles API is enabled

### Build fails

- Check for TypeScript errors (if using TS)
- Check for missing dependencies
- Ensure all imports are correct

### Slow initial load

- This is expected for 3D tiles
- Consider adding loading indicator
- First visit may be slower (no cache)

---

## Launch Announcement

After deployment is verified, you're ready to announce!

**Suggested tweet:**

```
SF Flight Sim is now playable.

Fly over photorealistic San Francisco in your browser. Golden Gate, Alcatraz, downtown—all rendered in real-time from Google's 3D data.

Built 100% with Claude Code + Opus 4.5.

Try it: [YOUR_URL] 🎮

[Attach video of Golden Gate fly-through]
```

---

## Post-Launch Tasks

After launching:

1. **Monitor API costs** - Watch Google Cloud Console
2. **Respond to feedback** - Check social media, fix bugs quickly
3. **Capture metrics** - Screenshot player counts, engagement
4. **Plan next features** - Based on feedback (multiplayer?)

---

## Success!

Congratulations! You've built and deployed a browser-based flight simulator over photorealistic San Francisco terrain using AI-assisted development.

**What you've accomplished:**
- Three.js + Google 3D Tiles integration
- Arcade flight physics
- Keyboard and touch controls
- Smooth follow camera
- HUD display
- Production deployment

**What you've proven:**
- AI can assist with complex 3D applications
- Browser-based games can use real-world data
- "Vibe coding" can produce real products

Now share it with the world! 🚀
