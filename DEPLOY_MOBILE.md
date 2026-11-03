# 스마트폰에서 바로 접속하는 FRAME STUDIO 배포 안내

이 프로젝트는 **모바일 크롬/사파리에서 URL로 접속**할 수 있는 서버형 웹사이트입니다. 스마트폰에는 Python, FFmpeg, Deno 등을 설치할 필요가 없습니다. 단, 사이트를 인터넷에 공개하려면 호스팅 서비스의 서버가 필요합니다.

## 배포 (Railway 기준)

1. 프로젝트 파일을 GitHub 저장소에 올립니다. (압축을 해제한 내용 전체를 저장소 최상위에 넣으세요.)
2. Railway(https://railway.com/)에 로그인하고 `New Project → Deploy from GitHub repo`로 해당 저장소를 선택합니다.
3. 아래 환경변수를 반드시 추가합니다.
   - `FRAME_PUBLIC_MODE=1`
   - `FRAME_SITE_PASSWORD=여기에_12자_이상_강력한_비밀번호`
   - `FRAME_MAX_DURATION=1800` (최대 30분)
   - `FRAME_MAX_FILE_BYTES=367001600` (다운로드 원본 최대 약 350MiB)
   - `FRAME_MAX_ACTIVE_JOBS=1`
4. Dockerfile을 자동 인식합니다. 배포가 끝나면 Railway 네트워킹 설정에서 **Generate Domain**으로 HTTPS 주소를 생성합니다.
5. 휴대폰에서 그 HTTPS 주소에 접속 → ID에 `frame`, 비밀번호에 위에서 설정한 값을 입력 → 유튜브 링크 붙여넣기 → MP4/MP3 추출 및 파일 저장.

Railway 연결 앱을 ChatGPT에 연결하면, 이 배포 절차를 앱에서 직접 진행하는 방식도 사용할 수 있습니다. 실제 배포에는 사용자 본인의 서비스 계정/권한 및 호스팅 결제 설정이 필요할 수 있습니다.

## Render 배포 (대안)

Render(https://dashboard.render.com/)에서 `New → Blueprint`로 GitHub 저장소를 선택하면 `render.yaml`을 사용합니다. `FRAME_SITE_PASSWORD`에 12자 이상의 비밀번호를 넣어야 시작할 수 있습니다. `starter` 플랜 설정이므로 요금이 발생할 수 있습니다. 배포되면 HTTPS `onrender.com` URL이 발급됩니다.

## 주의사항

- 이 ZIP 자체가 이미 공개된 웹사이트는 **아닙니다**. 호스팅에 배포해야 실제 접속 주소가 생깁니다.
- YouTube의 접근 정책이나 서버 IP 제한으로 일부 영상 다운로드가 실패할 수 있습니다. 모든 영상에서 성공하는 기능은 아닙니다.
- 다운로드 권한이 있고 저작권과 YouTube 이용약관이 허용하는 콘텐츠에만 사용하세요.
- 서버에 원본과 변환 결과가 잠시 보관됩니다. 완료 파일은 1시간 뒤 다음 API 요청 시 정리되며, 서버 재시작 시에는 작업 기록이 유지되지 않습니다.
- 호스팅 서비스에서 저장소·메모리·CPU·네트워크 사용량에 따른 요금이 발생할 수 있습니다. 동영상은 변환에 CPU와 디스크가 많이 필요합니다.
- **절대 비밀번호를 GitHub 코드에 넣지 마세요.** 배포 서비스의 환경변수에만 입력하세요.
- 보안상 `FRAME_PUBLIC_MODE=1`이고 비밀번호가 없거나 12자 미만이면 서버는 기동하지 않습니다.
