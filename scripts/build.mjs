import fs from "node:fs/promises";
import path from "node:path";
import { escapeHtml, formatDate, getBasePath, outputPathForUrl, withBase } from "./build-utils.mjs";
import { loadStories, renderStoryBody } from "./content-loader.mjs";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "out");
const publicDir = path.join(rootDir, "public");
const sourceDir = path.join(rootDir, "src");
const basePath = getBasePath();
const site = JSON.parse(await fs.readFile(path.join(rootDir, "content", "site.json"), "utf8"));
const stories = await loadStories({ rootDir, production: true });
const hasSocialCard = await fileExists(path.join(publicDir, "images", "social-card.png"));

if (path.basename(outDir) !== "out" || path.dirname(outDir) !== rootDir) {
  throw new Error(`Refusing to clean unexpected output directory: ${outDir}`);
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(path.join(outDir, "assets"), { recursive: true });
await fs.cp(publicDir, outDir, { recursive: true });
await fs.copyFile(path.join(sourceDir, "styles.css"), path.join(outDir, "assets", "styles.css"));
await fs.copyFile(path.join(sourceDir, "site.js"), path.join(outDir, "assets", "site.js"));
await fs.writeFile(path.join(outDir, ".nojekyll"), "", "utf8");

function routeUrl(route = "") {
  const clean = String(route).replace(/^\/+|\/+$/g, "");
  return withBase(basePath, clean ? `${clean}/` : "");
}

function assetUrl(asset) {
  return withBase(basePath, asset);
}

function absoluteUrl(route = "") {
  const origin = process.env.SITE_URL?.replace(/\/+$/, "");
  return origin ? `${origin}${routeUrl(route)}` : "";
}

function metadataItems(story) {
  const items = [
    `<time datetime="${escapeHtml(story.publishedAt)}">${escapeHtml(formatDate(story.publishedAt))}</time>`,
    `${story.readingMinutes} min read`
  ];

  if (story.chapters.length) {
    items.push(`${story.chapters.length} ${story.chapters.length === 1 ? "chapter" : "chapters"}`);
  }

  return items.map((item) => `<span>${item}</span>`).join("");
}

function siteHeader(current) {
  const links = [
    ["home", "", "Home"],
    ["library", "library", "Library"],
    ["about", "about", "About"],
    ["impressum", "impressum", "Impressum"]
  ];

  return `
    <header class="site-header">
      <a class="wordmark" href="${routeUrl()}" aria-label="${escapeHtml(site.name)} home">
        <span class="wordmark__initials" aria-hidden="true">SWB</span>
        <span>${escapeHtml(site.name)}</span>
      </a>
      <nav class="site-nav" aria-label="Primary navigation">
        ${links
          .map(
            ([key, route, label]) =>
              `<a href="${routeUrl(route)}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`
          )
          .join("")}
      </nav>
    </header>`;
}

function siteFooter() {
  return `
    <footer class="site-footer">
      <div class="site-footer__brand">
        <p class="wordmark wordmark--footer">${escapeHtml(site.name)}</p>
        <p>${escapeHtml(site.tagline)}</p>
      </div>
      <div class="site-footer__links">
        <a href="${routeUrl("about")}">About</a>
        <a href="${routeUrl("impressum")}">Impressum &amp; legal</a>
        <a href="${escapeHtml(site.author.github)}" rel="noreferrer">GitHub</a>
      </div>
      <p class="site-footer__copyright">© ${new Date().getUTCFullYear()} ${escapeHtml(site.name)}. ${escapeHtml(site.legal.copyrightNote)}</p>
    </footer>`;
}

function layout({ title, description, current, body, bodyClass = "", route = "" }) {
  const fullTitle = title === site.name ? title : `${title} — ${site.name}`;
  const canonical = absoluteUrl(route);
  const socialCard = hasSocialCard ? assetUrl("images/social-card.png") : "";
  const socialImage = process.env.SITE_URL && socialCard
    ? `${process.env.SITE_URL.replace(/\/+$/, "")}${socialCard}`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="${escapeHtml(site.author.name)}">
    <meta name="theme-color" content="#f5f2ea">
    <meta property="og:type" content="${route.startsWith("stories/") ? "article" : "website"}">
    <meta property="og:title" content="${escapeHtml(fullTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    ${socialImage ? `<meta property="og:image" content="${escapeHtml(socialImage)}">` : ""}
    <meta name="twitter:card" content="${socialImage ? "summary_large_image" : "summary"}">
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
    <title>${escapeHtml(fullTitle)}</title>
    <link rel="stylesheet" href="${assetUrl("assets/styles.css")}">
    <script src="${assetUrl("assets/site.js")}" defer></script>
  </head>
  <body class="${escapeHtml(bodyClass)}">
    <a class="skip-link" href="#main">Skip to main content</a>
    ${siteHeader(current)}
    ${body}
    ${siteFooter()}
  </body>
</html>
`;
}

