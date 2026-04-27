# Bus Tracking Backend — Python 3

Python 3 rewrite of the Node.js backend using **FastAPI**, **asyncpg**, **redis-py (async)**, and **python-socketio**.

## Stack mapping

| Node.js (original)   | Python 3 (this)          |
|----------------------|--------------------------|
| Express              | FastAPI                  |
| pg (Pool)            | asyncpg                  |
| redis                | redis.asyncio            |
| socket.io            | python-socketio          |
| bcryptjs             | passlib[bcrypt]          |
| jsonwebtoken         | python-jose              |
| joi                  | Pydantic v2              |
| winston              | loguru                   |
| geolib               | geopy                    |
| dotenv               | pydantic-settings        |

## Setup

```bash
cd backend-python
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # edit as needed
```

## Run

```bash
python run.py
```

## Seed database

```bash
python -m src.database.seed
```

## GPS simulator (for testing)

```bash
python -m src.scripts.gps_simulator
```

## API

Same endpoints as the original — all under `/api/v1`:

- `POST /auth/login`
- `POST /auth/register`
- `GET  /buses`
- `GET  /buses/:id`
- `GET  /routes`
- `GET  /routes/:id`
- `POST /location/update`
- `GET  /location/live`
- `GET  /stops/:id/eta?trip_id=`
- `GET  /health`

Interactive docs available at `http://localhost:5000/docs`
