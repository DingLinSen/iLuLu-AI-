const https = require('https')
const http = require('http')
const express = require('express')
const authMiddleware = require('../middleware/auth')

const router = express.Router()

// POST /api/chat/completions (SSE proxy)
router.post('/completions', authMiddleware, (req, res) => {
  const { messages, model, systemPrompt, apiUrl: clientApiUrl } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' })
  }

  const apiUrl = clientApiUrl || process.env.DEEPSEEK_API_URL
  const chatModel = model || process.env.DEEPSEEK_MODEL

  // Prepend system prompt if provided
  const apiMessages = []
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt })
  }
  apiMessages.push(...messages)

  const postData = JSON.stringify({
    model: chatModel,
    messages: apiMessages,
    stream: true,
  })

  const parsedUrl = new URL(apiUrl)
  const transport = parsedUrl.protocol === 'https:' ? https : http

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname.replace(/\/$/, '') + '/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'text/event-stream',
    },
  }

  const upstreamReq = transport.request(options, (upstreamRes) => {
    if (upstreamRes.statusCode >= 400) {
      let body = ''
      upstreamRes.on('data', (chunk) => { body += chunk })
      upstreamRes.on('end', () => {
        res.status(upstreamRes.statusCode).json({ error: `上游 API 错误 [${upstreamRes.statusCode}]: ${body}` })
      })
      return
    }

    // Set SSE headers and pipe
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
    streaming = true

    upstreamRes.pipe(res)

    upstreamRes.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: `流错误: ${err.message}` })
      } else {
        res.end()
      }
    })
  })

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: `请求失败: ${err.message}` })
    } else {
      res.end()
    }
  })

  // Cancel upstream request if client disconnects (only after streaming started)
  let streaming = false
  req.on('close', () => {
    if (streaming) {
      upstreamReq.destroy()
    }
  })

  upstreamReq.write(postData)
  upstreamReq.end()
})

module.exports = router
