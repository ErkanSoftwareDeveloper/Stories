// Runs before the stylesheet to avoid flashing the wrong saved theme.
(function () {
  try {
    const preference = localStorage.getItem("swb-theme");
    if (preference === "light" || preference === "dark") {
      document.documentElement.dataset.theme = preference;
    }
  } catch { /* System colors still work without storage or JavaScript. */ }
})();
