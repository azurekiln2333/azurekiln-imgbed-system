const { Router } = require('express');
const crypto = require('crypto');

function generateKey(prefix) {
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${random}`;
}

function createProviderRouter(db, authMiddleware) {
    const router = Router();

    // ==================== 存储节点 API ====================

    router.get('/providers', authMiddleware, async (req, res) => {
        const [rows] = await db.query(
            'SELECT id, provider_key, provider_name, api_host, alist_username, status, created_at FROM image_providers ORDER BY id ASC'
        );
        res.json({ data: rows.map(({ api_token, alist_password, ...provider }) => provider) });
    });

    router.post('/providers', authMiddleware, async (req, res) => {
        const { provider_name, api_host, api_token, alist_username, alist_password } = req.body || {};

        if (!provider_name || !api_host) {
            return res.status(400).json({ error: '缺少必填字段' });
        }

        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            return res.status(403).json({ error: '无权创建存储节点' });
        }

        const provider_key = generateKey('alist');

        try {
            const [result] = await db.query(
                `INSERT INTO image_providers (provider_key, provider_name, api_host, api_token, alist_username, alist_password)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [provider_key, provider_name, api_host, api_token || '', alist_username || '', alist_password || '']
            );
            res.json({ success: true, id: result.insertId, provider_key });
        } catch (err) {
            res.status(500).json({ error: '新增失败', detail: err.message });
        }
    });

    router.put('/providers/:id', authMiddleware, async (req, res) => {
        const { provider_name, api_host, api_token, alist_username, alist_password, status } = req.body || {};
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: '无权修改存储节点' });
        }

        try {
            await db.query(
                `UPDATE image_providers
                 SET provider_name=?, api_host=?, api_token=COALESCE(?, api_token), alist_username=?, alist_password=COALESCE(?, alist_password), status=?
                 WHERE id=?`,
                [provider_name, api_host, api_token ?? null, alist_username, alist_password ?? null, status ?? 1, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '更新失败' });
        }
    });

    router.delete('/providers/:id', authMiddleware, async (req, res) => {
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: '无权删除存储节点' });
        }

        try {
            await db.query('DELETE FROM image_providers WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '删除失败' });
        }
    });

    // ==================== 挂载点 API ====================

    router.get('/mounts', authMiddleware, async (req, res) => {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        let query, params;
        if (isAdmin) {
            query = `SELECT m.*, p.provider_key, p.provider_name
                     FROM image_mounts m
                     JOIN image_providers p ON m.provider_id = p.id
                     ORDER BY m.is_public DESC, m.is_backup ASC, m.id ASC`;
            params = [];
        } else {
            query = `SELECT m.*, p.provider_key, p.provider_name
                     FROM image_mounts m
                     JOIN image_providers p ON m.provider_id = p.id
                     WHERE m.is_public = 1 OR m.owner_id = ?
                     ORDER BY m.is_public DESC, m.is_backup ASC, m.id ASC`;
            params = [userId];
        }

        const [rows] = await db.query(query, params);
        res.json({ data: rows.map(({ api_token, alist_password, ...mount }) => mount) });
    });

    router.post('/mounts', authMiddleware, async (req, res) => {
        const { provider_id, mount_name, mount_path, is_backup, backup_for, is_public } = req.body || {};

        if (!provider_id || !mount_name) {
            return res.status(400).json({ error: '缺少必填字段' });
        }

        if (is_backup && !backup_for) {
            return res.status(400).json({ error: '备份挂载点必须指定备份目标' });
        }

        const isAdmin = req.user.role === 'admin';
        const owner_id = is_public && isAdmin ? null : req.user.id;
        const actualIsPublic = isAdmin ? (is_public ? 1 : 0) : 0;
        const mount_key = generateKey('mount');

        try {
            const [result] = await db.query(
                `INSERT INTO image_mounts (provider_id, mount_key, mount_name, mount_path, is_backup, backup_for, is_public, owner_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [provider_id, mount_key, mount_name, mount_path || '/', is_backup ? 1 : 0, backup_for || null, actualIsPublic, owner_id]
            );
            res.json({ success: true, id: result.insertId, mount_key });
        } catch (err) {
            res.status(500).json({ error: '新增失败', detail: err.message });
        }
    });

    router.put('/mounts/:id', authMiddleware, async (req, res) => {
        const { provider_id, mount_name, mount_path, is_backup, backup_for, is_public, status } = req.body || {};
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        try {
            if (!isAdmin) {
                const [mounts] = await db.query('SELECT owner_id FROM image_mounts WHERE id = ?', [req.params.id]);
                if (!mounts.length || (mounts[0].owner_id !== userId && mounts[0].owner_id !== null)) {
                    return res.status(403).json({ error: '无权修改此挂载点' });
                }
            }

            const owner_id = is_public && isAdmin ? null : userId;
            const actualIsPublic = isAdmin ? (is_public ? 1 : 0) : 0;

            await db.query(
                `UPDATE image_mounts
                 SET provider_id=?, mount_name=?, mount_path=?, is_backup=?, backup_for=?, is_public=?, owner_id=?, status=?
                 WHERE id=?`,
                [provider_id, mount_name, mount_path, is_backup ? 1 : 0, backup_for || null, actualIsPublic, owner_id, status ?? 1, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '更新失败' });
        }
    });

    router.delete('/mounts/:id', authMiddleware, async (req, res) => {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        try {
            if (!isAdmin) {
                const [mounts] = await db.query('SELECT owner_id FROM image_mounts WHERE id = ?', [req.params.id]);
                if (!mounts.length || mounts[0].owner_id !== userId) {
                    return res.status(403).json({ error: '无权删除此挂载点' });
                }
            }

            await db.query('DELETE FROM image_mounts WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '删除失败' });
        }
    });

    return router;
}

module.exports = { createProviderRouter };
