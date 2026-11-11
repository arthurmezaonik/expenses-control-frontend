import { type FormEvent, useState } from 'react'
import { ApiError } from '../api/client'
import '../App.css'

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await onLogin(email.trim(), password)
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 401
        ? 'That email and password do not match. Please try again.'
        : reason instanceof Error ? reason.message : 'We could not sign you in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="brand auth-brand" href={import.meta.env.BASE_URL} aria-label="Penny and Pine">
          <span className="brand-mark" aria-hidden="true">£</span>
          <span>penny &amp; pine</span>
        </a>
        <div className="auth-intro">
          <span className="auth-sun" aria-hidden="true">☼</span>
          <p className="greeting">A calm place for your money</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to see your household’s money, all in one place.</p>
        </div>
        <form className="entry-form auth-form" onSubmit={(event) => void submit(event)}>
          <label>Email address
            <input autoComplete="username" autoFocus required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>Password
            <input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary submit-button" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footnote">Your login is private to your household.</p>
      </section>
    </main>
  )
}
