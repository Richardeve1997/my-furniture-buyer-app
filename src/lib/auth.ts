'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export type LoginState = { error?: string }

/**
 * Checks an email and password, and if they match, starts a session.
 *
 * Returns an error message rather than throwing, so the login page can show
 * it next to the form instead of the user hitting an error screen.
 */
export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Enter both an email and a password.' }
  }

  const user = await db.user.findUnique({ where: { email } })

  // Deliberately the same message whether the email is unknown or the
  // password is wrong — otherwise this page tells strangers which emails exist.
  const rejection = { error: 'That email and password combination is not right.' }
  if (!user) return rejection

  const matches = await bcrypt.compare(password, user.passwordHash)
  if (!matches) return rejection

  const session = await getSession()
  session.userId = user.id
  session.email = user.email
  session.name = user.name
  session.apiUserId = user.apiUserId
  await session.save()

  redirect('/catalogue')
}

export async function logout() {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}
