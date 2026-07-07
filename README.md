# 📚 eBookMine

A personal eBook (PDF) library web app. Sign in with Google and your books live
in **your own Google Drive** — the app only ever touches a single `eBookMine`
folder it creates. No database, no third-party server storing your files.

## Features

- **Sign in with Google** — OAuth 2.0 with the `drive` scope, so the app reads
  every PDF in your `eBookMine` folder, including files you upload to Drive
  manually. Covers use Drive's own generated thumbnails.
- **Drive-native storage** — PDFs and a `library.json` metadata file are stored
  in an `eBookMine` folder in your Drive.
- **Upload** — drag-and-drop or pick multiple PDFs. Covers, titles, authors and
  page counts are extracted automatically in the browser.
- **Library** — grid & list views, search by title/author, tag filtering,
  favorites, and a "Continue reading" shelf.
- **Organize** — edit title/author, add tags/collections, rename, delete.
- **In-browser reader** — pdf.js powered: page navigation, zoom, fullscreen,
  keyboard arrows, reading-progress bar, and per-book bookmarks.
- **Resumes where you left off** — your last page is remembered per book.
- **Dark mode** — follows your system, toggle anytime.

## Tech stack

Next.js (App Router, TypeScript) · NextAuth · Google Drive API v3 ·
react-pdf / pdf.js · Tailwind CSS.

---

## 1. Set up Google OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create
   (or select) a project.
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (fine for personal use).
   - Fill in app name + your email.
   - Add the scope `.../auth/drive` (and `openid`, `email`, `profile`).
     Note: `drive` is a *restricted* scope — in Testing mode your test users
     can still use it (they'll see an "unverified app" warning to click past).
   - Add your Google account under **Test users** (so you can sign in while the
     app is unverified).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy the **Client ID** and **Client secret**.

## 1b. (Optional) Enable "Import from Drive"

The narrow `drive.file` scope means the app can only see files **it** creates —
PDFs you upload manually via the Drive website won't appear automatically. To
import existing Drive PDFs, the app uses the **Google Picker**: you browse your
Drive in-app and select files, which grants the app access to just those files
(it then moves them into the `eBookMine` folder).

To enable it:

1. **APIs & Services → Library** → enable the **Google Picker API**.
2. **APIs & Services → Credentials → Create Credentials → API key**. Copy it.
3. Put it in `.env.local` as `NEXT_PUBLIC_GOOGLE_API_KEY`.
4. `NEXT_PUBLIC_GOOGLE_APP_ID` is your project number — the digits before the
   dash in your OAuth Client ID.

If you skip this, the "Import from Drive" button will show a configuration error;
everything else (upload, library, reader) still works.

## 1c. (Optional) Make the library public

Let anyone view and read your books (and download the PDFs) without signing in —
**no stored token, nothing that expires.** Instead, the app shares your
`eBookMine` folder as *"anyone with the link → viewer"* and the public pages read
it with the API key you already configured for the Picker.

1. **Sign in as the owner at <http://localhost:3000/henty>.** Just loading it
   shares your `eBookMine` folder publicly (done automatically).
2. Open <http://localhost:3000/api/folder> and copy the `id` value.
3. Put it in `.env.local` as `EBOOKMINE_FOLDER_ID=...`.
4. Create a **server-side API key** for the reads and set `DRIVE_API_KEY=...`,
   then restart. Cloud Console → Credentials → *Create API key* →
   **Application restrictions: None**, **API restrictions: Google Drive API**.
   (The browser `NEXT_PUBLIC_GOOGLE_API_KEY` is usually restricted to HTTP
   referrers for the Picker — and referrer restrictions block the server's
   token-free calls, which have no referrer. Hence a separate, unrestricted key
   for server reads. You can reuse the public key only if it has no referrer
   restriction.)

A folder id is **not a secret** and never expires, so there's nothing to rotate
or re-publish. The home page (`/`) now shows a public, read-only library to
everyone; owner management lives at **`/henty`** (open it manually, or use the
**Manage** button that appears top-right once you're signed in).

> ⚠️ This makes the book files genuinely public on Drive — anyone with a file's
> link can open it, even outside the app. Only publish books you have the right
> to share; redistributing copyrighted textbooks publicly may be unlawful.

## 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
```

## 3. Install & run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, sign in with Google, and start uploading PDFs.

---

## How storage works

- On first sign-in the app creates a folder named **`eBookMine`** in your Drive.
- Each uploaded PDF is stored there.
- A `library.json` file in the same folder holds all metadata (titles, tags,
  favorites, reading progress, bookmarks, cover thumbnails).
- Deleting a book removes the PDF from Drive and its metadata entry.
- Because everything is in *your* Drive, the app is effectively serverless —
  the Next.js backend only proxies Drive API calls using your session token.

## Project layout

```
src/
  app/
    layout.tsx, page.tsx          # shell + landing/library gate
    read/[id]/page.tsx            # reader route
    api/
      auth/[...nextauth]/route.ts # NextAuth (Google)
      books/route.ts              # GET list / POST upload
      books/[id]/route.ts         # PATCH metadata / DELETE
      books/[id]/file/route.ts    # stream PDF binary
  components/                     # UI (Library, Reader, cards, modals…)
  lib/
    auth.ts        # NextAuth config + token refresh
    drive.ts       # Google Drive REST helpers
    metadata.ts    # library.json read/write
    pdf.ts         # pdf.js worker + cover/metadata extraction
    session.ts     # access-token helper
    types.ts       # shared client types
```

## Notes

- The OAuth consent screen stays in "testing" mode unless you verify the app;
  that's fine for personal use as long as your account is a listed test user.
- For production, set `NEXTAUTH_URL` to your deployed URL and add the matching
  redirect URI in the Google console.
