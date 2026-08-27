# RS-test2

RaibitServer의 전체 배포 경로와 관리형 PostgreSQL 쓰기·조회 기능을 실제로 검증하는 앱입니다.

## 기능

- `GET /healthz/live`: 앱 프로세스 확인
- `GET /healthz/ready`: PostgreSQL 연결과 스키마 확인
- `POST /api/writes`: PostgreSQL에 메시지 INSERT
- `GET /api/writes`: 저장된 메시지 재조회
- `GET /api/info`: 배포 커밋, Pod, DB 레코드 수 확인

RaibitServer에서 PostgreSQL 리소스를 서비스에 연결하면 주입되는 `DATABASE_URL`을 사용합니다. SQL 값은 모두 파라미터 바인딩하며 연결 문자열은 응답이나 로그에 출력하지 않습니다.

```bash
npm ci
npm test
docker build -t rs-test2:local .
```
