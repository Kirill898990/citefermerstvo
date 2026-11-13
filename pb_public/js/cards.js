/*
 * Карточки наблюдений и лайки — общие для ленты на главной и личного кабинета.
 */
import { pb, currentUser, fileUrl, parseDate, errorMessage } from "./api.js";
import { esc, avatarHTML, icon, timeAgo, toast, openLightbox, fadeInImages, confirmDialog } from "./ui.js";

/** id наблюдения → { record, liked, likeId, count, pending } */
const state = new Map();

function ensureState(record) {
  let s = state.get(record.id);
  if (!s) {
    s = { record, liked: false, likeId: null, count: record.likes_count || 0, pending: false };
    state.set(record.id, s);
  } else {
    s.record = record;
    if (!s.pending) s.count = record.likes_count || 0;
  }
  return s;
}

export function forget(id) {
  state.delete(id);
}

export function hasCard(id) {
  return state.has(id);
}

/* ------------------------------------------------------------ разметка */
function authorHTML(author, created) {
  const date = parseDate(created);
  const name = author?.name || "Участник";
  const href = author ? `/?author=${encodeURIComponent(author.id)}#feed` : "#";
  return `
    <a class="author" href="${esc(href)}" title="Все наблюдения: ${esc(name)}">
      ${avatarHTML(author || {})}
      <span class="author__meta">
        <span class="author__name">${esc(name)}</span>
        <time class="author__time" datetime="${Number.isNaN(date.getTime()) ? "" : date.toISOString()}">${esc(timeAgo(date))}</time>
      </span>
    </a>`;
}

function likeHTML(id) {
  const s = state.get(id);
  return `
    <button class="like" type="button" data-like="${esc(id)}" aria-pressed="${s?.liked ? "true" : "false"}" aria-label="Нравится">
      ${icon("heart")}<span class="like__count">${s?.count || 0}</span>
    </button>`;
}

export function cardHTML(record, { index = 0, deletable = false } = {}) {
  ensureState(record);
  const author = record.expand?.author;
  return `
    <article class="obs" data-id="${esc(record.id)}" style="--d:${index % 12}">
      <div class="obs__media" data-open role="button" tabindex="0" aria-label="Открыть фото: ${esc(record.plant)}">
        <img data-fade src="${esc(fileUrl(record, record.photo, "640x0"))}" alt="${esc(record.plant)}" loading="lazy" decoding="async">
        ${record.stage ? `<span class="obs__stage">${esc(record.stage)}</span>` : ""}
        ${deletable ? `<button class="obs__delete" type="button" data-delete aria-label="Удалить наблюдение">${icon("trash")}</button>` : ""}
      </div>
      <div class="obs__body">
        <h3 class="obs__plant">${esc(record.plant)}</h3>
        ${record.note ? `<p class="obs__note">${esc(record.note)}</p>` : ""}
        <div class="obs__foot">
          ${authorHTML(author, record.created)}
          ${likeHTML(record.id)}
        </div>
      </div>
    </article>`;
}

