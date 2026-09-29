# 🎰 EarnMiniApp - Frontend Developer Integration Guide & Complete API Reference

Welcome to the **EarnMiniApp Backend Engine**. This comprehensive documentation is written specifically for Frontend Telegram Mini App Developers and Backend Engineers.

---

## 📑 Table of Contents
1. [Quick Start & Base URL](#1-quick-start--base-url)
2. [Standard Response Envelope](#2-standard-response-envelope)
3. [Authentication Lifecycle (Handshake & JWT)](#3-authentication-lifecycle-handshake--jwt)
4. [Ready-to-Use TypeScript Definitions](#4-ready-to-use-typescript-definitions)
5. [Screen-by-Screen API Integration](#5-screen-by-screen-api-integration)
   - [A. App Initialization & Profile](#a-app-initialization--profile)
   - [B. Spin & Earn Wheel (Tickets & Diamond Fallback)](#b-spin--earn-wheel)
   - [C. Daily Rewards (7-Day Streak)](#c-daily-rewards-7-day-streak)
   - [D. 1-Tap Referral System & Team Modal](#d-1-tap-referral-system--team-modal)
   - [E. Dynamic Contest & Tournament Leaderboards](#e-dynamic-contest--tournament-leaderboards)
   - [F. Raffles & Lotteries (Gems, VIP & Telegram Stars)](#f-raffles--lotteries-gems-vip--telegram-stars)
   - [G. Tasks & Quests (Socials, Telegram Channels & Levels)](#g-tasks--quests)
   - [H. Gift Code Redemption](#h-gift-code-redemption)
   - [I. Wallet, Cashout (USDT BEP-20) & Records](#i-wallet-cashout-usdt-bep-20--records)
   - [J. Crypto Invoices (USDT Deposits & Sweeping)](#j-crypto-invoices-usdt-deposits--sweeping)
   - [K. Feedback & Support](#k-feedback--support)
6. [Complete In-App Admin Panel Reference](#6-complete-in-app-admin-panel-reference)
7. [Ready-to-Use Axios Client Snippet](#7-ready-to-use-axios-client-snippet)
8. [DevOps, Docker & VPS Deployment](#8-devops-docker--vps-deployment)

---

## 1. Quick Start & Base URL

- **Production HTTPS Base URL:** `https://orchestraai.duckdns.org/api/v1`
- **Development Local Base URL:** `http://localhost:3000/api/v1`
- **Health Check Endpoint:** `GET https://orchestraai.duckdns.org/health`

In your frontend project (`.env` or `config.json`):
```env
VITE_API_BASE_URL=https://orchestraai.duckdns.org/api/v1
```

---

## 2. Standard Response Envelope

Every endpoint returns JSON in this standard envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;       // true if request succeeded, false on error
  message?: string;       // Optional human-readable message (e.g. "Spin successful")
  data?: T;               // Response payload (present when success === true)
  error?: string;         // Error description (present when success === false)
}
```

### 2.1 Universal Real-Time User Balance Synchronization ⚡

All balance-mutating endpoints (`/spin`, `/tasks/:id/claim`, `/daily-rewards/claim`, `/gift-codes/redeem`, `/wallet/withdraw`, `/wallet/bind`, `/raffles/:id/tickets`) return a **standardized user balance payload** under both `userBalance` and `user` properties with dual `camelCase` and `snake_case` fields:

```json
{
  "success": true,
  "data": {
    "userBalance": {
      "diamonds": 1580,
      "gems": 1580,
      "spins": 5,
      "balance_usd": 0.45,
      "balanceUsd": 0.45,
      "energy": 100,
      "max_energy": 100,
      "maxEnergy": 100,
      "level": 1,
      "ton_wallet": "0x...",
      "goal_usd": 1.00,
      "goal_left": 0.55
    },
    "user": { ... }
  }
}
```

#### 🚀 Frontend 1-Line Universal Store Sync Hook:
```typescript
// Call this helper on ANY successful API response to update header & balances in 0ms!
export const syncBalances = (resData: any) => {
  const updated = resData?.userBalance || resData?.user || resData;
  if (updated && (updated.diamonds !== undefined || updated.spins !== undefined)) {
    useUserStore.getState().updateUser(updated);
  }
};
```

---

## 3. Authentication Lifecycle (Handshake & JWT)

```
[ App Launch ]
      │
      ▼
1. Extract `window.Telegram.WebApp.initData`
2. Call `POST /auth/telegram` with { init_data, start_param }
3. Receive { token, user }
4. Save `token` in localStorage / sessionStorage
      │
      ▼
All subsequent API calls send:
`Authorization: Bearer <token>`
```

> [!NOTE]
> If `user.is_admin === true`, render an "Admin Panel ⚙️" button in the menu.

---

## 4. Ready-to-Use TypeScript Definitions

Create `src/types/api.ts` in your frontend project:

```typescript
// Standard API Envelope
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// User Profile
export interface UserProfile {
  id: number;
  telegram_id: number;
  first_name: string;
  username: string;
  photo_url: string;
  level: number;
  energy: number;
  max_energy: number;
  spins: number;
  diamonds: number;
  balance_usd: number;
  ton_wallet?: string;
  is_premium: boolean;
  is_admin: boolean;
  goal_left: number;
  progress_pct: number;
  registered_at: string;
}

// Spin Wheel Response
export interface SpinResult {
  won_index: number;
  reward_type: 'cash' | 'spins' | 'gems';
  reward_value: number;
  display_text: string;
  balance_usd: number;
  spins_left: number;
  diamonds: number;
  level: number;
  level_progress_pct: number;
  goal_left: number;
}

// Dynamic Tournament Leaderboard
export interface ContestPrizeTier {
  rank: number;
  rankEnd?: number;
  prize: string;
  amount_usd: number;
}

export interface ContestLeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  spins: number; // Backwards compatible with frontend
  prize: string;
}

export interface UserTournamentStatus {
  rank: number;
  score: number;
  spins: number;
  projectedPrize: string;
}

export interface ContestLeaderboardData {
  contestId: string;
  title: string;
  category: 'spins' | 'referrals';
  prizePool: string;
  endsIn: string;
  endsTimestamp: number;
  topWinners: ContestLeaderboardUser[];   // Ranks 1 to 3
  otherRankings: ContestLeaderboardUser[]; // Ranks 4 to 20
  userStatus: UserTournamentStatus;
}

export interface ContestSummary {
  id: string;
  title: string;
  category: 'spins' | 'referrals';
  prizePool: string;
  isActive: boolean;
  endsIn: string;
  endsTimestamp: number;
  icon: string;
}

// Raffles & Lotteries
export interface RaffleCard {
  id: string;
  title: string;
  cash_reward: number;
  coin_reward_str: string;
  ticket_price_gems: number;
  ticket_price_stars?: number;
  participants_count: number;
  total_tickets_count: number;
  status: 'ongoing' | 'ended';
  ends_in: string;
  ends_timestamp: number;
  user_tickets: number;
}

// Tasks & Quests
export interface TaskItem {
  id: string;
  category: 'special' | 'daily' | 'socials' | 'partners';
  title: string;
  icon: string;
  is_icon_image: boolean;
  reward_gems: number;
  secondary_reward_gems: number;
  target_count: number;
  current_count: number;
  task_type: string;
  action_url?: string;
  is_completed: boolean;
}

// Crypto Invoices (Deposit)
export interface InvoiceData {
  invoice_id: string;
  deposit_address: string;
  amount_usd: number;
  expires_in_seconds: number;
  qr_code_url: string;
}
```

---

## 5. Screen-by-Screen API Integration

### A. App Initialization & Profile

#### 1. Authentication Handshake
- **Method:** `POST /auth/telegram`
- **Headers:** None (Public)
- **Request Body:**
```json
{
  "init_data": "query_id=AAHd...&user=%7B%22id%22%3A1928631932...%7D&auth_date=1724800000&hash=...",
  "start_param": "ref_1928631932"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "telegram_id": 1928631932,
      "first_name": "Shebin",
      "username": "shebin_dev",
      "photo_url": "https://t.me/i/userpic/320/avatar.jpg",
      "level": 3,
      "energy": 100,
      "max_energy": 100,
      "spins": 5,
      "diamonds": 1250,
      "balance_usd": 0.45,
      "ton_wallet": "0x71C...497",
      "is_premium": false,
      "is_admin": true,
      "goal_left": 0.55,
      "progress_pct": 45.0,
      "registered_at": "2026-08-25T12:00:00Z"
    }
  }
}
```

#### 2. Fetch Fresh Profile
- **Method:** `GET /user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "telegram_id": 1928631932,
    "first_name": "Shebin",
    "username": "shebin_dev",
    "photo_url": "https://t.me/i/userpic/320/avatar.jpg",
    "level": 3,
    "energy": 100,
    "max_energy": 100,
    "spins": 5,
    "diamonds": 1250,
    "balance_usd": 0.45,
    "goal_left": 0.55,
    "progress_pct": 45.0
  }
}
```

---

### B. Spin & Earn Wheel

#### Spin Lucky Wheel (With Diamonds Fallback)
- **Method:** `POST /spin/wheel`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (Optional):**
```json
{
  "method": "auto"
}
```
*Note: `"auto"` will prioritize Free Spin Tickets first (`spins > 0`), and if tickets are 0, it falls back to deducting 1,000 Diamonds.*

- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Spin successful",
  "data": {
    "won_index": 2,
    "reward_type": "cash",
    "reward_value": 0.05,
    "display_text": "$0.05",
    "balance_usd": 0.50,
    "spins_left": 4,
    "diamonds": 1250,
    "level": 3,
    "level_progress_pct": 50.0,
    "goal_left": 0.50
  }
}
```

- **Insufficient Balance Error (400 Bad Request):**
```json
{
  "success": false,
  "error": "Insufficient spins and diamonds balance"
}
```

---

### C. Daily Rewards (7-Day Streak)

#### 1. Fetch Streak Status
- **Method:** `GET /daily-rewards`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "current_day": 3,
    "can_claim": true,
    "streak_count": 2,
    "days": [
      { "day": 1, "reward_diamonds": 100, "reward_spins": 1, "reward_xp": 10, "claimed": true },
      { "day": 2, "reward_diamonds": 200, "reward_spins": 1, "reward_xp": 20, "claimed": true },
      { "day": 3, "reward_diamonds": 400, "reward_spins": 2, "reward_xp": 30, "claimed": false },
      { "day": 4, "reward_diamonds": 800, "reward_spins": 2, "reward_xp": 40, "claimed": false },
      { "day": 5, "reward_diamonds": 1500, "reward_spins": 3, "reward_xp": 50, "claimed": false },
      { "day": 6, "reward_diamonds": 3000, "reward_spins": 5, "reward_xp": 60, "claimed": false },
      { "day": 7, "reward_diamonds": 10000, "reward_spins": 10, "reward_xp": 100, "claimed": false }
    ]
  }
}
```

#### 2. Claim Today's Bonus
- **Method:** `POST /daily-rewards/claim`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Day 3 reward claimed successfully",
  "data": {
    "claimed_day": 3,
    "reward_diamonds": 400,
    "reward_spins": 2,
    "new_diamonds": 1650,
    "new_spins": 6
  }
}
```

---

### D. 1-Tap Referral System & Team Modal

#### 1. Fetch Referral Stats & 1-Tap Deep Link
- **Method:** `GET /referrals`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "invite_link": "https://t.me/filestoresixeyeBot/minapp?startapp=ref_1928631932",
    "total_referred": 14,
    "total_earned_usd": 1.40,
    "total_spins_earned": 14,
    "friends": [
      {
        "telegram_id": 994821,
        "first_name": "Elena_TON",
        "username": "elena_ton",
        "photo_url": "https://...",
        "level": 4,
        "reward_usd": 0.10,
        "joined_at": "2026-08-25T14:20:00Z"
      }
    ]
  }
}
```

#### Referral Growth Mechanics:
1. When a new user launches the app via `startapp=ref_<TelegramID>`:
   - **New User** automatically gets **+3 Free Spins** signup bonus.
   - **Referrer** automatically gets **+1 Free Spin** and **$0.10 USDT**.
   - **Bot Notification:** The Telegram Bot sends an automated private message to the referrer:
     > *"🎉 New Friend Joined! @elena_ton just launched EarnCraft via your invite link! You received +1 Free Spin Ticket! 🎟️"*

---

### E. Dynamic Contest & Tournament Leaderboards

All tournaments are **100% database-driven and admin-controlled**.

#### 1. Fetch Active Tournaments
- **Method:** `GET /contests/active`
- **Headers:** Optional
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contests": [
      {
        "id": "spin_weekly",
        "title": "Weekly Spin Championship",
        "category": "spins",
        "prizePool": "$500.00 USDT",
        "isActive": true,
        "endsIn": "4d 12h 15m 30s",
        "endsTimestamp": 1787961599000,
        "icon": "./assets/wheel-of-fortune.png"
      },
      {
        "id": "referral_monthly",
        "title": "Global Referral Championship",
        "category": "referrals",
        "prizePool": "$1,000.00 USDT",
        "isActive": true,
        "endsIn": "18d 04h 22m 10s",
        "endsTimestamp": 1789124000000,
        "icon": "./assets/inviteFeatureCardIcon.png"
      }
    ]
  }
}
```

#### 2. Fetch Weekly Spin Leaderboard (Top 20 + User Status)
- **Method:** `GET /contests/spins`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contestId": "spin_weekly",
    "title": "Weekly Spin Championship",
    "category": "spins",
    "prizePool": "$500.00 USDT",
    "endsIn": "4d 12h 15m 30s",
    "endsTimestamp": 1787961599000,
    "topWinners": [
      { "rank": 1, "name": "CryptoKing", "avatar": "https://...", "score": 284, "spins": 284, "prize": "$200.00" },
      { "rank": 2, "name": "Elena_TON", "avatar": "https://...", "score": 219, "spins": 219, "prize": "$100.00" },
      { "rank": 3, "name": "ViperX", "avatar": "https://...", "score": 178, "spins": 178, "prize": "$50.00" }
    ],
    "otherRankings": [
      { "rank": 4, "name": "Satoshi99", "avatar": "", "score": 142, "spins": 142, "prize": "$25.00" },
      { "rank": 5, "name": "LuckyStrike", "avatar": "", "score": 118, "spins": 118, "prize": "$25.00" },
      { "rank": 6, "name": "ApexSpinner", "avatar": "", "score": 96, "spins": 96, "prize": "$10.00" },
      { "rank": 7, "name": "Dmitri_K", "avatar": "", "score": 84, "spins": 84, "prize": "$10.00" },
      { "rank": 8, "name": "AirdropHunter", "avatar": "", "score": 63, "spins": 63, "prize": "$10.00" },
      { "rank": 9, "name": "ZenMaster", "avatar": "", "score": 51, "spins": 51, "prize": "$10.00" },
      { "rank": 10, "name": "MoonWalker", "avatar": "", "score": 45, "spins": 45, "prize": "$10.00" },
      { "rank": 11, "name": "BladeRunner", "avatar": "", "score": 39, "spins": 39, "prize": "$5.00" },
      { "rank": 12, "name": "TonWarrior", "avatar": "", "score": 35, "spins": 35, "prize": "$5.00" },
      { "rank": 13, "name": "GoldRush", "avatar": "", "score": 31, "spins": 31, "prize": "$5.00" },
      { "rank": 14, "name": "QuantumSpin", "avatar": "", "score": 28, "spins": 28, "prize": "$5.00" },
      { "rank": 15, "name": "NebulaX", "avatar": "", "score": 25, "spins": 25, "prize": "$5.00" },
      { "rank": 16, "name": "SolarFlare", "avatar": "", "score": 22, "spins": 22, "prize": "$5.00" },
      { "rank": 17, "name": "CyberSamurai", "avatar": "", "score": 19, "spins": 19, "prize": "$5.00" },
      { "rank": 18, "name": "PhantomStrike", "avatar": "", "score": 16, "spins": 16, "prize": "$5.00" },
      { "rank": 19, "name": "VelocityNode", "avatar": "", "score": 14, "spins": 14, "prize": "$5.00" },
      { "rank": 20, "name": "EchoPioneer", "avatar": "", "score": 11, "spins": 11, "prize": "$5.00" }
    ],
    "userStatus": {
      "rank": 42,
      "score": 18,
      "spins": 18,
      "projectedPrize": "$0.00"
    }
  }
}
```

#### 3. Fetch Global Referral Leaderboard
- **Method:** `GET /contests/referrals`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contestId": "referral_monthly",
    "title": "Global Referral Championship",
    "category": "referrals",
    "prizePool": "$1,000.00 USDT",
    "endsIn": "18d 04h 22m 10s",
    "endsTimestamp": 1789124000000,
    "topWinners": [
      { "rank": 1, "name": "AlphaReferrer", "avatar": "", "score": 450, "spins": 450, "prize": "$400.00" },
      { "rank": 2, "name": "WhaleNode", "avatar": "", "score": 320, "spins": 320, "prize": "$200.00" },
      { "rank": 3, "name": "CryptoAmbassador", "avatar": "", "score": 210, "spins": 210, "prize": "$100.00" }
    ],
    "otherRankings": [
      { "rank": 4, "name": "BnbLord", "avatar": "", "score": 145, "spins": 145, "prize": "$50.00" },
      { "rank": 5, "name": "ViralGrowth", "avatar": "", "score": 112, "spins": 112, "prize": "$50.00" },
      { "rank": 6, "name": "MiniAppKing", "avatar": "", "score": 94, "spins": 94, "prize": "$20.00" }
    ],
    "userStatus": {
      "rank": 35,
      "score": 14,
      "spins": 14,
      "projectedPrize": "$0.00"
    }
  }
}
```

---

### F. Multi-Currency Raffles & Lotteries (USDT, Telegram Stars, Diamonds)

#### 1. Fetch All Active & Ended Raffles
- **Method:** `GET /raffles`
- **Headers:** `Authorization: Bearer <token>` (Optional)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "#VIP260803",
      "title": "Weekly $500 Mega Lottery",
      "cashReward": 500.00,
      "coinRewardStr": "$500.00 USDT",
      "ticketPriceUsd": 0.50,
      "ticketPriceStars": 25,
      "ticketGemPrice": 200,
      "enableUsdPayment": true,
      "enableStarsPayment": true,
      "enableGemsPayment": true,
      "maxTicketsPerUser": 50,
      "totalTicketsSold": 120,
      "participants": 45,
      "tickets": 120,
      "status": "ongoing",
      "endsAt": "2026-09-05T00:00:00Z"
    }
  ]
}
```

#### 2. Fetch Single Raffle Details
- **Method:** `GET /raffles/:id`
- **Headers:** `Authorization: Bearer <token>` (Optional)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "raffle": { ... },
    "userTickets": 3,
    "ticketPriceUsd": 0.50,
    "ticketPriceStars": 25,
    "ticketGemPrice": 200,
    "enableUsdPayment": true,
    "enableStarsPayment": true,
    "enableGemsPayment": true,
    "maxTicketsPerUser": 50,
    "totalTicketsSold": 120,
    "endsTimestamp": 1788566400000,
    "secondsLeft": 604800,
    "prizeTiers": [
      { "medal": "🥇", "rank": "1st Prize", "amount": "$250.00", "multiplier": "x 1 Winner", "highlight": true },
      { "medal": "🥈", "rank": "2nd Prize", "amount": "$150.00", "multiplier": "x 2 Winners", "highlight": false },
      { "medal": "🥉", "rank": "3rd Prize", "amount": "$100.00", "multiplier": "x 6 Winners", "highlight": false }
    ]
  }
}
```

#### 3. Purchase Tickets (USDT Balance or Diamonds)
- **Method:** `POST /raffles/:id/buy` (or `POST /raffles/:id/tickets`)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "ticket_count": 5,
  "payment_method": "usdt"
}
```
*Supported payment methods: `"usdt"`, `"gems"`, `"diamonds"`, `"vip"`.*

- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Tickets purchased successfully! 🎟️",
  "data": {
    "ticketsPurchased": 5,
    "totalUserTickets": 8,
    "txId": "TX-101-1788566400",
    "userBalance": {
      "diamonds": 1580,
      "balanceUsd": 12.45,
      "spins": 5
    },
    "user": { ... }
  }
}
```

#### 4. Generate Telegram Stars Invoice
- **Method:** `POST /raffles/:id/stars-invoice`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "ticket_count": 5
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "invoiceLink": "https://t.me/$invoice_...",
    "totalStars": 125,
    "ticketCount": 5
  }
}
```
*The frontend opens this invoice link via `Telegram.WebApp.openInvoice`. Upon successful payment, the Telegram webhook automatically credits the tickets and sends a confirmation message in the user's private Telegram chat!*

---

### G. Tasks & Quests Engine (3 Task Types & 2-Step Channel Join)

The backend supports 3 distinct task types configured by Admin:
1. **Type 1: Click & Open External Social / Partner Visits (`external_link`)** — User clicks Open $\rightarrow$ 15-second verification countdown timer $\rightarrow$ unlocks Claim.
2. **Type 2: In-App Milestone Quests (`invite_count`, `spin_count`, `level_reach`)** — Live progress bar based on real user counters $\rightarrow$ claimable once target reached.
3. **Type 3: 2-Step Telegram Channel / Group Verification (`telegram_channel`)** — Opens channel modal $\rightarrow$ user clicks Join $\rightarrow$ returns to Mini App $\rightarrow$ clicks "Check / Verify 🔍" $\rightarrow$ Bot API `getChatMember` verifies membership on-chain.

#### 1. Fetch User Tasks List
- **Method:** `GET /tasks`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "readyToClaim": {
      "id": "ready-1",
      "title": "Extra for 1 invitation",
      "icon": "./assets/inviteFeatureCardIcon.png",
      "rewardGems": 300
    },
    "tasks": [
      {
        "id": "task-social-1",
        "taskType": "external_link",
        "category": "socials",
        "title": "Follow us on X (Twitter)",
        "icon": "🐦",
        "rewardGems": 400,
        "rewardSpins": 2,
        "status": "verifying",
        "verificationSeconds": 12,
        "actionUrl": "https://x.com/EarnCraft"
      },
      {
        "id": "task-milestone-1",
        "taskType": "spin_count",
        "category": "daily",
        "title": "Spin the Wheel 50 Times",
        "icon": "🎡",
        "targetCount": 50,
        "rewardGems": 500,
        "rewardSpins": 5,
        "status": "pending",
        "progress": {
          "current": 18,
          "total": 50
        }
      },
      {
        "id": "task-channel-1",
        "taskType": "telegram_channel",
        "category": "socials",
        "title": "Subscribe to Official Telegram Channel",
        "icon": "📣",
        "rewardGems": 500,
        "rewardSpins": 1,
        "status": "pending",
        "actionUrl": "https://t.me/EarnCraftCommunity",
        "channelId": "@EarnCraftCommunity"
      }
    ]
  }
}
```

#### 2. Start Task / Open Channel (Starts 15s Timer / Records Step 1 Click)
- **Method:** `POST /tasks/:id/start`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Task started successfully. Please complete the action.",
  "data": {
    "taskId": "task-social-1",
    "status": "verifying",
    "verificationSeconds": 15
  }
}
```

#### 3. Verify & Claim Task Reward (Atomic ACID Execution)
- **Method:** `POST /tasks/:id/verify` (or `POST /tasks/:id/claim`)
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Task verified and rewards credited successfully! 🎉",
  "data": {
    "taskId": "task-channel-1",
    "verified": true,
    "claimed": true,
    "user": {
      "id": 1,
      "telegram_id": 123456789,
      "first_name": "Crypto Tester",
      "username": "test_player",
      "level": 2,
      "spins": 15,
      "diamonds": 2550,
      "balance_usd": 0.45
    }
  }
}
```
*(Note: If user has not joined the Telegram channel, or target milestone is not met, returns `400 Bad Request` with an exact reason).*