function coverMarkup(story, className = "story-cover") {
  if (!story.coverImage) {
    return `<div class="${className} story-cover--empty" aria-hidden="true">${escapeHtml(story.title.charAt(0))}</div>`;
  }

  return `<img class="${className}" src="${assetUrl(story.coverImage)}" alt="${escapeHtml(story.coverAlt || `Cover of ${story.title}`)}">`;
}

function storyCard(story) {
  const available = story.status === "published";
  const content = `
    <div class="library-item__cover">${coverMarkup(story, "story-cover story-cover--small")}</div>
    <div class="library-item__body">
      <p class="kicker">${escapeHtml(story.kicker || (available ? "Story" : "Coming soon"))}</p>
      <h2>${escapeHtml(story.title)}</h2>
      ${story.subtitle ? `<p class="library-item__subtitle">${escapeHtml(story.subtitle)}</p>` : ""}
      <p>${escapeHtml(story.description)}</p>
      <div class="story-meta">${metadataItems(story)}</div>
      <span class="text-link">${available ? "Read story" : "Not yet available"}${available ? '<span aria-hidden="true"> →</span>' : ""}</span>
    </div>`;

  if (!available) {
    return `<article class="library-item library-item--upcoming">${content}</article>`;
  }

  return `<article class="library-item"><a href="${routeUrl(`stories/${story.slug}`)}">${content}</a></article>`;
}

const [featuredStory] = stories.publishedStories;
const homeBody = `
  <main id="main">
    <section class="home-intro measure-wide">
      <p class="kicker">Independent fiction · Berlin</p>
      <h1>${escapeHtml(site.name)}</h1>
      <p class="home-intro__lede">${escapeHtml(site.description)}</p>
      <a class="button-link" href="${routeUrl("library")}">Browse the library</a>
    </section>
    ${
      featuredStory
        ? `<section class="featured-section" aria-labelledby="featured-heading">
      <div class="section-label measure-wide">
        <p class="kicker">Featured story</p>
        <p>${escapeHtml(formatDate(featuredStory.publishedAt))}</p>
      </div>
      <article class="featured-story measure-wide">
        <a class="featured-story__cover-link" href="${routeUrl(`stories/${featuredStory.slug}`)}" aria-label="Read ${escapeHtml(featuredStory.title)}">
          ${coverMarkup(featuredStory)}
        </a>
        <div class="featured-story__copy">
          <p class="kicker">${escapeHtml(featuredStory.kicker || "Story")}</p>
          <h2 id="featured-heading"><a href="${routeUrl(`stories/${featuredStory.slug}`)}">${escapeHtml(featuredStory.title)}</a></h2>
          ${featuredStory.subtitle ? `<p class="featured-story__subtitle">${escapeHtml(featuredStory.subtitle)}</p>` : ""}
          <p>${escapeHtml(featuredStory.description)}</p>
          <div class="story-meta">${metadataItems(featuredStory)}</div>
          <a class="text-link" href="${routeUrl(`stories/${featuredStory.slug}`)}">Begin reading <span aria-hidden="true">→</span></a>
        </div>
      </article>
    </section>`
        : ""
    }
    <section class="home-note measure-wide" aria-labelledby="home-note-title">
      <p class="kicker">The publication</p>
      <h2 id="home-note-title">A clear page, a comfortable measure, and time to read.</h2>
      <p>${escapeHtml(site.tagline)} Every published story is available here without sign-in, tracking, or interruption.</p>
      <a class="text-link" href="${routeUrl("about")}">About ${escapeHtml(site.name)} <span aria-hidden="true">→</span></a>
    </section>
  </main>`;

