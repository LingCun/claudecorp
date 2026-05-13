import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import { useStore } from '../store/useStore'

const SCENE_KEY = 'OfficeScene'

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

  // Sync agents to scene
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(SCENE_KEY) as OfficeScene | undefined
    if (scene?.scene?.isActive()) {
      scene.updateAgents(agents)
    } else {
      // Scene not ready yet — try again shortly
      const t = setTimeout(() => {
        const s = gameRef.current?.scene.getScene(SCENE_KEY) as OfficeScene | undefined
        s?.updateAgents(agents)
      }, 100)
      return () => clearTimeout(t)
    }
  }, [agents])

  // Sync chairman
  useEffect(() => {
    if (!user) return
    const scene = gameRef.current?.scene.getScene(SCENE_KEY) as OfficeScene | undefined
    if (scene?.scene?.isActive()) {
      scene.updateChairman({ displayName: user.displayName, photoURL: user.photoURL })
    } else {
      const t = setTimeout(() => {
        const s = gameRef.current?.scene.getScene(SCENE_KEY) as OfficeScene | undefined
        s?.updateChairman({ displayName: user.displayName, photoURL: user.photoURL })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [user])

  // Sync working state
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(SCENE_KEY) as OfficeScene | undefined
    scene?.setWorking(workingAgentId)
  }, [workingAgentId])

  return <div ref={ref} className="w-full h-full" />
}
