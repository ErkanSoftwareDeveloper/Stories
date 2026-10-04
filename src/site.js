(function () {
  "use strict";

  // Preferences are optional: private browsing and storage limits must never
  // prevent someone from reading, navigating or changing the current theme.
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Optional. */ } }
  };
  const root = document.documentElement;
  const themeButton = document.querySelector("[data-theme-toggle]");
  const modes = ["system", "light", "dark"];
  let theme = modes.includes(storage.get("swb-theme")) ? storage.get("swb-theme") : "system";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    if (themeButton) {
      themeButton.hidden = false;
      themeButton.querySelector("[data-theme-label]").textContent = theme[0].toUpperCase() + theme.slice(1);
      themeButton.setAttribute("aria-label", `Theme: ${theme}. Switch to ${modes[(modes.indexOf(theme) + 1) % modes.length]} theme.`);
    }
    const dark = theme === "dark" || (theme === "system" && systemTheme.matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#172125" : "#f6f3ec");
  }
  themeButton?.addEventListener("click", () => {
    theme = modes[(modes.indexOf(theme) + 1) % modes.length];
    storage.set("swb-theme", theme);
    applyTheme();
  });
  systemTheme.addEventListener("change", applyTheme);
  applyTheme();

  const bookmarkKey = `swb-reading:${document.body.dataset.basePath || "/"}`;
  let bookmarks = {};
  function validBookmark(saved, ids) {
    return saved && ids.includes(saved.chapter) && Number.isFinite(saved.progress) && saved.progress >= 0 && saved.progress <= 1;
  }
  function refreshResumeLinks() {
    try {
      const latest = JSON.parse(storage.get(bookmarkKey));
      bookmarks = latest && typeof latest === "object" && !Array.isArray(latest) ? latest : {};
    } catch { bookmarks = {}; }
    document.querySelectorAll("[data-resume-story]").forEach((link) => {
      const saved = bookmarks[link.dataset.resumeStory];
      let ids = [];
      try { ids = JSON.parse(link.dataset.chapterIds); } catch { return; }
      if (!validBookmark(saved, ids)) { link.hidden = true; return; }
      const url = new URL(link.href);
      url.searchParams.set("resume", "1");
      url.hash = saved.chapter;
      link.href = url.href;
      link.hidden = false;
      link.querySelector("[data-resume-label]").textContent = `${ids.indexOf(saved.chapter) + 1} of ${ids.length} sections · ${Math.round(saved.progress * 100)}% through this section`;
    });
  }
  refreshResumeLinks();
  window.addEventListener("pageshow", () => {
    const savedTheme = storage.get("swb-theme");
    if (modes.includes(savedTheme)) theme = savedTheme;
    applyTheme();
    refreshResumeLinks();
  });

  const storyBody = document.querySelector(".story-body");
  if (!storyBody) return;
  const slug = document.querySelector("[data-story-slug]").dataset.storySlug;
  const progress = document.querySelector("[data-reading-progress]");
  const progressLabel = document.querySelector("[data-progress-label]");
  const headings = [...storyBody.querySelectorAll("h2[id]")];
  const links = [...document.querySelectorAll('.reader-contents a[href^="#"]')];
  const picker = document.querySelector(".chapter-picker");
  const settings = document.querySelector(".reader-settings");
  const currentLabel = document.querySelector("[data-current-chapter]");
  const previous = document.querySelector("[data-previous]");
  const next = document.querySelector("[data-next]");
  const toolbar = document.querySelector(".reader-tools");
  const savedBookmark = bookmarks[slug];
  const wantsResume = new URLSearchParams(location.search).get("resume") === "1";
  let restoring = wantsResume;
  let current = -1;
  let scheduled = false;
  let saveTimer;
  let pendingBookmark;
  const topOf = element => element.getBoundingClientRect().top + window.scrollY;
  const readingOffset = () => toolbar.offsetHeight + 28;

  function flushBookmark() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!pendingBookmark) return;
    // Merge current storage so another story open in a tab is not discarded.
    try {
      const latest = JSON.parse(storage.get(bookmarkKey));
      if (latest && typeof latest === "object" && !Array.isArray(latest)) bookmarks = latest;
    } catch { /* Keep in-memory progress. */ }
    bookmarks[slug] = pendingBookmark;
    storage.set(bookmarkKey, JSON.stringify(bookmarks));
    pendingBookmark = null;
  }

  function updateReading() {
    scheduled = false;
    const cursor = window.scrollY + readingOffset();
    let index = 0;
    for (let i = 0; i < headings.length; i++) {
      if (topOf(headings[i]) <= cursor + 2) index = i;
      else break;
    }
    const start = topOf(headings[index] || storyBody);
    const end = headings[index + 1] ? topOf(headings[index + 1]) : topOf(storyBody) + storyBody.offsetHeight;
    const available = Math.max(1, end - start - (window.innerHeight - readingOffset()));
    const fraction = Math.min(1, Math.max(0, (cursor - start) / available));
    if (progress) progress.style.width = `${fraction * 100}%`;
    if (progressLabel) {
      progressLabel.hidden = false;
      progressLabel.textContent = `${Math.round(fraction * 100)}%`;
    }
    if (!restoring && cursor >= start && headings[index]) {
      pendingBookmark = { chapter: headings[index].id, progress: fraction, updatedAt: Date.now() };
      if (!saveTimer) saveTimer = setTimeout(flushBookmark, 600);
    }
    if (!headings.length || index === current) return;
    current = index;
    links.forEach(link => {
      if (link.hash === `#${headings[index].id}`) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    if (currentLabel) currentLabel.textContent = headings[index].textContent;
    if (previous) previous.disabled = index === 0;
    if (next) next.disabled = index === headings.length - 1;
  }
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateReading);
  }
  function closePanels() {
    if (picker) picker.open = false;
    if (settings) settings.open = false;
  }
  function jumpTo(heading, updateHash = true) {
    if (!heading) return;
    closePanels();
    restoring = false;
    if (updateHash && location.hash !== `#${heading.id}`) history.pushState(null, "", `#${heading.id}`);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: topOf(heading) - readingOffset(), behavior: "instant" });
    updateReading();
  }
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const heading = headings.find(item => `#${item.id}` === link.hash);
    if (heading) {
      event.preventDefault();
      jumpTo(heading);
    } else if (link.hash === "#chapters" && picker) {
      event.preventDefault();
      if (settings) settings.open = false;
      picker.open = true;
      picker.querySelector("summary").focus({ preventScroll: true });
      picker.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
    } else if (link.hash === "#story-title") closePanels();
  });
  document.addEventListener("pointerdown", event => {
    if (!toolbar.contains(event.target)) closePanels();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const openPanel = [picker, settings].find(panel => panel?.open);
    if (openPanel) {
      openPanel.open = false;
      openPanel.querySelector("summary").focus();
    }
  });
  [picker, settings].forEach(panel => {
    panel?.addEventListener("toggle", () => {
      if (panel.open) {
        const other = panel === picker ? settings : picker;
        if (other) other.open = false;
      }
    });
  });
  toolbar.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      if (!toolbar.contains(document.activeElement)) closePanels();
    });
  });
  previous?.addEventListener("click", () => jumpTo(headings[current - 1]));
  next?.addEventListener("click", () => jumpTo(headings[current + 1]));
  if (headings.length) document.querySelector("[data-reader-steps]")?.removeAttribute("hidden");

  const smaller = document.querySelector("[data-smaller]");
  const larger = document.querySelector("[data-larger]");
  const sizeLabel = document.querySelector("[data-size-label]");
  const savedSize = Number(storage.get("swb-reading-size"));
  let size = savedSize >= 1 && savedSize <= 1.6 ? savedSize : 1.2;
  function setSize(value) {
    size = Math.min(1.6, Math.max(1, Math.round(value * 10) / 10));
    storyBody.style.fontSize = `${size}rem`;
    if (smaller) smaller.disabled = size <= 1;
    if (larger) larger.disabled = size >= 1.6;
    if (sizeLabel) sizeLabel.textContent = `${Math.round(size / 1.2 * 100)}%`;
    storage.set("swb-reading-size", String(size));
    scheduleUpdate();
  }
  smaller?.addEventListener("click", () => setSize(size - .1));
  larger?.addEventListener("click", () => setSize(size + .1));
  document.querySelector("[data-reader-type]")?.removeAttribute("hidden");
  setSize(size);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("pagehide", flushBookmark);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushBookmark(); });
  window.addEventListener("hashchange", () => jumpTo(headings.find(heading => `#${heading.id}` === location.hash), false));
  function restoreReading() {
    if (wantsResume && validBookmark(savedBookmark, headings.map(heading => heading.id)) && location.hash === `#${savedBookmark.chapter}`) {
      const index = headings.findIndex(heading => heading.id === savedBookmark.chapter);
      const start = topOf(headings[index]);
      const end = headings[index + 1] ? topOf(headings[index + 1]) : topOf(storyBody) + storyBody.offsetHeight;
      const available = Math.max(1, end - start - (window.innerHeight - readingOffset()));
      window.scrollTo({ top: start + available * savedBookmark.progress - readingOffset(), behavior: "instant" });
      // A reload should use ordinary browser restoration after this explicit resume.
      const url = new URL(location.href);
      url.searchParams.delete("resume");
      history.replaceState(null, "", url);
    }
    restoring = false;
    updateReading();
  }
  // Safari can apply its initial fragment scroll after the load event. Wait
  // for layout to settle before restoring an explicit saved position.
  const afterLayout = () => window.requestAnimationFrame(() => window.requestAnimationFrame(restoreReading));
  if (document.readyState === "complete") afterLayout();
  else window.addEventListener("load", afterLayout, { once: true });
  if ("ResizeObserver" in window) new ResizeObserver(scheduleUpdate).observe(storyBody);
  updateReading();
})();
