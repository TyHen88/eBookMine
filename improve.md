PHASE 6 — eBookMine Product UX/UI Redesign

The current eBookMine application is functional, but the UX currently feels like a basic PDF library/admin dashboard.

I have reviewed the current UI and want to redesign the product before implementing the remaining advanced learning features.

The product vision is:

eBookMine = Personal Digital Library + Reading Workspace + AI Learning Assistant

The core user journey should become:

Discover Book
→ Start Reading
→ Understand
→ Take Notes / Highlight
→ Ask AI
→ Practice
→ Remember
→ Continue Learning

DO NOT change the database architecture in this phase.

DO NOT implement RAG or AI backend in this phase.

DO NOT rewrite PDF.js.

Focus ONLY on UX/UI, navigation, component architecture, and frontend interactions.

==================================================
1. PRODUCT DESIGN DIRECTION
==================================================

The UI should feel:

- calm
- modern
- premium
- book-focused
- intelligent
- personal
- educational
- clean
- spacious but not empty

Avoid making the application look like:

- an admin dashboard
- a generic SaaS template
- a file manager
- a collection of bordered cards

Use cards selectively.

Improve visual hierarchy using:

- typography
- whitespace
- section hierarchy
- subtle borders
- subtle shadows
- meaningful colors
- clear primary actions

Keep the existing eBookMine branding and purple/indigo identity, but refine it.

==================================================
2. GLOBAL NAVIGATION
==================================================

Redesign the header.

Anonymous user:

eBookMine
Library
About / Features
Sign In

Authenticated user:

eBookMine
Library
My Learning
AI Assistant

Right side:

Search
Theme toggle
User avatar/menu

Do not show "Sign In" when already authenticated.

Create responsive navigation for mobile.

==================================================
3. LIBRARY REDESIGN
==================================================

The current library is too much like:

Search
Category
687 books
Book grid

Redesign it into a personal reading library.

Top section:

Library

"Your personal reading space"

Continue Reading section.

If user has reading progress:

Show the most recently read book prominently.

Display:

- cover
- title
- author
- current chapter
- current page
- progress percentage
- progress bar
- Continue Reading
- Ask AI

If user has no reading history:

Show an attractive empty state:

"Start your learning journey"

"Choose a book and eBookMine will help you read, understand and remember it."

Button:

Explore Library

==================================================
4. LIBRARY FILTERS
==================================================

Improve search and filtering.

Search:

"Search books, authors, or topics..."

Filter tabs:

All
Reading
Unread
Completed
Favorites

Advanced filters:

Category
Author
Language
Progress
Date Added

Sorting:

Recently Added
Recently Read
Title
Author
Progress

Keep grid/list view.

==================================================
5. BOOK CARDS
==================================================

Redesign BookCard.

For unread:

Show:

Cover
Title
Author
Category
Start Reading

For currently reading:

Show:

Cover
Title
Author
Progress bar
72%
Page 142 / 196
Continue Reading

For completed:

Show:

Cover
Title
Author
Completed
Read Again

Add a subtle overflow menu:

⋮

Actions:

Add to shelf
Favorite
Mark as completed
View details

Do not overcrowd the card.

==================================================
6. SHELVES
==================================================

Add personal shelves.

Examples:

All Books
Currently Reading
Favorites
Completed

Allow custom shelves later.

Design the UI so shelves can be added without major redesign.

==================================================
7. BOOK DETAIL PAGE
==================================================

Redesign /book/[id].

The page should feel like a book learning workspace.

Hero section:

Book cover

Title
Author
Description
Language
Pages
Category

Primary action:

Continue Reading

Secondary:

Ask AI

Progress:

72%

Learning tools:

AI Assistant
Flashcards
Quiz
Notes

Then:

About

Chapters / Contents

Reading progress

Notes

Bookmarks

==================================================
8. DASHBOARD / MY LEARNING
==================================================

Rename Dashboard to:

My Learning

The dashboard should not feel empty.

For new users:

Show an onboarding/empty-state experience.

Example:

Welcome to your learning space 👋

Start reading a book and your learning activity will appear here.

Actions:

Explore Library
How eBookMine Works

Show a learning journey:

Read
Understand
Practice
Remember

For active users show:

Continue Reading

Reading statistics

Books completed

Pages read

Reading time

Quiz score

Flashcards

Reading streak

Weekly activity

Active goals

Recommended books

==================================================
9. AI Assistant ENTRY POINT
==================================================

AI should be visible throughout the product.

Add an AI Assistant navigation item.

Inside book detail:

Ask AI

Inside reader:

Ask about this page

Explain selected text

Summarize

Give example

Translate

Test me

AI should feel like a learning companion rather than a generic chatbot.

==================================================
10. READER UX
==================================================

Do not rewrite PDF.js.

Improve the surrounding reader interface.

Reader layout:

Left:
Document navigation / thumbnails / table of contents

Center:
PDF

Right:
AI Assistant / Notes panel

Toolbar:

Previous page
Page number
Next page
Zoom
Search
Bookmark
Highlight
Fullscreen
Reader settings

On selected text show:

Explain
Simplify
Translate
Highlight
Add Note
Ask AI

Make the right AI panel collapsible.

On mobile, convert panels into drawers/sheets.

==================================================
11. DESIGN SYSTEM
==================================================

Create/reuse consistent UI primitives.

Define:

Typography scale

Spacing system

Border radius

Button hierarchy

Input styles

Card styles

Badge styles

Empty states

Loading states

Skeletons

Error states

Dialogs

Dropdowns

Tooltips

Use the existing Tailwind + UI architecture.

Do not introduce unnecessary UI libraries.

==================================================
12. RESPONSIVE DESIGN
==================================================

The application must work well on:

Desktop
Laptop
Tablet
Mobile

Do not simply shrink desktop components.

For mobile:

Use bottom sheets/drawers where appropriate.

Book cards should become usable single-column cards.

Reader should have a mobile-specific toolbar.

==================================================
13. ACCESSIBILITY
==================================================

Implement:

Keyboard navigation

Focus states

ARIA labels

Semantic HTML

Accessible dialogs

Accessible buttons

Color contrast

Reduced motion support

==================================================
14. PERFORMANCE
==================================================

Do not introduce unnecessary client components.

Keep server components where possible.

Avoid unnecessary global state.

Avoid unnecessary API requests.

Use loading skeletons.

Lazy-load heavy reader/AI UI where appropriate.

==================================================
15. IMPORTANT CONSTRAINTS
==================================================

Do NOT:

- change PostgreSQL schema
- change Prisma
- change authentication
- remove Google Drive
- remove library.json
- rewrite PDF.js
- remove existing functionality
- replace the entire application
- add unnecessary dependencies

Preserve existing functionality.

Refactor components only when necessary.

==================================================
16. EXPECTED RESULT
==================================================

The final application should feel like:

"Kindle + Notion + AI Assistant"

rather than:

"PDF file library + dashboard"

The user should immediately understand:

1. What am I reading?
2. Where did I stop?
3. What should I read next?
4. How can AI help me?
5. What have I learned?
6. What should I review?

After implementation:

Run:

npm run lint
npm run build

Fix all errors.

Report:

- Files created
- Files modified
- Components redesigned
- Routes changed
- UX improvements
- Responsive improvements
- Accessibility improvements
- Performance considerations
- Any remaining issues

Do not move to the AI/RAG implementation until this UX foundation is stable.