const jwt = require('jsonwebtoken');

function authMiddleware(CONFIG) {
    return (req, res, next) => {
        const header = req.headers['authorization'] || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: '未提供 Token' });
        }

        try {
            req.user = jwt.verify(token, CONFIG.jwtSecret);
            next();
        } catch {
            res.status(401).json({ error: 'Token 无效或已过期' });
        }
    };
}

module.exports = { authMiddleware };
