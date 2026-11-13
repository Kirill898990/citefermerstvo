/*
 * Шапка сайта: бегущая строка «Ситифермерство», полоска-шов
 * и пять «пришитых» к ней вкладок с выпадающими меню.
 *
 * Скрипт обычный (не модуль) и подключается сразу после <header id="site-header">,
 * поэтому шапка появляется синхронно, без мигания.
 */
(function () {
  "use strict";

  var SITE = window.SITE;
  var icon = window.icon;
  var root = document.documentElement;
  var header = document.getElementById("site-header");
  if (!header || !SITE) return;

  var AUTH_KEY = "pocketbase_auth";
  var MARQUEE_SECONDS = 48;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------ утилиты */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hueFrom(text) {
    var h = 0;
    text = String(text || "");
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return h;
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  /** HTML аватара: фото или инициалы на цветном градиенте. */
  function avatarHTML(user, extraClass) {
    user = user || {};
    var cls = "avatar" + (extraClass ? " " + extraClass : "");
    var style = "--hue:" + hueFrom(user.id || user.name);
    if (user.avatar && user.id) {
      var src =
        "/api/files/" +
        encodeURIComponent(user.collectionId || "_pb_users_auth_") +
        "/" +
        encodeURIComponent(user.id) +
        "/" +
        encodeURIComponent(user.avatar) +
        "?thumb=120x120";
      return '<span class="' + cls + '" style="' + style + '"><img src="' + esc(src) + '" alt="" loading="lazy"></span>';
    }
    return '<span class="' + cls + '" style="' + style + '" aria-hidden="true">' + esc(initials(user.name || user.email)) + "</span>";
  }

  /** Текущий пользователь из хранилища PocketBase (без загрузки SDK). */
  function getAuth() {
    try {
      var raw = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (!raw || !raw.token) return null;
      var payload = JSON.parse(atob(raw.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return raw.record || raw.model || null;
    } catch (e) {
      return null;
    }
  }

  function topicUrl(id) {
    return "/topic.html?id=" + encodeURIComponent(id);
  }

  /* ------------------------------------------------- какая вкладка активна */
  function currentSection() {
    var path = location.pathname;
    if (/\/topic(\.html)?$/.test(path)) {
      var id = new URLSearchParams(location.search).get("id");
      var t = SITE.topics[id];
      return t ? t.section : null;
    }
    if (/\/cabinet(\.html)?$/.test(path)) return "account";
    return null;
  }

  /* ----------------------------------------------------------- разметка */
  function marqueeHTML() {
    var unit = "";
    for (var i = 0; i < 8; i++) {
      unit +=
        '<span class="marquee__word">' + esc(SITE.name) + "</span>" +
        '<span class="marquee__sep">' + icon("leaf") + "</span>";
    }
    var delay = -((Date.now() / 1000) % MARQUEE_SECONDS);
    return (
      '<div class="marquee">' +
      '<a class="marquee__link" href="/" aria-label="' + esc(SITE.name) + ' — на главную">' +
      '<div class="marquee__track" style="--marquee-duration:' + MARQUEE_SECONDS + "s;--marquee-delay:" + delay.toFixed(2) + 's">' +
      '<div class="marquee__group">' + unit + "</div>" +
      '<div class="marquee__group" aria-hidden="true">' + unit + "</div>" +
      "</div></a>" +
      '<button class="theme-toggle glass" type="button" data-glow aria-label="Переключить светлую и тёмную тему">' +
      icon("sun", "icon--sun") + icon("moon", "icon--moon") +
      "</button>" +
      "</div>"
    );
  }

  function menuItem(href, iconName, label, hint, i, attrs) {
    return (
      '<a class="menu__item" href="' + esc(href) + '" style="--i:' + i + '"' + (attrs || "") + ">" +
      '<span class="menu__icon">' + icon(iconName) + "</span>" +
      '<span class="menu__text"><span class="menu__label">' + esc(label) + "</span>" +
      (hint ? '<span class="menu__hint">' + esc(hint) + "</span>" : "") +
      "</span>" +
      '<span class="menu__chev">' + icon("chevron") + "</span>" +
      "</a>"
    );
  }

  function topicsMenu(section) {
    var html = '<p class="menu__title">' + esc(section.label) + '</p><div class="menu__list"><span class="menu__hl"></span>';
    section.items.forEach(function (id, i) {
      var t = SITE.topics[id];
      html += menuItem(topicUrl(id), t.icon, t.title, t.hint, i);
    });
    return html + "</div>";
  }

  function practiceMenu() {
    return (
      '<p class="menu__desc"><em class="it">Практические задания</em> проходят на отдельном сайте — там можно выполнить работы и проверить себя.</p>' +
      '<a class="btn btn--primary btn--block" href="' + esc(SITE.practiceUrl) + '" target="_blank" rel="noopener">' +
      "<span>Перейти к практикам</span>" + icon("arrow-up-right") +
      "</a>" +
      '<span class="menu__url">' + esc(SITE.practiceLabel) + "</span>"
    );
  }

  function feedMenu() {
    var user = getAuth();
    var html = '<p class="menu__title">Наблюдения</p><div class="menu__list"><span class="menu__hl"></span>';
    html += menuItem("/#feed", "clock", "Лента наблюдений", "свежие фотографии", 0);
    html += menuItem("/?sort=popular#feed", "flame", "Популярное", "больше всего лайков", 1);
    if (user) html += menuItem("/?author=" + encodeURIComponent(user.id) + "#feed", "grid", "Мои наблюдения", "всё, что вы загрузили", 2);
    html += menuItem("/cabinet.html#upload", "image-plus", "Добавить наблюдение", "загрузить фото", user ? 3 : 2);
    return html + "</div>";
  }

  function accountMenu() {
    var user = getAuth();
    var html = "";
    if (user) {
      html +=
        '<div class="menu__user">' + avatarHTML(user) +
        "<div><strong>" + esc(user.name || "Без имени") + "</strong><span>ваш кабинет</span></div></div>" +
        '<div class="menu__list"><span class="menu__hl"></span>' +
        menuItem("/cabinet.html", "user", "Мой профиль", "", 0) +
        menuItem("/cabinet.html#upload", "camera", "Загрузить фото", "", 1) +
        '<a class="menu__item menu__item--danger" href="#logout" data-logout style="--i:2">' +
        '<span class="menu__icon">' + icon("logout") + "</span>" +
        '<span class="menu__text"><span class="menu__label">Выйти</span></span></a>' +
        "</div>";
    } else {
      html +=
        '<p class="menu__title">Личный кабинет</p><div class="menu__list"><span class="menu__hl"></span>' +
        menuItem("/cabinet.html#login", "login", "Войти", "уже есть аккаунт", 0) +
        menuItem("/cabinet.html#register", "user-plus", "Регистрация", "это бесплатно", 1) +
        "</div>";
    }
    return html;
  }

  function menuContent(section) {
    if (section.type === "practice") return practiceMenu();
    if (section.type === "feed") return feedMenu();
    if (section.type === "account") return accountMenu();
    return topicsMenu(section);
  }

  function tabInner(section) {
    var user = section.type === "account" ? getAuth() : null;
    return (
      '<span class="tab__stitch" aria-hidden="true"></span>' +
      (user ? avatarHTML(user) : icon(section.icon)) +
      '<span class="tab__label"><span class="tab__long">' + esc(section.label) + "</span>" +
      '<span class="tab__short">' + esc(section.short || section.label) + "</span></span>"
    );
  }

  function seamHTML() {
    var active = currentSection();
    var html = '<div class="seam"><div class="seam__line"></div><nav class="tabs" aria-label="Основные разделы">';
    SITE.nav.forEach(function (section, i) {
      var menuId = "menu-" + section.id;
      html +=
        '<div class="tab-item" data-id="' + section.id + '" style="--i:' + i + '">' +
        '<button class="tab glass" type="button" data-glow aria-expanded="false" aria-controls="' + menuId + '"' +
        (active === section.id ? ' aria-current="true"' : "") + ">" +
        tabInner(section) +
        "</button>" +
        '<div class="menu glass' + (section.type === "practice" ? " menu--practice" : "") + '" id="' + menuId + '" inert>' +
        menuContent(section) +
        "</div></div>";
    });
    return html + "</nav></div>";
  }

  /* ---------------------------------------------------------- отрисовка */
  var introDone = false;
  try {
    introDone = sessionStorage.getItem("site-intro") === "1";
    sessionStorage.setItem("site-intro", "1");
  } catch (e) {}
  if (!introDone && !reducedMotion.matches) header.classList.add("intro");

  header.innerHTML = marqueeHTML() + seamHTML();

  /* ------------------------------------------------------- выпадающие меню */
  var openItem = null;
  var openTimer = 0;
  var closeTimer = 0;
  var mobile = window.matchMedia("(max-width: 760px)");

  function parts(item) {
    return {
      btn: item.querySelector(".tab"),
      menu: item.querySelector(".menu")
    };
  }

  function positionMenu(item) {
    var p = parts(item);
    if (mobile.matches) {
      p.menu.style.removeProperty("--shift");
      return;
    }
    var rect = item.getBoundingClientRect();
    var width = p.menu.offsetWidth;
    var center = rect.left + rect.width / 2;
    var left = center - width / 2;
    var margin = 12;
    var shift = 0;
    if (left < margin) shift = margin - left;
    else if (left + width > window.innerWidth - margin) shift = window.innerWidth - margin - (left + width);
    p.menu.style.setProperty("--shift", Math.round(shift) + "px");
  }

  function open(item, viaHover) {
    clearTimeout(closeTimer);
    if (openItem === item) return;
    if (openItem) close(openItem);
    var p = parts(item);
    positionMenu(item);
    item.setAttribute("data-open", "");
    item._hoverOpened = !!viaHover;
    p.btn.setAttribute("aria-expanded", "true");
    p.menu.inert = false;
    openItem = item;
  }

  function close(item) {
    if (!item) return;
    var p = parts(item);
    item.removeAttribute("data-open");
    p.btn.setAttribute("aria-expanded", "false");
    p.menu.inert = true;
    var hl = p.menu.querySelector(".menu__hl");
    if (hl) hl.style.opacity = "0";
    if (openItem === item) openItem = null;
  }

  function swing(btn) {
    if (reducedMotion.matches || btn.classList.contains("is-swinging")) return;
    btn.classList.add("is-swinging");
  }

  function moveHighlight(list, target) {
    var hl = list.querySelector(".menu__hl");
    if (!hl) return;
    if (!target) {
      hl.style.opacity = "0";
      return;
    }
    var first = hl.style.opacity !== "1";
    if (first) hl.style.transition = "none";
    hl.style.transform = "translateY(" + target.offsetTop + "px)";
    hl.style.height = target.offsetHeight + "px";
    if (first) {
      hl.offsetHeight; // перерисовка без анимации при первом наведении
      hl.style.transition = "";
    }
    hl.style.opacity = "1";
  }

  function bindItem(item) {
    var p = parts(item);

    item.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      openTimer = setTimeout(function () {
        open(item, true);
      }, openItem ? 0 : 60);
    });

    item.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      clearTimeout(openTimer);
      closeTimer = setTimeout(function () {
        close(item);
      }, 240);
    });

    p.btn.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") swing(p.btn);
    });

    p.btn.addEventListener("animationend", function () {
      p.btn.classList.remove("is-swinging");
    });

    p.btn.addEventListener("click", function () {
      if (openItem === item && item._hoverOpened) {
        item._hoverOpened = false;
        return;
      }
      if (openItem === item) {
        close(item);
      } else {
        open(item, false);
        swing(p.btn);
      }
    });

    p.btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        open(item, false);
        var first = p.menu.querySelector("a, button");
        if (first) first.focus();
      }
    });

    item.addEventListener("focusout", function (e) {
      if (!item.contains(e.relatedTarget)) close(item);
    });

    var list = p.menu.querySelector(".menu__list");
    if (list) {
      list.addEventListener("pointerover", function (e) {
        var target = e.target.closest(".menu__item");
        if (target) moveHighlight(list, target);
      });
      list.addEventListener("focusin", function (e) {
        var target = e.target.closest(".menu__item");
        if (target) moveHighlight(list, target);
      });
      list.addEventListener("pointerleave", function () {
        moveHighlight(list, null);
      });
    }
  }

  function bindMenus() {
    header.querySelectorAll(".tab-item").forEach(bindItem);
  }

  bindMenus();

  document.addEventListener("pointerdown", function (e) {
    if (openItem && !openItem.contains(e.target)) close(openItem);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openItem) {
      var btn = parts(openItem).btn;
      close(openItem);
      btn.focus();
    }
  });

  window.addEventListener("resize", function () {
    if (openItem) positionMenu(openItem);
  });

  // Выход из аккаунта
  header.addEventListener("click", function (e) {
    var logout = e.target.closest("[data-logout]");
    if (!logout) return;
    e.preventDefault();
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (err) {}
    if (/\/cabinet(\.html)?$/.test(location.pathname)) location.reload();
    else location.href = location.pathname + location.search + location.hash;
  });

  // Закрываем меню при переходе по ссылке внутри страницы (#feed и т.п.)
  header.addEventListener("click", function (e) {
    var a = e.target.closest(".menu a");
    if (a && openItem) close(openItem);
  });

  /* ---------------------------------------------- блик за курсором (стекло) */
  var glowRaf = 0;
  var glowEvent = null;
  document.addEventListener(
    "pointermove",
    function (e) {
      if (e.pointerType !== "mouse") return;
      glowEvent = e;
      if (glowRaf) return;
      glowRaf = requestAnimationFrame(function () {
        glowRaf = 0;
        var el = glowEvent.target && glowEvent.target.closest && glowEvent.target.closest("[data-glow]");
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", glowEvent.clientX - r.left + "px");
        el.style.setProperty("--my", glowEvent.clientY - r.top + "px");
      });
    },
    { passive: true }
  );

  /* ----------------------------------------------------------- тема */
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#000000" : "#f5f5f7");
  }

  applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  var toggle = header.querySelector(".theme-toggle");
  toggle.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}

    if (!document.startViewTransition || reducedMotion.matches) {
      applyTheme(next);
      return;
    }

    var r = toggle.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    root.classList.add("theme-vt");
    var vt = document.startViewTransition(function () {
      applyTheme(next);
    });
    vt.ready
      .then(function () {
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
          { duration: 720, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(function () {});
    vt.finished.finally(function () {
      root.classList.remove("theme-vt");
    });
  });

  // Если пользователь не выбирал тему вручную — следуем за системой
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
    var saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch (err) {}
    if (saved !== "light" && saved !== "dark") applyTheme(e.matches ? "dark" : "light");
  });

  /* ------------------------------------------------------------ подвал */
  function renderFooter() {
    var footer = document.getElementById("site-footer");
    if (!footer) return;
    footer.className = "footer";
    footer.innerHTML =
      '<div class="container">' +
      '<span class="footer__brand">' + esc(SITE.name) + "</span>" +
      '<nav aria-label="Ссылки в подвале">' +
      '<a href="' + topicUrl("material") + '">Теория</a>' +
      '<a href="' + esc(SITE.practiceUrl) + '" target="_blank" rel="noopener">Практика</a>' +
      '<a href="' + topicUrl("hydroponic-types") + '">Учебные схемы</a>' +
      '<a href="/#feed">Наблюдения</a>' +
      '<a href="/cabinet.html">Личный кабинет</a>' +
      "</nav>" +
      "<span>© " + new Date().getFullYear() + ' · <em class="it">растим зелень в городе</em></span>' +
      "</div>";
  }

  /** <i data-icon="name"></i> в разметке страниц → SVG-иконка */
  function renderIcons() {
    document.querySelectorAll("i[data-icon]").forEach(function (el) {
      el.outerHTML = icon(el.getAttribute("data-icon"));
    });
  }

  function onReady() {
    renderFooter();
    renderIcons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();

  /* ------------------------------------------------------ публичное API */
  function refreshAuth() {
    var fresh = document.createElement("div");
    fresh.innerHTML = seamHTML();
    ["feed", "account"].forEach(function (id) {
      var item = header.querySelector('.tab-item[data-id="' + id + '"]');
      var replacement = fresh.querySelector('.tab-item[data-id="' + id + '"]');
      if (!item || !replacement) return;
      if (openItem === item) close(item);
      replacement.style.animation = "none";
      item.replaceWith(replacement);
      bindItem(replacement);
    });
  }

  window.Site = {
    esc: esc,
    avatarHTML: avatarHTML,
    getAuth: getAuth,
    refreshAuth: refreshAuth,
    renderIcons: renderIcons,
    topicUrl: topicUrl
  };
})();
