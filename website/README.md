# Chess Website

Public-facing marketing and landing site for the chess app — features, FAQ, how-to-play guide, themes, and download page.

## Quick Start

```bash
cd website
pnpm install
pnpm dev          # vite dev server on :5173
pnpm build        # tsc -b && vite build
pnpm preview      # serve built site locally
```

## Stack

- **Framework:** React 19
- **Routing:** react-router-dom 7
- **Styling:** Tailwind CSS v4
- **Build:** Vite 6
- **Icons:** lucide-react

## Pages

- **Home** — Hero, features, game modes, how it works, app preview, releases
- **Download** — Platform download links and checksums
- **Features** — Detailed feature list with screenshots
- **How to Play** — Rules guide for beginners
- **FAQ** — Frequently asked questions
- **Themes** — Board theme showcase and preview

## Project Structure

```
website/
  src/
    App.tsx           App shell with routing
    main.tsx          Entry point
    index.css         Tailwind entry
    components/       Reusable UI components (14 files)
    pages/            Page components (6 files)
  public/             Static assets
  dist/               Build output
```
