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

    router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: '未获取到图片（仅支持 jpg/png/gif/webp/svg/bmp）' });
        }

        const tempPath = req.file.path;
        console.log('========== 上传开始 ==========');

        try {
            const buf = fs.readFileSync(tempPath);
            const hash = crypto.createHash('md5').update(buf).digest('hex');
            const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
            const key = `${hash}${ext}`;

            const provider = await getProvider(db, CONFIG);
            const remotePath = `${provider.mount_path}/${key}`;

            const directUrl = await alist.uploadAndGetUrl(
                provider,
                CONFIG.defaultAlist,
                remotePath,
                fs.createReadStream(tempPath)
            );

            fs.unlinkSync(tempPath);

            await saveImageRecord(db, key, provider, req);

            console.log('========== 上传成功 ==========');
            res.json({
                success: true,
                image_key: key,
                url: `/img/${key}`,
                direct_url: directUrl
            });
        } catch (err) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            console.error('========== 上传失败 ==========', err.message);
            res.status(500).json({ error: '上传到存储源失败', detail: err.message });
        }
    });

    return router;
}

async function getProvider(db, CONFIG) {
    const [providers] = await db.query(
        'SELECT * FROM image_providers WHERE status = 1 ORDER BY id ASC LIMIT 1'
    );

    if (providers.length > 0) {
        return providers[0];
    }

    return {
        provider_key: 'default',
        api_host: CONFIG.defaultAlist.url,
        api_token: CONFIG.defaultAlist.token,
        alist_username: CONFIG.defaultAlist.username,
        alist_password: CONFIG.defaultAlist.password,
        mount_path: CONFIG.defaultAlist.mountPath,
    };
}

async function saveImageRecord(db, key, provider, req) {
    const [existing] = await db.query('SELECT id FROM image_images WHERE image_key = ? LIMIT 1', [key]);

    if (!existing.length) {
        await db.query(
            `INSERT INTO image_images (image_key, provider, original_name, file_size, mime_type, uploader_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [key, provider.provider_key, req.file.originalname, req.file.size, req.file.mimetype, req.user.id]
        );
    }
}

module.exports = { createUploadRouter };
