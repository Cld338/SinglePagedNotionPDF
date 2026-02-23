const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class PdfService {
    constructor() {
        this.browser = null;
        this.MAX_CONCURRENCY = 2; // 윈도우 안정성을 위해 2로 설정
        this.activeRequests = 0;
        this.queue = [];
    }

    async init() {
        if (this.browser) return;

        try {
            logger.info('Launching Browser...');
            this.browser = await puppeteer.launch({
                headless: true, // 'new' 대신 true 사용 (최신 버전 권장)
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--font-render-hinting=none',
                    '--disable-extensions'
                ],
                // 타임아웃 설정 제거 (무제한 대기) 또는 넉넉하게 설정
                timeout: 0
            });

            this.browser.on('disconnected', () => {
                logger.warn('Browser disconnected. Reconnecting...');
                this.browser = null;
                this.init();
            });

            logger.info('Browser launched successfully.');
        } catch (e) {
            logger.error(`Failed to launch browser: ${e.message}`);
        }
    }

    async executeTask(taskFn) {
        if (this.activeRequests >= this.MAX_CONCURRENCY) {
            return new Promise((resolve, reject) => {
                this.queue.push({ taskFn, resolve, reject });
            });
        }

        this.activeRequests++;
        try {
            return await taskFn();
        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    }

    processQueue() {
        if (this.queue.length > 0 && this.activeRequests < this.MAX_CONCURRENCY) {
            const { taskFn, resolve, reject } = this.queue.shift();
            this.activeRequests++;
            taskFn().then(resolve).catch(reject).finally(() => {
                this.activeRequests--;
                this.processQueue();
            });
        }
    }

    async generatePdf(url, options) {
        if (!this.browser) await this.init();

        return this.executeTask(async () => {
            let page = null;
            try {
                if (!this.browser || !this.browser.isConnected()) {
                    await this.init();
                }

                page = await this.browser.newPage();

                // [보안 패치] 요청 가로채기 활성화
                await page.setRequestInterception(true);

                page.on('request', request => {
                    const url = request.url();

                    // 1. 위험한 프로토콜 차단 (file:// 등)
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        logger.warn(`Blocked unsafe protocol: ${url}`);
                        return request.abort();
                    }

                    // 2. 로컬 호스트 및 사설 IP 대역 차단 (SSRF 방지)
                    const isLocal = /^(http|https):\/\/(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|::1)/.test(url);

                    if (isLocal) {
                        logger.warn(`Blocked local network access: ${url}`);
                        return request.abort();
                    }

                    request.continue();
                });

                // [중요] PDF 생성 타임아웃을 늘립니다. (기본 30초 -> 2분)
                page.setDefaultNavigationTimeout(120000);
                page.setDefaultTimeout(120000);

                const { width = '1080px', includeBanner, includeTitle, includeTags } = options;

                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await page.setViewport({ width: parseInt(width), height: 100 });

                await page.goto(url, { waitUntil: 'networkidle0' });

                // ----------------------------------------------------------------
                // [추가 1] CSS 강제 주입 (가장 확실한 안전장치)
                // ----------------------------------------------------------------
                await page.addStyleTag({
                    content: `
                        .notion-code-block, .notion-code-block span {
                            white-space: pre-wrap !important;
                            font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
                        }
                    `
                });

                await page.evaluate((opts) => {
                    const { includeBanner, includeTitle, includeTags } = opts;
                    // if (!includeBanner) document.querySelector('html > body > div > div > div > div:nth-of-type(1) > div > div:nth-of-type(2) > main > div > div > div:nth-of-type(3) > div > div:nth-of-type(2) > div > div > div > div > div > img')?.remove();
                    
                    // if (!includeTitle) document.querySelector('html > body > div > div > div > div:nth-of-type(1) > div > div:nth-of-type(2) > main > div > div > div:nth-of-type(3) > div > div:nth-of-type(3) > div > div > div:nth-of-type(2) > div > div:nth-of-type(1) > h1').remove();
                    

                    // if (!includeTags) document.querySelector('.properties')?.remove();

                    document.querySelectorAll('div.notion-selectable.notion-table_of_contents-block a').forEach(link => {
                        const href = link.getAttribute('href');
                        if (href && href.includes('#')) {
                            link.setAttribute('href', href.substring(href.indexOf('#')));
                            link.removeAttribute('role');
                        }
                    });

                    // ----------------------------------------------------------------
                    // [수정] 기존 로직에 공백 치환 코드 추가
                    // ----------------------------------------------------------------
                    const spans = document.querySelectorAll('span[data-token-index="0"]');
                    spans.forEach(span => {
                        let text = span.textContent;

                        // [추가 2] 일반 공백(Space)을 줄바꿈 없는 공백(\u00A0)으로 강제 변환
                        // 브라우저가 공백을 하나로 합치는 것을 원천 차단합니다.
                        if (text.includes(" ")) text = text.replace(/ /g, '\u00A0');

                        // 탭 처리
                        if (text.includes("\t")) text = text.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');

                        // 기존 줄바꿈 처리 로직 유지
                        if (text.includes("\n")) {
                            const lines = text.split("\n");
                            span.textContent = lines[0]; // 위에서 이미 변환된 text(NBSP포함)를 사용
                            let currentSpan = span;
                            lines.slice(1).forEach(line => {
                                const br = document.createElement("br");
                                currentSpan.after(br);
                                const newSpan = span.cloneNode(false);
                                newSpan.textContent = line; // 여기도 NBSP가 적용된 line이 들어갑니다.
                                br.after(newSpan);
                                currentSpan = newSpan;
                            });
                        } else {
                            span.textContent = text;
                        }
                    });
                }, { includeBanner, includeTitle, includeTags });

                // 이미지 로딩 확실히 대기
                await page.evaluate(async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 100;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 50); // 스크롤 속도 조절
                    });
                    // 맨 위로 복귀
                    window.scrollTo(0, 0);
                });

                const bodyHeight = await page.evaluate(() => {
                    const target = document.querySelector('#main > div > div > div.whenContentEditable > div');
                    return target ? target.getBoundingClientRect().height : document.body.scrollHeight;
                });

                await page.setViewport({ width: parseInt(width), height: Math.ceil(bodyHeight) + 100 });

                // [핵심 수정] PDF 생성
                const uint8ArrayBuffer = await page.pdf({
                    width: width,
                    height: `${Math.ceil(bodyHeight) + 100}px`,
                    printBackground: true,
                    displayHeaderFooter: false,
                    margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
                    pageRanges: '1',
                    tagged: true,
                    outline: true,
                });

                // Uint8Array를 Node.js Buffer로 확실하게 변환
                return Buffer.from(uint8ArrayBuffer);

            } catch (error) {
                logger.error(`PDF Generation failed: ${error.message}`);
                throw error;
            } finally {
                if (page) await page.close();
            }
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = new PdfService();