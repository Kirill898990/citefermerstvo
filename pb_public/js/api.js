/*
 * Подключение к PocketBase и общие помощники для работы с данными.
 * По умолчанию сайт и API живут на одном адресе (PocketBase раздаёт pb_public).
 * Если API на другом адресе — задайте window.PB_URL до подключения скриптов.
 */
import PocketBase from "./vendor/pocketbase.es.mjs";

export const pb = new PocketBase(window.PB_URL || "/");

// Несколько одинаковых запросов подряд (лента, лайки) не должны отменять друг друга.
pb.autoCancellation(false);

export function currentUser() {
  return pb.authStore.isValid ? pb.authStore.record : null;
}

export function fileUrl(record, filename, thumb) {
  if (!record || !filename) return "";
  return pb.files.getURL(record, filename, thumb ? { thumb } : undefined);
}

/** Дата PocketBase («2026-11-13 16:40:22.645Z») → Date */
export function parseDate(value) {
  if (!value) return new Date(NaN);
  return new Date(String(value).replace(" ", "T"));
}

/* -------------------------------------------------------- ошибки по-русски */
const FIELD_NAMES = {
  email: "E-mail",
  password: "Пароль",
  passwordConfirm: "Повтор пароля",
  name: "Имя",
  photo: "Фото",
  plant: "Растение",
  note: "Заметка",
  avatar: "Аватар",
};

const CODE_MESSAGES = {
  validation_required: "обязательное поле",
  validation_invalid_email: "введите корректный адрес",
  validation_not_unique: "уже используется",
  validation_values_mismatch: "значения не совпадают",
  validation_file_size_limit: "файл слишком большой",
  validation_invalid_mime_type: "неподдерживаемый формат файла",
};

export function errorMessage(err, fallback = "Что-то пошло не так. Попробуйте ещё раз.") {
  if (!err) return fallback;
  if (err.isAbort) return "";

  const status = err.status ?? 0;
  if (status === 0) return "Нет связи с сервером. Проверьте интернет или запущен ли PocketBase.";
  if (status === 429) return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (status === 413) return "Файл слишком большой. Выберите фото поменьше.";

  const data = err.response?.data || err.data?.data || {};
  const fields = Object.keys(data);

  if (fields.includes("email") && data.email?.code === "validation_not_unique") {
    return "Этот e-mail уже зарегистрирован. Попробуйте войти.";
  }
  if (fields.includes("password") && /length|min/i.test(data.password?.code || "")) {
    return "Пароль должен быть не короче 8 символов.";
  }
  if (fields.includes("passwordConfirm")) return "Пароли не совпадают.";

  if (fields.length) {
    return fields
      .map((f) => {
        const name = FIELD_NAMES[f] || f;
        const msg = CODE_MESSAGES[data[f]?.code] || data[f]?.message || "неверное значение";
        return `${name}: ${msg}`;
      })
      .join(". ") + ".";
  }

  if (status === 400 && /authenticate/i.test(err.message || "")) {
    return "Неверный e-mail или пароль.";
  }
  if (status === 401 || status === 403) return "Нужно войти в аккаунт.";
  if (status === 404) return "Запись не найдена — возможно, её уже удалили.";
  return fallback;
}
