# Furniture Buyer

A buyer's app for a furniture shop, built for Day 1 of the Cognitivo / UNSW AI Training & Hackathon.

Log in, browse a real 762-product catalogue, and place orders against a budget.

## Running it

You need two terminals. Leave both open — closing either stops the app.

**Terminal 1 — the app:**

```bash
npm install          # first time only
npm run dev
```

Open <http://localhost:3000>.

**Terminal 2 — the public address** (only when someone else needs to reach it):

```bash
ngrok http 3000
```

ngrok prints a `https://….ngrok-free.app` address. That address is new every
time you restart ngrok, so re-share it if you restart. First-time visitors see
an ngrok warning page and click **Visit Site** once.

## Logging in

| Email | Password |
|---|---|
| `buyer@demo.com` | `hackathon` |
| `buyer2@demo.com` | `hackathon` |

## Setting up from scratch

```bash
cp .env.example .env      # then fill in the values
npm install
npx prisma migrate deploy # create the database
npm run db:seed           # demo users
npm run import:catalogue  # the real 762-product catalogue (takes a few minutes)
```

## The commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm run build` | Check the whole app compiles |
| `npm run db:seed` | Create the demo users |
| `npm run import:catalogue` | Load the real catalogue from the shared MongoDB |
| `npm run db:reset` | Wipe the database and start over (then re-seed and re-import) |

## Where things live

- `src/app/` — the pages a person sees, one folder per address
- `src/lib/` — the thinking: database, login, money, budget rules
- `src/components/` — anything that appears more than once
- `prisma/schema.prisma` — the shape of the data, in readable form

See `architecture.md` for how it fits together, `requirements.md` for what it
has to do, and `furniture-buyer-day1-plan.md` for the plan of the day.

## A note on the login

The login is demo-grade: correct for a hackathon, with passwords properly
hashed and the session cookie encrypted, but not audited. Don't put real
customer data behind it without a proper security review.
