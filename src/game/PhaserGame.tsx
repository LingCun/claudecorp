import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import { useStore } from '../store/useStore'

export function PhaserGame() {
  const ref = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const { agents, user, selectAgent, workingAgentId } = useStore()

  // Create game once
  useEffect(() => {
    if (!ref.current || gameRef.current) return

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      width: 640,
      height: 448,
      backgroundColor: '#1a1e2a',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: ref.current,
      },
      scene: [OfficeScene],
    })

    // Seed initial registry data so scene's create() can read it immediately
    const state = useStore.getState()
    game.registry.set('agents', state.agents)
    if (state.user) {
      game.registry.set('chairman', { displayName: state.user.displayName, photoURL: state.user.photoURL })
    }
    game.registry.set('working', state.workingAgentId)

    game.events.on('agent-clicked', (id: string) => {
      selectAgent(id)
    })

    gameRef.current = game

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync agents via registry — triggers 'changedata-agents' in scene
  useEffect(() => {
    gameRef.current?.registry.set('agents', agents)
  }, [agents])

  // Sync chairman
  useEffect(() => {
    if (!user) return
    gameRef.current?.registry.set('chairman', { displayName: user.displayName, photoURL: user.photoURL })
  }, [user])

  // Sync working state
  useEffect(() => {
    gameRef.current?.registry.set('working', workingAgentId)
  }, [workingAgentId])

  return <div ref={ref} className="w-full h-full" />
}
