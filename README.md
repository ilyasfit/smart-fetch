# smart-fetch

Fetch URLs and extract only what matters. For AI agents.

> **57KB page → 10KB. 81% reduction. $0.01 vs $0.07.**

## Why

AI agents waste tokens on irrelevant web content. The OpenAI chat completions docs are 57KB of markdown—but you only need the `messages` parameter format.

smart-fetch distills pages to just the content matching your intent:

- **77% average context reduction**
- **50-84% cheaper** than feeding raw markdown to Claude Opus
- **Free fetching** via playbooks, Firecrawl fallback for JS-heavy sites
- **Preserves code verbatim** xno hallucinated examples

## Quick Start

```bash
# Install
bun install -g github:celebi/agent-web-suite/smart-fetch

# Use
smart-fetch "https://docs.stripe.com/api/authentication" "how to authenticate with API keys"
```

## Benchmarks

Real results from production documentation sites:

| Page                    | Raw    | Distilled | Reduction | Time  |
| ----------------------- | ------ | --------- | --------- | ----- |
| OpenAI chat completions | 56.9KB | 10.7KB    | **81%**   | 11.2s |
| React useState          | 30.8KB | 5.5KB     | **82%**   | 7.1s  |
| GitHub REST auth        | 12.5KB | 4.1KB     | **67%**   | 14.3s |
| Stripe API auth         | 10.4KB | 1.4KB     | **86%**   | 5.6s  |
| Bun installation        | 4.3KB  | 263B      | **94%**   | 5.2s  |

**Average: 77% reduction in 7.4s**

See [BENCHMARK.md](../BENCHMARK.md) for full analysis including cost breakdowns.

## Cost

### Per-fetch breakdown

| Component                           | Cost             |
| ----------------------------------- | ---------------- |
| playbooks fetch                     | Free             |
| Firecrawl fallback (JS-heavy pages) | ~$0.015          |
| Gemini 2.5 Flash distillation       | ~$0.003 per 10KB |

### 500 pages/month comparison

Based on benchmark averages: 17.3KB raw → 3.5KB distilled (77% reduction)

**Without smart-fetch** (full markdown → Opus):

```
500 pages × 4,325 tokens avg = 2.16M input tokens
2.16M × $15/1M (Opus) = $32.44
```

**With smart-fetch** (distilled → Opus):

```
Gemini input  (reads full):     2.16M × $0.30/1M  = $0.65
Gemini output (distilled):      437K  × $2.50/1M  = $1.09
Opus input    (reads distilled): 437K  × $15/1M   = $6.56
                                          Total   = $8.30
```

| Approach             | Monthly cost     | Tokens to Opus   |
| -------------------- | ---------------- | ---------------- |
| Full markdown → Opus | $32.44           | 2.16M            |
| **smart-fetch**      | **$8.30**        | 437K             |
| **Savings**          | **$24.14 (74%)** | **1.72M tokens** |

The context window savings compound: those 1.72M tokens saved are tokens you're not paying for on every subsequent turn in your conversation.

## How It Works

```
URL + Intent
     ↓
playbooks fetch (free)
     ↓
[sparse content?] → Firecrawl fallback ($0.015)
     ↓
Gemini 2.5 Flash distillation (~$0.003/10KB)
     ↓
Crystallized markdown (stdout)
```

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- [playbooks](https://github.com/anthropics/playbooks) CLI (for free fetching)

### Install

```bash
bun install -g github:celebi/agent-web-suite/smart-fetch
```

Or clone:

```bash
git clone https://github.com/celebi/agent-web-suite.git
cd agent-web-suite/smart-fetch
bun install
```

### Environment Variables

```bash
# Required - for content distillation
export GEMINI_API_KEY="your-gemini-api-key"

# Optional - fallback for JS-heavy pages
export FIRECRAWL_API_KEY="your-firecrawl-api-key"
```

## Usage

```bash
smart-fetch "<url>" "<intent>"
```

Output goes to stdout. Status messages go to stderr.

### Examples

```bash
# Extract auth setup from API docs
smart-fetch "https://docs.stripe.com/api/authentication" \
  "how to authenticate API requests with examples"

# Get specific function documentation
smart-fetch "https://react.dev/reference/react/useState" \
  "useState parameters, return value, and usage example"

# Extract installation steps
smart-fetch "https://bun.sh/docs/installation" \
  "installation commands for macOS"
```

### Intent Tips

Specificity drives reduction quality:

| Bad          | Good                                                         |
| ------------ | ------------------------------------------------------------ |
| "API docs"   | "authentication methods and code examples for API key setup" |
| "how to use" | "installation steps and configuration options for macOS"     |

### Benchmarking

```bash
smart-fetch --metrics "<url>" "<intent>"
```

Returns JSON with timing, size metrics, and `noRelevantContent` flag.

## Agent Integration

For Cursor or Claude Desktop, see [SKILL.md](SKILL.md) for agent skill configuration that auto-triggers on URL + intent patterns.

## Troubleshooting

| Error                                             | Cause                      | Fix                                      |
| ------------------------------------------------- | -------------------------- | ---------------------------------------- |
| `GEMINI_API_KEY not set`                          | Missing env var            | Add to `~/.zshrc`, restart terminal      |
| `FIRECRAWL_API_KEY not set - cannot use fallback` | JS-heavy page, no fallback | Add Firecrawl key or try different URL   |
| Sparse content warning                            | Page requires JS rendering | Firecrawl fallback handles automatically |

## License

MIT
