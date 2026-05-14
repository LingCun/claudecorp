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
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const RANK_PRIORITY: Record<string, number> = {
  '회장': 100, '부회장': 90, '대표이사': 80, '수석': 70, '부장': 60,
  '차장': 50, '과장': 40, '대리': 30, '사원': 20,
}

const PL_ROLES = new Set(['총괄PM', '기획PL', '개발PL', '인프라PL', '테스터PL', 'PMO'])

export function pickEntryAgent(agents: Agent[], explicitId?: string): Agent | null {
  if (agents.length === 0) return null
  if (explicitId) {
    const found = agents.find((a) => a.id === explicitId)
    if (found) return found
  }
  return [...agents].sort((a, b) => (RANK_PRIORITY[b.rank] ?? 0) - (RANK_PRIORITY[a.rank] ?? 0))[0]
}

// ── Tool definitions ──────────────────────────────
const ASSIGN_TOOL: Anthropic.Tool = {
  name: 'assign_to_team',
  description: '회장의 지시를 도메인별로 분해해 적절한 PL/PM에게 할당합니다. 보통 2~4개 분야로 나눠 (기획/개발/인프라/테스트/PM 등) PL 또는 매니저급 직원에게 할당하세요. 단순한 질문이라면 이 도구를 사용하지 말고 직접 답하세요.',
  input_schema: {
    type: 'object',
    properties: {
      analysis: {
        type: 'string',
        description: '왜 이렇게 분해했는지 한두 문장으로 회장님께 보고하는 톤으로',
      },
      assignments: {
        type: 'array',
        description: '각 PL/PM에게 줄 할당 (최대 5개)',
        items: {
          type: 'object',
          properties: {
            pl_id: { type: 'string', description: '할당받을 PL/PM 직원의 ID (제공된 목록에서)' },
            instruction: { type: 'string', description: '그 직원에게 줄 구체적이고 실행 가능한 지시사항' },
          },
          required: ['pl_id', 'instruction'],
        },
      },
    },
    required: ['analysis', 'assignments'],
  },
}

const DELEGATE_TOOL: Anthropic.Tool = {
  name: 'delegate',
  description: '본인 산하의 실무 직원(워커)에게 작업을 위임합니다. 본인이 직접 답할 만한 일이면 도구를 쓰지 마세요.',
  input_schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: '위임받을 실무 직원의 ID' },
      instruction: { type: 'string', description: '구체적이고 실행 가능한 지시사항' },
    },
    required: ['to', 'instruction'],
  },
}

// ── Events emitted during the chain ─────────────
export interface DelegationStep {
  fromAgent: Agent
  toAgent: Agent
  instruction: string
}
export interface FinalAnswer {
  agent: Agent
  content: string
}
export interface AnalysisStep {
  agent: Agent
  content: string
}
export interface ChainEvent {
  type: 'delegation' | 'final' | 'working' | 'analysis'
  step?: DelegationStep
  final?: FinalAnswer
  workingAgent?: Agent
  analysis?: AnalysisStep
}

function agentLine(a: Agent): string {
  return `  - [${a.id}] ${a.name} ${a.rank} (${a.role}${a.mbti ? `, ${a.mbti}` : ''}): ${a.description.slice(0, 70)}`
}

// ── CEO system prompt (uses assign_to_team) ────
function buildCeoPrompt(ceo: Agent, chairmanName: string, allAgents: Agent[]): string {
  const pls = allAgents.filter((a) => a.id !== ceo.id && PL_ROLES.has(a.role))
  const workers = allAgents.filter((a) => a.id !== ceo.id && !PL_ROLES.has(a.role))

  const mbtiBlock = ceo.mbti
    ? `\n▼ 본인 MBTI: ${ceo.mbti} (${MBTI_MAP[ceo.mbti].name})\n${MBTI_MAP[ceo.mbti].desc}`
    : ''

  return `당신은 ClaudeCorp의 ${ceo.rank} ${ceo.role}, ${ceo.name}입니다.
회장님(${chairmanName})으로부터 지시를 받았습니다.

▼ 본인의 직무 / 성격
${ceo.description}${mbtiBlock}

▼ 산하 PL/매니저급 직원 (할당 대상)
${pls.length > 0 ? pls.map(agentLine).join('\n') : '  (없음)'}

▼ 산하 실무 워커 (참고용, PL을 거쳐 위임)
${workers.length > 0 ? workers.map(agentLine).join('\n') : '  (없음)'}

▼ 의사결정
1. 회장의 지시가 단순 질문/즉답 가능하면 → 도구 사용 없이 직접 답변
2. 여러 도메인(기획/개발/인프라/테스트/PM 등)이 얽힌 작업이면 → \`assign_to_team\` 사용
   - 각 도메인의 PL에게 분배 (보통 2~3개)
   - 각 지시는 구체적이고 실행 가능하게
   - 분석 한두 줄로 회장님께 왜 이렇게 분해했는지 보고

▼ 어조
- 회장에게 답할 때 격식 있게 ("회장님")
- 임원답게 자문체, 간결하게.`
}

