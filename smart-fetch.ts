#!/usr/bin/env bun

/**
 * smart-fetch: Fetch URLs and extract only relevant content
 *
 * Usage: bun smart-fetch.ts <url> "<intent>"
 * Output: Crystallized markdown to stdout, status to stderr
 */

import { GoogleGenAI } from "@google/genai";
import FirecrawlApp from "@mendable/firecrawl-js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const SYSTEM_PROMPT = `You extract specific information from web pages.

RULES:
1. Extract ONLY content directly relevant to the stated intent
2. Preserve code blocks, commands, URLs, and technical details VERBATIM
3. Omit navigation, ads, footers, sidebars, unrelated sections
4. When uncertain whether content is relevant, INCLUDE it
5. Output clean markdown only - no wrappers, no meta-commentary, no "Here's the extracted content"`;

interface FetchMetrics {
  source: "playbooks" | "firecrawl";
  fetchTimeMs: number;
  rawChars: number;
}

interface DistillMetrics {
  distillTimeMs: number;
  distilledChars: number;
  reductionPercent: number;
}

// Minimum content threshold - below this, content is likely sparse/failed render
const MIN_CONTENT_CHARS = 3000;

// Step 1: Fetch via playbooks (free), fallback to Firecrawl API
async function fetchUrl(
  url: string,
): Promise<{ markdown: string; metrics: FetchMetrics }> {
  const startTime = Date.now();

  try {
    // Try playbooks first (free, local)
    const { stdout } = await execAsync(`playbooks get "${url}" --json`, {
      timeout: 60000, // 60s timeout
    });
    const result = JSON.parse(stdout);
    const fetchTimeMs = Date.now() - startTime;
    const contentLength = result.markdown?.trim().length ?? 0;

    // Check if content is sparse (JS-heavy page that didn't render properly)
    // Use both the isSparse flag AND a minimum content threshold
    const isSparse =
      result.report?.isSparse || contentLength < MIN_CONTENT_CHARS;

    if (isSparse) {
      console.error(
        `[smart-fetch] Playbooks returned sparse content (${contentLength} chars < ${MIN_CONTENT_CHARS}), using Firecrawl fallback`,
      );
      return await fetchWithFirecrawl(url, startTime);
    }

    console.error(
      `[smart-fetch] Fetched via playbooks in ${fetchTimeMs}ms (${contentLength} chars)`,
    );
    return {
      markdown: result.markdown,
      metrics: {
        source: "playbooks",
        fetchTimeMs,
        rawChars: contentLength,
      },
    };
  } catch (err) {
    // Playbooks failed entirely, fall back to Firecrawl
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[smart-fetch] Playbooks failed (${errorMsg}), using Firecrawl fallback`,
    );
    return await fetchWithFirecrawl(url, startTime);
  }
}

// Firecrawl fallback (~$0.01-0.02 per call)
async function fetchWithFirecrawl(
  url: string,
  startTime: number,
): Promise<{ markdown: string; metrics: FetchMetrics }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY not set - cannot use fallback");
  }

  const firecrawl = new FirecrawlApp({ apiKey });
  const result = await firecrawl.scrapeUrl(url, {
    formats: ["markdown"],
    onlyMainContent: true,
  });

  const fetchTimeMs = Date.now() - startTime;

  if (!result.success || !result.markdown) {
    throw new Error(
      `Firecrawl scrape failed: ${result.error || "unknown error"}`,
    );
  }

  console.error(
    `[smart-fetch] Fetched via Firecrawl in ${fetchTimeMs}ms (${result.markdown.length} chars)`,
  );
  return {
    markdown: result.markdown,
    metrics: {
      source: "firecrawl",
      fetchTimeMs,
      rawChars: result.markdown.length,
    },
  };
}

// Step 2: Distill via Gemini 2.5 Flash
async function distill(
  markdown: string,
  intent: string,
): Promise<{ content: string; metrics: DistillMetrics }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const startTime = Date.now();
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${SYSTEM_PROMPT}\n\nINTENT: ${intent}\n\nPAGE CONTENT:\n${markdown}`,
  });

  const distillTimeMs = Date.now() - startTime;
  const content = response.text ?? "";
  const reductionPercent = Math.round(
    (1 - content.length / markdown.length) * 100,
  );

  console.error(
    `[smart-fetch] Distilled in ${distillTimeMs}ms: ${markdown.length} → ${content.length} chars (${reductionPercent}% reduction)`,
  );

  return {
    content,
    metrics: {
      distillTimeMs,
      distilledChars: content.length,
      reductionPercent,
    },
  };
}

// Main
async function main() {
  const args = process.argv.slice(2);

  // Check for --metrics flag
  const metricsIndex = args.indexOf("--metrics");
  const showMetrics = metricsIndex !== -1;
  if (showMetrics) {
    args.splice(metricsIndex, 1);
  }

  const [url, intent] = args;

  if (!url || !intent) {
    console.error('Usage: bun smart-fetch.ts [--metrics] <url> "<intent>"');
    console.error("");
    console.error("Options:");
    console.error("  --metrics    Output JSON metrics instead of markdown");
    console.error("");
    console.error("Environment variables:");
    console.error("  GEMINI_API_KEY     Required for distillation");
    console.error("  FIRECRAWL_API_KEY  Optional, for JS-heavy page fallback");
    process.exit(1);
  }

  const totalStartTime = Date.now();

  const { markdown, metrics: fetchMetrics } = await fetchUrl(url);
  const { content, metrics: distillMetrics } = await distill(markdown, intent);

  const totalTimeMs = Date.now() - totalStartTime;

  // Handle empty distillation result
  const finalContent =
    content.trim() ||
    `[smart-fetch] No relevant content found for intent: "${intent}"\n\nThe page may not contain information about this topic, or may require authentication to access.`;

  if (showMetrics) {
    // Output JSON metrics for benchmarking
    console.log(
      JSON.stringify(
        {
          url,
          intent,
          fetch: fetchMetrics,
          distill: distillMetrics,
          totalTimeMs,
          content: finalContent,
          noRelevantContent: !content.trim(),
        },
        null,
        2,
      ),
    );
  } else {
    // Output crystallized content for the calling LLM
    console.log(finalContent);
  }
}

main().catch((err) => {
  console.error(`[smart-fetch] Error: ${err.message}`);
  process.exit(1);
});
