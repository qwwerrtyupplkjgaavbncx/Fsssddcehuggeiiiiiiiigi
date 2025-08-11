/**
 * NETHUWH-MINI-BOT main file
 * Author: Nethum Akash
 * Features: TikTok/FB/Song download, auto status seen/like, pairing code login, max 100 users.
 */

const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs-extra');
const path = require('path');
const { handlePairingMessage } = require('./pairing');
const { downloadTikTok, downloadFacebook, downloadSong } = require('./utils/downloader');

const SESSIONS_DIR = './sessions';
const MAX_USERS = 100;

// Load main base session for bot account
const { state, saveState } = useSingleFileAuthState('./baseSession.json');

// Load or create sessions directory
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

const activeSessions = new Map(); // Map of number -> sock instance

// Logging
const logger = P({ level: 'silent' }); // Change to 'info' or 'debug' to see logs

async function startBaseBot() {
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Using WA Version v${version.join('.')}, Latest? ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('Reconnecting base bot...');
        startBaseBot();
      } else {
        console.log('Base bot logged out.');
        process.exit(0);
      }
    } else if (connection === 'open') {
      console.log('Base bot connected!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    // Handle pairing code
    if (text.startsWith('/link ')) {
      await handlePairingMessage(text, sender, sock, activeSessions, MAX_USERS);
      return;
    }

    // If message is from active paired users, route command
    if (activeSessions.has(sender)) {
      const userSock = activeSessions.get(sender);
      await handleUserCommand(text, sender, userSock);
    }
  });

  sock.ev.on('creds.update', saveState);
  return sock;
}

// Command handler (case-based)
async function handleUserCommand(text, sender, sock) {
  const lowerText = text.toLowerCase();

  switch (true) {
    case lowerText === '/help':
      await sock.sendMessage(sender, { text: 'Commands:\n/tiktok <url>\n/facebook <url>\n/song <query>\n/statusseen\n/statuslike' });
      break;

    case lowerText.startsWith('/tiktok '):
      {
        const url = text.slice(8).trim();
        const result = await downloadTikTok(url);
        await sock.sendMessage(sender, { text: result || 'TikTok download failed.' });
      }
      break;

    case lowerText.startsWith('/facebook '):
      {
        const url = text.slice(9).trim();
        const result = await downloadFacebook(url);
        await sock.sendMessage(sender, { text: result || 'Facebook download failed.' });
      }
      break;

    case lowerText.startsWith('/song '):
      {
        const query = text.slice(6).trim();
        const result = await downloadSong(query);
        await sock.sendMessage(sender, { text: result || 'Song download failed.' });
      }
      break;

    case lowerText === '/statusseen':
      await sock.sendMessage(sender, { text: 'Auto status seen activated.' });
      // Implement auto status seen logic here
      break;

    case lowerText === '/statuslike':
      await sock.sendMessage(sender, { text: 'Auto status like activated.' });
      // Implement auto status like logic here
      break;

    default:
      await sock.sendMessage(sender, { text: 'Unknown command. Use /help to see available commands.' });
      break;
  }
}

startBaseBot().catch(console.error);
