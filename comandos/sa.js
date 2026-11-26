module.exports = {
  comando: "s",
  async run(sock, m) {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const msg = quoted?.imageMessage || quoted?.videoMessage || m.message?.imageMessage || m.message?.videoMessage;
    if (!msg) return sock.sendMessage(m.key.remoteJid, { text: "❌ Responde a una foto o video con #s" }, { quoted: m });

    try {
      const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
      const type = quoted?.imageMessage ? "image" : quoted?.videoMessage ? "video" : m.message?.imageMessage ? "image" : "video";
      const stream = await downloadContentFromMessage(msg, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      await sock.sendMessage(m.key.remoteJid, { sticker: buffer }, { quoted: m });
    } catch (e) {
      console.log(e);
      await sock.sendMessage(m.key.remoteJid, { text: "❌ No pude hacer el sticker." }, { quoted: m });
    }
  }
};
