import Anthropic from '@anthropic-ai/sdk'
import type { Agent, Message } from '../types'
import { MBTI_MAP } from '../types/mbti'

const API_KEY_STORAGE = 'claudecorp_anthropic_key'
const MODEL = 'claude-sonnet-4-6'

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE)
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key.trim())
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

function client(): Anthropic {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Anthropic API 키가 없습니다. 설정에서 입력해주세요.')
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })
}

/**
 * Pick the best agent to respond. For MVP: prefer the highest-ranking agent.
 * Phase 2 will use Claude itself to route based on message content.
 */
const RANK_PRIORITY: Record<string, number> = {
  '회장': 100, '부회장': 90, '대표이사': 80, '수석': 70, '부장': 60,
  '차장': 50, '과장': 40, '대리': 30, '사원': 20,
}

export function pickAgent(agents: Agent[], explicitId?: string): Agent | null {
  if (agents.length === 0) return null
  if (explicitId) {
    const found = agents.find((a) => a.id === explicitId)
    if (found) return found
  }
  return [...agents].sort((a, b) => (RANK_PRIORITY[b.rank] ?? 0) - (RANK_PRIORITY[a.rank] ?? 0))[0]
}

function buildSystemPrompt(agent: Agent, chairmanName: string): string {
  const mbtiBlock = agent.mbti
    ? `\n▼ MBTI: ${agent.mbti} (${MBTI_MAP[agent.mbti].name})\n${MBTI_MAP[agent.mbti].desc}\n이 성격이 자연스럽게 답변에 묻어나게 하세요 (과장하지 말고 어조와 강조점에 반영).`
    : ''

  return `당신은 ClaudeCorp 회사의 ${agent.rank} ${agent.role}, ${agent.name}입니다.
당신의 회장(사용자)은 ${chairmanName}입니다.

▼ 직무 / 성격 (회장이 작성)
${agent.description}${mbtiBlock}

▼ 답변 규칙
- 회장에게 답변할 때는 격식 있게 ("회장님" 호칭) 답합니다.
- 직급에 맞는 어조: 사원/대리는 보고체, 임원급은 자문체.
- 답변은 간결하고 실행 가능하게. 불필요한 인사말 생략.
- 자기 전문 영역 (${agent.role}) 관점에서 답변하세요.
- 결정이 필요한 경우 옵션과 추천을 제시하세요.`
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  agent: Agent,
  chairmanName: string,
  history: Message[],
  newMessage: string,
): Promise<string> {
  const c = client()

  // Convert history to Anthropic format, only include messages from this agent or user
  const turns: ChatTurn[] = []
  for (const m of history) {
    if (m.role === 'user') {
      turns.push({ role: 'user', content: m.content })
    } else if (m.role === 'agent' && m.agentId === agent.id) {
      turns.push({ role: 'assistant', content: m.content })
    }
  }
  turns.push({ role: 'user', content: newMessage })

  // Ensure messages alternate (Anthropic requires user/assistant alternation, starting with user)
  const cleaned: ChatTurn[] = []
  for (const t of turns) {
    if (cleaned.length === 0 && t.role !== 'user') continue
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === t.role) {
      cleaned[cleaned.length - 1].content += '\n\n' + t.content
    } else {
      cleaned.push(t)
    }
  }

  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(agent, chairmanName),
    messages: cleaned,
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock && 'text' in textBlock ? textBlock.text : '(응답 없음)'
}
