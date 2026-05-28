require('dotenv').config()

const path = require('path')
const express = require('express')
const cors = require('cors')
const { setup } = require('./db')
const authRoutes = require('./routes/auth')
const chatRoutes = require('./routes/chat')

// Initialize database (async for PostgreSQL)
setup().then(() => {
  console.log('[db] Database ready')
}).catch((err) => {
  console.error('[db] Failed to initialize database:', err)
  process.exit(1)
})

const app = express()

app.use(cors())
app.use(express.json())

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/chat', chatRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Production: serve frontend static files
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// SPA fallback: all non-API routes return index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
