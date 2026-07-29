#!/usr/bin/env bash
#
# Claims your event user_id and API key, and writes them into .env.
#
# Run from the project root:   bash scripts/claim-key.sh [email]
#
# Claiming is safe to repeat: if you've already claimed, the API returns your
# existing key rather than issuing a new one (`already_claimed: true`).
#
# The key is written straight to .env and only ever shown here masked.
set -euo pipefail

BASE="${API_BASE_URL:-https://day1.training.cognitivo.com.au}"
EMAIL="${1:-richardeve97@gmail.com}"
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env found. Run this from the project root (~/projects/my-furniture-buyer-app)." >&2
  exit 1
fi

echo "Claiming a key for $EMAIL at $BASE …"

RESPONSE=$(curl -sS -m 30 -w $'\n%{http_code}' -X POST "$BASE/claim" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")

STATUS=$(printf '%s' "$RESPONSE" | tail -1)
BODY=$(printf '%s' "$RESPONSE" | sed '$d')

if [ "$STATUS" != "200" ]; then
  echo "Claim failed (HTTP $STATUS):" >&2
  printf '%s\n' "$BODY" >&2
  echo >&2
  echo "If it says the email isn't registered, try the address you registered with," >&2
  echo "or ask an organiser:  bash scripts/claim-key.sh you@example.com" >&2
  exit 1
fi

BASE="$BASE" BODY="$BODY" ENV_FILE="$ENV_FILE" python3 <<'PY'
import json, os, re

body = json.loads(os.environ["BODY"])
user_id = body.get("user_id") or ""
api_key = body.get("api_key") or ""
already = body.get("already_claimed")

if not user_id or not api_key:
    raise SystemExit(f"Unexpected response shape: {sorted(body)}")

env_path = os.environ["ENV_FILE"]
text = open(env_path).read()

def upsert(text, key, value):
    line = f'{key}="{value}"'
    pattern = re.compile(rf'^{re.escape(key)}=.*$', re.MULTILINE)
    if pattern.search(text):
        return pattern.sub(line, text)
    return text.rstrip("\n") + "\n" + line + "\n"

for key, value in (
    ("API_BASE_URL", os.environ["BASE"]),
    ("API_KEY", api_key),
    ("API_USER_ID", user_id),
):
    text = upsert(text, key, value)

open(env_path, "w").write(text)

masked = f"{api_key[:3]}…{api_key[-4:]}" if len(api_key) > 8 else "(short key)"
print()
print(f"  user_id         {user_id}")
print(f"  api_key         {masked}  ({len(api_key)} characters)")
print(f"  already_claimed {already}")
print(f"  base url        {os.environ['BASE']}")
print()
print(f"Written to {env_path}. That file is gitignored, so it won't be committed.")
PY

echo "Now verifying the key actually works…"
API_KEY_VALUE=$(grep '^API_KEY=' "$ENV_FILE" | cut -d'"' -f2)
USER_ID_VALUE=$(grep '^API_USER_ID=' "$ENV_FILE" | cut -d'"' -f2)

curl -sS -m 20 -o /tmp/balance.json -w 'GET /users/%{http_code}\n' \
  "$BASE/users/$USER_ID_VALUE" -H "X-Api-Key: $API_KEY_VALUE"
cat /tmp/balance.json
echo
