import { useEffect, useState } from 'react'
import { LeftPanel } from './panels/LeftPanel'
import { CenterPanel } from './panels/CenterPanel'
import { RightPanel } from './panels/RightPanel'
import { LoginScreen } from './components/LoginScreen'
import { HireModal } from './components/HireModal'
import { onAuth } from './firebase/auth'
import { createCompany, getCompanyForUser, watchAgents } from './firebase/firestore'
import { useStore } from './store/useStore'

function App() {
  const { user, company, setUser, setCompany, setAgents } = useStore()
  const [loading, setLoading] = useState(true)
  const [showHire, setShowHire] = useState(false)

  // Auth state
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

  // Watch agents when company is set
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

  return (
    <>
      <div className="flex h-screen w-screen bg-corp-bg text-corp-text">
        <aside className="w-[300px] shrink-0 border-r border-corp-border bg-corp-bg2">
          <LeftPanel onHireClick={() => setShowHire(true)} />
        </aside>
        <main className="flex-1 min-w-0 relative overflow-hidden">
          <CenterPanel />
        </main>
        <aside className="w-[400px] shrink-0 border-l border-corp-border bg-corp-bg2">
          <RightPanel />
        </aside>
      </div>
      {showHire && <HireModal onClose={() => setShowHire(false)} />}
    </>
  )
}

export default App
