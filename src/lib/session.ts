import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'

/**
 * Login sessions.
 *
 * When someone logs in we hand their browser an encrypted cookie saying who
 * they are. iron-session does the encrypting; we never store the password.
 *
 * This is demo-grade auth, appropriate for a one-day hackathon build. It is
 * built correctly for what it is, but it has not been audited and should not
 * sit in front of real customer data without one.
 */

export type SessionData = {
  userId?: string
  email?: string
  name?: string
  /** The ID the furniture-shop API knows this person by, e.g. "u001". */
  apiUserId?: string
}

const password = process.env.SESSION_SECRET

if (!password || password.length < 32) {
  throw new Error(
    'SESSION_SECRET is missing or too short. It must be at least 32 characters. Add it to .env — see .env.example.',
  )
}

const sessionOptions = {
  password,
  cookieName: 'furniture_buyer_session',
  cookieOptions: {
    httpOnly: true,
    // Secure cookies require HTTPS. ngrok serves HTTPS, localhost does not,
    // so this has to follow the environment rather than be hardcoded on.
    secure: process.env.NODE_ENV === 'production',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // Next.js 16: cookies() is async and must be awaited.
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

/** The logged-in user, or null. Use this in pages to decide what to show. */
export async function getCurrentUser(): Promise<SessionData | null> {
  const session = await getSession()
  return session.userId ? session : null
}
