# Liu Yb · Personal site

A buildless Cloudflare Pages site for research notes and market observations.

## Deployment

- Repository: `btclyb/zke.cc.cd`, branch `main`.
- Cloudflare Pages output: repository root; no build command.
- `functions/api/quotes.js` relays the existing quote provider with a timeout and validated response.
- EdgeLens and browser tools live separately in `btclyb/edgelens`; `_redirects` retains their previous URLs.

## Publish a note

1. Add UTF-8 Markdown to `notes/<slug>.md`. Slugs contain letters, digits, underscores or hyphens.
2. Add `{ "slug", "title", "date": "YYYY-MM-DD", "summary" }` to `notes/index.json`.
3. Set `"draft": true` to hide an entry. Dates sort newest first.
4. Commit to `main`; Cloudflare deploys automatically. No generated index or build step is needed.

The existing daily Bitcoin publishing workflow can keep writing the same files and schema. The archive search, homepage list, reading time, table of contents and adjacent links update from the index automatically. Markdown rendering allows common article formatting, while stripping scripts, embedded forms, inline handlers and unsafe URL schemes.

## Source layout

- `index.html`, `archive.html`, `note.html`: page structure and accessible loading states.
- `style.css`: paper palette, responsive layouts and reduced-motion styles.
- `assets/*.mjs`: shared index loading, archive filtering, quote updates and article rendering.
- `vendor/marked.umd.js`: existing local Markdown renderer.

Quote labels show the time the site fetched data, not a guaranteed exchange timestamp. Hidden tabs pause periodic refresh. A failed refresh keeps the previous data with an explicit stale-data notice.
