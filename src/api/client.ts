import type { Category, CategoryInput, CategoryPage, RecordStatus, Summary, Transaction, TransactionInput, TransactionPage } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new ApiError(message || `Request failed (${response.status})`, response.status)
  }
  return response.json() as Promise<T>
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value))
  return search.toString()
}

export const api = {
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
