<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import hljs from 'highlight.js'
import LoginPage from './components/LoginPage.vue'
import {
  store, activeConv, newChat, deleteChat, renameChat,
  sendMessage, stopStream, regenerate, checkAuth, logout,
} from './store.js'

marked.setOptions({
  breaks: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
})

function renderMd(text) {
  return text ? marked.parse(text) : ''
}

const xSenderRef = ref(null)
const searchQuery = ref('')
const isMobile = ref(window.innerWidth <= 768)
const sidebarOpen = ref(!isMobile.value)
const copiedIdx = ref(null)

function handleResize() {
  isMobile.value = window.innerWidth <= 768
  sidebarOpen.value = !isMobile.value
}
onMounted(() => {
  checkAuth()
  window.addEventListener('resize', handleResize)
})
// Cleanup handled by Vue automatically in setup

// Filtered conversations
const filteredConvs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return store.conversations
  return store.conversations.filter((c) => c.title.toLowerCase().includes(q))
})

const convItems = computed(() =>
  filteredConvs.value.map((c) => ({
    key: c.id,
    label: c.title,
  }))
)

const convMenu = [
  { label: '重命名', key: 'rename' },
  { label: '删除', key: 'delete' },
]

// Check if last assistant message is empty (streaming just started)
const isThinking = computed(() => {
  const conv = activeConv.value
  if (!conv || !store.streaming) return false
  const msgs = conv.messages
  if (msgs.length === 0) return false
  const last = msgs[msgs.length - 1]
  return last.role === 'assistant' && last.content === ''
})

const bubbleList = computed(() => {
  const conv = activeConv.value
  if (!conv) return []
  const len = conv.messages.length
  return conv.messages.map((msg, i) => ({
    key: `${conv.id}-${i}`,
    placement: msg.role === 'user' ? 'end' : 'start',
    content: msg.content,
    role: msg.role,
    isLastAssistant: msg.role === 'assistant' && i === len - 1,
    isLastUser: msg.role === 'user' && i === len - 1,
    index: i,
    avatarSize: '28px',
    avatar: msg.role === 'user'
      ? 'https://api.dicebear.com/9.x/notionists/svg?seed=user&backgroundColor=b6e3f4'
      : 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=ai&backgroundColor=d1d5db',
  }))
})

// Example questions
const examples = [
  '用 JavaScript 写一个快速排序算法',
  '帮我解释一下什么是机器学习',
  '写一首关于夏天的五言绝句',
  '如何用 Vue 3 实现响应式数据？',
]

function handleMenuCommand(command, item) {
  if (command === 'delete') {
    deleteChat(item.key)
  } else if (command === 'rename') {
    const title = prompt('请输入新名称', item.label)
    if (title && title.trim()) {
      renameChat(item.key, title.trim())
    }
  }
}

