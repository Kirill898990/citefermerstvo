/// <reference path="../pb_data/types.d.ts" />

/**
 * Пересчёт счётчика лайков у наблюдения.
 *
 * Счётчик хранится прямо в observations.likes_count, чтобы ленту можно было
 * сортировать по популярности одним запросом. Пересчитываем через COUNT(*),
 * а не +1/−1 — так значение всегда точное, даже при одновременных запросах.
 *
 * Важно: обработчики PocketBase выполняются в изолированном контексте,
 * поэтому SQL продублирован внутри каждого из них.
 */

onRecordAfterCreateSuccess((e) => {
  e.app
    .db()
    .newQuery(
      "UPDATE observations SET likes_count = (SELECT COUNT(*) FROM likes WHERE observation = {:id}) WHERE id = {:id}"
    )
    .bind({ id: e.record.getString("observation") })
    .execute();

  e.next();
}, "likes");

onRecordAfterDeleteSuccess((e) => {
  e.app
    .db()
    .newQuery(
      "UPDATE observations SET likes_count = (SELECT COUNT(*) FROM likes WHERE observation = {:id}) WHERE id = {:id}"
    )
    .bind({ id: e.record.getString("observation") })
    .execute();

  e.next();
}, "likes");
