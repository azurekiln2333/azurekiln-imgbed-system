const axios = require('axios');

const tokenCache = new Map();

async function login(apiUrl, username, password) {
    const cacheKey = `${apiUrl}:${username}`;
    const cached = tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
        console.log(`[AList] 使用缓存 token: ${cacheKey}`);
        return cached.token;
    }

    console.log(`[AList] 登录获取 token: ${apiUrl}/api/auth/login`);

    try {
        const response = await axios.post(`${apiUrl}/api/auth/login`, {
            username,
            password
        }, { validateStatus: () => true });

        if (response.data.code === 200 && response.data.data?.token) {
            const token = response.data.data.token;
            tokenCache.set(cacheKey, {
                token,
                expiresAt: Date.now() + 2 * 60 * 60 * 1000
            });
            console.log(`[AList] token 获取成功`);
            return token;
        }

        console.error(`[AList] 登录失败: code=${response.data.code}, message=${response.data.message}`);
        return null;
    } catch (err) {
        console.error('[AList] 登录请求失败:', err.message);
        return null;
    }
}

async function getToken(provider, defaultConfig) {
    if (provider.api_token) {
        return provider.api_token;
    }

    const username = provider.alist_username || defaultConfig.username;
    const password = provider.alist_password || defaultConfig.password;
    const apiUrl = provider.api_host || defaultConfig.url;

    if (!username || !password) {
        return null;
    }

    return login(apiUrl, username, password);
}

async function uploadFile(apiUrl, token, remotePath, fileStream) {
    console.log(`[AList] 上传文件: ${remotePath}`);

    const response = await axios.put(`${apiUrl}/api/fs/put`, fileStream, {
        headers: {
            'Authorization': token,
            'File-Path': encodeURIComponent(remotePath),
            'Content-Type': 'application/octet-stream',
        },
        maxBodyLength: Infinity,
        validateStatus: () => true,
    });

    if (response.data.code !== 200) {
        throw new Error(`上传失败: code=${response.data.code}, message=${response.data.message}`);
    }

    console.log(`[AList] 上传成功: ${JSON.stringify(response.data)}`);
    return response.data;
}

async function getFileInfo(apiUrl, token, remotePath, refresh = true) {
    console.log(`[AList] 获取文件信息: ${remotePath}, refresh=${refresh}`);

    const response = await axios.post(`${apiUrl}/api/fs/get`, {
        path: remotePath,
        refresh
    }, {
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
        },
        validateStatus: () => true,
    });

    if (response.data.code !== 200) {
        console.warn(`[AList] 获取文件信息失败: code=${response.data.code}, message=${response.data.message || JSON.stringify(response.data)}`);
        return null;
    }

    console.log(`[AList] 获取文件信息成功: ${JSON.stringify(response.data.data)}`);
    return response.data.data;
}

async function getFileList(apiUrl, token, dirPath, refresh = true) {
    console.log(`[AList] 获取文件列表: ${dirPath}, refresh=${refresh}`);

    const response = await axios.post(`${apiUrl}/api/fs/list`, {
        path: dirPath,
        page: 1,
        per_page: 100,
        password: '',
        refresh
    }, {
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
        },
        validateStatus: () => true,
    });

    if (response.data.code !== 200) {
        console.warn(`[AList] 获取文件列表失败: code=${response.data.code}, message=${response.data.message || JSON.stringify(response.data)}`);
        return null;
    }

    console.log(`[AList] 获取文件列表成功: ${JSON.stringify(response.data.data)}`);
    return response.data.data;
}

async function uploadAndGetUrl(provider, defaultConfig, remotePath, fileStream) {
    const token = await getToken(provider, defaultConfig);
    if (!token) {
        throw new Error('未配置有效的认证方式');
    }

    const apiUrl = provider.api_host || defaultConfig.url;

    await uploadFile(apiUrl, token, remotePath, fileStream);
    const fileListInfo = await getFileList(apiUrl, token, provider.mount_path, true);
    const fileInfo = await getFileInfo(apiUrl, token, remotePath, true);

    if (fileInfo?.raw_url) {
        return fileInfo.raw_url;
    }

    const mountPath = provider.mount_path || defaultConfig.mountPath;
    return encodeURI(`${apiUrl}/d${mountPath}/${remotePath.split('/').pop()}`);
}

module.exports = {
    login,
    getToken,
    uploadFile,
    getFileInfo,
    getFileList,
    uploadAndGetUrl
};
