# Global Grant — Rotary Proposal Generator

Single-click generator that drafts a Rotary Global Grant project overview from a
short form, using the Kimi API.

**Live: <https://audiocrave-hash.github.io/GlobalGrant/>** — bring your own Kimi
API key. It is stored in your browser only and sent nowhere except to Kimi.

## Two ways to run it

| | Key held by | Needs a server |
| --- | --- | --- |
| **Hosted page** (link above) | each visitor, in their own browser | no |
| **Locally with the proxy** | `kimi_api_key.txt` on your machine | yes, Node |

The page uses the proxy when it can see one on `localhost:3000`, and otherwise
falls back to calling Kimi directly with the visitor's key. Same file either way.

## Local setup

1. **Add your API key.** Create `kimi_api_key.txt` next to `kimi_proxy_server.cjs`
   containing just the key, or set the `KIMI_API_KEY` environment variable. Get a
   key at <https://platform.kimi.ai/console/api-keys>. The file is gitignored —
   never commit the key or put it in the HTML, where every visitor would see it.

2. **Start the proxy** (keep it running):

   ```bash
   node kimi_proxy_server.cjs
   ```

3. **Serve the page over HTTP** — opening it as `file://` blocks the request to
   `localhost:3000`:

   ```bash
   python -m http.server 8000
   ```

4. Open <http://localhost:8000/>. The header should read
   "Proxy Server Connected". Fill in the form and click **Generate Overview**.

## Why the proxy exists

Not for CORS, despite what the older notes in this repo say. `api.moonshot.ai`
returns `Access-Control-Allow-Origin` for browser origins, so a page can call it
directly — the original "CORS error" was actually the hostname
`api.kimi.moonshot.cn` failing to resolve, which the browser reports the same way.

The proxy's real job is to hold the API key server-side, so that a shared or
deployed page does not hand your key to everyone who loads it. Run it locally and
nobody using your machine needs a key of their own.

## API notes

These cost real time to rediscover, so they are recorded here:

- **Endpoint** is `https://api.moonshot.ai/v1/chat/completions` for keys issued by
  **platform.kimi.ai**. `api.moonshot.cn` is the separate China platform and
  rejects these keys with 401; `api.kimi.moonshot.cn` does not resolve at all.
- **Model** names are `kimi-k2.6`, `kimi-k3`, `kimi-k2.7-code`. The older
  `moonshot-v1-*` names do not exist on this platform.
- **Temperature** must be `1`; anything else returns 400.
- **max_tokens** must be generous (8000 here). These are reasoning models and the
  reasoning is charged against the budget — at 1500 the whole allowance was spent
  before the answer began, returning HTTP 200 with `finish_reason: "length"` and
  empty content.
- `kimi-k3` reasons heavily and returned nothing usable for this task;
  `kimi-k2.6` is the one to use for prose.

The proxy overrides model, temperature and max_tokens on every request, so the
page cannot reintroduce those failures.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The form and proposal output |
| `kimi_proxy_server.cjs` | Local CORS proxy; holds the API key |
| `kimi_diagnostics.html` | Connectivity, key and CORS tests |
| `FIX_API_ERROR.md` | Troubleshooting walkthrough |

The proxy is `.cjs` rather than `.js` on purpose — it uses `require`, and a parent
`package.json` marking `"type": "module"` would otherwise break it.
