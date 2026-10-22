/* 시세·데이터 서버(Cloudflare Worker) 주소: 새 주소는 같은 도메인, 기존 github.io 는 예전 서버 */
window.APP_CONFIG={api:/github\.io$/.test(location.hostname)?'https://portfolio-api.yjjn2005.workers.dev':location.origin};
