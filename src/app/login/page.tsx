'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/lib/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  )

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-2 text-sm text-stone-600">
        Demo accounts for the hackathon: <code>buyer@demo.com</code> or{' '}
        <code>buyer2@demo.com</code>, password <code>hackathon</code>.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue="buyer@demo.com"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 bg-white"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 bg-white"
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 text-red-800 px-3 py-2 text-sm"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-stone-900 text-white py-2 font-medium hover:bg-stone-700 disabled:opacity-60"
        >
          {pending ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
