const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const basicAuth = require('express-basic-auth');
const { pdfQueue } = require('../config/queue');

const adminRouter = express.Router();

const basePath = process.env.BULL_BOARD_PATH || '/admin/queues';
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(basePath);

createBullBoard({
    queues: [new BullMQAdapter(pdfQueue)],
    serverAdapter: serverAdapter,
});

const authMiddleware = basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true,
});

adminRouter.use('/', authMiddleware, serverAdapter.getRouter());

module.exports = adminRouter;