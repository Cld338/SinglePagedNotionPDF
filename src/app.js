const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const Joi = require('joi');
const path = require('path');
const { URL } = require('url');
require('dotenv').config();

const pdfService = require('./services/pdfService');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
// PDF는 용량이 클 수 있으므로 제한을 50mb로 늘립니다.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// 서버 시작 시 브라우저 초기화
(async () => { await pdfService.init(); })();

const convertSchema = Joi.object({
    url: Joi.string().uri().required(),
    width: Joi.string().pattern(/^\d+px$/).default('1080px'),
    includeBanner: Joi.boolean().default(false),
    includeTitle: Joi.boolean().default(false),
    includeTags: Joi.boolean().default(false)
});

app.post('/convert-url', async (req, res) => {
    try {
        const rawBody = { ...req.body };
        ['includeBanner', 'includeTitle', 'includeTags'].forEach(key => {
            if (typeof rawBody[key] === 'string') {
                rawBody[key] = rawBody[key].toLowerCase() === 'true';
            }
        });

        const { error, value } = convertSchema.validate(rawBody);

        if (error) {
            logger.warn(`Validation Error: ${error.details[0].message}`);
            return res.status(400).json({ error: error.details[0].message });
        }

        const { url: targetUrl, width, includeBanner, includeTitle, includeTags } = value;

        logger.info(`Processing URL: ${targetUrl}`);

        // PDF 생성
        const pdfBuffer = await pdfService.generatePdf(targetUrl, {
            width, includeBanner, includeTitle, includeTags
        });

        // [중요] 생성된 데이터 검증 로직
        if (!pdfBuffer || pdfBuffer.length < 1000) {
            logger.error('Generated PDF is too small or empty.');
            return res.status(500).json({ error: 'PDF Generation failed (Empty file)' });
        }

        logger.info(`PDF Generated Successfully! Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        let filename = 'document.pdf';
        try {
            const parsedUrl = new URL(targetUrl);
            filename = `${parsedUrl.hostname.replace(/\./g, '_')}.pdf`;
        } catch (e) { }

        // 헤더 설정 강화
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.send(pdfBuffer);
        logger.info(`Sent PDF to client.`);

    } catch (err) {
        logger.error(`Failed to process request: ${err.message}`);
        // 에러 발생 시 JSON으로 명확히 응답
        if (!res.headersSent) {
            res.status(500).json({ error: `Internal Server Error: ${err.message}` });
        }
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully...');
    server.close(() => logger.info('Closed HTTP server.'));
    await pdfService.close();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;