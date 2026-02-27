const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const pdfService = require('./services/pdfService');
const storage = require('./utils/storage');
const logger = require('./utils/logger');

const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

// Worker 인스턴스 생성 및 안정화 설정
const worker = new Worker('pdf-conversion', async (job) => {
    const { targetUrl, options } = job.data;
    logger.info(`[Job ${job.id}] Start processing: ${targetUrl}`);

    try {
        // 1. PDF 생성 (pdfService.js 활용)
        const pdfBuffer = await pdfService.generatePdf(targetUrl, options);

        // 2. 스토리지 추상화 계층을 통한 저장
        const fileName = `notion-${job.id}-${Date.now()}.pdf`;
        const downloadUrl = await storage.save(fileName, pdfBuffer);

        logger.info(`[Job ${job.id}] Successfully completed`);
        return { downloadUrl, fileName };

    } catch (error) {
        logger.error(`[Job ${job.id}] Failed: ${error.message}`);
        // 재시도 정책에 따라 BullMQ가 처리하도록 에러 전파
        throw error;
    }
}, {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'), // 환경변수로 동시성 제어
    lockDuration: 60000, // 60초간 작업 잠금 유지
});

// 프로세스 종료 시 우아한 종료(Graceful Shutdown) 처리
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Closing worker...`);
    await worker.close();
    await connection.quit();
    await pdfService.close(); // 브라우저 종료
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed fundamentally: ${err.message}`);
});