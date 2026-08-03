import fetch from "node-fetch";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

export interface MemeResult {
  title: string,
  link: string,
  thumbnail: { url: string, alt: string },
  summary?: string,
  views: number | null,
  nsfw: boolean,
  year: number | null,
  origin: string | null,
  region: string | null
}

export interface SearchResults {
  query: string,
  totalResults: number,
  results: MemeResult[]
}

export type SectionBlock =
  | { type: "text"; text: string }
  | { type: "quote"; text: string }
  | { type: "image"; url: string; alt: string; nsfw: boolean; pageUrl?: string }
  | { type: "video"; url: string };

export interface MemeSection {
  title: string,
  level: number,
  contents: SectionBlock[]
}

export interface MemeDetails {
  title: string,
  link: string,
  image: { url: string, alt: string },
  views: number | null,
  body: string,
  sections: MemeSection[],
  googleTrendsUrl: string | null,
  imgflipUrl: string | null,
  type: string[] | null,
  year: string | null,
  origin: string | null,
  region: string | null,
  tags: string[] | null
}

const BASE_URL = "https://knowyourmeme.com/search";
const SITE_URL = "https://knowyourmeme.com";

const STOP_HEADINGS = new Set([
  "search interest",
  "external references",
  "meme trends",
]);

/**
 * Search for memes on KnowYourMeme.com
 * @param query - The search query string
 * @param max - Maximum number of results to return (default = 10)
 * @returns Promise resolving to SearchResults
 */
export async function search(
  query: string,
  max = 10
): Promise<SearchResults> {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    const results: MemeResult[] = [];
    let totalResults = 0;
    let offset = 0;

    while (results.length < max) {
      const params = new URLSearchParams({ q: query });
      if (offset > 0) params.set("offset", String(offset));

      const response = await fetch(`${BASE_URL}?${params.toString()}`, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const data = await response.json() as any;

      totalResults = typeof data?.total_results === "number" ? data.total_results : results.length;

      const groups: unknown[] = Array.isArray(data?.groups) ? data.groups : [];
      const items: any[] = [];
      for (const group of groups) {
        const groupItems = (group as { items?: unknown[] })?.items;
        if (Array.isArray(groupItems)) items.push(...groupItems);
      }

      if (items.length === 0) break;

      for (const item of items) {
        if (results.length >= max) break;
        results.push(mapSearchItem(item));
      }

      if (items.length < 16 || results.length >= totalResults) break;

      const last = items[items.length - 1];
      offset = (typeof last?.offset === "number" ? last.offset : offset) + 1;
    }

    return { query, totalResults, results };
  } catch (err) {
    console.error("Searching failed: " + (err as Error).message);
    return { query, totalResults: 0, results: [] };
  }
}

function mapSearchItem(item: any): MemeResult {
  const result: MemeResult = {
    title: item?.title ?? item?.censored_title ?? "",
    link: SITE_URL + (item?.link ?? ""),
    thumbnail: { url: item?.image ?? "", alt: item?.alt ?? "" },
    views: typeof item?.views_count === "number" ? item.views_count : null,
    nsfw: Boolean(item?.nsfw),
    year: typeof item?.year === "number" ? item.year : null,
    origin: item?.origin || null,
    region: item?.region || null,
  };
  if (item?.summary) result.summary = item.summary;
  return result;
}

/**
 * Get details of a meme on KnowYourMeme.com
 * @param url - The URL to the meme page
 * @returns Promise of MemeDetails
 */
