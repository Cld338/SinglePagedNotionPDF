const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const Joi = require('joi');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
require('dotenv').config();

const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// [추가] 프록시 환경(Docker 브릿지, Nginx 등)에서 클라이언트의 실제 IP를 신뢰하도록 설정
app.set('trust proxy', 1);

const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
});
const pdfQueue = new Queue('pdf-conversion', { connection });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.use('/docs', express.static(path.join(__dirname, '../docs/.vitepress/dist')));

const convertLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const convertSchema = Joi.object({
    url: Joi.string().uri().required(),
    width: Joi.string().pattern(/^\d+px$/).default('1080px'),
    includeBanner: Joi.boolean().default(false),
    includeTitle: Joi.boolean().default(false),
    includeTags: Joi.boolean().default(false)
});

// [수정] 작업 큐 등록 엔드포인트
app.post('/convert-url', convertLimiter, async (req, res) => {
    try {
        const rawBody = { ...req.body };
        ['includeBanner', 'includeTitle', 'includeTags'].forEach(key => {
            if (typeof rawBody[key] === 'string') rawBody[key] = rawBody[key].toLowerCase() === 'true';
        });

        const { error, value } = convertSchema.validate(rawBody);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const job = await pdfQueue.add('convert', {
            targetUrl: value.url,
            options: { width: value.width, includeBanner: value.includeBanner, includeTitle: value.includeTitle, includeTags: value.includeTags }
        }, {
            removeOnComplete: 100,
            removeOnFail: 500
        });

        logger.info(`Job ${job.id} added to queue for URL: ${value.url}`);
        res.status(202).json({ jobId: job.id, message: '변환 대기열에 등록되었습니다.' });

    } catch (err) {
        logger.error(`Failed to enqueue job: ${err.message}`);
        res.status(500).json({ error: '서버 내부 오류로 대기열 등록에 실패했습니다.' });
    }
});

// [신규] 상태 확인(Polling) 엔드포인트
app.get('/job-status/:id', async (req, res) => {
    try {
        const job = await pdfQueue.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });

        const state = await job.getState();
        
        if (state === 'completed') {
            return res.json({ status: 'completed', result: job.returnvalue });
        } else if (state === 'failed') {
            return res.status(500).json({ status: 'failed', error: job.failedReason });
        } else {
            return res.json({ status: state }); 
        }
    } catch (err) {
        res.status(500).json({ error: '상태 조회 중 오류가 발생했습니다.' });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// [신규] 파일 정리 스케줄러 (1시간 경과 파일 삭제)
setInterval(() => {
    const fs = require('fs');
    const downloadsDir = path.join(__dirname, '../public/downloads');
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

const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
module.exports = app;