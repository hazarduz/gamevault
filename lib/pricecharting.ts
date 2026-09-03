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
// Price extraction parses the actual `#price_data` table rather than the
// flattened page text. The flat-text approach broke because the table
// renders every column header first (Loose / Complete / New / Graded /
// Box Only / Manual Only) and only then the row of values, so a regex
// looking for "<label> ... $<amount>" would span the wrong distance and
// grab another column's price — or nothing.
//
// The table structure this relies on (stable for years):
//
//   <table id="price_data">
//     <tbody><tr>
//       <td id="used_price">    <span class="price js-price">$22.24</span>
//                               <span class="change">-<span class="js-price">$2.91</span></span> </td>
//       <td id="complete_price"><span class="price js-price">$25.15</span> ... </td>
//       <td id="new_price">     <span class="price js-price">$43.26</span> ... </td>
//       ...
//
// "used_price" is PriceCharting's term for what collectors call loose,
// "complete_price" is CIB. A price point with no data shows "-". If a
// lookup stops working, open a product page and check whether those cell
// ids and the `span.price` inside them still exist.

export interface PriceChartingResult {
  productUrl: string;
  title: string;
  loose: number | null;
  cib: number | null;
  new: number | null;
}

// Pulls a USD amount out of "$22.24", "$1,120.00", " $43.26 ", etc.
// Returns null for "-", empty strings, unparseable text, and $0.00
// (PriceCharting uses zero/"-" interchangeably for "no data" — it never
// legitimately sells a game for nothing).
function parseUsd(raw: string): number | null {
  const match = raw.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Reads one price cell (#used_price / #complete_price / #new_price) from
// the parsed page. The current price is the first <span class="price">
// in the cell; the "± since last update" figure is a sibling
// <span class="change"> and must not be picked up.
function priceFromCell($: cheerio.CheerioAPI, cellId: string): number | null {
  const cell = $(`#${cellId}`);
  if (cell.length === 0) return null;

  const priceSpan = cell.find("span.price").first().text().trim();
  if (priceSpan) return parseUsd(priceSpan);

  // Fallback if the inner markup ever changes: use the cell's own text
  // with the change figure stripped out.
  const clone = cell.clone();
  clone.find("span.change").remove();
  return parseUsd(clone.text().trim());
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

  // No price table means this isn't a usable product page — PriceCharting
  // sometimes serves a 200 for near-miss slugs. Treat it like a 404 so
  // the caller falls through to the search strategy.
  if ($("#price_data").length === 0) return null;

  const title = $("h1").first().text().trim() || $("title").text().trim();

  return {
    productUrl: url,
    title,
    loose: priceFromCell($, "used_price"),
    cib: priceFromCell($, "complete_price"),
    new: priceFromCell($, "new_price"),
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

  // Prefer a link from the results table; fall back to any product link
  // on the page. (A single exact match redirects straight to the product
  // page, which parsePricesFromProductPage handles on its own.)
  const firstProductLink =
    $('#games_table a[href^="/game/"]').first().attr("href") ||
    $('a[href^="/game/"]').first().attr("href");
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
