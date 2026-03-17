# Fact or Fake? 🧠

A fact-guessing trivia game powered by Claude AI. Answer **True or False**, climb the leaderboard, and unlock avatars as you play.

## Game Modes

| Mode | Description |
|------|-------------|
| ♾️ Classic | Endless questions, no pressure |
| ⚡ Blitz | 60-second speed round — correct answers add time |
| 💀 Sudden Death | 3 lives — one wrong answer costs a heart |
| 🎭 Bluff Challenge | Bet on your answer for bonus points |

## Features

- AI-generated facts across 6 categories (Science, Space, History, Animals, Food, Fun Facts)
- User accounts with sign-up / sign-in (JWT auth)
- Global leaderboard with per-mode filtering
- 20 unlockable avatars with tiered difficulty conditions
- FactBot chat assistant (hints without spoilers)
- Dark / Light mode toggle

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Then edit `.env` and add:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
JWT_SECRET=pick_any_long_random_string_here
```

Get a free API key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run the server

```bash
npm start
```

Open [http://localhost:3000/facts.html](http://localhost:3000/facts.html) in your browser.

## Project Structure

```
├── facts.html       # Main game (frontend)
├── server.js        # Express backend + Claude API + auth
├── package.json
├── .env.example     # Template for environment variables
└── .gitignore
```
