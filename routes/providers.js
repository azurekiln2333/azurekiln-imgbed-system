const { Router } = require('express');

function createProviderRouter(db, authMiddleware) {
    const router = Router();

    router.get('/providers', authMiddleware, async (req, res) => {
        const [rows] = await db.query(
            'SELECT id, provider_key, provider_name, api_host, mount_path, status, created_at, alist_username FROM image_providers ORDER BY id'
        );
        res.json({ data: rows });
    });

    router.post('/providers', authMiddleware, async (req, res) => {
        const { provider_key, provider_name, api_host, api_token, alist_username, alist_password, mount_path } = req.body || {};

        if (!provider_key || !provider_name || !api_host) {
            return res.status(400).json({ error: '缺少必填字段' });
        }

        try {
            const [result] = await db.query(
                `INSERT INTO image_providers (provider_key, provider_name, api_host, api_token, alist_username, alist_password, mount_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [provider_key, provider_name, api_host, api_token || '', alist_username || '', alist_password || '', mount_path || '/']
            );
            res.json({ success: true, id: result.insertId });
        } catch (err) {
            res.status(500).json({ error: '新增失败', detail: err.message });
        }
    });

    router.put('/providers/:id', authMiddleware, async (req, res) => {
        const { provider_name, api_host, api_token, alist_username, alist_password, mount_path, status } = req.body || {};

        try {
            await db.query(
                `UPDATE image_providers
                 SET provider_name=?, api_host=?, api_token=?, alist_username=?, alist_password=?, mount_path=?, status=?
                 WHERE id=?`,
                [provider_name, api_host, api_token, alist_username, alist_password, mount_path, status ?? 1, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '更新失败' });
        }
    });

    router.delete('/providers/:id', authMiddleware, async (req, res) => {
        await db.query('DELETE FROM image_providers WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    });

    return router;
}

module.exports = { createProviderRouter };
