# Сервер синхронизации юзеров (только для платного скрипта)

Отдельный бэкенд для твоего платного чита. Юзеры видят только других юзеров этого скрипта, а не паблик script.js.

## API (как у gmmmg.onrender.com)

- **GET /** — ответ `Server is active` (проверка работы).
- **POST /sync** — тело `{ "nick": "ник_игрока" }`, ответ — JSON-массив строк (список активных ников).

Клиент дергает `/sync` каждые 4 секунды; ники, с которых не было запроса 20 секунд, сбрасываются.

---

## Деплой на Render.com

### 1. Репозиторий на GitHub

1. Создай новый репозиторий (например `esp-sync-server` или `absolute-hack-sync`).
2. В папке `esp-sync-server` выполни:

```bash
cd esp-sync-server
git init
git add .
git commit -m "ESP sync server"
git branch -M main
git remote add origin https://github.com/ТВОЙ_ЛОГИН/ИМЯ_РЕПО.git
git push -u origin main
```

(Подставь свой логин и имя репо.)

### 2. Создание сервиса на Render

1. Зайди на [render.com](https://render.com) и войди (можно через GitHub).
2. **Dashboard** → **New** → **Web Service**.
3. Подключи репозиторий с этим сервером (если ещё не подключён — **Connect account** / **Configure account** и выбери репо).
4. Выбери репозиторий с `esp-sync-server` (если весь проект в одном репо — укажи **Root Directory**: `esp-sync-server`).
5. Настройки:
   - **Name**: например `absolute-hack-esp` (от этого будет URL: `https://absolute-hack-esp.onrender.com`).
   - **Region**: любой.
   - **Branch**: `main`.
   - **Runtime**: **Node**.
   - **Build Command**: `npm install`.
   - **Start Command**: `npm start`.
6. **Create Web Service**.

### 3. Дождаться деплоя

Первый деплой может занять 2–3 минуты. В логах должно быть что-то вроде: `ESP sync server on port 10000`.

### 4. Проверка

- В браузере открой `https://ТВОЙ-СЕРВИС.onrender.com` — должно быть `Server is active`.
- Можно проверить API:  
  `curl -X POST https://ТВОЙ-СЕРВИС.onrender.com/sync -H "Content-Type: application/json" -d "{\"nick\":\"test\"}"`  
  В ответ должен прийти массив, например `["test"]`.

### 5. Подставить URL в скрипт

В **Absolute_Hack2.js** замени URL на свой:

```js
const ESP_SERVER_URL = 'https://ТВОЙ-СЕРВИС.onrender.com';
```

В **script.js** ничего менять не нужно — он паблик и продолжит использовать gmmmg.onrender.com. Платный скрипт (Absolute_Hack2.js) будет ходить только на твой сервер.

---

## Важно

- На бесплатном тарифе Render сервис «засыпает» после ~15 минут без запросов; первый запрос после этого может идти дольше (cold start). Для постоянной активности можно настроить пинг с [UptimeRobot](https://uptimerobot.com) раз в 5–10 минут на твой URL.
- Данные в памяти: при перезапуске сервиса список юзеров очищается — это нормально.
