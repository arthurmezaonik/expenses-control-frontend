import type { AuthenticatedAccount, Category, CategoryInput, CategoryPage, RecordStatus, Summary, Transaction, TransactionInput, TransactionPage } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const accessTokenKey = 'expenses-control.access-token'
const tokenExpiryKey = 'expenses-control.access-token-expires-at'

interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function clearAuthSession() {
  sessionStorage.removeItem(accessTokenKey)
  sessionStorage.removeItem(tokenExpiryKey)
}

function getValidAccessToken(): string | null {
  const token = sessionStorage.getItem(accessTokenKey)
  const expiresAt = Date.parse(sessionStorage.getItem(tokenExpiryKey) ?? '')
  if (!token || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearAuthSession()
    return null
  }
  return token
}

async function request<T>(path: string, init?: RequestInit, includeAccessToken = true): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof URLSearchParams) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const accessToken = includeAccessToken ? getValidAccessToken() : null
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, method, headers })
  if (!response.ok) {
    if (response.status === 401) clearAuthSession()
    const message = await response.text()
    throw new ApiError(message || `Request failed (${response.status})`, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value))
  return search.toString()
}

export const api = {
  hasSession() {
    return getValidAccessToken() !== null
  },
  async login(email: string, password: string) {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false)

    if (result.tokenType !== 'Bearer' || !result.accessToken || !Number.isFinite(Date.parse(result.expiresAt))) {
      throw new Error('The server returned an invalid login response.')
    }
    sessionStorage.setItem(accessTokenKey, result.accessToken)
    sessionStorage.setItem(tokenExpiryKey, result.expiresAt)
  },
  getCurrentAccount() {
    return request<AuthenticatedAccount>('/auth/me')
  },
  async logout() {
    // JWTs are stateless; signing out removes this browser tab's copy.
    clearAuthSession()
  },
  getTransactions(params: { page?: number; pageSize?: number; status?: RecordStatus; from?: string; to?: string } = {}) {
    return request<TransactionPage>(`/transactions?${query(params)}`)
  },
  createTransaction(input: TransactionInput) {
    return request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(input) })
  },
  updateTransaction(id: string, input: TransactionInput) {
    return request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  setTransactionStatus(id: string, active: boolean) {
    return request<Transaction>(`/transactions/${id}/status/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' })
  },
  getCategories(page = 1, pageSize = 100) {
    return request<CategoryPage>(`/categories?${query({ page, pageSize })}`)
  },
  createCategory(input: CategoryInput) {
    return request<Category>('/categories', { method: 'POST', body: JSON.stringify(input) })
  },
  updateCategory(id: string, input: CategoryInput) {
    return request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  setCategoryStatus(id: string, active: boolean) {
    return request<Category>(`/categories/${id}/status/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' })
  },
  getSummary(params: { from: string; to: string; page?: number; pageSize?: number }) {
    return request<Summary>(`/summary?${query(params)}`)
  },
}
