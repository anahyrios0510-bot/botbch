const { downloadContentFromMessage } = require('@whiskeysockets/baileys')
const file = {
  name: "bch",
  run: async (sock, m, args, from) => {
    const groupMetadata = await sock.groupMetadata(from).catch(() => null)
    const sender = m.key.participant || m.key.remoteJid
    const p = groupMetadata?.participants.find(x => x.id === sender)
    const esAdmin = p?.admin === 'admin' || p?.admin === 'superadmin'
    if (!esAdmin) return sock.sendMessage(from, { text: '❌ Solo admins.' }, { quoted: m })

    const link = args[0]
    if (!link) return sock.sendMessage(from, { text: 'Usa: .bch link-de-tu-canal' }, { quoted: m })
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted?.stickerMessage) return sock.sendMessage(from, { text: 'Responde a un sticker con audio con .bch' }, { quoted: m })

    const channelId = link.split('/').pop() + '@newsletter'
    const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker')
    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    await sock.sendMessage(channelId, { sticker: buffer })
    await sock.sendMessage(from, { text: '✅ Ya se publicó en tu canal.' }, { quoted: m })
  }
}
module.exports = file
