import { PhaserGame } from '../game/PhaserGame'
import { useStore } from '../store/useStore'
import { ROLE_ICON, MBTI_MAP } from '../types'
import type { Agent } from '../types'

interface Props {
  onEditAgent: (agent: Agent) => void
}

export function CenterPanel({ onEditAgent }: Props) {
  const { selectedAgentId, agents, selectAgent } = useStore()
  const selected = agents.find((a) => a.id === selectedAgentId)
  const mbtiInfo = selected?.mbti ? MBTI_MAP[selected.mbti] : null

  return (
    <div className="relative w-full h-full flex flex-col bg-corp-bg">
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-md bg-corp-surface/80 backdrop-blur text-xs">
        📍 본사 · 2F 일반 사무실
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <PhaserGame />
      </div>

      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-10 max-w-lg rounded-lg bg-corp-bg2 border border-corp-border shadow-2xl">
          <div className="flex items-start gap-3 p-4">
            <div className="w-12 h-12 rounded bg-corp-surface flex items-center justify-center text-2xl shrink-0">
              {ROLE_ICON[selected.role]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{selected.name}</span>
                <span className="text-xs text-corp-muted">· {selected.rank} · {selected.role}</span>
                {mbtiInfo && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-corp-accent/20 text-corp-accent2 font-medium">
                    {mbtiInfo.emoji} {mbtiInfo.type} {mbtiInfo.name}
                  </span>
                )}
              </div>
              {mbtiInfo && (
                <p className="text-[11px] text-corp-muted/80 mt-1 italic">{mbtiInfo.desc}</p>
              )}
              <p className="text-xs text-corp-muted mt-1.5 line-clamp-3 whitespace-pre-wrap">
                {selected.description}
              </p>
              <div className="text-[11px] text-corp-muted mt-2 flex items-center gap-3">
                <span>Lv.{selected.level}</span>
                <span>XP {selected.xp}</span>
                <span>입사 {new Date(selected.hiredAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => onEditAgent(selected)}
                className="px-2.5 py-1 rounded text-xs border border-corp-border hover:bg-corp-surface transition"
              >
                ✏️ 수정
              </button>
              <button
                onClick={() => selectAgent(null)}
                className="px-2.5 py-1 rounded text-xs text-corp-muted hover:text-corp-text hover:bg-corp-surface transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
