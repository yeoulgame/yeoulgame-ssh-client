# 기여 가이드 (CONTRIBUTING.md)

Yeoulgame SSH Client · Copyright © 2026 Yeoulgame (yeoulgame.com) · MIT License

여울 게임터 SSH 클라이언트에 기여해 주셔서 감사합니다.

## 1. 시작하기

```bash
git clone https://github.com/yeoulgame/yeoulgame-ssh-client.git
cd yeoulgame-ssh-client
npm install
npm start
```

빌드 환경 준비는 [BUILD.md](BUILD.md) 를 참고하세요.

## 2. 이슈

- 버그 신고: <https://github.com/yeoulgame/yeoulgame-ssh-client/issues>
- 반드시 포함해 주세요: **OS 와 버전**, **프로그램 버전**, **로케일(`locale` 출력 또는 Windows 언어 설정)**,
  재현 절차, 스크린샷 또는 로그
- 한글 깨짐 문제는 접속 대상 서버의 인코딩(`echo $LANG`)도 함께 적어주세요.

## 3. 브랜치와 커밋

- `main` — 배포 가능한 상태
- `feat/<기능>`, `fix/<버그>`, `i18n/<언어코드>` 형태의 브랜치 사용
- 커밋 메시지: `feat: 세션 내보내기 추가` / `fix: EUC-KR 청크 경계 깨짐 수정`

## 4. 코드 규칙

- **모든 소스 파일 최상단에 저작권 헤더를 넣습니다.**
  ```js
  /*
   * Yeoulgame SSH Client v1.0
   * Copyright © 2026 Yeoulgame (yeoulgame.com)
   * Licensed under MIT License
   * https://opensource.org/licenses/MIT
   */
  ```
- 들여쓰기 2칸, 세미콜론 사용, 파일 인코딩은 **UTF-8 (BOM 없음)**
- 렌더러에서 `require` 를 직접 쓰지 않습니다. IPC 는 `src/main/preload.js` 의 허용 목록에만 추가합니다.
- 사용자에게 보이는 문자열은 **하드코딩 금지** — `resources/i18n/*.json` 에 키를 추가하고 `t('키')` 로 씁니다.
- PR 전에 반드시:
  ```bash
  npm run verify
  ```

## 5. 번역 기여

1. `resources/i18n/en.json` 을 기준으로 키를 맞춥니다.
2. 새 언어는 `<code>.json` 으로 추가하고 `src/main/i18n-main.js` 의 `SUPPORTED` 에 등록합니다.
3. **기계 번역만 사용한 PR 은 받지 않습니다.** 해당 언어 사용자의 검수를 거쳐 주세요.
4. `_meta.coverage` 에 `full`(메뉴+메시지+도움말) 또는 `ui-only`(메뉴+버튼) 를 정확히 적어주세요.
5. `npm run verify` 로 치환자(`{count}` 등) 일치를 확인합니다.

현재 상태: `ko`, `en` = full / `ja`, `zh-CN`, `de` = ui-only (V1.1 에서 full 예정)

## 6. PR 체크리스트

- [ ] `npm run verify` 통과
- [ ] 한글 입출력 회귀 테스트 (`mkdir 테스트`, `ls -la`, 한글 파일 출력)
- [ ] 다중 탭 · 세션 저장/로드 확인
- [ ] 다크/라이트 테마 모두 확인
- [ ] 새 문자열은 ko/en 양쪽에 추가
- [ ] 저작권 헤더 포함

## 7. 라이선스

기여한 코드는 MIT License 로 배포되는 데 동의하는 것으로 간주합니다.
로고와 "여울게임터 / Yeoulgame" 상표는 MIT 라이선스 범위에 포함되지 않으며, 사용하려면 별도 승인이 필요합니다.

## 8. 연락

- 일반 문의: support@yeoulgame.com
- 연구팀 검수: research@yeoulgame.com (제목: `[YSC-2026-001] …`)
