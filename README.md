<div align="center">
  <img src="https://img.shields.io/badge/ColdStack-000?style=for-the-badge&logo=maildotru&logoColor=white" alt="ColdStack Logo" />
  <h1>ColdStack</h1>
  <p><strong>The Open-Source Cold Email Infrastructure & Deliverability Platform</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## 🎯 What is ColdStack?

ColdStack is an open-source, self-hostable alternative to platforms like Instantly, Lemlist, and Smartlead. It provides modern sales teams with the infrastructure needed to run high-volume cold email campaigns while protecting domain reputation through an intelligent, AI-powered warmup engine.

## ✨ Features

- **🧠 AI-Powered Warmup:** Uses Google Gemini to generate highly realistic, conversational emails that bypass spam filters.
- **📈 Deliverability Tracking:** Real-time monitoring of bounce rates, reply rates, and inbox health scores.
- **🔄 Smart IMAP Engagement:** Automated reading, threading, and delayed replying to simulate genuine human interaction.
- **📦 Multi-Tenant Architecture:** Manage multiple domains, inboxes, and campaigns securely.
- **⚡ Bulletproof Background Jobs:** Powered by Redis and BullMQ to ensure no tasks or emails are lost during server restarts.
- **🎨 Beautiful UI:** Built with Next.js 14, TailwindCSS, and Base UI for a responsive, modern experience.

## 🛠 Tech Stack

ColdStack is built as a highly scalable monorepo.

- **Frontend:** Next.js 14, React Query, TailwindCSS, Base UI, Lucide Icons
- **Backend API:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Task Queues:** Redis & BullMQ
- **Email Engines:** Nodemailer (SMTP), ImapFlow (IMAP)
- **AI Integration:** Google Gemini API

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)

### Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/muhammadaliqamar/coldstack.git
   cd coldstack
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy the example environment file and fill in your database, Redis, and Gemini API credentials.
   ```bash
   cp .env.example .env
   ```

4. **Initialize the database:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Start the development environment:**
   This command concurrently spins up the Frontend, API server, and Background Workers.
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - Frontend Dashboard: `http://localhost:3000`
   - API Server: `http://localhost:4000`

## 🏗 Architecture

ColdStack utilizes an npm workspace monorepo to separate concerns logically:

```
coldstack/
├── apps/
│   ├── api/        # Express server & BullMQ background workers
│   └── web/        # Next.js 14 dashboard application
├── packages/
│   ├── db/         # Prisma schema and generated client
│   ├── mailer/     # Nodemailer and ImapFlow utilities
│   └── queue/      # BullMQ queue definitions
└── package.json
```

## 🤝 Contributing

We welcome contributions from the community! ColdStack is in active development, and we are looking for help with:

- Exchange/Microsoft OAuth Integration
- Proxy Support for IMAP/SMTP routing
- Advanced Spintax logic for Campaigns
- Docker setup for one-click deployment

Please check out our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
