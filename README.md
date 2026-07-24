# W1ld Auth Server v2.0.0

Auth server for the W1ld Launcher — a Minecraft-style game launcher authentication and management system.

## Tech Stack

- Node.js + Express
- SQLite (better-sqlite3)
- JWT (jsonwebtoken) — access + refresh tokens
- bcryptjs — password hashing
- Helmet, CORS, express-rate-limit — security middleware
- dotenv — environment configuration

## Project Structure

```
W1ld Auth Server/
├── server/
│   ├── server.js           # Entry point
│   ├── config/
│   │   └── config.js       # Environment configuration
│   ├── database/
│   │   └── db.js           # SQLite connection & schema
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   ├── admin.js        # Admin role check
│   │   └── errorHandler.js # Global error handler
│   ├── routes/
│   │   ├── auth.js         # Auth & profile routes
│   │   ├── api.js          # Launcher & public API
│   │   └── admin.js        # Admin CRUD routes
│   ├── services/
│   │   └── userService.js  # User business logic
│   └── utils/
│       └── helpers.js      # Utility functions
├── public/                 # Static files (admin panel)
├── storage/                # Uploaded files
├── .env                    # Environment variables
├── .env.example            # Template for env vars
├── .gitignore
├── render.yaml             # Render deployment config
├── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
cd "W1ld Auth Server"
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Fill in the values (especially `JWT_SECRET`)

```bash
copy .env.example .env
```

### Running

```bash
npm start
```

The server starts on `http://localhost:3000` (configurable via `PORT`).

### Development

```bash
npm run dev
```

## API Endpoints

### Auth (Public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login (returns JWT token) |
| GET | `/api/profile/:username` | Get user profile |
| POST | `/api/change-password` | Change password (requires login) |
| POST | `/api/delete-account` | Delete account (requires login) |

### Public API (Launcher)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Server status |
| GET | `/api/tunnel-url` | Tunnel URL for launcher |
| GET | `/api/launcher-version` | Launcher version info |
| GET | `/api/client-version` | Client version info |
| GET | `/api/download-client` | Download client zip |
| GET | `/api/download-launcher` | Download launcher exe |
| GET | `/api/buttons` | Active buttons |
| GET | `/api/clients` | Active clients |

### Admin API (JWT + Admin role required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/clients` | List all clients |
| POST | `/api/admin/clients` | Create client |
| PUT | `/api/admin/clients/:id` | Update client |
| DELETE | `/api/admin/clients/:id` | Delete client |
| GET | `/api/admin/buttons` | List all buttons |
| POST | `/api/admin/buttons` | Create button |
| PUT | `/api/admin/buttons/:id` | Update button |
| DELETE | `/api/admin/buttons/:id` | Delete button |

### Using Token

Include the token in the Authorization header for protected routes:

```
Authorization: Bearer <token>
```

## Deployment (Render)

See `render.yaml` for configuration. Set the following environment variables on Render:

- `JWT_SECRET` — strong random string
- `JWT_REFRESH_SECRET` — strong random string
- `DB_PATH` — path to SQLite file (optional, defaults to `./w1ld_auth.db`)
- `PORT` — Render sets this automatically (10000)
- `CORS_ORIGIN` — your frontend URL
- `RATE_LIMIT_WINDOW_MS` — rate limit window in ms
- `RATE_LIMIT_MAX` — max requests per window

## Security

- Passwords are hashed with bcrypt (salt rounds: 10)
- JWT tokens for authentication (15 min access, 7 day refresh)
- Helmet for HTTP security headers
- CORS configured
- Rate limiting (100 req/15 min)
- Input validation on all endpoints

## Changelog

### v2.0.0 (Refactor)

- Split monolithic `server.js` into modular structure
- Replaced custom tokens with JWT authentication
- Added `authenticateToken` and `requireAdmin` middleware
- Added Helmet, CORS, rate limiting
- Added centralized error handler
- Added `.env.example` and `.gitignore`
- Added `render.yaml` for Render deployment
- Removed hardcoded Desktop paths (now config-driven)
- Added refresh token support
- Updated API to return consistent JSON responses

### v1.1 (Previous)

- Monolithic `server.js` (649 lines)
- Custom session tokens via `crypto.randomBytes`
- SQLite with `better-sqlite3`
- Basic admin panel in `/public`
- Client download and launcher download endpoints