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

                    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
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

                page.setDefaultNavigationTimeout(120000);
                page.setDefaultTimeout(120000);

                const { width = '1080px', includeBanner, includeTitle, includeTags } = options;

                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await page.setViewport({ width: parseInt(width), height: 100 });

                await page.goto(url, { waitUntil: 'networkidle0' });

                // [추가] 1. 노션 핵심 콘텐츠 래퍼 엘리먼트 렌더링 대기
                try {
                    await page.waitForSelector('.notion-page-content', { visible: true, timeout: 10000 });
                } catch (e) {
                    logger.warn('Notion page content selector not found or delayed.');
                }

                // [추가] 2. DOM 안정화 검증 (MutationObserver 활용)
                // 비동기 컴포넌트(수식, 임베드 등)가 모두 렌더링될 때까지 대기
                await page.evaluate(() => {
                    return new Promise((resolve) => {
                        let timeout;
                        // DOM 변경을 감지하는 옵저버 설정
                        const observer = new MutationObserver(() => {
                            clearTimeout(timeout);
                            // DOM 변경이 발생하면 타이머를 초기화하고 1.5초 대기
                            timeout = setTimeout(() => {
                                observer.disconnect();
                                resolve();
                            }, 1500);
                        });
                        
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                        
                        // 초기 타이머 설정 (변경이 아예 없으면 1.5초 후 즉시 종료)
                        timeout = setTimeout(() => {
                            observer.disconnect();
                            resolve();
                        }, 1500);

                        // 무한 대기 방지를 위한 안전장치 (최대 10초)
                        setTimeout(() => {
                            observer.disconnect();
                            resolve();
                        }, 10000);
                    });
                });

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

                let hideStyles = '';
                
                // 1. 제목 제거 스타일
                if (!includeTitle) {
                    hideStyles += `
                        h1, .notion-page-block:has(h1) { 
                            display: none !important; 
                        }
                    `;
                }

                // 2. 배너 및 아이콘 제거 스타일
                if (!includeBanner) {
                    hideStyles += `
                        .notion-page-cover-wrapper, 
                        .notion-record-icon, 
                        .notion-page-controls { 
                            display: none !important; 
                        }
                    `;
                }

                // 3. 태그/속성 제거 스타일
                if (!includeTags) {
                    hideStyles += `
                        [aria-label="페이지 속성"], 
                        .layout-content-with-divider:has([role="table"]) { 
                            display: none !important; 
                        }
                    `;
                }

                if (hideStyles.trim().length > 0) {
                    await page.addStyleTag({ content: hideStyles });
                }
                await page.evaluate(() => {

                    /** [참고] 노션 본문 내 목차 링크 처리 (기존 로직 유지) */
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
                    // 1. Lazy loading 무효화 (Eager 전환)
                    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                        img.removeAttribute('loading');
                    });

                    // 2. 스크롤을 통한 리소스 로딩 트리거
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
                        }, 50); 
                    });

                    // 3. 렌더링 트리 내 모든 이미지의 네트워크 다운로드 완료 대기
                    const images = Array.from(document.querySelectorAll('img'));
                    await Promise.all(images.map(img => {
                        // 이미 로드되었거나 캐시된 이미지 처리
                        if (img.complete) return Promise.resolve();
                        
                        // 진행 중인 이미지 로드 대기 (에러 발생 시에도 무한 대기 방지)
                        return new Promise((resolve) => {
                            img.addEventListener('load', resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                        });
                    }));

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