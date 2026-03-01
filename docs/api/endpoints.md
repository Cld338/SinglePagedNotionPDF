# API Reference

## 1. PDF 변환 요청
새로운 PDF 변환 작업을 대기열에 등록합니다.

- **URL:** `/convert-url`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

### Request Body
| 필드명 | 타입 | 필수 여부 | 기본값 | 설명 |
|---|---|---|---|---|
| `url` | string | 필수 | - | 변환할 대상 노션 페이지 URL |
| `width` | string | 선택 | `1080px` | 생성될 PDF의 가로 픽셀 너비 |
| `includeTitle` | boolean | 선택 | `false` | 노션 페이지 제목 포함 여부 |
| `includeBanner` | boolean | 선택 | `false` | 커버 이미지 및 아이콘 포함 여부 |
| `includeTags` | boolean | 선택 | `false` | 페이지 속성(태그 등) 포함 여부 |

### Success Response (202 Accepted)
```json
{
  "jobId": "1",
  "message": "변환 대기열에 등록되었습니다."
}

## 2. 작업 상태 실시간 수신 (SSE)
Server-Sent Events(SSE)를 통해 등록된 변환 작업의 진행 상태를 실시간으로 스트리밍받습니다.

- **URL:** `/job-events/:id`
- **Method:** `GET`
- **Headers:** `Accept: text/event-stream`

### URL Parameters
- `id`: `/convert-url`에서 발급받은 `jobId`

### Event Stream Response (데이터 구조)
완료 시 (Event Data)

```json
{
  "status": "completed",
  "result": {
    "downloadUrl": "/downloads/notion-1-1700000000000.pdf",
    "fileName": "notion-1-1700000000000.pdf"
  }
}

진행 중 시 (Event Data)
```json
{
  "status": "active" // 또는 "waiting"
}
```


## 3. PDF 파일 다운로드
변환이 완료된 PDF 파일의 다운로드를 강제(Content-Disposition: attachment)합니다.

- **URL:** `/api/downloads/:fileName`
- **Method:** `GET`

### URL Parameters
| 파라미터명 | 타입 | 필수 여부 | 설명 |
|---|---|---|---|
| `fileName` | string | 필수 | 다운로드할 대상 PDF 파일명 |

### Success Response (200 OK)
- **응답 본문:** 파일 스트림 (File Stream)
- **응답 헤더:** `Content-Disposition: attachment; filename="{fileName}"`