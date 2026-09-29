const { Router } = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const alist = require('../utils/alist');

function createUploadRouter(db, CONFIG, authMiddleware) {
    const router = Router();

    const upload = multer({
        dest: 'uploads/',
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
            cb(null, allowed.includes(file.mimetype));
        }
    });

    router.post('/upload', (req, res, next) => {
        console.log('[Upload] 收到上传请求');
        next();
    }, authMiddleware, upload.single('image'), async (req, res) => {
        console.log('[Upload] 通过认证中间件');
        if (!req.file) {
            console.log('[Upload] 没有收到文件');
            return res.status(400).json({ error: '未获取到图片（仅支持 jpg/png/gif/webp/svg/bmp）' });
        }

        console.log('[Upload] 收到文件:', req.file.originalname);
        const tempPath = req.file.path;
        const mountKey = req.body.mount_key;
        const isPrivate = req.body.is_private === '1';
        const userId = req.user.id;

        console.log('========== 上传开始 ==========');
        console.log(`[Upload] mount_key: ${mountKey}, is_private: ${isPrivate}, user_id: ${userId}`);

        try {
            const buf = fs.readFileSync(tempPath);
            const hash = crypto.createHash('md5').update(buf).digest('hex');
            const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
            const key = `${hash}${ext}`;

            let mount;
            if (mountKey) {
                mount = await getMountByKey(db, CONFIG, mountKey, userId);
                if (!mount) {
                    fs.unlinkSync(tempPath);
                    return res.status(400).json({ error: '挂载点不存在或无权访问' });
                }
            } else {
                mount = await getDefaultMount(db, CONFIG, userId);
            }

            console.log(`[Upload] 主挂载点: ${mount.mount_key}, path: ${mount.mount_path}`);

            let uploadPath;
            if (isPrivate) {
                uploadPath = `${mount.mount_path}/users/${userId}/${key}`;
            } else {
                uploadPath = `${mount.mount_path}/public/${key}`;
            }

            const provider = {
                api_host: mount.api_host,
                api_token: mount.api_token,
                alist_username: mount.alist_username,
                alist_password: mount.alist_password,
                mount_path: mount.mount_path,
            };

            const apiUrl = provider.api_host || CONFIG.defaultAlist.url;
            const directUrl = encodeURI(`${apiUrl}/d${uploadPath}`);

            await saveImageRecord(db, key, mount, req, uploadPath, isPrivate);

            const backupMounts = await getBackupMountsForMount(db, CONFIG, mount.mount_key, userId);
            const backupCount = backupMounts.length;

            console.log('========== 立即返回响应 ==========');

            res.json({
                success: true,
                image_key: key,
                url: `/img/${key}`,
                direct_url: directUrl,
                upload_path: uploadPath,
                backup_count: backupCount
            });

            process.nextTick(() => {
                processUploadAsync(db, CONFIG, key, provider, uploadPath, tempPath, buf, backupMounts, isPrivate, userId).catch(err => {
                    console.error('[Upload] 后台处理错误:', err.message);
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                });
            });

        } catch (err) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            console.error('========== 上传失败 ==========', err.message);
            res.status(500).json({ error: '上传处理失败', detail: err.message });
        }
    });

    return router;
}

async function processUploadAsync(db, CONFIG, key, provider, uploadPath, tempPath, buf, backupMounts, isPrivate, userId) {
    console.log(`[Upload] 后台上传到AList: ${key}`);

    try {
        await alist.uploadFile(
            provider.api_host || CONFIG.defaultAlist.url,
            await alist.getToken(provider, CONFIG.defaultAlist),
            uploadPath,
            fs.createReadStream(tempPath)
        );
        console.log(`[Upload] AList上传完成: ${key}`);
    } catch (err) {
        console.error(`[Upload] AList上传失败: ${err.message}`);
    }

    if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
    }

    if (backupMounts.length > 0) {
        await processBackups(db, CONFIG, key, backupMounts, isPrivate, userId, buf);
    }
}

async function processBackups(db, CONFIG, key, backupMounts, isPrivate, userId, fileBuffer) {
    console.log(`[Backup] 开始后台备份: ${key}, ${backupMounts.length} 个目标`);

    for (const backupMount of backupMounts) {
        let backupPath;
        if (isPrivate) {
            backupPath = `${backupMount.mount_path}/users/${userId}/${key}`;
        } else {
            backupPath = `${backupMount.mount_path}/public/${key}`;
        }

        const backupProvider = {
            api_host: backupMount.api_host,
            api_token: backupMount.api_token,
            alist_username: backupMount.alist_username,
            alist_password: backupMount.alist_password,
            mount_path: backupMount.mount_path,
        };

        await createBackupRecord(db, key, backupMount.mount_key, backupPath);
        await backupImage(db, key, backupMount, backupProvider, CONFIG, backupPath, fileBuffer);
    }

    console.log(`[Backup] 后台备份完成: ${key}`);
}

