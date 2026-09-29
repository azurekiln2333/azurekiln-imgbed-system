const { Router } = require('express');
const axios = require('axios');
const alist = require('../utils/alist');

async function getDirectUrl(db, CONFIG, key) {
    await db.query('UPDATE image_images SET last_accessed_at = NOW() WHERE image_key = ?', [key]);

    const [rows] = await db.query(
        `SELECT i.upload_path, p.api_host, m.mount_path, p.api_token, p.alist_username, p.alist_password
         FROM image_images i
         LEFT JOIN image_mounts m ON i.mount_key = m.mount_key
         LEFT JOIN image_providers p ON m.provider_id = p.id
         WHERE i.image_key = ? AND i.status = 1 LIMIT 1`,
        [key]
    );

    let apiUrl;
    let remotePath;
    let token = null;

    if (rows.length && rows[0].api_host) {
        apiUrl = rows[0].api_host;
        if (rows[0].upload_path) {
            remotePath = rows[0].upload_path;
        } else if (rows[0].mount_path) {
            remotePath = `${rows[0].mount_path}/${key}`;
        } else {
            remotePath = `${CONFIG.defaultAlist.mountPath}/${key}`;
        }

        if (rows[0].api_token) {
            token = rows[0].api_token;
        } else if (rows[0].alist_username && rows[0].alist_password) {
            token = await alist.getToken({
                api_host: apiUrl,
                alist_username: rows[0].alist_username,
                alist_password: rows[0].alist_password
            }, CONFIG.defaultAlist);
        }
    } else {
        apiUrl = CONFIG.defaultAlist.url;
        remotePath = `${CONFIG.defaultAlist.mountPath}/${key}`;
    }

    let directUrl;
    if (token) {
        try {
            const fileInfo = await alist.getFileInfo(apiUrl, token, remotePath, false);
            directUrl = fileInfo?.raw_url;
        } catch (err) {
            console.warn('[img] getFileInfo 失败:', err.message);
        }
    }

    if (!directUrl) {
        directUrl = encodeURI(`${apiUrl}/d${remotePath}`);
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
                `SELECT i.id, i.image_key, i.mount_key, i.upload_path, i.is_private, i.original_name, i.description, i.file_size, i.mime_type,
                        i.uploaded_at, i.last_accessed_at, u.username as uploader
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

    router.patch('/images/:image_key', authMiddleware, async (req, res) => {
        const { description } = req.body || {};
        const imageKey = req.params.image_key;

        try {
            const [result] = await db.query(
                'UPDATE image_images SET description = ? WHERE image_key = ?',
                [description || null, imageKey]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: '图片不存在' });
            }

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: '更新失败' });
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

            const [[backupStats]] = await db.query(`
                SELECT
                    SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS backup_success,
                    SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS backup_failed,
                    SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS backup_pending
                FROM image_backups
            `);

            const [[{ total_users }]] = await db.query(
                'SELECT COUNT(*) as total_users FROM users WHERE status = 1'
            );

            const [[{ total_providers }]] = await db.query(
                'SELECT COUNT(*) as total_providers FROM image_providers WHERE status = 1'
            );

            const [[{ total_mounts }]] = await db.query(
                'SELECT COUNT(*) as total_mounts FROM image_mounts WHERE status = 1'
            );

            const [[{ backup_mounts }]] = await db.query(
                'SELECT COUNT(*) as backup_mounts FROM image_mounts WHERE status = 1 AND is_backup = 1'
            );

            res.json({
                ...stats,
                backup_success: backupStats.backup_success || 0,
                backup_failed: backupStats.backup_failed || 0,
                backup_pending: backupStats.backup_pending || 0,
                total_users,
                total_providers,
                total_mounts,
                backup_mounts
            });
        } catch (err) {
            res.status(500).json({ error: '统计查询失败' });
        }
    });

    router.get('/images/:image_key/backups', authMiddleware, async (req, res) => {
        const imageKey = req.params.image_key;
        const userId = req.user.id;

        try {
            const [images] = await db.query(
                'SELECT mount_key FROM image_images WHERE image_key = ?',
                [imageKey]
            );

            if (images.length === 0) {
                return res.status(404).json({ error: '图片不存在' });
            }

            const mainMountKey = images[0].mount_key;

            const [backups] = await db.query(
                `SELECT
                    m.mount_key, m.mount_name, m.mount_path, p.provider_name,
                    b.status, b.error_msg, b.created_at, b.completed_at
                 FROM image_mounts m
                 JOIN image_providers p ON m.provider_id = p.id
                 LEFT JOIN image_backups b ON m.mount_key = b.mount_key AND b.image_key = ?
                 WHERE m.status = 1 AND m.is_backup = 1 AND m.backup_for = ? AND p.status = 1
                 AND (m.is_public = 1 OR m.owner_id = ?)
                 ORDER BY m.id ASC`,
                [imageKey, mainMountKey, userId]
            );

            res.json({ data: backups });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: '查询备份状态失败' });
        }
    });

    router.post('/images/:image_key/backup', authMiddleware, async (req, res) => {
        const imageKey = req.params.image_key;
        const userId = req.user.id;

        try {
            const [images] = await db.query(
                `SELECT i.*, m.mount_path as main_mount_path, p.api_host, p.api_token, p.alist_username, p.alist_password
                 FROM image_images i
                 JOIN image_mounts m ON i.mount_key = m.mount_key
                 JOIN image_providers p ON m.provider_id = p.id
                 WHERE i.image_key = ? AND i.status = 1`,
                [imageKey]
            );

            if (images.length === 0) {
                return res.status(404).json({ error: '图片不存在' });
            }

            const image = images[0];

            const [backupMounts] = await db.query(
                `SELECT m.*, p.api_host, p.api_token, p.alist_username, p.alist_password
                 FROM image_mounts m
                 JOIN image_providers p ON m.provider_id = p.id
                 WHERE m.status = 1 AND m.is_backup = 1 AND m.backup_for = ? AND p.status = 1
                 AND (m.is_public = 1 OR m.owner_id = ?)`,
                [image.mount_key, userId]
            );

            if (backupMounts.length === 0) {
                return res.status(400).json({ error: '没有可用的备份挂载点' });
            }

            const axios = require('axios');
            const mainProvider = {
                api_host: image.api_host,
                api_token: image.api_token,
                alist_username: image.alist_username,
                alist_password: image.alist_password,
            };

            const token = await alist.getToken(mainProvider, CONFIG.defaultAlist);
            if (!token) {
                return res.status(500).json({ error: '主存储认证失败' });
            }

            const remotePath = image.upload_path || `${image.main_mount_path}/${imageKey}`;
            const fileResponse = await axios.get(`${image.api_host}/d${remotePath}`, {
                responseType: 'arraybuffer',
                timeout: 30000,
            });
            const fileBuffer = Buffer.from(fileResponse.data);

            const results = [];
            for (const backupMount of backupMounts) {
                const [existing] = await db.query(
                    'SELECT id, status FROM image_backups WHERE image_key = ? AND mount_key = ?',
                    [imageKey, backupMount.mount_key]
                );

                if (existing.length > 0 && existing[0].status === 2) {
                    results.push({ mount_key: backupMount.mount_key, status: 'skipped', message: '已备份' });
                    continue;
                }

                let backupPath;
                if (image.is_private) {
                    backupPath = `${backupMount.mount_path}/users/${userId}/${imageKey}`;
                } else {
                    backupPath = `${backupMount.mount_path}/public/${imageKey}`;
                }

                const backupProvider = {
                    api_host: backupMount.api_host,
                    api_token: backupMount.api_token,
                    alist_username: backupMount.alist_username,
                    alist_password: backupMount.alist_password,
                };

                await db.query(
                    `INSERT INTO image_backups (image_key, mount_key, upload_path, status)
                     VALUES (?, ?, ?, 1)
                     ON DUPLICATE KEY UPDATE status = 1`,
                    [imageKey, backupMount.mount_key, backupPath]
                );

                const result = await alist.uploadToBackup(backupProvider, CONFIG, backupPath, fileBuffer);

                if (result.success) {
                    await db.query(
                        'UPDATE image_backups SET status = 2, completed_at = NOW() WHERE image_key = ? AND mount_key = ?',
                        [imageKey, backupMount.mount_key]
                    );
                    results.push({ mount_key: backupMount.mount_key, status: 'success' });
                } else {
                    await db.query(
                        'UPDATE image_backups SET status = 3, error_msg = ? WHERE image_key = ? AND mount_key = ?',
                        [result.message, imageKey, backupMount.mount_key]
                    );
                    results.push({ mount_key: backupMount.mount_key, status: 'failed', message: result.message });
                }
            }

            res.json({ success: true, results });
        } catch (err) {
            console.error('[Backup] 手动备份失败:', err.message);
            res.status(500).json({ error: '备份失败', detail: err.message });
        }
    });

    return router;
}

module.exports = { createImageRouter };
