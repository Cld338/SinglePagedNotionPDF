const { Queue } = require('bullmq');
const IORedis = require('ioredis');
require('dotenv').config();

const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
});

const pdfQueue = new Queue('pdf-conversion', { connection });

module.exports = { pdfQueue, connection };