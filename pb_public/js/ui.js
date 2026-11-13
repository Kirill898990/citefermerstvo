/* Общие элементы интерфейса: тосты, диалоги, анимации появления, форматирование. */

export const esc = window.Site.esc;
export const avatarHTML = window.Site.avatarHTML;
export const icon = window.icon;

/* ------------------------------------------------------------- склонения */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ---------------------------------------------------- «5 минут назад» */
const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });
const dateFmtYear = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

export function timeAgo(date) {
  const diff = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (Number.isNaN(abs)) return "";
  if (abs < 45) return "только что";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return (date.getFullYear() === new Date().getFullYear() ? dateFmt : dateFmtYear).format(date);
}

/* ---------------------------------------------------------------- тосты */
let toastHost = null;

export function toast(message, { type = "success", action = null, duration = 3600 } = {}) {
  if (!message) return;
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.className = "toasts";
    toastHost.setAttribute("role", "status");
    toastHost.setAttribute("aria-live", "polite");
    document.body.append(toastHost);
  }
  const el = document.createElement("div");
  el.className = `toast glass toast--${type}`;
  el.innerHTML =
    icon(type === "error" ? "alert" : type === "info" ? "sparkle" : "check") +
    `<span>${esc(message)}</span>` +
    (action ? `<a class="link" href="${esc(action.href)}">${esc(action.label)}</a>` : "");
  toastHost.append(el);

  const remove = () => {
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  setTimeout(remove, duration);
  return el;
}

/* ------------------------------------------------ появление при прокрутке */
const revealObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      )
    : null;

export function reveal(root = document) {
  root.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add("is-visible");
  });
}

/* ----------------------------------------------------------- диалоги */
function closeDialog(dialog) {
  return new Promise((resolve) => {
    if (!dialog.open) return resolve();
    dialog.classList.add("is-closing");
    const panel = dialog.querySelector(".dialog__panel, .lightbox__panel");
    const done = () => {
      dialog.classList.remove("is-closing");
      dialog.close();
      resolve();
    };
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
    panel.addEventListener("animationend", done, { once: true });
    setTimeout(done, 400);
  });
}

export function confirmDialog({ title, text = "", confirm = "Удалить", cancel = "Отмена", danger = true }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <div class="dialog__panel glass" role="document">
        <h3>${esc(title)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ""}
        <div class="dialog__actions">
          <button class="btn glass" type="button" data-glow value="cancel"><span>${esc(cancel)}</span></button>
          <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" value="ok"><span>${esc(confirm)}</span></button>
        </div>
      </div>`;
    document.body.append(dialog);

    let result = false;
    const finish = async () => {
      await closeDialog(dialog);
      dialog.remove();
      resolve(result);
    };

    dialog.addEventListener("click", (e) => {
      const btn = e.target.closest("button[value]");
      if (btn) {
        result = btn.value === "ok";
        finish();
      } else if (e.target === dialog) {
        finish();
      }
    });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish();
    });

    dialog.showModal();
    dialog.querySelector('button[value="cancel"]').focus();
  });
}

/** Полноэкранный просмотр фото; infoHTML — содержимое боковой колонки. */
export function openLightbox({ src, alt, infoHTML, onReady }) {
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.innerHTML = `
    <div class="lightbox__inner">
      <div class="lightbox__panel glass">
        <div class="lightbox__img"><img src="${esc(src)}" alt="${esc(alt)}"></div>
        <div class="lightbox__info">${infoHTML}</div>
      </div>
      <button class="lightbox__close glass" type="button" data-glow aria-label="Закрыть">${icon("x")}</button>
    </div>`;
  document.body.append(dialog);

  const finish = async () => {
    await closeDialog(dialog);
    dialog.remove();
  };

  dialog.addEventListener("click", (e) => {
    if (e.target.closest(".lightbox__close") || e.target.classList.contains("lightbox__inner")) finish();
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    finish();
  });

  dialog.showModal();
  onReady?.(dialog);
  return dialog;
}

/* --------------------------------------------------- сжатие фотографий */
/**
 * Уменьшает фото перед загрузкой (до maxSide пикселей по длинной стороне)
 * и сохраняет в JPEG. Учитывает поворот из EXIF. GIF оставляет как есть.
 */
export async function compressImage(file, { maxSide = 2048, quality = 0.86, square = false } = {}) {
  if (!file) throw new Error("Выберите фото.");
  // Пустой MIME бывает у HEIC в некоторых браузерах — тогда просто пробуем прочитать файл.
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Выберите файл изображения (JPG, PNG или WebP).");
  }
  if (file.type === "image/gif") return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Не удалось прочитать фото. Попробуйте JPG или PNG.");
  }

  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }

  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Не удалось обработать фото.");

  const base = (file.name || "photo").replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40) || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** Плавное появление картинки после загрузки */
export function fadeInImages(root) {
  root.querySelectorAll("img[data-fade]").forEach((img) => {
    const done = () => img.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

export function setBusy(button, busy) {
  if (!button) return;
  button.setAttribute("aria-busy", busy ? "true" : "false");
  button.disabled = !!busy;
}
