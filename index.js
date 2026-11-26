const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers // ← Usar etiquetas estándar, de lo contrario WhatsApp rechazará el código
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot activo 🔥'));
app.listen(PORT, () => console.log('Servidor en puerto ' + PORT));

// 👇 Número de teléfono: solo dígitos, incluyendo código de país, sin + ni espacios
// El 528132719482 que llenaste antes está en formato correcto, confirma que no falte ningún dígito
const PHONE_NUMBER = process.env.PHONE_NUMBER || "528132719482";

let pairingRequested = false; // Prevenir solicitudes repetidas

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  let version;
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
  } catch {
    version = [2, 3000, 1023223821];
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'), // ✅ Forzar uso de etiqueta estándar
    syncFullHistory: false,
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ✅ Solicitar código cuando aparezca qr y no esté registrado (más confiable que setTimeout)
    if (qr && !state.creds.registered && !pairingRequested) {
      pairingRequested = true;
      try {
        await new Promise(r => setTimeout(r, 1500)); // Esperar un momento a que el socket esté estable
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log('=================================');
        console.log('TU CÓDIGO DE VINCULACIÓN: ' + code);
        console.log('=================================');
        console.log('Ve a WhatsApp > Dispositivos vinculados > Vincular con número de teléfono');
        console.log('Ingresa este código de 8 dígitos, válido por aproximadamente 2 minutos');
      } catch (e) {
        pairingRequested = false;
        console.log('Error al solicitar código:', e.message);
      }
    }

    if (connection === 'open') {
      console.log('BOT CONECTADO 🔥🔥🔥');
      pairingRequested = false; // Resetear después de conexión exitosa
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      // 515 (restart required) es normal después de vinculación exitosa, debes reconectar
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
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const from = msg.key.remoteJid;

      if (text.toLowerCase().trim() === '!sa') {
        try {
          const { sa } = require('./Comandos/sa.js');
          await sa(sock, from);
        } catch (err) {
          console.log('Comando !sa falló:', err.message);
        }
      }
    } catch (e) {
      console.log('Error procesando mensaje:', e.message);
    }
  });
}

startBot();
