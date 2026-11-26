const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de WhatsApp activo');
  })
  .listen(PORT, () => console.log(`Servidor keep-alive en puerto ${PORT}`));

const PHONE_NUMBER = '528132719482';

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['macOS', 'Chrome', '121.0.0'],
    logger: pino({ level: 'silent' }),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n========================================');
        console.log('  CÓDIGO DE EMPAREJAMIENTO:');
        console.log(`  ${formattedCode}`);
        console.log('========================================\n');
      } catch (err) {
        console.error('Error al pedir el código:', err?.message || err);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada. Código:', statusCode, 'Reconectar:', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log('Sesión cerrada. BORRA ./auth_info y vuelve a desplegar.');
      }
    }
    if (connection === 'open') {
      console.log('✅ Bot conectado correctamente a WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!text) return;
    if (text.trim().toLowerCase() === '.ping') {
      await sock.sendMessage(from, { text: 'pong 🏓' }, { quoted: msg });
    }
  });

  return sock;
}

startBot().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
});
