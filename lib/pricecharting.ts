import * as cheerio from "cheerio";
import { pricechartingConsoleSlug, slugifyTitle } from "@/lib/platforms";

// PriceCharting's real official API requires a paid subscription, so
// this scrapes their public pages instead. Two lookup strategies:
//
// 1. Guess the direct product URL — PriceCharting uses a predictable
//    pattern: pricecharting.com/game/<console-slug>/<title-slug>. This
//    works for most "plain" titles.
// 2. If that 404s (special editions, subtitles that don't slugify
//    cleanly, etc.), fall back to their search page and take the first
//    result link.
//
// Price extraction reads the visible text near the "Loose Price" /
// "Complete Price" / "New Price" labels rather than relying on specific
// CSS classes or ids, since label wording is more stable over time than
// markup structure — but this can still break if PriceCharting changes
// their page. If a lookup stops working, that's the first thing to
// check: open a product page in a browser and see whether those three
// labels still appear as plain text near the current prices.

export interface PriceChartingResult {
  productUrl: string;
  title: string;
  loose: number | null;
  cib: number | null;
  new: number | null;
}

function extractPriceNear(flatText: string, label: string): number | null {
  // Matches the label followed (allowing a little intervening text/markup
  // collapse) by the first dollar amount — that's always the current
  // price; PriceCharting shows a "±$x.xx" change amount right after it,
  // which this intentionally ignores by only taking the first match.
  const re = new RegExp(`${label}[^$]{0,40}\\$([\\d,]+\\.\\d{2})`, "i");
  const match = flatText.match(re);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

async function parsePricesFromProductPage(
  url: string
): Promise<PriceChartingResult | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (personal collection tool)" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PriceCharting page failed (${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || $("title").text().trim();
  const flatText = $("body").text().replace(/\s+/g, " ");

  return {
    productUrl: url,
    title,
    loose: extractPriceNear(flatText, "Loose Price"),
    cib: extractPriceNear(flatText, "Complete Price"),
    new: extractPriceNear(flatText, "New Price"),
  };
}

async function searchProductUrl(
  title: string,
  platform: string
): Promise<string | null> {
  const searchUrl = `https://www.pricecharting.com/search-products?type=videogames&q=${encodeURIComponent(
    `${title} ${platform}`
  )}`;

  const res = await fetch(searchUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (personal collection tool)" },
  });
  if (!res.ok) throw new Error(`PriceCharting search failed (${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Any link to a product page matches this pattern regardless of which
  // table/list markup wraps it, which is more resilient than depending
  // on a specific table id.
  const firstProductLink = $('a[href^="/game/"]').first().attr("href");
  if (!firstProductLink) return null;

  return firstProductLink.startsWith("http")
    ? firstProductLink
    : `https://www.pricecharting.com${firstProductLink}`;
}

export async function findPriceChartingMatch(
  title: string,
  platform: string,
  region?: string | null
): Promise<PriceChartingResult | null> {
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  if (!settings.priceChartingEnabled) {
    throw new Error("PriceCharting lookups are turned off in Settings.");
  }

  // Strategy 1: guess the direct URL.
  const consoleSlug = pricechartingConsoleSlug(platform, region);
  if (consoleSlug) {
    const guessedUrl = `https://www.pricecharting.com/game/${consoleSlug}/${slugifyTitle(title)}`;
    const direct = await parsePricesFromProductPage(guessedUrl);
    if (direct && (direct.loose !== null || direct.cib !== null || direct.new !== null)) {
      return direct;
    }
  }

  // Strategy 2: fall back to search.
  const foundUrl = await searchProductUrl(title, platform);
  if (!foundUrl) return null;

  return parsePricesFromProductPage(foundUrl);
}

export async function usdToGbp(amountUsd: number | null): Promise<number | null> {
  if (amountUsd === null) return null;

  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();

  const endpoint =
    settings.currencyApiUrl ||
    process.env.EXCHANGE_RATE_API ||
    "https://api.exchangerate.host/latest?base=USD&symbols=GBP";

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    const rate = data?.rates?.GBP;
    if (!rate) return null;
    return Math.round(amountUsd * rate * 100) / 100;
  } catch {
    // If the currency API is unreachable, don't fail the whole request —
    // just skip conversion and let the user set the GBP value manually.
    return null;
  }
}