await writeRoute(
  "",
  layout({
    title: site.name,
    description: site.description,
    current: "home",
    body: homeBody,
    bodyClass: "page-home"
  })
);

const libraryEntries = [...stories.publishedStories, ...stories.comingSoonStories];
const libraryBody = `
  <main id="main" class="page-shell">
    <header class="page-heading measure-wide">
      <p class="kicker">The collection</p>
      <h1>Library</h1>
      <p>Published and forthcoming stories, arranged by publication date.</p>
    </header>
    <section class="library-list measure-wide" aria-label="Stories">
      ${
        libraryEntries.length
          ? libraryEntries.map(storyCard).join("")
          : "<p>No stories are currently published.</p>"
      }
    </section>
  </main>`;

await writeRoute(
  "library",
  layout({
    title: "Library",
    description: `Browse every published story from ${site.name}.`,
    current: "library",
    body: libraryBody,
    bodyClass: "page-library",
    route: "library"
  })
);

const aboutBody = `
  <main id="main" class="page-shell">
    <article class="prose-page measure-reading">
      <header class="page-heading">
        <p class="kicker">About</p>
        <h1>Stories from the worlds I visit at night.</h1>
      </header>
      <div class="prose-page__body">
        ${site.about.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
      <dl class="author-details">
        <div><dt>Author</dt><dd>${escapeHtml(site.author.name)}</dd></div>
        <div><dt>Location</dt><dd>${escapeHtml(site.author.location)}</dd></div>
        <div><dt>Contact</dt><dd><a href="mailto:${escapeHtml(site.author.email)}">${escapeHtml(site.author.email)}</a></dd></div>
        <div><dt>GitHub</dt><dd><a href="${escapeHtml(site.author.github)}" rel="noreferrer">${escapeHtml(site.author.githubHandle)}</a></dd></div>
      </dl>
      <p class="signature">Sincerely, ${escapeHtml(site.author.name)}</p>
    </article>
  </main>`;

await writeRoute(
  "about",
  layout({
    title: "About",
    description: `About ${site.author.name}, the author behind ${site.name}.`,
    current: "about",
    body: aboutBody,
    bodyClass: "page-about",
    route: "about"
  })
);

const legalBody = `
  <main id="main" class="page-shell">
    <article class="prose-page measure-reading">
      <header class="page-heading">
        <p class="kicker">Legal information</p>
        <h1>Impressum</h1>
      </header>
      <section>
        <h2>Operator</h2>
        <p>${escapeHtml(site.author.name)}<br>${escapeHtml(site.author.location)}</p>
        <p><a href="mailto:${escapeHtml(site.author.email)}">${escapeHtml(site.author.email)}</a></p>
        <p>${escapeHtml(site.legal.operatorNote)}</p>
      </section>
      <section>
        <h2>Copyright</h2>
        <p>${escapeHtml(site.legal.copyrightNote)}</p>
      </section>
      <section>
        <h2>External links</h2>
        <p>${escapeHtml(site.legal.disclaimer)}</p>
      </section>
    </article>
  </main>`;

await writeRoute(
  "impressum",
  layout({
    title: "Impressum",
    description: `Impressum and legal information for ${site.name}.`,
    current: "impressum",
    body: legalBody,
    bodyClass: "page-impressum",
    route: "impressum"
  })
);

