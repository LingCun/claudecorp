import Phaser from 'phaser'
import type { Agent, AvatarConfig, Rank, Role } from '../types'
import { randomSelfTalk } from '../types/mbti'

const TILE = 32
const FLOOR_W = 40
const FLOOR_H = 30
const MAP_W = FLOOR_W * TILE   // 1280
const MAP_H = FLOOR_H * TILE   // 960
const VIEW_W = 640
const VIEW_H = 448

// ── Zones ──────────────────────────────────────
type ActivityKind = 'desk' | 'coffee' | 'gym' | 'lounge' | 'meeting'

interface Zone {
  name: string
  rect: Phaser.Geom.Rectangle
  activity: ActivityKind
  floorColor: number
  accentColor: number
}

// Layout (tile coords):  zones laid out around a central office.
// Office is the largest area, surrounded by smaller specialty rooms.
const ZONES: Zone[] = [
  {
    name: '카페테리아', activity: 'coffee',
    rect: new Phaser.Geom.Rectangle(1 * TILE, 1 * TILE, 9 * TILE, 8 * TILE),
    floorColor: 0x3a2718, accentColor: 0x8b4513,
  },
  {
    name: '회의실', activity: 'meeting',
    rect: new Phaser.Geom.Rectangle(30 * TILE, 1 * TILE, 9 * TILE, 8 * TILE),
    floorColor: 0x1e2a3a, accentColor: 0x3b82f6,
  },
  {
    name: '본 사무실', activity: 'desk',
    rect: new Phaser.Geom.Rectangle(11 * TILE, 10 * TILE, 18 * TILE, 12 * TILE),
    floorColor: 0x252938, accentColor: 0x475569,
  },
  {
    name: '헬스장', activity: 'gym',
    rect: new Phaser.Geom.Rectangle(1 * TILE, 21 * TILE, 9 * TILE, 8 * TILE),
    floorColor: 0x2a3a28, accentColor: 0x4ade80,
  },
  {
    name: '휴게실', activity: 'lounge',
    rect: new Phaser.Geom.Rectangle(30 * TILE, 21 * TILE, 9 * TILE, 8 * TILE),
    floorColor: 0x3a1e3a, accentColor: 0xa855f7,
  },
]

// ── Character data ─────────────────────────────
const HAIR_COLORS = [0x1a1a1a, 0x4a3422, 0x6b4423, 0xa67340, 0xd4a166, 0xe8d4a8, 0xff8fb1, 0x7ec9ff, 0xc4b5fd, 0x86efac]
const SKIN_TONES = [0xffe4cf, 0xfacdb1, 0xe7b894, 0xc89876]
const RANK_BADGE_COLOR: Record<string, number> = {
  '사원': 0xa0a0a0, '대리': 0x4ade80, '과장': 0x3b82f6, '차장': 0xa855f7,
  '부장': 0xef4444, '수석': 0xf97316, '대표이사': 0xfbbf24, '부회장': 0x06b6d4, '회장': 0xfde047,
}

type AgentState = 'idle' | 'walking' | 'working' | 'activity'

interface AgentSprite {
  id: string
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
  workIndicator: Phaser.GameObjects.Text
  activityIcon: Phaser.GameObjects.Text
  agent: Agent
  desk: Phaser.GameObjects.Rectangle
  monitor: Phaser.GameObjects.Rectangle
  chair: Phaser.GameObjects.Rectangle
  bubble?: Phaser.GameObjects.Container
  deskPos: { x: number; y: number }
  state: AgentState
  moveTween?: Phaser.Tweens.Tween
  nextScheduled?: Phaser.Time.TimerEvent
}

