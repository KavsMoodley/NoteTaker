# NoteTaker

A fast, local note-taking desktop app. Notes are stored as plain Markdown files on your machine — no account, no cloud, no tracking.

## Features

- Local Markdown notes with folders, tags, and pinning
- Auto-save while typing; titles derived from the first line
- Full-text search across titles and note contents
- Export any note to Markdown, TXT, HTML, or PDF
- Optional AI assistant (Google Gemini free tier) for the selected text

## Requirements

- [Node.js](https://nodejs.org) 18+ (includes npm)

## Install and run from source

```bash
git clone https://github.com/KavsMoodley/NoteTaker.git
cd NoteTaker
npm install --save-dev electron
npm start
```

## Where your notes are stored

NoteTaker writes everything to its user-data folder:

| OS      | Path                                  |
|---------|---------------------------------------|
| Windows | `%APPDATA%\notetaker\notes\`          |
| macOS   | `~/Library/Application Support/notetaker/notes/` |
| Linux   | `~/.config/notetaker/notes/`          |

Each note is a `.md` file; `index.json`, `folders.json`, and `settings.json` hold metadata. Back up or migrate the whole `notes` folder to move your data.

## AI assistant (optional)

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Open the app, go to **Palette > AI assistant**, and paste the key

The key is stored only in your local `settings.json`. When you select text in a note, the AI panel can look it up or explain it in context.

## Build a packaged app (optional)

```bash
npm install --save-dev @electron/packager
npx electron-packager . NoteTaker --platform=win32 --arch=x64
```

The executable is written to `NoteTaker-win32-x64/NoteTaker.exe`.

## License

MIT