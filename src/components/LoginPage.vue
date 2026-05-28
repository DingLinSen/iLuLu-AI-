<script setup>
import { reactive, ref } from 'vue'
import { login, register } from '../api.js'

const emit = defineEmits(['authenticated'])

const activeTab = ref('login')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const loginForm = reactive({ username: '', password: '' })
const regForm = reactive({ username: '', password: '', confirmPassword: '' })

async function handleLogin() {
  errorMsg.value = ''
  if (!loginForm.username || !loginForm.password) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const data = await login(loginForm.username, loginForm.password)
    emit('authenticated', data)
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!regForm.username || !regForm.password) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  if (regForm.username.length < 3 || regForm.username.length > 30) {
    errorMsg.value = '用户名长度需要 3-30 个字符'
    return
  }
  if (!/^[a-zA-Z0-9_一-龥]+$/.test(regForm.username)) {
    errorMsg.value = '用户名只能包含字母、数字、下划线和中文'
    return
  }
  if (regForm.password !== regForm.confirmPassword) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }
  if (regForm.password.length < 6) {
    errorMsg.value = '密码长度不能少于 6 位'
    return
  }
  loading.value = true
  try {
    await register(regForm.username, regForm.password)
    successMsg.value = '注册成功，请登录'
    loginForm.username = regForm.username
    loginForm.password = ''
    regForm.username = ''
    regForm.password = ''
    regForm.confirmPassword = ''
    activeTab.value = 'login'
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    loading.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  errorMsg.value = ''
  successMsg.value = ''
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <h1>iLuLu AI对话</h1>
        <p>登录以开始对话</p>
      </div>

      <div class="login-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'login' }]"
          @click="switchTab('login')"
        >登录</button>
        <button
          :class="['tab-btn', { active: activeTab === 'register' }]"
          @click="switchTab('register')"
        >注册</button>
      </div>

      <!-- Error / Success messages -->
      <div v-if="errorMsg" class="msg msg-error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="msg msg-success">{{ successMsg }}</div>

      <!-- Login Form -->
      <form v-if="activeTab === 'login'" class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label>用户名</label>
          <input v-model="loginForm.username" type="text" placeholder="请输入用户名" autocomplete="username" />
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="loginForm.password" type="password" placeholder="请输入密码" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- Register Form -->
      <form v-else class="login-form" @submit.prevent="handleRegister">
        <div class="field">
          <label>用户名</label>
          <input v-model="regForm.username" type="text" placeholder="3-30 个字符，支持中英文" autocomplete="off" />
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="regForm.password" type="password" placeholder="至少 6 位密码" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>确认密码</label>
          <input v-model="regForm.confirmPassword" type="password" placeholder="再次输入密码" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fb 0%, #eceff5 100%);
}

.login-card {
  width: 400px;
  background: #fff;
  border-radius: 20px;
  padding: 40px 36px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.brand-icon {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 14px;
  color: #fff;
  margin-bottom: 14px;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
}

.brand-icon svg {
  width: 26px;
  height: 26px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 6px;
}

.login-header p {
  font-size: 14px;
  color: #9696a0;
  margin: 0;
}

.login-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  background: #f3f4f8;
  border-radius: 10px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #7c7c8a;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn.active {
  background: #fff;
  color: #667eea;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  color: #4a4a56;
}

.field input {
  height: 44px;
  border: 1px solid #e4e6ed;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
  color: #333;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
  background: #fafbfc;
}

.field input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: #fff;
}

.field input::placeholder {
  color: #c0c0cc;
}

.btn-submit {
  height: 46px;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  font-family: inherit;
  margin-top: 4px;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.msg {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.msg-error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.msg-success {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}
</style>
