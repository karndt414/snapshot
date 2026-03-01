# Snapshot Server

Next.js + Supabase backend for the Snapshot Tool Electron app. Hosts a web dashboard and API for managing snapshots from multiple machines.

## Setup (5 steps)

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New project (free)
2. Go to **SQL Editor** → paste the contents of `supabase-schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Set up environment variables locally
```bash
cp .env.local.example .env.local
# Fill in the values from Supabase
```

### 3. Run locally
```bash
npm run dev
# Open http://localhost:3000/dashboard
```

### 4. Deploy to Vercel
```bash
npm install -g vercel
vercel
```
In the Vercel dashboard, add these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_SECRET_KEY` (make up a long random string)
- `NEXT_PUBLIC_API_KEY` (same value as API_SECRET_KEY)

### 5. Configure the Electron app
Copy `.env.example` to `.env` in the Electron project and fill in:
```
SNAPSHOT_SERVER_URL=https://your-app.vercel.app
SNAPSHOT_API_KEY=your-secret-api-key-here
MACHINE_ID=my-macbook-pro
MACHINE_NAME=Koree's MacBook Pro
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/snapshots` | Upload a snapshot |
| GET | `/api/snapshots` | List all snapshots |
| GET | `/api/snapshots/:id` | Load one snapshot |
| DELETE | `/api/snapshots/:id` | Delete a snapshot |
| POST | `/api/compare` | Compare two snapshots by ID |

All endpoints require header: `x-api-key: your-secret`
