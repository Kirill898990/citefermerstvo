/// <reference path="../pb_data/types.d.ts" />

/**
 * Начальная схема базы данных «Ситифермерства».
 *
 *  users         — стандартная коллекция пользователей PocketBase
 *                  (имя и аватар видны всем, e-mail скрыт).
 *  observations  — фотографии наблюдений за растениями.
 *  likes         — лайки (один пользователь = один лайк на наблюдение).
 *
 * Счётчик observations.likes_count пересчитывается хуками
 * из pb_hooks/likes.pb.js, поэтому менять его через API запрещено.
 */
migrate((app) => {
  // ---------------------------------------------------------------- users
  const users = app.findCollectionByNameOrId("users");

  // Профиль (имя + аватар) можно смотреть всем — это нужно для ленты.
  // E-mail при этом остаётся скрытым (emailVisibility = false по умолчанию).
  users.viewRule = "";

  const avatar = users.fields.getByName("avatar");
  if (avatar) {
    avatar.maxSize = 5 * 1024 * 1024;
    avatar.mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    avatar.thumbs = ["120x120"];
  }

  const name = users.fields.getByName("name");
  if (name) {
    name.max = 60;
  }

  app.save(users);

  // --------------------------------------------------------- observations
  const observations = new Collection({
    type: "base",
    name: "observations",
    listRule: "",
    viewRule: "",
    createRule:
      '@request.auth.id != "" && @request.body.author = @request.auth.id && @request.body.likes_count:isset = false',
    updateRule:
      'author = @request.auth.id && (@request.body.author:isset = false || @request.body.author = @request.auth.id) && @request.body.likes_count:isset = false',
    deleteRule: "author = @request.auth.id",
    fields: [
      {
        name: "author",
        type: "relation",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "photo",
        type: "file",
        required: true,
        maxSelect: 1,
        maxSize: 10 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        thumbs: ["640x0", "1280x0"],
      },
      {
        name: "plant",
        type: "text",
        required: true,
        min: 1,
        max: 80,
      },
      {
        name: "stage",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["Посев", "Всходы", "Рост", "Цветение", "Плодоношение", "Урожай"],
      },
      {
        name: "note",
        type: "text",
        required: false,
        max: 1000,
      },
      {
        name: "likes_count",
        type: "number",
        required: false,
        min: 0,
        onlyInt: true,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE INDEX `idx_observations_created` ON `observations` (`created`)",
      "CREATE INDEX `idx_observations_likes` ON `observations` (`likes_count`, `created`)",
      "CREATE INDEX `idx_observations_author` ON `observations` (`author`)",
    ],
  });
  app.save(observations);

  // ---------------------------------------------------------------- likes
  const likes = new Collection({
    type: "base",
    name: "likes",
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: null,
    deleteRule: "user = @request.auth.id",
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "observation",
        type: "relation",
        required: true,
        collectionId: observations.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_likes_user_observation` ON `likes` (`user`, `observation`)",
      "CREATE INDEX `idx_likes_observation` ON `likes` (`observation`)",
    ],
  });
  app.save(likes);

  // ------------------------------------------------------------- settings
  const settings = app.settings();
  settings.meta.appName = "Ситифермерство";
  // Защита от спама и подбора паролей. Лимиты считаются на один IP-адрес,
  // а целый класс часто выходит в интернет через один IP школы, поэтому они
  // мягче стандартных. Изменить можно в админке: Settings → Rate limits.
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    { label: "*:auth", audience: "", duration: 10, maxRequests: 30 },
    { label: "*:create", audience: "", duration: 5, maxRequests: 60 },
    { label: "/api/batch", audience: "", duration: 1, maxRequests: 3 },
    { label: "/api/", audience: "", duration: 10, maxRequests: 1500 },
  ];
  app.save(settings);
}, (app) => {
  for (const name of ["likes", "observations"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {
      // коллекции уже нет
    }
  }

  const users = app.findCollectionByNameOrId("users");
  users.viewRule = "id = @request.auth.id";
  app.save(users);
});
