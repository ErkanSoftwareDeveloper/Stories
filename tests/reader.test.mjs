import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const script = await fs.readFile(new URL('../src/site.js', import.meta.url), 'utf8');
function reader({ storageBlocked = false } = {}) {
  const listeners = {};
  const windowListeners = {};
  const element = () => ({
    style: {}, attrs: {}, handlers: {}, disabled: false,
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    addEventListener(key, fn) { this.handlers[key] = fn; },
    focus() { this.focused = true; },
  });
  const window = { scrollY: 0, innerHeight: 800, requestAnimationFrame(fn) { fn(); }, addEventListener(key, fn) { windowListeners[key] = fn; } };
  const headings = Array.from({length: 6}, (_, index) => ({
    ...element(), id: `chapter-${index}`, textContent: `Chapter ${index}`,
    getBoundingClientRect() { return { top: 600 + index * 4000 - window.scrollY }; },
    scrollIntoView(options) { this.scrollOptions = options; window.scrollY = 600 + index * 4000 - 32; },
  }));
  const links = headings.map(heading => ({ ...element(), hash: `#${heading.id}` }));
  const summary = element();
  const picker = { ...element(), open: false, contains() { return false; }, querySelector() { return summary; } };
  const body = { ...element(), offsetHeight: 24000, getBoundingClientRect() { return { top: 600 - window.scrollY }; }, querySelectorAll() { return headings; } };
  const elements = { '.story-body': body, '.chapter-picker': picker };
  for (const key of ['reading-progress', 'current-chapter', 'previous', 'next', 'reader-steps', 'reader-type', 'smaller', 'larger']) elements[`[data-${key}]`] = element();
  const location = { hash: '' };
  const history = { pushState(_, __, hash) { location.hash = hash; } };
  vm.runInNewContext(script, {
    document: { querySelector: key => elements[key], querySelectorAll: () => links, addEventListener(key, fn) { listeners[key] = fn; } },
    window, location, history,
    localStorage: { getItem() { if (storageBlocked) throw new Error('blocked'); return null; }, setItem() { if (storageBlocked) throw new Error('blocked'); } },
  });
  return { window, windowListeners, listeners, headings, links, picker, summary, body, elements, location };
}

test('jump directly to the last chapter, close menu, focus heading and update controls', () => {
  const r = reader();
  r.picker.open = true;
  let prevented = false;
  r.listeners.click({ target: { closest: () => r.links[5] }, preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(r.location.hash, '#chapter-5');
  assert.equal(r.picker.open, false);
  assert.equal(r.headings[5].focused, true);
  assert.equal(r.headings[5].scrollOptions.behavior, 'instant');
  assert.equal(r.elements['[data-next]'].disabled, true);
  assert.equal(r.links[5].attrs['aria-current'], 'true');
  r.elements['[data-previous]'].handlers.click();
  assert.equal(r.location.hash, '#chapter-4');
});

test('manual scrolling and browser hash navigation keep the chapter indicator in sync', () => {
  const r = reader();
  r.window.scrollY = 12700;
  r.windowListeners.scroll();
  assert.equal(r.elements['[data-current-chapter]'].textContent, 'Chapter 3');
  r.location.hash = '#chapter-1';
  r.windowListeners.hashchange();
  assert.equal(r.links[1].attrs['aria-current'], 'true');
  assert.equal(r.links[3].attrs['aria-current'], undefined);
});

test('Escape closes the menu and text sizing remains bounded with storage blocked', () => {
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
});
