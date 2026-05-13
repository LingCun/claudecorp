import { useState } from 'react'
import { setApiKey } from '../ai/chat'

interface Props {
  onClose: () => void
  required?: boolean
}

export function ApiKeyModal({ onClose, required }: Props) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)

  const handleSave = () => {
    if (!value.trim().startsWith('sk-ant-')) {
      alert('Anthropic API 키는 sk-ant-... 로 시작합니다.')
      return
    }
    setApiKey(value)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => !required && e.target === e.currentTarget && onClose()}
    >
      <div className="w-[480px] max-w-[90vw] rounded-xl bg-corp-bg2 border border-corp-border shadow-2xl">
        <header className="px-6 py-4 border-b border-corp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">🔑 Anthropic API 키</h2>
          {!required && (
            <button onClick={onClose} className="text-corp-muted hover:text-corp-text text-xl leading-none">×</button>
          )}
        </header>

        <div className="p-6 space-y-4">
          <div className="text-sm text-corp-muted leading-relaxed space-y-2">
            <p>직원들이 답변하려면 본인의 Anthropic API 키가 필요합니다.</p>
            <p>
              👉{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-corp-accent2 underline"
              >
                console.anthropic.com/settings/keys
              </a>
              {' '}에서 발급
            </p>
          </div>

          <div>
            <label className="block text-xs text-corp-muted mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full pr-20 px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted font-mono focus:outline-none focus:border-corp-accent"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-corp-muted hover:text-corp-text px-2 py-0.5"
              >
                {show ? '🙈 숨기기' : '👁 보기'}
              </button>
            </div>
            <p className="text-[11px] text-corp-muted mt-1">
              브라우저 localStorage에만 저장됩니다. 서버에 전송되지 않습니다.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-md border border-corp-border hover:bg-corp-surface transition text-sm"
              >
                취소
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!value.trim()}
              className="flex-1 py-2 rounded-md bg-corp-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
