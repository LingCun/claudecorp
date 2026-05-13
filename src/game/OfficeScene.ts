import Phaser from 'phaser'
import type { Agent, AvatarConfig } from '../types'
import { randomSelfTalk } from '../types/mbti'

const TILE = 32
const FLOOR_W = 20
const FLOOR_H = 14

interface AgentSprite {
  id: string
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Rectangle
  hair: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
  workIndicator: Phaser.GameObjects.Text
  agent: Agent
  desk: Phaser.GameObjects.Rectangle
  monitor: Phaser.GameObjects.Rectangle
  idleTween?: Phaser.Tweens.Tween
  bubble?: Phaser.GameObjects.Container
}

const HAIR_COLORS = [0x1a1a1a, 0x6b4423, 0xc9a063, 0xe8d4a8, 0xff6b9d, 0x6fc2ff]
const RANK_BADGE_COLOR: Record<string, number> = {
  '사원': 0xa0a0a0, '대리': 0x4ade80, '과장': 0x3b82f6, '차장': 0xa855f7,
  '부장': 0xef4444, '수석': 0xf97316, '대표이사': 0xfbbf24, '부회장': 0x06b6d4, '회장': 0xfde047,
}

export class OfficeScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>()
  private deskPositions: Array<{ x: number; y: number }> = []
  private chairmanContainer?: Phaser.GameObjects.Container
  private chairmanInfo?: { displayName: string; photoURL: string }

  constructor() {
    super({ key: 'OfficeScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1e2a')
    this.drawFloor()
    this.drawWalls()
    this.drawFurniture()
    this.computeDeskPositions()

    // Listen to registry changes (React → Phaser)
    this.registry.events.on('changedata-agents', this.handleAgentsChange, this)
    this.registry.events.on('changedata-chairman', this.handleChairmanChange, this)
    this.registry.events.on('changedata-working', this.handleWorkingChange, this)

    // Pick up any data already present
    const initialAgents = this.registry.get('agents') as Agent[] | undefined
    const initialChairman = this.registry.get('chairman') as { displayName: string; photoURL: string } | undefined
    if (initialChairman) this.chairmanInfo = initialChairman
    this.placeChairman()
    if (initialAgents) this.renderAgents(initialAgents)
  }

  // ── Registry handlers ─────────────────────────
  private handleAgentsChange = (_parent: Phaser.Data.DataManager, _key: string, value: Agent[]) => {
    this.renderAgents(value ?? [])
  }

  private handleChairmanChange = (_parent: Phaser.Data.DataManager, _key: string, value: { displayName: string; photoURL: string }) => {
    this.chairmanInfo = value
    this.placeChairman()
  }

  private handleWorkingChange = (_parent: Phaser.Data.DataManager, _key: string, value: string | null) => {
    for (const [id, sprite] of this.sprites) {
      const isWorking = id === value
      sprite.workIndicator.setVisible(isWorking)
      sprite.monitor.setFillStyle(isWorking ? 0x4ade80 : 0x334155)
    }
  }

  // ── Drawing ─────────────────────────────────────
  private drawFloor() {
    const g = this.add.graphics()
    for (let y = 0; y < FLOOR_H; y++) {
      for (let x = 0; x < FLOOR_W; x++) {
        const isEdge = (x + y) % 2 === 0
        g.fillStyle(isEdge ? 0x2a2f3e : 0x252938, 1)
        g.fillRect(x * TILE, y * TILE, TILE, TILE)
      }
    }
  }

  private drawWalls() {
    const g = this.add.graphics()
    g.fillStyle(0x3a4254, 1)
    g.fillRect(0, 0, FLOOR_W * TILE, TILE)
    g.fillStyle(0x60a5fa, 0.4)
    for (let x = 2; x < FLOOR_W - 2; x += 4) {
      g.fillRect(x * TILE + 6, 6, TILE - 12, TILE - 12)
    }
  }

  private drawFurniture() {
    this.drawPlant(TILE * 0.5, TILE * 1.5)
    this.drawPlant(TILE * (FLOOR_W - 0.5), TILE * 1.5)
    this.add.rectangle(
      TILE * (FLOOR_W - 2),
      TILE * (FLOOR_H - 1.5),
      TILE * 2.5,
      TILE * 1.5,
      0x4a3429,
    ).setStrokeStyle(2, 0x6b4423)
    this.add.text(
      TILE * (FLOOR_W - 2),
      TILE * (FLOOR_H - 1.5),
      '☕',
      { fontSize: '20px' },
    ).setOrigin(0.5)
  }

  private drawPlant(x: number, y: number) {
    this.add.circle(x, y, 8, 0x4a2818).setStrokeStyle(1, 0x2a1810)
    this.add.text(x, y - 8, '🌿', { fontSize: '14px' }).setOrigin(0.5)
  }

  private computeDeskPositions() {
    this.deskPositions = []
    const startY = TILE * 4.6
    const startX = TILE * 2.5
    const gapX = TILE * 4
    const gapY = TILE * 3.5
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        this.deskPositions.push({
          x: startX + c * gapX,
          y: startY + r * gapY,
        })
      }
    }
  }

  // ── Chairman ────────────────────────────────────
  private placeChairman() {
    if (this.chairmanContainer) this.chairmanContainer.destroy()

    const x = TILE * (FLOOR_W / 2)
    const y = TILE * 2.4

    this.add.rectangle(x, y + 2, TILE * 2.8, TILE * 1.2, 0x6b4423).setStrokeStyle(2, 0x8b5a2b)
    this.add.rectangle(x, y - 6, TILE * 1.0, TILE * 0.6, 0x1e293b).setStrokeStyle(1, 0x334155)

    const c = this.add.container(x, y + TILE * 1.2)

    c.add(this.add.rectangle(0, 0, 16, 20, 0x7c3aed).setStrokeStyle(1, 0x4c1d95))
    c.add(this.add.rectangle(0, -14, 14, 14, 0xfbbf24).setStrokeStyle(1, 0x92400e))
    c.add(this.add.text(0, -28, '👑', { fontSize: '16px' }).setOrigin(0.5))
    const name = this.chairmanInfo?.displayName ?? '회장'
    c.add(this.add.text(0, 16, `${name} · 회장`, {
      fontSize: '10px', color: '#fde047', fontStyle: 'bold',
      backgroundColor: '#000000aa', padding: { x: 4, y: 1 },
    }).setOrigin(0.5))

    this.chairmanContainer = c
  }

  // ── Agents ──────────────────────────────────────
  private renderAgents(agents: Agent[]) {
    // Sort by hire time ASC so desk positions stay stable as new hires are added
    const sorted = [...agents].sort((a, b) => a.hiredAt - b.hiredAt)
    const currentIds = new Set(sorted.map((a) => a.id))

    // Remove sprites for agents no longer in the list
    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        sprite.idleTween?.stop()
        sprite.container.destroy()
        sprite.desk.destroy()
        sprite.monitor.destroy()
        this.sprites.delete(id)
      }
    }

    // Add/update sprites — index in sorted array determines desk
    sorted.forEach((agent, idx) => {
      const pos = this.deskPositions[idx % this.deskPositions.length]
      if (!pos) return

      const existing = this.sprites.get(agent.id)
      if (existing) {
        // Update visuals — position should already be stable due to ASC sort
        existing.agent = agent
        existing.body.setFillStyle(this.bodyColor(agent.avatar))
        existing.hair.setFillStyle(HAIR_COLORS[agent.avatar.hairColor % HAIR_COLORS.length])
        existing.nameText.setText(`${agent.name} · ${agent.rank}`)
        existing.nameText.setColor(this.rankColor(agent.rank))
        return
      }

      this.createAgentSprite(agent, pos)
    })
  }

  private createAgentSprite(agent: Agent, pos: { x: number; y: number }) {
    const desk = this.add.rectangle(pos.x, pos.y + 2, TILE * 2, TILE * 0.9, 0x6b4423)
      .setStrokeStyle(2, 0x8b5a2b)
    const monitor = this.add.rectangle(pos.x, pos.y - 8, TILE * 0.7, TILE * 0.45, 0x334155)
      .setStrokeStyle(1, 0x475569)

    const c = this.add.container(pos.x, pos.y + TILE * 1.1)
    c.setSize(24, 36)
    c.setInteractive({ cursor: 'pointer' })

    const body = this.add.rectangle(0, 0, 14, 18, this.bodyColor(agent.avatar))
      .setStrokeStyle(1, 0x000000)
    c.add(body)

    c.add(this.add.rectangle(0, -12, 12, 12, 0xfde9c8).setStrokeStyle(1, 0x000000))

    const hair = this.add.rectangle(0, -16, 14, 6, HAIR_COLORS[agent.avatar.hairColor % HAIR_COLORS.length])
    c.add(hair)

    c.add(this.add.circle(7, -3, 2, RANK_BADGE_COLOR[agent.rank] ?? 0xffffff))

    const nameText = this.add.text(0, 14, `${agent.name} · ${agent.rank}`, {
      fontSize: '9px', color: this.rankColor(agent.rank),
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5)
    c.add(nameText)

    const workIndicator = this.add.text(0, -32, '✦', {
      fontSize: '14px', color: '#fde047',
    }).setOrigin(0.5).setVisible(false)
    c.add(workIndicator)
    this.tweens.add({
      targets: workIndicator,
      y: -36,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Entry "drop in" — start a bit above the target y, fall down.
    // Sprite is always at scale 1 / full alpha so if the tween skips for any reason
    // the character is still visible at its final desk position.
    const targetY = pos.y + TILE * 1.1
    c.setY(targetY - 30)
    this.tweens.add({
      targets: c,
      y: targetY,
      duration: 360,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        // Start idle bob only after the drop-in finishes so they don't fight
        const idleTween = this.tweens.add({
          targets: c,
          y: targetY - 1,
          duration: 1400 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        const sprite = this.sprites.get(agent.id)
        if (sprite) sprite.idleTween = idleTween
      },
    })

    c.on('pointerdown', () => {
      this.game.events.emit('agent-clicked', agent.id)
      const sprite = this.sprites.get(agent.id)
      if (sprite) this.showSpeechBubble(sprite, randomSelfTalk(sprite.agent.mbti))
    })

    this.sprites.set(agent.id, {
      id: agent.id, container: c, body, hair, nameText, workIndicator,
      agent, desk, monitor,
    })
  }

  private showSpeechBubble(sprite: AgentSprite, text: string) {
    // Remove existing bubble for this sprite
    if (sprite.bubble) {
      sprite.bubble.destroy()
      sprite.bubble = undefined
    }

    const bubble = this.add.container(0, -38)

    // Truncate very long text
    const display = text.length > 28 ? text.slice(0, 26) + '…' : text

    const txt = this.add.text(0, 0, display, {
      fontSize: '10px',
      color: '#1a1a1a',
      padding: { x: 8, y: 5 },
      align: 'center',
    }).setOrigin(0.5)

    const w = Math.max(70, txt.width + 16)
    const h = txt.height + 6
    const bg = this.add.graphics()
    bg.fillStyle(0xffffff, 0.96)
    bg.lineStyle(2, 0xfde047, 1)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6)
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6)
    // Tail
    bg.fillStyle(0xffffff, 0.96)
    bg.beginPath()
    bg.moveTo(-4, h / 2)
    bg.lineTo(0, h / 2 + 5)
    bg.lineTo(4, h / 2)
    bg.closePath()
    bg.fillPath()

    bubble.add([bg, txt])
    sprite.container.add(bubble)
    sprite.bubble = bubble

    bubble.setAlpha(0).setScale(0.85)
    this.tweens.add({
      targets: bubble,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut',
    })

    // Auto-fade after delay
    this.time.delayedCall(2400, () => {
      if (sprite.bubble !== bubble) return
      this.tweens.add({
        targets: bubble,
        alpha: 0,
        duration: 220,
        onComplete: () => {
          bubble.destroy()
          if (sprite.bubble === bubble) sprite.bubble = undefined
        },
      })
    })
  }

  private bodyColor(avatar: AvatarConfig): number {
    const colors = [0x3b82f6, 0x10b981, 0xf59e0b, 0xef4444]
    return colors[avatar.body % colors.length]
  }

  private rankColor(rank: string): string {
    const m: Record<string, string> = {
      '사원': '#cbd5e1', '대리': '#4ade80', '과장': '#3b82f6', '차장': '#a855f7',
      '부장': '#ef4444', '수석': '#f97316', '대표이사': '#fbbf24', '부회장': '#06b6d4', '회장': '#fde047',
    }
    return m[rank] ?? '#ffffff'
  }
}
