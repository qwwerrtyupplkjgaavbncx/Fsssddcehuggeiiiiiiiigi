const fs = require('fs-extra');
const path = require('path');

const SESSIONS_DIR = './sessions';
const CODE_LIST = new Map(); // Map of number -> code to validate pairing

// For demo: Pre-fill valid codes here or generate dynamically in your pair site.
// Example:
// CODE_LIST.set('94771234567', '123456');

async function handlePairingMessage(text, sender, baseSock, activeSessions, maxUsers) {
  // Expect text format: /link <number>-<6digitcode>
  try {
    const parts = text.trim().split(' ');
    if (parts.length < 2) return;

    const [number, code] = parts[1].split('-');
    if (!number || !code) {
      await baseSock.sendMessage(sender, { text: 'Invalid format. Use /link <number>-<6digitcode>' });
      return;
    }

    // Validate code for number (must match stored code)
    const validCode = CODE_LIST.get(number);
    if (validCode !== code) {
      await baseSock.sendMessage(sender, { text: 'Invalid pairing code.' });
      return;
    }

    // Check max users
    if (activeSessions.size >= maxUsers) {
      await baseSock.sendMessage(sender, { text: 'Max connected users reached.' });
      return;
    }

    // Check if already connected
    if (activeSessions.has(sender)) {
      await baseSock.sendMessage(sender, { text: 'Already connected.' });
      return;
    }

    // Save session file placeholder (simulate session creation)
    const sessionPath = path.join(SESSIONS_DIR, `${number}.json`);
    if (!fs.existsSync(sessionPath)) {
      fs.writeFileSync(sessionPath, JSON.stringify({ connected: true }));
    }

    // Add to activeSessions (simulate socket instance)
    activeSessions.set(sender, baseSock);

    await baseSock.sendMessage(sender, { text: `Successfully paired with code ${code}. Bot activated!` });

  } catch (e) {
    console.error(e);
  }
}

module.exports = { handlePairingMessage, CODE_LIST };
