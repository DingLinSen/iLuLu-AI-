const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getDb } = require('../db')
const authMiddleware = require('../middleware/auth')

const router = express.Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }
  if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: '用户名长度需要 3-30 个字符' })
  }
  if (!/^[a-zA-Z0-9_一-龥]+$/.test(username)) {
    return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度不能少于 6 位' })
  }

  const db = getDb()
  const existing = await db.findUser(username)
  if (existing) {
    return res.status(409).json({ error: '用户名已存在' })
  }

  const hash = bcrypt.hashSync(password, 10)
  await db.createUser(username, hash)

  res.json({ success: true, message: '注册成功' })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }

  const db = getDb()
  const user = await db.findUser(username)
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: { id: user.id, username: user.username },
  })
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.userId, username: req.user.username } })
})

module.exports = router
