# PDF 변환 시 렌더링 완료 검증

Notion 페이지를 PDF로 변환할 때, 단순 네트워크 유휴 상태(`networkidle0`) 대기만으로는 비동기적으로 로드되는 요소(수식, 토글, 코드 블록 등)의 렌더링 완료를 보장할 수 없다. 이를 해결하기 위해 네트워크 대기, 핵심 DOM 요소 로드 확인, 그리고 DOM 변경 안정화 대기를 확인합니다.

최신 웹 크롤링 및 동적 렌더링 검증에 관한 기술 연구에 따르면, JavaScript 기반 렌더링 엔진의 완료 시점을 파악하기 위해 다음 세 가지 지표를 교차 검증하는 방식이 권장된다.

* **Network Level**: 진행 중인 네트워크 요청의 종료.
* **Element Level**: 주요 콘텐츠를 담는 래퍼(Wrapper) 컨테이너의 가시성 획득.
* **DOM Stability Level**: `MutationObserver`를 이용한 DOM 트리의 변경 이벤트 중단 지점 확인.

본 프로젝트의 `PdfService`는 위 연구 방향을 수용하여, 네트워크 대기 후 DOM 트리의 변경이 일정 시간 동안 발생하지 않는 '안정화 상태(Stable State)'를 최종 렌더링 완료 시점으로 간주한다.

렌더링 완료를 검증하기 위해 다음 두 가지 단계를 거친다.

1. **핵심 콘텐츠 래퍼 대기**: 노션 본문의 핵심 DOM(`div.notion-page-content` 등)이 렌더링 트리에 추가될 때까지 명시적으로 대기한다.
2. **DOM 변경 안정화 검증**: `MutationObserver`를 주입하여 1.5초간 추가적인 DOM 삽입이나 속성 변경이 발생하지 않을 경우, 모든 비동기 컴포넌트의 렌더링이 완료된 것으로 판단한다.

## 코드

`src/services/pdfService.js` 내 `generatePdf` 메서드의 페이지 로드 파트에 다음 검증 로직을 적용한다.

```javascript
// 1. 네트워크 유휴 상태 대기
await page.goto(url, { waitUntil: 'networkidle0' });

// 2. 노션 핵심 콘텐츠 래퍼 엘리먼트 렌더링 대기
try {
    await page.waitForSelector('.notion-page-content', { visible: true, timeout: 10000 });
} catch (e) {
    logger.warn('Notion page content selector not found or delayed.');
}

// 3. DOM 안정화 검증 (MutationObserver 활용)
await page.evaluate(() => {
    return new Promise((resolve) => {
        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            // DOM 변경 발생 시 타이머 초기화 (1.5초 대기)
            timeout = setTimeout(() => {
                observer.disconnect();
                resolve();
            }, 1500);
        });
        
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        
        // 초기 타이머 설정
        timeout = setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 1500);

        // 최대 대기 시간 설정 (무한 대기 방지용, 10초)
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 10000);
    });
});

```
