import Phaser from 'phaser'
import type { Agent, AvatarConfig, Rank, Role } from '../types'
import { randomSelfTalk } from '../types/mbti'

const TILE = 32
const FLOOR_W = 20
const FLOOR_H = 14

interface AgentSprite {
  id: string
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Rectangle
  hairGroup: Phaser.GameObjects.GameObject[]   // many shapes per hair style
  nameText: Phaser.GameObjects.Text
  workIndicator: Phaser.GameObjects.Text
  agent: Agent
  desk: Phaser.GameObjects.Rectangle
  monitor: Phaser.GameObjects.Rectangle
  chair: Phaser.GameObjects.Rectangle
  idleTween?: Phaser.Tweens.Tween
  bubble?: Phaser.GameObjects.Container
}

const HAIR_COLORS = [0x1a1a1a, 0x4a3422, 0x6b4423, 0xa67340, 0xd4a166, 0xe8d4a8, 0xff8fb1, 0x7ec9ff, 0xc4b5fd, 0x86efac]
const SKIN_TONES = [0xffe4cf, 0xfacdb1, 0xe7b894, 0xc89876]
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
  // Phaser's `changedata-<key>` event emits (parent, newValue, previousValue) — 3 args, no key.
  private handleAgentsChange = (_parent: Phaser.Data.DataManager, value: Agent[]) => {
    console.log('[OfficeScene] handleAgentsChange called with', value?.length ?? 0, 'agents:', value?.map(a => a.name))
    this.renderAgents(value ?? [])
  }

  private handleChairmanChange = (_parent: Phaser.Data.DataManager, value: { displayName: string; photoURL: string }) => {
    this.chairmanInfo = value
    this.placeChairman()
  }

  private handleWorkingChange = (_parent: Phaser.Data.DataManager, value: string | null) => {
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
    const sorted = [...agents].sort((a, b) => (a.hiredAt ?? 0) - (b.hiredAt ?? 0))
    const currentIds = new Set(sorted.map((a) => a.id))

    // Remove sprites for agents no longer in the list
    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        sprite.idleTween?.stop()
        sprite.container.destroy()
        sprite.desk.destroy()
        sprite.monitor.destroy()
        sprite.chair.destroy()
        this.sprites.delete(id)
      }
    }

    // Add/update sprites — index in sorted array determines desk
    sorted.forEach((agent, idx) => {
      const pos = this.deskPositions[idx % this.deskPositions.length]
      if (!pos) return

      const existing = this.sprites.get(agent.id)
      if (existing) {
        // If rank/role/mbti changed materially, easiest is to rebuild
        const needsRebuild =
          existing.agent.rank !== agent.rank ||
          existing.agent.role !== agent.role ||
          existing.agent.avatar?.body !== agent.avatar?.body ||
          existing.agent.avatar?.hair !== agent.avatar?.hair ||
          existing.agent.avatar?.hairColor !== agent.avatar?.hairColor
        if (needsRebuild) {
          existing.idleTween?.stop()
          existing.container.destroy()
          existing.desk.destroy()
          existing.monitor.destroy()
          existing.chair.destroy()
          this.sprites.delete(agent.id)
          this.createAgentSprite(agent, pos)
        } else {
          // Lightweight update — just text
          existing.agent = agent
          existing.nameText.setText(`${agent.name} · ${agent.rank}`)
          existing.nameText.setColor(this.rankColor(agent.rank))
        }
        return
      }

      this.createAgentSprite(agent, pos)
    })
  }

  private createAgentSprite(agent: Agent, pos: { x: number; y: number }) {
    // ── Desk (wooden top with darker edge) ──
    const desk = this.add.rectangle(pos.x, pos.y + 4, TILE * 2.1, TILE * 0.95, 0x8b5a2b)
      .setStrokeStyle(2, 0x5a3a1c)
      .setDepth(10)
    // Desk top highlight
    this.add.rectangle(pos.x, pos.y + 1, TILE * 2.1 - 2, 2, 0xa67340, 0.6).setDepth(10.5)

    // ── Monitor (with stand) ──
    this.add.rectangle(pos.x, pos.y - 2, 3, 5, 0x475569).setDepth(10.5) // stand
    this.add.rectangle(pos.x, pos.y - 5, 10, 1.5, 0x475569).setDepth(10.5) // base
    const monitor = this.add.rectangle(pos.x, pos.y - 12, TILE * 0.85, TILE * 0.58, 0x0f172a)
      .setStrokeStyle(2, 0x475569)
      .setDepth(11)
    // Monitor inner screen
    this.add.rectangle(pos.x, pos.y - 12, TILE * 0.85 - 4, TILE * 0.58 - 4, 0x1e293b).setDepth(11.5)

    // ── Chair (visible from behind/sides of character) ──
    const chairY = pos.y + TILE * 1.4
    const chair = this.add.rectangle(pos.x, chairY, 16, 16, 0x3a4254)
      .setStrokeStyle(1, 0x1e293b)
      .setDepth(15)

    // ── Character container ──
    const targetY = pos.y + TILE * 1.1
    const c = this.add.container(pos.x, targetY)
    c.setSize(24, 36).setInteractive({ cursor: 'pointer' }).setDepth(20)

    const skin = SKIN_TONES[agent.avatar.body % SKIN_TONES.length]
    const hairColor = HAIR_COLORS[agent.avatar.hairColor % HAIR_COLORS.length]
    const shirt = this.bodyColor(agent.avatar)

    // ── Pants (small, mostly hidden by chair) ──
    c.add(this.add.rectangle(0, 12, 10, 5, 0x1e293b))

    // ── Body / shoulders (slightly rounded look via two rects) ──
    const body = this.add.rectangle(0, 4, 18, 14, shirt).setStrokeStyle(1, 0x000000aa)
    c.add(body)
    // Shoulder highlight (top edge lighter)
    c.add(this.add.rectangle(0, -1, 18, 1.5, 0xffffff, 0.2))

    // ── Arms (small chunks on sides) ──
    c.add(this.add.rectangle(-10, 4, 3, 10, shirt).setStrokeStyle(1, 0x000000aa))
    c.add(this.add.rectangle(10, 4, 3, 10, shirt).setStrokeStyle(1, 0x000000aa))
    // Hands
    c.add(this.add.rectangle(-10, 9, 3, 3, skin))
    c.add(this.add.rectangle(10, 9, 3, 3, skin))

    // ── Neck ──
    c.add(this.add.rectangle(0, -4, 5, 3, skin))

    // ── Rank-specific outfit accent (tie/lapels/vest) ──
    this.drawRankAccent(c, agent.rank)

    // ── Head ──
    c.add(this.add.rectangle(0, -11, 13, 13, skin).setStrokeStyle(1, 0x000000aa))

    // ── Hair (varies by style) ──
    const hairGroup: Phaser.GameObjects.GameObject[] = []
    this.drawHair(c, hairGroup, agent.avatar.hair, hairColor)

    // ── Eyes ──
    c.add(this.add.rectangle(-3, -11, 1.6, 2, 0x1a1a1a))
    c.add(this.add.rectangle(3, -11, 1.6, 2, 0x1a1a1a))
    // Eye sparkle
    c.add(this.add.rectangle(-3.2, -11.4, 0.6, 0.6, 0xffffff))
    c.add(this.add.rectangle(2.8, -11.4, 0.6, 0.6, 0xffffff))

    // ── Mouth (subtle) ──
    c.add(this.add.rectangle(0, -7, 1.8, 0.6, 0x000000, 0.5))

    // ── Cheek blush ──
    c.add(this.add.circle(-4.5, -8, 1, 0xff8fb1, 0.4))
    c.add(this.add.circle(4.5, -8, 1, 0xff8fb1, 0.4))

    // ── Role accessory (headphones / glasses / badge / etc.) ──
    this.drawRoleAccessory(c, agent.role, hairColor)

    // ── Rank badge dot ──
    c.add(this.add.circle(8, -3, 2, RANK_BADGE_COLOR[agent.rank] ?? 0xffffff)
      .setStrokeStyle(0.5, 0x000000))

    // ── Name label ──
    const nameText = this.add.text(0, 22, `${agent.name} · ${agent.rank}`, {
      fontSize: '9px', color: this.rankColor(agent.rank),
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
      fontStyle: 'bold',
    }).setOrigin(0.5)
    c.add(nameText)

    // ── Work indicator ✦ ──
    const workIndicator = this.add.text(0, -32, '✦', {
      fontSize: '14px', color: '#fde047',
    }).setOrigin(0.5).setVisible(false)
    c.add(workIndicator)
    this.tweens.add({
      targets: workIndicator,
      y: -36,
      duration: 800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    // Sprite is at final y immediately (no risky entry tween).
    c.setY(targetY)

    // Defer idle bob so brand-new scenes don't drop it.
    this.time.delayedCall(60, () => {
      if (!this.sprites.has(agent.id)) return
      const idleTween = this.tweens.add({
        targets: c,
        y: targetY - 1,
        duration: 1400 + Math.random() * 400,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      const sprite = this.sprites.get(agent.id)
      if (sprite) sprite.idleTween = idleTween
    })

    c.on('pointerdown', () => {
      this.game.events.emit('agent-clicked', agent.id)
      const sprite = this.sprites.get(agent.id)
      if (sprite) this.showSpeechBubble(sprite, randomSelfTalk(sprite.agent.mbti))
    })

    this.sprites.set(agent.id, {
      id: agent.id, container: c, body, hairGroup, nameText, workIndicator,
      agent, desk, monitor, chair,
    })
  }

  // ── Hair styles (10 variants by avatar.hair index) ──
  private drawHair(c: Phaser.GameObjects.Container, group: Phaser.GameObjects.GameObject[], style: number, color: number) {
    const push = (obj: Phaser.GameObjects.GameObject) => { c.add(obj); group.push(obj) }
    const make = (x: number, y: number, w: number, h: number) =>
      this.add.rectangle(x, y, w, h, color)

    const variant = style % 10
    switch (variant) {
      case 0: // short messy
        push(make(0, -17, 14, 4))
        push(make(-5, -15, 4, 3))
        push(make(5, -15, 4, 3))
        break
      case 1: // bowl cut
        push(make(0, -17, 15, 5))
        push(make(-7, -13, 2, 5))
        push(make(7, -13, 2, 5))
        break
      case 2: // long bangs
        push(make(0, -17, 14, 5))
        push(make(-3, -12, 3, 3))
        push(make(3, -12, 3, 3))
        break
      case 3: // spiky
        push(make(0, -17, 13, 4))
        push(make(-4, -19, 2, 3))
        push(make(0, -20, 2, 4))
        push(make(4, -19, 2, 3))
        break
      case 4: // ponytail back (visible bun at back of head)
        push(make(0, -17, 13, 4))
        push(make(-3, -13, 4, 2))
        push(this.add.circle(0, -7, 2, color))
        break
      case 5: // side-parted
        push(make(2, -17, 11, 4))
        push(make(-2, -16, 4, 3))
        break
      case 6: // afro/curls
        push(this.add.circle(0, -17, 8, color))
        break
      case 7: // mohawk
        push(make(0, -17, 13, 3))
        push(make(0, -20, 3, 4))
        break
      case 8: // long straight (down sides)
        push(make(0, -17, 14, 4))
        push(make(-7, -10, 2, 8))
        push(make(7, -10, 2, 8))
        break
      case 9: // bald with edge
        push(make(0, -18, 11, 2))
        break
    }
  }

  // ── Rank-specific outfit accents (tie / vest / lapels / badge) ──
  private drawRankAccent(c: Phaser.GameObjects.Container, rank: Rank) {
    switch (rank) {
      case '사원':
        // simple shirt — collar V
        c.add(this.add.triangle(0, -1, -2, -3, 2, -3, 0, 1, 0xffffff, 0.5))
        break
      case '대리':
        c.add(this.add.rectangle(0, 4, 2, 9, 0xc92a2a)) // red tie
        c.add(this.add.triangle(0, -1, -2, -3, 2, -3, 0, 1, 0xffffff, 0.5))
        break
      case '과장':
        c.add(this.add.rectangle(0, 4, 2.5, 10, 0x1c4a8a)) // blue tie
        c.add(this.add.rectangle(0, 6, 12, 8, 0x1e293b, 0.45)) // vest hint
        break
      case '차장':
        c.add(this.add.rectangle(0, 4, 2.5, 10, 0x6d28d9))
        c.add(this.add.rectangle(-7, 5, 2, 12, 0x1e293b)) // jacket left
        c.add(this.add.rectangle(7, 5, 2, 12, 0x1e293b)) // jacket right
        break
      case '부장':
        c.add(this.add.rectangle(0, 4, 2.5, 10, 0x991b1b))
        c.add(this.add.rectangle(-7, 5, 3, 13, 0x111827))
        c.add(this.add.rectangle(7, 5, 3, 13, 0x111827))
        break
      case '수석':
        c.add(this.add.rectangle(0, 4, 2.5, 10, 0xf97316))
        c.add(this.add.rectangle(-7, 5, 3, 13, 0xa14000))
        c.add(this.add.rectangle(7, 5, 3, 13, 0xa14000))
        c.add(this.add.circle(-4, 1, 1.2, 0xfde047)) // pocket pin
        break
      case '대표이사':
        c.add(this.add.rectangle(0, 4, 3, 11, 0xfbbf24)) // gold tie
        c.add(this.add.rectangle(-7, 5, 3, 13, 0x000000))
        c.add(this.add.rectangle(7, 5, 3, 13, 0x000000))
        c.add(this.add.circle(-4, 1, 1.5, 0xfde047).setStrokeStyle(0.4, 0x92400e))
        break
      case '부회장':
      case '회장':
        // Not used for hired agents, but defensive
        c.add(this.add.rectangle(0, 4, 3, 11, 0xfde047))
        c.add(this.add.rectangle(-7, 5, 3, 13, 0x000000))
        c.add(this.add.rectangle(7, 5, 3, 13, 0x000000))
        break
    }
  }

  // ── Role-specific accessory (headphones, glasses, headset, etc.) ──
  private drawRoleAccessory(c: Phaser.GameObjects.Container, role: Role, _hairColor: number) {
    switch (role) {
      case '개발자':
      case '개발PL': {
        // headphones — arc on top + earpads
        c.add(this.add.rectangle(0, -18, 14, 1.5, 0x1a1a1a))
        c.add(this.add.rectangle(-7, -14, 2.5, 3.5, 0x1a1a1a))
        c.add(this.add.rectangle(7, -14, 2.5, 3.5, 0x1a1a1a))
        // tiny green LED
        c.add(this.add.circle(7, -14, 0.5, 0x4ade80))
        break
      }
      case '인프라':
      case '인프라PL': {
        // hard-hat / cap
        c.add(this.add.rectangle(0, -18, 14, 2, 0xf97316))
        c.add(this.add.rectangle(0, -16, 9, 1, 0xf97316))
        // tool on hip
        c.add(this.add.rectangle(8, 5, 1.5, 4, 0x9ca3af))
        break
      }
      case '테스터':
      case '테스터PL': {
        // round glasses
        c.add(this.add.circle(-3, -11, 2.4, 0xffffff, 0.15).setStrokeStyle(0.8, 0xffffff))
        c.add(this.add.circle(3, -11, 2.4, 0xffffff, 0.15).setStrokeStyle(0.8, 0xffffff))
        c.add(this.add.rectangle(0, -11, 1.4, 0.5, 0xffffff))
        break
      }
      case '기획자':
      case '기획PL': {
        // small notepad clipped to side
        c.add(this.add.rectangle(-10, 2, 3.5, 5, 0xffffff).setStrokeStyle(0.5, 0x000000))
        c.add(this.add.rectangle(-10, 0.5, 2.5, 0.4, 0x9ca3af))
        c.add(this.add.rectangle(-10, 2, 2.5, 0.4, 0x9ca3af))
        break
      }
      case '총괄PM':
      case 'PMO': {
        // headset (band + mic)
        c.add(this.add.rectangle(0, -18, 13, 1.2, 0x1a1a1a))
        c.add(this.add.rectangle(-7, -14, 1.8, 3, 0x1a1a1a))
        c.add(this.add.rectangle(7, -14, 1.8, 3, 0x1a1a1a))
        // mic arm
        c.add(this.add.rectangle(-5.5, -9, 0.5, 5, 0x1a1a1a))
        c.add(this.add.circle(-5.5, -6, 1, 0x4ade80))
        break
      }
    }
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
