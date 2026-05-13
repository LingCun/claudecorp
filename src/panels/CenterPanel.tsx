import { PhaserGame } from '../game/PhaserGame'
import { useStore } from '../store/useStore'
import { ROLE_ICON } from '../types'

export function CenterPanel() {
  const { selectedAgentId, agents, selectAgent } = useStore()
  const selected = agents.find((a) => a.id === selectedAgentId)

  return (
    <div className="relative w-full h-full flex flex-col bg-corp-bg">
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-md bg-corp-surface/80 backdrop-blur text-xs">
        📍 본사 · 2F 일반 사무실
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <PhaserGame />
      </div>

      {/* Agent detail popover */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-10 max-w-md rounded-lg bg-corp-bg2 border border-corp-border shadow-2xl">
          <div className="flex items-start gap-3 p-4">
            <div className="w-12 h-12 rounded bg-corp-surface flex items-center justify-center text-2xl shrink-0">
              {ROLE_ICON[selected.role]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{selected.name}</span>
                <span className="text-xs text-corp-muted">· {selected.rank} · {selected.role}</span>
              </div>
              <p className="text-xs text-corp-muted mt-1 line-clamp-3 whitespace-pre-wrap">
                {selected.description}
              </p>
              <div className="text-[11px] text-corp-muted mt-2 flex items-center gap-3">
                <span>Lv.{selected.level}</span>
                <span>XP {selected.xp}</span>
                <span>입사 {new Date(selected.hiredAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
            <button
              onClick={() => selectAgent(null)}
              className="text-corp-muted hover:text-corp-text text-lg leading-none"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
