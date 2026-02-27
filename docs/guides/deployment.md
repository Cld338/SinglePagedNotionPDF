# 배포 및 실행 가이드

본 프로젝트는 Docker를 활용하여 외부 의존성(Redis, Puppeteer 구동용 리눅스 라이브러리)을 일관되게 관리합니다.

## 1. 요구 사항
- Docker Engine 20.10+
- Docker Compose v2+

## 2. 환경 변수 (`.env`)
프로젝트 루트 또는 `docker-compose.yml` 환경 변수 섹션에 다음 값을 구성할 수 있습니다.
- `PORT`: API 서버 포트 (기본값: 3000)
- `REDIS_HOST`: Redis 서버 주소 (기본값: redis)
- `REDIS_PORT`: Redis 포트 (기본값: 6379)
- `NODE_ENV`: 실행 환경 (`production` 또는 `development`)
- `WORKER_CONCURRENCY`: Worker가 동시에 처리할 브라우저 탭 수 (기본값: 2)

## 3. 컨테이너 구성 (`docker-compose.yml`)
시스템은 3개의 컨테이너로 오케스트레이션 됩니다.
1. **fastapi-app**: Express 기반의 API 서버 컨테이너.
2. **pdf-worker**: 백그라운드 PDF 생성 워커 컨테이너.
3. **redis**: 큐 데이터를 저장하는 Redis 컨테이너.

> **주의 사항 (볼륨 마운트)**
> `fastapi-app`과 `pdf-worker`는 결과물을 공유해야 합니다. 따라서 Host의 `./public/downloads` 디렉토리가 두 컨테이너의 `/usr/src/public/downloads`에 공통으로 마운트되어 있습니다. Host 머신에서 해당 폴더의 쓰기 권한이 올바르게 설정되어 있는지 확인해야 합니다.

## 4. 자동 파일 정리
API 서버 내부에는 1시간(60 * 60 * 1000 ms)이 경과한 `/public/downloads` 내의 PDF 파일을 자동으로 삭제하는 스케줄러가 내장되어 있어 스토리지 고갈을 방지합니다.