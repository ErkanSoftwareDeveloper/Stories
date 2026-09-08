(function () {
  "use strict";

  const storyBody = document.querySelector(".story-body");
  if (!storyBody) return;

  const progress = document.querySelector("[data-reading-progress]");
  const headings = [...storyBody.querySelectorAll("h2[id]")];
  const links = [...document.querySelectorAll('.reader-contents a[href^="#"]')];
  const picker = document.querySelector(".chapter-picker");
  const currentLabel = document.querySelector("[data-current-chapter]");
  const previous = document.querySelector("[data-previous]");
  const next = document.querySelector("[data-next]");
  let current = -1;
  let scheduled = false;

  function updateReading() {
    scheduled = false;
    const start = storyBody.getBoundingClientRect().top + window.scrollY;
    const available = storyBody.offsetHeight - window.innerHeight;
    const percentage = available > 0 ? ((window.scrollY - start) / available) * 100 : 0;
    if (progress) progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    let index = 0;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top <= 140) index = i;
      else break;
    }
    if (!headings.length || index === current) return;
    current = index;
    links.forEach((link) => {
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

  function jumpTo(heading, updateHash = true) {
    if (!heading) return;
    if (picker) picker.open = false;
    if (updateHash && location.hash !== `#${heading.id}`) history.pushState(null, "", `#${heading.id}`);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: "instant", block: "start" });
    updateReading();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const heading = headings.find((item) => `#${item.id}` === link.hash);
    if (heading) {
      event.preventDefault();
      jumpTo(heading);
    } else if (picker?.open && !picker.contains(event.target)) {
      picker.open = false;
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (picker?.open && !picker.contains(event.target)) picker.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && picker?.open) {
      picker.open = false;
      picker.querySelector("summary").focus();
    }
  });
  previous?.addEventListener("click", () => jumpTo(headings[current - 1]));
  next?.addEventListener("click", () => jumpTo(headings[current + 1]));
  if (headings.length) document.querySelector("[data-reader-steps]")?.removeAttribute("hidden");

  const smaller = document.querySelector("[data-smaller]");
  const larger = document.querySelector("[data-larger]");
  let size = 1.2;
  try {
    const saved = Number(localStorage.getItem("swb-reading-size"));
    if (saved >= 1 && saved <= 1.6) size = saved;
  } catch { /* Reading works when storage is unavailable. */ }
  function setSize(value) {
    size = Math.min(1.6, Math.max(1, Math.round(value * 10) / 10));
    storyBody.style.fontSize = `${size}rem`;
    if (smaller) smaller.disabled = size <= 1;
    if (larger) larger.disabled = size >= 1.6;
    try { localStorage.setItem("swb-reading-size", String(size)); } catch { /* Optional preference. */ }
    scheduleUpdate();
  }
  smaller?.addEventListener("click", () => setSize(size - 0.1));
  larger?.addEventListener("click", () => setSize(size + 0.1));
  document.querySelector("[data-reader-type]")?.removeAttribute("hidden");
  setSize(size);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", () => jumpTo(headings.find((heading) => `#${heading.id}` === location.hash), false));
  window.addEventListener("load", scheduleUpdate);
  if ("ResizeObserver" in window) new ResizeObserver(scheduleUpdate).observe(storyBody);
  updateReading();
})();
