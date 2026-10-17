const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function extractBearer(req) {
    const header = req.headers['authorization'] || '';
    return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function authMiddleware(CONFIG, db) {
    return async (req, res, next) => {
        const token = extractBearer(req);

        if (!token) {
            return res.status(401).json({ error: '未提供 Token' });
        }

        try {
            req.user = jwt.verify(token, CONFIG.jwtSecret);
            req.authType = 'jwt';
            return next();
        } catch {
            // 不是有效 JWT，继续尝试按 API 令牌校验
        }

        if (!db) {
            return res.status(401).json({ error: 'Token 无效或已过期' });
        }

        try {
            const tokenHash = hashToken(token);
            const [rows] = await db.query(
                `SELECT t.id, t.user_id, u.username, u.role, u.status
                 FROM user_api_tokens t
                 JOIN users u ON t.user_id = u.id
                 WHERE t.token_hash = ? AND t.status = 1
                 LIMIT 1`,
                [tokenHash]
            );

            const row = rows[0];

            if (!row || Number(row.status) !== 1) {
                return res.status(401).json({ error: 'Token 无效或已过期' });
            }

            req.user = { id: row.user_id, username: row.username, role: row.role, tokenId: row.id };
            req.authType = 'token';

            await db.query('UPDATE user_api_tokens SET last_used_at = NOW() WHERE id = ?', [row.id]);

            return next();
        } catch (err) {
            console.error('[Auth] API 令牌校验失败:', err.message);
            return res.status(401).json({ error: 'Token 无效或已过期' });
        }
    };
}

module.exports = { authMiddleware, hashToken };
