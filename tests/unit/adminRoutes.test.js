const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../src/routes/admin');

describe('Admin Routes', () => {
    let app;

    beforeAll(() => {
        process.env.ADMIN_USERNAME = 'testadmin';
        process.env.ADMIN_PASSWORD = 'testpassword';
        process.env.BULL_BOARD_PATH = '/admin/queues';

        app = express();
        app.use(process.env.BULL_BOARD_PATH, adminRoutes);
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