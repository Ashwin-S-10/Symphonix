# Backend Run Guide

## Prerequisites
- Python (v3.11+)
- `uv` package and environment manager

## Running the Django Server

1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   ```

2. Run database migrations:
   ```bash
   uv run python manage.py migrate
   ```

3. Start the Django REST API server:
   ```bash
   uv run python manage.py runserver 8000
   ```

4. The API will be available at `http://localhost:8000`.

## Running Backend Tests
To run catalog and spaces signaling unit tests:
```bash
uv run python manage.py test
```

## Key Endpoints
- `GET /api/songs/` — Full 20-track demo catalog (with `?collection=` and `?q=` filters)
- `GET /api/songs/<id>/` — Single song metadata
- `GET /api/demo-audio/<id>/` — Seekable MP3 audio streaming (Range requests)
- `POST /api/spaces/` — Create space & generate room code
- `POST /api/spaces/<code>/join/` — Join space
- `POST /api/spaces/<code>/signals/` — Send WebRTC SDP offers/answers & ICE candidates
- `GET /api/spaces/<code>/signals/poll/?peerId=<id>` — Poll pending WebRTC signals
