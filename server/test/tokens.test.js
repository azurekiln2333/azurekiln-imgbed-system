const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createTokenRouter } = require('../routes/tokens');
const { authMiddleware } = require('../middleware/auth');

const CONFIG = { jwtSecret: 'test_secret', jwtExpires: '1h' };

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function createDb({ tokens = [], users = [] } = {}) {
    const state = { tokens, users, statements: [] };
    let autoId = tokens.length;

    state.query = async (sql, params = []) => {
        state.statements.push({ sql, params });

        if (/FROM user_api_tokens/.test(sql) && /token_hash = \?/.test(sql)) {
            const row = state.tokens.find(item => item.token_hash === params[0] && Number(item.status) === 1);
            if (!row) return [[]];
            const user = state.users.find(item => item.id === row.user_id);
            return [[{
                id: row.id,
                user_id: row.user_id,
                username: user ? user.username : null,
                role: user ? user.role : null,
                status: user ? user.status : 0,
            }]];
        }
        if (/FROM user_api_tokens/.test(sql) && /WHERE id = \?/.test(sql)) {
            return [state.tokens.filter(item => String(item.id) === String(params[0]))];
        }
        if (/FROM user_api_tokens/.test(sql)) {
            return [state.tokens.filter(item => item.user_id === params[0]).map(item => ({ ...item }))];
        }
        return [{}];
    };

    state.insert = async (sql, params) => {
        const [userId, name, tokenHash, tokenPrefix] = params;
        autoId += 1;
        state.tokens.push({
            id: autoId, user_id: userId, name, token_hash: tokenHash,
            token_prefix: tokenPrefix, status: 1, last_used_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
        });
        return [{ insertId: autoId, affectedRows: 1 }];
    };

    return state;
}

function makeDb(db) {
    return {
        query: async (sql, params) => {
            if (/^\s*INSERT INTO user_api_tokens/i.test(sql)) return db.insert(sql, params);
            if (/^\s*UPDATE user_api_tokens SET status/.test(sql)) {
                const row = db.tokens.find(item => String(item.id) === String(params[1]) && item.user_id === params[2]);
                if (!row) return [{ affectedRows: 0 }];
                row.status = params[0];
                db.statements.push({ sql, params });
                return [{ affectedRows: 1 }];
            }
            if (/^\s*DELETE FROM user_api_tokens/.test(sql)) {
                const index = db.tokens.findIndex(item => String(item.id) === String(params[0]) && item.user_id === params[1]);
                if (index === -1) return [{ affectedRows: 0 }];
                db.tokens.splice(index, 1);
                db.statements.push({ sql, params });
                return [{ affectedRows: 1 }];
            }
            if (/^\s*UPDATE user_api_tokens SET last_used_at/.test(sql)) {
                const row = db.tokens.find(item => String(item.id) === String(params[0]));
                if (row) row.last_used_at = '2024-01-02T00:00:00.000Z';
                db.statements.push({ sql, params });
                return [{ affectedRows: row ? 1 : 0 }];
            }
            return db.query(sql, params);
        },
    };
}

async function startApp(app, prefix = '/api') {
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    return { server, base: `http://127.0.0.1:${server.address().port}${prefix}` };
}

function buildApp(db) {
    const app = express();
    app.use(express.json());
    app.use('/api', createTokenRouter(db, authMiddleware(CONFIG, db)));
    return app;
}

const userToken = () => jwt.sign({ id: 'uid_1', username: 'alice', role: 'user' }, CONFIG.jwtSecret, { expiresIn: '1h' });

