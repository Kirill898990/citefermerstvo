/* Страница «Гидропоника»: переключатель «Фото / Схема», просмотр фото, появление блоков. */
import { esc, reveal, openLightbox } from "./ui.js";

// Переключатель «Фото / Схема» у каждой системы
document.querySelectorAll(".system__frame").forEach((frame) => {
  const seg = frame.querySelector(".system__switch");
  if (!seg) return; // у системы есть только схема
  const buttons = [...seg.querySelectorAll("[data-view]")];
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    const view = btn.dataset.view;
    frame.dataset.view = view;
    buttons.forEach((b, i) => {
      const active = b === btn;
      b.setAttribute("aria-pressed", active ? "true" : "false");
      if (active) seg.style.setProperty("--i", i);
    });
    frame.querySelector(".scheme")?.setAttribute("aria-hidden", view === "scheme" ? "false" : "true");
  });
});

// Фото открываются крупно
document.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-zoom]");
  if (!img || e.target.closest("a")) return;
  const system = img.closest(".system");
  const title = system?.querySelector(".system__title")?.childNodes[0]?.textContent.trim() || "Гидропоника";
  const credit = img.closest("figure")?.querySelector(".credit")?.innerHTML || "";
  openLightbox({
    src: img.currentSrc || img.src,
    alt: img.alt,
    infoHTML: `
      <h2 class="obs__plant">${esc(title)}</h2>
      <p class="obs__note">${esc(img.alt)}</p>
      ${credit ? `<p class="obs__note" style="margin-top:auto;font-size:13px">${credit}</p>` : ""}`,
  });
});

reveal();
