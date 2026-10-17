import { test, expect } from '@playwright/test'

/**
 * Layout contract from the New API redesign:
 * - one page heading per view, no duplicated title or duplicate CTA
 * - sidebar collapses on desktop / slides in as a drawer on mobile
 * - account menu (name, role, logout) lives in the top-right corner
 * - the token management view is reachable and usable
 * - no oversized border radii anywhere
 */

const user = { username: 'tester', role: 'admin' }

const radiusLimitInPx = 8.5 // 0.5rem at the 16px root size
const circleAllowanceInPx = 1 // plus half a pixel of sub-pixel rounding

async function mockApi(page) {
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/tokens' && route.request().method() === 'POST') {
      return route.fulfill({ json: { success: true, token: 'img_plaintext_once', data: { id: 1, name: 'CI 上传', token_prefix: 'img_plai', status: 1, last_used_at: null, created_at: '2026-10-18T00:00:00.000Z' } } })
    }
    if (pathname === '/api/tokens') {
      return route.fulfill({ json: { data: [{ id: 1, name: 'CI 上传', token_prefix: 'img_plai', status: 1, last_used_at: null, created_at: '2026-10-18T00:00:00.000Z' }] } })
    }
    if (pathname === '/api/mounts') return route.fulfill({ json: { data: [] } })
    if (pathname === '/api/images') return route.fulfill({ json: { data: [], pages: 0 } })
    if (pathname === '/api/stats') return route.fulfill({ json: { total_images: 0, total_size: 0 } })
    if (pathname === '/api/providers') return route.fulfill({ json: { data: [] } })
    return route.fulfill({ json: { success: true } })
  })
}

async function openApp(page) {
  await page.addInitScript(info => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('user_info', JSON.stringify(info))
    localStorage.removeItem('sidebar_collapsed')
  }, user)
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '上传中心' })).toBeVisible()
}

function nav(page) {
  return page.getByRole('navigation', { name: '主菜单' })
}

