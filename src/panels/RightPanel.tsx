import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { chat, hasApiKey, pickAgent } from '../ai/chat'
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

  // Ensure conversation + subscribe to messages
  useEffect(() => {
    if (!company) return
    let unsubMsgs: (() => void) | undefined
    ensureConversation(company.id).then((id) => {
      setConvId(id)
      unsubMsgs = watchMessages(company.id, id, setMessages)
    })
    return () => unsubMsgs?.()
  }, [company, setMessages])

  // Auto-scroll
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

    const agent = pickAgent(agents)
    if (!agent) return

    setInput('')
    setSending(true)
    setRespondingAgent(agent)
    setWorkingAgent(agent.id)

    // Save user message
    const userMsg: Omit<Message, 'id'> = {
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    try {
      await sendMessage(company.id, convId, userMsg)
    } catch (err) {
      console.error('user message save failed', err)
    }

    // Call Claude
    try {
      const reply = await chat(agent, user.displayName, messages, text)
      await sendMessage(company.id, convId, {
        role: 'agent',
        content: reply,
        agentId: agent.id,
        createdAt: Date.now(),
      })
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      addMessage({
        id: crypto.randomUUID(),
        role: 'agent',
        content: `⚠️ 응답 실패: ${errMsg}`,
        agentId: agent.id,
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
                ? `${respondingAgent.name} ${respondingAgent.rank}이(가) 답변 중...`
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
            messages.map((m) => {
              const ag = m.role === 'agent' ? findAgent(m.agentId) : null
              return (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${m.role === 'user' ? '' : 'space-y-1'}`}>
                    {ag && (
                      <div className="text-[11px] text-corp-muted flex items-center gap-1.5 px-1">
                        <span>{ROLE_ICON[ag.role]}</span>
                        <span className="font-medium">{ag.name}</span>
                        <span>·</span>
                        <span>{ag.rank}</span>
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-corp-accent text-white'
                          : 'bg-corp-surface'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })
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
