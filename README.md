# TeleFlight Backend

Real-time flight telemetry processing service that connects to Onenex's Flight Telemetry System, processes binary TCP data packets, and serves live flight data to frontend clients via WebSocket.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Supervisor (supervisor/index.ts)                               │
│  Spawns server · monitors memory via IPC · auto-restarts        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ spawns
┌──────────────────────────▼──────────────────────────────────────┐
│  Server (index.ts)                                              │
│                                                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │  REST API     │  │  WebSocket    │  │  Telemetry Service   │  │
│  │  /api/flights │  │  /telemetry   │  │  (periodic polling)  │  │
│  │  (proxy)      │  │  (pub/sub)    │  │                      │  │
│  └──────────────┘  └───────┬───────┘  └──────────┬───────────┘  │
│                            │                      │              │
│                   ┌────────▼──────────────────────▼───────────┐  │
│                   │  Flight Manager                           │  │
│                   │  Creates TCP client per flight             │  │
│                   │  Diffs flight list on sync                 │  │
│                   │  Publishes parsed data to WS topics        │  │
│                   └────────┬─────────┬───────────┬───────────┘  │
│                            │         │           │               │
│                   ┌────────▼──┐ ┌────▼─────┐ ┌──▼────────┐     │
│                   │ TCP Client│ │TCP Client│ │TCP Client │ ... │
│                   │ Flight 1  │ │Flight 2  │ │Flight 3   │     │
│                   └─────┬─────┘ └────┬─────┘ └─────┬─────┘     │
│                         │            │             │             │
│                   ┌─────▼─────┐┌─────▼─────┐┌─────▼─────┐      │
│                   │  Stream   ││  Stream   ││  Stream   │      │
│                   │  Buffer   ││  Buffer   ││  Buffer   │      │
│                   └─────┬─────┘└─────┬─────┘└─────┬─────┘      │
│                         │            │             │             │
│                   ┌─────▼─────┐┌─────▼─────┐┌─────▼─────┐      │
│                   │  Parser   ││  Parser   ││  Parser   │      │
│                   │  + CRC    ││  + CRC    ││  + CRC    │      │
│                   └───────────┘└───────────┘└───────────┘      │
└─────────────────────────────────────────────────────────────────┘
        ▲ TCP (binary)                        │ WebSocket (JSON)
        │                                     ▼
┌───────┴─────────────┐            ┌─────────────────────┐
│  Onenex FTS         │            │  Vue.js Frontend    │
│  TCP Telemetry      │            │  Dashboard          │
│  Servers            │            │                     │
└─────────────────────┘            └─────────────────────┘
```

### Data Flow

1. **Supervisor** spawns the server process and monitors memory via IPC
2. **Telemetry Service** fetches the flight list from Onenex's REST API on startup, then polls periodically
3. **Flight Manager** creates a TCP client per flight, diffs on sync to add new / remove stale flights
4. **TCP Client** connects to the flight's telemetry port, sends a subscribe message, receives binary stream
5. **Stream Buffer** accumulates bytes, scans for valid 36-byte packets (0x82 start, 0x80 end), handles re-synchronization on misaligned or fragmented data
6. **Parser** validates CRC-16/CCITT-FALSE checksum, checks data ranges, extracts and rounds telemetry values
7. **Flight Manager** publishes the latest parsed result to a WebSocket topic (`flight-id-{id}`)
8. **Frontend** subscribes to topics per flight and displays live telemetry

### Binary Packet Pipeline

```
Raw TCP bytes
  → Stream Buffer (accumulate, scan for 0x82, verify 0x80 at +35)
  → Extract 36-byte packet
  → Validate start/end markers
  → CRC-16/CCITT-FALSE over bytes 0x00–0x1E (31 bytes)
  → Parse: flight number, altitude, speed, acceleration, thrust, temperature
  → Validate ranges (e.g. altitude 9000–12000m, speed 220–260 m/s)
  → Round to 2 decimal places
  → Determine status: VALID or CORRUPTED
  → Publish via WebSocket
