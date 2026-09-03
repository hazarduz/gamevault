// Epic Games Store publishes its weekly free games (current and
// upcoming) through the same static endpoint its own storefront uses:
//
//   GET https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US
//
// No key, no scraping. We include it directly (as well as via GamerPower)
// so Epic is always accurate and we can show the "coming soon" ones.
//
// Data path: data.Catalog.searchStore.elements[]. Each element has a
// `promotions` block with promotionalOffers (live) and
// upcomingPromotionalOffers (next). A discountPercentage of 0 there — or
// a discountPrice of 0 — means "free". If Epic changes the shape, open
// the URL and re-map below.

import type { FreeGame } from "@/lib/free-games";

const ENDPOINT =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

function pickImage(keyImages: any[]): string | null {
  if (!Array.isArray(keyImages)) return null;
  const order = [
    "OfferImageWide",
    "DieselStoreFrontWide",
    "Featured",
    "Thumbnail",
    "OfferImageTall",
    "DieselStoreFrontTall",
  ];
  for (const type of order) {
    const hit = keyImages.find((k) => k?.type === type && k?.url);
    if (hit) return String(hit.url);
  }
  return keyImages.find((k) => k?.url)?.url ?? null;
}

function storeUrl(el: any): string {
  const slug =
    el?.catalogNs?.mappings?.find((m: any) => m?.pageSlug)?.pageSlug ||
    el?.offerMappings?.find((m: any) => m?.pageSlug)?.pageSlug ||
    el?.productSlug ||
    el?.urlSlug ||
    "";
  const clean = String(slug).replace(/\/home$/, "").trim();
  return clean
    ? `https://store.epicgames.com/en-US/p/${clean}`
    : "https://store.epicgames.com/en-US/free-games";
}

// Epic gives the original price pre-formatted, e.g. "$19.99".
function worthOf(el: any): string | null {
  const fmt = el?.price?.totalPrice?.fmtPrice?.originalPrice;
  if (typeof fmt === "string" && fmt && !/^\$?0(\.00)?$/.test(fmt)) return fmt;
  const cents = Number(el?.price?.totalPrice?.originalPrice ?? 0);
  return cents > 0 ? `$${(cents / 100).toFixed(2)}` : null;
}

// `offers` is promotions.promotionalOffers or .upcomingPromotionalOffers
// — an array of { promotionalOffers: [{ startDate, endDate,
// discountSetting: { discountPercentage } }] }.
function freeWindow(
  offers: any
): { startsAt: string | null; endsAt: string | null } | null {
  const offer = offers?.[0]?.promotionalOffers?.[0];
  if (!offer) return null;
  const pct = offer?.discountSetting?.discountPercentage;
  // Epic encodes 100%-off as discountPercentage 0. Treat missing as ok
  // too — the endpoint only lists promo-eligible titles.
  if (pct != null && pct !== 0) return null;
  return {
    startsAt: offer?.startDate ? new Date(offer.startDate).toISOString() : null,
    endsAt: offer?.endDate ? new Date(offer.endDate).toISOString() : null,
  };
}

async function fetchOnce(): Promise<FreeGame[]> {
  const res = await fetch(ENDPOINT, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Epic promotions returned ${res.status}.`);

  const json: any = await res.json();
  const elements: any[] =
    json?.data?.Catalog?.searchStore?.elements ??
    json?.data?.catalog?.searchStore?.elements ??
    [];

  const out: FreeGame[] = [];
  for (const el of elements) {
    const title = String(el?.title ?? "").trim();
    if (!title) continue;

    // A current 0%-discount promo means it's free to claim now. Epic's
    // weekly free games always carry one, so this is the precise test —
    // don't fall back to discountPrice, which also matches permanently
    // free titles the endpoint sometimes includes.
    const live = freeWindow(el?.promotions?.promotionalOffers);
    const upcoming = freeWindow(el?.promotions?.upcomingPromotionalOffers);

    if (!live && !upcoming) continue;

    const isLiveFree = live != null;
    const win = isLiveFree ? live! : upcoming!;

    out.push({
      id: `epic:${el?.id ?? title}`,
      title,
      store: "Epic Games",
      platformsLabel: "Epic Games Store",
      url: storeUrl(el),
      imageUrl: pickImage(el?.keyImages),
      description: String(el?.description ?? "").trim() || null,
      worth: worthOf(el),
      startsAt: win.startsAt,
      endsAt: win.endsAt,
      type: "game",
      status: isLiveFree ? "live" : "upcoming",
      source: "epic",
    });
  }
  return out;
}

export function fetchEpicFree(): Promise<FreeGame[]> {
  return withTimeout(fetchOnce(), 15_000, "Epic free games");
}
