'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/lib/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  )

  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="game-card pop-in p-7">
        <p aria-hidden className="text-display leading-none">🛋️</p>
        <h1 className="headline mt-3 text-h1">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Log in to start spending your budget.
        </p>

        <form action={formAction} className="mt-7 space-y-5">
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            defaultValue="buyer@demo.com"
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />

          {state.error && (
            <p
              role="alert"
              className="rounded-md bg-coral/10 px-3 py-2.5 text-sm text-coral-dark"
            >
              ⚠️ {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="pill pill-gold w-full disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? 'Checking…' : 'Let me in'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  type,
  autoComplete,
  defaultValue,
}: {
  id: string
  label: string
  type: string
  autoComplete: string
  defaultValue?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="field mt-2"
      />
    </div>
  )
}
