# Ситифермерство

Учебный сайт о городском фермерстве: теория, практика, учебные схемы и лента
наблюдений, где участники выкладывают фото своих растений и ставят лайки.

- Минималистичный дизайн в стиле Apple, «стеклянные» кнопки и меню (как Liquid Glass в iOS 26).
- Светлая и тёмная тема (переключатель справа в бегущей строке, выбор запоминается).
- Личный кабинет: регистрация, вход, аватар, загрузка фото наблюдений.
- Лента на главной: новые и популярные наблюдения, фильтр по автору, лайки
  (в том числе двойным нажатием на фото); новые фото и лайки появляются без перезагрузки.

Сайт написан на обычных HTML, CSS и JavaScript без сборки. Сервер и база данных — [PocketBase](https://pocketbase.io).

## Запуск на своём компьютере

1. Скачайте PocketBase для своей системы со страницы <https://pocketbase.io/docs/>
   (сайт проверен на версии **0.40.6**). Распакуйте файл `pocketbase` (`pocketbase.exe` в Windows)
   в корень этого проекта, рядом с папками `pb_public`, `pb_migrations` и `pb_hooks`.
2. Запустите сервер:

   ```bash
   ./pocketbase serve
   ```

   При первом запуске PocketBase сам создаст базу данных и таблицы из `pb_migrations`.
3. Откройте сайт: <http://127.0.0.1:8090>
4. Создайте администратора, чтобы заходить в админку <http://127.0.0.1:8090/_/>:

   ```bash
   ./pocketbase superuser upsert admin@example.ru ваш-пароль
   ```

   В админке можно смотреть и удалять пользователей, фото и лайки.

## Запуск на сервере (cityzaman.ru, NetAngels)

Нужен **облачный VDS** с Ubuntu — на обычном виртуальном хостинге PocketBase не запустится,
потому что ему нужна постоянно работающая программа со своими портами 80 и 443.

**1. Направьте домен на сервер.** В панели NetAngels (или там, где куплен домен) создайте
две A-записи с IP-адресом вашего VDS: `cityzaman.ru` и `www.cityzaman.ru`.
Изменения DNS расходятся от нескольких минут до нескольких часов.

**2. Подключитесь к серверу** (в Windows — через PowerShell, на Mac — через «Терминал»):

```bash
ssh root@IP-АДРЕС-СЕРВЕРА
```

**3. Установите сайт** — выполните команды по очереди:

```bash
apt update && apt install -y git unzip
useradd --system --home /opt/cityzaman --shell /usr/sbin/nologin pocketbase
git clone -b claude/sitifermstvo-website-personal-cabinet-7hhrsf https://github.com/Kirill898990/citefermerstvo.git /opt/cityzaman
cd /opt/cityzaman
wget https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_linux_amd64.zip
unzip pocketbase_0.40.6_linux_amd64.zip pocketbase && rm pocketbase_0.40.6_linux_amd64.zip
./pocketbase superuser upsert ВАШ_EMAIL 'ВАШ_ПАРОЛЬ'
chown -R pocketbase:pocketbase /opt/cityzaman
cp deploy/cityzaman.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cityzaman
```

Пока сайт не перенесён в ветку `main`, в команде `git clone` указана рабочая ветка (`-b …`).
После слияния эту часть можно убрать.

Если на сервере включён фаервол `ufw`, откройте порты: `ufw allow OpenSSH && ufw allow 80,443/tcp`.

**4. Готово.** Откройте <https://cityzaman.ru> — при первом заходе PocketBase за несколько секунд
получит HTTPS-сертификат. Админка: <https://cityzaman.ru/_/> (вход — e-mail и пароль из шага 3).
В админке откройте Settings → Application и укажите Application URL `https://cityzaman.ru`.

Полезные команды:

| Что сделать | Команда |
| --- | --- |
| Посмотреть, работает ли сайт | `systemctl status cityzaman` |
| Смотреть журнал в реальном времени | `journalctl -u cityzaman -f` |
| Обновить сайт до новой версии из GitHub | `sudo -u pocketbase git -C /opt/cityzaman pull && systemctl restart cityzaman` |
| Перезапустить | `systemctl restart cityzaman` |

Все данные (база и загруженные фото) лежат в `/opt/cityzaman/pb_data`. Настройте регулярные
резервные копии в админке: Settings → Backups.

## Что где лежит

| Путь | Что внутри |
| --- | --- |
| `pb_public/index.html` | Главная: приветствие и лента наблюдений |
| `pb_public/topic.html` | Страница выбранного раздела (`topic.html?id=…`) |
| `pb_public/cabinet.html` | Личный кабинет: вход, регистрация, профиль, загрузка фото |
| `pb_public/js/site-data.js` | **Вкладки, пункты меню и содержимое страниц разделов** |
| `pb_public/js/header.js` | Бегущая строка, полоска и «пришитые» вкладки с меню, переключение темы |
| `pb_public/js/feed.js`, `cards.js` | Лента, карточки и лайки |
| `pb_public/js/cabinet.js` | Логика личного кабинета |
| `pb_public/css/style.css` | Все стили (цвета обеих тем — в начале файла) |
| `pb_migrations/` | Структура базы: пользователи, наблюдения, лайки |
| `pb_hooks/likes.pb.js` | Пересчёт счётчика лайков на сервере |

## Как добавить материалы в разделы

Откройте `pb_public/js/site-data.js` и допишите блоки в `blocks` нужной темы.
Пока блоков нет, на странице показывается заглушка «Раздел наполняется».
Доступные блоки: текст, термины, карточки, ссылки и видео — примеры описаны в начале файла.

Ссылка на практику (`https://урокискириллом.рф`) задаётся там же, в `practiceUrl`.

## Безопасность данных

- E-mail участников не виден другим — в ленте показываются только имя и аватар.
- Загружать, менять и удалять наблюдения может только их автор; поставить лайк можно один раз.
- Счётчик лайков нельзя подделать через API — его считает сервер.
- Включено ограничение частоты запросов. Лимиты смягчены, потому что весь класс часто
  выходит в интернет через один IP школы; изменить их можно в админке: Settings → Rate limits.
