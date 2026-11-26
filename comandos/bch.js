module.exports = {
  comando: "bch",
  async run(sock, m, args) {
    const texto = m.message?.extendedTextMessage?.text || m.message?.conversation || "";
    const link = texto.split(" ").find(t => t.includes("whatsapp.com/channel/"));
    if (!link) return sock.sendMessage(m.key.remoteJid, { text: "❌ Pásame el link del canal. Ejemplo: #bch https://whatsapp.com/channel/xxxx" }, { quoted: m });

    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return sock.sendMessage(m.key.remoteJid, { text: "❌ Responde a un sticker con audio." }, { quoted: m });

    try {
      const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
      const stickerMsg = quoted.stickerMessage;
      if (!stickerMsg) return sock.sendMessage(m.key.remoteJid, { text: "❌ Eso no es un sticker." }, { quoted: m });

      const stream = await downloadContentFromMessage(stickerMsg, "sticker");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const channelId = link.split("/channel/")[1].split("/")[0].split("?")[0];
      const channelJid = channelId + "@newsletter";

      await sock.sendMessage(channelJid, { sticker: buffer });
      await sock.sendMessage(m.key.remoteJid, { text: "✅ Sticker con audio reenviado al canal." }, { quoted: m });
    } catch (e) {
      console.log(e);
      await sock.sendMessage(m.key.remoteJid, { text: "❌ No pude enviarlo al canal." }, { quoted: m });
    }
  }
};
