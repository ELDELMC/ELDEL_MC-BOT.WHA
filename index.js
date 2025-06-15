require('dotenv').config();
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

// ==================== CONFIGURACIÓN INICIAL ====================
// 1. Crear estructura de carpetas automáticamente
const folders = [
    'src/commands/admin',
    'src/commands/games',
    'src/commands/user',
    'src/events',
    'src/lib',
    'src/utils',
    'data/members',
    'data/group_configs',
    'logs',
    'temp'
];

function createFolders() {
    try {
        folders.forEach(folder => {
            const fullPath = path.join(__dirname, folder);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(chalk.green(`✅ Carpeta creada: ${fullPath}`));
            }
        });
    } catch (err) {
        console.error(chalk.red(`❌ Error creando carpetas: ${err.message}`));
        process.exit(1);
    }
}

createFolders();

// 2. Conexión a MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot', {
            serverSelectionTimeoutMS: 5000
        });
        console.log(chalk.cyan('✅ Conectado a MongoDB'));
    } catch (err) {
        console.error(chalk.red(`❌ Error de MongoDB: ${err.message}`));
        process.exit(1);
    }
}

// 3. Iniciar Bot de WhatsApp
async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['MinecraftBot', 'Chrome', '1.0'],
            markOnlineOnConnect: false
        });

        // Manejadores de eventos
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            if (update.connection === 'open') {
                console.log(chalk.green('🤖 Bot conectado a WhatsApp'));
            }
            if (update.connection === 'close') {
                console.log(chalk.yellow('🔴 Conexión perdida, reconectando...'));
                setTimeout(startBot, 5000);
            }
        });

        // Ejemplo básico: Manejar mensajes
        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const msg = messages[0];
                if (!msg.message || !msg.key.remoteJid.endsWith('@g.us')) return;

                const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                const [command, ...args] = body.trim().split(' ');
                const from = msg.key.remoteJid;

                // Comando !ping de prueba
                if (command === '!ping') {
                    await sock.sendMessage(from, { text: '🏓 Pong!' });
                }
                // Aquí cargarías comandos desde src/commands/
            } catch (err) {
                console.error(chalk.red(`❌ Error en mensaje: ${err.message}`));
            }
        });

    } catch (err) {
        console.error(chalk.red(`❌ Error al iniciar bot: ${err.message}`));
        setTimeout(startBot, 10000);
    }
}

// ==================== INICIAR TODO ====================
(async () => {
    await connectDB();
    await startBot();
})();

// Manejo de cierre limpio
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🔴 Apagando bot...'));
    process.exit();
});
