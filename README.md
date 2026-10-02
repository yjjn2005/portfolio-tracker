# 포트폴리오 수익률 관리

개인·법인 / 증권사 / 계좌성격(위탁·연금·IRP·퇴직연금)별 평가금액과 손익을 보는 정적 웹앱.

- `index.html` · `app.js` · `config.js` — GitHub Pages로 배포되는 화면 (보유 데이터는 이 저장소에 없음)
- `worker/` — Cloudflare Worker `portfolio-api`: 야후 파이낸스 시세 프록시(`/quote`, `/search`)와 PIN으로 보호되는 보유 데이터(`/data`, KV `PF`)
- 화면에서 PIN을 입력하면 보유 데이터를 불러오고, 시세는 60초마다 자동 갱신됩니다.
