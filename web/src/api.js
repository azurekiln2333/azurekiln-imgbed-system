export const imageUrl = key => `${window.location.origin}/img/${encodeURIComponent(key)}`

export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = localStorage.getItem('auth_token')
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  let data
  try { data = await response.json() } catch { data = {} }
  if (response.status === 401 && auth) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    window.location.assign('/login')
  }
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`)
  return data
}
