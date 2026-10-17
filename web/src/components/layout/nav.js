/**
 * Primary sidebar navigation.
 *
 * Keys are the contract with `DashboardView`:
 * `upload` / `gallery` / `tokens` / `settings`.
 * `component` is the lazily resolved view for that key; `null` means the
 * view is provided separately (the "tokens" view is written by another
 * owner and may not exist yet).
 */
export const navItems = [
  { key: 'upload', icon: 'cloud_upload', label: '上传' },
  { key: 'gallery', icon: 'photo_library', label: '图库' },
  { key: 'tokens', icon: 'key', label: '令牌管理' },
  { key: 'settings', icon: 'settings', label: '设置' }
]

export function isNavKey(key) {
  return navItems.some(item => item.key === key)
}
