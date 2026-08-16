# Global Grant — Rotary Proposal Generator

A single-page tool that drafts a Rotary Global Grant project overview from a short form, using
the Kimi (Moonshot AI) chat completions API.

**Live:** <https://audiocrave-hash.github.io/GlobalGrant/> — bring your own Kimi API key. It's
stored in the browser only and sent nowhere except to Kimi.

## Purpose

Rotary Global Grant applications require a written project overview in a fairly fixed format.
This tool takes a short structured form (project details, community need, sustainability plan,
etc.) and asks Kimi to draft that overview, so the applicant starts from a draft instead of a
blank page.

## Features

- **Form-to-draft generation** — structured intake form, one click produces a full project
  overview draft
- **Two run modes, same file** — a hosted static page where each visitor supplies their own API
  key (stored client-side only), or a local Node proxy that holds the key server-side so nobody
  using the machine needs their own key
- **Built-in diagnostics** — `kimi_diagnostics.html` checks connectivity, key validity, and CORS
  independently of the main form
- **Locked-down proxy config** — the local proxy overrides model, temperature, and `max_tokens`
  on every request, so the page can't reintroduce the specific failure modes documented below

## Tech Stack

- **Frontend:** Plain HTML/CSS/JS, no framework or build step
- **Local proxy (optional):** Node.js (`.cjs`, no dependencies beyond the standard library)
- **AI:** Kimi (Moonshot AI) chat completions API, `platform.kimi.ai`
- **Hosting:** GitHub Pages (the hosted page); Node locally for the proxy mode

## Running Locally

The page auto-detects a local proxy on `localhost:3000` and falls back to calling Kimi directly
with the visitor's own key if none is running.

```bash
# 1. Add your API key — create kimi_api_key.txt next to kimi_proxy_server.cjs
#    containing just the key (gitignored), or set KIMI_API_KEY in the environment.
#    Get a key at https://platform.kimi.ai/console/api-keys

# 2. Start the proxy (keep it running)
node kimi_proxy_server.cjs

# 3. Serve the page over HTTP — opening it as file:// blocks the request to localhost:3000
python -m http.server 8000
```

Open <http://localhost:8000/>; the header should read "Proxy Server Connected".

### Notes worth keeping (from hard-won API debugging)

- Endpoint is `https://api.moonshot.ai/v1/chat/completions` for keys issued by
  `platform.kimi.ai` — `api.moonshot.cn` is a separate China platform that rejects these keys,
  and `api.kimi.moonshot.cn` doesn't resolve at all.
- Model names are `kimi-k2.6`, `kimi-k3`, `kimi-k2.7-code` — the older `moonshot-v1-*` names
  don't exist on this platform. `kimi-k2.6` is the one used here for prose; `kimi-k3` reasons
  heavily and returned nothing usable for this task.
- `temperature` must be `1`; anything else returns `400`.
- `max_tokens` must be generous (8000 here) — these are reasoning models and the reasoning is
  charged against the budget, so a low value can exhaust it before the answer starts, returning
  HTTP 200 with `finish_reason: "length"` and empty content.

## Status

**Active — hosted and working.** Live on GitHub Pages; the local-proxy path is a secondary mode
for anyone who wants the API key held server-side instead of per-visitor.

## License

No open-source license has currently been assigned.
