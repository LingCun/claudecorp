import {
  collection, doc, getDoc, getDocs, addDoc, deleteDoc,
  onSnapshot, query, where, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import type { Agent, Company, Message, Rank, Role } from '../types'

// ─── Company ───────────────────────────────────────
export async function getCompanyForUser(uid: string): Promise<Company | null> {
  const q = query(collection(db, 'companies'), where('ownerId', '==', uid))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Omit<Company, 'id'>) }
}

export async function createCompany(uid: string, name: string): Promise<Company> {
  const ref = await addDoc(collection(db, 'companies'), {
    ownerId: uid,
    name,
    plan: 'free',
    coin: 1000,
    chairmanAvatar: { body: 0, hair: 0, hairColor: 0, accessory: 0 },
    createdAt: Date.now(),
  })
  const snap = await getDoc(ref)
  return { id: snap.id, ...(snap.data() as Omit<Company, 'id'>) }
}

// ─── Agents ───────────────────────────────────────
export function watchAgents(companyId: string, cb: (agents: Agent[]) => void) {
  const q = query(
    collection(db, 'companies', companyId, 'agents'),
    orderBy('hiredAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Agent, 'id'>) })))
  })
}

export async function hireAgent(
  companyId: string,
  data: { name: string; rank: Rank; role: Role; description: string },
): Promise<Agent> {
  const newAgent: Omit<Agent, 'id'> = {
    name: data.name,
    rank: data.rank,
    role: data.role,
    description: data.description,
    avatar: {
      body: Math.floor(Math.random() * 4),
      hair: Math.floor(Math.random() * 10),
      hairColor: Math.floor(Math.random() * 6),
      accessory: 0,
    },
    status: 'idle',
    position: { x: 100, y: 100 },
    xp: 0,
    level: 1,
    hiredAt: Date.now(),
  }
  const ref = await addDoc(collection(db, 'companies', companyId, 'agents'), newAgent)
  return { id: ref.id, ...newAgent }
}

export async function fireAgent(companyId: string, agentId: string) {
  await deleteDoc(doc(db, 'companies', companyId, 'agents', agentId))
}

// ─── Messages ───────────────────────────────────────
export function watchMessages(
  companyId: string,
  conversationId: string,
  cb: (messages: Message[]) => void,
) {
  const q = query(
    collection(db, 'companies', companyId, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) })))
  })
}

export async function sendMessage(
  companyId: string,
  conversationId: string,
  msg: Omit<Message, 'id'>,
) {
  return addDoc(
    collection(db, 'companies', companyId, 'conversations', conversationId, 'messages'),
    msg,
  )
}

export async function ensureConversation(companyId: string): Promise<string> {
  const convsCol = collection(db, 'companies', companyId, 'conversations')
  const snap = await getDocs(query(convsCol, orderBy('createdAt', 'desc')))
  if (!snap.empty) return snap.docs[0].id
  const ref = await addDoc(convsCol, {
    title: '첫 대화',
    createdAt: Date.now(),
  })
  return ref.id
}
