const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function startCleanupJob() {
    setInterval(() => {
        const downloadsDir = path.join(__dirname, '../../public/downloads');
        fs.readdir(downloadsDir, (err, files) => {
            if (err) return;
            const now = Date.now();
            files.forEach(file => {
                if (file === '.gitkeep') return;
                const filePath = path.join(downloadsDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    if (now - stats.mtimeMs > 60 * 60 * 1000) {
                        fs.unlink(filePath, () => logger.info(`Deleted old file: ${file}`));
                    }
                });
            });
        });
    }, 60 * 60 * 1000);
    logger.info('File cleanup scheduler started.');
}

module.exports = startCleanupJob;