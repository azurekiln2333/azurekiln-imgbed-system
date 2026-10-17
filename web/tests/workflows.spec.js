import { test, expect } from '@playwright/test'

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Kp6cAAAAASUVORK5CYII=', 'base64')

test('registration and login use the public auth routes', async ({ page }, testInfo) => {
  let registerPath = ''
  let loginPath = ''
  await page.route('**/api/auth/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/register')) registerPath = path
    if (path.endsWith('/login')) loginPath = path
    return route.fulfill({ json: path.endsWith('/login') ? { token: 'test-token', user: { username: 'tester', role: 'admin' } } : { token: 'new-token' } })
  })
  await page.route('**/api/mounts', route => route.fulfill({ json: { data: [] } }))
  await page.goto('/login')
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png'), fullPage: true })
  await page.goto('/register')
  await page.getByLabel('用户名').fill('tester')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByLabel('确认密码').fill('password123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '立即注册' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(registerPath).toBe('/api/auth/register')
  await page.getByLabel('用户名或邮箱').fill('tester')
  await page.getByLabel('密码', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '立即登录' }).click()
  await expect(page.getByRole('heading', { name: '上传中心' })).toBeVisible()
  expect(loginPath).toBe('/api/auth/login')
})

test('upload, gallery details, settings, and mobile layout', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('user_info', JSON.stringify({ username: 'tester', role: 'admin' }))
  })
  let descriptionMethod = ''
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/mounts') return route.fulfill({ json: { data: [{ id: 1, mount_key: 'main', mount_name: '主存储', provider_name: 'AList', provider_id: 1, mount_path: '/images', is_public: 1, is_backup: 0, status: 1 }] } })
    if (pathname === '/api/upload') return route.fulfill({ json: { image_key: 'demo.png' } })
    if (pathname === '/api/images') return route.fulfill({ json: { data: [{ id: 3, image_key: 'demo.png', original_name: 'demo.png', file_size: 1024, mime_type: 'image/png', mount_key: 'main', uploader: 'tester', description: '' }], pages: 1 } })
    if (pathname === '/api/stats') return route.fulfill({ json: { total_images: 1, total_size: 1024 } })
    if (pathname.endsWith('/backups')) return route.fulfill({ json: { data: [] } })
    if (pathname === '/api/images/demo.png') { descriptionMethod = route.request().method(); return route.fulfill({ json: { success: true } }) }
    if (pathname === '/api/providers') return route.fulfill({ json: { data: [{ id: 1, provider_key: 'alist_1', provider_name: 'AList', api_host: 'http://localhost:5244', status: 1 }] } })
    return route.fulfill({ json: { success: true } })
  })
  await page.route('**/img/**', route => route.fulfill({ body: pixel, contentType: 'image/png' }))
  await page.goto('/')
  await expect(page.locator('#upload-mount')).toHaveValue('main')
  await page.screenshot({ path: testInfo.outputPath('upload-desktop.png'), fullPage: true })
  await page.locator('input[type=file]').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: pixel })
  await page.getByRole('button', { name: '开始上传' }).click()
  await expect(page.locator('input[readonly]').first()).toHaveValue(/\/img\/demo.png/)
  await page.getByRole('button', { name: '图库', exact: true }).click()
  await expect(page.getByText('demo.png').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('gallery-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '查看 demo.png' }).click()
  await page.getByPlaceholder('添加描述...').fill('新的描述')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => descriptionMethod).toBe('PATCH')
  await page.getByRole('button', { name: '关闭详情' }).click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByText('AList', { exact: true }).first()).toBeVisible()
  await page.getByRole('tab', { name: '挂载点' }).click()
  // The mount list renders one card per mount: name, public badge, provider path.
  await expect(page.getByRole('button', { name: /主存储.*公共/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('settings-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('aside').evaluate(element => Math.round(element.getBoundingClientRect().right))).toBeLessThanOrEqual(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('settings-mobile.png'), fullPage: true })
})