export class OfficeScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>()
  private deskPositions: Array<{ x: number; y: number }> = []
  private chairmanContainer?: Phaser.GameObjects.Container
  private chairmanInfo?: { displayName: string; photoURL: string }
  private workingAgentId: string | null = null

  // Minimap
  private minimapBg?: Phaser.GameObjects.Graphics
  private minimapDynamic?: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'OfficeScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor('#15171f')
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H)

    this.drawAllFloors()
    this.drawZoneBorders()
    this.drawAllFurniture()
    this.computeDeskPositions()
    this.setupCameraPan()
    this.setupMinimap()

    // Registry listeners
    this.registry.events.on('changedata-agents', this.handleAgentsChange, this)
    this.registry.events.on('changedata-chairman', this.handleChairmanChange, this)
    this.registry.events.on('changedata-working', this.handleWorkingChange, this)

    // Pick up initial state
    const initialAgents = this.registry.get('agents') as Agent[] | undefined
    const initialChairman = this.registry.get('chairman') as { displayName: string; photoURL: string } | undefined
    if (initialChairman) this.chairmanInfo = initialChairman
    this.placeChairman()
    if (initialAgents) this.renderAgents(initialAgents)

    // Center camera on office area initially
    this.cameras.main.centerOn(20 * TILE, 16 * TILE)
  }

  update() {
    this.updateMinimap()
  }

  // ── Registry handlers ─────────────────────────
  private handleAgentsChange = (_parent: Phaser.Data.DataManager, value: Agent[]) => {
    this.renderAgents(value ?? [])
  }

  private handleChairmanChange = (_parent: Phaser.Data.DataManager, value: { displayName: string; photoURL: string }) => {
    this.chairmanInfo = value
    this.placeChairman()
  }

  private handleWorkingChange = (_parent: Phaser.Data.DataManager, value: string | null) => {
    this.workingAgentId = value
    for (const [id, sprite] of this.sprites) {
      if (id === value) {
        // Walk back to desk and work
        this.sendToDesk(sprite)
      } else if (sprite.state === 'working') {
        // Stop working, return to free roaming
        sprite.state = 'idle'
        this.scheduleNext(sprite, 1500)
      }
      // Visual indicators
      const isWorking = id === value
      sprite.workIndicator.setVisible(isWorking)
      sprite.monitor.setFillStyle(isWorking ? 0x4ade80 : 0x0f172a)
    }
  }

  // ── Drawing ─────────────────────────────────────
  private drawAllFloors() {
    const g = this.add.graphics()

    // Base floor (between zones — corridor / common)
    for (let y = 0; y < FLOOR_H; y++) {
      for (let x = 0; x < FLOOR_W; x++) {
        const pat = (x + y) % 2 === 0
        g.fillStyle(pat ? 0x2a2f3e : 0x252938, 1)
        g.fillRect(x * TILE, y * TILE, TILE, TILE)
      }
    }

    // Zone-specific floor color
    for (const zone of ZONES) {
      g.fillStyle(zone.floorColor, 1)
      g.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height)
    }
  }

  private drawZoneBorders() {
    // Zone outlines with labels
    for (const zone of ZONES) {
      // Border
      const border = this.add.graphics()
      border.lineStyle(2, zone.accentColor, 0.4)
      border.strokeRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height)
      border.setDepth(2)

      // Label
      this.add.text(
        zone.rect.x + 8,
        zone.rect.y + 6,
        zone.name,
        {
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        },
      ).setDepth(2).setAlpha(0.9)
    }

    // Outer walls
    const wall = this.add.graphics()
    wall.lineStyle(4, 0x3a4254, 1)
    wall.strokeRect(0, 0, MAP_W, MAP_H)
    wall.setDepth(2)
  }

  private drawAllFurniture() {
    // Coffee area
    this.drawCafe(ZONES[0])
    // Meeting room
    this.drawMeeting(ZONES[1])
    // Gym
    this.drawGym(ZONES[3])
    // Lounge
    this.drawLounge(ZONES[4])
    // Plants in corridors
    this.drawPlant(10.3 * TILE, 5 * TILE)
    this.drawPlant(29.7 * TILE, 5 * TILE)
    this.drawPlant(10.3 * TILE, 25 * TILE)
    this.drawPlant(29.7 * TILE, 25 * TILE)
  }

  private drawCafe(zone: Zone) {
    const cx = zone.rect.centerX
    // Counter
    this.add.rectangle(cx, zone.rect.y + 1.5 * TILE, 6 * TILE, TILE * 0.8, 0x6b4423)
      .setStrokeStyle(2, 0x4a3422).setDepth(5)
    // Coffee machines
    this.add.rectangle(cx - 2 * TILE, zone.rect.y + 1.2 * TILE, TILE * 0.7, TILE * 0.6, 0x1f2937)
      .setStrokeStyle(1, 0x4b5563).setDepth(6)
    this.add.text(cx - 2 * TILE, zone.rect.y + 1.2 * TILE, '☕', { fontSize: '14px' })
      .setOrigin(0.5).setDepth(7)
    this.add.rectangle(cx + 2 * TILE, zone.rect.y + 1.2 * TILE, TILE * 0.7, TILE * 0.6, 0x1f2937)
      .setStrokeStyle(1, 0x4b5563).setDepth(6)
    this.add.text(cx + 2 * TILE, zone.rect.y + 1.2 * TILE, '🍵', { fontSize: '14px' })
      .setOrigin(0.5).setDepth(7)
    // Cafe tables
    for (let i = 0; i < 3; i++) {
      const x = zone.rect.x + (1.5 + i * 2.2) * TILE
      const y = zone.rect.y + 5 * TILE
      this.add.circle(x, y, TILE * 0.6, 0x6b4423).setStrokeStyle(1, 0x4a3422).setDepth(5)
      this.add.circle(x - TILE * 0.8, y, 5, 0x374151).setDepth(5)
      this.add.circle(x + TILE * 0.8, y, 5, 0x374151).setDepth(5)
    }
  }

  private drawMeeting(zone: Zone) {
    const cx = zone.rect.centerX
    const cy = zone.rect.centerY
    // Long meeting table
    this.add.rectangle(cx, cy, TILE * 5, TILE * 1.5, 0x6b4423)
      .setStrokeStyle(2, 0x4a3422).setDepth(5)
    // Whiteboard on the back wall
    this.add.rectangle(cx, zone.rect.y + 0.8 * TILE, TILE * 4, TILE * 0.6, 0xfafafa)
      .setStrokeStyle(2, 0x4b5563).setDepth(5)
    this.add.text(cx, zone.rect.y + 0.8 * TILE, '📋 OKR', {
      fontSize: '10px', color: '#000',
    }).setOrigin(0.5).setDepth(6)
    // Chairs around table
    const chairOffsets = [
      [-TILE * 2, -TILE], [0, -TILE], [TILE * 2, -TILE],
      [-TILE * 2, TILE], [0, TILE], [TILE * 2, TILE],
    ]
    for (const [dx, dy] of chairOffsets) {
      this.add.rectangle(cx + dx, cy + dy, TILE * 0.7, TILE * 0.6, 0x374151)
        .setStrokeStyle(1, 0x1e293b).setDepth(4)
    }
  }

  private drawGym(zone: Zone) {
    const cx = zone.rect.centerX
    // Treadmills (3)
    for (let i = 0; i < 3; i++) {
      const x = zone.rect.x + (1.5 + i * 2.3) * TILE
      const y = zone.rect.y + 2.5 * TILE
      // base
      this.add.rectangle(x, y + 6, TILE * 1.3, TILE * 0.8, 0x1f2937)
        .setStrokeStyle(2, 0x111827).setDepth(5)
      // belt
      this.add.rectangle(x, y + 6, TILE * 1.1, TILE * 0.5, 0x000000).setDepth(6)
      // display
      this.add.rectangle(x, y - 4, TILE * 0.5, TILE * 0.4, 0x06b6d4)
        .setStrokeStyle(1, 0x0891b2).setDepth(6)
      // arms / handlebars
      this.add.rectangle(x, y, 2, TILE * 0.8, 0x4b5563).setDepth(5)
    }
    // Yoga mat
    this.add.rectangle(cx, zone.rect.y + 5.5 * TILE, TILE * 3, TILE * 1.2, 0xa855f7)
      .setStrokeStyle(1, 0x6b21a8).setAlpha(0.7).setDepth(5)
    // Dumbbells
    for (let i = 0; i < 2; i++) {
      const x = zone.rect.x + (6 + i * 1) * TILE
      const y = zone.rect.y + 6 * TILE
      this.add.circle(x - 3, y, 3, 0x1f2937).setDepth(5)
      this.add.circle(x + 3, y, 3, 0x1f2937).setDepth(5)
      this.add.rectangle(x, y, 6, 1, 0x4b5563).setDepth(5)
    }
  }

  private drawLounge(zone: Zone) {
    const cx = zone.rect.centerX
    // Sofas (L-shape)
    this.add.rectangle(cx - TILE, zone.rect.y + 2 * TILE, TILE * 3, TILE * 1.2, 0x4a2eba)
      .setStrokeStyle(2, 0x2e1c8e).setDepth(5)
    this.add.rectangle(cx + 2 * TILE, zone.rect.y + 3.5 * TILE, TILE * 1.2, TILE * 2, 0x4a2eba)
      .setStrokeStyle(2, 0x2e1c8e).setDepth(5)
    // Coffee table
    this.add.rectangle(cx - 0.5 * TILE, zone.rect.y + 4 * TILE, TILE * 1.8, TILE * 1, 0x6b4423)
      .setStrokeStyle(1, 0x4a3422).setDepth(5)
    // Books on table
    this.add.rectangle(cx - TILE, zone.rect.y + 4 * TILE, 6, 3, 0xef4444).setDepth(6)
    this.add.rectangle(cx, zone.rect.y + 4 * TILE, 5, 3, 0x3b82f6).setDepth(6)
    // TV on wall
    this.add.rectangle(cx, zone.rect.y + 0.8 * TILE, TILE * 2, TILE * 1, 0x000000)
      .setStrokeStyle(2, 0x4b5563).setDepth(5)
    this.add.text(cx, zone.rect.y + 0.8 * TILE, '📺', { fontSize: '16px' })
      .setOrigin(0.5).setDepth(6)
    // Bookshelf
    this.add.rectangle(zone.rect.x + 1 * TILE, zone.rect.y + 5 * TILE, TILE * 0.6, TILE * 2, 0x4a3422)
      .setStrokeStyle(1, 0x2e1c0a).setDepth(5)
    for (let i = 0; i < 3; i++) {
      this.add.rectangle(zone.rect.x + 1 * TILE, zone.rect.y + (4.4 + i * 0.6) * TILE, TILE * 0.5, 5, 0xfde047 + i * 0x1000)
        .setDepth(6)
    }
    // Plant
    this.add.circle(zone.rect.x + 7.5 * TILE, zone.rect.y + 6 * TILE, 7, 0x4a2818)
      .setStrokeStyle(1, 0x2a1810).setDepth(5)
    this.add.text(zone.rect.x + 7.5 * TILE, zone.rect.y + 5.6 * TILE, '🪴', { fontSize: '14px' })
      .setOrigin(0.5).setDepth(6)
  }

  private drawPlant(x: number, y: number) {
    this.add.circle(x, y, 8, 0x4a2818).setStrokeStyle(1, 0x2a1810).setDepth(5)
    this.add.text(x, y - 6, '🌿', { fontSize: '14px' }).setOrigin(0.5).setDepth(6)
  }

  private computeDeskPositions() {
    const officeZone = ZONES.find((z) => z.activity === 'desk')!
    this.deskPositions = []
    // 4 columns × 3 rows in the office area
    const cols = 4, rows = 3
    const padX = TILE * 2
    const padY = TILE * 3
    const innerW = officeZone.rect.width - padX * 2
    const innerH = officeZone.rect.height - padY * 2
    const gapX = innerW / (cols - 1)
    const gapY = innerH / (rows - 1)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.deskPositions.push({
          x: officeZone.rect.x + padX + c * gapX,
          y: officeZone.rect.y + padY + r * gapY,
        })
      }
    }
  }

  // ── Chairman ────────────────────────────────────
  private placeChairman() {
    if (this.chairmanContainer) this.chairmanContainer.destroy()

    // Chairman has their own special desk at the top of the office area
    const officeZone = ZONES.find((z) => z.activity === 'desk')!
    const x = officeZone.rect.centerX
    const y = officeZone.rect.y + TILE * 1

    this.add.rectangle(x, y + 2, TILE * 3, TILE * 1.4, 0x6b4423).setStrokeStyle(2, 0x8b5a2b).setDepth(10)
    this.add.rectangle(x, y - 8, TILE * 1.0, TILE * 0.6, 0x1e293b).setStrokeStyle(1, 0x334155).setDepth(11)

    const c = this.add.container(x, y + TILE * 1.2).setDepth(20)
    c.add(this.add.rectangle(0, 0, 18, 22, 0x7c3aed).setStrokeStyle(1, 0x4c1d95))
    c.add(this.add.rectangle(0, -14, 14, 14, 0xfbbf24).setStrokeStyle(1, 0x92400e))
    c.add(this.add.text(0, -28, '👑', { fontSize: '16px' }).setOrigin(0.5))
    c.add(this.add.rectangle(-3, -14, 1.5, 2, 0x000000))
    c.add(this.add.rectangle(3, -14, 1.5, 2, 0x000000))
    const name = this.chairmanInfo?.displayName ?? '회장'
    c.add(this.add.text(0, 18, `${name} · 회장`, {
      fontSize: '11px', color: '#fde047', fontStyle: 'bold',
      backgroundColor: '#000000aa', padding: { x: 4, y: 1 },
    }).setOrigin(0.5))

    this.chairmanContainer = c
  }

  // ── Camera pan ─────────────────────────────────
  private setupCameraPan() {
    let pointerDownAt: { x: number, y: number } | null = null
    let camStart = { x: 0, y: 0 }
    let isPanning = false
    const DEAD_ZONE = 5

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      // Don't pan if pointer is on an interactive object (character)
      if (currentlyOver.length > 0) return
      pointerDownAt = { x: p.x, y: p.y }
      camStart.x = this.cameras.main.scrollX
      camStart.y = this.cameras.main.scrollY
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!pointerDownAt) return
      const dx = p.x - pointerDownAt.x
      const dy = p.y - pointerDownAt.y
      if (!isPanning && Math.abs(dx) + Math.abs(dy) < DEAD_ZONE) return
      isPanning = true
      this.cameras.main.scrollX = camStart.x - dx
      this.cameras.main.scrollY = camStart.y - dy
    })

    this.input.on('pointerup', () => {
      pointerDownAt = null
      this.time.delayedCall(20, () => { isPanning = false })
    })

    // Zoom
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0008, 0.5, 1.6))
    })

    // Keyboard pan (WASD / arrows)
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const step = 60
      const cam = this.cameras.main
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') cam.scrollX -= step
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') cam.scrollX += step
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') cam.scrollY -= step
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') cam.scrollY += step
    })
  }

  // ── Minimap ────────────────────────────────────
  private setupMinimap() {
    const mw = 180, mh = 135
    const mx = VIEW_W - mw - 10
    const my = 10
    const scale = mw / MAP_W

    // Static background
    const bg = this.add.graphics().setScrollFactor(0).setDepth(1000)
    bg.fillStyle(0x000000, 0.65)
    bg.fillRoundedRect(mx - 2, my - 2, mw + 4, mh + 4, 4)
    bg.lineStyle(1, 0xffffff, 0.4)
    bg.strokeRoundedRect(mx - 2, my - 2, mw + 4, mh + 4, 4)

    // Zone rectangles in minimap
    for (const zone of ZONES) {
      bg.fillStyle(zone.floorColor, 0.9)
      bg.fillRect(mx + zone.rect.x * scale, my + zone.rect.y * scale,
        zone.rect.width * scale, zone.rect.height * scale)
      bg.lineStyle(0.5, zone.accentColor, 0.6)
      bg.strokeRect(mx + zone.rect.x * scale, my + zone.rect.y * scale,
        zone.rect.width * scale, zone.rect.height * scale)
    }
    this.minimapBg = bg

    // Dynamic layer (agent dots + viewport indicator)
    this.minimapDynamic = this.add.graphics().setScrollFactor(0).setDepth(1001)

    // Hint
    this.add.text(mx + mw / 2, my + mh + 6, '드래그로 이동 · 스크롤로 확대', {
      fontSize: '9px', color: '#94a3b8', backgroundColor: '#00000088', padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000)

    // Click on minimap → center camera there
    bg.setInteractive(
      new Phaser.Geom.Rectangle(mx, my, mw, mh),
      Phaser.Geom.Rectangle.Contains,
    )
    this.minimapBg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const lx = p.x - mx
      const ly = p.y - my
      const worldX = (lx / scale)
      const worldY = (ly / scale)
      this.cameras.main.centerOn(worldX, worldY)
    })
  }

  private updateMinimap() {
    const g = this.minimapDynamic
    if (!g) return
    const mw = 180
    const mx = VIEW_W - mw - 10
    const my = 10
    const scale = mw / MAP_W

    g.clear()

    // Chairman dot
    if (this.chairmanContainer) {
      g.fillStyle(0xfde047, 1)
      g.fillCircle(mx + this.chairmanContainer.x * scale, my + this.chairmanContainer.y * scale, 2.4)
    }

    // Agent dots
    for (const sprite of this.sprites.values()) {
      const c = RANK_BADGE_COLOR[sprite.agent.rank] ?? 0xffffff
      g.fillStyle(c, 1)
      g.fillCircle(mx + sprite.container.x * scale, my + sprite.container.y * scale, 1.8)
    }

    // Viewport indicator (current camera view)
    const cam = this.cameras.main
    const vx = cam.scrollX * scale
    const vy = cam.scrollY * scale
    const vw = (VIEW_W / cam.zoom) * scale
    const vh = (VIEW_H / cam.zoom) * scale
    g.lineStyle(1.5, 0xffffff, 0.9)
    g.strokeRect(mx + vx, my + vy, vw, vh)
  }

  // ── Agents ──────────────────────────────────────
  private renderAgents(agents: Agent[]) {
    const sorted = [...agents].sort((a, b) => (a.hiredAt ?? 0) - (b.hiredAt ?? 0))
    const currentIds = new Set(sorted.map((a) => a.id))

    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        sprite.nextScheduled?.remove()
        sprite.moveTween?.stop()
        sprite.container.destroy()
        sprite.desk.destroy()
        sprite.monitor.destroy()
        sprite.chair.destroy()
        this.sprites.delete(id)
      }
    }

    sorted.forEach((agent, idx) => {
      const pos = this.deskPositions[idx % this.deskPositions.length]
      if (!pos) return

      const existing = this.sprites.get(agent.id)
      if (existing) {
        const needsRebuild =
          existing.agent.rank !== agent.rank ||
          existing.agent.role !== agent.role ||
          existing.agent.avatar?.body !== agent.avatar?.body ||
          existing.agent.avatar?.hair !== agent.avatar?.hair ||
          existing.agent.avatar?.hairColor !== agent.avatar?.hairColor
        if (needsRebuild) {
          existing.nextScheduled?.remove()
          existing.moveTween?.stop()
          existing.container.destroy()
          existing.desk.destroy()
          existing.monitor.destroy()
          existing.chair.destroy()
          this.sprites.delete(agent.id)
          this.createAgentSprite(agent, pos)
        } else {
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
    // Desk (visible only when at work — fading furniture)
    const desk = this.add.rectangle(pos.x, pos.y + 4, TILE * 2.1, TILE * 0.95, 0x8b5a2b)
      .setStrokeStyle(2, 0x5a3a1c).setDepth(10)
    // Monitor with stand
    this.add.rectangle(pos.x, pos.y - 2, 3, 5, 0x475569).setDepth(10.5)
    this.add.rectangle(pos.x, pos.y - 5, 10, 1.5, 0x475569).setDepth(10.5)
    const monitor = this.add.rectangle(pos.x, pos.y - 12, TILE * 0.85, TILE * 0.58, 0x0f172a)
      .setStrokeStyle(2, 0x475569).setDepth(11)
    this.add.rectangle(pos.x, pos.y - 12, TILE * 0.85 - 4, TILE * 0.58 - 4, 0x1e293b).setDepth(11.5)

    // Chair
    const chair = this.add.rectangle(pos.x, pos.y + TILE * 1.4, 16, 16, 0x3a4254)
      .setStrokeStyle(1, 0x1e293b).setDepth(15)

    // Character container — START AT DESK
    const startY = pos.y + TILE * 1.1
    const c = this.add.container(pos.x, startY)
    c.setSize(24, 36).setInteractive({ cursor: 'pointer' }).setDepth(20)

    const skin = SKIN_TONES[agent.avatar.body % SKIN_TONES.length]
    const hairColor = HAIR_COLORS[agent.avatar.hairColor % HAIR_COLORS.length]
    const shirt = this.bodyColor(agent.avatar)

    // Pants
    c.add(this.add.rectangle(0, 12, 10, 5, 0x1e293b))
    // Body
    const body = this.add.rectangle(0, 4, 18, 14, shirt).setStrokeStyle(1, 0x000000aa)
    c.add(body)
    c.add(this.add.rectangle(0, -1, 18, 1.5, 0xffffff, 0.2))
    // Arms
    c.add(this.add.rectangle(-10, 4, 3, 10, shirt).setStrokeStyle(1, 0x000000aa))
    c.add(this.add.rectangle(10, 4, 3, 10, shirt).setStrokeStyle(1, 0x000000aa))
    // Hands
    c.add(this.add.rectangle(-10, 9, 3, 3, skin))
    c.add(this.add.rectangle(10, 9, 3, 3, skin))
    // Neck
    c.add(this.add.rectangle(0, -4, 5, 3, skin))
    // Rank accent
    this.drawRankAccent(c, agent.rank)
    // Head
    c.add(this.add.rectangle(0, -11, 13, 13, skin).setStrokeStyle(1, 0x000000aa))
    // Hair
    this.drawHair(c, agent.avatar.hair, hairColor)
    // Eyes
    c.add(this.add.rectangle(-3, -11, 1.6, 2, 0x1a1a1a))
    c.add(this.add.rectangle(3, -11, 1.6, 2, 0x1a1a1a))
    c.add(this.add.rectangle(-3.2, -11.4, 0.6, 0.6, 0xffffff))
    c.add(this.add.rectangle(2.8, -11.4, 0.6, 0.6, 0xffffff))
    // Mouth
    c.add(this.add.rectangle(0, -7, 1.8, 0.6, 0x000000, 0.5))
    // Cheek blush
    c.add(this.add.circle(-4.5, -8, 1, 0xff8fb1, 0.4))
    c.add(this.add.circle(4.5, -8, 1, 0xff8fb1, 0.4))
    // Role accessory
    this.drawRoleAccessory(c, agent.role)
    // Rank badge
    c.add(this.add.circle(8, -3, 2, RANK_BADGE_COLOR[agent.rank] ?? 0xffffff)
      .setStrokeStyle(0.5, 0x000000))
    // Name
    const nameText = this.add.text(0, 22, `${agent.name} · ${agent.rank}`, {
      fontSize: '9px', color: this.rankColor(agent.rank),
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
      fontStyle: 'bold',
    }).setOrigin(0.5)
    c.add(nameText)
    // Work indicator
    const workIndicator = this.add.text(0, -32, '✦', {
      fontSize: '14px', color: '#fde047',
    }).setOrigin(0.5).setVisible(false)
    c.add(workIndicator)
    this.tweens.add({
      targets: workIndicator, y: -36, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    // Activity icon (shown only when doing an activity, e.g. ☕)
    const activityIcon = this.add.text(0, -32, '', {
      fontSize: '14px',
    }).setOrigin(0.5).setVisible(false)
    c.add(activityIcon)

    // Click → MBTI bubble + select
    c.on('pointerdown', () => {
      this.game.events.emit('agent-clicked', agent.id)
      const sprite = this.sprites.get(agent.id)
      if (sprite) this.showSpeechBubble(sprite, randomSelfTalk(sprite.agent.mbti))
    })

    const sprite: AgentSprite = {
      id: agent.id, container: c, body, nameText, workIndicator, activityIcon,
      agent, desk, monitor, chair,
      deskPos: { x: pos.x, y: startY },
      state: this.workingAgentId === agent.id ? 'working' : 'idle',
    }
    this.sprites.set(agent.id, sprite)

    // Indicate working state if matching the current working id
    if (this.workingAgentId === agent.id) {
      sprite.workIndicator.setVisible(true)
      sprite.monitor.setFillStyle(0x4ade80)
    } else {
      // Start free roaming shortly after appearing
      this.scheduleNext(sprite, 1500 + Math.random() * 2000)
    }
  }

  // ── Free-roam behavior ─────────────────────────
  private scheduleNext(sprite: AgentSprite, delay: number) {
    sprite.nextScheduled?.remove()
    sprite.nextScheduled = this.time.delayedCall(delay, () => {
      if (this.workingAgentId === sprite.id) return
      this.startActivity(sprite)
    })
  }

  private startActivity(sprite: AgentSprite) {
    if (this.workingAgentId === sprite.id) return

    // Pick a random non-desk zone for activity
    const choices = ZONES.filter((z) => z.activity !== 'desk')
    const zone = choices[Math.floor(Math.random() * choices.length)]

    // Random point within the zone (avoid the edges)
    const margin = 24
    const tx = Phaser.Math.Between(zone.rect.x + margin, zone.rect.x + zone.rect.width - margin)
    const ty = Phaser.Math.Between(zone.rect.y + margin, zone.rect.y + zone.rect.height - margin)

    this.walkTo(sprite, tx, ty, () => {
      // Arrived at zone
      sprite.state = 'activity'
      sprite.activityIcon.setText(this.activityEmoji(zone.activity)).setVisible(true)

      // Activity duration: 6–14 sec
      const duration = 6000 + Math.random() * 8000

      // Treadmill: bob
      let treadmillTween: Phaser.Tweens.Tween | undefined
      if (zone.activity === 'gym') {
        treadmillTween = this.tweens.add({
          targets: sprite.container, y: ty - 2, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      this.time.delayedCall(duration, () => {
        treadmillTween?.stop()
        sprite.activityIcon.setVisible(false)
        sprite.state = 'idle'
        if (this.workingAgentId === sprite.id) {
          this.sendToDesk(sprite)
        } else {
          this.scheduleNext(sprite, 500 + Math.random() * 2000)
        }
      })
    })
  }

  private sendToDesk(sprite: AgentSprite) {
    sprite.nextScheduled?.remove()
    sprite.activityIcon.setVisible(false)
    sprite.state = 'walking'
    this.walkTo(sprite, sprite.deskPos.x, sprite.deskPos.y, () => {
      sprite.state = 'working'
      sprite.workIndicator.setVisible(true)
      sprite.monitor.setFillStyle(0x4ade80)
    })
  }

  private walkTo(sprite: AgentSprite, x: number, y: number, onArrive?: () => void) {
    sprite.moveTween?.stop()
    sprite.state = 'walking'

    const dx = x - sprite.container.x
    const dy = y - sprite.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = 60 // px/sec
    const duration = Math.max(400, (dist / speed) * 1000)

    sprite.moveTween = this.tweens.add({
      targets: sprite.container,
      x, y,
      duration,
      ease: 'Linear',
      onComplete: () => {
        onArrive?.()
      },
    })
  }

  private activityEmoji(kind: ActivityKind): string {
    switch (kind) {
      case 'coffee': return '☕'
      case 'gym': return '🏃'
      case 'lounge': return '😎'
      case 'meeting': return '💬'
      default: return ''
    }
  }

  // ── Speech bubble ────────────────────────────────
  private showSpeechBubble(sprite: AgentSprite, text: string) {
    if (sprite.bubble) {
      sprite.bubble.destroy()
      sprite.bubble = undefined
    }

    const bubble = this.add.container(0, -38)
    const display = text.length > 28 ? text.slice(0, 26) + '…' : text

    const txt = this.add.text(0, 0, display, {
      fontSize: '10px', color: '#1a1a1a',
      padding: { x: 8, y: 5 }, align: 'center',
    }).setOrigin(0.5)

    const w = Math.max(70, txt.width + 16)
    const h = txt.height + 6
    const bg = this.add.graphics()
    bg.fillStyle(0xffffff, 0.96)
    bg.lineStyle(2, 0xfde047, 1)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6)
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6)
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
      targets: bubble, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut',
    })

    this.time.delayedCall(2400, () => {
      if (sprite.bubble !== bubble) return
      this.tweens.add({
        targets: bubble, alpha: 0, duration: 220,
        onComplete: () => {
          bubble.destroy()
          if (sprite.bubble === bubble) sprite.bubble = undefined
        },
      })
    })
  }

  // ── Hair styles ─────────────────────────────────
  private drawHair(c: Phaser.GameObjects.Container, style: number, color: number) {
    const make = (x: number, y: number, w: number, h: number) =>
      this.add.rectangle(x, y, w, h, color)

    const variant = style % 10
    switch (variant) {
      case 0:
        c.add(make(0, -17, 14, 4))
        c.add(make(-5, -15, 4, 3))
        c.add(make(5, -15, 4, 3))
        break
      case 1:
        c.add(make(0, -17, 15, 5))
        c.add(make(-7, -13, 2, 5))
        c.add(make(7, -13, 2, 5))
        break
      case 2:
        c.add(make(0, -17, 14, 5))
        c.add(make(-3, -12, 3, 3))
        c.add(make(3, -12, 3, 3))
        break
      case 3:
        c.add(make(0, -17, 13, 4))
        c.add(make(-4, -19, 2, 3))
        c.add(make(0, -20, 2, 4))
        c.add(make(4, -19, 2, 3))
        break
      case 4:
        c.add(make(0, -17, 13, 4))
        c.add(make(-3, -13, 4, 2))
        c.add(this.add.circle(0, -7, 2, color))
        break
      case 5:
        c.add(make(2, -17, 11, 4))
        c.add(make(-2, -16, 4, 3))
        break
      case 6:
        c.add(this.add.circle(0, -17, 8, color))
        break
      case 7:
        c.add(make(0, -17, 13, 3))
        c.add(make(0, -20, 3, 4))
        break
      case 8:
        c.add(make(0, -17, 14, 4))
        c.add(make(-7, -10, 2, 8))
        c.add(make(7, -10, 2, 8))
        break
      case 9:
        c.add(make(0, -18, 11, 2))
        break
    }
  }

  private drawRankAccent(c: Phaser.GameObjects.Container, rank: Rank) {
    switch (rank) {
      case '사원':
        c.add(this.add.triangle(0, -1, -2, -3, 2, -3, 0, 1, 0xffffff, 0.5))
        break
      case '대리':
        c.add(this.add.rectangle(0, 4, 2, 9, 0xc92a2a))
        c.add(this.add.triangle(0, -1, -2, -3, 2, -3, 0, 1, 0xffffff, 0.5))
        break
      case '과장':
        c.add(this.add.rectangle(0, 4, 2.5, 10, 0x1c4a8a))
        c.add(this.add.rectangle(0, 6, 12, 8, 0x1e293b, 0.45))
        break
      case '차장':
        c.add(this.add.rectangle(0, 4, 2.5, 10, 0x6d28d9))
        c.add(this.add.rectangle(-7, 5, 2, 12, 0x1e293b))
        c.add(this.add.rectangle(7, 5, 2, 12, 0x1e293b))
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
        c.add(this.add.circle(-4, 1, 1.2, 0xfde047))
        break
      case '대표이사':
        c.add(this.add.rectangle(0, 4, 3, 11, 0xfbbf24))
        c.add(this.add.rectangle(-7, 5, 3, 13, 0x000000))
        c.add(this.add.rectangle(7, 5, 3, 13, 0x000000))
        c.add(this.add.circle(-4, 1, 1.5, 0xfde047).setStrokeStyle(0.4, 0x92400e))
        break
      case '부회장':
      case '회장':
        c.add(this.add.rectangle(0, 4, 3, 11, 0xfde047))
        c.add(this.add.rectangle(-7, 5, 3, 13, 0x000000))
        c.add(this.add.rectangle(7, 5, 3, 13, 0x000000))
        break
    }
  }

  private drawRoleAccessory(c: Phaser.GameObjects.Container, role: Role) {
    switch (role) {
      case '개발자':
      case '개발PL':
        c.add(this.add.rectangle(0, -18, 14, 1.5, 0x1a1a1a))
        c.add(this.add.rectangle(-7, -14, 2.5, 3.5, 0x1a1a1a))
        c.add(this.add.rectangle(7, -14, 2.5, 3.5, 0x1a1a1a))
        c.add(this.add.circle(7, -14, 0.5, 0x4ade80))
        break
      case '인프라':
      case '인프라PL':
        c.add(this.add.rectangle(0, -18, 14, 2, 0xf97316))
        c.add(this.add.rectangle(0, -16, 9, 1, 0xf97316))
        c.add(this.add.rectangle(8, 5, 1.5, 4, 0x9ca3af))
        break
      case '테스터':
      case '테스터PL':
        c.add(this.add.circle(-3, -11, 2.4, 0xffffff, 0.15).setStrokeStyle(0.8, 0xffffff))
        c.add(this.add.circle(3, -11, 2.4, 0xffffff, 0.15).setStrokeStyle(0.8, 0xffffff))
        c.add(this.add.rectangle(0, -11, 1.4, 0.5, 0xffffff))
        break
      case '기획자':
      case '기획PL':
        c.add(this.add.rectangle(-10, 2, 3.5, 5, 0xffffff).setStrokeStyle(0.5, 0x000000))
        c.add(this.add.rectangle(-10, 0.5, 2.5, 0.4, 0x9ca3af))
        c.add(this.add.rectangle(-10, 2, 2.5, 0.4, 0x9ca3af))
        break
      case '총괄PM':
      case 'PMO':
        c.add(this.add.rectangle(0, -18, 13, 1.2, 0x1a1a1a))
        c.add(this.add.rectangle(-7, -14, 1.8, 3, 0x1a1a1a))
        c.add(this.add.rectangle(7, -14, 1.8, 3, 0x1a1a1a))
        c.add(this.add.rectangle(-5.5, -9, 0.5, 5, 0x1a1a1a))
        c.add(this.add.circle(-5.5, -6, 1, 0x4ade80))
        break
    }
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
