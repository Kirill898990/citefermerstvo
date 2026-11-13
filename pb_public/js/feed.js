/* Главная страница: лента наблюдений всех участников с лайками. */
import { pb, currentUser, errorMessage } from "./api.js";
import { esc, avatarHTML, icon, reveal, plural } from "./ui.js";
import { appendCards, skeletonHTML, loadMyLikes, bindCards, applyRemoteLike, hasCard, forget } from "./cards.js";

const PER_PAGE = 12;

const grid = document.getElementById("feed-grid");
const more = document.getElementById("feed-more");
const sortEl = document.getElementById("feed-sort");
const filterEl = document.getElementById("feed-filter");
const newPosts = document.getElementById("new-posts");
const feedSection = document.getElementById("feed");

const params = new URLSearchParams(location.search);
let sort = params.get("sort") === "popular" ? "popular" : "new";
let author = params.get("author") || "";

let page = 0;
let totalPages = 1;
let loading = false;
let generation = 0;
let totalObservations = null;

/* --------------------------------------------------------------- загрузка */
function listOptions() {
  return {
    sort: sort === "popular" ? "-likes_count,-created" : "-created",
    expand: "author",
    filter: author ? pb.filter("author = {:a}", { a: author }) : "",
  };
}

async function loadPage(reset = false) {
  if (loading && !reset) return;
  const gen = reset ? ++generation : generation;

  if (reset) {
    page = 0;
    totalPages = 1;
    grid.innerHTML = skeletonHTML(6);
    more.innerHTML = "";
  }
  if (page >= totalPages) return;

  loading = true;
  try {
    const res = await pb.collection("observations").getList(page + 1, PER_PAGE, listOptions());
    if (gen !== generation) return;

    if (page === 0) grid.innerHTML = "";
    page = res.page;
    totalPages = res.totalPages;

    if (page === 1 && author) renderFilter(res.items[0]?.expand?.author);

    if (!res.items.length && page === 1) {
      renderEmpty();
    } else {
      appendCards(grid, res.items);
      loadMyLikes(res.items.map((r) => r.id));
    }
    renderMore();
  } catch (err) {
    if (gen !== generation) return;
    renderError(err);
  } finally {
    if (gen === generation) loading = false;
  }
}

/* ------------------------------------------------------- состояния ленты */
function renderEmpty() {
  const me = currentUser();
  const own = author && me && me.id === author;
  const title = author ? (own ? "У вас пока нет наблюдений" : "У участника пока нет наблюдений") : "Пока здесь пусто";
  const text = author && !own
    ? "Загляните позже — возможно, скоро здесь появятся первые фотографии."
    : "Станьте первым: сфотографируйте своё растение и поделитесь наблюдением.";
  grid.innerHTML = `
    <div class="empty glass" style="grid-column:1/-1">
      <span class="empty__icon">${icon("sprout")}</span>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${author && !own ? "" : `<a class="btn btn--primary" href="/cabinet.html#upload">${icon("camera")}<span>Добавить наблюдение</span></a>`}
    </div>`;
}

function renderError(err) {
  grid.innerHTML = `
    <div class="empty glass" style="grid-column:1/-1">
      <span class="empty__icon">${icon("alert")}</span>
      <h3>Не удалось загрузить ленту</h3>
      <p>${esc(errorMessage(err))}</p>
      <button class="btn glass" type="button" data-glow data-retry><span>Повторить</span></button>
    </div>`;
  more.innerHTML = "";
}

let moreObserver = null;

function renderMore() {
  moreObserver?.disconnect();
  if (page < totalPages) {
    more.innerHTML = `<button class="btn glass" type="button" data-glow data-more><span>Показать ещё</span></button>`;
    if ("IntersectionObserver" in window) {
      moreObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) loadPage();
        },
        { rootMargin: "600px 0px" }
      );
      moreObserver.observe(more);
    }
  } else if (page > 1) {
    more.innerHTML = `<p class="lede lede--serif" style="text-align:center">Это все наблюдения — пока что.</p>`;
  } else {
    more.innerHTML = "";
  }
}

async function renderFilter(user) {
  if (!author) {
    filterEl.hidden = true;
    filterEl.innerHTML = "";
    return;
  }
  if (!user) {
    try {
      user = await pb.collection("users").getOne(author, { fields: "id,name,avatar,collectionId" });
    } catch {
      user = { id: author, name: "Участник" };
    }
  }
  const me = currentUser();
  const label = me && me.id === author ? "Мои наблюдения" : `Наблюдения: ${user.name || "участник"}`;
  filterEl.innerHTML = `
    ${avatarHTML(user)}
    <span>${esc(label)}</span>
    <button type="button" data-clear-filter aria-label="Показать всех">${icon("x")}</button>`;
  filterEl.hidden = false;
}