export function skeletonHTML(count = 6) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <div class="obs obs--skeleton" aria-hidden="true">
        <div class="obs__media"></div>
        <div class="obs__body">
          <span class="skel" style="width:58%;height:24px"></span>
          <span class="skel" style="width:90%"></span>
          <span class="skel" style="width:70%"></span>
        </div>
      </div>`;
  }
  return html;
}

/** Вставить карточки в контейнер (в конец или в начало) */
export function appendCards(container, records, { prepend = false, deletable = false, offset = 0 } = {}) {
  const tpl = document.createElement("template");
  tpl.innerHTML = records.map((r, i) => cardHTML(r, { index: offset + i, deletable })).join("");
  const nodes = [...tpl.content.children];
  if (prepend) container.prepend(...nodes);
  else container.append(...nodes);
  nodes.forEach((n) => fadeInImages(n));
  return nodes;
}

/* ---------------------------------------------------------------- лайки */
function renderLike(id, { pop = false, direction = 0 } = {}) {
  const s = state.get(id);
  if (!s) return;
  document.querySelectorAll(`[data-like="${CSS.escape(id)}"]`).forEach((btn) => {
    btn.setAttribute("aria-pressed", s.liked ? "true" : "false");
    const counter = btn.querySelector(".like__count");
    if (counter && counter.textContent !== String(s.count)) {
      counter.textContent = String(s.count);
      if (direction) {
        counter.style.setProperty("--from", direction > 0 ? "8px" : "-8px");
        counter.classList.remove("is-ticking");
        void counter.offsetWidth;
        counter.classList.add("is-ticking");
      }
    }
    if (pop) {
      btn.classList.remove("is-popping");
      void btn.offsetWidth;
      btn.classList.add("is-popping");
      burst(btn);
    }
  });
}

function burst(btn) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const b = document.createElement("span");
  b.className = "burst";
  b.innerHTML = Array.from({ length: 8 }, (_, i) => `<i style="--a:${i * 45}"></i>`).join("");
  btn.append(b);
  setTimeout(() => b.remove(), 700);
}

/** Узнать, какие из наблюдений уже лайкнуты текущим пользователем */
export async function loadMyLikes(ids) {
  const user = currentUser();
  if (!user || !ids.length) return;
  const params = { u: user.id };
  const parts = ids.map((id, i) => {
    params["o" + i] = id;
    return `observation = {:o${i}}`;
  });
  try {
    const likes = await pb.collection("likes").getFullList({
      filter: pb.filter(`user = {:u} && (${parts.join(" || ")})`, params),
      fields: "id,observation",
    });
    for (const like of likes) {
      const s = state.get(like.observation);
      if (s && !s.pending) {
        s.liked = true;
        s.likeId = like.id;
        renderLike(like.observation);
      }
    }
  } catch (err) {
    console.warn("Не удалось загрузить лайки", err);
  }
}

export async function toggleLike(id, { onlyLike = false } = {}) {
  const user = currentUser();
  if (!user) {
    toast("Войдите, чтобы ставить лайки", {
      type: "info",
      action: { href: "/cabinet.html#login", label: "Войти" },
    });
    return;
  }
  const s = state.get(id);
  if (!s || s.pending) return;
  if (onlyLike && s.liked) {
    renderLike(id, { pop: true });
    return;
  }

  const wantLike = !s.liked;
  s.pending = true;
  s.liked = wantLike;
  s.count = Math.max(0, s.count + (wantLike ? 1 : -1));
  renderLike(id, { pop: wantLike, direction: wantLike ? 1 : -1 });

  try {
    if (wantLike) {
      try {
        const like = await pb.collection("likes").create({ user: user.id, observation: id });
        s.likeId = like.id;
      } catch (err) {
        // уже лайкнуто (например, в другой вкладке) — просто синхронизируемся
        if (err?.response?.data?.observation?.code === "validation_not_unique") {
          const existing = await pb
            .collection("likes")
            .getFirstListItem(pb.filter("user = {:u} && observation = {:o}", { u: user.id, o: id }));
          s.likeId = existing.id;
          s.count = Math.max(0, s.count - 1);
        } else {
          throw err;
        }
      }
    } else {
      let likeId = s.likeId;
      if (!likeId) {
        const existing = await pb
          .collection("likes")
          .getFirstListItem(pb.filter("user = {:u} && observation = {:o}", { u: user.id, o: id }));
        likeId = existing.id;
      }
      try {
        await pb.collection("likes").delete(likeId);
      } catch (err) {
        if (err?.status !== 404) throw err;
      }
      s.likeId = null;
    }
  } catch (err) {
    s.liked = !wantLike;
    s.count = Math.max(0, s.count + (wantLike ? -1 : 1));
    toast(errorMessage(err, "Не удалось сохранить лайк"), { type: "error" });
  } finally {
    s.pending = false;
    renderLike(id);
  }
}

/** Лайк пришёл в реальном времени (от другого человека или из другой вкладки) */
export function applyRemoteLike(action, like) {
  const s = state.get(like.observation);
  if (!s || s.pending) return;
  const me = currentUser();
  const mine = me && like.user === me.id;

  if (action === "create") {
    if (mine) {
      if (s.liked) {
        s.likeId = like.id;
        return;
      }
      s.liked = true;
      s.likeId = like.id;
    }
    s.count += 1;
    renderLike(like.observation, { direction: 1 });
  } else if (action === "delete") {
    if (mine) {
      if (!s.liked) return;
      s.liked = false;
      s.likeId = null;
    }
    s.count = Math.max(0, s.count - 1);
    renderLike(like.observation, { direction: -1 });
  }
}

/* ----------------------------------------------------------- просмотр */
function openObservation(id) {
  const s = state.get(id);
  if (!s) return;
  const r = s.record;
  const author = r.expand?.author;
  openLightbox({
    src: fileUrl(r, r.photo, "1280x0"),
    alt: r.plant,
    infoHTML: `
      ${r.stage ? `<span class="obs__stage">${esc(r.stage)}</span>` : ""}
      <h2 class="obs__plant">${esc(r.plant)}</h2>
      ${r.note ? `<p class="obs__note">${esc(r.note)}</p>` : ""}
      <div class="obs__foot">
        ${authorHTML(author, r.created)}
        ${likeHTML(id)}
      </div>`,
    onReady(dialog) {
      dialog.addEventListener("click", (e) => {
        const like = e.target.closest("[data-like]");
        if (like) toggleLike(like.dataset.like);
      });
    },
  });
}

function showBigHeart(media) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "big-heart");
  svg.innerHTML =
    '<path d="M12 20.3s-7.6-4.5-9.4-9.4C1.3 7.6 3.4 4.2 7 4.2c2.1 0 3.8 1.2 5 3 1.2-1.8 2.9-3 5-3 3.6 0 5.7 3.4 4.4 6.7-1.8 4.9-9.4 9.4-9.4 9.4z"/>';
  media.append(svg);
  svg.addEventListener("animationend", () => svg.remove(), { once: true });
}

/**
 * Делегирование событий для контейнера с карточками:
 * лайк, двойной тап по фото (лайк), одиночный — открыть фото, удаление.
 */
export function bindCards(container, { onDelete } = {}) {
  let tapTimer = 0;
  let tapTarget = null;

  container.addEventListener("click", (e) => {
    const like = e.target.closest("[data-like]");
    if (like) {
      toggleLike(like.dataset.like);
      return;
    }

    const del = e.target.closest("[data-delete]");
    if (del) {
      e.stopPropagation();
      const card = del.closest(".obs");
      if (card && onDelete) onDelete(card.dataset.id, card);
      return;
    }

    const media = e.target.closest("[data-open]");
    if (!media) return;
    const id = media.closest(".obs")?.dataset.id;
    if (!id) return;

    if (tapTimer && tapTarget === media) {
      clearTimeout(tapTimer);
      tapTimer = 0;
      tapTarget = null;
      showBigHeart(media);
      toggleLike(id, { onlyLike: true });
      return;
    }
    tapTarget = media;
    tapTimer = setTimeout(() => {
      tapTimer = 0;
      tapTarget = null;
      openObservation(id);
    }, 260);
  });

  container.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open]")) {
      e.preventDefault();
      const id = e.target.closest(".obs")?.dataset.id;
      if (id) openObservation(id);
    }
  });
}

/** Удаление своего наблюдения с подтверждением */
export async function deleteObservation(id, card) {
  const ok = await confirmDialog({
    title: "Удалить наблюдение?",
    text: "Фото и все лайки к нему будут удалены без возможности восстановления.",
  });
  if (!ok) return false;
  try {
    await pb.collection("observations").delete(id);
    forget(id);
    if (card) {
      card.classList.add("is-leaving");
      card.addEventListener("animationend", () => card.remove(), { once: true });
    }
    toast("Наблюдение удалено");
    return true;
  } catch (err) {
    toast(errorMessage(err, "Не удалось удалить"), { type: "error" });
    return false;
  }
}
