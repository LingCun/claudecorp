import { useState } from 'react'
import { useStore } from '../store/useStore'

export function RightPanel() {
  const { messages, addMessage, agents } = useStore()
  const [input, setInput] = useState('')

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    })
    setInput('')
    // TODO: route to Claude API
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-4 border-b border-corp-border">
        <h2 className="text-base font-semibold">💬 Chat</h2>
        <p className="text-xs text-corp-muted mt-0.5">
          {agents.length === 0
            ? '직원을 먼저 채용하세요'
            : `${agents.length}명이 일하는 중`}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-corp-muted text-sm py-12">
            <div className="text-4xl mb-2">💭</div>
            <div>지시를 내려보세요</div>
            <div className="text-xs mt-1">예: "결제 시스템 어떻게 만들까요?"</div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  m.role === 'user'
                    ? 'bg-corp-accent text-white'
                    : 'bg-corp-surface'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="p-3 border-t border-corp-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="지시 또는 질문 입력…"
            className="flex-1 px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted focus:outline-none focus:border-corp-accent"
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 rounded-md bg-corp-accent hover:opacity-90 transition-opacity text-sm font-medium"
          >
            보내기
          </button>
        </div>
      </footer>
    </div>
  )
}