```

### Connection Statuses

| Status      | Condition                                             |
| ----------- | ----------------------------------------------------- |
| `WAITING`   | Frontend default before any WebSocket message         |
| `VALID`     | Received a valid, fully parsed packet                 |
| `CORRUPTED` | Invalid CRC, out-of-range values, or malformed packet |
| `ERROR`     | TCP connection error, timeout, or failed to connect   |
| `CLOSED`    | TCP connection closed, backend is reconnecting        |

### Resilience Features

- **Auto-reconnect** with exponential backoff (initial 3s, max 30min) on TCP disconnect
- **Auto-restart** via supervisor on process crash
- **Memory monitoring** — child reports RSS to supervisor via IPC; supervisor kills and restarts if limit exceeded
- **Graceful shutdown** — supervisor handles SIGINT/SIGTERM, cleans up child process
- **Stream re-sync** — recovers from fragmented, concatenated, or misaligned TCP packets
- **Intentional close guard** — prevents reconnect loops during shutdown

## Technology Choices

| Technology                | Why                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun**                   | Native TCP (`Bun.connect`), native WebSocket in `Bun.serve`, built-in TypeScript, `Bun.spawn` for process supervision. Zero external dependencies for core server functionality.  |
| **Custom supervisor**     | Demonstrates understanding of process management. Monitors memory via IPC, auto-restarts on crash. Simpler and more transparent than more advanced tools like pm2 for this scope. |
| **Bun pub/sub WebSocket** | Each flight is a topic. TCP clients publish, frontend clients subscribe. Native fan-out with no event emitter or message broker.                                                  |
| **DataView + Buffer**     | Native APIs for big-endian IEEE 754 floats and unsigned integers. No binary parsing library needed.                                                                               |
| **Custom CRC-16**         | Implemented from protocol spec (poly 0x1021, init 0xFFFF). No external dependency.                                                                                                |

## Project Structure

```
src/
├── index.ts                    # Entry point: HTTP + WebSocket server, telemetry boot
├── supervisor/
│   └── index.ts                # Process supervisor (crash restart, memory monitoring)
├── config/
│   ├── index.ts                # Env vars, constants, CORS headers
│   └── validateEnv.ts          # Startup env validation
├── routes/
│   ├── flights.ts              # GET /api/flights proxy
│   └── general.ts              # Fallback routes, WebSocket upgrade
├── middlewares/
│   └── index.ts                # CORS middleware wrapper
├── services/
│   └── flights.ts              # Flight list fetch
├── telemetry/
│   ├── TcpClient.ts           # Per-flight TCP connection + auto-reconnect
│   ├── StreamBuffer.ts        # Binary stream accumulation + re-sync
│   ├── parsePacket.ts               # 36-byte packet parser + CRC validation
│   ├── FlightManager.ts       # Manages TCP clients, publishes to WebSocket
│   ├── startService.ts         # Telemetry service bootstrap + periodic sync
│   ├── constants.ts            # Protocol constants, status types
│   └── types.ts                # Telemetry types
├── ws/
│   └── index.ts                # WebSocket subscribe handler
├── core/
│   ├── crc.ts                  # CRC-16/CCITT-FALSE
│   └── file.ts                 # File utilities (mbToBytes)
└── types/
    ├── entities.ts             # Flight, TelemetryDetails
    ├── http.ts                 # Route handler types (from Bun)
    ├── ws.ts                   # WebSocket payload types + type guard
    ├── supervisor.ts           # IPC message types
    └── bun-env.d.ts            # Bun env type declarations
```

## Setup

### Prerequisites

- [Bun](https://bun.sh/) >= 1.2.3

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Onenex FTS API
FTS_API_BASE_URL=https://fts.onenex.dev
FTS_API_PORT=4000

# Onenex FTS TCP server
FTS_TCP_HOSTNAME=fts.onenex.dev

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173

# Memory limit for auto-restart (MB)
MEMORY_LIMIT_MB=200
```

### Install & Run

```bash
bun install

# Production (with supervisor)
bun start

# Development (hot reload, no supervisor)
bun dev

# Development with supervisor
bun dev:supervised

# Standalone (no supervisor)
bun start:standalone
```

### Tests

```bash
bun test
```

26 tests across 2 files covering:

- **Parser** (16 tests) — valid packets, wrong markers, bad CRC, tampered data, all range validations
- **Stream Buffer** (10 tests) — single/multiple packets, partial packets, garbage bytes, false starts, fragmentation

### Linting

```bash
bun run lint           # All checks (types + eslint + prettier)
bun run lint:types     # TypeScript type checking
bun run lint:code      # ESLint
bun run lint:format    # Prettier format check
```

## CI/CD

### Git Hooks (pre-commit)

Pre-commit hooks via Husky + lint-staged run automatically before each commit:

- TypeScript type checking
- ESLint code linting
- Prettier formatting
- Unit tests

### Continuous Integration

GitHub Actions runs on every pull request to `main`:

- Type checking
- Code linting
- Format checking
- Tests

### Stable Releases

On merge to `main`, semantic-release automatically:

- Determines version bump (patch/minor/major)
- Generates release notes
- Creates a GitHub release with a version tag

### Continuous Deployment

Not implemented yet due to time constraints. With versioned releases in place, the next step would be triggering deployment on new release tags (e.g. building a Docker image and deploying to a cloud server).

## Assumptions

- Flight list is small (< 100 flights) - in-memory diffing without persistence is sufficient
- Flight IDs are strings in the REST API and accepted as strings in TCP subscribe messages
- TCP subscription interval defaults to 3000ms - real-time enough without overwhelming connections
- Flight list is polled every 30 seconds; new flights auto-subscribed, removed flights auto-disconnected
- Only the latest parsed packet per data event is forwarded to the frontend

## Known Limitations

- **No data persistence** — historical telemetry is not stored; only latest values are forwarded
- **No authentication** — REST and WebSocket endpoints are open
- **No HTTPS/WSS** — plain HTTP/WS for local development; production needs TLS termination
- **Memory self-reporting** — if the child process hangs (infinite loop), it can't send IPC messages and the supervisor won't detect the issue
- **No rate limiting** on REST or WebSocket endpoints
- **Supervisor is a single point of failure** — if the supervisor process itself is killed or crashes, there is no higher-level watcher to recover it. In production, more advanced solutions (e.g pm2) would be needed
- **One TCP connection per flight** — each flight opens a dedicated TCP connection. For a small fleet this is fine, but at scale (hundreds of flights) this could exhaust system resources like file descriptors and memory
- **Single WebSocket server** — all frontend clients connect to one WebSocket server. Under heavy load (many concurrent clients across many flights), this becomes a bottleneck. A production setup would require a dedicated real-time messaging layer
