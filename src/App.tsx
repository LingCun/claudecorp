import { useEffect, useState } from 'react'
import { LeftPanel } from './panels/LeftPanel'
import { CenterPanel } from './panels/CenterPanel'
import { RightPanel } from './panels/RightPanel'
import { LoginScreen } from './components/LoginScreen'
import { AgentFormModal } from './components/AgentFormModal'
import { onAuth } from './firebase/auth'
import { createCompany, getCompanyForUser, watchAgents } from './firebase/firestore'
import { useStore } from './store/useStore'
import type { Agent } from './types'

function App() {
  const { user, company, setUser, setCompany, setAgents } = useStore()
  const [loading, setLoading] = useState(true)
  const [showHire, setShowHire] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

  useEffect(() => {
    return onAuth(async (fbUser) => {
      if (fbUser) {
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName ?? '회장',
          photoURL: fbUser.photoURL ?? '',
        })
        let existing = await getCompanyForUser(fbUser.uid)
        if (!existing) {
          existing = await createCompany(fbUser.uid, `${fbUser.displayName ?? '회장'}님의 회사`)
        }
        setCompany(existing)
      } else {
        setUser(null)
        setCompany(null)
        setAgents([])
      }
      setLoading(false)
    })
  }, [setUser, setCompany, setAgents])

  useEffect(() => {
    if (!company) return
    return watchAgents(company.id, setAgents)
  }, [company, setAgents])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-corp-bg">
        <div className="text-corp-muted">불러오는 중...</div>
      </div>
    )
  }

  if (!user || !company) return <LoginScreen />

  const modalOpen = showHire || !!editingAgent

  return (
    <>
      <div className="flex h-screen w-screen bg-corp-bg text-corp-text">
        <aside className="w-[300px] shrink-0 border-r border-corp-border bg-corp-bg2">
          <LeftPanel onHireClick={() => setShowHire(true)} />
        </aside>
        <main className="flex-1 min-w-0 relative overflow-hidden">
          <CenterPanel onEditAgent={setEditingAgent} />
        </main>
        <aside className="w-[400px] shrink-0 border-l border-corp-border bg-corp-bg2">
          <RightPanel />
        </aside>
      </div>
      {modalOpen && (
        <AgentFormModal
          agent={editingAgent}
          onClose={() => { setShowHire(false); setEditingAgent(null) }}
        />
      )}
    </>
  )
}

export default App
