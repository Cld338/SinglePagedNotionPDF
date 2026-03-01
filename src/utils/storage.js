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

    async saveStream(fileName, pdfStream) {
        const filePath = path.join(this.basePath, fileName);
        const writeStream = fs.createWriteStream(filePath);

        // stream/promises의 pipeline을 사용하여 안전하게 파이핑 및 에러 처리
        await pipeline(pdfStream, writeStream);
        
        return `/downloads/${fileName}`;
    }
}

module.exports = new LocalStorageProvider(path.join(__dirname, '../../public/downloads'));