// ── PL system prompt (uses delegate tool) ─────
function buildPlPrompt(
  pl: Agent,
  chairmanName: string,
  fromAgent: Agent,
  allAgents: Agent[],
): string {
  const subordinates = allAgents.filter((a) =>
    a.id !== pl.id &&
    !PL_ROLES.has(a.role) &&
    (RANK_PRIORITY[a.rank] ?? 0) < (RANK_PRIORITY[pl.rank] ?? 0),
  )

  const mbtiBlock = pl.mbti
    ? `\n▼ 본인 MBTI: ${pl.mbti} (${MBTI_MAP[pl.mbti].name})\n${MBTI_MAP[pl.mbti].desc}`
    : ''

  return `당신은 ClaudeCorp의 ${pl.rank} ${pl.role}, ${pl.name}입니다.
${fromAgent.name} ${fromAgent.rank}님(${fromAgent.role})으로부터 회장님의 지시를 전달받았습니다.

▼ 본인의 직무 / 성격
${pl.description}${mbtiBlock}

▼ 산하 실무 워커 (위임 가능)
${subordinates.length > 0 ? subordinates.map(agentLine).join('\n') : '  (없음 — 본인이 직접 답해야 함)'}

▼ 의사결정 절차
1. **분석**: 받은 지시를 본인의 전문 영역(${pl.role}) 관점에서 분석. 답변의 첫머리에 짧게 분석 내용을 적으세요.
2. **결정**: 본인이 직접 답할지, 워커에게 위임할지 판단.
   - 워커에게 위임 → \`delegate\` 도구 사용 (구체적 지시 포함)
   - 직접 답할 경우 → 도구 없이 본인의 분석 + 결론 작성
3. 위임할 워커가 없으면 본인이 직접 답합니다.

▼ 어조
- ${chairmanName} 회장께 보고하는 톤으로
- 본인 도메인 관점에서 명확하게`
}

// ── Worker prompt (no tools) ──────────────────
function buildWorkerPrompt(
  worker: Agent,
  chairmanName: string,
  fromAgent: Agent,
): string {
  const mbtiBlock = worker.mbti
    ? `\n▼ 본인 MBTI: ${worker.mbti} (${MBTI_MAP[worker.mbti].name})\n${MBTI_MAP[worker.mbti].desc}`
    : ''

  return `당신은 ClaudeCorp의 ${worker.rank} ${worker.role}, ${worker.name}입니다.
${fromAgent.name} ${fromAgent.rank}님(${fromAgent.role})이 다음 지시를 내렸습니다.

▼ 본인의 직무 / 성격
${worker.description}${mbtiBlock}

▼ 작업
- 본인의 전문성(${worker.role}) 관점에서 구체적인 결과물을 작성하세요.
- 단계/항목 등으로 명확하게.
- 보고 어조 (회장님 ${chairmanName}님께 결과를 올린다는 마음으로).`
}

