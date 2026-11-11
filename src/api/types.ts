export type TransactionType = 'INCOME' | 'EXPENSE'
export type RecordStatus = 'ACTIVE' | 'INACTIVE'

export interface AuthenticatedAccount {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  status: RecordStatus
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string
  category: Category
  note: string | null
  status: RecordStatus
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  date: string
  category_id: string
  note?: string | null
}

export interface CategoryInput {
  name: string
  description?: string | null
}

export interface Pagination {
  currentPage: number
  pageSize: number
  totalElements: number
  totalPages: number
}

export interface TransactionPage { transactions: Transaction[]; pagination: Pagination }
export interface CategoryPage { categories: Category[]; pagination: Pagination }

export interface CategoryBreakdown {
  name: string
  total_income: number
  total_expenses: number
  net: number
}

export interface DailyBreakdown {
  date: string
  total_income: number
  total_expenses: number
  net: number
}

export interface Summary {
  from: string
  to: string
  currency: string
  total_income: number
  total_expenses: number
  net: number
  category_breakdown: CategoryBreakdown[]
  daily_breakdown: DailyBreakdown[]
  transactions: Transaction[]
  pagination: Pagination
}
