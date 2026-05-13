import { useStore } from '../store/useStore'
import { ROLE_ICON } from '../types'

export function LeftPanel() {
  const { agents, selectedAgentId, selectAgent } = useStore()

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-4 border-b border-corp-border">
        <h1 className="text-lg font-bold tracking-tight">ClaudeCorp</h1>
        <p className="text-xs text-corp-muted mt-0.5">회장님의 회사 · Free</p>
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

      <footer className="p-3 border-t border-corp-border">
        <button className="w-full py-2 rounded-md bg-corp-accent hover:opacity-90 transition-opacity text-sm font-medium">
          + 새 직원 채용
        </button>
      </footer>
    </div>
  )
}
