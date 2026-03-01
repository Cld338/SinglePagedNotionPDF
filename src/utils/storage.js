const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class StorageProvider {
    async save(fileName, buffer) {
        throw new Error('save() must be implemented');
    }
}

class LocalStorageProvider extends StorageProvider {
    constructor(baseDir) {
        super();
        this.baseDir = baseDir;
    }

    async save(fileName, buffer) {
        const filePath = path.join(this.baseDir, fileName);
        await fs.writeFile(filePath, buffer);
        logger.info(`File saved locally: ${fileName}`);
        // 클라이언트 접근용 상대 경로를 전용 API 라우트로 변경
        return `/api/downloads/${fileName}`; 
    }
}

module.exports = new LocalStorageProvider(path.join(__dirname, '../../public/downloads'));