# Angular Kenya Talk — The Beauties of Angular Signals

Slide viewer for the talk. Slug-based routes, keyboard / click-zone / swipe nav, prerendered to static HTML, deployed on Cloudflare Pages.

Live: https://angular-kenya-talk.khangtran.dev

## Local development

```bash
npm install
npm start          # http://localhost:4200
```

The dev server serves PNGs from `public/slides/`. To exercise the WebP path, run `npm run optimize:slides` first — it writes `public/slides/webp/*.webp` (gitignored).

## Production build

```bash
npm run build      # prebuild generates WebPs, then ng build prerenders 26 routes
```

Output lands in `dist/angular-kenya-talk/browser/`. Each slide URL gets its own `.html` file with a per-slide `<title>` and shared OG meta.

## Adding / reordering slides

The slide order lives in `src/app/slides.ts`. Drop a PNG into `public/slides/`, add an entry to the `SLIDES` array, rebuild. Slug becomes the URL.

## Deployment (Cloudflare Pages)

1. Push the repo to GitHub.
2. Cloudflare Pages → **Create a project** → Connect the GitHub repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist/angular-kenya-talk/browser`
   - **Node version:** 20 (env var `NODE_VERSION=20`)
4. After the first deploy, attach `angular-kenya-talk.khangtran.dev` in **Custom domains** — Cloudflare auto-issues TLS.
5. Optional: enable **Web Analytics** in the CF dashboard for the project, then paste the provided `<script>` snippet into `src/index.html` above `</body>`.

Every push to `main` redeploys automatically.

## Project layout

```
src/app/
  slides.ts          # 26-entry manifest — source of truth for order
  slide.ts           # <app-slide>, renders one PNG/WebP from the route slug
  app.ts             # shell: progress bar, nav, swipe, keyboard, meta tags
  app.routes.ts      # / → /introduction, /:slug, ** → /introduction
  app.routes.server.ts  # prerender params for all 26 slugs

public/slides/       # source PNGs (committed)
public/slides/webp/  # generated WebPs (gitignored)
scripts/optimize-slides.mjs  # sharp-based PNG→WebP, runs as `prebuild`
```
