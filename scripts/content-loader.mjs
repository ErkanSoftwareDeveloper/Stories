import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { escapeHtml, withBase } from "./build-utils.mjs";

const REQUIRED_FIELDS = ["title", "slug", "description", "publishedAt", "status"];
const VALID_STATUSES = new Set(["draft", "published", "coming-soon"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORDS_PER_MINUTE = 225;

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

function storyError(filePath, message, rootDir) {
  const filename = path.relative(rootDir, filePath).split(path.sep).join("/");
  return new Error(`Story validation failed:\n${filename} ${message}`);
}

function isRealDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "chapter";
}

function inlineText(token) {
  if (!token?.children) {
    return token?.content ?? "";
  }

  return token.children
    .filter((child) => !["image", "html_inline"].includes(child.type))
    .map((child) => child.content ?? "")
    .join("")
    .trim();
}

function removeDocumentTitle(tokens, title) {
  const firstHeading = tokens.findIndex((token) => token.type === "heading_open");
  if (
    firstHeading >= 0 &&
    tokens[firstHeading].tag === "h1" &&
    inlineText(tokens[firstHeading + 1]) === title
  ) {
    tokens.splice(firstHeading, 3);
  }
}

function addChapterIds(tokens) {
  const chapters = [];
  const occurrences = new Map();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open" || token.tag !== "h2") {
      continue;
    }

    const title = inlineText(tokens[index + 1]);
    const baseId = slugify(title);
    const count = (occurrences.get(baseId) ?? 0) + 1;
    occurrences.set(baseId, count);
    const id = count === 1 ? baseId : `${baseId}-${count}`;

    token.attrSet("id", id);
    chapters.push({ id, title });
  }

  return chapters;
}

function countWords(markdownSource) {
  const plainText = markdownSource
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~\-|]/g, " ");

  return plainText.split(/\s+/u).filter(Boolean).length;
}

function validateMetadata(data, filePath, rootDir) {
  for (const field of REQUIRED_FIELDS) {
    if (typeof data[field] !== "string" || !data[field].trim()) {
      throw storyError(filePath, `is missing the required "${field}" field.`, rootDir);
    }
  }

  if (!VALID_STATUSES.has(data.status)) {
    throw storyError(
      filePath,
      'has an invalid "status" field. Use "draft", "published", or "coming-soon".',
      rootDir
    );
  }

  if (!SLUG_PATTERN.test(data.slug)) {
    throw storyError(
      filePath,
      'has an invalid "slug" field. Use lowercase letters, numbers, and hyphens only.',
      rootDir
    );
  }

  for (const field of ["publishedAt", "updatedAt"]) {
    if (data[field] && !isRealDate(data[field])) {
      throw storyError(filePath, `has an invalid "${field}" date. Use YYYY-MM-DD.`, rootDir);
    }
  }

  if (data.coverImage && !String(data.coverImage).startsWith("/images/stories/")) {
    throw storyError(
      filePath,
      'has an invalid "coverImage" path. Store covers in public/images/stories/.',
      rootDir
    );
  }
}

async function readStory(filePath, rootDir) {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed;

  try {
    parsed = matter(raw);
  } catch (error) {
    throw storyError(filePath, `contains invalid frontmatter: ${error.message}`, rootDir);
  }

  validateMetadata(parsed.data, filePath, rootDir);

  const tokens = markdown.parse(parsed.content, {});
  removeDocumentTitle(tokens, parsed.data.title);
  const chapters = addChapterIds(tokens);
  const wordCount = countWords(parsed.content);

  return {
    ...parsed.data,
    filePath,
    source: parsed.content,
    tokens,
    chapters,
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
  };
}

