---
layout: home

hero:
  name: SinglePagedNotionPDF
  text: 노션 문서를 한 페이지의 PDF로
  tagline: 끊김 없는 고품질 PDF 변환 및 관리 서비스
  image:
    src: /logo.png
    alt: SinglePagedNotionPDF Logo
  actions:
    - theme: brand
      text: 시작하기
      link: /guides/deployment
    - theme: alt
      text: API 문서 확인
      link: /api/endpoints
    - theme: alt
      text: GitHub
      link: https://github.com/Cld338/SinglePagedNotionPDF

features:
  - title: 📄 단일 페이지 변환
    details: 긴 노션 페이지를 페이지 끊김 없이 매끄러운 한 장의 PDF로 변환합니다.
  - title: ⚙️ 맞춤형 옵션
    details: 노션 헤더(커버/아이콘), 제목, 페이지 속성(태그) 등의 표시 여부를 자유롭게 선택할 수 있습니다.
  - title: 🚀 안정적인 비동기 처리
    details: BullMQ와 Redis 기반의 작업 큐를 사용하여 다중 요청에도 서버의 부하를 관리하고 안정적으로 작업을 수행합니다.
  - title: 🐳 Docker 지원
    details: Docker Compose를 통해 복잡한 설정 없이 즉시 서비스를 실행하고 배포할 수 있습니다.
---

## 구조

### 핵심 구성 요소

- **API Server**: 클라이언트 요청 수신 및 Redis 큐에 작업 할당.
- **Redis & BullMQ**: 작업 대기열 관리 및 상태 추적을 위한 메시지 브로커.
- **PDF Rendering**: Puppeteer를 제어하여 실제 노션 페이지를 렌더링하고 PDF 파일 생성.

### 기술 스택

- **Backend**: Node.js, Express
- **Message Broker**: Redis, BullMQ
- **Rendering**: Puppeteer (Headless Chrome)
- **Testing**: Jest

### 퀵 스타트

```bash
# 1. 저장소 클론
git clone [https://github.com/Cld338/SinglePagedNotionPDF](https://github.com/Cld338/SinglePagedNotionPDF)
cd SinglePagedNotionPDF

# 2. Docker Compose로 실행
docker-compose up -d --build

# 3. 접속
http://localhost:3000