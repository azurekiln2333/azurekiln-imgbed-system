const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function createAuthRouter(db, CONFIG) {
    const router = Router();

    router.post('/login', async (req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        try {
            const [rows] = await db.query(
                'SELECT id, username, password_hash, status FROM users WHERE username = ? LIMIT 1',
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
                { id: user.id, username: user.username },
                CONFIG.jwtSecret,
                { expiresIn: CONFIG.jwtExpires }
            );

            res.json({ token, user: { id: user.id, username: user.username } });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: '服务器错误' });
        }
    });

    return router;
}

module.exports = { createAuthRouter };
