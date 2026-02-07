/**
 * Сервер синхронизации юзеров скрипта (только для твоего платного чита).
 * API: POST /sync { nick, server? } -> JSON [{ nick, server }, ...].
 * Деплой на Render.com — юзеры платного скрипта видят только друг друга.
 */

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const NICK_TTL_MS = 25000; // 25 сек без синка — считаем, что юзер отключился

// nick -> { lastSeen, server }
const users = new Map();

function prune() {
    const now = Date.now();
    for (const [nick, data] of users.entries()) {
        if (now - data.lastSeen > NICK_TTL_MS) users.delete(nick);
    }
}

app.use(express.json());

// CORS: скрипт в браузере на другом домене — без этого fetch блокируется
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Для проверки: в браузере или Render dashboard
app.get('/', (req, res) => {
    res.send('Server is active xD');
});

// Синк: клиент шлёт nick и опционально server, получает список [{ nick, server }, ...]
app.post('/sync', (req, res) => {
    const nick = req.body && typeof req.body.nick === 'string' ? req.body.nick.trim() : '';
    const server = req.body && typeof req.body.server === 'string' ? req.body.server.trim() : '';
    if (!nick || nick === 'player_spawn') {
        prune();
        const list = Array.from(users.entries()).map(([n, d]) => ({ nick: n, server: d.server || '' }));
        return res.json(list);
    }
    users.set(nick, { lastSeen: Date.now(), server });
    prune();
    const list = Array.from(users.entries()).map(([n, d]) => ({ nick: n, server: d.server || '' }));
    res.json(list);
});

app.listen(PORT, () => {
    console.log('ESP sync server on port', PORT);
});
