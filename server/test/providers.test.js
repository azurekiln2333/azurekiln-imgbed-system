const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createProviderRouter } = require('../routes/providers');

test('provider and mount lists omit storage credentials', async () => {
    const db = {
        query: async sql => [sql.includes('FROM image_providers')
            ? [{ id: 1, provider_name: 'AList', api_token: 'secret', alist_password: 'secret' }]
            : [{ id: 2, mount_name: 'Main', api_token: 'secret', alist_password: 'secret' }]]
    };
    const app = express();
    app.use('/api', createProviderRouter(db, (req, _res, next) => { req.user = { id: 'u1', role: 'admin' }; next(); }));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
        const base = `http://127.0.0.1:${server.address().port}/api`;
        for (const path of ['/providers', '/mounts']) {
            const response = await fetch(base + path);
            assert.equal(response.status, 200);
            const data = await response.json();
            assert.equal(data.data[0].api_token, undefined);
            assert.equal(data.data[0].alist_password, undefined);
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('editing a provider preserves credentials when omitted', async () => {
    let update;
    const db = { query: async (sql, params) => { update = { sql, params }; return [{ affectedRows: 1 }]; } };
    const app = express();
    app.use(express.json());
    app.use('/api', createProviderRouter(db, (req, _res, next) => { req.user = { id: 'u1', role: 'admin' }; next(); }));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/providers/4`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_name: 'AList', api_host: 'http://localhost:5244', alist_username: 'admin', status: 0 })
        });
        assert.equal(response.status, 200);
        assert.match(update.sql, /api_token=COALESCE\(\?, api_token\)/);
        assert.match(update.sql, /alist_password=COALESCE\(\?, alist_password\)/);
        assert.deepEqual(update.params, ['AList', 'http://localhost:5244', null, 'admin', null, 0, '4']);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
