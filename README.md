# SF Flight Simulator

A browser-based flight simulator over photorealistic San Francisco, inspired by [fly.pieter.com](https://fly.pieter.com).

**Built with:** Three.js + Google Photorealistic 3D Tiles + Vite

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Controls

| Key | Action |
|-----|--------|
| W / ↑ | Pitch down (dive) |
| S / ↓ | Pitch up (climb) |
| A / ← | Roll left |
| D / → | Roll right |
| Shift | Throttle up |
| Ctrl | Throttle down |
| Space | Auto-level |

Touch controls available on mobile.

## Setup

1. Get a Google Maps API key with "Map Tiles API" enabled
2. Create `.env` file: `VITE_GOOGLE_MAPS_API_KEY=your_key_here`
3. Run `npm run dev`

## License

MIT
