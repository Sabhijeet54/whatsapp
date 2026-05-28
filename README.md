# WhatsApp Bulk Messaging Web App (Full Stack)

Modern full-stack app for sending WhatsApp messages to cleaned/imported contact lists with live dashboard updates.

## Tech Stack

- Frontend: Next.js App Router, Tailwind CSS, shadcn/ui, axios, socket.io-client, react-hot-toast, lucide-react
- Backend: Node.js, Express.js, whatsapp-web.js, Puppeteer, Socket.io, multer, xlsx, node-cache

## Folder Structure

```bash
whats app web/
  backend/
    src/
      middleware/
      routes/
      services/
      utils/
      config.js
      server.js
    uploads/
    data/
    .env.example
    package.json
  frontend/
    src/
      app/
        (main)/
          dashboard/
          bulk-sender/
          history/
          settings/
        login/
      components/
      hooks/
      lib/
    .env.example
    package.json
```

## Install Commands

Run from project root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
WHATSAPP_HEADLESS=true
DEFAULT_COUNTRY_CODE=91
MAX_SEND_PER_MINUTE=18
# Optional when Chromium auto-detect fails
# PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Run Locally

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000/api/health

## Main Features Implemented

- QR login with LocalAuth session persistence
- Auto reconnect attempts on disconnect
- Smart number parsing (text / CSV / XLSX / TXT)
- Auto-clean + dedupe + Indian country code normalization
- Invalid number capture
- Bulk queue with random min/max delay
- Pause / Resume / Stop controls
- Optional schedule time for batch
- Message variables (`{name}`)
- Media attachment + caption
- Real-time status, progress, logs via socket.io
- History persistence + CSV export
- Contacts import/search/export
- Template management for multi-message reuse
- Dark mode + responsive admin UI + sidebar

## VPS Deployment (Ubuntu + PM2 + Nginx)

1. Install Node.js 20+, nginx, pm2.
2. Clone project and create backend/frontend env files.
3. Build frontend:

```bash
cd frontend
npm run build
```

4. Start backend and frontend with pm2:

```bash
pm2 start "npm run start" --name whatsapp-backend --cwd ./backend
pm2 start "npm run start" --name whatsapp-frontend --cwd ./frontend
pm2 save
pm2 startup
```

5. Nginx reverse proxy example:
- `yourdomain.com` -> frontend port 3000
- `yourdomain.com/api` and websocket upgrade -> backend port 5000

6. Keep persistent storage directories:
- `backend/.wwebjs_auth` (created by LocalAuth)
- `backend/data`
- `backend/uploads`

## Notes

- Use only consent-based, policy-compliant messaging.
- Keep delay limits conservative for account safety.
- For production, use HTTPS and secure firewall rules.
