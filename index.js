import 'dotenv/config';
import chalk from 'chalk';
import makeWASocket from '@whiskeysockets/baileys';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loadEvents from './events/loader.js';
import { setupBirthdayNotifications } from './utils/birthdayNotifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Crear carpetas automáticamente
const requiredFolders = [
  'src/commands/admin',
  'src/commands/games',
  'src/commands/user',
  'src/events',
  'src/lib',
  'src/utils',
  'data/members',
  'auth'
];

requiredFolders.forEach(folder => {
  const dirPath = path.join(__dirname, folder);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Conexión a MongoDB con reintentos
const connectDB = async () => {
  for (let i = 0; i < 5; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        retryWrites: true,
        maxPoolSize: 10,
        minPoolSize: 2
      });
      console.log(chalk.green('✓ MongoDB conectado'));
      return;
    } catch (err) {
      console.log(chalk.yellow(`↻ Reintento DB (${i+1}/5)`));
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  throw new Error('× Error crítico: MongoDB no disponible');
};

// Configuración Baileys
const initSocket = () => {
  return makeWASocket({
    auth: require('./auth/state.json'),
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: true,
    getMessage: async () => ({}),
    shouldIgnoreJid: jid => jid.endsWith('@broadcast')
  });
};

(async () => {
  try {
    await connectDB();
    const sock = initSocket();
    
    // Cargar eventos y comandos
    loadEvents(sock);
    
    // Configurar notificaciones de cumpleaños
    setupBirthdayNotifications(sock);
    
    // Manejo de reconexión
    sock.ev.on('connection.update', update => {
      if (update.connection === 'close') {
        console.log(chalk.yellow('↻ Reconectando...'));
        initSocket();
      }
    });

    console.log(chalk.green.bold('✅ Bot operativo con comandos ,,'));
    
  } catch (err) {
    console.error(chalk.red(`CRASH: ${err.message}`));
    process.exit(1);
  }
})();