/* Личный кабинет: вход и регистрация, профиль, загрузка наблюдений, мои публикации. */
import { pb, currentUser, errorMessage } from "./api.js";
import { esc, avatarHTML, icon, toast, reveal, plural, compressImage, setBusy } from "./ui.js";
import { appendCards, skeletonHTML, loadMyLikes, bindCards, deleteObservation, hasCard } from "./cards.js";

const root = document.getElementById("cabinet-root");
const STAGES = ["Посев", "Всходы", "Рост", "Цветение", "Плодоношение", "Урожай"];
const PLANTS = [
  "Базилик", "Руккола", "Салат", "Шпинат", "Петрушка", "Укроп", "Мята", "Кинза", "Лук",
  "Микрозелень", "Горох", "Редис", "Томат", "Огурец", "Перец", "Клубника", "Пшеница",
];

function hashTab() {
  return location.hash === "#register" ? "register" : "login";
}

/* ======================================================= вход и регистрация */
function renderAuth() {
  const wantsUpload = location.hash === "#upload";
  root.innerHTML = `
    <section class="auth container">
      <div class="panel glass reveal">
        <div class="auth__head">
          <h1>Личный <em class="it it--accent">кабинет</em></h1>
          <p>${
            wantsUpload
              ? "Войдите или зарегистрируйтесь, чтобы загрузить фото наблюдения."
              : "Войдите, чтобы делиться наблюдениями и ставить лайки."
          }</p>
        </div>

        <div class="segmented" style="--n:2" role="tablist" aria-label="Вход или регистрация">
          <span class="segmented__thumb"></span>
          <button type="button" role="tab" data-tab="login" aria-selected="true" aria-controls="login-form">Вход</button>
          <button type="button" role="tab" data-tab="register" aria-selected="false" aria-controls="register-form">Регистрация</button>
        </div>

        <form id="login-form" novalidate>
          <div class="field">
            <label class="field__label" for="login-email">E-mail</label>
            <input class="input" id="login-email" name="email" type="email" autocomplete="email" inputmode="email" required placeholder="name@example.ru">
          </div>
          <div class="field">
            <label class="field__label" for="login-password">Пароль</label>
            <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="Ваш пароль">
          </div>
          <div class="form-error" role="alert"></div>
          <button class="btn btn--primary btn--block" type="submit"><span class="spinner"></span><span>Войти</span></button>
        </form>

        <form id="register-form" novalidate hidden>
          <div class="field">
            <label class="field__label" for="reg-name">Имя и фамилия</label>
            <input class="input" id="reg-name" name="name" type="text" autocomplete="name" maxlength="60" required placeholder="Как вас подписывать в ленте">
          </div>
          <div class="field">
            <label class="field__label" for="reg-email">E-mail</label>
            <input class="input" id="reg-email" name="email" type="email" autocomplete="email" inputmode="email" required placeholder="name@example.ru">
          </div>
          <div class="field">
            <label class="field__label" for="reg-password">Пароль <span class="it">— от 8 символов</span></label>
            <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="Придумайте пароль">
          </div>
          <div class="field">
            <label class="field__label" for="reg-password2">Повторите пароль</label>
            <input class="input" id="reg-password2" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="Ещё раз">
          </div>
          <div class="form-error" role="alert"></div>
          <button class="btn btn--primary btn--block" type="submit"><span class="spinner"></span><span>Создать аккаунт</span></button>
          <p class="auth__note">Ваш e-mail не будет виден другим участникам.</p>
        </form>
      </div>
    </section>`;

  const seg = root.querySelector(".segmented");
  const forms = {
    login: root.querySelector("#login-form"),
    register: root.querySelector("#register-form"),
  };

  function setTab(tab, focus = false) {
    seg.querySelectorAll("[data-tab]").forEach((b, i) => {
      const active = b.dataset.tab === tab;
      b.setAttribute("aria-selected", active ? "true" : "false");
      if (active) seg.style.setProperty("--i", i);
    });
    forms.login.hidden = tab !== "login";
    forms.register.hidden = tab !== "register";
    if (focus) forms[tab].querySelector("input")?.focus();
  }

  seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    setTab(b.dataset.tab, true);
    history.replaceState(null, "", "#" + b.dataset.tab);
  });

  forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector("[type=submit]");
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showError(form, "Введите e-mail и пароль.");
    setBusy(btn, true);
    hideError(form);
    try {
      await pb.collection("users").authWithPassword(email, password);
      onSignedIn(`С возвращением, ${firstName(currentUser())}!`);
    } catch (err) {
      showError(form, errorMessage(err));
    } finally {
      setBusy(btn, false);
    }
  });

  forms.register.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector("[type=submit]");
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      passwordConfirm: form.passwordConfirm.value,
    };
    if (!data.name) return showError(form, "Как вас зовут? Имя будет видно в ленте.");
    if (!/^\S+@\S+\.\S+$/.test(data.email)) return showError(form, "Введите корректный e-mail.");
    if (data.password.length < 8) return showError(form, "Пароль должен быть не короче 8 символов.");
    if (data.password !== data.passwordConfirm) return showError(form, "Пароли не совпадают.");

    setBusy(btn, true);
    hideError(form);
    try {
      await pb.collection("users").create(data);
      await pb.collection("users").authWithPassword(data.email, data.password);
      onSignedIn(`Добро пожаловать, ${firstName(currentUser())}!`);
    } catch (err) {
      showError(form, errorMessage(err));
    } finally {
      setBusy(btn, false);
    }
  });

  setTab(hashTab());
  setAuthTab = setTab;
  reveal(root);
}

