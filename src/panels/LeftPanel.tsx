import { useStore } from '../store/useStore'
import { ROLE_ICON } from '../types'
import { signOut } from '../firebase/auth'

interface Props {
  onHireClick: () => void
}

export function LeftPanel({ onHireClick }: Props) {
  const { agents, selectedAgentId, selectAgent, company, user } = useStore()

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-4 border-b border-corp-border">
        <h1 className="text-lg font-bold tracking-tight">ClaudeCorp</h1>
        <p className="text-xs text-corp-muted mt-0.5">
          {company?.name ?? '회사'} · {company?.plan === 'pro' ? 'Pro' : 'Free'}
        </p>
      </header>

      <div className="px-3 py-3 border-b border-corp-border">
        <input
          type="text"
          placeholder="직원 검색…"
          className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted focus:outline-none focus:border-corp-accent"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {agents.length === 0 ? (
          <div className="text-center text-corp-muted text-sm py-12 px-4">
            <div className="text-4xl mb-2">👥</div>
            <div>아직 직원이 없어요</div>
            <div className="text-xs mt-1">아래 버튼으로 첫 직원을 채용해보세요</div>
          </div>
        ) : (
          <ul className="space-y-1">
            {agents.map((a) => (
              <li
                key={a.id}
                onClick={() => selectAgent(a.id)}
                className={`p-2 rounded-md cursor-pointer transition-colors ${
                  selectedAgentId === a.id
                    ? 'bg-corp-surface'
                    : 'hover:bg-corp-surface/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded bg-corp-surface flex items-center justify-center text-xl">
                    {ROLE_ICON[a.role]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.name}</div>
                    <div className="text-xs text-corp-muted truncate">
                      {a.rank} · {a.role}
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      a.status === 'working'
                        ? 'bg-green-400'
                        : a.status === 'meeting'
                        ? 'bg-blue-400'
                        : a.status === 'resting'
                        ? 'bg-yellow-400'
                        : 'bg-gray-500'
                    }`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-corp-border">
        <button
          onClick={onHireClick}
          className="w-full py-3 bg-corp-accent hover:opacity-90 transition-opacity text-sm font-medium"
        >
          + 새 직원 채용
        </button>
        {user && (
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-corp-border bg-corp-bg/40">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-corp-accent flex items-center justify-center text-xs">👑</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user.displayName}</div>
              <div className="text-[10px] text-corp-muted">회장</div>
            </div>
            <button
              onClick={() => signOut()}
              title="로그아웃"
              className="p-1.5 rounded hover:bg-corp-surface transition text-corp-muted hover:text-red-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
