# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> Shuttle REST API E2E Tests >> GET /api/stats - should fail when unauthorized
- Location: e2e\api.spec.ts:47:7

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:3002
Call log:
  - → GET http://localhost:3002/api/stats
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```