let setAuthTab = null;

window.addEventListener("hashchange", () => {
  if (!currentUser() && setAuthTab && (location.hash === "#login" || location.hash === "#register")) {
    setAuthTab(hashTab(), true);
  }
});

/** Ошибка из нашего кода (например, при сжатии фото), а не ответ сервера */
function isLocalError(err) {
  return err instanceof Error && !("status" in err);
}

function showError(form, message) {
  const box = form.querySelector(".form-error");
  box.innerHTML = icon("alert") + `<span>${esc(message)}</span>`;
  box.classList.remove("is-visible");
  void box.offsetWidth;
  box.classList.add("is-visible");
}

function hideError(form) {
  form.querySelector(".form-error")?.classList.remove("is-visible");
}

function firstName(user) {
  return String(user?.name || "").trim().split(/\s+/)[0] || "друг";
}

function onSignedIn(message) {
  window.Site.refreshAuth();
  const wantsUpload = location.hash === "#upload";
  if (!wantsUpload) history.replaceState(null, "", location.pathname);
  renderCabinet();
  toast(message);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ================================================================ кабинет */
let myPage = 0;
let myTotalPages = 1;
let stats = { observations: 0, likes: 0 };

function renderCabinet() {
  const user = currentUser();
  if (!user) return renderAuth();

  const stageChips = STAGES.map(
    (s) => `
      <label class="chip">
        <input type="radio" name="stage" value="${esc(s)}">
        <span>${esc(s)}</span>
      </label>`
  ).join("");

  root.innerHTML = `
    <section class="page-head">
      <div class="container">
        <nav class="crumbs reveal" aria-label="Вы здесь">
          <a href="/">Главная</a>${icon("chevron")}<span>Личный кабинет</span>
        </nav>
        <h1 class="h-display reveal" style="--d:1">Привет, <em class="it it--accent" data-user-first>${esc(firstName(user))}</em></h1>
        <p class="lede reveal" style="--d:2">Загружайте фотографии своих растений — они сразу появятся в общей ленте.</p>
      </div>
    </section>

    <div class="container cabinet">
      <aside class="panel glass profile reveal" style="--d:2" aria-label="Профиль">
        <label class="profile__avatar" title="Сменить фото профиля">
          <span data-avatar>${avatarHTML(user)}</span>
          <span class="profile__avatar-edit">${icon("camera")}</span>
          <input type="file" accept="image/*" aria-label="Сменить фото профиля" data-avatar-input>
        </label>
        <h2 class="profile__name" data-user-name>${esc(user.name || "Без имени")}</h2>
        <form class="profile__edit" data-rename-form>
          <input class="input" name="name" maxlength="60" required value="${esc(user.name || "")}" aria-label="Имя">
          <button class="btn btn--primary btn--sm" type="submit"><span class="spinner"></span><span>OK</span></button>
          <button class="btn glass btn--sm btn--icon" type="button" data-rename-cancel aria-label="Отмена">${icon("x")}</button>
        </form>
        <p class="profile__email">${esc(user.email || "")}</p>
        <div class="stats">
          <div><b data-stat="observations">0</b><span data-stat-label="observations">наблюдений</span></div>
          <div><b data-stat="likes">0</b><span data-stat-label="likes">лайков получено</span></div>
        </div>
        <div class="profile__actions">
          <button class="btn glass btn--sm profile__rename" type="button" data-glow data-rename>${icon("pen")}<span>Имя</span></button>
          <a class="btn glass btn--sm" data-glow href="/?author=${encodeURIComponent(user.id)}#feed">${icon("grid")}<span>В ленте</span></a>
          <button class="btn glass btn--sm" type="button" data-glow data-signout>${icon("logout")}<span>Выйти</span></button>
        </div>
      </aside>

      <div class="cabinet__main">
        <section class="panel glass reveal" style="--d:3" id="upload" aria-labelledby="upload-title">
          <h2 class="panel__title" id="upload-title">Новое <em class="it it--accent">наблюдение</em></h2>
          <form class="upload-form" novalidate data-upload-form>
            <label class="dropzone" data-dropzone>
              <input type="file" name="photo" accept="image/*" aria-label="Фото наблюдения">
              <span class="dropzone__empty">
                <span class="dropzone__badge">${icon("image-plus")}</span>
                <b>Добавьте фото</b>
                <span>Перетащите сюда или нажмите, чтобы выбрать</span>
              </span>
              <span class="dropzone__preview"><img alt="Предпросмотр"><span class="dropzone__replace">Заменить фото</span></span>
            </label>

            <div class="upload-form__fields">
              <div class="field">
                <label class="field__label" for="plant">Растение</label>
                <input class="input" id="plant" name="plant" list="plants" maxlength="80" required placeholder="Например, базилик" autocomplete="off">
                <datalist id="plants">${PLANTS.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
              </div>
              <div class="field">
                <span class="field__label">Стадия <span class="it">— по желанию</span></span>
                <div class="chips" role="radiogroup" aria-label="Стадия">${stageChips}</div>
              </div>
              <div class="field">
                <label class="field__label" for="note">Заметка</label>
                <textarea class="input" id="note" name="note" maxlength="1000" placeholder="Что изменилось? Высота, цвет листьев, полив, освещение…"></textarea>
                <div class="field__hint"><span>Опишите, что вы заметили</span><span data-counter>0 / 1000</span></div>
              </div>
              <div class="form-error" role="alert"></div>
              <button class="btn btn--primary btn--block" type="submit"><span class="spinner"></span><span>Опубликовать</span></button>
            </div>
          </form>
        </section>

        <section class="panel glass reveal" style="--d:4" aria-labelledby="my-title">
          <div class="my-head">
            <h2 class="panel__title" id="my-title">Мои наблюдения</h2>
          </div>
          <div class="grid my-grid" data-my-grid>${skeletonHTML(3)}</div>
          <div class="feed-more" data-my-more></div>
        </section>
      </div>
    </div>`;

  reveal(root);
  bindProfile();
  bindUpload();
  const grid = root.querySelector("[data-my-grid]");
  bindCards(grid, {
    onDelete: async (id, card) => {
      if (await deleteObservation(id, card)) {
        const likes = Number(card.querySelector(".like__count")?.textContent || 0);
        setStats({ observations: stats.observations - 1, likes: stats.likes - likes });
        if (stats.observations <= 0) setTimeout(() => renderMyEmpty(grid), 450);
      }
    },
  });
  root.querySelector("[data-my-more]").addEventListener("click", (e) => {
    if (e.target.closest("[data-more]")) loadMine();
  });

  myPage = 0;
  myTotalPages = 1;
  loadMine(true);
  loadStats();

  if (location.hash === "#upload") {
    requestAnimationFrame(() => {
      document.getElementById("upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

/* ----------------------------------------------------------- статистика */
function setStats(next) {
  stats = { observations: Math.max(0, next.observations), likes: Math.max(0, next.likes) };
  const o = root.querySelector('[data-stat="observations"]');
  const l = root.querySelector('[data-stat="likes"]');
  if (!o || !l) return;
  o.textContent = stats.observations;
  l.textContent = stats.likes;
  root.querySelector('[data-stat-label="observations"]').textContent = plural(stats.observations, "наблюдение", "наблюдения", "наблюдений");
  root.querySelector('[data-stat-label="likes"]').textContent =
    plural(stats.likes, "лайк", "лайка", "лайков") + " " + plural(stats.likes, "получен", "получено", "получено");
}

async function loadStats() {
  const user = currentUser();
  if (!user) return;
  try {
    const items = await pb.collection("observations").getFullList({
      filter: pb.filter("author = {:a}", { a: user.id }),
      fields: "likes_count",
    });
    setStats({ observations: items.length, likes: items.reduce((sum, r) => sum + (r.likes_count || 0), 0) });
  } catch (err) {
    console.warn(err);
  }
}

/* ------------------------------------------------------- мои наблюдения */
function renderMyEmpty(grid) {
  grid.innerHTML = `
    <div class="empty" style="grid-column:1/-1;padding-block:32px">
      <span class="empty__icon">${icon("sprout")}</span>
      <h3>Пока ничего нет</h3>
      <p>Загрузите первое фото — например, как выглядели семена в день посева.</p>
    </div>`;
}

async function loadMine(reset = false) {
  const user = currentUser();
  const grid = root.querySelector("[data-my-grid]");
  const more = root.querySelector("[data-my-more]");
  if (!user || !grid) return;
  if (!reset && myPage >= myTotalPages) return;

  try {
    const res = await pb.collection("observations").getList(myPage + 1, 12, {
      filter: pb.filter("author = {:a}", { a: user.id }),
      sort: "-created",
      expand: "author",
    });
    if (reset) grid.innerHTML = "";
    myPage = res.page;
    myTotalPages = res.totalPages;
    if (!res.items.length && myPage === 1) {
      renderMyEmpty(grid);
    } else {
      appendCards(grid, res.items, { deletable: true });
      loadMyLikes(res.items.map((r) => r.id));
    }
    more.innerHTML =
      myPage < myTotalPages ? `<button class="btn glass" type="button" data-glow data-more><span>Показать ещё</span></button>` : "";
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>${esc(errorMessage(err))}</p></div>`;
  }
}

/* ---------------------------------------------------------------- профиль */
function bindProfile() {
  const profile = root.querySelector(".profile");
  const renameForm = root.querySelector("[data-rename-form]");

  root.querySelector("[data-rename]").addEventListener("click", () => {
    profile.classList.add("is-editing");
    renameForm.name.value = currentUser()?.name || "";
    renameForm.name.focus();
    renameForm.name.select();
  });

  root.querySelector("[data-rename-cancel]").addEventListener("click", () => {
    profile.classList.remove("is-editing");
  });

  renameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = renameForm.name.value.trim();
    if (!name) return;
    const btn = renameForm.querySelector("[type=submit]");
    setBusy(btn, true);
    try {
      const user = await pb.collection("users").update(currentUser().id, { name });
      root.querySelector("[data-user-name]").textContent = user.name;
      root.querySelector("[data-user-first]").textContent = firstName(user);
      profile.classList.remove("is-editing");
      window.Site.refreshAuth();
      toast("Имя обновлено");
    } catch (err) {
      toast(errorMessage(err), { type: "error" });
    } finally {
      setBusy(btn, false);
    }
  });

  root.querySelector("[data-avatar-input]").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const holder = root.querySelector("[data-avatar]");
    holder.style.opacity = "0.5";
    try {
      const compressed = await compressImage(file, { maxSide: 512, square: true, quality: 0.88 });
      const fd = new FormData();
      fd.append("avatar", compressed);
      const user = await pb.collection("users").update(currentUser().id, fd);
      holder.innerHTML = avatarHTML(user);
      window.Site.refreshAuth();
      toast("Фото профиля обновлено");
    } catch (err) {
      toast(isLocalError(err) ? err.message : errorMessage(err), { type: "error" });
    } finally {
      holder.style.opacity = "";
    }
  });

  root.querySelector("[data-signout]").addEventListener("click", () => {
    pb.authStore.clear();
    window.Site.refreshAuth();
    history.replaceState(null, "", location.pathname);
    renderAuth();
    toast("Вы вышли из аккаунта", { type: "info" });
  });
}

/* --------------------------------------------------------------- загрузка */
function bindUpload() {
  const form = root.querySelector("[data-upload-form]");
  const zone = root.querySelector("[data-dropzone]");
  const fileInput = zone.querySelector("input[type=file]");
  const preview = zone.querySelector(".dropzone__preview img");
  const note = form.querySelector("#note");
  const counter = form.querySelector("[data-counter]");
  let file = null;
  let previewUrl = "";

  function setFile(next) {
    if (!next) return;
    if (next.type && !next.type.startsWith("image/")) {
      showError(form, "Это не похоже на фото. Выберите JPG, PNG или WebP.");
      return;
    }
    hideError(form);
    file = next;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(next);
    preview.src = previewUrl;
    zone.classList.add("has-file");
  }

  function clearFile() {
    file = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    preview.removeAttribute("src");
    zone.classList.remove("has-file");
    fileInput.value = "";
  }

  fileInput.addEventListener("change", () => setFile(fileInput.files?.[0]));

  ["dragenter", "dragover"].forEach((type) =>
    zone.addEventListener(type, (e) => {
      e.preventDefault();
      zone.classList.add("is-over");
    })
  );
  ["dragleave", "dragend"].forEach((type) =>
    zone.addEventListener(type, (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove("is-over");
    })
  );
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("is-over");
    setFile(e.dataTransfer?.files?.[0]);
  });

  note.addEventListener("input", () => {
    counter.textContent = `${note.value.length} / 1000`;
  });

  // Повторный клик по выбранной стадии снимает выбор
  form.querySelectorAll('input[name="stage"]').forEach((radio) => {
    radio.addEventListener("click", () => {
      if (radio.dataset.was === "1") {
        radio.checked = false;
        radio.dataset.was = "";
      } else {
        form.querySelectorAll('input[name="stage"]').forEach((r) => (r.dataset.was = ""));
        radio.dataset.was = "1";
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = currentUser();
    if (!user) return renderAuth();

    const plant = form.plant.value.trim();
    if (!file) return showError(form, "Добавьте фото наблюдения.");
    if (!plant) {
      form.plant.focus();
      return showError(form, "Укажите, какое это растение.");
    }

    const btn = form.querySelector("[type=submit]");
    const label = btn.querySelector("span:last-child");
    setBusy(btn, true);
    hideError(form);

    try {
      label.textContent = "Готовим фото…";
      const photo = await compressImage(file);

      label.textContent = "Публикуем…";
      const fd = new FormData();
      fd.append("author", user.id);
      fd.append("plant", plant);
      fd.append("note", note.value.trim());
      const stage = form.querySelector('input[name="stage"]:checked')?.value;
      if (stage) fd.append("stage", stage);
      fd.append("photo", photo);

      const record = await pb.collection("observations").create(fd, { expand: "author" });

      form.reset();
      form.querySelectorAll('input[name="stage"]').forEach((r) => (r.dataset.was = ""));
      counter.textContent = "0 / 1000";
      clearFile();

      const grid = root.querySelector("[data-my-grid]");
      grid.querySelector(".empty")?.remove();
      if (!hasCard(record.id)) appendCards(grid, [record], { prepend: true, deletable: true });
      setStats({ observations: stats.observations + 1, likes: stats.likes });

      toast("Наблюдение опубликовано!", { action: { href: "/#feed", label: "В ленту" } });
    } catch (err) {
      showError(form, isLocalError(err) ? err.message : errorMessage(err));
    } finally {
      label.textContent = "Опубликовать";
      setBusy(btn, false);
    }
  });
}

/* ================================================================== старт */
async function start() {
  if (!pb.authStore.isValid) return renderAuth();
  renderCabinet();
  try {
    // Обновляем данные профиля и проверяем, что сессия ещё действительна
    await pb.collection("users").authRefresh();
    window.Site.refreshAuth();
  } catch (err) {
    if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
      pb.authStore.clear();
      window.Site.refreshAuth();
      renderAuth();
    }
  }
}

start();