for (const story of stories.publishedStories) {
  const bodyHtml = renderStoryBody(story, basePath);
  const toc = story.chapters
    .map(
      (chapter, index) =>
        `<li><a href="#${escapeHtml(chapter.id)}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(chapter.title)}</a></li>`
    )
    .join("");

  const storyBody = `
    <div class="reading-progress" aria-hidden="true"><span data-reading-progress></span></div>
    <main id="main" class="reader-shell">
      <aside class="reader-sidebar">
        <a class="back-link" href="${routeUrl("library")}">← Library</a>
        <div class="reader-sidebar__cover">${coverMarkup(story)}</div>
        ${
          story.chapters.length
            ? `<nav class="reader-contents" aria-labelledby="contents-title">
          <p class="kicker" id="contents-title">Contents</p>
          <ol>${toc}</ol>
        </nav>`
            : ""
        }
      </aside>
      <article class="reader-article">
        <header class="story-heading">
          <p class="kicker">${escapeHtml(story.kicker || "Story")}</p>
          <h1>${escapeHtml(story.title)}</h1>
          ${story.subtitle ? `<p class="story-heading__subtitle">${escapeHtml(story.subtitle)}</p>` : ""}
          <p class="story-heading__description">${escapeHtml(story.description)}</p>
          <div class="story-meta">${metadataItems(story)}</div>
        </header>
        ${
          story.chapters.length
            ? `<details class="reader-contents reader-contents--mobile">
          <summary>Table of contents</summary>
          <ol>${toc}</ol>
        </details>`
            : ""
        }
        <div class="story-body">${bodyHtml}</div>
        <footer class="story-end">
          <p aria-hidden="true">— End —</p>
          <a class="text-link" href="${routeUrl("library")}">Return to the library <span aria-hidden="true">→</span></a>
        </footer>
      </article>
    </main>`;

  await writeRoute(
    `stories/${story.slug}`,
    layout({
      title: story.title,
      description: story.description,
      current: "library",
      body: storyBody,
      bodyClass: "page-story",
      route: `stories/${story.slug}`
    })
  );
}

if (featuredStory) {
  const chapterAliases = {
    foreword: featuredStory.chapters[0]?.id,
    "chapter-1": featuredStory.chapters[1]?.id,
    "chapter-2": featuredStory.chapters[2]?.id,
    "chapter-3": featuredStory.chapters[3]?.id
  };
  const target = routeUrl(`stories/${featuredStory.slug}`);
  const redirectScript = `
    <script>
      const chapter = new URLSearchParams(window.location.search).get("chapter");
      const aliases = ${JSON.stringify(chapterAliases)};
      const hash = chapter && aliases[chapter] ? "#" + aliases[chapter] : "";
      window.location.replace(${JSON.stringify(target)} + hash);
    </script>`;
  await fs.writeFile(
    path.join(outDir, "reader.html"),
    redirectPage("Reader moved", target, redirectScript),
    "utf8"
  );

  await writeRoute(
    "stories/kotuAdam",
    redirectPage("Story moved", target, `<script>window.location.replace(${JSON.stringify(target)});</script>`)
  );
}

await fs.writeFile(
  path.join(outDir, "404.html"),
  layout({
    title: "Page not found",
    description: "The requested page could not be found.",
    current: "",
    body: `<main id="main" class="not-found measure-reading"><p class="kicker">404</p><h1>Page not found</h1><p>That page is not on the shelf.</p><a class="button-link" href="${routeUrl()}">Return home</a></main>`,
    bodyClass: "page-not-found"
  }),
  "utf8"
);

console.log(
  `Built ${stories.publishedStories.length} published ${stories.publishedStories.length === 1 ? "story" : "stories"} and ${stories.comingSoonStories.length} forthcoming ${stories.comingSoonStories.length === 1 ? "story" : "stories"} to out/ (base: ${basePath}).`
);

async function writeRoute(route, html) {
  const target = outputPathForUrl(outDir, route);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, html, "utf8");
}

function redirectPage(title, target, script = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
    <title>${escapeHtml(title)} — ${escapeHtml(site.name)}</title>
  </head>
  <body>
    <p>This page has moved to <a href="${escapeHtml(target)}">${escapeHtml(target)}</a>.</p>
    ${script}
  </body>
</html>`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
