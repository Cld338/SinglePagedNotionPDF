const fs = require('fs'); // createWriteStream 사용을 위해 일반 fs 모듈 사용
const path = require('path');
const { pipeline } = require('stream/promises'); // pipeline 임포트 추가
const logger = require('./logger');

class StorageProvider {
    async save(fileName, buffer) {
        throw new Error('save() must be implemented');
    }
}

class LocalStorageProvider extends StorageProvider {
    constructor(baseDir) {
        super();
        this.baseDir = baseDir; // 생성자에서 baseDir 사용
    }

    async saveStream(fileName, pdfStream) {
        // this.basePath를 this.baseDir로 수정
        const filePath = path.join(this.baseDir, fileName); 
        const writeStream = fs.createWriteStream(filePath);

        try {
            // stream/promises의 pipeline을 사용하여 안전하게 파이핑 및 에러 처리
            await pipeline(pdfStream, writeStream);
            return `/downloads/${fileName}`;
        } catch (err) {
            logger.error(`Failed to save PDF stream: ${err.message}`);
            throw err;
        }
    }
}

// export 시 경로 설정 확인
module.exports = new LocalStorageProvider(path.join(__dirname, '../../public/downloads'));