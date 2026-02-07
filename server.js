/**
 * Сервер синхронизации юзеров скрипта (только для твоего платного чита).
 * API: POST /sync { nick } -> JSON string[] (список ников в сети).
 * Деплой на Render.com — юзеры платного скрипта видят только друг друга.
 */

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const NICK_TTL_MS = 20000; // 20 сек без синка — считаем, что юзер отключился

// nick -> lastSeen (timestamp)
const users = new Map();

function prune() {
    const now = Date.now();
    for (const [nick, lastSeen] of users.entries()) {
        if (now - lastSeen > NICK_TTL_MS) users.delete(nick);
    }
}

app.use(express.json());

// Для проверки: в браузере или Render dashboard
app.get('/', (req, res) => {
    res.send('Server is active');
});

// Синк: клиент шлёт свой ник, получает список всех активных ников
app.post('/sync', (req, res) => {
    const nick = req.body && typeof req.body.nick === 'string' ? req.body.nick.trim() : '';
    if (!nick || nick === 'player_spawn') {
        prune();
        return res.json(Array.from(users.keys()));
    }
    users.set(nick, Date.now());
    prune();
    res.json(Array.from(users.keys()));
});

app.listen(PORT, () => {
    console.log('ESP sync server on port', PORT);
});
