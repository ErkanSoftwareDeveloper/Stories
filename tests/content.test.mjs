import assert from 'node:assert/strict';
import test from 'node:test';
import MarkdownIt from 'markdown-it';
import { loadStories, renderStoryBody } from '../scripts/content-loader.mjs';

const { publishedStories, visibleStories } = await loadStories();

test('all numbered chapter headings, including the legacy level-one heading, enter navigation', () => {
  for (const story of publishedStories) {
    const titles = [...story.source.matchAll(/^#{1,2} (Chapter\s+\d+[^\n]*)/gm)].map(match => match[1]);
    for (const title of titles) assert.ok(story.chapters.some(chapter => chapter.title === title), title);
    const html = renderStoryBody(story, '/Stories/');
    assert.equal((html.match(/class="story-chapter"/g) || []).length, story.chapters.length);
    assert.equal((html.match(/<h1\b/g) || []).length, 0);
    assert.equal(new Set(story.chapters.map(chapter => chapter.id)).size, story.chapters.length);
    for (const chapter of story.chapters) assert.ok(html.includes(`id="${chapter.id}"`));
  }
});

test('chapter wrappers and navigation preserve every rendered paragraph and punctuation mark', () => {
  const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });
  for (const story of publishedStories) {
    const expected = markdown.renderer.render(story.tokens, markdown.options, {});
    const actual = renderStoryBody(story, '/')
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/g, '')
      .replace(/<section\b[^>]*>|<\/section>/g, '');
    const normalize = html => html.replace(/>\s+</g, '><').trim();
    assert.equal(normalize(actual), normalize(expected));
  }
});

test('production excludes drafts and repeated rendering does not mutate source tokens', () => {
  assert.ok(visibleStories.every(story => story.status !== 'draft'));
  for (const story of publishedStories) {
    const before = JSON.stringify(story.tokens);
    renderStoryBody(story, '/Stories/');
    renderStoryBody(story, '/');
    assert.equal(JSON.stringify(story.tokens), before);
  }
});
