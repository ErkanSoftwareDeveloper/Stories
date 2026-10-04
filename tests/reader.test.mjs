import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const script = await fs.readFile(new URL('../src/site.js', import.meta.url), 'utf8');
function reader({ storageBlocked = false, saved = {}, url = 'https://example.org/Stories/stories/test/', story = true } = {}) {
  const listeners = {};
  const windowListeners = {};
  const values = new Map(Object.entries(saved));
  const timers = new Map();
  let timerId = 0;
  const element = () => ({
    style: {}, dataset: {}, attrs: {}, handlers: {}, disabled: false, hidden: true,
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; if (key === 'hidden') this.hidden = false; },
    addEventListener(key, fn) { this.handlers[key] = fn; },
    focus() { this.focused = true; },
    contains() { return false; },
    scrollIntoView() {},
  });
  const media = { matches: true, addEventListener(_, fn) { this.change = fn; } };
  const window = {
    scrollY: 0, innerHeight: 800,
    requestAnimationFrame(fn) { fn(); },
    addEventListener(key, fn) { windowListeners[key] = fn; },
    scrollTo(options) { this.scrollOptions = options; this.scrollY = options.top; },
    matchMedia() { return media; }
  };
  const headings = Array.from({ length: 7 }, (_, index) => ({
    ...element(), id: `chapter-${index}`, textContent: `Chapter ${index}`,
    getBoundingClientRect() { return { top: 600 + index * 4000 - window.scrollY }; },
  }));
  const links = headings.map(heading => ({ ...element(), hash: `#${heading.id}` }));
  const summary = element();
  const picker = { ...element(), open: false, querySelector(selector) { return selector === 'summary' ? summary : links[0]; } };
  const settings = { ...element(), open: false, querySelector() { return summary; } };
  const body = { ...element(), offsetHeight: 28000, getBoundingClientRect() { return { top: 600 - window.scrollY }; }, querySelectorAll() { return headings; } };
  const root = element();
  const themeLabel = element();
  const themeButton = { ...element(), querySelector() { return themeLabel; } };
  const resumeLabel = element();
  const resumeLink = { ...element(), href: 'https://example.org/Stories/stories/test/', dataset: { resumeStory: 'test', chapterIds: JSON.stringify(headings.map(h => h.id)) }, querySelector() { return resumeLabel; } };
  const elements = {
    '.story-body': story ? body : null, '.chapter-picker': picker, '.reader-settings': settings,
    '.reader-tools': { ...element(), offsetHeight: 76 },
    '[data-story-slug]': { dataset: { storySlug: 'test' } },
    '[data-theme-toggle]': themeButton,
    'meta[name="theme-color"]': element(),
  };
  for (const key of ['reading-progress', 'progress-label', 'current-chapter', 'previous', 'next', 'reader-steps', 'reader-type', 'smaller', 'larger', 'size-label']) elements[`[data-${key}]`] = element();
  const location = new URL(url);
  const history = {
    pushState(_, __, hash) { location.hash = hash; },
    replaceState(_, __, value) { location.href = value; }
  };
  const document = {
    documentElement: root, body: { dataset: { basePath: '/Stories/' } }, readyState: 'loading',
    querySelector: key => elements[key],
    querySelectorAll: key => key === '[data-resume-story]' ? [resumeLink] : links,
    addEventListener(key, fn) { listeners[key] = fn; }
  };
  vm.runInNewContext(script, {
    document, window, location, history, URL, URLSearchParams,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    localStorage: {
      getItem(key) { if (storageBlocked) throw new Error('blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw new Error('blocked'); values.set(key, value); }
    }
  });
  return { window, windowListeners, listeners, headings, links, picker, settings, summary, body, elements, location, root, themeLabel, themeButton, values, media, resumeLink, resumeLabel };
}

test('jump to the final chapter, focus its heading, and disable Next', () => {
  const r = reader();
  r.picker.open = true;
  let prevented = false;
  r.listeners.click({ target: { closest: () => r.links[6] }, preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(r.location.hash, '#chapter-6');
  assert.equal(r.picker.open, false);
  assert.equal(r.headings[6].focused, true);
  assert.equal(r.window.scrollOptions.behavior, 'instant');
  assert.equal(r.elements['[data-next]'].disabled, true);
  assert.equal(r.links[6].attrs['aria-current'], 'true');
  r.elements['[data-previous]'].handlers.click();
  assert.equal(r.location.hash, '#chapter-5');
});

test('scrolling and browser hash navigation keep the current chapter in sync', () => {
  const r = reader();
  r.window.scrollY = 12700;
  r.windowListeners.scroll();
  assert.equal(r.elements['[data-current-chapter]'].textContent, 'Chapter 3');
  r.location.hash = '#chapter-1';
  r.windowListeners.hashchange();
  assert.equal(r.links[1].attrs['aria-current'], 'true');
  assert.equal(r.links[3].attrs['aria-current'], undefined);
  r.location.hash = '#chapter-0';
  r.windowListeners.hashchange();
  assert.equal(r.elements['[data-previous]'].disabled, true);
});

test('Escape returns focus; storage failure does not break bounded text sizing or themes', () => {
  const r = reader({ storageBlocked: true });
  r.picker.open = true;
  r.listeners.keydown({ key: 'Escape' });
  assert.equal(r.picker.open, false);
  assert.equal(r.summary.focused, true);
  for (let i = 0; i < 20; i++) r.elements['[data-larger]'].handlers.click();
  assert.equal(r.body.style.fontSize, '1.6rem');
  assert.equal(r.elements['[data-larger]'].disabled, true);
  for (let i = 0; i < 20; i++) r.elements['[data-smaller]'].handlers.click();
  assert.equal(r.body.style.fontSize, '1rem');
  assert.equal(r.elements['[data-smaller]'].disabled, true);
  r.themeButton.handlers.click();
  assert.equal(r.root.dataset.theme, 'light');
  r.window.scrollY = 12000;
  r.windowListeners.scroll();
  assert.doesNotThrow(() => r.windowListeners.pagehide());
});

test('theme cycles through system, light and dark and persists on non-reader pages', () => {
  const r = reader({ story: false });
  assert.equal(r.root.dataset.theme, undefined);
  r.themeButton.handlers.click();
  assert.equal(r.root.dataset.theme, 'light');
  r.themeButton.handlers.click();
  assert.equal(r.root.dataset.theme, 'dark');
  assert.equal(r.values.get('swb-theme'), 'dark');
  r.themeButton.handlers.click();
  assert.equal(r.root.dataset.theme, undefined);
  assert.equal(r.themeLabel.textContent, 'System');
  const restored = reader({ story: false, saved: { 'swb-theme': 'light' } });
  assert.equal(restored.root.dataset.theme, 'light');
});

test('save chapter position and explicitly resume it without overwriting other stories', () => {
  const r = reader({ saved: { 'swb-reading:/Stories/': JSON.stringify({ another: { chapter: 'other', progress: .2 } }) } });
  r.windowListeners.load();
  r.window.scrollY = 14900;
  r.windowListeners.scroll();
  r.windowListeners.pagehide();
  const data = JSON.parse(r.values.get('swb-reading:/Stories/'));
  assert.equal(data.test.chapter, 'chapter-3');
  assert.ok(data.test.progress > .5 && data.test.progress < .9);
  assert.equal(data.another.progress, .2);
  const resumed = reader({ saved: Object.fromEntries(r.values), url: 'https://example.org/Stories/stories/test/?resume=1#chapter-3' });
  assert.equal(resumed.resumeLink.hidden, false);
  assert.match(resumed.resumeLink.href, /\/Stories\/stories\/test\/\?resume=1#chapter-3$/);
  resumed.windowListeners.load();
  assert.equal(resumed.window.scrollY, 14900);
  assert.equal(resumed.location.search, '');
  const direct = reader({ saved: Object.fromEntries(r.values), url: 'https://example.org/Stories/stories/test/#chapter-1' });
  direct.windowListeners.load();
  assert.equal(direct.window.scrollY, 0, 'ordinary story visits do not force a saved scroll position');
});

test('invalid bookmarks stay hidden and visiting the overview does not erase progress', () => {
  for (const value of ['{broken', '[]', JSON.stringify({ test: { chapter: 'deleted', progress: .5 } }), JSON.stringify({ test: { chapter: 'chapter-2', progress: 'oops' } })]) {
    const r = reader({ saved: { 'swb-reading:/Stories/': value } });
    assert.equal(r.resumeLink.hidden, true);
  }
  const saved = JSON.stringify({ test: { chapter: 'chapter-3', progress: .5 } });
  const r = reader({ saved: { 'swb-reading:/Stories/': saved } });
  r.windowListeners.load();
  r.windowListeners.pagehide();
  assert.equal(r.values.get('swb-reading:/Stories/'), saved);
});

test('returning to a cached homepage refreshes its Continue Reading link', () => {
  const r = reader({ story: false });
  assert.equal(r.resumeLink.hidden, true);
  r.values.set('swb-reading:/Stories/', JSON.stringify({ test: { chapter: 'chapter-4', progress: .4 } }));
  r.values.set('swb-theme', 'dark');
  r.windowListeners.pageshow();
  assert.equal(r.root.dataset.theme, 'dark');
  assert.equal(r.resumeLink.hidden, false);
  assert.match(r.resumeLink.href, /#chapter-4$/);
  r.values.delete('swb-reading:/Stories/');
  r.windowListeners.pageshow();
  assert.equal(r.resumeLink.hidden, true);
});