---

### H. Gift Code Redemption

#### Redeem Promo Code
- **Method:** `POST /gift-codes/redeem`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "code": "SPINFREE"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Gift code redeemed successfully! +5 Free Spins granted! 🎟️",
  "data": {
    "code": "SPINFREE",
    "reward_diamonds": 0,
    "reward_spins": 5,
    "reward_usd": 0.00,
    "new_spins": 11,
    "new_diamonds": 2050,
    "new_balance_usd": 0.50
  }
}
```

---

### I. Wallet, Cashout (USDT BEP-20) & Records

#### 1. Submit Withdrawal Request
- **Method:** `POST /wallet/withdraw`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "amount_usd": 25.00
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "withdrawalId": "104",
    "amountUsd": 25.00,
    "feeUsd": 0.50,
    "netPayoutUsd": 24.50,
    "tonAddress": "0x71C...497",
    "status": "processing",
    "txId": "TX-78412"
  }
}
```

#### 2. Fetch User Financial Records / Ledger
- **Method:** `GET /wallet/records`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 412,
        "category": "withdrawal",
        "title": "USDT BEP-20 Cashout",
        "amount_usd": -25.00,
        "status": "processing",
        "reference_id": "WD-1724800100-1",
        "created_at": "2026-08-25T16:00:00Z"
      },
      {
        "id": 411,
        "category": "spin_reward",
        "title": "Lucky Wheel Cash Prize",
        "amount_usd": 0.05,
        "status": "completed",
        "reference_id": "SPIN-411",
        "created_at": "2026-08-25T15:45:00Z"
      }
    ]
  }
}
```

---

### J. Crypto Invoices (BEP-20 USDT Deposits & Sweeping)

#### 1. Generate BEP-20 Deposit Address
- **Method:** `POST /invoices/crypto` (or `POST /invoices/create`)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "amount_usd": 2.50,
  "purpose": "raffle_tickets",
  "raffle_id": "#VIP260803"
}
```
*Purpose options: `"raffle_tickets"`, `"diamonds"`, `"balance"`.*

- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Deposit invoice generated successfully",
  "data": {
    "invoice_id": "INV-101-1788566400",
    "deposit_address": "0x58c679f291079d3E01a6132712217c4618e7E1d2",
    "amount_usd": 2.50,
    "amount_usdt": "2.50 USDT",
    "purpose": "raffle_tickets",
    "status": "pending",
    "network": "Binance Smart Chain (BEP-20)",
    "expires_at": 1788567600000,
    "qr_code_data": "ethereum:0x58c679f291079d3E01a6132712217c4618e7E1d2@56/transfer?..."
  }
}
```

#### 2. Check Real-Time Invoice Status & Interrupted Session Recovery
- **Method:** `GET /invoices/:id/status` (or `GET /invoices/:id`)
- **Headers:** `Authorization: Bearer <token>`
- **Response (Pending - 200 OK):**
```json
{
  "success": true,
  "data": {
    "invoiceId": "INV-101-1788566400",
    "status": "pending",
    "amountUsd": 2.50,
    "purpose": "raffle_tickets",
    "referenceId": "#VIP260803",
    "depositAddress": "0x58c679f291079d3E01a6132712217c4618e7E1d2",
    "secondsLeft": 840,
    "expiresAt": 1788567600000
  }
}
```

- **Response (Paid & Fulfilled - 200 OK):**
```json
{
  "success": true,
  "data": {
    "invoiceId": "INV-101-1788566400",
    "status": "paid",
    "amountUsd": 2.50,
    "purpose": "raffle_tickets",
    "referenceId": "#VIP260803",
    "txHash": "0x7a8f9b...",
    "paidAt": "2026-08-28T11:55:00Z",
    "ticketsAwarded": 5,
    "userBalance": {
      "diamonds": 1580,
      "balanceUsd": 12.45,
      "spins": 5
    }
  }
}
```

#### Zero-Dust Gas Sweeper Mechanics:
1. Backend detects deposit via sub-second Alchemy Webhook or autonomous 30s background poller.
2. Calculates exact BNB gas down to the Wei and shoots BNB gas from Master Wallet.
3. Sweeps 100% of USDT to Master Vault on-chain.
4. Automatically deregisters temporary address from Alchemy webhook monitor to protect quotas.

---

### K. Feedback & Support

#### Submit Support Ticket
- **Method:** `POST /support/feedback`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "email": "player@gmail.com",
  "category": "deposit",
  "description": "My deposit of 10 USDT was confirmed on-chain.",
  "screenshot_url": "https://..."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Feedback submitted successfully! Ticket ID #84",
  "data": {
    "ticket_id": 84,
    "status": "open"
  }
}
```

