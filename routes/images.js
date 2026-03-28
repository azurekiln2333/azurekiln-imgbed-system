const { Router } = require('express');
const axios = require('axios');
const alist = require('../utils/alist');

async function getDirectUrl(db, CONFIG, key) {
    await db.query('UPDATE image_images SET last_accessed_at = NOW() WHERE image_key = ?', [key]);

    const [rows] = await db.query(
        `SELECT p.api_host, p.mount_path, p.api_token, p.alist_username, p.alist_password, p.provider_key
         FROM image_images i
         LEFT JOIN image_providers p ON i.provider = p.provider_key
         WHERE i.image_key = ? AND i.status = 1 LIMIT 1`,
        [key]
    );

    let provider;
    if (rows.length) {
        provider = rows[0];
    } else {
        provider = {
            api_host: CONFIG.defaultAlist.url,
            mount_path: CONFIG.defaultAlist.mountPath,
            api_token: CONFIG.defaultAlist.token,
            alist_username: CONFIG.defaultAlist.username,
            alist_password: CONFIG.defaultAlist.password,
        };
    }

    const remotePath = `${provider.mount_path}/${key}`;
    const token = await alist.getToken(provider, CONFIG.defaultAlist);

    let directUrl;
    if (token) {
        const fileInfo = await alist.getFileInfo(provider.api_host, token, remotePath, false);
        directUrl = fileInfo?.raw_url;
    }

    if (!directUrl) {
        directUrl = encodeURI(`${provider.api_host}/d${provider.mount_path}/${key}`);
    }

    return directUrl;
}

function createImageRouter(db, CONFIG, authMiddleware) {
    const router = Router();

    router.get('/direct/:image_key', async (req, res) => {
        const key = req.params.image_key;

        try {
            const directUrl = await getDirectUrl(db, CONFIG, key);
            console.log('[direct] 获取到直链:', directUrl);
            res.json({ success: true, url: directUrl });
        } catch (err) {
            console.error('[direct] 获取直链失败:', err.message);
            const fallbackUrl = encodeURI(`${CONFIG.defaultAlist.url}/d${CONFIG.defaultAlist.mountPath}/${key}`);
            res.json({ success: false, url: fallbackUrl, error: err.message });
        }
    });

    router.get('/img/:image_key', async (req, res) => {
        const key = req.params.image_key;

        try {
            const directUrl = await getDirectUrl(db, CONFIG, key);
            console.log('[img] 获取到直链:', directUrl);

            const response = await axios.get(directUrl, {
                responseType: 'stream',
                timeout: 15000,
            });

            res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');

            response.data.pipe(res);

        } catch (err) {
            console.error('[img] 获取图片失败:', err.message);
            res.status(500).send('Image fetch failed');
        }
    });

    router.get('/images', authMiddleware, async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const q = req.query.q ? `%${req.query.q}%` : null;
        const offset = (page - 1) * limit;

        try {
            const where = q
                ? 'WHERE (i.image_key LIKE ? OR i.original_name LIKE ?) AND i.status = 1'
                : 'WHERE i.status = 1';
            const params = q ? [q, q, limit, offset] : [limit, offset];

            const [rows] = await db.query(
                `SELECT i.id, i.image_key, i.original_name, i.file_size, i.mime_type,
                        i.uploaded_at, i.last_accessed_at, i.provider, u.username as uploader
                 FROM image_images i
                 LEFT JOIN users u ON i.uploader_id = u.id
                 ${where}
                 ORDER BY i.uploaded_at DESC
                 LIMIT ? OFFSET ?`,
                params
            );

            const [[{ total }]] = await db.query(
                `SELECT COUNT(*) as total FROM image_images i ${where}`,
                q ? [q, q] : []
            );

            res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: '查询失败' });
        }
    });

    router.delete('/images/:id', authMiddleware, async (req, res) => {
        try {
            const [result] = await db.query(
                'UPDATE image_images SET status = 0 WHERE id = ?',
                [req.params.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: '图片不存在' });
            }

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '删除失败' });
        }
    });

    router.get('/stats', authMiddleware, async (req, res) => {
        try {
            const [[stats]] = await db.query(`
                SELECT
                    COUNT(*) AS total_images,
                    SUM(file_size) AS total_size,
                    SUM(CASE WHEN DATE(uploaded_at) = CURDATE() THEN 1 ELSE 0 END) AS today_uploads
                FROM image_images WHERE status = 1
            `);

            const [[{ total_users }]] = await db.query(
                'SELECT COUNT(*) as total_users FROM users WHERE status = 1'
            );

            const [[{ total_providers }]] = await db.query(
                'SELECT COUNT(*) as total_providers FROM image_providers WHERE status = 1'
            );

            res.json({ ...stats, total_users, total_providers });
        } catch (err) {
            res.status(500).json({ error: '统计查询失败' });
        }
    });

    return router;
}

module.exports = { createImageRouter };