test('creating a token returns plaintext once and stores only its sha256 hash', async () => {
    const db = createDb();
    const app = buildApp(makeDb(db));
    const { server, base } = await startApp(app);
    try {
        const response = await fetch(`${base}/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken()}` },
            body: JSON.stringify({ name: 'CI 上传' }),
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.ok(body.token && body.token.length > 20);
        assert.equal(body.data.name, 'CI 上传');
        assert.equal(body.data.status, 1);
        assert.equal(body.token_hash, undefined);

        const stored = db.tokens[0];
        assert.equal(stored.token_hash, sha256(body.token));
        assert.notEqual(stored.token_hash, body.token);
        assert.equal(stored.token_prefix, body.token.slice(0, 8));

        const list = await fetch(`${base}/tokens`, { headers: { Authorization: `Bearer ${userToken()}` } });
        const listBody = await list.json();
        assert.equal(listBody.data.length, 1);
        assert.equal(listBody.data[0].token, undefined);
        assert.equal(listBody.data[0].token_hash, undefined);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('token list, status toggle and delete are scoped to the owner', async () => {
    const db = createDb({
        tokens: [
            { id: 1, user_id: 'uid_1', name: 'mine', token_hash: sha256('a'), token_prefix: 'img_a', status: 1, last_used_at: null, created_at: 'x' },
            { id: 2, user_id: 'uid_2', name: 'other', token_hash: sha256('b'), token_prefix: 'img_b', status: 1, last_used_at: null, created_at: 'x' },
        ],
    });
    const app = buildApp(makeDb(db));
    const { server, base } = await startApp(app);
    const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken()}` };
    try {
        const list = await (await fetch(`${base}/tokens`, { headers: auth })).json();
        assert.deepEqual(list.data.map(item => item.id), [1]);

        const forbidden = await fetch(`${base}/tokens/2`, { method: 'PUT', headers: auth, body: JSON.stringify({ status: 0 }) });
        assert.equal(forbidden.status, 404);

        const ok = await fetch(`${base}/tokens/1`, { method: 'PUT', headers: auth, body: JSON.stringify({ status: 0 }) });
        assert.equal(ok.status, 200);
        assert.equal(db.tokens.find(item => item.id === 1).status, 0);

        const bad = await fetch(`${base}/tokens/1`, { method: 'PUT', headers: auth, body: JSON.stringify({ status: 5 }) });
        assert.equal(bad.status, 400);

        const denied = await fetch(`${base}/tokens/2`, { method: 'DELETE', headers: auth });
        assert.equal(denied.status, 404);

        const removed = await fetch(`${base}/tokens/1`, { method: 'DELETE', headers: auth });
        assert.equal(removed.status, 200);
        assert.equal(db.tokens.some(item => item.id === 1), false);
        assert.equal(db.tokens.some(item => item.id === 2), true);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('api token authenticates requests and updates last_used_at', async () => {
    const raw = 'img_plaintext_token_value';
    const db = createDb({
        tokens: [{ id: 7, user_id: 'uid_1', name: 'ci', token_hash: sha256(raw), token_prefix: 'img_plai', status: 1, last_used_at: null }],
        users: [{ id: 'uid_1', username: 'alice', role: 'user', status: 1 }],
    });
    const auth = authMiddleware(CONFIG, makeDb(db));
    const app = express();
    let seen;
    app.get('/probe', auth, (req, res) => { seen = { user: req.user, type: req.authType }; res.json({ ok: true }); });

    const { server, base } = await startApp(app, '');
    try {
        const response = await fetch(`${base}/probe`, { headers: { Authorization: `Bearer ${raw}` } });
        assert.equal(response.status, 200);
        assert.equal(seen.type, 'token');
        assert.equal(seen.user.id, 'uid_1');
        assert.equal(seen.user.username, 'alice');
        assert.equal(db.tokens[0].last_used_at, '2024-01-02T00:00:00.000Z');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('disabled or unknown api tokens are rejected while jwt keeps working', async () => {
    const db = createDb({
        tokens: [{ id: 8, user_id: 'uid_1', name: 'off', token_hash: sha256('img_disabled'), token_prefix: 'img_disa', status: 0 }],
        users: [{ id: 'uid_1', username: 'alice', role: 'user', status: 1 }],
    });
    const auth = authMiddleware(CONFIG, makeDb(db));
    const app = express();
    app.get('/probe', auth, (req, res) => res.json({ type: req.authType }));

    const { server, base } = await startApp(app, '');
    try {
        const disabled = await fetch(`${base}/probe`, { headers: { Authorization: 'Bearer img_disabled' } });
        assert.equal(disabled.status, 401);

        const unknown = await fetch(`${base}/probe`, { headers: { Authorization: 'Bearer img_nope' } });
        assert.equal(unknown.status, 401);

        const noHeader = await fetch(`${base}/probe`);
        assert.equal(noHeader.status, 401);

        const viaJwt = await fetch(`${base}/probe`, { headers: { Authorization: `Bearer ${userToken()}` } });
        assert.equal(viaJwt.status, 200);
        assert.equal((await viaJwt.json()).type, 'jwt');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('api tokens cannot use token management endpoints', async () => {
    const raw = 'img_manage_blocked';
    const db = createDb({
        tokens: [{ id: 9, user_id: 'uid_1', name: 'ci', token_hash: sha256(raw), token_prefix: 'img_mana', status: 1, last_used_at: null }],
        users: [{ id: 'uid_1', username: 'alice', role: 'user', status: 1 }],
    });
    const app = buildApp(makeDb(db));
    const { server, base } = await startApp(app);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${raw}` };
    try {
        const list = await fetch(`${base}/tokens`, { headers });
        assert.equal(list.status, 403);

        const create = await fetch(`${base}/tokens`, { method: 'POST', headers, body: JSON.stringify({ name: 'x' }) });
        assert.equal(create.status, 403);

        const toggle = await fetch(`${base}/tokens/9`, { method: 'PUT', headers, body: JSON.stringify({ status: 0 }) });
        assert.equal(toggle.status, 403);

        const remove = await fetch(`${base}/tokens/9`, { method: 'DELETE', headers });
        assert.equal(remove.status, 403);

        assert.equal(db.tokens[0].status, 1);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('creating a token without a name is rejected', async () => {
    const db = createDb();
    const app = buildApp(makeDb(db));
    const { server, base } = await startApp(app);
    try {
        const response = await fetch(`${base}/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken()}` },
            body: JSON.stringify({ name: '   ' }),
        });
        assert.equal(response.status, 400);
        assert.equal(db.tokens.length, 0);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
