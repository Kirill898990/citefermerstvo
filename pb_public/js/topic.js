/* Страница раздела (topic.html?id=…): заголовок, материалы и соседние темы. */
(function () {
  "use strict";

  var SITE = window.SITE;
  var esc = window.Site.esc;
  var icon = window.icon;
  var head = document.getElementById("topic-head");
  var body = document.getElementById("topic-body");

  var id = new URLSearchParams(location.search).get("id");
  var topic = SITE.topics[id];

  function sectionOf(t) {
    return SITE.nav.filter(function (s) {
      return s.id === t.section;
    })[0];
  }

  function crumbs(parts) {
    return (
      '<nav class="crumbs reveal" aria-label="Вы здесь">' +
      parts
        .map(function (p, i) {
          var sep = i ? icon("chevron") : "";
          return sep + (p.href ? '<a href="' + esc(p.href) + '">' + esc(p.label) + "</a>" : "<span>" + esc(p.label) + "</span>");
        })
        .join("") +
      "</nav>"
    );
  }

  /* --------------------------------------------------------------- блоки */
  var renderers = {
    text: function (b) {
      return (
        '<div class="prose reveal">' +
        (b.paragraphs || [])
          .map(function (p) {
            return "<p>" + esc(p) + "</p>";
          })
          .join("") +
        "</div>"
      );
    },

    terms: function (b) {
      return (
        '<dl class="terms">' +
        (b.items || [])
          .map(function (t, i) {
            return (
              '<div class="term surface rim reveal" style="--d:' + (i % 6) + '">' +
              "<dt>" + esc(t.term) + "</dt><dd>" + esc(t.text) + "</dd></div>"
            );
          })
          .join("") +
        "</dl>"
      );
    },

    cards: function (b) {
      return (
        '<div class="cards">' +
        (b.items || [])
          .map(function (c, i) {
            var n = String(i + 1).padStart(2, "0");
            return (
              '<article class="info-card surface rim reveal" style="--d:' + (i % 6) + '">' +
              '<span class="info-card__num">' + n + "</span>" +
              "<h3>" + esc(c.title) + "</h3>" +
              "<p>" + esc(c.text) + "</p></article>"
            );
          })
          .join("") +
        "</div>"
      );
    },

    links: function (b) {
      return (
        '<div class="links">' +
        (b.items || [])
          .map(function (l, i) {
            return (
              '<a class="link-row surface rim reveal" style="--d:' + (i % 6) + '" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
              '<span class="menu__icon">' + icon(l.icon || "globe") + "</span>" +
              "<span><b>" + esc(l.title) + "</b>" + (l.note ? "<small>" + esc(l.note) + "</small>" : "") + "</span>" +
              icon("arrow-up-right", "icon--go") +
              "</a>"
            );
          })
          .join("") +
        "</div>"
      );
    },

    video: function (b) {
      return (
        '<figure class="reveal" style="margin:0">' +
        (b.title ? '<h2 class="panel__title">' + esc(b.title) + "</h2>" : "") +
        '<div class="video"><iframe src="' + esc(b.url) + '" title="' + esc(b.title || "Видео") + '" loading="lazy" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
        "</figure>"
      );
    }
  };

  function soonHTML() {
    return (
      '<div class="panel glass soon reveal">' +
      '<span class="soon__icon">' + icon("sprout") + "</span>" +
      "<div><h2>Раздел наполняется</h2>" +
      "<p>Материалы скоро появятся. А пока загляните в ленту наблюдений — там уже растут чужие проекты.</p></div>" +
      "</div>"
    );
  }

  function siblingsHTML(section) {
    if (!section || !section.items) return "";
    var others = section.items.filter(function (x) {
      return x !== id;
    });
    if (!others.length) return "";
    return (
      '<nav class="siblings reveal" aria-label="Другие темы раздела">' +
      "<h2>Ещё в разделе «" + esc(section.label) + "»</h2>" +
      '<div class="siblings__list">' +
      others
        .map(function (x) {
          var t = SITE.topics[x];
          return '<a class="btn glass" data-glow href="' + esc(window.Site.topicUrl(x)) + '">' + icon(t.icon) + "<span>" + esc(t.title) + "</span></a>";
        })
        .join("") +
      "</div></nav>"
    );
  }

  /* -------------------------------------------------------------- рендер */
  if (!topic) {
    document.title = "Раздел не найден · " + SITE.name;
    head.innerHTML =
      crumbs([{ label: "Главная", href: "/" }, { label: "Раздел не найден" }]) +
      '<h1 class="h-display reveal" style="--d:1">Такой страницы <em class="it it--accent">нет</em></h1>' +
      '<p class="lede reveal" style="--d:2">Возможно, ссылка устарела. Выберите раздел во вкладках выше или вернитесь на главную.</p>';
    body.innerHTML = '<div class="reveal"><a class="btn btn--primary" href="/">' + icon("home") + "<span>На главную</span></a></div>";
  } else {
    var section = sectionOf(topic);
    document.title = topic.title + " · " + SITE.name;

    head.innerHTML =
      crumbs([
        { label: "Главная", href: "/" },
        { label: section.label, href: window.Site.topicUrl(section.items[0]) },
        { label: topic.title }
      ]) +
      '<h1 class="h-display reveal" style="--d:1">' + esc(topic.title) + "</h1>" +
      (topic.lede ? '<p class="lede lede--serif reveal" style="--d:2">' + esc(topic.lede) + "</p>" : "");

    var html = "";
    if (topic.intro) html += '<div class="prose reveal"><p>' + esc(topic.intro) + "</p></div>";
    var blocks = topic.blocks || [];
    if (blocks.length) {
      blocks.forEach(function (b) {
        var r = renderers[b.type];
        if (r) html += r(b);
      });
    } else {
      html += soonHTML();
    }
    html += siblingsHTML(section);
    body.innerHTML = html;
  }

  /* ----------------------------------------------- появление при прокрутке */
  var els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  els.forEach(function (el) {
    io.observe(el);
  });
})();
