# Project Apex 접속·WebGL 검수 진단

확인일: 2026년 11월 5일 한국 시간

접속 문제와 WebGL 검수 실패는 각각 원인이 확인됐다. 수정 코드와 검수 절차는 로컬에 준비했으며, GitHub 적용·새 브라우저 검수 실행·인증서 복구는 아직 완료되지 않았다.

## 1. HTTPS 접속: 커스텀 도메인과 인증서 불일치

| 확인 항목 | 실제 결과 |
|---|---|
| HTTP 접속 | `http://project-apex.kro.kr/` → 200, 게임 파일 응답 정상 |
| HTTPS 접속 | 현재 검수 환경에서 503, upstream connection failure |
| GitHub 기본 주소 | 301로 HTTP 커스텀 도메인에 이동 |
| DNS CNAME | `dasol1819.github.io.` |
| A·AAAA | GitHub Pages의 IPv4·IPv6 주소로 연결 |
| CAA | Let's Encrypt 발급 허용 |
| 외부 TLS 검사 | 검사가 완료된 IPv6 엔드포인트 2곳 모두 신뢰 오류 T |
| 서버가 제시한 인증서 | `CN=*.github.io` |
| 인증서 SAN | GitHub 도메인만 포함하며 `project-apex.kro.kr` 누락 |

따라서 HTTPS에는 실제 도메인 인증서 문제가 있다. 검수 브라우저가 HTTP 주소를 HTTPS로 변경해 접속할 때도 이 문제에 도달한다. 전체 8개 주소의 외부 검사가 끝나기 전 확보한 결과이며, 완료된 2곳의 인증서는 동일했다.

해결에는 GitHub Pages 설정에서 해당 도메인의 인증서 발급 상태를 확인하는 작업이 필요하다. 발급 절차가 정체되어 있으면 같은 도메인을 재등록해 재발급을 유도하고, 올바른 인증서와 HTTPS 200 응답을 확인한 뒤 HTTPS 강제를 켠다. GitHub 공식 문서도 DNS 변경 후 도메인을 제거·재추가해야 발급 절차가 재시작되는 경우를 안내한다.

현재 검수 브라우저의 GitHub 설정 화면은 로그아웃 상태다. 연결된 GitHub 앱은 저장소 관리자 권한을 확인했지만, 제공된 도구에는 Pages 인증서 설정을 변경하는 기능이 없다.

## 2. WebGL 검수: 검수 브라우저의 그래픽 백엔드 비활성화

독립 진단 페이지와 실제 게임에서 모두 재현했다. 검수 브라우저는 Linux Chrome 155다.

| 검사 | 결과 |
|---|---|
| 게임과 같은 고성능·안티앨리어싱 WebGL 2 | 컨텍스트 생성 실패 |
| 기본 전력·안티앨리어싱 없는 WebGL 2 | 컨텍스트 생성 실패 |
| WebGL 1 | 컨텍스트 생성 실패 |
| 공통 오류 | `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, `BindToCurrentSequence failed` |
| 비행 WASM | 200, 325,232바이트, `WebAssembly.validate` 통과 |
| 게임 진입 모듈·MiG-15bis 모델 | 모두 200 |

실패는 기체나 텍스처를 그리기 전에 발생한다. 기본 그래픽 속성에서도 같은 오류이므로 화질 설정을 낮춰 해결할 수 있는 상태가 아니다. 페이지 JavaScript로 검수 브라우저의 비활성화된 그래픽 백엔드를 켤 수는 없다.

작업 컨테이너에는 Chromium 실행 파일과 Python Playwright도 없다. 기존 테스트의 `/usr/bin/chromium` 기본 경로는 이 환경에서 실행 가능한 검수 경로가 아니었다.

## 3. 준비한 수정

- 독립 실행 진단 화면: 컨텍스트 오류, 셰이더 컴파일, 실제 픽셀 그리기·읽기, 비행 WASM과 게임 파일 응답을 각각 확인한다.
- 시작 실패 안내: WebGL·비행 모듈·기체 자산·맵 생성 중 실패 단계를 기록하고 진단 화면으로 연결한다. 수정된 WebGL 실패 안내와 링크는 브라우저에서 직접 확인했다.
- 실제 브라우저 자동 검수: 버전을 고정한 Playwright와 대응 Chromium을 설치하고, 격리된 GitHub 실행 환경에서 ANGLE/SwiftShader로 실제 게임·Three.js 셰이더·WASM을 실행한다.
- 데스크톱·모바일 검수 코드: MiG-15bis 트리 선택, 기체 보기, 조작부, 출격·스로틀·비행 물리 진행과 실제 그리기를 검사하며 화면과 오류 기록을 보관한다.
- 배포 조건: 실제 브라우저 검수를 통과한 뒤 게시하도록 배포 절차를 수정했다.
- 접속 검사: DNS·리다이렉트·HTTPS 인증·Pages 상태·배포 파일 해시를 별도 결과로 남긴다.

SwiftShader는 CPU에서 동작하는 브라우저 그래픽 검수 경로다. 이 결과와 실제 PC·휴대전화 GPU 성능 검증은 별도이며, MiG-15bis의 기존 형상 검수 미완료 상태도 유지한다.

## 4. 완료한 검증과 남은 적용

복원·manifest 검사, JavaScript 문법과 워크플로 YAML 구문 검사, 네이티브 모듈의 동일 바이트 재빌드, 관련 비행·전투·모델·표면 회귀검사 11개를 통과했다. 처음 실패했던 3개 회귀검사는 필요한 비교용 빌드 파일을 생성한 뒤 통과했다.

새로운 GitHub 브라우저 검수는 아직 실행되지 않았다. GitHub 업로드가 자동 승인 검토에서 차단되어 수정본은 로컬 커밋에만 있다. 이후 필요한 작업은 수정본 업로드와 PR 검사, 실패 교정, 검증된 변경의 병합·배포, Pages 도메인 인증서 복구, 공개 HTTPS와 브라우저 실행 결과 확인이다.

근거 데이터: [evidence.json](evidence.json)

공식 해결 절차: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages
