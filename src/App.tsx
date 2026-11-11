import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './api/client'
import type { AuthenticatedAccount, Category, Summary, Transaction, TransactionType } from './api/types'
import { LoginScreen } from './components/LoginScreen'
import './App.css'

type Screen = 'overview' | 'activity' | 'categories'
type Range = { from: string; to: string }

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const monthRange = (offset = 0): Range => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  const from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const to = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

const money = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(amount)

const displayDate = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00`))

const displayMonth = (value: string) => new Intl.DateTimeFormat('en-GB', {
  month: 'long', year: 'numeric',
}).format(new Date(`${value}T00:00:00`))

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    try {
      const body = JSON.parse(error.message) as { message?: string; error?: string }
      return body.message ?? body.error ?? error.message
    } catch {
      return error.message
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'unavailable'

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [account, setAccount] = useState<AuthenticatedAccount | null>(null)
  const [authCheckKey, setAuthCheckKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.getCurrentAccount().then((currentAccount) => {
      if (cancelled) return
      setAccount(currentAccount)
      setAuthStatus('authenticated')
    }).catch((reason: unknown) => {
      if (cancelled) return
      if (reason instanceof ApiError && reason.status === 401) {
        setAuthStatus('unauthenticated')
      } else {
        setAuthStatus('unavailable')
      }
    })
    return () => { cancelled = true }
  }, [authCheckKey])

  async function login(email: string, password: string) {
    await api.login(email, password)
    const currentAccount = await api.getCurrentAccount()
    setAccount(currentAccount)
    setAuthStatus('authenticated')
  }

  async function logout() {
    await api.logout()
    setAccount(null)
    setAuthStatus('unauthenticated')
  }

  const handleSessionExpired = useCallback(() => {
    setAccount(null)
    setAuthStatus('unauthenticated')
  }, [])

  if (authStatus === 'checking') {
    return <main className="auth-page"><p className="auth-status">Checking your sign-in…</p></main>
  }

  if (authStatus === 'unavailable') {
    return <main className="auth-page"><section className="auth-card auth-status-card">
      <span className="auth-sun" aria-hidden="true">☼</span>
      <h1>We can’t reach your account</h1>
      <p>Check that the finance app server is running, then try again.</p>
      <button className="button button-primary" onClick={() => { setAuthStatus('checking'); setAuthCheckKey((key) => key + 1) }}>Try again</button>
    </section></main>
  }

  if (authStatus === 'unauthenticated' || !account) {
    return <LoginScreen onLogin={login} />
  }

  return <FinanceApp account={account} onLogout={logout} onSessionExpired={handleSessionExpired} />
}

function FinanceApp({ account, onLogout, onSessionExpired }: {
  account: AuthenticatedAccount
  onLogout: () => Promise<void>
  onSessionExpired: () => void
}) {
  const [screen, setScreen] = useState<Screen>('overview')
  const [range, setRange] = useState<Range>(() => monthRange())
  const [rangeChoice, setRangeChoice] = useState<'this' | 'last' | 'custom'>('this')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activityPage, setActivityPage] = useState(1)
  const [activityStatus, setActivityStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [activityPages, setActivityPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialog, setDialog] = useState<'transaction' | 'category' | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(today())
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      api.getSummary({ ...range, page: 1, pageSize: 5 }),
      api.getTransactions({ ...range, page: activityPage, pageSize: 10, status: activityStatus }),
      api.getCategories(1, 100),
    ]).then(([nextSummary, transactionPage, categoryPage]) => {
      if (cancelled) return
      setSummary(nextSummary)
      setTransactions(transactionPage.transactions)
      setActivityPages(transactionPage.pagination.totalPages)
      setCategories(categoryPage.categories)
    }).catch((reason: unknown) => {
      if (cancelled) return
      if (reason instanceof ApiError && reason.status === 401) {
        onSessionExpired()
        return
      }
      setError(errorText(reason))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [range, activityPage, activityStatus, refreshKey, onSessionExpired])

  async function signOut() {
    setLogoutError('')
    try {
      await onLogout()
    } catch (reason) {
      setLogoutError(errorText(reason))
    }
  }

  const activeCategories = useMemo(() => categories.filter((category) => category.status === 'ACTIVE'), [categories])
  const categoryTotals = useMemo(() => (summary?.category_breakdown ?? [])
    .filter((entry) => entry.total_expenses > 0)
    .sort((a, b) => b.total_expenses - a.total_expenses)
    .slice(0, 5), [summary])
  const maxCategorySpend = Math.max(...categoryTotals.map((item) => item.total_expenses), 1)
  const daily = summary?.daily_breakdown ?? []
  const maxDailySpend = Math.max(...daily.map((item) => item.total_expenses), 1)
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  function chooseRange(choice: 'this' | 'last') {
    setRangeChoice(choice)
    setRange(monthRange(choice === 'this' ? 0 : -1))
    setActivityPage(1)
  }

  function changeRange(key: keyof Range, value: string) {
    setRangeChoice('custom')
    setRange((current) => ({ ...current, [key]: value }))
    setActivityPage(1)
  }

  function openTransaction(transaction?: Transaction) {
    setFormError('')
    setEditingTransaction(transaction ?? null)
    setTransactionType(transaction?.type ?? 'EXPENSE')
    setAmount(transaction ? String(transaction.amount) : '')
    setTransactionDate(transaction?.date ?? today())
    setCategoryId(transaction?.category.id ?? activeCategories[0]?.id ?? '')
    setNote(transaction?.note ?? '')
    setDialog('transaction')
  }

  function openCategory(category?: Category) {
    setFormError('')
    setEditingCategory(category ?? null)
    setCategoryName(category?.name ?? '')
    setCategoryDescription(category?.description ?? '')
    setDialog('category')
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const input = {
        type: transactionType,
        amount: Number(amount),
        date: transactionDate,
        category_id: categoryId,
        note: note.trim() || null,
      }
      if (editingTransaction) await api.updateTransaction(editingTransaction.id, input)
      else await api.createTransaction(input)
      setDialog(null)
      setRefreshKey((key) => key + 1)
    } catch (reason) {
      setFormError(errorText(reason))
    } finally {
      setSaving(false)
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const values = { name: categoryName.trim(), description: categoryDescription.trim() || null }
      if (editingCategory) await api.updateCategory(editingCategory.id, values)
      else await api.createCategory(values)
      setDialog(null)
      setRefreshKey((key) => key + 1)
    } catch (reason) {
      setFormError(errorText(reason))
    } finally {
      setSaving(false)
    }
  }

  async function toggleCategory(category: Category) {
    const active = category.status !== 'ACTIVE'
    if (!active && !window.confirm(`Deactivate “${category.name}”? Existing transactions will keep this category.`)) return
    try {
      await api.setCategoryStatus(category.id, active)
      setRefreshKey((key) => key + 1)
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  async function toggleTransaction(transaction: Transaction) {
    const active = transaction.status !== 'ACTIVE'
    if (!active && !window.confirm('Deactivate this transaction? It will remain in your records and can be reactivated later.')) return
    try {
      await api.setTransactionStatus(transaction.id, active)
      setActivityPage(1)
      setRefreshKey((key) => key + 1)
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  const title = screen === 'overview' ? 'Your overview' : screen === 'activity' ? 'Activity' : 'Categories'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setScreen('overview') }} aria-label="Personal finance home">
          <span className="brand-mark" aria-hidden="true">£</span>
          <span>penny &amp; pine</span>
        </a>
        <div className="topbar-actions">
          <span className="currency-pill">GBP&nbsp; £</span>
          <button className="logout-button" onClick={() => void signOut()}>{account.firstName} · Log out</button>
        </div>
      </header>

      <main className="page-content">
        {logoutError && <div className="error-banner" role="alert"><span>{logoutError}</span><button onClick={() => setLogoutError('')}>Dismiss</button></div>}
        <div className="page-heading">
          <div>
            <p className="greeting">{screen === 'overview' ? `${greeting} 👋` : 'A little more about your money'}</p>
            <h1>{title}</h1>
          </div>
          <button className="button button-primary heading-add" onClick={() => openTransaction()}><span aria-hidden="true">＋</span> Add transaction</button>
        </div>

        <section className="period-panel" aria-label="Choose date range">
          <div className="period-tabs" role="group" aria-label="Quick date range">
            <button className={rangeChoice === 'this' ? 'selected' : ''} onClick={() => chooseRange('this')}>This month</button>
            <button className={rangeChoice === 'last' ? 'selected' : ''} onClick={() => chooseRange('last')}>Last month</button>
          </div>
          <details className="custom-range" open={rangeChoice === 'custom'}>
            <summary>{displayMonth(range.from)}</summary>
            <div className="range-inputs">
              <label>From<input type="date" value={range.from} onChange={(event) => changeRange('from', event.target.value)} /></label>
              <label>To<input type="date" value={range.to} onChange={(event) => changeRange('to', event.target.value)} /></label>
            </div>
          </details>
        </section>

        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>}

        {screen === 'overview' && <>
          <section className="summary-grid" aria-label="Cash flow summary">
            <article className="summary-card net-card">
              <div className="summary-label"><span className="summary-icon net-icon">↗</span><span>What's left</span></div>
              <strong>{loading && !summary ? '—' : money(summary?.net ?? 0, summary?.currency)}</strong>
              <p>Income minus spending this period</p>
            </article>
            <article className="summary-card income-card">
              <div className="summary-label"><span className="summary-icon income-icon">↓</span><span>Income</span></div>
              <strong>{loading && !summary ? '—' : money(summary?.total_income ?? 0, summary?.currency)}</strong>
              <p>Money in during this period</p>
            </article>
            <article className="summary-card spending-card">
              <div className="summary-label"><span className="summary-icon spending-icon">↑</span><span>Spent</span></div>
              <strong>{loading && !summary ? '—' : money(summary?.total_expenses ?? 0, summary?.currency)}</strong>
              <p>Money out during this period</p>
            </article>
          </section>

          <section className="insights-grid">
            <article className="panel trend-panel">
              <div className="section-heading"><div><h2>Spending over time</h2><p>A gentle look at your daily spending</p></div><span className="panel-sticker" aria-hidden="true">✳</span></div>
              {daily.length ? <div className="chart" role="img" aria-label="Daily spending chart">
                <div className="chart-bars">{daily.map((day) => <div className="chart-column" key={day.date} title={`${displayDate(day.date)}: ${money(day.total_expenses, summary?.currency)}`}>
                  <div className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(day.total_expenses ? 8 : 0, day.total_expenses / maxDailySpend * 100)}%` }} /></div>
                  <span className="bar-label">{new Date(`${day.date}T00:00:00`).getDate()}</span>
                </div>)}</div>
                <div className="chart-axis"><span>{displayDate(daily[0].date)}</span><span>{displayDate(daily[daily.length - 1].date)}</span></div>
              </div> : <div className="empty-chart"><span aria-hidden="true">☼</span><p>No spending to chart yet.<br />It will fill in as you add transactions.</p></div>}
            </article>

            <article className="panel categories-panel">
              <div className="section-heading"><div><h2>Where it goes</h2><p>Your biggest spending categories</p></div><button className="text-button" onClick={() => setScreen('categories')}>See all</button></div>
              {categoryTotals.length ? <ul className="category-bars">{categoryTotals.map((item, index) => <li key={item.name}>
                <div className="category-line"><span className="category-dot" data-tone={index % 4} /><span className="category-name">{item.name}</span><strong>{money(item.total_expenses, summary?.currency)}</strong></div>
                <div className="category-track"><span style={{ width: `${item.total_expenses / maxCategorySpend * 100}%` }} data-tone={index % 4} /></div>
              </li>)}</ul> : <div className="empty-small">Your category breakdown will appear here.</div>}
            </article>
          </section>

          <section className="panel recent-panel">
            <div className="section-heading"><div><h2>Recent activity</h2><p>Your latest ins and outs</p></div><button className="text-button" onClick={() => setScreen('activity')}>View all</button></div>
            <TransactionList transactions={summary?.transactions ?? []} currency={summary?.currency ?? 'GBP'} loading={loading} onToggle={toggleTransaction} onEdit={openTransaction} />
          </section>
        </>}

        {screen === 'activity' && <section className="panel activity-panel">
          <div className="section-heading activity-heading"><div><h2>Transactions</h2><p>{displayDate(range.from)} – {displayDate(range.to)}</p></div>
            <label className="select-label">Show<select value={activityStatus} onChange={(event) => { setActivityStatus(event.target.value as 'ACTIVE' | 'INACTIVE'); setActivityPage(1) }}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
          </div>
          <TransactionList transactions={transactions} currency={summary?.currency ?? 'GBP'} loading={loading} onToggle={toggleTransaction} onEdit={openTransaction} />
          {activityPages > 1 && <div className="pagination"><button disabled={activityPage <= 1} onClick={() => setActivityPage((page) => page - 1)}>Previous</button><span>Page {activityPage} of {activityPages}</span><button disabled={activityPage >= activityPages} onClick={() => setActivityPage((page) => page + 1)}>Next</button></div>}
        </section>}

        {screen === 'categories' && <section className="panel category-management">
          <div className="section-heading"><div><h2>Your categories</h2><p>Organise spending in a way that makes sense to you</p></div><button className="button button-secondary" onClick={() => openCategory()}>＋ Add category</button></div>
          <ul className="managed-categories">{categories.map((category, index) => <li key={category.id} className={category.status === 'INACTIVE' ? 'inactive-row' : ''}>
            <span className="category-illustration" data-tone={index % 4} aria-hidden="true">{['◌', '⌂', '♡', '✳'][index % 4]}</span>
            <div className="managed-name"><strong>{category.name}</strong><span>{category.description || (category.status === 'ACTIVE' ? 'Ready to use' : 'Inactive')}</span></div>
            <button className="small-action" onClick={() => openCategory(category)}>Edit</button>
            <button className="small-action" onClick={() => void toggleCategory(category)}>{category.status === 'ACTIVE' ? 'Pause' : 'Restore'}</button>
          </li>)}</ul>
          {!categories.length && !loading && <div className="empty-state"><span aria-hidden="true">✳</span><strong>No categories yet</strong><p>Add a category to organise your transactions.</p><button className="button button-secondary" onClick={() => openCategory()}>Add your first category</button></div>}
        </section>}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={screen === 'overview' ? 'nav-active' : ''} onClick={() => setScreen('overview')}><span aria-hidden="true">⌂</span><small>Overview</small></button>
        <button className={screen === 'activity' ? 'nav-active' : ''} onClick={() => setScreen('activity')}><span aria-hidden="true">☷</span><small>Activity</small></button>
        <button className="nav-add" onClick={() => openTransaction()} aria-label="Add transaction"><span aria-hidden="true">＋</span><small>Add</small></button>
        <button className={screen === 'categories' ? 'nav-active' : ''} onClick={() => setScreen('categories')}><span aria-hidden="true">◈</span><small>Categories</small></button>
      </nav>

      {dialog && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}>
        <section className="form-sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-heading"><div><p className="greeting">A small step toward clarity</p><h2 id="dialog-title">{dialog === 'transaction' ? editingTransaction ? 'Edit transaction' : 'Add a transaction' : editingCategory ? 'Edit category' : 'Add a category'}</h2></div><button className="close-button" onClick={() => setDialog(null)} aria-label="Close">×</button></div>
          {dialog === 'transaction' ? <form className="entry-form" onSubmit={(event) => void saveTransaction(event)}>
            <div className="type-toggle" role="group" aria-label="Transaction type"><button type="button" className={transactionType === 'EXPENSE' ? 'chosen expense-choice' : ''} onClick={() => setTransactionType('EXPENSE')}>I spent</button><button type="button" className={transactionType === 'INCOME' ? 'chosen income-choice' : ''} onClick={() => setTransactionType('INCOME')}>I received</button></div>
            <label>Amount<div className="amount-input"><span>£</span><input required type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></div></label>
            <div className="form-row"><label>Date<input required type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} /></label><label>Category<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="" disabled>Choose one</option>{activeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></div>
            {!activeCategories.length && <p className="inline-hint">Add a category before recording a transaction.</p>}
            <label>Note <span className="optional-label">Optional</span><input maxLength={255} placeholder="What was it for?" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="button button-primary submit-button" disabled={saving || !activeCategories.length}>{saving ? 'Saving…' : editingTransaction ? 'Save changes' : 'Save transaction'}</button>
          </form> : <form className="entry-form" onSubmit={(event) => void saveCategory(event)}>
            <label>Category name<input autoFocus required minLength={3} maxLength={120} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Family days out" /></label>
            <label>Description <span className="optional-label">Optional</span><textarea maxLength={255} rows={3} value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="A note to help you remember" /></label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="button button-primary submit-button" disabled={saving}>{saving ? 'Saving…' : editingCategory ? 'Save changes' : 'Add category'}</button>
          </form>}
        </section>
      </div>}
    </div>
  )
}

function TransactionList({ transactions, currency, loading, onToggle, onEdit }: {
  transactions: Transaction[]
  currency: string
  loading: boolean
  onToggle: (transaction: Transaction) => void
  onEdit: (transaction: Transaction) => void
}) {
  if (loading && !transactions.length) return <div className="list-message">Gathering your activity…</div>
  if (!transactions.length) return <div className="empty-state compact-empty"><span aria-hidden="true">☼</span><strong>Nothing to show just yet</strong><p>When you add a transaction, it will appear here.</p></div>
  return <ul className="transaction-list">{transactions.map((transaction) => {
    const isIncome = transaction.type === 'INCOME'
    return <li key={transaction.id} className={transaction.status === 'INACTIVE' ? 'inactive-row' : ''}>
      <span className={`transaction-mark ${isIncome ? 'mark-income' : 'mark-expense'}`} aria-hidden="true">{isIncome ? '↓' : '↑'}</span>
      <div className="transaction-description"><strong>{transaction.category.name}</strong><span>{displayDate(transaction.date)}{transaction.note ? ` · ${transaction.note}` : ''}</span></div>
      <strong className={`transaction-amount ${isIncome ? 'amount-income' : ''}`}>{isIncome ? '+' : '−'}{money(transaction.amount, currency)}</strong>
      <div className="transaction-actions">
        <button className="transaction-edit" onClick={() => onEdit(transaction)} aria-label="Edit transaction">✎</button>
        <button className="transaction-status" onClick={() => onToggle(transaction)} aria-label={`${transaction.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} transaction`}>{transaction.status === 'ACTIVE' ? '•••' : '↻'}</button>
      </div>
    </li>
  })}</ul>
}

export default App
