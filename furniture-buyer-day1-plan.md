# Day 1 Furniture Buyer's App — Implementation Plan

> Built from the Cognitivo AI Training & Hackathon Day 1 lab materials (Steps 0–9) and the event agenda.
> Written 29 July 2026, 10:30 AEST. Move this file into the repo once Task 1 is done.

**Goal:** A web app where a logged-in user browses a real furniture catalogue, sees their real balance, places real orders against it, and — by end of day — can do all that by typing a plain-English request.

**Architecture:** Next.js app (pages + server logic in one project). The app's *own* data (users, login sessions, order log for reports) lives in local SQLite. The *product catalogue* comes from the event's shared read-only MongoDB. *Balance and real orders* come from the event's furniture-shop REST API. A Level 3 agent sits on top, exposing four API actions as tools.

**Tech stack:** Next.js + TypeScript, Tailwind CSS, SQLite via Prisma, MongoDB driver (read-only catalogue), the event's furniture-shop REST API, ngrok for public access.

---

## Three corrections to this morning's proposal

Before the lab docs, I proposed a self-contained app with its own catalogue and its own budget. The labs change three things:

1. **The budget is not ours to invent.** Each participant has a real event balance behind `GET /users/{user_id}`, and `POST /orders` really debits it. Our own "allowance" is a Level 1 placeholder only, replaced in Lab 2.
2. **Laptop-only is not sufficient.** Level 1 explicitly requires "accessible via the internet." ngrok is a required task, not a Day 2 nice-to-have.
3. **Two databases, deliberately.** The agenda lists "connecting to databases (MongoDB, SQLite)" as a Day 1 objective. SQLite holds our users/orders; the shared MongoDB gives us 762 real products *with `image_url`* — the fastest route to a demo that looks real.

Login with pre-seeded demo users still stands, and is still the right call — it satisfies "user login" with nothing to debug.

---

## Blockers — resolve these before Lab 2 (ask an organiser at the break)

- [ ] **Your User ID** (e.g. `u001`) and **API key** — needed for balance and orders. Nothing in Level 2 works without them.
- [ ] **The API base URL** — the guide says "ask an organizer, or check the event portal." The participant guide links `https://day1.training.cognitivo.com.au/`; confirm that's the API root.
- [ ] **Which LLM endpoint to use for your own agent** (Level 3). The agenda mentions Azure Foundry in Lab 2; the lab guide is provider-agnostic. Ask which key participants should use.

None of these block Lab 1 — we build the whole Level 1 app without them.

---

## Global constraints (from the lab materials)

- Repo must be **public** on GitHub.
- `.env` holds every key; `.env` must be in `.gitignore`. Run `git status` and confirm it never appears.
- **Never call plain `GET /catalogue`** for browsing — it embeds every image as base64, can be tens of MB and 20+ seconds, and has a much stricter rate limit. Use `GET /catalogue/search-index`.
- Catalogue search is an **exact, case-insensitive category match**. No fuzzy matching on price, colour, or vibe — that reasoning happens in our code or the agent, never in the API call.
- You can only ever act as your own `user_id`. A different one, even with a valid key, returns 403.
- `POST /orders` spends real event money. It is never a preview.
- Commit and push at the end of every task, not at the end of the day.
- Deliverables the labs expect in the repo: `CLAUDE.md`, `requirements.md`, `architecture.md` (with a Mermaid class diagram).

**Error codes to handle as real UI states, not crashes:** 401 (missing/bad key) · 403 (wrong user) · 404 (unknown user or item) · 402 (insufficient balance) · 429 (too fast — wait the `Retry-After` seconds).

---

# LAB 1 — now until 12:30

Goal by lunch: a working Level 1 app, public on ngrok, pushed to GitHub.

### Task 1: Repo and project docs (~20 min)

- [ ] Create a **public** GitHub repo `my-furniture-buyer-app` with a README
- [ ] Clone it to `~/projects/my-furniture-buyer-app`
- [ ] Write `CLAUDE.md` — standing instructions for every future session
- [ ] Write `requirements.md` — what the app must do, mapped to Levels 1–3
- [ ] Write `architecture.md` — Mermaid class diagram (Customer, Product, Order) plus a plain-English explanation underneath
- [ ] Move this plan file into the repo
- [ ] Commit and push

**You check:** refresh the GitHub page — the files are there, and the Mermaid diagram renders as an actual picture. Read the plain-English paragraph under it and confirm it matches what you pictured.

### Task 2: Scaffold the app (~30 min)

- [ ] Next.js + TypeScript + Tailwind project
- [ ] Prisma with SQLite; schema for `User`, `Product`, `Order`, `OrderItem`
- [ ] Prices stored as integer cents throughout — never floats
- [ ] Seed 2 demo users with a placeholder balance and hashed passwords
- [ ] Placeholder product data so the page renders before Mongo is wired in
- [ ] Home page listing products; login page
- [ ] Commit and push

**You check:** open `http://localhost:3000`, see a product grid, log in as the demo user. Click around. If anything looks wrong, describe what you see versus what you expected.

### Task 3: Real catalogue from the shared MongoDB (~25 min)

The shared read-only credential is published in the lab materials (Step 2 / Step 4) — it is not personal, but it still goes in `.env`, never in source.

- [ ] `.env` with `MONGODB_URI`, and `.env` in `.gitignore`
- [ ] Import the `catalog` collection (762 products) into our SQLite `Product` table
- [ ] Keep `image_url`, `depth`, `height`, `width` — the dimensions aren't available through any API endpoint
- [ ] Product grid renders real names, categories, prices and images
- [ ] Commit and push