test('desktop sidebar collapses with a width transition and keeps icon-only navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openApp(page)

  const aside = page.locator('aside')
  await expect(aside).toHaveCSS('transition-property', /width/)
  const expanded = await aside.evaluate(node => Math.round(node.getBoundingClientRect().width))
  expect(expanded).toBe(256)

  await page.getByRole('button', { name: '收起侧边栏' }).click()
  await expect.poll(() => aside.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(64)
  // Icon-only rail keeps the accessible name so navigation still works.
  await nav(page).getByRole('button', { name: '令牌管理' }).click()
  await expect(page.getByRole('heading', { name: '令牌管理' })).toBeVisible()
  await page.getByRole('button', { name: '展开侧边栏' }).click()
  await expect.poll(() => aside.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(expanded)
})

test('mobile drawer slides in from the left and closes after navigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)

  const aside = page.locator('aside')
  await expect(aside).toHaveCSS('transition-property', /transform/)
  await expect.poll(() => aside.evaluate(node => Math.round(node.getBoundingClientRect().right))).toBeLessThanOrEqual(0)

  // The header control names the action for the current drawer state.
  await page.getByRole('button', { name: '展开侧边栏' }).click()
  await expect.poll(() => aside.evaluate(node => Math.round(node.getBoundingClientRect().left))).toBe(0)
  await expect(page.getByRole('button', { name: '收起侧边栏' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('mobile-drawer.png'), fullPage: true })

  await page.getByRole('button', { name: '收起侧边栏' }).click()
  await expect.poll(() => aside.evaluate(node => Math.round(node.getBoundingClientRect().right))).toBeLessThanOrEqual(0)

  await page.getByRole('button', { name: '展开侧边栏' }).click()
  await nav(page).getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
  await expect.poll(() => aside.evaluate(node => Math.round(node.getBoundingClientRect().right))).toBeLessThanOrEqual(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('account menu in the top-right exposes name, role and logout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openApp(page)

  const menu = page.getByRole('menu')
  await expect(menu).toHaveCount(0)
  await page.getByRole('button', { name: '账号菜单' }).click()
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('tester')
  await expect(menu).toContainText('管理员')
  await expect(menu.getByRole('menuitem', { name: /退出登录/ })).toBeVisible()

  // The account affordances must not also live in the sidebar.
  const aside = page.locator('aside')
  await expect(aside.getByText('tester')).toHaveCount(0)
  await expect(aside.getByRole('button', { name: /退出登录/ })).toHaveCount(0)

  const headerBox = await page.locator('header').boundingBox()
  const accountBox = await page.getByRole('button', { name: '账号菜单' }).boundingBox()
  const viewport = page.viewportSize()
  expect(accountBox.x + accountBox.width).toBeGreaterThan(viewport.width - 120)
  expect(accountBox.y).toBeGreaterThanOrEqual(headerBox.y)
  expect(accountBox.y + accountBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height)

  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})

test('every view renders exactly one heading and no duplicated CTA or footer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openApp(page)

  const views = [
    { nav: '上传', heading: '上传中心' },
    { nav: '图库', heading: '图床画廊' },
    // The nav label and the page title share the same words by design for the
    // token view, so only the title count inside `main` is asserted there.
    { nav: '令牌管理', heading: '令牌管理', sharedNavLabel: true },
    { nav: '设置', heading: '系统设置' }
  ]

  for (const view of views) {
    await nav(page).getByRole('button', { name: view.nav, exact: true }).click()
    await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible()
    // One page title in `main`, none in the top bar.
    await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveCount(1)
    await expect(page.locator('header').getByRole('heading')).toHaveCount(0)
    if (!view.sharedNavLabel) await expect(page.getByText(view.heading)).toHaveCount(1)
    // No duplicated upload CTA and no console footer.
    await expect(page.getByRole('button', { name: '快速上传' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新建资产' })).toHaveCount(0)
    await expect(page.getByText(/管理控制台/)).toHaveCount(0)
  }
})

test('token management creates, copies, toggles and deletes API tokens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const calls = []
  await openApp(page)
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/tokens')) calls.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })

  await nav(page).getByRole('button', { name: '令牌管理' }).click()
  await expect(page.getByRole('heading', { name: '令牌管理' })).toBeVisible()
  await expect(page.getByText('CI 上传')).toBeVisible()

  await page.getByLabel('令牌名称').fill('CI 上传')
  await page.getByRole('button', { name: '创建令牌' }).click()
  await expect(page.getByLabel('新建的令牌')).toHaveValue('img_plaintext_once')
  await expect.poll(() => calls).toContain('POST /api/tokens')
  await page.screenshot({ path: testInfo.outputPath('tokens-desktop.png'), fullPage: true })

  await page.getByRole('button', { name: '复制', exact: true }).click()
  await expect(page.getByRole('button', { name: '已复制' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('img_plaintext_once')

  await page.getByRole('button', { name: '停用' }).click()
  await expect.poll(() => calls).toContain('PUT /api/tokens/1')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '删除' }).click()
  await expect.poll(() => calls).toContain('DELETE /api/tokens/1')
})

test('no oversized border radii on dashboard views', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openApp(page)

  const radii = () => page.evaluate(({ limit, circle }) => {
    const oversized = []
    for (const element of document.querySelectorAll('aside, header, main, main *, header *')) {
      const style = getComputedStyle(element)
      const px = radius => (radius.endsWith('rem') ? parseFloat(radius) * 16 : parseFloat(radius))
      const radius = px(style.borderTopLeftRadius)
      if (!Number.isFinite(radius) || radius <= limit) continue
      const box = element.getBoundingClientRect()
      // Avatars may be circular; an oversized radius on a badge or card may not.
      const isAvatar = element.classList.contains('rounded-full')
      const isCircle = isAvatar && Math.abs(box.width - box.height) <= circle && radius >= box.width / 2 - circle
      if (!isCircle) oversized.push(`${element.tagName}.${element.className} ${style.borderTopLeftRadius}`)
    }
    return oversized
  }, { limit: radiusLimitInPx, circle: circleAllowanceInPx })

  for (const label of ['上传', '图库', '令牌管理', '设置']) {
    await nav(page).getByRole('button', { name: label, exact: true }).click()
    await expect.poll(radii, { message: `${label} 视图不应出现超过 0.5rem 的圆角` }).toEqual([])
  }
})
