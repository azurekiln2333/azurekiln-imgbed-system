require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');

const { authMiddleware } = require('./middleware/auth');
const { createAuthRouter } = require('./routes/auth');
const { createUploadRouter } = require('./routes/upload');
const { createImageRouter } = require('./routes/images');
const { createProviderRouter } = require('./routes/providers');
const { createUserRouter } = require('./routes/users');

const CONFIG = {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || 'change_this_secret',
    jwtExpires: process.env.JWT_EXPIRES || '7d',

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'imagehost',
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
        charset: 'utf8mb4',
    },

    defaultAlist: {
        url: process.env.ALIST_URL || 'http://localhost:5244',
        token: process.env.ALIST_TOKEN || '',
        username: process.env.ALIST_USERNAME || '',
        password: process.env.ALIST_PASSWORD || '',
        mountPath: process.env.ALIST_MOUNT_PATH || '/hi168',
    }
};

const app = express();
let db;

(async () => {
    db = await mysql.createPool(CONFIG.db);
    console.log('✅ 数据库连接成功');

    const auth = authMiddleware(CONFIG);

    app.use(cors({ origin: '*' }));
    app.use(express.json());

    app.use('/api/auth', createAuthRouter(db, CONFIG));
    app.use('/api', createImageRouter(db, CONFIG, auth));
    app.use('/api', createUploadRouter(db, CONFIG, auth));
    app.use('/api', createProviderRouter(db, auth));
    app.use('/api', createUserRouter(db, auth));

    app.listen(CONFIG.port, () => {
        console.log(`🚀 图床服务已启动: http://localhost:${CONFIG.port}`);
        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    });
})();
