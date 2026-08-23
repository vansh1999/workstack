import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import { IconAlert } from '../components/icons'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await register({ email, full_name: fullName, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-card__header">
        <h1 className="auth-card__title">Create your account</h1>
        <p className="auth-card__subtitle">Get started with Work Stack</p>
      </div>

      {error && (
        <div className="error-banner">
          <IconAlert size={15} />
          <span>{error}</span>
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="form-field__hint">At least 8 characters.</span>
        </div>
        <button className="btn btn--block" type="submit" disabled={isSubmitting}>
          {isSubmitting && <span className="spinner" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="auth-card__footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </div>
  )
}