function rewriteTokenUrls(tokens, basePath) {
  for (const token of tokens) {
    if (token.type === "image") {
      const src = token.attrGet("src");
      if (src?.startsWith("/") && !src.startsWith("//")) {
        token.attrSet("src", withBase(basePath, src));
      }
      token.attrSet("loading", "lazy");
      token.attrSet("decoding", "async");
    }

    if (token.type === "link_open") {
      const href = token.attrGet("href");
      if (href?.startsWith("/") && !href.startsWith("//")) {
        token.attrSet("href", withBase(basePath, href));
      } else if (/^https?:\/\//i.test(href ?? "")) {
        token.attrSet("rel", "noreferrer");
      }
    }

    if (token.children) {
      rewriteTokenUrls(token.children, basePath);
    }
  }
}

export function renderStoryBody(story, basePath) {
  const tokens = cloneTokens(story.tokens);
  rewriteTokenUrls(tokens, basePath);

  if (!story.chapters.length) {
    return markdown.renderer.render(tokens, markdown.options, {});
  }

  const chapterStarts = tokens
    .map((token, index) => (token.type === "heading_open" && token.tag === "h2" ? index : -1))
    .filter((index) => index >= 0);
  const preamble = tokens.slice(0, chapterStarts[0]);
  const sections = chapterStarts.map((start, index) =>
    tokens.slice(start, chapterStarts[index + 1] ?? tokens.length)
  );

  const preambleHtml = markdown.renderer.render(preamble, markdown.options, {});
  const chaptersHtml = sections
    .map((sectionTokens, index) => {
      const chapter = story.chapters[index];
      const previous = story.chapters[index - 1];
      const next = story.chapters[index + 1];
      const pagination = previous || next
        ? `<nav class="chapter-pagination" aria-label="Chapter navigation">
          ${
            previous
              ? `<a href="#${escapeHtml(previous.id)}"><span>Previous chapter</span>${escapeHtml(previous.title)}</a>`
              : "<span></span>"
          }
          ${
            next
              ? `<a href="#${escapeHtml(next.id)}"><span>Next chapter</span>${escapeHtml(next.title)}</a>`
              : "<span></span>"
          }
        </nav>`
        : "";

      return `<section class="story-chapter" aria-labelledby="${escapeHtml(chapter.id)}">
        ${markdown.renderer.render(sectionTokens, markdown.options, {})}
        ${pagination}
      </section>`;
    })
    .join("");

  return `${preambleHtml}${chaptersHtml}`;
}

function cloneTokens(tokens) {
  return tokens.map((token) => {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(token)), token);
    clone.attrs = token.attrs?.map((attribute) => [...attribute]) ?? null;
    clone.children = token.children ? cloneTokens(token.children) : null;
    return clone;
  });
}

export async function loadStories({
  rootDir = process.cwd(),
  production = true
} = {}) {
  const storiesDir = path.join(rootDir, "content", "stories");
  const entries = await fs.readdir(storiesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(storiesDir, entry.name))
    .sort();

  if (files.length === 0) {
    throw new Error("Story validation failed:\ncontent/stories/ contains no Markdown files.");
  }

  const allStories = [];
  const slugs = new Map();

  for (const filePath of files) {
    const story = await readStory(filePath, rootDir);
    if (slugs.has(story.slug)) {
      const firstFile = path.relative(rootDir, slugs.get(story.slug));
      throw storyError(
        filePath,
        `uses the duplicate slug "${story.slug}", already used by ${firstFile}.`,
        rootDir
      );
    }
    slugs.set(story.slug, filePath);
    allStories.push(story);
  }

  allStories.sort((a, b) => {
    const dateOrder = b.publishedAt.localeCompare(a.publishedAt);
    return dateOrder || a.title.localeCompare(b.title);
  });

  const visibleStories = production
    ? allStories.filter((story) => story.status !== "draft")
    : allStories;

  return {
    allStories,
    visibleStories,
    publishedStories: visibleStories.filter((story) => story.status === "published"),
    comingSoonStories: visibleStories.filter((story) => story.status === "coming-soon")
  };
}