export async function getMeme(url: string): Promise<MemeDetails | null> {
  try {
    if (!url.trim().startsWith("https://knowyourmeme.com")) {
      console.error("Please enter a valid KnowYourMeme.com URL!");
      return null;
    }
    const response = await fetch(url.trim(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const data = await response.text();

    const $ = cheerio.load(data);

    const result: MemeDetails = { title: "", link: "", image: { url: "", alt: "" }, views: null, body: "", sections: [], googleTrendsUrl: null, imgflipUrl: null, type: null, year: null, origin: null, region: null, tags: null };

    const info = $("article.entry");

    const title = info
      .children("div.desktop-only").first()
      .children("header.rel")
      .children("section.info")
      .children("h1").text().trim();
    result.title = title;

    const link = url;
    result.link = link;

    const image = info
      .children("div.desktop-only").first()
      .children("header.rel")
      .children("a");
    const imageUrl = image.attr("href") ?? "";
    const imageAlt = image.find("img").attr("alt") ?? "";

    result.image = { url: imageUrl, alt: imageAlt };

    const viewsText = info
      .children("div.desktop-only").first()
      .children("header.rel")
      .children("section")
      .children("div.cols")
      .children("aside.stats")
      .children("dl")
      .children("dd.views")
      .children("a").text().trim().replace(/,/g, "");
    const views = viewsText ? parseInt(viewsText, 10) : null;
    result.views = isNaN(views as number) ? null : views;

    const sections = parseNarrative($);
    result.sections = sections;
    result.body = buildMarkdown(sections);

    const googleTrendsHref = info
      .children("div.c")
      .children("section.bodycopy")
      .children("iframe.google-trends-iframe")
      .attr("data-src");
    result.googleTrendsUrl = googleTrendsHref ?? null;

    const htmlStats = info.children("div.c").children("aside");

    const imgflipHref = htmlStats
      .children("dl")
      .children("dt").filter((_, el) => $(el).text().trim() === "Additional References")
      .next("dd")
      .children('a[href*="imgflip.com"]').attr("href");
    result.imgflipUrl = imgflipHref ? normalizeImgflipUrl(imgflipHref) : null;

    const type = htmlStats
      .children("dl")
      .children("dt").filter((_, el) => $(el).text().trim() === "Type:")
      .next("dd")
      .children("a")
      .map((_, el) => $(el).text().trim()).get();
    const year = htmlStats
      .children("dl")
      .children("dt").filter((_, el) => $(el).text().trim() === "Year")
      .next("dd")
      .children("a").text().trim();
    const origin = htmlStats
      .children("dl")
      .children("dt").filter((_, el) => $(el).text().trim() === "Origin")
      .next("dd").text().trim();
    const region = htmlStats
      .children("dl")
      .children("dt").filter((_, el) => $(el).text().trim() === "Region")
      .next("dd")
      .children("a").text().trim();

    result.type = type.length > 0 ? type : null;
    result.year = year || null;
    result.origin = origin || null;
    result.region = region || null;

    const tags = htmlStats.find("dl#entry_tags dd a")
      .map((_, el) => $(el).text().trim())
      .get()
    result.tags = tags.length > 0 ? tags : null;

    return result;
  } catch (err) {
    console.error("Fetching meme failed: " + (err as Error).message);
    return null;
  }
}

interface ParsedHeading {
  title: string;
  rawLevel: number;
  blocks: SectionBlock[];
}

function parseNarrative($: cheerio.CheerioAPI): MemeSection[] {
  const info = $("article.entry");
  const $bodycopy = info.children("div.c").children("section.bodycopy").first();

  const headings: ParsedHeading[] = [];
  let current: ParsedHeading | null = null;
  let stopped = false;

  $bodycopy.children().each((_, el) => {
    if (stopped) return false;

    const $el = $(el);
    const tag = $el.prop("tagName") ?? "";

    if (/^H[1-6]$/.test(tag)) {
      const text = $el.text().trim();
      if (!text) return;
      if (STOP_HEADINGS.has(text.toLowerCase())) {
        stopped = true;
        return false;
      }
      if (current) headings.push(current);
      current = { title: text, rawLevel: parseInt(tag.slice(1), 10), blocks: [] };
      return;
    }

    if (!current) return;

    switch (tag) {
      case "P": {
        const text = normalizeWhitespace(inlineMarkdown($, $el));
        if (text) current.blocks.push({ type: "text", text });
        break;
      }
      case "BLOCKQUOTE":
        current.blocks.push(...handleBlockquote($, $el));
        break;
      case "CENTER":
        current.blocks.push(...handleCenter($, $el));
        break;
      default:
        break;
    }
  });

  if (current) headings.push(current);

  return normalizeLevels(headings);
}

function normalizeLevels(headings: ParsedHeading[]): MemeSection[] {
  if (headings.length === 0) return [];
  const mainLevel = Math.min(...headings.map((h) => h.rawLevel));
  return headings.map((h) => ({
    title: h.title,
    level: h.rawLevel === mainLevel ? 2 : 3,
    contents: h.blocks,
  }));
}

function handleCenter($: cheerio.CheerioAPI, $el: cheerio.Cheerio<Element>): SectionBlock[] {
  const blocks: SectionBlock[] = [];

  $el.find("lite-youtube").each((_, el) => {
    const $yt = $(el);
    const id = $yt.attr("videoid");
    if (!id) return;
    let url = `https://www.youtube.com/watch?v=${id}`;
    const start = ($yt.attr("params") ?? "").match(/start=(\d+)/);
    if (start) url += `&start=${start[1]}`;
    blocks.push({ type: "video", url });
  });
  if (blocks.length) return blocks;

  $el.find("lite-tiktok").each((_, el) => {
    const $tt = $(el);
    const url = $tt.find("blockquote").attr("cite") ?? $tt.find("blockquote section a").first().attr("href");
    if (url) blocks.push({ type: "video", url });
  });
  if (blocks.length) return blocks;

  $el.find('blockquote[data-instgrm-permalink]').each((_, el) => {
    const url = ($(el).attr("data-instgrm-permalink") ?? "").split("?")[0];
    if (url) blocks.push({ type: "video", url });
  });
  if (blocks.length) return blocks;

  $el.find("div.tumblr-post[data-href]").each((_, el) => {
    const url = $(el).attr("data-href");
    if (url) blocks.push({ type: "video", url });
  });
  if (blocks.length) return blocks;

  $el.find("img").each((_, el) => {
    const $img = $(el);
    const url = imageUrl($img);
    if (!url) return;
    const alt = $img.attr("alt") ?? "";
    const href = $img.closest("a").attr("href");
    const nsfw = isNsfwImage($img);
    blocks.push(href
      ? { type: "image", url, alt, nsfw, pageUrl: resolveUrl(href) }
      : { type: "image", url, alt, nsfw });
  });
  if (blocks.length) return blocks;

  const text = normalizeWhitespace(inlineMarkdown($, $el));
  if (text) blocks.push({ type: "text", text });
  return blocks;
}

function handleBlockquote($: cheerio.CheerioAPI, $el: cheerio.Cheerio<Element>): SectionBlock[] {
  const tweet = $el.find('p a[href*="twitter.com"], p a[href*="x.com"]').first();
  if (tweet.length) {
    const href = tweet.attr("href") ?? "";
    const url = resolveUrl(href.split("?")[0] ?? href).replace("twitter.com", "x.com");
    return [{ type: "quote", text: `[Tweet](${url})` }];
  }
  const text = normalizeWhitespace(inlineMarkdown($, $el.find("p").first()));
  return text ? [{ type: "quote", text }] : [];
}

function inlineMarkdown($: cheerio.CheerioAPI, $el: cheerio.Cheerio<AnyNode>): string {
  const parts: string[] = [];
  $el.contents().each((_, node) => {
    parts.push(walkInline($, node));
  });
  return parts.join("");
}

function walkInline($: cheerio.CheerioAPI, node: AnyNode): string {
  if (node.type === "text") return node.data;

  if (node.type !== "tag") return "";

  const $el = $(node);
  const tag = node.tagName.toLowerCase();
  const inner = $el.contents().toArray().map((child) => walkInline($, child)).join("");

  switch (tag) {
    case "a": {
      const href = $el.attr("href");
      if (!href) return inner;
      const url = resolveUrl(href);
      return `[${inner || url}](${url})`;
    }
    case "strong":
    case "b":
      return `**${inner}**`;
    case "em":
    case "i":
      return `*${inner}*`;
    case "code":
      return `\`${inner}\``;
    case "sup":
      return ($el.attr("class") ?? "").includes("footnote") ? "" : inner;
    case "br":
      return "\n";
    case "img": {
      const url = imageUrl($el);
      if (!url) return "";
      return `![${escapeAlt($el.attr("alt") ?? "")}](${url})`;
    }
    case "del":
    case "s":
    case "strike":
      return `~~${inner}~~`;
    default:
      return inner;
  }
}

function isNsfwImage($img: cheerio.Cheerio<Element>): boolean {
  const klass = $img.attr("class") ?? "";
  if (klass.includes("nsfw-img")) return true;
  return $img.attr("data-nsfw-src") !== undefined || $img.attr("data-large-nsfw-src") !== undefined;
}

function imageUrl($img: cheerio.Cheerio<Element>): string {
  const dataSrc = $img.attr("data-src");
  if (dataSrc) return dataSrc;

  const nsfwSrc = $img.attr("data-large-nsfw-src") ?? $img.attr("data-nsfw-src");
  if (nsfwSrc) {
    const decoded = decodeBase64Url(nsfwSrc);
    if (decoded) return decoded;
  }

  const srcsetDisabled = $img.attr("srcset-disabled");
  if (srcsetDisabled) {
    const first = srcsetDisabled.trim().split(/[\s,]+/)[0];
    if (first) return first;
  }

  return $img.attr("src") ?? "";
}

function decodeBase64Url(value: string): string {
  try {
    const cleaned = value.replace(/\s+/g, "");
    if (!cleaned) return "";
    return Buffer.from(cleaned, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function resolveUrl(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (/^(https?:)?\/\//i.test(trimmed)) {
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }
  return `${SITE_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function normalizeImgflipUrl(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (/^https?:\/\/imgflip\.com\/meme\//i.test(trimmed)) {
    return trimmed.replace(/\/meme\//i, "/memegenerator/");
  }
  return trimmed;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function escapeAlt(alt: string): string {
  return alt.replace(/([\\\[\]])/g, "\\$1");
}

function buildMarkdown(sections: MemeSection[]): string {
  const out: string[] = [];
  for (const section of sections) {
    out.push(`${"#".repeat(section.level)} ${section.title}`);
    for (const block of section.contents) {
      out.push("", renderBlock(block));
    }
    out.push("");
  }
  return out.join("\n").trim();
}

function renderBlock(block: SectionBlock): string {
  switch (block.type) {
    case "text":
      return block.text;
    case "quote":
      return `> ${block.text}`;
    case "image": {
      const image = `![${escapeAlt(block.alt)}](${block.url})`;
      return block.pageUrl ? `[${image}](${block.pageUrl})` : image;
    }
    case "video":
      return `- [${videoLabel(block.url)}](${block.url})`;
  }
}

function videoLabel(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "Watch on YouTube";
  if (url.includes("tiktok.com")) return "Watch on TikTok";
  if (url.includes("instagram.com")) return "View on Instagram";
  if (url.includes("tumblr.com")) return "View on Tumblr";
  return "View";
}
