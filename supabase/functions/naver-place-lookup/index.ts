type PlaceResult = {
  id: string;
  name?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  phone?: string;
  image?: string;
  hours?: string;
  lat?: number;
  lng?: number;
  naverUrl: string;
  sourceStatus: "complete" | "partial" | "failed";
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const cache = new Map<string, PlaceResult>();

function textResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function decodeHtml(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return undefined;
}

function toNumber(value?: string) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function pickCoordinate(text: string, keys: string[]) {
  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`"${escapedKey}"\\s*:\\s*"([0-9.]+)"`),
      new RegExp(`"${escapedKey}"\\s*:\\s*([0-9.]+)`),
      new RegExp(`\\\\?"${escapedKey}\\\\?"\\s*:\\s*\\\\?"([0-9.]+)\\\\?"`),
    ];
    const value = findFirst(text, patterns);
    const number = toNumber(value);
    if (number) return number;
  }
  return undefined;
}

function parsePlace(id: string, html: string): PlaceResult {
  const title = findFirst(html, [
    /<title>([^<]+)<\/title>/i,
    /"name"\s*:\s*"([^"]+)"/,
    /\\"name\\"\s*:\s*\\"([^"]+)\\"/,
    /"displayName"\s*:\s*"([^"]+)"/,
  ]);
  const name = title
    ?.replace(/\s*:\s*네이버.*$/i, "")
    .replace(/\s*-\s*NAVER.*$/i, "")
    .trim();

  const lng = pickCoordinate(html, ["x", "lng", "longitude"]);
  const lat = pickCoordinate(html, ["y", "lat", "latitude"]);
  const roadAddress = findFirst(html, [
    /"roadAddress"\s*:\s*"([^"]+)"/,
    /\\"roadAddress\\"\s*:\s*\\"([^"]+)\\"/,
    /"roadAddressName"\s*:\s*"([^"]+)"/,
  ]);
  const address = findFirst(html, [
    /"address"\s*:\s*"([^"]+)"/,
    /\\"address\\"\s*:\s*\\"([^"]+)\\"/,
    /"jibunAddress"\s*:\s*"([^"]+)"/,
  ]);
  const phone = findFirst(html, [
    /"phone"\s*:\s*"([^"]+)"/,
    /\\"phone\\"\s*:\s*\\"([^"]+)\\"/,
    /"virtualPhone"\s*:\s*"([^"]+)"/,
  ]);
  const category = findFirst(html, [
    /"category"\s*:\s*"([^"]+)"/,
    /\\"category\\"\s*:\s*\\"([^"]+)\\"/,
    /"categoryName"\s*:\s*"([^"]+)"/,
  ]);

  return {
    id,
    name,
    category,
    address,
    roadAddress,
    phone,
    lat,
    lng,
    naverUrl: `https://map.naver.com/p/entry/place/${encodeURIComponent(id)}`,
    sourceStatus: lat && lng ? "complete" : "partial",
  };
}

async function fetchPlaceSummary(id: string): Promise<PlaceResult | null> {
  try {
    const response = await fetch(`https://map.naver.com/p/api/place/summary/${encodeURIComponent(id)}`, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://map.naver.com/",
        "User-Agent": "Mozilla/5.0 (compatible; HUHUHouseGuide/1.0)",
      },
    });
    if (!response.ok) return null;

    const json = await response.json();
    const detail = json?.data?.placeDetail;
    if (!detail) return null;

    return {
      id,
      name: detail.name,
      category: detail.category?.category,
      address: detail.address?.address,
      roadAddress: detail.address?.roadAddress,
      image: detail.images?.images?.[0]?.origin,
      hours: detail.businessHours?.description,
      lat: detail.coordinate?.latitude,
      lng: detail.coordinate?.longitude,
      naverUrl: `https://map.naver.com/p/entry/place/${encodeURIComponent(id)}`,
      sourceStatus: detail.coordinate?.latitude && detail.coordinate?.longitude ? "complete" : "partial",
    };
  } catch {
    return null;
  }
}

async function fetchPlace(id: string): Promise<PlaceResult> {
  if (cache.has(id)) return cache.get(id)!;

  const summary = await fetchPlaceSummary(id);
  if (summary?.name || (summary?.lat && summary?.lng)) {
    cache.set(id, summary);
    return summary;
  }

  const urls = [
    `https://pcmap.place.naver.com/place/${encodeURIComponent(id)}/home`,
    `https://pcmap.place.naver.com/restaurant/${encodeURIComponent(id)}/home`,
    `https://m.place.naver.com/place/${encodeURIComponent(id)}/home`,
    `https://map.naver.com/p/entry/place/${encodeURIComponent(id)}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "User-Agent": "Mozilla/5.0 (compatible; HUHUHouseGuide/1.0)",
        },
      });

      if (!response.ok) continue;
      const html = await response.text();
      const result = parsePlace(id, html);
      if (result.name || (result.lat && result.lng)) {
        cache.set(id, result);
        return result;
      }
    } catch {
      // Try the next public Naver place URL shape.
    }
  }

  const failed: PlaceResult = {
    id,
    naverUrl: `https://map.naver.com/p/entry/place/${encodeURIComponent(id)}`,
    sourceStatus: "failed",
    error: "Naver place data could not be resolved from the place id.",
  };
  cache.set(id, failed);
  return failed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return textResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];

    if (!ids.length) return textResponse({ places: [] });

    const uniqueIds = [...new Set(ids)].slice(0, 50);
    const places = await Promise.all(uniqueIds.map(fetchPlace));
    return textResponse({ places });
  } catch (error) {
    return textResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 400);
  }
});
