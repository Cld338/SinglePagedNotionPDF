# Architecture Overview

## 1. 시스템 목적
SinglePagedNotionPDF는 사용자의 대기 시간을 최소화하고 서버의 메모리/CPU 부하를 관리하기 위해 비동기 백그라운드 처리 구조를 가집니다.

## 2. 핵심 컴포넌트 구성

1. **API Server (`src/app.js`)**
   - 클라이언트의 PDF 변환 요청(HTTP POST)을 수신하고 유효성을 검증합니다.
   - 변환 작업을 직접 수행하지 않고 Redis 큐에 작업을 위임(Enqueue)한 뒤, `jobId`를 즉시 반환하여 HTTP 응답 지연을 방지합니다.
   
2. **Redis & BullMQ**
   - 시스템의 메시지 브로커 역할을 수행합니다.
   - `pdf-conversion` 큐를 통해 대기열을 관리하고 작업 상태(완료, 실패 등)를 추적합니다.

3. **PDF Worker (`src/worker.js`)**
   - 백그라운드에서 실행되는 독립적인 프로세스입니다.
   - Redis 큐에서 작업을 가져와(Dequeue) `pdfService.js`를 통해 Puppeteer를 제어하고 실제 PDF를 생성합니다.
   - 환경 변수(`WORKER_CONCURRENCY`)를 통해 동시에 처리할 수 있는 브라우저 인스턴스의 수를 제한하여 서버 안정성을 유지합니다.

## 3. 데이터 및 제어 흐름
1. **[Client]** 웹 UI에서 변환할 URL과 옵션을 선택하여 전송.
2. **[API Server]** 요청을 파싱하여 BullMQ에 Job 추가 후 클라이언트에게 `jobId` 반환 (202 Accepted).
3. **[Client]** 3초 간격으로 `jobId`의 상태를 폴링(Polling) 요청.
4. **[Worker]** 큐에서 Job을 획득하여 Puppeteer로 노션 페이지 접속 및 PDF 렌더링 수행.
5. **[Worker]** 생성된 PDF 버퍼를 로컬 디렉토리(`/public/downloads`)에 저장 후 Job 상태를 'completed'로 업데이트.
6. **[Client]** 폴링 결과가 'completed'일 경우, 반환된 다운로드 URL을 통해 파일 다운로드 트리거.