export function CenterPanel() {
  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-md bg-corp-surface/80 backdrop-blur text-xs">
        📍 2층 · 일반 사무실
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-corp-muted">
          <div className="text-6xl mb-4 opacity-50">🏢</div>
          <div className="text-lg font-medium">사무실</div>
          <div className="text-sm mt-2">Phaser 3 월드가 곧 여기에 렌더링됩니다</div>
        </div>
      </div>
    </div>
  )
}
