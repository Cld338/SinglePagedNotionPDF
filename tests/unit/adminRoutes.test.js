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
        // 3. 테스트 종료 시 Redis 연결을 명시적으로 종료하여 Open Handles 에러를 방지합니다.
        if (queueConfig && queueConfig.connection) {
            await queueConfig.connection.quit();
        }
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