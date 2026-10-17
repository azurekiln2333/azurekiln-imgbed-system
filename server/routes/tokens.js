const { Router } = require('express');
const crypto = require('crypto');

const TOKEN_PREFIX_LENGTH = 8;

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
    return `img_${crypto.randomBytes(24).toString('hex')}`;
}

function toView(row) {
    return {
        id: row.id,
        name: row.name,
        token_prefix: row.token_prefix,
        status: Number(row.status),
        last_used_at: row.last_used_at,
        created_at: row.created_at,
    };
}

function createTokenRouter(db, authMiddleware) {
    const router = Router();

    // 令牌管理接口仅允许 JWT 登录用户操作；用 API 令牌调用一律拒绝
    const jwtOnly = (req, res, next) => authMiddleware(req, res, () => {
        if (req.authType === 'token') {
            return res.status(403).json({ error: 'API 令牌不能管理令牌' });
        }
        next();
    });

    router.get('/tokens', jwtOnly, async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT id, name, token_prefix, status, last_used_at, created_at
                 FROM user_api_tokens WHERE user_id = ? ORDER BY id DESC`,
                [req.user.id]
            );
            res.json({ data: rows.map(toView) });
        } catch (err) {
            console.error('[Tokens] 查询失败:', err.message);
            res.status(500).json({ error: '查询令牌失败' });
        }
    });

    router.post('/tokens', jwtOnly, async (req, res) => {
        const name = String((req.body || {}).name || '').trim();

        if (!name) {
            return res.status(400).json({ error: '令牌名称不能为空' });
        }
        if (name.length > 50) {
            return res.status(400).json({ error: '令牌名称不能超过 50 个字符' });
        }

        const token = generateToken();

        try {
            const [result] = await db.query(
                `INSERT INTO user_api_tokens (user_id, name, token_hash, token_prefix, status)
                 VALUES (?, ?, ?, ?, 1)`,
                [req.user.id, name, hashToken(token), token.slice(0, TOKEN_PREFIX_LENGTH)]
            );

            const [rows] = await db.query(
                `SELECT id, name, token_prefix, status, last_used_at, created_at
                 FROM user_api_tokens WHERE id = ? LIMIT 1`,
                [result.insertId]
            );

            // 明文令牌只在此次响应中返回一次，数据库仅保存哈希
            res.json({ success: true, token, data: toView(rows[0]) });
        } catch (err) {
            console.error('[Tokens] 创建失败:', err.message);
            res.status(500).json({ error: '创建令牌失败' });
        }
    });

    router.put('/tokens/:id', jwtOnly, async (req, res) => {
        const status = Number((req.body || {}).status);

        if (status !== 0 && status !== 1) {
            return res.status(400).json({ error: '状态只能是 0 或 1' });
        }

        try {
            const [result] = await db.query(
                'UPDATE user_api_tokens SET status = ? WHERE id = ? AND user_id = ?',
                [status, req.params.id, req.user.id]
            );

            if (!result.affectedRows) {
                return res.status(404).json({ error: '令牌不存在' });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[Tokens] 更新失败:', err.message);
            res.status(500).json({ error: '更新令牌失败' });
        }
    });

    router.delete('/tokens/:id', jwtOnly, async (req, res) => {
        try {
            const [result] = await db.query(
                'DELETE FROM user_api_tokens WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );

            if (!result.affectedRows) {
                return res.status(404).json({ error: '令牌不存在' });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[Tokens] 删除失败:', err.message);
            res.status(500).json({ error: '删除令牌失败' });
        }
    });

    return router;
}

module.exports = { createTokenRouter, hashToken, generateToken };
