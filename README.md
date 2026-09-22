# Aether

Consumer **agent video platform**: open a video (file or direct media URL), get a player + chapters, jump by timestamp.

- **What you see:** Add · Watch · Chapters (Apple Developer Videos–style session card on xAI black chrome)
- **What runs underneath:** `POST /api/analyze` → ffmpeg scene detect + thumbnails → Zod JSON

## Run

```bash
npm install
npm run dev
```

Requires **ffmpeg** and **ffprobe** on `PATH`.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Zod
- Node API route (`runtime: 'nodejs'`) + ffmpeg

## Notes

- Direct media URLs (`.mp4` / `.webm`) or local upload work. HTML pages (e.g. developer.apple.com session pages) are not direct files — upload the video instead.
- Library / Canvas / You tabs are placeholders for the full platform surface.