async function handleDeleteCurrent() {
  const conv = activeConv.value
  if (!conv) return
  try {
    await ElMessageBox.confirm(
      `确定要删除会话"${conv.title}"吗？此操作不可撤销。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    deleteChat(conv.id)
  } catch { /* cancelled */ }
}

async function handleRenameCurrent() {
  const conv = activeConv.value
  if (!conv) return
  try {
    const { value } = await ElMessageBox.prompt('请输入新名称', '重命名', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: conv.title,
    })
    if (value && value.trim()) {
      renameChat(conv.id, value.trim())
    }
  } catch { /* cancelled */ }
}

function handleSubmit() {
  const model = xSenderRef.value?.getModelValue()
  const text = model?.text || ''
  if (!text.trim() || store.streaming) return
  sendMessage(text)
  xSenderRef.value?.clear()
}

function handleExample(text) {
  if (store.streaming) return
  sendMessage(text)
}

function handleCopy(content, index) {
  navigator.clipboard.writeText(content).then(() => {
    copiedIdx.value = index
    setTimeout(() => { copiedIdx.value = null }, 2000)
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = content
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copiedIdx.value = index
    setTimeout(() => { copiedIdx.value = null }, 2000)
  })
}

function handleAuthenticated(data) {
  store.auth.token = data.token
  store.auth.user = data.user
}
</script>

<template>
  <!-- 加载中 -->
  <div v-if="store.auth.loading" class="loading-screen">
    <div class="loading-spinner"></div>
  </div>

  <!-- 登录页 -->
  <LoginPage v-else-if="!store.auth.token" @authenticated="handleAuthenticated" />

  <!-- 主界面 -->
  <div v-else class="app-layout" :class="{ 'sidebar-collapsed': !sidebarOpen }">
    <!-- 移动端遮罩 -->
    <div v-if="!sidebarOpen && isMobile" class="sidebar-overlay" @click="sidebarOpen = true"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <span class="brand-text">iLuLu AI对话</span>
      </div>

      <div class="sidebar-top">
        <button class="btn-new-chat" @click="newChat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建对话
        </button>
      </div>

      <!-- 搜索框 -->
      <div class="sidebar-search">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索对话..."
          class="search-input"
        />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="conv-list">
        <Conversations
          :active="store.activeId"
          :items="convItems"
          :menu="convMenu"
          row-key="key"
          @menu-command="handleMenuCommand"
          @update:active="(val) => { store.activeId = val; if (isMobile) sidebarOpen = false }"
        />
        <div v-if="searchQuery && convItems.length === 0" class="search-empty">未找到匹配的对话</div>
      </div>

      <div class="sidebar-bottom">
        <div v-if="activeConv" class="sidebar-actions">
          <button class="btn-action" @click="handleRenameCurrent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            重命名
          </button>
          <button class="btn-action btn-action-danger" @click="handleDeleteCurrent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            删除会话
          </button>
        </div>
        <div class="sidebar-user" v-if="store.auth.user">
          <span class="user-avatar">{{ store.auth.user.username.charAt(0).toUpperCase() }}</span>
          <span class="user-name">{{ store.auth.user.username }}</span>
        </div>
        <button class="btn-logout" @click="logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          退出登录
        </button>
      </div>
    </aside>

    <!-- Chat Area -->
    <main class="chat-main">
      <!-- 移动端菜单按钮 -->
      <div v-if="isMobile" class="chat-topbar">
        <button class="btn-menu" @click="sidebarOpen = !sidebarOpen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span class="topbar-title">{{ activeConv?.title || 'AI Chat' }}</span>
      </div>

      <div class="chat-body">
        <BubbleList
          v-if="bubbleList.length > 0"
          ref="bubbleListRef"
          :list="bubbleList"
          :auto-scroll="true"
          :virtual="false"
          max-height="100%"
        >
          <template #content="{ item }">
            <!-- 用户消息 -->
            <div v-if="item.role === 'user'" class="user-msg">{{ item.content }}</div>

            <!-- AI 消息 -->
            <div v-else class="ai-msg-wrap">
              <!-- 思考动画：流式输出中且 AI 还没生成内容 -->
              <div v-if="item.isLastAssistant && isThinking" class="thinking-dots">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              </div>
              <!-- Markdown 内容 -->
              <div v-if="item.content" class="markdown-body" v-html="renderMd(item.content)"></div>
              <!-- 流式输出光标 -->
              <span v-if="item.isLastAssistant && store.streaming && item.content" class="streaming-cursor">|</span>

              <!-- 消息操作按钮 -->
              <div v-if="item.content && item.role !== 'user'" class="msg-actions">
                <button
                  class="msg-action-btn"
                  :class="{ copied: copiedIdx === item.index }"
                  title="复制"
                  @click="handleCopy(item.content, item.index)"
                >
                  <svg v-if="copiedIdx !== item.index" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>{{ copiedIdx === item.index ? '已复制' : '复制' }}</span>
                </button>
                <button
                  v-if="item.isLastAssistant && !store.streaming"
                  class="msg-action-btn"
                  title="重新生成"
                  @click="regenerate()"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  <span>重新生成</span>
                </button>
              </div>
            </div>
          </template>
        </BubbleList>

        <!-- 欢迎页 -->
        <div v-else class="welcome">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h2>有什么我可以帮你的？</h2>
          <p>试试下面的例子，或直接输入你的问题</p>
          <div class="examples">
            <button
              v-for="(ex, i) in examples"
              :key="i"
              class="example-btn"
              @click="handleExample(ex)"
            >
              {{ ex }}
            </button>
          </div>
        </div>
      </div>

      <div class="chat-footer">
        <XSender
          ref="xSenderRef"
          placeholder="输入你的问题..."
          :loading="store.streaming"
          submit-type="enter"
          @submit="handleSubmit"
        />
        <button
          v-if="store.streaming"
          class="btn-stop"
          @click="stopStream()"
        >
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          停止生成
        </button>
      </div>
    </main>
  </div>
</template>

<!-- 全局样式 -->
<style>
.elx-conversations {
  width: 100% !important;
  box-shadow: none !important;
}
.sidebar .elx-conversations__scroll-wrapper {
  background: transparent;
}
.sidebar .elx-conversations-item {
  margin-right: 6px;
  margin-bottom: 2px;
  border-radius: 12px;
  padding: 10px 12px;
  transition: all 0.2s ease;
}
.sidebar .elx-conversations-item:hover,
.sidebar .elx-conversations-item--hovered {
  background: #f0f3ff !important;
}
.sidebar .elx-conversations-item--active {
  background: #eef0ff !important;
  box-shadow: inset 3px 0 0 #667eea;
}
.sidebar .elx-conversations-item__label {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}
.elx-bubble-list {
  background: transparent !important;
  width: 100% !important;
}
.elx-bubble--start .elx-bubble__content {
  background: #ffffff !important;
  border-radius: 16px 16px 16px 6px !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04) !important;
  border: 1px solid #eef0f5 !important;
}
.elx-bubble--end .elx-bubble__content {
  background: linear-gradient(135deg, #667eea, #764ba2) !important;
  border-radius: 16px 16px 6px 16px !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px rgba(102, 126, 234, 0.35) !important;
  border: none !important;
}
.elx-bubble--end .elx-bubble__content .elx-bubble__text {
  color: #fff !important;
}
.elx-bubble-list__list {
  padding: 16px 20px !important;
}
.elx-x-sender__content {
  background: #ffffff !important;
  border-radius: 16px !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06) !important;
  border: 1px solid #eef0f5 !important;
  padding: 10px 16px !important;
  transition: border-color 0.2s, box-shadow 0.2s !important;
}
.elx-x-sender__content:focus-within {
  border-color: #667eea !important;
  box-shadow: 0 2px 16px rgba(102, 126, 234, 0.15) !important;
}
</style>

<style scoped>
/* === 加载 === */
.loading-screen {
  display: flex; align-items: center; justify-content: center; height: 100vh;
  background: linear-gradient(135deg, #f5f7fb 0%, #eceff5 100%);
}
.loading-spinner {
  width: 36px; height: 36px;
  border: 3px solid #e4e6ed; border-top-color: #667eea;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* === 布局 === */
.app-layout {
  display: flex; height: 100vh; overflow: hidden;
  background: linear-gradient(135deg, #f5f7fb 0%, #eceff5 100%);
}

/* === 侧边栏 === */
.sidebar {
  width: 262px; min-width: 262px;
  display: flex; flex-direction: column;
  background: #fff; border-right: 1px solid #eef0f3;
  box-shadow: 2px 0 24px rgba(0, 0, 0, 0.03); z-index: 20;
  transition: transform 0.3s ease;
}
.sidebar-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 22px 18px 12px;
}
.brand-icon {
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px; color: #fff; flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
}
.brand-icon svg { width: 20px; height: 20px; }
.brand-text {
  font-size: 19px; font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

.sidebar-top { padding: 10px 16px 14px; flex-shrink: 0; }
.btn-new-chat {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none; color: #fff; font-size: 14px; font-weight: 600;
  border-radius: 12px; height: 42px; cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s; font-family: inherit;
}
.btn-new-chat:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(102, 126, 234, 0.45); }
.btn-new-chat svg { width: 18px; height: 18px; }

/* 搜索框 */
.sidebar-search {
  display: flex; align-items: center;
  margin: 0 10px 10px; padding: 0 12px;
  height: 36px; background: #f3f4f8; border-radius: 10px;
  flex-shrink: 0;
  transition: background 0.2s, box-shadow 0.2s;
}
.sidebar-search:focus-within {
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  background: #fff;
}
.search-icon { width: 16px; height: 16px; color: #aaa; flex-shrink: 0; }
.search-input {
  flex: 1; border: none; background: transparent;
  font-size: 13px; color: #333; outline: none;
  padding: 0 8px; font-family: inherit;
}
.search-input::placeholder { color: #bbb; }
.search-clear {
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
  border: none; background: none; color: #aaa; cursor: pointer; padding: 0;
  border-radius: 50%; flex-shrink: 0;
}
.search-clear:hover { color: #666; background: #e4e4ea; }
.search-clear svg { width: 14px; height: 14px; }
.search-empty {
  text-align: center; font-size: 13px; color: #aaa; padding: 20px 10px;
}

.conv-list {
  flex: 1; min-height: 0; overflow: hidden; padding: 0 10px;
}

.sidebar-bottom {
  padding: 10px 14px; flex-shrink: 0; border-top: 1px solid #f0f0f3;
  display: flex; flex-direction: column; gap: 6px;
}
.sidebar-actions {
  display: flex; gap: 6px; padding: 0 0 8px;
}
.btn-action {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px 0; border: 1px solid #e8eaef; background: #fafbfc;
  font-size: 12px; font-weight: 500; border-radius: 8px;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
  color: #7c7c8a;
}
.btn-action:hover { background: #f0f3ff; border-color: #667eea; color: #667eea; }
.btn-action-danger:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
.btn-action svg { width: 14px; height: 14px; flex-shrink: 0; }

.sidebar-user {
  display: flex; align-items: center; gap: 10px; padding: 4px 6px;
}
.user-avatar {
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; flex-shrink: 0;
}
.user-name {
  font-size: 13px; font-weight: 500; color: #3a3a46;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.btn-logout {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: none; border: none;
  font-size: 14px; font-weight: 500; border-radius: 12px; cursor: pointer;
  transition: all 0.2s; font-family: inherit; color: #c0c0cc;
}
.btn-logout:hover { background: #fef2f2; color: #dc2626; }
.btn-logout svg { width: 19px; height: 19px; flex-shrink: 0; }

/* === 聊天区域 === */
.chat-main {
  flex: 1; display: flex; flex-direction: column;
  min-width: 0; height: 100vh;
}
.chat-topbar {
  display: none; align-items: center; gap: 12px;
  padding: 10px 16px; background: #fff; border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}
.btn-menu {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  border: none; background: none; color: #555; cursor: pointer;
  border-radius: 8px; flex-shrink: 0;
}
.btn-menu:hover { background: #f3f4f8; }
.btn-menu svg { width: 20px; height: 20px; }
.topbar-title {
  font-size: 15px; font-weight: 600; color: #3a3a46;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.chat-body { flex: 1; min-height: 0; overflow: hidden; }

/* === 思考动画 === */
.thinking-dots {
  display: flex; align-items: center; gap: 5px; padding: 8px 4px;
}
.thinking-dots .dot {
  width: 7px; height: 7px; background: #667eea; border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}
.thinking-dots .dot:nth-child(1) { animation-delay: 0s; }
.thinking-dots .dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots .dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* 流式光标 */
.streaming-cursor {
  color: #667eea; font-weight: 300; font-size: 1.1em;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* === 消息操作按钮 === */
.ai-msg-wrap {
  position: relative;
}
.msg-actions {
  display: flex; gap: 6px; margin-top: 10px; padding-top: 8px;
  border-top: 1px solid #f0f0f4;
}
.msg-action-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border: 1px solid #e8eaef;
  background: #fafbfc; border-radius: 6px;
  font-size: 12px; color: #888; cursor: pointer;
  transition: all 0.15s; font-family: inherit;
}
.msg-action-btn:hover { background: #f0f3ff; border-color: #667eea; color: #667eea; }
.msg-action-btn.copied { background: #f0fdf4; border-color: #86efac; color: #16a34a; }
.msg-action-btn svg { width: 14px; height: 14px; }

/* === 欢迎页 === */
.welcome {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%; gap: 14px; padding: 0 20px 60px;
}
.welcome-icon {
  width: 72px; height: 72px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.08));
  border-radius: 22px; color: #667eea;
}
.welcome-icon svg { width: 36px; height: 36px; }
.welcome h2 { font-size: 28px; font-weight: 600; color: #2c2c3a; margin: 0; }
.welcome p { font-size: 15px; color: #9696a0; margin: 0; }

.examples {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 10px; margin-top: 16px; max-width: 480px;
}
.example-btn {
  padding: 10px 18px; border: 1px solid #e0e3f0;
  background: #fff; border-radius: 10px;
  font-size: 14px; color: #5a5a6e; cursor: pointer;
  transition: all 0.2s; font-family: inherit;
  white-space: nowrap;
}
.example-btn:hover {
  border-color: #667eea; color: #667eea;
  box-shadow: 0 2px 10px rgba(102,126,234,0.1);
  transform: translateY(-1px);
}

/* === 用户消息 === */
.user-msg { white-space: pre-wrap; word-break: break-word; color: #fff; line-height: 1.65; }

/* === Markdown === */
.markdown-body :deep(p) { margin-bottom: 8px; color: #3a3a46; line-height: 1.7; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }
.markdown-body :deep(pre) {
  background: #1e1e2e; border-radius: 12px; padding: 16px;
  overflow-x: auto; margin: 10px 0; font-size: 13px; line-height: 1.6;
  border: 1px solid #2a2a3e;
}
.markdown-body :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, Consolas, monospace; font-size: 13px;
}
.markdown-body :deep(:not(pre) > code) {
  background: #f0f0f5; color: #d9466a; padding: 2px 7px; border-radius: 5px; font-size: 0.9em;
}
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 22px; margin: 8px 0; color: #4a4a56; }
.markdown-body :deep(li) { margin-bottom: 4px; }
.markdown-body :deep(blockquote) {
  border-left: 3px solid #667eea; padding: 10px 14px; color: #6b6b7a;
  margin: 10px 0; background: #f8f9fc; border-radius: 0 10px 10px 0;
}
.markdown-body :deep(table) { border-collapse: collapse; margin: 10px 0; width: 100%; font-size: 13px; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid #e8eaef; padding: 8px 14px; text-align: left; }
.markdown-body :deep(th) { background: #f8f9fc; font-weight: 600; color: #4a4a56; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { color: #2c2c3a; margin-top: 18px; margin-bottom: 10px; }
.markdown-body :deep(h1) { font-size: 1.4em; } .markdown-body :deep(h2) { font-size: 1.2em; } .markdown-body :deep(h3) { font-size: 1.05em; }

/* === 输入区域 === */
.chat-footer {
  flex-shrink: 0; padding: 10px 20px 20px;
  background: transparent; display: flex; align-items: center; gap: 10px;
}
.btn-stop {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid #fecaca;
  background: #fef2f2; color: #dc2626;
  font-size: 13px; font-weight: 500; border-radius: 10px;
  cursor: pointer; transition: all 0.2s; font-family: inherit;
  white-space: nowrap; flex-shrink: 0;
}
.btn-stop:hover { background: #fee2e2; }
.btn-stop svg { width: 14px; height: 14px; }

/* === 移动端适配 === */
.sidebar-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 15;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0;
    transform: translateX(-100%);
  }
  .sidebar.open { transform: translateX(0); }

  .chat-topbar { display: flex; }

  .elx-bubble-list__list { padding: 12px 12px !important; }
  .chat-footer { padding: 8px 12px 12px; }

  .welcome h2 { font-size: 22px; }
  .welcome p { font-size: 14px; }
  .examples { flex-direction: column; width: 100%; }
  .example-btn { white-space: normal; text-align: left; }

  .msg-actions { flex-wrap: wrap; }
}
</style>
