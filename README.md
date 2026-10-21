# Know Your Meme JS.

A scraper npm package to search and get information about memes from [KnowYourMeme.com](https://knowyourmeme.com/).

GitHub: [knowyourmeme-js](https://github.com/MuhammadrizoDeveloper/knowyourmeme-js)

## Features

- 🔍 **Search memes** by query with customizable result limits
- 📖 **Get detailed meme information** including images, tags, origin, and more
- 📝 **Markdown `body`** — the full article converted to clean markdown (headings, links, images, embedded videos) for easy rendering
- 📦 **ES6 modules** support
- 🔵 **TypeScript** support
- 🛡️ **Error handling** with descriptive error messages

## Installation

```bash
npm install knowyourmeme-js
```

## Usage

### Basic Search

```javascript
import { search } from 'knowyourmeme-js';

// Search for memes
const { results, totalResults } = await search('shrek');
console.log(`Found ${totalResults} memes`);
console.log(results);
```

### Search with Options

```javascript
import { search } from 'knowyourmeme-js';

// Search with custom limit (default is 10, more than 16 results are fetched automatically)
const { results } = await search('shrek', 5);
console.log(`Got ${results.length} results`);
console.log(results);
```

### Get Meme Details

```javascript
import { getMeme } from 'knowyourmeme-js';

// Get detailed information about a specific meme
const meme = await getMeme('https://knowyourmeme.com/memes/shrek-rizz');
console.log(meme);
```

## API Reference

### `search(query, max)`

Searches for memes on KnowYourMeme.com using the site's search API.

**Parameters:**
- `query` (string): Search query
- `max` (number): Maximum number of results (default: 10). When `max` exceeds the page size (16), additional pages are fetched automatically.

**Returns:** `Promise<SearchResults>`:
```javascript
{
  query: string,            // the query that was searched
  totalResults: number,     // total matching memes on the site
  results: MemeResult[]
}
```

**Search Result Object (MemeResult):**
```javascript
{
  title: string,
  link: string,
  thumbnail: { url: string, alt: string },
  summary?: string,     // short description
  views: number | null,
  nsfw: boolean,        // flagged as not-safe-for-work
  year: number | null,  // year the meme originated
  origin: string | null, // e.g. "Tumblr", "4chan"; null when absent
  region: string | null, // e.g. "Japan"; null when absent
}
```

### `getMeme(url)`

Gets detailed information about a specific meme.

**Parameters:**
- `url` (string): URL of the meme page on KnowYourMeme.com

**Returns:** Promise<Object> - Promise of MemeDetails

**MemeDetails Object:**
```javascript
{
  title: string,
  link: string,
  image: { url: string, alt: string },
  views: number | null,
  body: string,                 // full article as markdown
  sections: MemeSection[],      // typed content blocks grouped by heading
  googleTrendsUrl: string | null, // Google Trends embed URL; null when none
  imgflipUrl: string | null,    // imgflip "Meme Generator" link (normalized to /memegenerator/); null when none
  type: string[] | null,        // e.g. ["Exploitable", "Photoshop"]; null when absent
  year: string | null,          // e.g. "2011"; null when absent
  origin: string | null,        // e.g. "Tumblr"; null when absent
  region: string | null,        // e.g. "United States"; null when absent
  tags: string[] | null,        // entry tags; null when absent
}
```

**MemeSection Object:**
```javascript
{
  title: string,      // heading text (e.g. "About", "Origin", "Spread")
  level: number,      // normalized heading level: 2 = main (##), 3 = subsection (###)
  contents: SectionBlock[]
}
```

**SectionBlock (union):**
```javascript
{ type: 'text', text: string }                                  // inline markdown paragraph
{ type: 'quote', text: string }                                 // blockquote
{ type: 'image', url: string, alt: string, nsfw: boolean, pageUrl?: string }  // pageUrl = KnowYourMeme photo page; nsfw = true when hidden behind a click-to-view overlay
{ type: 'video', url: string }                                  // YouTube / TikTok / Instagram / Tumblr link
```

The `body` field is markdown ready for renderers (e.g. Raycast's `Detail` view). Headings are normalized so main sections render as `##` and subsections as `###`, embedded videos become links, images keep their real URLs (including NSFW images that would otherwise be hidden behind a click-to-view overlay), and footnote references are stripped.

## Requirements

- Node.js 14.0.0 or higher
- ES6 modules support

## Dependencies

- `node-fetch`: lightweight HTTP client for making requests
- `cheerio`: HTML parsing and manipulation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Disclaimer
This project is **not affiliated with or endorsed by [KnowYourMeme.com](https://knowyourmeme.com)**.  
It simply scrapes publicly available data for educational and personal use.  
Please use this library responsibly and respect the website’s Terms of Service.
