const request = require('supertest');
const express = require('express');

describe('Admin Routes', () => {
    let app;
    let adminRoutes;
    let queueConfig;

    beforeAll(() => {
        // 1. 라우터 모듈을 가져오기 전에 환경 변수를 먼저 설정합니다.
        process.env.ADMIN_USERNAME = 'testadmin';
        process.env.ADMIN_PASSWORD = 'testpassword';
        process.env.BULL_BOARD_PATH = '/admin/queues';

        // 2. 환경 변수 설정 후 라우터와 큐 설정 모듈을 지연 로드(Lazy Load)합니다.
        adminRoutes = require('../../src/routes/admin');
        queueConfig = require('../../src/config/queue');

        app = express();
        app.use(process.env.BULL_BOARD_PATH, adminRoutes);
    });

    afterAll(async () => {
        const { pdfQueue, connection } = require('../../src/config/queue');
        
        // 1. Queue 인스턴스 종료 (중요)
        if (pdfQueue) {
            await pdfQueue.close();
        }
        
        // 2. Redis 연결 종료
        if (connection) {
            await connection.quit();
        }
        
        // 비동기 로그 처리를 위해 아주 짧은 대기 시간을 줍니다.
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('인증 정보 없이 접근 시 401 Unauthorized를 반환해야 한다', async () => {
        const res = await request(app).get('/admin/queues');
        expect(res.statusCode).toBe(401);
    });

    it('올바른 인증 정보로 접근 시 200 OK를 반환해야 한다', async () => {
        const res = await request(app)
            .get('/admin/queues')
            .auth('testadmin', 'testpassword');
        expect(res.statusCode).toBe(200);
    });
});