**You check:** `git status` does not list `.env`. The grid shows real furniture with real photos.

### Task 4: Business rules and reports (~25 min)

These two satisfy "workflow and controller logic" and "generate some reports."

- [ ] Block any order costing more than the user's remaining balance, with a clear message — not an error page
- [ ] "My orders" page: the logged-in user's past orders and total spent
- [ ] Commit and push

**You check:** try to overspend on purpose. You should get a sensible message, not a crash.

### Task 5: Public on the internet via ngrok (~15 min)

- [ ] Start an ngrok tunnel to the local app
- [ ] Confirm the public URL loads

**You check — this is the real test:** open the ngrok URL **on your phone with WiFi off, on mobile data**. If it loads there, it genuinely isn't localhost. Leave the tunnel and the app running in terminals you won't accidentally close.

**Level 1 is now complete.** Entity model, web UI, login, database, workflow logic, reports, internet-accessible.

---

# LAB 2 — 13:30 to ~15:30

Goal: everything real. Requires your User ID, API key, and the base URL.

### Task 6: Key handling first (~10 min)

- [ ] `API_BASE_URL`, `API_KEY`, `USER_ID` into `.env`
- [ ] Confirm `GET /health` responds (needs no auth — fastest proof the API is up)
- [ ] `git status` — `.env` still absent

### Task 7: Swap in the real API (~40 min)

- [ ] Browse via `GET /catalogue/search-index` with `category` / `limit` / `skip` — never plain `/catalogue`
- [ ] Show the real balance from `GET /users/{user_id}` instead of our placeholder
- [ ] "Buy" places a real order via `POST /orders`, then shows the confirmation and updated balance
- [ ] Order history from `GET /orders/{user_id}`
- [ ] Commit and push

**You check:** balance shown matches the API's own web page. Place one small real order and watch the balance drop.

### Task 8: Make failure look designed (~30 min)

This is what separates "technically works" from "feels finished."

- [ ] 402 → clear "insufficient balance" message
- [ ] 404 → "this item is no longer available"
- [ ] 429 → back off and retry using the `Retry-After` seconds
- [ ] 401/403 → a sensible state, not a stack trace
- [ ] Commit and push

**You check — try to break it deliberately:** buy something costing more than your balance; look up a product ID that doesn't exist; click "Buy" twice fast on the same item. Any confusing error is a finding worth fixing.

**Level 2 is now complete.**

---

# LAB 3 — 15:45 to 17:00

Goal: type a sentence, get a real action.

### Task 9: Design the four tools before building (~15 min)

Name and describe each, honestly about what the API *cannot* do:

| Tool | Does | Must not overpromise |
|---|---|---|
| search catalogue | find products by category | exact category match only — not price, colour, or vibe |
| look up product | full detail + image for one item | one item at a time; never for browsing |
| check balance | current user's remaining funds | only ever the current user |
| place order | buy one item for the current user | really spends real money |

- [ ] Write the four descriptions into `architecture.md`

If a description overpromises, the model will confidently ask for something the API can't deliver and you'll get a wrong answer instead of a clear failure.

### Task 10: Build the agent (~35 min)

- [ ] Text box on the logged-in page for a plain-English request
- [ ] Agent loop wired to the four tools
- [ ] "Cheap", "mustard", "for a kid's room" — that judgement happens over the returned results, in our code, not in the API call
- [ ] **Confirm before spending:** show what it's about to buy and for how much, and wait for a yes
- [ ] 402/404 explained back conversationally with a suggestion, never a raw error
- [ ] Commit and push

**You check — three genuinely different phrasings:** "What's my balance?" · "Find me a chair under $500." · "Buy the first one." (does it remember what "the first one" was?) · plus one that should fail.

**Level 3 is now complete.**

---

# 16:45 — Showcase smoke test

Run end-to-end on the **public ngrok URL**, in a fresh tab, not one that's been open for hours:

- [ ] Load the public address; log in
- [ ] Real catalogue data, real balance
- [ ] Plain-English request returns something sensible
- [ ] Ask it to buy — it confirms, the order goes through, the balance updates
- [ ] One deliberate failure explains itself
- [ ] App and ngrok both still running in terminals you won't close

**Two-minute demo shape:** the problem in one sentence → type a real request live and let it respond → one honest limitation ("with another hour I'd…"). The honest limitation lands better than pretending it's finished; everyone in the room built under the same clock.

---

# Stretch — only if Steps 1–7 are solid

Both optional, independent, and genuinely harder. A working Level 1–3 app is a complete result for the day.

- **Step 8 — Vector RAG Q&A (Level 4):** answer open-ended questions like "most affordable option in blue" by meaning rather than exact fields. Source is a public catalogue PDF — no API or Mongo needed. For 762 products, embeddings fit in memory; plain cosine similarity is enough, no vector database. Chunk one product per entry. Test retrieval on its own before wiring up generation.
- **Step 9 — OpenClaw on WhatsApp:** package the same four tools as an OpenClaw skill. **Note the safety warning:** it takes real actions on your real machine and real WhatsApp, and is not sandboxed the way the in-app agent is. Grant it only the one skill.

---

# Level scorecard

| Level | Done when |
|---|---|
| 1 | Someone else can log in, browse, and see their own saved orders |
| 2 | Real catalogue and balance, and a failed order handled gracefully |
| 3 | A typed request causes a correct real action without clicking its button |
| 4 | Open-ended catalogue questions answered by meaning (stretch) |

**Nothing to submit for Day 1** — the repo and its commit history are the record. Day 3's hackathon has a separate submission process.
