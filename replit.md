# Guardian Bot - Replit Configuration

## Overview

Guardian Bot (v4.0.0) is a professional Discord security and moderation bot built for the "Noodles & Pistacio" Discord server. It provides a comprehensive member verification/gateway system, welcome/goodbye message management, an embed vault with visual editor, and invite tracking.

**Core responsibilities:**
- **Gateway/Verification System**: Multi-method member verification (Button, Trigger Word, Slash Command) with lockdown levels, DM gauntlets, and trust scoring
- **Welcome/Goodbye Module**: Configurable embed-based welcome and farewell messages with auto-role assignment
- **Embed Vault**: Persistent embed storage with visual editor, invite-linked embeds, and category management
- **Invite Tracker**: Tracks which invite code new members used when joining
- **Task Scheduler**: Background job runner (60s interval) for expired role cleanup and future timed tasks
- **REST API**: Minimal Express.js health endpoint to keep the process alive on hosting platforms

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Entry Point & Bootstrap
- `src/index.js` is the main entry point (configured in `package.json` as `"main": "src/index.js"`)
- On startup: validates required env vars → connects MongoDB → loads modules → loads events → loads commands → starts TaskScheduler
- Global anti-crash handlers (`unhandledRejection`, `uncaughtException`) prevent process exits from individual errors
- `src/api.js` starts a minimal Express server with a `/health` endpoint, useful for uptime monitoring on Replit

### Module System (Plugin Architecture)
- Modules live in `src/modules/<name>/index.js` and export a **factory function** that receives `client` and returns an object of handlers
- The `loadModules` loader auto-discovers all subdirectory `index.js` files and attaches each module's return value to `client.<moduleName>` (e.g., `client.welcome`, `client.gateway`, `client.embedVault`, `client.inviteTracker`)
- This pattern allows inter-module communication through the shared `client` object

### Command System
- Commands live in `src/commands/<category>/<name>.js`
- Each command exports a default object with either a `data` property (SlashCommandBuilder) or legacy `name`/`description` fields
- The recursive `loadCommands` loader deep-scans all subdirectories and registers commands in `client.commands` (a `Collection`)
- Command deployment to Discord is handled separately via `scripts/register.js`

### Event System
- Events live in `src/events/<name>.js` and export `{ name, once?, execute }`
- The `loadEvents` loader registers all events with the Discord client
- Events delegate to modules via `client.<module>.handler()` pattern (e.g., `messageCreate` → `client.gateway.handleMessage()`)

### Key Modules

**Gateway (`src/modules/gateway/`)**
- Three verification methods that can run simultaneously: Button, Trigger Word, Slash Command
- Lockdown levels (1=DM verification, 2=strict gauntlet, 3=system closed)
- Trust score calculation based on account age
- DM-based verification flows with one-time tokens for level 2
- Per-method role configuration with global fallback roles
- Embed caching using `BoundedMap` for static embeds, no caching for dynamic ID cards

**Welcome (`src/modules/welcome/`)**
- Handles member join/leave with configurable embed templates
- Supports invite-linked custom embeds via EmbedVault integration
- Auto-role assignment on join (typically "Unverified" role)

**EmbedVault (`src/modules/embedVault/`)**
- Stores named embed templates per guild in MongoDB
- Visual editor via Discord modals and button interactions
- Embeds can be linked to specific invite codes for partner tracking
- Categories: Welcome, Leave, Boost, Manual

**InviteTracker (`src/modules/inviteTracker/`)**
- Caches invite use counts per guild on startup
- Detects which invite code was used when a member joins by comparing snapshots
- In-memory only; no database persistence for invite snapshots

### Embed Engine (`src/core/embedEngine.js`)
- Centralized placeholder resolution: `{user}`, `{server}`, `{user.name}`, `{account_age}`, etc.
- Supports `{choose:option1|option2}` random selection syntax
- Used by all modules that render embeds (welcome, gateway, embed vault)

### TaskScheduler (`src/core/TaskScheduler.js`)
- Runs every 60 seconds with a mutex flag (`isRunning`) to prevent overlapping ticks
- Skips execution if MongoDB connection is not ready
- Currently handles expired temporary roles; designed to be extended (expired bans, timed jobs)

### Database Design (MongoDB via Mongoose)
- **GatewayConfig**: Per-guild gateway settings including all three method configurations, roles, lockdown settings, and embed templates
- **WelcomeConfig**: Per-guild welcome/goodbye embed templates, channel IDs, and auto-role
- **EmbedVault**: Named embed objects per guild with category and optional invite code link
- **TimedJob**: Persistent scheduled jobs with `runAt` timestamp for future async tasks
- All schemas use `guildId` as the primary lookup index

### Security & Utilities
- `src/utils/cache.js`: `BoundedMap` — a size-limited Map with FIFO eviction, used for embed caching and processing guards
- `src/utils/parseColor.js`: Validates and parses hex color strings for embed colors
- Processing guards using `Set` and `Map` prevent duplicate verification attempts (button spam protection)

### Configuration
- All secrets via environment variables: `DISCORD_TOKEN`, `MONGO_URI`, `CLIENT_ID`, `GUILD_ID`
- `src/config/environment.js` centralizes env loading and provides defaults
- Startup fails fast if any required env var is missing

## External Dependencies

### Discord Integration
- **discord.js v14**: Primary Discord API library
- Required Gateway Intents: Guilds, GuildMembers, GuildMessages, MessageContent, GuildMessageReactions, DirectMessages, DirectMessageReactions
- Required Partials: Channel, Message, User, Reaction, GuildMember
- Slash commands deployed via Discord REST API (`scripts/register.js`)

### Database
- **MongoDB** via **Mongoose v8**: Primary data store for all persistent configuration and embed data
- Connection string via `MONGO_URI` environment variable
- `mongoose.set("strictQuery", false)` applied globally

### Web Server
- **Express v5**: Minimal HTTP server for health check endpoint (`GET /health`)
- Listens on `process.env.PORT` bound to `0.0.0.0` (Replit-compatible)

### Runtime & Tooling
- **Node.js** with ES Modules (`"type": "module"` in package.json)
- **dotenv**: Environment variable loading
- **nodemon**: Development auto-restart (`npm run dev`)
- Scripts: `npm start` (production), `npm run deploy` (deploy commands), `npm run dev` (development)

### Environment Variables Required
| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot authentication token |
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_ID` | Discord application/client ID |
| `GUILD_ID` | Target Discord server ID |
| `PORT` | Express API port (optional, has default) |