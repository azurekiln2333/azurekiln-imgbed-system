const { Router } = require('express');
const bcrypt = require('bcryptjs');

function createUserRouter(db, authMiddleware) {
    const router = Router();

    router.get('/users', authMiddleware, async (req, res) => {
        const [rows] = await db.query('SELECT id, username, status, created_at FROM users ORDER BY id');
        res.json({ data: rows });
    });

    router.post('/users', authMiddleware, async (req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        try {
            const hash = await bcrypt.hash(password, 10);
            const [result] = await db.query(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [username, hash]
            );
            res.json({ success: true, id: result.insertId });
        } catch (err) {
            res.status(500).json({ error: '新增失败，用户名可能已存在' });
        }
    });

    router.put('/users/:id/status', authMiddleware, async (req, res) => {
        const { status } = req.body || {};
        await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true });
    });

    router.delete('/users/:id', authMiddleware, async (req, res) => {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    return router;
}

module.exports = { createUserRouter };
