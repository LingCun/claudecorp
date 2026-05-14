import Anthropic from '@anthropic-ai/sdk'
import type { Agent, Message } from '../types'
import { MBTI_MAP } from '../types/mbti'

const API_KEY_STORAGE = 'claudecorp_anthropic_key'
const MODEL = 'claude-sonnet-4-6'
const MAX_DELEGATION_DEPTH = 3

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
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const RANK_PRIORITY: Record<string, number> = {
  '회장': 100, '부회장': 90, '대표이사': 80, '수석': 70, '부장': 60,
  '차장': 50, '과장': 40, '대리': 30, '사원': 20,
}

// Pick the highest-ranking agent as entry point
export function pickEntryAgent(agents: Agent[], explicitId?: string): Agent | null {
  if (agents.length === 0) return null
  if (explicitId) {
    const found = agents.find((a) => a.id === explicitId)
    if (found) return found
  }
  return [...agents].sort((a, b) => (RANK_PRIORITY[b.rank] ?? 0) - (RANK_PRIORITY[a.rank] ?? 0))[0]
}

function buildSystemPrompt(
  agent: Agent,
  chairmanName: string,
  allAgents: Agent[],
  canDelegate: boolean,
): string {
  const mbtiBlock = agent.mbti
    ? `\n▼ 본인 MBTI: ${agent.mbti} (${MBTI_MAP[agent.mbti].name})\n${MBTI_MAP[agent.mbti].desc}\n이 성격이 자연스럽게 답변 어조에 묻어나게 하세요 (과장하지 말 것).`
    : ''

  const subordinates = allAgents
    .filter((a) =>
      a.id !== agent.id &&
      (RANK_PRIORITY[a.rank] ?? 0) < (RANK_PRIORITY[agent.rank] ?? 0),
    )
    .map((a) => `  - [${a.id}] ${a.name} ${a.rank} (${a.role}${a.mbti ? `, ${a.mbti}` : ''}): ${a.description.slice(0, 80)}`)
    .join('\n')

  const delegationBlock = canDelegate && subordinates
    ? `\n▼ 사용 가능한 하급 직원 (위임 가능)
${subordinates}

▼ 의사결정
- 본인의 전문성으로 즉시 답변할 수 있으면 직접 답변하세요.
- 하급 직원이 답하는 게 더 적합하면 \`delegate\` 도구를 사용해서 위임하세요.
- 위임 시 지시사항은 구체적으로 (그냥 "처리해줘" X, "결제 흐름 3단계 설계하고 보안 고려사항 정리해주세요" O).`
    : '\n▼ 본인이 최종 답변자입니다. 도구 사용 없이 직접 답변하세요.'

  return `당신은 ClaudeCorp 회사의 ${agent.rank} ${agent.role}, ${agent.name}입니다.
당신의 회장(사용자)은 ${chairmanName}입니다.

▼ 본인의 직무 / 성격 (회장이 작성)
${agent.description}${mbtiBlock}${delegationBlock}

▼ 답변 규칙
- 회장에게 답변할 때는 격식 있게 ("회장님" 호칭) 답합니다.
- 직급에 맞는 어조: 사원/대리는 보고체, 임원급은 자문체.
- 답변은 간결하고 실행 가능하게.
- 자기 전문 영역 (${agent.role}) 관점에서 답변하세요.`
}

const DELEGATE_TOOL: Anthropic.Tool = {
  name: 'delegate',
  description:
    '본인보다 하급 직원 중 더 적합한 사람에게 작업을 위임합니다. 위임 시 구체적인 지시사항을 함께 전달하세요.',
  input_schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: '위임받을 직원의 ID (제공된 목록에서 정확히 그대로)' },
      instruction: { type: 'string', description: '그 직원에게 줄 구체적인 지시사항' },
    },
    required: ['to', 'instruction'],
  },
}

export interface DelegationStep {
  fromAgent: Agent
  toAgent: Agent
  instruction: string
}

export interface FinalAnswer {
  agent: Agent
  content: string
}

export interface ChainEvent {
  type: 'delegation' | 'final' | 'working'
  step?: DelegationStep
  final?: FinalAnswer
  workingAgent?: Agent
}

/**
 * Recursively call Claude with the delegate tool. Each delegation creates a step;
 * if Claude returns text instead of using the tool, that's the final answer.
 *
 * @param onEvent — called for each step (delegation or final). Use this to update UI live.
 */
export async function runDelegationChain(
  entryAgent: Agent,
  chairmanName: string,
  allAgents: Agent[],
  history: Message[],
  userMessage: string,
  onEvent: (event: ChainEvent) => void,
): Promise<void> {
  const c = client()
  let currentAgent = entryAgent
  let currentInstruction = userMessage
  let depth = 0

  // History filtered for context — only include user messages and direct replies from this agent
  const baseTurns: Anthropic.MessageParam[] = []
  for (const m of history) {
    if (m.role === 'user') {
      baseTurns.push({ role: 'user', content: m.content })
    } else if (m.role === 'agent' && m.agentId === entryAgent.id) {
      baseTurns.push({ role: 'assistant', content: m.content })
    }
  }

  while (depth < MAX_DELEGATION_DEPTH) {
    onEvent({ type: 'working', workingAgent: currentAgent })

    const canDelegate = depth < MAX_DELEGATION_DEPTH - 1
    const turnContent = depth === 0
      ? currentInstruction
      : `회장님으로부터 다음과 같이 전달받았습니다:\n\n"${currentInstruction}"\n\n위 내용에 대해 답변하거나, 더 적합한 하급자가 있으면 위임해주세요.`

    const response = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(currentAgent, chairmanName, allAgents, canDelegate),
      tools: canDelegate ? [DELEGATE_TOOL] : [],
      messages: [
        ...(depth === 0 ? baseTurns : []),
        { role: 'user', content: turnContent },
      ],
    })

    // Find tool_use block, if any
    const toolUse = response.content.find((b) => b.type === 'tool_use') as
      | Anthropic.ToolUseBlock
      | undefined

    if (toolUse && toolUse.name === 'delegate') {
      const input = toolUse.input as { to: string; instruction: string }
      const targetAgent = allAgents.find((a) => a.id === input.to)
      if (!targetAgent) {
        // Invalid delegation target — treat any text as final
        const text = response.content.find((b) => b.type === 'text') as
          | Anthropic.TextBlock | undefined
        onEvent({
          type: 'final',
          final: { agent: currentAgent, content: text?.text ?? '응답 없음 (위임 실패)' },
        })
        return
      }
      onEvent({
        type: 'delegation',
        step: {
          fromAgent: currentAgent,
          toAgent: targetAgent,
          instruction: input.instruction,
        },
      })
      currentAgent = targetAgent
      currentInstruction = input.instruction
      depth++
      continue
    }

    // No tool use → final answer
    const text = response.content.find((b) => b.type === 'text') as
      | Anthropic.TextBlock | undefined
    onEvent({
      type: 'final',
      final: { agent: currentAgent, content: text?.text ?? '(빈 응답)' },
    })
    return
  }

  // Hit max depth — let current agent produce final answer without delegate tool
  const fallback = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(currentAgent, chairmanName, allAgents, false),
    messages: [
      { role: 'user', content: currentInstruction },
    ],
  })
  const text = fallback.content.find((b) => b.type === 'text') as
    | Anthropic.TextBlock | undefined
  onEvent({
    type: 'final',
    final: { agent: currentAgent, content: text?.text ?? '(빈 응답)' },
  })
}
