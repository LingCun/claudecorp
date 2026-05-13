import { create } from 'zustand'
import type { Agent, Company, Message } from '../types'

interface AppState {
  user: { uid: string; displayName: string; photoURL: string } | null
  company: Company | null
  agents: Agent[]
  messages: Message[]
  selectedAgentId: string | null

  setUser: (user: AppState['user']) => void
  setCompany: (company: Company | null) => void
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  selectAgent: (id: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  company: null,
  agents: [],
  messages: [],
  selectedAgentId: null,

  setUser: (user) => set({ user }),
  setCompany: (company) => set({ company }),
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
}))
