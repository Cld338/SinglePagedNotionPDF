const { Readable } = require('stream');
const puppeteer = require('puppeteer');
const pdfService = require('../../src/services/pdfService');

// Puppeteer 모듈 전체를 mock 처리
jest.mock('puppeteer');

describe('PdfService PDF 생성 단위 테스트 (Mock)', () => {
    let mockPage;
    let mockBrowser;

    beforeEach(() => {
        mockPage = {
            setRequestInterception: jest.fn().mockResolvedValue(),
            on: jest.fn(),
            setDefaultNavigationTimeout: jest.fn(), // 추가
            setDefaultTimeout: jest.fn(),           // 추가
            setUserAgent: jest.fn().mockResolvedValue(),
            setViewport: jest.fn().mockResolvedValue(),
            goto: jest.fn().mockResolvedValue(),
            waitForSelector: jest.fn().mockResolvedValue(),
            evaluate: jest.fn().mockResolvedValue(1000),
            addStyleTag: jest.fn().mockResolvedValue(),
            createPDFStream: jest.fn().mockResolvedValue(new Readable({ read() { this.push(null); } })),
            close: jest.fn().mockResolvedValue(),
        };

        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            isConnected: jest.fn().mockReturnValue(true),
            close: jest.fn(),
            on: jest.fn(),
        };

        puppeteer.launch.mockResolvedValue(mockBrowser);
        pdfService.browser = mockBrowser; // 기존 브라우저 인스턴스 주입
    });

    test('generatePdf는 메모리 누수 방지를 위해 Readable Stream 객체를 반환해야 한다', async () => {
        const result = await pdfService.generatePdf('https://notion.so/test', {});
        
        // 결과물이 스트림(Readable) 인스턴스인지 검증
        expect(result).toBeInstanceOf(Readable);
        expect(mockPage.createPDFStream).toHaveBeenCalled();
    });
});