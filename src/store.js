import { reactive, computed } from 'vue'
import { getToken, clearToken, login, register, getMe, sendChatMessage } from './api.js'

const STORAGE_KEY = 'ai-chat-data'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted */ }
  return null
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const saved = load()

export const store = reactive({
  conversations: saved?.conversations || [],
  settings: {
    apiUrl: saved?.settings?.apiUrl || 'https://api.deepseek.com/v1',
    model: saved?.settings?.model || 'deepseek-chat',
    systemPrompt: saved?.settings?.systemPrompt || '你是一个有帮助的AI助手。',
  },
  activeId: saved?.activeId || null,
  streaming: false,
  settingsOpen: false,
  auth: {
    token: getToken() || null,
    user: null,
    loading: !!getToken(),
  },
})

let abortController = null

export const activeConv = computed(() =>
  store.conversations.find((c) => c.id === store.activeId) || null
)

// --- Auth ---
export async function checkAuth() {
  if (!store.auth.token) {
    store.auth.loading = false
    return
  }
  try {
    const data = await getMe()
    store.auth.user = data.user
  } catch {
    store.auth.token = null
    clearToken()
  } finally {
    store.auth.loading = false
  }
}

export async function performLogin(username, password) {
  const data = await login(username, password)
  store.auth.token = data.token
  store.auth.user = data.user
}

export async function performRegister(username, password) {
  await register(username, password)
}

export function logout() {
  store.auth.token = null
  store.auth.user = null
  store.activeId = null
  clearToken()
}

// --- Conversations ---
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

function persist() {
  save({
    conversations: store.conversations,
    settings: store.settings,
    activeId: store.activeId,
  })
}

export function newChat() {
  const conv = {
    id: genId(),
    title: '新的对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  store.conversations.unshift(conv)
  store.activeId = conv.id
  persist()
}

export function deleteChat(id) {
  const idx = store.conversations.findIndex((c) => c.id === id)
  if (idx === -1) return
  store.conversations.splice(idx, 1)
  if (store.activeId === id) {
    store.activeId = store.conversations[0]?.id || null
  }
  persist()
}

export function renameChat(id, title) {
  const conv = store.conversations.find((c) => c.id === id)
  if (conv) {
    conv.title = title
    persist()
  }
}

export async function sendMessage(content) {
  if (!content.trim() || store.streaming) return

  let conv = activeConv.value
  if (!conv) {
    newChat()
    conv = activeConv.value
  }

  conv.messages.push({ role: 'user', content: content.trim() })
  conv.updatedAt = Date.now()

  if (conv.title === '新的对话') {
    const t = content.trim()
    conv.title = t.slice(0, 30) + (t.length > 30 ? '...' : '')
  }

  conv.messages.push({ role: 'assistant', content: '' })
  const assistantMsg = conv.messages[conv.messages.length - 1]

  store.streaming = true
  abortController = new AbortController()
  persist()

  try {
    await sendChatMessage(
      {
        messages: conv.messages.slice(0, -1), // exclude the empty assistant placeholder
        model: store.settings.model,
        systemPrompt: store.settings.systemPrompt,
        apiUrl: store.settings.apiUrl,
      },
      (delta) => {
        assistantMsg.content += delta
      },
      abortController.signal
    )
  } catch (e) {
    if (e.name !== 'AbortError') {
      assistantMsg.content = assistantMsg.content || `错误: ${e.message}`
    }
  } finally {
    store.streaming = false
    abortController = null
    persist()
  }
}

export function stopStream() {
  abortController?.abort()
}

export function regenerate() {
  const conv = activeConv.value
  if (!conv || store.streaming) return
  const msgs = conv.messages
  if (msgs.length < 2) return

  const last = msgs[msgs.length - 1]
  if (last.role === 'assistant') msgs.pop()
  const prev = msgs[msgs.length - 1]
  if (prev?.role === 'user') {
    msgs.pop()
    sendMessage(prev.content)
  }
}

export function saveSettings() {
  persist()
}
