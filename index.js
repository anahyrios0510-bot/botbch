const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) })
  sock.ev.on('creds.update', saveCreds)

  if (!state.creds.registered) {
    setTimeout(async () => {
      try {
        const phone = process.env.PHONE_NUMBER
        if (!phone) return console.log('Pon la variable PHONE_NUMBER en Railway')
        const code = await sock.requestPairingCode(phone)
        console.log('TU CODIGO ES: ' + code)
      } catch(e) { console.log(e) }
    }, 3000)
  }

  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'open') console.log('BOT CONECTADO ✅')
    if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) start()
  })

  const comandos = {}
  const carpeta = path.join(__dirname, 'comandos')
  if (fs.existsSync(carpeta)) {
    fs.readdirSync(carpeta).forEach(f => {
      if (!f.endsWith('.js')) return
      const cmd = require(path.join(carpeta, f))
      comandos[cmd.name] = cmd
    })
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const text = m.message.conversation || m.message.extendedTextMessage?.text || ''
    if (!text.startsWith('.')) return
    const args = text.slice(1).trim().split(' ')
    const name = args.shift().toLowerCase()
    const from = m.key.remoteJid
    if (comandos[name]) {
      try { await comandos[name].run(sock, m, args, from) } catch(e) { console.log(e) }
    }
  })
}
start()
