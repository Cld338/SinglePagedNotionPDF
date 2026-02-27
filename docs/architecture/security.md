# Security & Threat Mitigation

본 시스템은 외부 사용자가 입력한 임의의 URL을 서버 내에서 렌더링하는 특성을 가지므로, 잠재적인 보안 위협에 대한 방어 로직이 적용되어 있습니다.

## 1. SSRF (Server-Side Request Forgery) 방어
Puppeteer 브라우저 인스턴스가 내부망이나 민감한 로컬 파일에 접근하는 것을 원천 차단합니다. (`src/services/pdfService.js`)

- **프로토콜 제한**: `http://` 및 `https://`로 시작하지 않는 모든 요청(`file://`, `ftp://` 등)을 차단하여 로컬 파일 시스템 접근을 막습니다.
- **내부 네트워크 접근 차단**: 정규식을 사용하여 `localhost`, `127.x.x.x`, `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x` 등 사설 IP 대역폭으로의 요청을 즉시 중단(Abort)시킵니다.

## 2. 애플리케이션 계층 보호
- **Rate Limiting**: 무분별한 PDF 변환 요청으로 인한 서버 자원 고갈(DDoS)을 방지하기 위해 `express-rate-limit`을 적용했습니다. (15분당 최대 10회 요청 허용)
- **보안 헤더**: `helmet` 미들웨어를 사용하여 기본적인 HTTP 보안 헤더를 설정합니다.
- **페이로드 제한**: Express Body Parser의 limit을 `50mb`로 제한하여 과도한 크기의 요청 본문을 차단합니다.