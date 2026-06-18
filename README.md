# ⚔️ Pixel Sword Fighter

A premium HTML5 retro pixel-art sword fighting game built on a custom Entity Component System (ECS) architecture, utilizing Matter.js for rigid-body physics, PixiJS for high-performance rendering, and a persistent, crowdsourced Federated Reinforcement Learning (RL) AI system.

---

## 🎮 Key Features

*   **Fluid Combat Mechanics**: Dynamic slashing, jumping, rolling, dashing, parrying (with recovery frame blocking), and character-specific Ultimate Moves.
*   **Procedural Audio Engine**: Retro chiptune music and combat sound effects (whooshes, metallic clangs, sweeps) synthesized in real-time using the **Web Audio API** (zero-dependency).
*   **Adaptive Q-Learning AI**: An opponent that learns in real-time from your fighting style using tabular reinforcement learning.
*   **Federated Sync Server**: A global Node.js/Express API that crowdsources Q-table optimization from all active players globally.
*   **Premium Glassmorphic UI**: High-fidelity overlays for menus, character selection grids, interactive settings, match results summaries, and real-time AI telemetry.
*   **Achievements & Saves**: Persistent local storage manager tracking volume options and unique combat achievements (e.g., *Combo Legend*, *Flawless Victory*).

---

## 🧠 Federated Reinforcement Learning Architecture

When difficulty is set to **Adaptive**, the AI bypasses rules-based decision trees and adopts a learned policy powered by **Tabular Q-Learning**:

```
        +---------------------------------------------------+
        |                 Game Client                       |
        |  1. Encodes ECS State (StateEncoder)              |
        |  2. Policy Lookup (RLAgent - Epsilon-Greedy)      |
        |  3. Reward Signals (RewardCalculator)             |
        |  4. Q-Table updates via Bellman Equation          |
        +---------+-------------------------------+---------+
                  |                               ^
                  | Post-Match                    | Pre-Match
                  | Signed Delta (HMAC)           | Seed Q-Table
                  v                               |
        +---------+-------------------------------+---------+
        |                 Global RL API                     |
        |  - HMAC Signature Verification Middleware         |
        |  - Input Sanitization & State Regex Validation    |
        |  - Q-Value Clamping ([-50, +50])                  |
        |  - Exponential Moving Average Merge               |
        +---------------------------------------------------+
```

1.  **State Encoding**: Discretizes complex coordinate and velocity features into a discrete 7-feature string (e.g., `close|low|high|1|0|1|0`) representing relative positions, velocities, and state flags (1,024 total combinations).
2.  **Reward Calculations**: Performed tick-by-tick based on health changes, parries, and minor time penalties, combined with sparse match-end rewards (+15 / -15).
3.  **Client-Server Synchronization (`RLSyncService`)**: Downloads the global seed matrix on match start and uploads only modified state-action deltas at match completion. Degrades gracefully to local-only offline mode if the server is unreachable.
4.  **Anti-Cheat Protection**: Server validates state keys against state space regex, clamps Q-values to `[-50, +50]` to prevent runaway values, and verifies payload integrity using **HMAC SHA-256 signatures**.

---

## 📂 Project Structure

```
pixel-sword-fighter/
├── server/                     # RL Global API Server
│   ├── middleware/             # HMAC signature verification
│   ├── routes/                 # Q-table download/upload/stats endpoints
│   ├── storage/                # Persistent Q-table JSON
│   ├── Dockerfile              # Docker configuration for Express app
│   └── index.js                # Server entry point
├── src/                        # Game Client Source
│   ├── ai/                     # RLAgent, RewardCalculator, StateEncoder, RLSyncService
│   ├── core/                   # GameLoop, SaveManager, AudioEngine, Loaders
│   ├── ecs/                    # Custom Entity Component System World
│   ├── physics/                # Matter.js integration wrapper
│   ├── rendering/              # PixiJS setup and layer managers
│   ├── systems/                # ECS Systems (Combat, Animation, HUD, Movement, AI)
│   └── main.js                 # Client orchestration & Game setup
├── tests/                      # Unit & Simulated QA Suites
│   └── unit/                   # Vitest tests (combat, agent, sync, physics)
├── docker-compose.yml          # Container configuration for local stack
└── vite.config.js              # Vite configuration
```

---

## ⚡ Getting Started

### Option 1: Run with Docker (Recommended)

Start the entire environment (Frontend client + RL API server) with a single command:

```bash
docker compose up --build
```

-   **Game Client**: Accessible at [http://localhost:3000](http://localhost:3000)
-   **RL API Server**: Running at [http://localhost:4000](http://localhost:4000)
-   To stop the services: `docker compose down`

### Option 2: Run Locally (Node/NPM)

1.  **Start the API Server**:
    ```bash
    cd server
    npm install
    npm start
    ```
2.  **Start the Game Client**:
    ```bash
    # In the root directory
    npm install
    npm run dev
    ```
    The client will start at [http://localhost:3000](http://localhost:3000) (or [http://localhost:5173](http://localhost:5173)).

---

## 🧪 Running Tests

The test suite contains **86 automated unit tests** covering combat system equations, RLAgent Bellman updates, state space boundary discretizations, and RLSyncService fetch mocks.

To run tests:

```bash
npm test
```
