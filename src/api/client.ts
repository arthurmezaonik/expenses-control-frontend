import type { AuthenticatedAccount, Category, CategoryInput, CategoryPage, RecordStatus, Summary, Transaction, TransactionInput, TransactionPage } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface CsrfToken {
  headerName: string
  token: string
}

let csrfToken: CsrfToken | null = null
let csrfTokenRequest: Promise<CsrfToken> | null = null

async function getCsrfToken(): Promise<CsrfToken> {
  if (csrfToken) return csrfToken

  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new ApiError('Could not get a security token. Please try again.', response.status)
        csrfToken = await response.json() as CsrfToken
        return csrfToken
      })
      .finally(() => { csrfTokenRequest = null })
  }

  return csrfTokenRequest
}

function clearCsrfToken() {
  csrfToken = null
  csrfTokenRequest = null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof URLSearchParams) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await getCsrfToken()
    headers.set(csrf.headerName, csrf.token)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    method,
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
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
  async login(email: string, password: string) {
    await request<void>('/auth/login', {
      method: 'POST',
      body: new URLSearchParams({ email, password }),
    })
    // Spring invalidates the pre-login CSRF token after authenticating.
    clearCsrfToken()
    await getCsrfToken()
  },
  getCurrentAccount() {
    return request<AuthenticatedAccount>('/auth/me')
  },
  async logout() {
    await request<void>('/auth/logout', { method: 'POST' })
    clearCsrfToken()
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
