const fs = require('fs')
const { exec } = require('child_process')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

const file = {
  name: "sa",
  run: async (sock, m, args, from) => {
    const groupMetadata = await sock.groupMetadata(from).catch(() => null)
    if (!groupMetadata) return sock.sendMessage(from, { text: 'Solo en grupos.' }, { quoted: m })
    const sender = m.key.participant || m.key.remoteJid
    const p = groupMetadata.participants.find(x => x.id === sender)
    const esAdmin = p?.admin === 'admin' || p?.admin === 'superadmin'
    if (!esAdmin) return sock.sendMessage(from, { text: '❌ Solo admins.' }, { quoted: m })

    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted?.videoMessage) return sock.sendMessage(from, { text: 'Responde a un video con .sa' }, { quoted: m })

    await sock.sendMessage(from, { text: 'Creando tu sticker con audio...' }, { quoted: m })
    const stream = await downloadContentFromMessage(quoted.videoMessage, 'video')
    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    fs.writeFileSync('./temp_sa.mp4', buffer)

    exec(`ffmpeg -y -i ./temp_sa.mp4 -c:v libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0" -c:a libopus ./temp_sa.webp`, async (err) => {
      if (err) return sock.sendMessage(from, { text: 'Error, intenta con video más corto.' }, { quoted: m })
      const stickerBuffer = fs.readFileSync('./temp_sa.webp')
      await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
    })
  }
}
module.exports = file