// ── Main entry ─────────────────────────────────
export async function runTeamDelegation(
  ceo: Agent,
  chairmanName: string,
  allAgents: Agent[],
  history: Message[],
  userMessage: string,
  onEvent: (event: ChainEvent) => void,
): Promise<void> {
  const c = client()

  // History context for CEO (their prior conversation with chairman)
  const ceoHistory: Anthropic.MessageParam[] = []
  for (const m of history) {
    if (m.role === 'user') {
      ceoHistory.push({ role: 'user', content: m.content })
    } else if (m.role === 'agent' && m.agentId === ceo.id) {
      ceoHistory.push({ role: 'assistant', content: m.content })
    }
  }

  // ── Step 1: CEO analyzes ──
  onEvent({ type: 'working', workingAgent: ceo })

  const ceoResp = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildCeoPrompt(ceo, chairmanName, allAgents),
    tools: [ASSIGN_TOOL],
    messages: [
      ...ceoHistory,
      { role: 'user', content: userMessage },
    ],
  })

  // If CEO didn't use tool → direct final answer
  const ceoToolUse = ceoResp.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock | undefined

  if (!ceoToolUse) {
    const ceoText = ceoResp.content.find((b) => b.type === 'text') as
      | Anthropic.TextBlock | undefined
    onEvent({ type: 'final', final: { agent: ceo, content: ceoText?.text ?? '(빈 응답)' } })
    return
  }

  // CEO used assign_to_team → fan out
  const ceoInput = ceoToolUse.input as {
    analysis: string
    assignments: Array<{ pl_id: string; instruction: string }>
  }

  // Show CEO's analysis as a separate message
  if (ceoInput.analysis) {
    onEvent({ type: 'final', final: { agent: ceo, content: `📊 분석\n${ceoInput.analysis}` } })
  }

  // Validate and dedupe assignments
  const seenIds = new Set<string>()
  const validAssignments = ceoInput.assignments
    .filter((a) => {
      const target = allAgents.find((ag) => ag.id === a.pl_id)
      if (!target || seenIds.has(a.pl_id)) return false
      seenIds.add(a.pl_id)
      return true
    })
    .slice(0, 5)

  // ── Step 2: Process each assignment sequentially ──
  for (const assignment of validAssignments) {
    const pl = allAgents.find((a) => a.id === assignment.pl_id)!

    onEvent({
      type: 'delegation',
      step: { fromAgent: ceo, toAgent: pl, instruction: assignment.instruction },
    })

    await handlePlBranch(c, pl, ceo, chairmanName, allAgents, assignment.instruction, onEvent)
  }
}

// ── PL branch: analyze + delegate or answer ──
async function handlePlBranch(
  c: Anthropic,
  pl: Agent,
  fromAgent: Agent,
  chairmanName: string,
  allAgents: Agent[],
  instruction: string,
  onEvent: (event: ChainEvent) => void,
) {
  onEvent({ type: 'working', workingAgent: pl })

  const plResp = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildPlPrompt(pl, chairmanName, fromAgent, allAgents),
    tools: [DELEGATE_TOOL],
    messages: [{ role: 'user', content: instruction }],
  })

  const plToolUse = plResp.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock | undefined
  const plText = plResp.content.find((b) => b.type === 'text') as
    | Anthropic.TextBlock | undefined

  if (plToolUse && plToolUse.name === 'delegate') {
    const input = plToolUse.input as { to: string; instruction: string }
    const worker = allAgents.find((a) => a.id === input.to)
    if (worker) {
      // PL's analysis (if they wrote any text alongside the tool call) shows first
      if (plText && plText.text.trim()) {
        onEvent({ type: 'final', final: { agent: pl, content: plText.text.trim() } })
      }
      // Delegation step
      onEvent({
        type: 'delegation',
        step: { fromAgent: pl, toAgent: worker, instruction: input.instruction },
      })
      // Worker produces final
      await handleWorker(c, worker, pl, chairmanName, input.instruction, onEvent)
      return
    }
  }

  // PL answered directly (no delegation, or delegation failed)
  onEvent({ type: 'final', final: { agent: pl, content: plText?.text ?? '(빈 응답)' } })
}

// ── Worker: produces final output ──
async function handleWorker(
  c: Anthropic,
  worker: Agent,
  fromAgent: Agent,
  chairmanName: string,
  instruction: string,
  onEvent: (event: ChainEvent) => void,
) {
  onEvent({ type: 'working', workingAgent: worker })

  const resp = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildWorkerPrompt(worker, chairmanName, fromAgent),
    messages: [{ role: 'user', content: instruction }],
  })

  const text = resp.content.find((b) => b.type === 'text') as
    | Anthropic.TextBlock | undefined
  onEvent({ type: 'final', final: { agent: worker, content: text?.text ?? '(빈 응답)' } })
}
