
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const fs = require('fs')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const express = require('express')

const app = express()
app.get('/', (req, res) => res.send('Bot BCH activo ✅'))
app.listen(process.env.PORT || 3000, () => console.log('Web activa'))

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) })
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u
    if (qr) qrcode.generate(qr, { small: true })
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) start()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const texto = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ''
    if (!texto.startsWith('.') && !texto.startsWith('#')) return
    const args = texto.slice(1).trim().split(/ +/)
    const cmd = args.shift().toLowerCase()

    const archivos = fs.readdirSync('./Comandos')
    for (const archivo of archivos) {
      if (!archivo.endsWith('.js')) continue
      const comando = require(`./Comandos/${archivo}`)
      if (comando.name === cmd) {
        try { await comando.run(sock, m, args, from) } catch (e) { console.log(e) }
      }
    }
  })
}
start()
