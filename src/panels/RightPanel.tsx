import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { hasApiKey, pickEntryAgent, runTeamDelegation } from '../ai/chat'
import { ensureConversation, sendMessage, watchMessages } from '../firebase/firestore'
import { ROLE_ICON } from '../types'
import type { Agent, Message } from '../types'
import { ApiKeyModal } from '../components/ApiKeyModal'

export function RightPanel() {
  const { company, user, agents, messages, setMessages, addMessage, setWorkingAgent } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [respondingAgent, setRespondingAgent] = useState<Agent | null>(null)
  const [convId, setConvId] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!company) return
    let unsubMsgs: (() => void) | undefined
    ensureConversation(company.id).then((id) => {
      setConvId(id)
      unsubMsgs = watchMessages(company.id, id, setMessages)
    })
    return () => unsubMsgs?.()
  }, [company, setMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, respondingAgent])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !company || !user || !convId || sending) return

    if (!hasApiKey()) {
      setShowApiKey(true)
      return
    }

    if (agents.length === 0) {
      alert('직원을 먼저 채용하세요.')
      return
    }

    const entry = pickEntryAgent(agents)
    if (!entry) return

    setInput('')
    setSending(true)

    // Save user message first
    try {
      await sendMessage(company.id, convId, {
        role: 'user',
        content: text,
        createdAt: Date.now(),
      })
    } catch (err) {
      console.error('user message save failed', err)
    }

    // Run delegation chain
    try {
      await runTeamDelegation(
        entry,
        user.displayName,
        agents,
        messages,
        text,
        async (event) => {
          if (event.type === 'working' && event.workingAgent) {
            setRespondingAgent(event.workingAgent)
            setWorkingAgent(event.workingAgent.id)
          } else if (event.type === 'delegation' && event.step) {
            await sendMessage(company.id, convId, {
              role: 'delegation',
              content: event.step.instruction,
              agentId: event.step.fromAgent.id,
              toAgentId: event.step.toAgent.id,
              createdAt: Date.now(),
            })
          } else if (event.type === 'final' && event.final) {
            await sendMessage(company.id, convId, {
              role: 'agent',
              content: event.final.content,
              agentId: event.final.agent.id,
              createdAt: Date.now(),
            })
          }
        },
      )
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      addMessage({
        id: crypto.randomUUID(),
        role: 'agent',
        content: `⚠️ 응답 실패: ${errMsg}`,
        agentId: entry.id,
        createdAt: Date.now(),
      })
    } finally {
      setSending(false)
      setRespondingAgent(null)
      setWorkingAgent(null)
    }
  }

  const findAgent = (id?: string) => agents.find((a) => a.id === id)

  return (
    <>
      <div className="flex flex-col h-full">
        <header className="px-4 py-4 border-b border-corp-border flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">💬 Chat</h2>
            <p className="text-xs text-corp-muted mt-0.5">
              {respondingAgent
                ? `${respondingAgent.name} ${respondingAgent.rank}이(가) 응답 중...`
                : agents.length === 0
                ? '직원을 먼저 채용하세요'
                : `${agents.length}명 대기 중`}
            </p>
          </div>
          <button
            onClick={() => setShowApiKey(true)}
            title="API 키 설정"
            className="text-corp-muted hover:text-corp-text p-1.5 rounded hover:bg-corp-surface transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-corp-muted text-sm py-12">
              <div className="text-4xl mb-2">💭</div>
              <div>지시를 내려보세요</div>
              <div className="text-xs mt-1">예: "결제 시스템 어떻게 만들까요?"</div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} m={m} findAgent={findAgent} />)
          )}
          {respondingAgent && (
            <div className="flex justify-start">
              <div className="space-y-1">
                <div className="text-[11px] text-corp-muted flex items-center gap-1.5 px-1">
                  <span>{ROLE_ICON[respondingAgent.role]}</span>
                  <span className="font-medium">{respondingAgent.name}</span>
                  <span>·</span>
                  <span>{respondingAgent.rank}</span>
                </div>
                <div className="px-3 py-2 rounded-lg text-sm bg-corp-surface">
                  <span className="inline-block animate-pulse">●●●</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="p-3 border-t border-corp-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={sending}
              placeholder={agents.length === 0 ? '먼저 직원을 채용하세요' : '지시 또는 질문...'}
              className="flex-1 px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted focus:outline-none focus:border-corp-accent disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim() || agents.length === 0}
              className="px-4 py-2 rounded-md bg-corp-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {sending ? '...' : '보내기'}
            </button>
          </div>
        </footer>
      </div>

      {showApiKey && <ApiKeyModal onClose={() => setShowApiKey(false)} required={!hasApiKey()} />}
    </>
  )
}

function MessageBubble({ m, findAgent }: { m: Message; findAgent: (id?: string) => Agent | undefined }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap bg-corp-accent text-white">
          {m.content}
        </div>
      </div>
    )
  }

  if (m.role === 'delegation') {
    const from = findAgent(m.agentId)
    const to = findAgent(m.toAgentId)
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] flex items-start gap-2 px-3 py-2 rounded-md bg-corp-bg/60 border border-corp-border/60">
          <span className="text-[11px] mt-0.5">📩</span>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-[11px] text-corp-muted flex items-center gap-1 flex-wrap">
              <span className="font-medium text-corp-text">{from?.name ?? '?'}</span>
              <span>{from?.rank}</span>
              <span className="text-corp-accent2">→</span>
              <span className="font-medium text-corp-text">{to?.name ?? '?'}</span>
              <span>{to?.rank}</span>
              <span className="text-corp-muted">에게 위임</span>
            </div>
            <div className="text-xs text-corp-muted leading-relaxed whitespace-pre-wrap">
              {m.content}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // agent message
  const ag = findAgent(m.agentId)
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        {ag && (
          <div className="text-[11px] text-corp-muted flex items-center gap-1.5 px-1">
            <span>{ROLE_ICON[ag.role]}</span>
            <span className="font-medium">{ag.name}</span>
            <span>·</span>
            <span>{ag.rank}</span>
          </div>
        )}
        <div className="px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap bg-corp-surface">
          {m.content}
        </div>
      </div>
    </div>
  )
}
