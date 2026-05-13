import { useState } from 'react'
import { useStore } from '../store/useStore'
import { hireAgent, updateAgent, fireAgent } from '../firebase/firestore'
import type { Rank, Role, MBTI, Agent } from '../types'
import { RANK_ORDER, ROLE_ICON, MBTI_LIST, MBTI_MAP } from '../types'

const ROLES: Role[] = ['총괄PM', '기획PL', '개발PL', '인프라PL', '테스터PL', 'PMO', '기획자', '개발자', '인프라', '테스터']

interface Props {
  onClose: () => void
  agent?: Agent | null  // when provided, edit mode
}

export function AgentFormModal({ onClose, agent }: Props) {
  const company = useStore((s) => s.company)
  const isEdit = !!agent

  const [name, setName] = useState(agent?.name ?? '')
  const [rank, setRank] = useState<Rank>(agent?.rank ?? '사원')
  const [role, setRole] = useState<Role>(agent?.role ?? '개발자')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [mbti, setMbti] = useState<MBTI | ''>(agent?.mbti ?? '')
  const [submitting, setSubmitting] = useState(false)

  const mbtiInfo = mbti ? MBTI_MAP[mbti as MBTI] : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company || !name.trim() || !description.trim()) return
    setSubmitting(true)
    try {
      if (isEdit && agent) {
        await updateAgent(company.id, agent.id, {
          name: name.trim(),
          rank,
          role,
          description: description.trim(),
          ...(mbti ? { mbti: mbti as MBTI } : {}),
        })
      } else {
        await hireAgent(company.id, {
          name: name.trim(),
          rank,
          role,
          description: description.trim(),
          ...(mbti ? { mbti: mbti as MBTI } : {}),
        })
      }
      onClose()
    } catch (err) {
      console.error(err)
      alert((isEdit ? '수정' : '채용') + ' 실패. 콘솔을 확인하세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFire = async () => {
    if (!company || !agent) return
    if (!confirm(`${agent.name} ${agent.rank}을(를) 정말로 해고하시겠습니까?`)) return
    setSubmitting(true)
    try {
      await fireAgent(company.id, agent.id)
      onClose()
    } catch (err) {
      console.error(err)
      alert('해고 실패.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[520px] max-w-[92vw] max-h-[92vh] overflow-y-auto rounded-xl bg-corp-bg2 border border-corp-border shadow-2xl">
        <header className="px-6 py-4 border-b border-corp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '직원 정보 수정' : '새 직원 채용'}
          </h2>
          <button onClick={onClose} className="text-corp-muted hover:text-corp-text text-xl leading-none">×</button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-corp-muted mb-1.5">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="예: 김PM"
              className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted focus:outline-none focus:border-corp-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-corp-muted mb-1.5">직급</label>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value as Rank)}
                className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm focus:outline-none focus:border-corp-accent"
              >
                {RANK_ORDER.filter((r) => r !== '회장').map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-corp-muted mb-1.5">역할</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm focus:outline-none focus:border-corp-accent"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_ICON[r]} {r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-corp-muted mb-1.5">MBTI <span className="text-corp-muted/70">(선택)</span></label>
            <select
              value={mbti}
              onChange={(e) => setMbti(e.target.value as MBTI | '')}
              className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm focus:outline-none focus:border-corp-accent"
            >
              <option value="">— 미지정 —</option>
              {MBTI_LIST.map((m) => (
                <option key={m.type} value={m.type}>
                  {m.emoji} {m.type} {m.name}
                </option>
              ))}
            </select>
            {mbtiInfo && (
              <div className="mt-2 px-3 py-2.5 rounded-md bg-corp-surface/50 border border-corp-border/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{mbtiInfo.emoji}</span>
                  <span className="font-medium text-sm">{mbtiInfo.type} · {mbtiInfo.name}</span>
                </div>
                <p className="text-xs text-corp-muted leading-relaxed">{mbtiInfo.desc}</p>
                <p className="text-[11px] text-corp-muted/80 mt-1.5 italic">
                  예시: "{mbtiInfo.selfTalk[0]}"
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-corp-muted mb-1.5">
              직원 설명 <span className="text-corp-muted/70">(AI 시스템 프롬프트로 사용됨)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="예: TypeScript 타입 안정성을 우선시하고, 한 줄짜리 함수를 선호합니다."
              className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted focus:outline-none focus:border-corp-accent resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleFire}
                disabled={submitting}
                className="px-3 py-2 rounded-md border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition text-sm"
                title="해고"
              >
                🗑 해고
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-md border border-corp-border hover:bg-corp-surface transition text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !description.trim()}
              className="flex-1 py-2 rounded-md bg-corp-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {submitting ? '...' : isEdit ? '저장' : '채용하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
