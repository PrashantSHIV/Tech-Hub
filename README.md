# Tech-Hub (Docker Dev)

## Dev (hot reload)

Prereqs: Docker Desktop + Docker Compose v2

Run:

```bash
docker compose up --build
```

App:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- Postgres: localhost:5432 (user/pass `postgres` / `postgres`, db `doc_platform`)

Stop:

```bash
docker compose down
```

