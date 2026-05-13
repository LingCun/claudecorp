import { useState } from 'react'
import { useStore } from '../store/useStore'
import { hireAgent } from '../firebase/firestore'
import type { Rank, Role } from '../types'
import { RANK_ORDER, ROLE_ICON } from '../types'

const ROLES: Role[] = ['총괄PM', '기획PL', '개발PL', '인프라PL', '테스터PL', 'PMO', '기획자', '개발자', '인프라', '테스터']

interface Props {
  onClose: () => void
}

export function HireModal({ onClose }: Props) {
  const company = useStore((s) => s.company)
  const [name, setName] = useState('')
  const [rank, setRank] = useState<Rank>('사원')
  const [role, setRole] = useState<Role>('개발자')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company || !name.trim() || !description.trim()) return
    setSubmitting(true)
    try {
      await hireAgent(company.id, {
        name: name.trim(),
        rank,
        role,
        description: description.trim(),
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert('채용 실패. 콘솔을 확인하세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[480px] max-w-[90vw] max-h-[90vh] overflow-y-auto rounded-xl bg-corp-bg2 border border-corp-border shadow-2xl">
        <header className="px-6 py-4 border-b border-corp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">새 직원 채용</h2>
          <button onClick={onClose} className="text-corp-muted hover:text-corp-text transition text-xl leading-none">×</button>
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
            <label className="block text-xs text-corp-muted mb-1.5">
              직원 설명 <span className="text-corp-muted/70">(어떻게 일할지, 어떤 성격인지)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="예: TypeScript 타입 안정성을 우선시하고, 한 줄짜리 함수를 선호합니다. 코드 리뷰 시 명확한 변수 이름을 강조합니다."
              className="w-full px-3 py-2 rounded-md bg-corp-surface border border-corp-border text-sm placeholder-corp-muted focus:outline-none focus:border-corp-accent resize-none"
            />
            <p className="text-[11px] text-corp-muted mt-1">
              이 설명이 AI 시스템 프롬프트가 되어 그 직원의 답변 스타일을 결정합니다.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
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
              {submitting ? '채용 중...' : '채용하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
