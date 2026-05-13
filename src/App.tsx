import { LeftPanel } from './panels/LeftPanel'
import { CenterPanel } from './panels/CenterPanel'
import { RightPanel } from './panels/RightPanel'

function App() {
  return (
    <div className="flex h-screen w-screen bg-corp-bg text-corp-text">
      <aside className="w-[300px] shrink-0 border-r border-corp-border bg-corp-bg2">
        <LeftPanel />
      </aside>
      <main className="flex-1 min-w-0 relative overflow-hidden">
        <CenterPanel />
      </main>
      <aside className="w-[400px] shrink-0 border-l border-corp-border bg-corp-bg2">
        <RightPanel />
      </aside>
    </div>
  )
}

export default App
