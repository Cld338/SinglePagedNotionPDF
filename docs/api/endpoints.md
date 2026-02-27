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

2. 작업 상태 조회 (Polling)
등록된 변환 작업의 현재 상태를 확인합니다.

URL: /job-status/:id

Method: GET

URL Parameters
id: /convert-url에서 발급받은 jobId

### Success Response (완료 시 - 200 OK)

```json
{
  "status": "completed",
  "result": {
    "downloadUrl": "/downloads/notion-1-1700000000000.pdf",
    "fileName": "notion-1-1700000000000.pdf"
  }
}
```

Pending Response (진행 중 - 200 OK)
```json
{
  "status": "active" // 또는 "waiting"
}
```


