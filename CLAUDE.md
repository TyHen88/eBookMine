# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # next lint (ESLint)
```

There is no test runner configured.

## Environment

The app does not run without `.env.local` (see README for Google Cloud OAuth setup):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

The OAuth client's authorized redirect URI must be
`http://localhost:3000/api/auth/callback/google`, and your Google account must be
listed as a **test user** on the consent screen (the app stays unverified).

## Architecture

This is a **serverless-by-design** Next.js (App Router, TypeScript) app: there is
**no database and no app-owned storage**. Each user's books and all metadata live
in *their own* Google Drive. The Next.js backend is purely a token-holding proxy
to the Drive REST API. Path alias `@/*` → `src/*`.

### The Drive folder is the database

On every authenticated request the backend resolves a single Drive folder named
`eBookMine` (created on first use, see `getOrCreateAppFolder`). Inside it:

- Each book is a PDF file. **The Drive file id is the book's primary key**
  (`BookMeta.id`).
- A single `library.json` holds all metadata for every book — titles, authors,
  tags, favorites, `lastPage`, bookmarks, and base64 cover thumbnails
  (`Library` / `BookMeta` in `src/lib/metadata.ts`).

Because `library.json` is one blob, every mutation is **read-modify-write the
whole file** (`loadLibrary` → mutate → `saveLibrary`). There is no locking;
concurrent writers can clobber each other. Keep that in mind before adding
parallel write paths.

`GET /api/books` does **reconciliation** every call: it lists the Drive PDFs and
the metadata, adds entries for PDFs that exist in Drive but not in `library.json`
(e.g. manually dropped in), drops metadata for PDFs that were deleted, and
persists if anything changed. So Drive is the source of truth for *which files
exist*; `library.json` only enriches them.

### OAuth scope and token flow

- Scope is `drive.file` (**least privilege**) — the app can only see files it
  created, never the rest of the user's Drive. Do not broaden this scope.
- NextAuth uses a **JWT session** (no DB). The Google access token is stored in
  the JWT and refreshed in the `jwt` callback in `src/lib/auth.ts` when within
  60s of expiry, using the stored refresh token. `access_type=offline` +
  `prompt=consent` is what makes Google return a refresh token.
- Server code never gets the token from a header — it calls `getAccessToken()`
  (`src/lib/session.ts`), which reads it off the server session. Every API route
  starts with this and returns 401 if absent.
- The token is **never exposed to the client.** That's why PDFs are streamed
  through `GET /api/books/[id]/file` (server downloads from Drive with the token,
  pipes the body back) rather than handing the browser a Drive URL.

### Layers

- `src/lib/drive.ts` — thin, dependency-free wrappers over the Drive v3 REST API
  (`fetch`-based, manual multipart upload). Every function takes the access token
  as its first arg. This is the only file that talks to Google Drive.
- `src/lib/metadata.ts` — `library.json` read/write on top of `drive.ts`, plus
  the `BookMeta`/`Library`/`Bookmark` type definitions.
- `src/lib/types.ts` — client-side re-export of the shared types.
- `src/app/api/books/**` — the four endpoints: `GET`/`POST` list & upload,
  `[id]` PATCH/DELETE metadata, `[id]/file` GET stream. All are
  `dynamic = "force-dynamic"`. PATCH only writes a fixed allowlist of fields.
- `src/components/**` — all `"use client"`. `page.tsx` gates on session status:
  `SignIn` when unauthenticated, else `Header` + `Library`.

### PDF handling (client-side)

- `src/lib/pdf.ts` configures the pdf.js worker **once** and exports
  `extractPdfInfo`, which parses an uploaded PDF *in the browser* to pull page
  count, embedded Title/Author, and a rendered first-page cover thumbnail
  (data URL). Metadata extraction happens client-side **before** upload; the
  cover/title/author are then POSTed alongside the file as a `meta` JSON field.
- `pdfjs-dist` pulls in a Node-only `canvas` dependency that's unneeded in the
  browser; `next.config.js` aliases `canvas: false` in webpack to drop it. If
  you change pdf.js handling, keep that alias or the build breaks.
- The reader (`Reader.tsx`) renders one page at a time via `react-pdf`, debounces
  `lastPage` persistence (800ms), and stores bookmarks in the same metadata PATCH
  path.

### Optimistic UI convention

Client mutations (favorite toggle, edits, delete, reading progress) update React
state immediately, then fire the PATCH/DELETE in the background without awaiting a
refetch (see `patchBook`/`deleteBook` in `Library.tsx`). The server response is
generally ignored on the happy path.

## Styling

Tailwind with `darkMode: "class"` and a custom `brand` color scale (blue). Dark
mode is toggled by adding the `dark` class (see `ThemeToggle.tsx`).