---

## 6. Complete In-App Admin Panel Reference

The Admin Panel lives seamlessly inside the same Telegram Mini App with a multi-layered security model.

### 🔐 In-App Admin Security Architecture:

```
[ Admin Launches Mini App ]
             │
             ▼
1. Backend authenticates via HMAC-SHA256: returns `user.is_admin === true`
2. Mini App renders "⚙️ Admin Mode" switch / button in header or profile
3. Admin taps "⚙️ Admin Mode": prompts for Admin Secret Passphrase
4. App calls `POST /api/v1/admin/auth` with { "secret_key": "<passphrase>" }
5. Backend verifies key and issues an Admin JWT session token (24h validity)
6. App stores `admin_token` in memory / secure storage
             │
             ▼
All `/api/v1/admin/*` requests automatically send:
`Authorization: Bearer <admin_token>`
```

### 1. Admin Authentication Handshake
- **Method:** `POST /admin/auth`
- **Headers:** Public (No token needed)
- **Request Body:**
```json
{
  "secret_key": "orchestra_super_admin_secret_key_2026_x99"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Admin authorization successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

### 2. Master Vault First-Time Initialization Architecture

#### ❓ Why This Exists:
- **Zero Static Secrets Risk:** Prevents relying on static, hardcoded private keys in `.env` files that could be exposed in repositories or during deployments.
- **Dynamic On-Demand Setup:** Gives the administrator full ownership to generate a fresh 12-word BIP-39 mnemonic seed phrase or import an existing master wallet during the first-time setup wizard.
- **Mandatory Offline Backup:** Forces the administrator to view and download their confidential credentials file (`.txt`) and confirm backup before unlocking the administrative dashboard.
- **Persistent Database Storage:** Stores master mnemonic, private key, and public address securely inside the PostgreSQL `system_settings` table, automatically activating the BSC blockchain engine in-memory across server restarts.

#### 🔄 Step-by-Step Initialization Workflow:

```
[ Step 1: Admin Opens Admin Panel ]
                 │
                 ▼
Call `GET /api/v1/admin/wallet-status`
                 │
  ┌──────────────┴──────────────┐
  ▼                             ▼
`is_initialized: false`        `is_initialized: true`
  │                             │
  ▼                             ▼
Render First-Time Wizard      Render Admin Dashboard
```

#### Step 1: Check Initialization State (`GET /api/v1/admin/wallet-status`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response if Uninitialized (200 OK):**
```json
{
  "success": true,
  "data": {
    "is_initialized": false,
    "master_address": "",
    "bnb_balance": 0.0,
    "usdt_balance": 0.0,
    "network": "Binance Smart Chain (BSC Mainnet)",
    "chain_id": 56,
    "is_payout_ready": false
  }
}
```

#### Step 2A: Generate New Master Vault (`POST /api/v1/admin/wallet/generate`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:** `{}` (Empty JSON)
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Master funding wallet generated successfully",
  "data": {
    "master_address": "0x71C...497",
    "seed_phrase": "apple banana cherry dog eagle flower grape honey ice jazz kite lion",
    "private_key": "0x4f3c...9a21",
    "derivation_path": "m/44'/60'/0'/0/0",
    "notice": "IMPORTANT: Write down and securely store your 12-word seed phrase and private key. Download your backup file before closing this modal."
  }
}
```

#### Step 2B: Import Existing Master Vault (`POST /api/v1/admin/wallet/import`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:**
```json
{
  "seed_phrase": "apple banana cherry dog eagle flower grape honey ice jazz kite lion"
}
```
*Or with hex private key:*
```json
{
  "private_key": "0x4f3c...9a21"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Master wallet imported successfully",
  "data": {
    "master_address": "0x71C...497"
  }
}
```

#### Step 3: Download Confidential Backup File (`GET /api/v1/admin/wallet/export-secrets`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response:** Direct text file attachment `earncraft_master_vault_YYYYMMDD_HHMMSS.txt` containing the master address, 12-word seed phrase, private key, BSC network chain ID, and USDT contract address.

#### Step 4: Confirm Vault Initialization (`POST /api/v1/admin/wallet/confirm-init`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:** `{}`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Master vault initialization confirmed successfully!",
  "data": {
    "is_initialized": true
  }
}
```
### 3. Flexible Payout Modes & Withdrawal Lifecycle

The system supports two distinct payout modes configured dynamically by the Admin:

#### ⚙️ Payout Modes:
1. **Manual Review Mode (`payout_mode: "manual"`):**
   - User withdrawal requests are added to the `processing` queue.
   - User balance is deducted atomically.
   - The Admin views the request in the Admin Panel and chooses one of 3 actions below.
2. **Instant Automated Mode (`payout_mode: "instant"`):**
   - When a user requests withdrawal, the backend immediately checks Master HD Vault reserves on BNB Smart Chain.
   - If reserves and gas are sufficient, the backend signs and broadcasts the on-chain BEP-20 USDT transfer instantly, returning the live `tx_hash` and BSCScan URL to the user!
   - If the vault has insufficient funds or gas, it automatically and gracefully falls back to the `processing` queue for admin review without throwing an error.

#### 🎛️ 3 Admin Payout Actions (in Manual Review Mode):
- **Action 1: Pay from Master HD Vault ⚡ (`POST /admin/withdrawals/:id/payout`):**
  - Backend signs and broadcasts an on-chain BEP-20 USDT transfer from the created Master HD Vault to the user's address.
  - Marks withdrawal `status = 'completed'` with live on-chain `tx_hash`.
- **Action 2: Accept / Mark Paid Manually 📝 (`POST /admin/withdrawals/:id/manual-paid`):**
  - Admin copies the user's BEP-20 address, makes the transfer manually from their preferred external wallet/exchange (Binance, TrustWallet, etc.), and clicks "Mark Paid" (optionally entering external tx hash or notes).
  - Marks withdrawal `status = 'completed'`.
- **Action 3: Reject & Refund ❌ (`POST /admin/withdrawals/:id/reject`):**
  - Admin rejects the request with an optional reason note.
  - Automatically refunds the full requested USD amount back to the user's balance in PostgreSQL.
  - Marks withdrawal `status = 'rejected'`.

---

### 4. Promo Codes, Gift Vouchers & Bulk Batches Management

The system supports two distinct promo code workflows:

#### 🎟️ 1. Custom Community Codes (`POST /api/v1/admin/gift-codes`)
- **Use Case:** Single shared promo code posted on Telegram or Twitter (e.g. `LAUNCH2026`).
- **Rules:** Set `max_claims` (e.g. 500 users). Each user can only redeem once (anti-abuse enforced in `gift_code_claims`).
- **Request Body:**
```json
{
  "code": "LAUNCH2026",
  "reward_diamonds": 500,
  "reward_spins": 10,
  "reward_usd": 0.50,
  "max_claims": 500,
  "expires_in_days": 7
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Gift code created successfully",
  "data": {
    "id": 15,
    "code": "LAUNCH2026",
    "rewardDiamonds": 500,
    "rewardSpins": 10,
    "rewardUsd": 0.50,
    "maxClaims": 500,
    "currentClaims": 0,
    "isActive": true
  }
}
```

#### 📦 2. Bulk Unique Vouchers & CSV Exports (`POST /api/v1/admin/gift-codes/bulk-generate`)
- **Use Case:** Generates $N$ unique, cryptographically random single-use vouchers grouped into a Batch (e.g. `VIP-A89F3C12`, `VIP-B94E7120`) for direct distribution or CSV export.
- **Request Body:**
```json
{
  "batch_name": "VIP Telegram Giveaway 50x",
  "quantity": 50,
  "prefix": "VIP-",
  "reward_diamonds": 1000,
  "reward_spins": 5,
  "reward_usd": 1.00,
  "expires_in_days": 30
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully generated 50 unique gift codes! 🎉",
  "data": {
    "batchId": "BATCH-1724800100",
    "count": 50,
    "codes": ["VIP-A89F3C12", "VIP-B94E7120", "VIP-C0129A88"],
    "csvExport": "code,batch_id,batch_name,reward_diamonds,reward_spins,reward_usd\n..."
  }
}
```

#### 📊 3. Batches & Claimers Inspection:
- `GET /api/v1/admin/gift-codes/batches` — List all bulk batches with real-time redemption counters (`totalCodes`, `claimedCodes`, `unclaimedCodes`).
- `GET /api/v1/admin/gift-codes/batches/:batch_id` — View all codes in that batch, showing which code was redeemed and by whom (@username, Telegram ID, date).
- `GET /api/v1/admin/gift-codes/batches/:batch_id/export-csv` — Direct spreadsheet download attachment (`.csv`) of all codes in that batch.
- `GET /api/v1/admin/gift-codes/:id/claims` — List exact users who redeemed a specific promo code.
- `GET /api/v1/admin/gift-codes/:id/export-csv` — Direct `.csv` download of all redemptions for a single code.
- `DELETE /api/v1/admin/gift-codes/batches/:batch_id` — Revoke / delete all codes in a bulk batch in 1 click.

---

### 5. Temporary Signed CSV Export Download Links & Dual-Mode Auth

When admins in Telegram Mini App export CSVs or open links in external browsers (Safari/Chrome), they can generate a cryptographically signed, 5-minute temporary link without exposing secret keys in URLs:

#### A. Generate Temporary Export Link (`POST /api/v1/admin/export/temp-link`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:**
```json
{
  "export_type": "withdrawals" // or "users", "gift-codes", "batches"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "download_url": "https://api.yourdomain.com/api/v1/admin/export/withdrawals.csv?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "export_type": "withdrawals",
    "expires_in": 300
  }
}
```

#### B. Dual-Mode Authentication on CSV Exports (`GET /api/v1/admin/export/:file`)
- **Mode A (In-App API Call):** Send header `Authorization: Bearer <admin_token>`.
- **Mode B (Browser Download Link):** Pass query parameter `?token=<temp_token>`.
- **Available Export Streams:**
  - `GET /api/v1/admin/export/withdrawals.csv` (or `/export/withdrawals`)
  - `GET /api/v1/admin/export/users.csv` (or `/export/users`)
  - `GET /api/v1/admin/export/gift-codes.csv` (or `/export/gift-codes`)
  - `GET /api/v1/admin/export/batches.csv` (or `/export/batches`)

---

### 6. Wheel of Fortune & Spin Probability Management

Admins have full global control over winning chances, item probability weights, and reward sizes for all Wheel of Fortune spins.

#### A. Fetch Current Wheel Probability Settings (`GET /api/v1/admin/wheel/settings`)
- **Method:** `GET /api/v1/admin/wheel/settings` (or `/admin/spin/probabilities`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      { "index": 0, "value": "gem", "label": "Diamond", "weight": 30, "percent": 30.0, "rewardAmount": "+80 💎" },
      { "index": 1, "value": "coins", "label": "Coins (USD Cash)", "weight": 25, "percent": 25.0, "rewardAmount": "+$0.01 - $0.05" },
      { "index": 2, "value": "spin_ticket", "label": "Spin Ticket", "weight": 15, "percent": 15.0, "rewardAmount": "+1 Free Spin" },
      { "index": 3, "value": "double_reward", "label": "Double Reward", "weight": 8, "percent": 8.0, "rewardAmount": "2x Multiplier" },
      { "index": 4, "value": "spin_ticket_2", "label": "Spin Ticket x2", "weight": 10, "percent": 10.0, "rewardAmount": "+2 Free Spins" },
      { "index": 5, "value": "gem_large", "label": "Mega Diamonds", "weight": 12, "percent": 12.0, "rewardAmount": "+300 💎" }
    ],
    "totalWeight": 100,
    "diamondReward": 80,
    "megaDiamondReward": 300,
    "minCashReward": 0.01,
    "maxCashReward": 0.05
  }
}
```

#### B. Update Wheel Probabilities & Rewards (`POST /api/v1/admin/wheel/settings`)
- **Method:** `POST /api/v1/admin/wheel/settings` (or `/admin/spin/probabilities`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:**
```json
{
  "weight_diamonds": 35,
  "weight_cash": 20,
  "weight_spin_ticket": 15,
  "weight_double_reward": 8,
  "weight_spin_ticket_2": 10,
  "weight_gem_large": 12,
  "diamond_reward": 100,
  "mega_diamond_reward": 500,
  "min_cash_reward": 0.01,
  "max_cash_reward": 0.05
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Wheel probability weights and prize settings updated successfully! 🎡",
  "data": { ... }
}
```

---

### 7. 7-Day Daily Streak Rewards Configurator

Admins can customize the exact rewards granted for every single day (Days 1 to 7) of the user's daily check-in streak, supporting multi-asset rewards (Diamonds, Free Spins, USD Cash).

#### A. Fetch Current 7-Day Streak Rewards (`GET /api/v1/admin/rewards/daily`)
- **Method:** `GET /api/v1/admin/rewards/daily`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "days": [
      { "day": 1, "rewardGems": 80, "rewardSpins": 0, "rewardUsd": 0.0, "label": "Up to 80 💎", "icon": "./assets/purple-diamond.png", "isMega": false },
      { "day": 2, "rewardGems": 80, "rewardSpins": 0, "rewardUsd": 0.0, "label": "+80 💎", "icon": "./assets/purple-diamond.png", "isMega": false },
      { "day": 3, "rewardGems": 200, "rewardSpins": 1, "rewardUsd": 0.0, "label": "+200 💎 + 1 Spin", "icon": "./assets/giftIconInDailySignIn.png", "isMega": false },
      { "day": 4, "rewardGems": 90, "rewardSpins": 0, "rewardUsd": 0.0, "label": "+90 💎", "icon": "./assets/purple-diamond.png", "isMega": false },
      { "day": 5, "rewardGems": 90, "rewardSpins": 0, "rewardUsd": 0.0, "label": "+90 💎", "icon": "./assets/purple-diamond.png", "isMega": false },
      { "day": 6, "rewardGems": 90, "rewardSpins": 0, "rewardUsd": 0.0, "label": "+90 💎", "icon": "./assets/purple-diamond.png", "isMega": false },
      { "day": 7, "rewardGems": 6000, "rewardSpins": 5, "rewardUsd": 0.50, "label": "MEGA +6000 💎 + 5 Spins + $0.50", "icon": "./assets/giftIconInDailySignIn.png", "isMega": true }
    ]
  }
}
```

#### B. Update 7-Day Streak Rewards (`POST /api/v1/admin/rewards/daily`)
- **Method:** `POST /api/v1/admin/rewards/daily`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:**
```json
{
  "days": [
    { "day": 1, "reward_gems": 100, "reward_spins": 1, "reward_usd": 0.0, "label": "+100 💎 + 1 Spin", "is_mega": false },
    { "day": 2, "reward_gems": 150, "reward_spins": 1, "reward_usd": 0.0, "label": "+150 💎 + 1 Spin", "is_mega": false },
    { "day": 3, "reward_gems": 300, "reward_spins": 2, "reward_usd": 0.05, "label": "+300 💎 + 2 Spins", "is_mega": false },
    { "day": 4, "reward_gems": 200, "reward_spins": 1, "reward_usd": 0.0, "label": "+200 💎 + 1 Spin", "is_mega": false },
    { "day": 5, "reward_gems": 250, "reward_spins": 1, "reward_usd": 0.0, "label": "+250 💎 + 1 Spin", "is_mega": false },
    { "day": 6, "reward_gems": 300, "reward_spins": 2, "reward_usd": 0.0, "label": "+300 💎 + 2 Spins", "is_mega": false },
    { "day": 7, "reward_gems": 10000, "reward_spins": 10, "reward_usd": 1.00, "label": "MEGA +10,000 💎 + 10 Spins + $1.00", "is_mega": true }
  ]
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "7-Day Daily Streak rewards updated successfully! 📅",
  "data": { ... }
}
```

---

### 8. Referral & Initial Starting Spins Configurator

Admins can customize:
1. **Direct (Organic) Starting Spins:** Initial spins assigned when an organic user opens the app for the first time without an invite link (`initialOrganicSpins`, default `12`).
2. **Referrer Rewards:** Multi-asset prizes granted to the inviter (`referrerSpins`, `referrerDiamonds`, `referrerUsd`).
3. **Referee Welcome Gift:** Multi-asset gifts granted to the new friend joining via invite link (`welcomeSpins`, `welcomeDiamonds`, `welcomeUsd`).

#### A. Fetch Current Referral & Initial Starting Spins (`GET /api/v1/admin/rewards/referral`)
- **Method:** `GET /api/v1/admin/rewards/referral` (or `/admin/referral-settings`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "initialOrganicSpins": 12,
    "referrerSpins": 1,
    "referrerDiamonds": 100,
    "referrerUsd": 0.05,
    "welcomeSpins": 3,
    "welcomeDiamonds": 200,
    "welcomeUsd": 0.00
  }
}
```

#### B. Update Referral & Initial Starting Spins (`POST /api/v1/admin/rewards/referral`)
- **Method:** `POST /api/v1/admin/rewards/referral` (or `/admin/referral-settings`)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Request Body:**
```json
{
  "initial_organic_spins": 15,
  "referrer_spins": 2,
  "referrer_diamonds": 500,
  "referrer_usd": 0.10,
  "welcome_spins": 5,
  "welcome_diamonds": 1000,
  "welcome_usd": 0.25
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Referral multi-asset rewards updated successfully! 👥",
  "data": { ... }
}
```

---

### Admin Endpoints Overview:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/admin/auth` | Login via `secret_key` and obtain Admin JWT token |
| `GET` | `/api/v1/admin/wallet-status` | Master wallet initialization status, BNB gas & USDT reserves |
| `POST` | `/api/v1/admin/wallet/generate` | Generate fresh 12-word seed phrase, address & private key |
| `POST` | `/api/v1/admin/wallet/import` | Import existing seed phrase or private key |
| `POST` | `/api/v1/admin/wallet/confirm-init` | Confirm vault setup and unlock full admin dashboard |
| `GET` | `/api/v1/admin/wallet/secrets` | View vault secrets JSON |
| `GET` | `/api/v1/admin/wallet/export-secrets` | Download confidential `vault_secrets.txt` backup |
| `GET` | `/api/v1/admin/financial-stats` | Aggregated deposits, payouts, gross volume, net margin |
| `GET` | `/api/v1/admin/analytics/traffic` | Real-time active users, DAU, and HTTP traffic metrics |
| `GET` | `/api/v1/admin/wheel/settings` | Get current wheel probability weights, % chances & rewards |
| `POST` | `/api/v1/admin/wheel/settings` | Update live spin winning chances & prize amounts |
| `GET` | `/api/v1/admin/rewards/daily` | Get 7-day daily streak reward configuration |
| `POST` | `/api/v1/admin/rewards/daily` | Update 7-day daily streak reward ladder & prizes |
| `GET` | `/api/v1/admin/rewards/referral` | Get referral reward rules for referrer & invited user |
| `POST` | `/api/v1/admin/rewards/referral` | Update referral multi-asset reward rules |
| `GET` | `/api/v1/admin/contests` | List all tournaments with full prize distribution rules |
| `POST` | `/api/v1/admin/contests` | Create new tournament with custom prize tiers (Ranks 1 to 20+) |
| `PUT` | `/api/v1/admin/contests/:id` | Update tournament prize pool, ladder & dates |
| `DELETE` | `/api/v1/admin/contests/:id` | Delete a tournament |
| `POST` | `/api/v1/admin/contests/:id/distribute-prizes` | Automated prize payout directly to winners' balances |
| `GET` | `/api/v1/admin/raffles` | List all lotteries & participants |
| `POST` | `/api/v1/admin/raffles` | Create a new raffle |
| `POST` | `/api/v1/admin/raffles/:id/draw` | Draw winner and credit grand prize |
| `GET` | `/api/v1/admin/tasks` | List tasks & quests |
| `POST` | `/api/v1/admin/tasks` | Create/update task with picture upload & rewards |
| `DELETE` | `/api/v1/admin/tasks/:id` | Delete task |
| `GET` | `/api/v1/admin/connected-chats` | Pulls Telegram channels connected to bot |
| `POST` | `/api/v1/admin/connected-chats` | Manually link Telegram channel for task verification |
| `DELETE` | `/api/v1/admin/connected-chats/:id` | Unlink connected channel |
| `GET` | `/api/v1/admin/users` | Paginated user list with balances, VIP & ban status |
| `GET` | `/api/v1/admin/users/lookup?q=...` | Search user by Telegram ID, Username, or Name |
| `POST` | `/api/v1/admin/users/:id/adjust-balance` | Manual balance credit/debit adjustment with audit note |
| `GET` | `/api/v1/admin/stats/overview` | Combined financial, wallet reserve, and user analytics |
| `GET` | `/api/v1/admin/payout-settings` | Current payout mode (`manual` vs `instant`) & limits |
| `POST` | `/api/v1/admin/payout-settings` | Update payout mode, fee percent & instant payout limits |
| `GET` | `/api/v1/admin/withdrawals` | Filter cashouts (`status=processing\|completed\|rejected\|all`, search) |
| `POST` | `/api/v1/admin/withdrawals/:id/payout` | **Pay via Master Vault ⚡** (Broadcast on-chain BEP-20 transfer) |
| `POST` | `/api/v1/admin/withdrawals/:id/manual-paid` | **Mark Paid Manually 📝** (External Binance/TrustWallet transfer) |
| `POST` | `/api/v1/admin/withdrawals/:id/reject` | **Reject & Refund ❌** (Refunds user balance with reason note) |
| `GET` | `/api/v1/admin/gift-codes` | List promo gift codes (filters: `?type=all\|custom\|bulk&q=...`) |
| `POST` | `/api/v1/admin/gift-codes` | Create custom gift code (`LAUNCH2026`) |
| `POST` | `/api/v1/admin/gift-codes/bulk-generate` | Bulk generate N random gift codes under a batch |
| `GET` | `/api/v1/admin/gift-codes/batches` | List all bulk batches with summary stats |
| `GET` | `/api/v1/admin/gift-codes/batches/:batch_id` | View all codes in a bulk batch with claimer info |
| `GET` | `/api/v1/admin/gift-codes/batches/:batch_id/export-csv` | Download batch codes CSV attachment |
| `DELETE` | `/api/v1/admin/gift-codes/batches/:batch_id` | Revoke entire bulk batch |
| `GET` | `/api/v1/admin/gift-codes/:id/claims` | View user list who redeemed a specific code |
| `GET` | `/api/v1/admin/gift-codes/:id/export-csv` | Download claims CSV for a single code |
| `DELETE` | `/api/v1/admin/gift-codes/:id` | Revoke a single gift code |
| `POST` | `/api/v1/admin/export/temp-link` | Generate 5-minute signed temporary CSV download URL |
| `GET` | `/api/v1/admin/export/users.csv` | Export entire user base to CSV (supports `?token=...`) |
| `GET` | `/api/v1/admin/export/withdrawals.csv` | Export withdrawal transactions to CSV (supports `?token=...`) |
| `GET` | `/api/v1/admin/export/gift-codes.csv` | Export promo gift codes to CSV (supports `?token=...`) |
| `GET` | `/api/v1/admin/export/batches.csv` | Export voucher batches to CSV (supports `?token=...`) |
| `GET` | `/api/v1/admin/transactions/failed` | View stuck sweeps and failed on-chain transactions |
| `POST` | `/api/v1/admin/invoices/:id/force-sweep` | Force re-sweep stuck USDT invoice deposit |
| `GET` | `/api/v1/admin/support/feedback` | View user support tickets & inbox |
| `POST` | `/api/v1/admin/support/feedback/:id/resolve` | Mark support ticket as resolved |
| `GET` | `/api/v1/admin/settings` | Dynamic system settings & feature flags |
| `POST` | `/api/v1/admin/settings` | Update system settings |
| `GET` | `/api/v1/admin/ads/config` | Adsgram rewarded ads configuration |
| `POST` | `/api/v1/admin/ads/config` | Update Adsgram block ID |

---

## 7. Ready-to-Use Axios Client Snippet

Create `src/services/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://orchestraai.duckdns.org/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

## 8. DevOps, Docker & VPS Deployment

### Docker Multi-Stage Build:
The backend uses a high-performance, lightweight multi-stage Alpine Dockerfile:
- **Builder:** `golang:alpine` with `CGO_ENABLED=0`
- **Runner:** `alpine:latest` with CA certificates and timezone data

### Deployment via Docker Compose:
```bash
# 1. Pull latest image from Docker Hub
docker compose pull backend

# 2. Start container in background
docker compose up -d

# 3. View live server request/response logs
docker compose logs -f backend
```