/* ------------------------------------------------------------ сортировка */
function syncSortUI() {
  const buttons = [...sortEl.querySelectorAll("[data-sort]")];
  buttons.forEach((b, i) => {
    const active = b.dataset.sort === sort;
    b.setAttribute("aria-pressed", active ? "true" : "false");
    if (active) sortEl.style.setProperty("--i", i);
  });
}

function syncURL() {
  const url = new URL(location.href);
  url.searchParams.delete("sort");
  url.searchParams.delete("author");
  if (sort === "popular") url.searchParams.set("sort", "popular");
  if (author) url.searchParams.set("author", author);
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

sortEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sort]");
  if (!btn || btn.dataset.sort === sort) return;
  sort = btn.dataset.sort;
  syncSortUI();
  syncURL();
  loadPage(true);
});

filterEl.addEventListener("click", (e) => {
  if (!e.target.closest("[data-clear-filter]")) return;
  author = "";
  renderFilter();
  syncURL();
  loadPage(true);
});

more.addEventListener("click", (e) => {
  if (e.target.closest("[data-more]")) loadPage();
});

grid.addEventListener("click", (e) => {
  if (e.target.closest("[data-retry]")) loadPage(true);
});

// Переход по ссылке автора внутри ленты — без перезагрузки страницы
grid.addEventListener(
  "click",
  (e) => {
    const link = e.target.closest("a.author");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname) return;
    e.preventDefault();
    author = url.searchParams.get("author") || "";
    syncURL();
    feedSection.scrollIntoView({ behavior: "smooth" });
    loadPage(true);
  },
  true
);

bindCards(grid);

/* ------------------------------------------------------- счётчик в герое */
function setObservationsCount(n) {
  totalObservations = n;
  const el = document.querySelector('[data-count="observations"]');
  const label = document.querySelector("[data-count-label]");
  if (!el) return;
  label.textContent = plural(n, "наблюдение", "наблюдения", "наблюдений");

  const from = Number(el.dataset.value || 0);
  el.dataset.value = n;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(n - from) > 500) {
    el.textContent = n.toLocaleString("ru");
    return;
  }
  const start = performance.now();
  const dur = 900;
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (n - from) * eased).toLocaleString("ru");
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function loadFacts() {
  const topics = document.querySelector('[data-count="topics"]');
  if (topics) topics.textContent = Object.keys(window.SITE.topics).length;
  try {
    const res = await pb.collection("observations").getList(1, 1, { fields: "id" });
    setObservationsCount(res.totalItems);
  } catch {
    /* герой без счётчика — не страшно */
  }
}

/* ------------------------------------------------------ реальное время */
function feedTopVisible() {
  return grid.getBoundingClientRect().top > -40;
}

newPosts.addEventListener("click", () => {
  newPosts.classList.remove("is-visible");
  feedSection.scrollIntoView({ behavior: "smooth" });
});

window.addEventListener(
  "scroll",
  () => {
    if (feedTopVisible()) newPosts.classList.remove("is-visible");
  },
  { passive: true }
);

async function subscribe() {
  try {
    await pb.collection("observations").subscribe(
      "*",
      (e) => {
        if (e.action === "create") {
          if (totalObservations !== null) setObservationsCount(totalObservations + 1);
          if (sort !== "new" || (author && e.record.author !== author) || hasCard(e.record.id)) return;
          grid.querySelector(".empty")?.remove();
          appendCards(grid, [e.record], { prepend: true });
          if (!feedTopVisible()) newPosts.classList.add("is-visible");
        } else if (e.action === "delete") {
          if (totalObservations !== null) setObservationsCount(Math.max(0, totalObservations - 1));
          const card = grid.querySelector(`.obs[data-id="${CSS.escape(e.record.id)}"]`);
          forget(e.record.id);
          if (card) {
            card.classList.add("is-leaving");
            card.addEventListener("animationend", () => card.remove(), { once: true });
          }
        }
      },
      { expand: "author" }
    );
    await pb.collection("likes").subscribe("*", (e) => applyRemoteLike(e.action, e.record));
  } catch (err) {
    console.warn("Реальное время недоступно", err);
  }
}

/* ------------------------------------------------------------------ старт */
syncSortUI();
reveal();
loadFacts();
loadPage(true);
subscribe();
