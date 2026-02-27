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
        return `/downloads/${fileName}`; // 클라이언트 접근용 상대 경로
    }
}

// 향후 S3 도입 시 S3StorageProvider를 추가하여 쉽게 교체 가능
module.exports = new LocalStorageProvider(path.join(__dirname, '../../public/downloads'));