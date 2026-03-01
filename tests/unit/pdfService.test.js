const pdfService = require('../../src/services/pdfService');

describe('PdfService 동시성 제어 및 큐(Queue) 단위 테스트', () => {
    beforeEach(() => {
        // 각 테스트 전 상태 초기화
        pdfService.activeRequests = 0;
        pdfService.queue = [];
    });

    test('최대 동시성(MAX_CONCURRENCY) 제한 내에서는 작업이 즉시 실행되어야 한다', async () => {
        const mockTask = jest.fn().mockResolvedValue('success');
        const result = await pdfService.executeTask(mockTask);

        expect(result).toBe('success');
        expect(mockTask).toHaveBeenCalledTimes(1);
        expect(pdfService.activeRequests).toBe(0); // 작업 완료 후 감소 검증
    });

    test('최대 동시성을 초과하는 작업 요청은 큐(Queue)에 대기해야 한다', async () => {
        // MAX_CONCURRENCY가 2이므로, 고의로 지연되는 작업 2개를 먼저 실행
        let resolveTask1, resolveTask2;
        const task1 = jest.fn().mockImplementation(() => new Promise(r => resolveTask1 = r));
        const task2 = jest.fn().mockImplementation(() => new Promise(r => resolveTask2 = r));
        
        // task3는 실행 즉시 완료되는 작업으로 모킹
        const task3 = jest.fn().mockResolvedValue('task3 complete');

        pdfService.executeTask(task1);
        pdfService.executeTask(task2);

        expect(pdfService.activeRequests).toBe(2);
        expect(pdfService.queue.length).toBe(0);

        // 3번째 작업 요청 (큐에 적재 확인)
        const promise3 = pdfService.executeTask(task3);

        expect(pdfService.activeRequests).toBe(2);
        expect(pdfService.queue.length).toBe(1);
        expect(task3).not.toHaveBeenCalled();

        // 첫 번째 작업 완료 처리
        resolveTask1('task1 complete');
        
        // 비동기 작업(마이크로태스크 큐) 처리를 위해 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 0));

        // [수정된 부분] 
        // 큐에 있던 task3가 꺼내져 실행되었고 즉시 완료되었으므로,
        // 현재 실행 중인 작업은 task2 1개만 남아있어야 합니다.
        expect(pdfService.activeRequests).toBe(1);
        expect(pdfService.queue.length).toBe(0);
        expect(task3).toHaveBeenCalledTimes(1);
    });
});