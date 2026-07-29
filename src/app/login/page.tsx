'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/lib/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  )

  return (
    <div className="mx-auto mt-10 max-w-md sm:mt-20">
      <div className="hazard h-2" />

      <div className="rack-in border-2 border-t-0 border-rule bg-plate p-7 shadow-[8px_8px_0_0_#000] sm:p-9">
        <p className="stencil text-blaze">/ Access</p>
        <h1 className="display mt-3 text-5xl leading-[0.9] sm:text-6xl">Log in</h1>

        <form action={formAction} className="mt-9 space-y-6">
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
              className="border-l-4 border-blood bg-blood/10 px-3 py-2.5 text-sm text-[#ff8080]"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="stencil press w-full border-2 border-blaze bg-blaze py-4 text-black shadow-[5px_5px_0_0_#000] hover:border-volt hover:bg-volt disabled:cursor-wait disabled:border-rule disabled:bg-plate disabled:text-ash disabled:shadow-none"
          >
            {pending ? 'Checking…' : 'Let me in'}
          </button>
        </form>
      </div>

      <div className="mt-6 border-2 border-dashed border-rule p-5">
        <p className="stencil text-ash">Demo accounts</p>
        <dl className="numerals mt-3 space-y-1.5 text-sm text-bone">
          <div className="flex justify-between gap-4">
            <dt>buyer@demo.com</dt>
            <dd className="text-ash">hackathon</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>buyer2@demo.com</dt>
            <dd className="text-ash">hackathon</dd>
          </div>
        </dl>
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
      <label htmlFor={id} className="stencil block text-ash">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="mt-2.5 w-full border-2 border-rule bg-deck px-4 py-3.5 text-bone transition-colors focus:border-blaze focus:outline-none"
      />
    </div>
  )
}
