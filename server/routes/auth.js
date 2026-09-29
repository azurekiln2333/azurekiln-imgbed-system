const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateUserId() {
    const random = crypto.randomBytes(4).toString('hex');
    return `uid_${random}`;
}

function createAuthRouter(db, CONFIG) {
    const router = Router();

    router.post('/login', async (req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        try {
            const [rows] = await db.query(
                'SELECT id, username, password_hash, role, status FROM users WHERE username = ? LIMIT 1',
                [username]
            );
            const user = rows[0];

            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }

            if (user.status !== 1) {
                return res.status(403).json({ error: '账号已被禁用' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                CONFIG.jwtSecret,
                { expiresIn: CONFIG.jwtExpires }
            );

            res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: '服务器错误' });
        }
    });

    router.post('/register', async (req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度需在3-20之间' });
        }

        try {
            const [existing] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
            if (existing.length) {
                return res.status(400).json({ error: '用户名已存在' });
            }

            const userId = generateUserId();
            const passwordHash = await bcrypt.hash(password, 10);

            await db.query(
                'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
                [userId, username, passwordHash, 'user']
            );

            const token = jwt.sign(
                { id: userId, username, role: 'user' },
                CONFIG.jwtSecret,
                { expiresIn: CONFIG.jwtExpires }
            );

            res.json({ token, user: { id: userId, username, role: 'user' } });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: '注册失败' });
        }
    });

    return router;
}

module.exports = { createAuthRouter };
