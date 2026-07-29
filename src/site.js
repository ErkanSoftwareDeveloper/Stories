(function () {
  "use strict";

  const progress = document.querySelector("[data-reading-progress]");
  const storyBody = document.querySelector(".story-body");

  if (!progress || !storyBody) {
    return;
  }

  const updateProgress = () => {
    const documentElement = document.documentElement;
    const available = documentElement.scrollHeight - documentElement.clientHeight;
    const percentage = available > 0 ? (documentElement.scrollTop / available) * 100 : 0;
    progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  };

  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();

  const headings = [...storyBody.querySelectorAll("h2[id]")];
  const links = [...document.querySelectorAll('.reader-contents a[href^="#"]')];

  if (!headings.length || !links.length || !("IntersectionObserver" in window)) {
    return;
  }

  const linksById = new Map();
  for (const link of links) {
    const id = decodeURIComponent(link.hash.slice(1));
    const group = linksById.get(id) || [];
    group.push(link);
    linksById.set(id, group);
  }

  const setCurrent = (id) => {
    for (const link of links) {
      link.removeAttribute("aria-current");
    }
    for (const link of linksById.get(id) || []) {
      link.setAttribute("aria-current", "true");
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) {
        setCurrent(visible[0].target.id);
      }
    },
    { rootMargin: "-10% 0px -75% 0px" }
  );

  headings.forEach((heading) => observer.observe(heading));
  setCurrent(headings[0].id);
})();

