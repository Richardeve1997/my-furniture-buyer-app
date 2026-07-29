'use client'

import { useRef, useState } from 'react'
import { askAgent, confirmAgentOrder } from '@/lib/agent-actions'
import type { ChatMessage, PendingOrder } from '@/lib/agent'
import { formatCents } from '@/lib/money'

type Bubble = { who: 'you' | 'bot'; text: string }

const SUGGESTIONS = [
  "What's my balance?",
  'Find me a chair under $500',
  'Something for a kid&apos;s room',
]

export function AgentChat() {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return

    setBusy(true)
    setError(null)
    setPending(null)
    setBubbles((b) => [...b, { who: 'you', text: message }])
    if (inputRef.current) inputRef.current.value = ''

    const result = await askAgent(history, message)

    if (result.error) {
      setError(result.error)
    } else {
      setHistory(result.messages)
      setBubbles((b) => [...b, { who: 'bot', text: result.reply }])
      if (result.pending) setPending(result.pending)
    }
    setBusy(false)
  }

  async function confirm() {
    if (!pending || busy) return
    setBusy(true)
    const order = pending
    setPending(null)

    const result = await confirmAgentOrder(history, order)
    if (result.error) {
      setError(result.error)
    } else {
      setHistory(result.messages)
      setBubbles((b) => [...b, { who: 'bot', text: result.reply }])
    }
    setBusy(false)
  }

  function decline() {
    setPending(null)
    setBubbles((b) => [...b, { who: 'bot', text: 'No problem — nothing was bought.' }])
  }

  return (
    <section className="game-card p-5">
      <div className="section-title">
        <span aria-hidden className="text-h1">💬</span>
        <div>
          <p className="eyebrow text-teal">Ask for what you want</p>
          <h2 className="headline text-h2 leading-tight">Shopping assistant</h2>
        </div>
      </div>

      {bubbles.length === 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => {
            const text = s.replace(/&apos;/g, "'")
            return (
              <button
                key={s}
                onClick={() => send(text)}
                disabled={busy}
                className="pill pill-ghost text-sm disabled:opacity-50"
              >
                {text}
              </button>
            )
          })}
        </div>
      )}

      {bubbles.length > 0 && (
        <ol className="mt-5 space-y-3">
          {bubbles.map((b, i) => (
            <li
              key={i}
              className={`pop-in flex ${b.who === 'you' ? 'justify-end' : 'justify-start'}`}
            >
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  b.who === 'you'
                    ? 'bg-teal text-white'
                    : 'bg-cream text-ink'
                }`}
              >
                {b.text}
              </p>
            </li>
          ))}
        </ol>
      )}

      {busy && (
        <p className="eyebrow mt-4 text-ink-soft" role="status">
          Thinking…
        </p>
      )}

      {pending && (
        <div className="game-card game-card-gold mt-4 p-4">
          <p className="text-sm">
            Buy <strong>{pending.name}</strong> for{' '}
            <span className="numerals font-extrabold">
              {formatCents(pending.priceCents * pending.quantity)}
            </span>
            ? This spends real money.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={confirm} disabled={busy} className="pill pill-gold text-sm">
              Yes, buy it
            </button>
            <button onClick={decline} disabled={busy} className="pill pill-ghost text-sm">
              No thanks
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-coral/10 px-3 py-2.5 text-sm text-coral-dark">
          ⚠️ {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(inputRef.current?.value ?? '')
        }}
        className="mt-5 flex gap-2"
      >
        <input
          ref={inputRef}
          name="message"
          placeholder="e.g. find me a mustard chair under $500"
          disabled={busy}
          className="field flex-1"
          autoComplete="off"
        />
        <button type="submit" disabled={busy} className="pill pill-teal disabled:opacity-50">
          Ask
        </button>
      </form>
    </section>
  )
}
