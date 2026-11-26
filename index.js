const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot activo 🔥'));
app.listen(PORT, () => console.log('Servidor en puerto ' + PORT));

// 👇 AQUÍ PON TU NÚMERO CON LADA, SIN + NI ESPACIOS
const PHONE_NUMBER = process.env.PHONE_NUMBER || "528132719482";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    // Si no está registrado, pide código
    if (!state.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('---------------------------------');
                console.log('TU CÓDIGO ES: ' + code);
                console.log('---------------------------------');
                console.log('Mételo en WhatsApp > Dispositivos vinculados > Vincular con número');
            } catch (e) {
                console.log('Error al pedir código:', e.message);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada, reconectando...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('BOT CONECTADO 🔥🔥🔥');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;

            if (text.toLowerCase().trim() === '!sa') {
                const { sa } = require('./Comandos/sa.js');
                await sa(sock, from);
            }
        } catch (e) {
            console.log('Error mensaje:', e.message);
        }
    });
}

startBot();
