# Requirements

What this app has to do, and how each requirement maps to the event's levels of difficulty.

## The scenario

A small furniture shop has a real online catalogue, a real (event-only) bank balance per user, and a real ordering system that debits that balance. This is the **buyer's app**: what a customer opens to browse that catalogue, see what they can afford, and buy something.

## Level 1 — a normal web app

| Requirement | What it means here | Status |
|---|---|---|
| Business domain entity model | Customer, Product, Order, OrderItem, and how they relate | ✅ |
| Web user interface | Pages a person opens in a browser and clicks around | ✅ |
| User login | Tell one user apart from another | ✅ |
| Save data in a database | Users and orders survive closing and reopening the app | ✅ |
| Workflow / controller logic | Rules beyond displaying data — can't order beyond your balance | ✅ |
| Generate reports | A page summarising past orders and total spent | ✅ |
| Accessible via the internet | Someone on another network can open it | ✅ |

A working simple version of each is a complete Level 1. Polish is for leftover time.

## Level 2 — talk to the outside world

| Requirement | What it means here | Status |
|---|---|---|
| Call an external API | Real catalogue via `GET /catalogue/search-index` | ☐ |
| | Real balance via `GET /users/{user_id}` | ☐ |
| | Real orders via `POST /orders` | ☐ |
| | Real order history via `GET /orders/{user_id}` | ☐ |
| Handle failure properly | 402 / 404 / 429 / 401 / 403 each show something sensible | ☐ |

## Level 3 — an agent

| Requirement | What it means here | Status |
|---|---|---|
| Plain-English requests | A text box: "find me a chair under $500" | ☐ |
| Tool-calling | Four tools: search catalogue, look up product, check balance, place order | ☐ |
| Reasoning the API can't do | "Cheap", colour, vibe — applied over results, in our code | ☐ |
| Confirm before spending | Show what it's about to buy and wait for a yes | ☐ |
| Graceful failure, conversationally | Explain a 402 or 404 in plain language, suggest an alternative | ☐ |

## Level 4 — stretch, optional

Vector RAG product Q&A: answer open-ended questions ("most affordable option in blue") by meaning rather than exact field matches. Only after Levels 1–3 are solid.

## Out of scope for Day 1

Signup (demo users are pre-seeded), payment, admin screens, image upload, permanent deployment.

## Known unknowns

Blocking Level 2, to collect from an organiser:

- Our User ID and API key
- The API base URL
- Which LLM endpoint participants should use for their own agent
