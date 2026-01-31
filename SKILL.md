---
name: smart-fetch
description: Use when user provides a URL and indicates an intent about its content. Fetches and distills web pages to extract only relevant information. Triggers: URL, intent + URL, "smart-fetch", "what does this page say about..."
---

# smart-fetch

Fetch URLs and extract only the relevant information. Uses playbooks (free) with Firecrawl fallback, then distills via Gemini 2.5 Flash.

## When to Use

- User provides URL + specific question about its content
- "smart-fetch this page"
- "get the relevant parts from..."
- "what does this documentation say about..."
- Any URL where you only need specific information, not the full page

## When NOT to Use

- User wants full page content (use WebFetch or firecrawl_scrape)
- Need structured data extraction (use firecrawl_extract)

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- [playbooks](https://github.com/anthropics/playbooks) CLI (for free fetching)

### Install globally

```bash
bun install -g github:celebi/agent-web-suite/smart-fetch
```

### Or clone and install

```bash
git clone https://github.com/celebi/agent-web-suite.git
cd agent-web-suite/smart-fetch
bun install
```

## Environment Variables

Set these in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# Required - for content distillation
export GEMINI_API_KEY="your-gemini-api-key"

# Optional - fallback for JS-heavy pages
export FIRECRAWL_API_KEY="your-firecrawl-api-key"
```

After adding, restart your terminal or run `source ~/.zshrc`.

**Cursor users:** If you launched Cursor from Dock/Spotlight, restart Cursor to pick up new env vars.

## Usage

```bash
smart-fetch "<url>" "<intent>"
```

**Parameters:**

- `url`: The webpage to fetch
- `intent`: What information you need (be specific for best results)

**Output:** Crystallized markdown to stdout. Status messages go to stderr.

**Benchmarking:**

```bash
smart-fetch --metrics "<url>" "<intent>"
```

Returns JSON with timing and size metrics.

## Examples

```bash
# Extract auth setup from API docs
smart-fetch "https://docs.stripe.com/api/authentication" \
  "how to authenticate API requests with examples"

# Get specific function documentation
smart-fetch "https://lodash.com/docs/4.17.15" \
  "debounce function parameters and usage example"

# Extract installation steps
smart-fetch "https://bun.sh/docs/installation" \
  "installation commands for macOS"
```

## Intent Tips

Be specific with intent for best results:

- Bad: "API docs"
- Good: "authentication methods and code examples for API key setup"
- Bad: "how to use"
- Good: "installation steps and configuration options for macOS"

## Follow-Up Fetching

When the distilled response contains links to related pages (e.g., "[see X for details]"),
you can call smart-fetch again on those URLs if deeper context is needed.

**Pattern:**

1. First call: Get overview for user's question
2. Review response — are there linked URLs pointing to required details?
3. If yes → call smart-fetch on the specific link(s)
4. If no → respond to user

This is expected behavior. Do not hesitate to chain calls when the user's question
requires information from linked pages.

## Cost

- Playbooks fetch: FREE
- Firecrawl fallback: ~$0.01-0.02 (only when needed)
- Gemini 2.5 Flash: ~$0.003 per 10KB page

Typical: ~$3/month at 500 fetches.

## Troubleshooting

| Error                                             | Cause                                 | Fix                                        |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------ |
| `GEMINI_API_KEY not set`                          | Env var missing                       | Add to `~/.zshrc`, restart terminal/Cursor |
| `FIRECRAWL_API_KEY not set - cannot use fallback` | JS-heavy page, no fallback configured | Add Firecrawl key or use different URL     |
| Sparse content warning                            | Page requires JS rendering            | Firecrawl fallback will handle it          |
