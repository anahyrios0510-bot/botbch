// index.js - Bot de WhatsApp con Baileys para Railway
// Vinculación por CÓDIGO DE EMPAREJAMIENTO (sin QR)
// Número: 528132719482
// Auth: ./auth_info con useMultiFileAuthState
// Navegador: macOS / Chrome (WhatsApp rechaza Ubuntu / Chrome 20.0.04)

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

// --- Mantener vivo el servicio en Railway ---
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de WhatsApp activo');
  })
  .listen(PORT, () => console.log(`Servidor keep-alive en puerto ${PORT}`));

// --- Tu número para el código de emparejamiento ---
// Sin +, sin espacios. 52 = México
const PHONE_NUMBER = '528132719482';

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // No QR, solo código
    // ESTE ES EL CAMBIO CLAVE:
    // Antes: ["Ubuntu", "Chrome", "20.0.04"] -> WhatsApp lo rechaza
    // Ahora: macOS + Chrome actual
    browser: ['macOS', 'Chrome', '121.0.0'],
    logger: pino({ level: 'silent' }),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  // --- Código de emparejamiento ---
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n========================================');
        console.log(' CÓDIGO DE EMPAREJAMIENTO:');
        console.log(` ${formattedCode}`);
        console.log('========================================');
        console.log('En tu WhatsApp ve a:');
        console.log('Ajustes > Dispositivos vinculados > Vincular un dispositivo');
        console.log('> Vincular con el número de teléfono');
        console.log('Escribe el código. Tienes pocos segundos, escríbelo rápido.');
        console.log('========================================\n');
      } catch (err) {
        console.error('Error al pedir el código de emparejamiento:', err?.message || err);
        console.log('Reintenta reiniciando el bot en Railway.');
      }
    }, 3000);
  }

  // --- Conexión / Reconexión ---
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('Conexión cerrada. Código:', statusCode, 'Reconectar:', shouldReconnect);

      if (shouldReconnect) {
        startBot();
      } else {
        console.log('Sesión cerrada (loggedOut).');
        console.log('BORRA la carpeta ./auth_info en Railway/GitHub y vuelve a desplegar para generar un código nuevo.');
      }
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado correctamente a WhatsApp');
    }
  });

  // --- Mensajes (aquí van tus comandos del System Bot) ---
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text) return;

    console.log(`Mensaje de ${from}: ${text}`);

    if (text.trim().toLowerCase() === '.ping') {
      await sock.sendMessage(from, { text: 'pong 🏓' }, { quoted: msg });
    }

    // PEGA AQUÍ TUS COMANDOS DEL SYSTEM BOT VIEJO
    // if (text === '.menu') { ... }
  });

  return sock;
}

startBot().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
});