async function getMountByKey(db, CONFIG, mountKey, userId) {
    const [mounts] = await db.query(
        `SELECT m.*, p.api_host, p.api_token, p.alist_username, p.alist_password
         FROM image_mounts m
         JOIN image_providers p ON m.provider_id = p.id
         WHERE m.mount_key = ? AND m.status = 1 AND m.is_backup = 0 AND p.status = 1
         AND (m.is_public = 1 OR m.owner_id = ?)
         LIMIT 1`,
        [mountKey, userId]
    );

    return mounts.length > 0 ? mounts[0] : null;
}

async function getDefaultMount(db, CONFIG, userId) {
    const [mounts] = await db.query(
        `SELECT m.*, p.api_host, p.api_token, p.alist_username, p.alist_password
         FROM image_mounts m
         JOIN image_providers p ON m.provider_id = p.id
         WHERE m.status = 1 AND m.is_backup = 0 AND p.status = 1
         AND (m.is_public = 1 OR m.owner_id = ?)
         ORDER BY m.is_public DESC, m.id ASC LIMIT 1`,
        [userId]
    );

    if (mounts.length > 0) {
        return mounts[0];
    }

    return {
        mount_key: 'default',
        mount_path: CONFIG.defaultAlist.mountPath,
        api_host: CONFIG.defaultAlist.url,
        api_token: CONFIG.defaultAlist.token,
        alist_username: CONFIG.defaultAlist.username,
        alist_password: CONFIG.defaultAlist.password,
    };
}

async function getBackupMountsForMount(db, CONFIG, mountKey, userId) {
    const [mounts] = await db.query(
        `SELECT m.*, p.api_host, p.api_token, p.alist_username, p.alist_password
         FROM image_mounts m
         JOIN image_providers p ON m.provider_id = p.id
         WHERE m.status = 1 AND m.is_backup = 1 AND m.backup_for = ? AND p.status = 1
         AND (m.is_public = 1 OR m.owner_id = ?)
         ORDER BY m.is_public DESC, m.id ASC`,
        [mountKey, userId]
    );

    return mounts;
}

async function saveImageRecord(db, key, mount, req, uploadPath, isPrivate) {
    const [existing] = await db.query('SELECT id FROM image_images WHERE image_key = ? LIMIT 1', [key]);

    if (!existing.length) {
        await db.query(
            `INSERT INTO image_images (image_key, mount_key, upload_path, is_private, original_name, file_size, mime_type, uploader_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [key, mount.mount_key, uploadPath, isPrivate ? 1 : 0, req.file.originalname, req.file.size, req.file.mimetype, req.user.id]
        );
    }
}

async function createBackupRecord(db, imageKey, mountKey, uploadPath) {
    try {
        await db.query(
            `INSERT INTO image_backups (image_key, mount_key, upload_path, status)
             VALUES (?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE status = 0, upload_path = ?`,
            [imageKey, mountKey, uploadPath, uploadPath]
        );
    } catch (err) {
        console.error(`[Backup] 创建备份记录失败:`, err.message);
    }
}

async function backupImage(db, key, backupMount, backupProvider, CONFIG, backupPath, fileBuffer) {
    const mountKey = backupMount.mount_key;

    try {
        await db.query(
            'UPDATE image_backups SET status = 1 WHERE image_key = ? AND mount_key = ?',
            [key, mountKey]
        );

        const result = await alist.uploadToBackup(backupProvider, CONFIG, backupPath, fileBuffer);

        if (result.success) {
            await db.query(
                'UPDATE image_backups SET status = 2, completed_at = NOW() WHERE image_key = ? AND mount_key = ?',
                [key, mountKey]
            );
            console.log(`[Backup] 图片 ${key} 备份到 ${mountKey} 成功`);
        } else {
            await db.query(
                'UPDATE image_backups SET status = 3, error_msg = ? WHERE image_key = ? AND mount_key = ?',
                [result.message || '上传失败', key, mountKey]
            );
            console.error(`[Backup] 图片 ${key} 备份到 ${mountKey} 失败:`, result.message);
        }
    } catch (err) {
        await db.query(
            'UPDATE image_backups SET status = 3, error_msg = ? WHERE image_key = ? AND mount_key = ?',
            [err.message, key, mountKey]
        );
        console.error(`[Backup] 图片 ${key} 备份到 ${mountKey} 异常:`, err.message);
    }
}

module.exports = { createUploadRouter };
