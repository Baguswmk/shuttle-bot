# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> Shuttle REST API E2E Tests >> POST /api/auth/login - should succeed and return JWT
- Location: e2e\api.spec.ts:31:7

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:3002
Call log:
  - → POST http://localhost:3002/api/auth/login
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 46

```
