const express = require('express');
const Joi = require('joi');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { pdfQueue } = require('../config/queue');
const logger = require('../utils/logger');

const router = express.Router();

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

router.post('/convert-url', convertLimiter, async (req, res) => {
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
            attempts: 3, // 최대 3회 재시도
            backoff: {
                type: 'exponential', // 지수 백오프 전략 (1초, 2초, 4초 대기 후 재시도)
                delay: 1000
            },
            removeOnComplete: 100, // 성공한 작업은 최근 100개만 유지
            removeOnFail: 500      // 실패한 작업(DLQ)은 분석을 위해 500개까지 보관
        });
        
        logger.info(`Job ${job.id} added to queue for URL: ${value.url}`);
        res.status(202).json({ jobId: job.id, message: '변환 대기열에 등록되었습니다.' });

    } catch (err) {
        logger.error(`Failed to enqueue job: ${err.message}`);
        res.status(500).json({ error: '서버 내부 오류로 대기열 등록에 실패했습니다.' });
    }
});

router.get('/job-events/:id', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const jobId = req.params.id;

    const intervalId = setInterval(async () => {
        try {
            const job = await pdfQueue.getJob(jobId);
            
            if (!job) {
                res.write(`data: ${JSON.stringify({ status: 'error', error: '작업을 찾을 수 없습니다.' })}\n\n`);
                clearInterval(intervalId);
                return res.end();
            }

            const state = await job.getState();
            
            if (state === 'completed') {
                const result = job.returnvalue; 
                res.write(`data: ${JSON.stringify({ status: 'completed', result })}\n\n`);
                clearInterval(intervalId);
                res.end();
            } else if (state === 'failed') {
                res.write(`data: ${JSON.stringify({ status: 'failed', error: job.failedReason })}\n\n`);
                clearInterval(intervalId);
                res.end();
            } else {
                res.write(`data: ${JSON.stringify({ status: state })}\n\n`);
            }
        } catch (err) {
            res.write(`data: ${JSON.stringify({ status: 'error', error: '상태 조회 중 오류 발생' })}\n\n`);
            clearInterval(intervalId);
            res.end();
        }
    }, 2000);

    req.on('close', () => clearInterval(intervalId));
});

router.get('/download/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(__dirname, '../../public/downloads', fileName);

    if (!/^[a-zA-Z0-9\-\.]+\.pdf$/.test(fileName)) {
        return res.status(400).json({ error: '잘못된 파일 형식입니다.' });
    }

    res.download(filePath, fileName, (err) => {
        if (err) {
            if (res.headersSent) return;
            res.status(404).json({ error: '파일을 찾을 수 없거나 이미 삭제되었습니다.' });
        }
    });
});

module.exports = router;