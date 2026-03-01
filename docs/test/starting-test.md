# 테스트 가이드 (Testing Guide)

본 프로젝트는 시스템의 안정성을 보장하기 위해 **Jest**와 **Supertest**를 활용한 자동화 테스트를 수행합니다.

## 1. 테스트 환경 설정
테스트를 실행하기 위해 필요한 개발 의존성을 설치해야 합니다.
\`\`\`bash
npm install
\`\`\`

## 2. 단위 테스트 (Unit Test) 실행
비즈니스 로직 및 예외 처리 정책이 올바르게 동작하는지 확인합니다. 특히 외부 브라우저(Puppeteer) 의존성 없이 독립적으로 실행 가능한 서비스 레이어의 상태 관리를 검증합니다.

\`\`\`bash
# 전체 단위 테스트 실행
npm test

# 특정 테스트 파일만 실행 (예: pdfService 동시성 테스트)
npx jest tests/unit/pdfService.test.js
\`\`\`

### 주요 테스트 범위
- `pdfService.UnauthorizedAccess.test.js`: 보안 정책에 따른 URL(file://, localhost 등) 접근 차단 검증
- `pdfService.test.js`: `MAX_CONCURRENCY`를 기반으로 한 작업 큐(Queue) 대기 및 실행 흐름 검증