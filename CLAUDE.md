# CLAUDE.md — standing instructions for this project

Read this at the start of every session. Update it whenever we settle on a rule that should hold all day.

## What this is

A buyer's app for a furniture shop, built for Day 1 of the Cognitivo / UNSW AI Training & Hackathon (29 July 2026). A user logs in, browses a real product catalogue, sees their real balance, and places real orders against it. By end of day they can do all of that by typing a plain-English request instead of clicking.

Full build plan: `furniture-buyer-day1-plan.md`. Requirements: `requirements.md`. Design: `architecture.md`.

## Who I'm working with

Richard has no coding background. That shapes how to work here:

- Explain choices in plain English before making them. One-sentence trade-offs, not lectures.
- Never say "it should work." Say what to open, what to click, and what they should see.
- When something breaks, describe it in terms of what's on screen, not stack traces.
- Prefer boring, well-trodden technology over clever technology. When it breaks at 4pm there needs to be an answer.

## Tech stack

- **Next.js + TypeScript** — pages and server logic in one project
- **Tailwind CSS** — styling
- **Prisma + SQLite** — the app's own data (users, orders placed through us, reports). One file, `prisma/dev.db`.
- **MongoDB (shared, read-only)** — the event's real product catalogue, 762 products with image URLs and dimensions
- **Furniture-shop REST API** — real balance and real orders
- **ngrok** — public URL, required by Level 1

## Hard rules

These come from the lab materials and are not negotiable.

1. **Never call plain `GET /catalogue`.** It embeds every product image as base64 — tens of MB, 20+ seconds, and a much stricter rate limit. Use `GET /catalogue/search-index` for all browsing. Only use `GET /catalogue/{item_id}` when we genuinely need one specific product's image or dimensions.
2. **Every secret lives in `.env`, which is gitignored.** The repo is public. After any change touching keys, run `git status` and confirm `.env` is absent.
3. **Money is stored as integer cents.** Never floats. `129900` displays as `$1,299.00`. A budget app that's a cent out is a broken demo.
4. **`POST /orders` spends real event money.** It is never a preview. Confirm before it fires.
5. **Catalogue search is an exact, case-insensitive category match.** No fuzzy matching on price, colour, or vibe. That reasoning happens in our code or the agent, over the returned results — never assumed of the API.
6. **We can only ever act as our own `user_id`.** A different one, even with a valid key, returns 403.
7. **Commit and push at the end of every task**, not at the end of the day. Small commits mean a known-good state is always one step back.

## API errors — all of these need a real UI state, never a crash

| Code | Means | Show the user |
|---|---|---|
| 401 | Missing or invalid API key | Something's wrong with our setup, not their fault |
| 403 | Valid key, wrong user | Same |
| 404 | Unknown user or item | "This item is no longer available" |
| 402 | Order costs more than the balance | "Insufficient balance" — clearly, with the shortfall |
| 429 | Calling too fast | Back off and retry using the `Retry-After` seconds |

## Conventions

- Prices: integer cents in the database and in all logic; format only at the point of display.
- Remaining budget is calculated from orders, never stored as a running total — stored totals drift out of sync after a crash and then the number on screen is a lie.
- `app/` is what a user sees, `lib/` is the thinking, `components/` is anything appearing more than once.
- Commit messages in plain English, describing the outcome.
