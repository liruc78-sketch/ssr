// ============================================================================
// Crypto.ssr — news edge function.
// Fetches real, current crypto news server-side (no browser CORS limits) and
// returns a normalized, de-duplicated, freshest-first list. Each item carries
// the article's real external URL so the client links straight to the publisher.
// Sources: CryptoCompare API + a spread of publisher RSS feeds, fetched in
// parallel with a per-feed timeout so one slow/broken source can't stall the rest.
//   GET -> { ok, count, sources: string[], articles: [{ id, title, url, source, published, body, image, categories }] }
// ============================================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Article = {
  id: string; title: string; url: string; source: string;
  published: number; body: string; image: string; categories: string[];
};

const clean = (s: string) => (s || "").replace(/\s+/g, " ").trim();
const TIMEOUT_MS = 6000;

// --- CryptoCompare API ------------------------------------------------------
async function fromCryptoCompare(): Promise<Article[]> {
  try {
    const r = await fetch(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&extraParams=cryptossr",
      { headers: { "User-Agent": "cryptossr/1.0 (+https://cryptossr.com)" }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);
    const data = j && Array.isArray(j.Data) ? j.Data : [];
    return data.slice(0, 30).map((a: any): Article => ({
      id: String(a.id ?? a.guid ?? a.url),
      title: clean(a.title),
      url: a.url,
      source: clean(a.source_info?.name || a.source || "News"),
      published: a.published_on ? a.published_on * 1000 : Date.now(),
      body: clean(a.body).slice(0, 400),
      image: a.imageurl || "",
      categories: String(a.categories || "").split("|").map((c: string) => clean(c)).filter(Boolean).slice(0, 3),
    })).filter((a: Article) => a.title && a.url);
  } catch (_e) { return []; }
}

// --- Publisher RSS ----------------------------------------------------------
const RSS_FEEDS = [
  { url: "https://cointelegraph.com/rss", name: "Cointelegraph" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml", name: "CoinDesk" },
  { url: "https://decrypt.co/feed", name: "Decrypt" },
  { url: "https://cryptoslate.com/feed/", name: "CryptoSlate" },
  { url: "https://bitcoinist.com/feed/", name: "Bitcoinist" },
  { url: "https://www.newsbtc.com/feed/", name: "NewsBTC" },
  { url: "https://beincrypto.com/feed/", name: "BeInCrypto" },
  { url: "https://cryptopotato.com/feed/", name: "CryptoPotato" },
  { url: "https://u.today/rss", name: "U.Today" },
  { url: "https://ambcrypto.com/feed/", name: "AMBCrypto" },
  { url: "https://cryptobriefing.com/feed/", name: "Crypto Briefing" },
  { url: "https://coinjournal.net/feed/", name: "CoinJournal" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")                                          // undo one level of double-encoding first
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, n) => safeCp(parseInt(n, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…");
}
function safeCp(n: number): string { try { return String.fromCodePoint(n); } catch { return ""; } }

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return "";
  const inner = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");
  return clean(decodeEntities(inner));
}

async function fetchFeed(f: { url: string; name: string }): Promise<Article[]> {
  try {
    const r = await fetch(f.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cryptossr/1.0)", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    const out: Article[] = [];
    for (const block of items.slice(0, 10)) {
      const title = tag(block, "title");
      let link = tag(block, "link");
      if (!link) { const m = block.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; } // atom <link href=.../>
      if (!title || !link) continue;
      const pub = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
      out.push({
        id: link,
        title,
        url: link,
        source: f.name,
        published: pub ? (Date.parse(pub) || Date.now()) : Date.now(),
        body: tag(block, "description") || tag(block, "summary"),
        image: "",
        categories: [],
      });
    }
    return out.map((a) => ({ ...a, body: a.body.slice(0, 400) }));
  } catch (_e) { return []; }
}

async function fromRss(): Promise<Article[]> {
  const settled = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
  const all: Article[] = [];
  for (const s of settled) if (s.status === "fulfilled") all.push(...s.value);
  return all;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), {
      status: s,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
    });

  try {
    const [cc, rss] = await Promise.all([fromCryptoCompare(), fromRss()]);
    // Merge all sources, drop dupes by URL, newest first.
    const seen = new Set<string>();
    const merged = [...cc, ...rss].filter((a) => {
      if (!a.url || !a.title || seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
    merged.sort((a, b) => b.published - a.published);
    const articles = merged.slice(0, 60);
    const sources = [...new Set(articles.map((a) => a.source))];
    return json({ ok: true, count: articles.length, sources, articles });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e), articles: [] });
  }
});
