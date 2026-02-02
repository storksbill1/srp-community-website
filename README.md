# SRP Community Roster – Auth Ready

## Super Easy Setup

### 1. Install deps
npm install

### 2. Firebase
- Create Firebase project
- Enable Auth: Email/Password + Google
- Add OIDC provider:
  - Provider ID: oidc.discord
  - Client ID/Secret from Discord
  - Issuer: https://discord.com
  - Authorization endpoint: https://discord.com/api/oauth2/authorize
  - Token endpoint: https://discord.com/api/oauth2/token
  - User info endpoint: https://discord.com/api/users/@me

### 3. Env
Copy `.env.example` → `.env` and paste keys

### 4. Run
npm run dev

### 5. Deploy
Import into Vercel → Done
