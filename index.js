const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,   // ✅ versión real de WhatsApp Web
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot activo 🔥'));
app.listen(PORT, () => console.log('Servidor en puerto ' + PORT));

// 👇 NÚMERO CON LADA, SIN + NI ESPACIOS (ej: México 52 + 10 dígitos)
const PHONE_NUMBER = process.env.PHONE_NUMBER || "528132719482";

let pairingRequested = false; // evita pedir el código más de una vez

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  // ✅ Versión actual de WhatsApp Web con fallback seguro
  let version;
  try {
    const latest = await fetchLatestWaWebVersion();
    version = latest.version;
  } catch {
    version = [2, 3000, 1042466098];
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'), // ✅ etiqueta estándar (evita rechazo)
    syncFullHistory: false,
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ✅ Pedir código cuando aparezca el QR y no esté registrado
    if (qr && !state.creds.registered && !pairingRequested) {
      pairingRequested = true;
      try {
        await new Promise(r => setTimeout(r, 1500));
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log('=================================');
        console.log('TU CÓDIGO DE VINCULACIÓN: ' + code);
        console.log('=================================');
        console.log('WhatsApp > Dispositivos vinculados > Vincular con número');
        console.log('Ingresa el código de 8 dígitos (válido ~2 min)');
      } catch (e) {
        pairingRequested = false;
        console.log('Error al pedir código:', e.message);
      }
    }

    if (connection === 'open') {
      console.log('BOT CONECTADO 🔥🔥🔥');
      pairingRequested = false;
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada, código:', code, '| reconectar:', shouldReconnect);
      if (shouldReconnect) {
        pairingRequested = false;
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';
      const from = msg.key.remoteJid;

      if (text.toLowerCase().trim() === '!sa') {
        try {
          const { sa } = require('./Comandos/sa.js');
          await sa(sock, from);
        } catch (err) {
          console.log('Comando !sa falló:', err.message);
          await sock.sendMessage(from, { text: '⚠️ El comando !sa no está disponible.' });
        }
      }

      // 👇 aquí puedes agregar tu 2º comando si quieres
    } catch (e) {
      console.log('Error procesando mensaje:', e.message);
    }
  });
}

startBot();
