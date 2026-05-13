export type Rank =
  | '사원'
  | '대리'
  | '과장'
  | '차장'
  | '부장'
  | '수석'
  | '대표이사'
  | '부회장'
  | '회장'

export type Role =
  | '총괄PM'
  | '기획PL'
  | '개발PL'
  | '인프라PL'
  | '테스터PL'
  | 'PMO'
  | '기획자'
  | '개발자'
  | '인프라'
  | '테스터'

export type AgentStatus = 'idle' | 'working' | 'resting' | 'meeting'

export interface AvatarConfig {
  body: number
  hair: number
  hairColor: number
  accessory: number
}

export interface Agent {
  id: string
  name: string
  rank: Rank
  role: Role
  description: string
  avatar: AvatarConfig
  status: AgentStatus
  position: { x: number; y: number }
  xp: number
  level: number
  currentTask?: string
  hiredAt: number
}

export interface Company {
  id: string
  ownerId: string
  name: string
  plan: 'free' | 'pro'
  coin: number
  chairmanAvatar: AvatarConfig
  createdAt: number
}

export interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  agentId?: string
  createdAt: number
}

export const RANK_ORDER: Rank[] = [
  '사원', '대리', '과장', '차장', '부장', '수석', '대표이사', '부회장', '회장',
]

export const RANK_COLOR: Record<Rank, string> = {
  '사원': 'rank-staff',
  '대리': 'rank-asso',
  '과장': 'rank-mgr',
  '차장': 'rank-srmgr',
  '부장': 'rank-dir',
  '수석': 'rank-prin',
  '대표이사': 'rank-ceo',
  '부회장': 'rank-vchair',
  '회장': 'rank-chair',
}

export const ROLE_ICON: Record<Role, string> = {
  '총괄PM': '🎯',
  '기획PL': '📋',
  '개발PL': '💻',
  '인프라PL': '🔧',
  '테스터PL': '🔍',
  'PMO': '📊',
  '기획자': '📝',
  '개발자': '⌨️',
  '인프라': '🛠️',
  '테스터': '✅',
}
