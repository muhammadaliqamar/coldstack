# Contributing to ColdStack

First off, thank you for considering contributing to ColdStack! It's people like you that make ColdStack such a great platform. We welcome contributions from everyone—whether it's fixing bugs, improving documentation, or adding major features.

## Code of Conduct

By participating in this project, you are expected to uphold a welcoming, inclusive, and professional environment. Please be respectful to all contributors.

## How Can I Contribute?

### 🐛 Reporting Bugs
If you find a bug, please create an issue on GitHub. Include:
1. A clear and descriptive title.
2. Steps to reproduce the issue.
3. Your operating system, Node.js version, and browser version.
4. Relevant logs or screenshots.

### ✨ Suggesting Enhancements
Have an idea for a new feature? We'd love to hear it!
1. Open an issue and label it as an `enhancement`.
2. Provide a detailed description of the feature, why it's needed, and how it should work.

### 💻 Contributing Code
If you want to contribute code, follow these steps:

1. **Fork the Repository**: Create your own fork of the `coldstack` repository.
2. **Create a Branch**: Create a new branch for your feature or bug fix.
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Set Up the Environment**: Follow the instructions in the `README.md` to run the project locally.
4. **Make Your Changes**: Write clean, self-documenting code. Ensure you follow the project's coding style and conventions.
5. **Lint and Test**: Run the linter and ensure your code doesn't break any existing functionality.
   ```bash
   npm run lint
   ```
6. **Commit Your Changes**: Use clear and descriptive commit messages.
   ```bash
   git commit -m "feat: add proxy support for IMAP connections"
   ```
7. **Push to Your Fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request**: Submit a Pull Request (PR) to the `main` branch of the original repository. Provide a detailed description of your changes.

## Development Setup & Architecture

ColdStack is a monorepo built with npm workspaces. 

- **`apps/web`**: Next.js frontend. Use React components and TailwindCSS for styling.
- **`apps/api`**: Express backend and BullMQ workers. This is where business logic, background jobs, and API routes live.
- **`packages/db`**: Prisma schema. If you change `schema.prisma`, remember to run `npm run db:generate`.
- **`packages/queue`**: BullMQ definitions.
- **`packages/mailer`**: Nodemailer and IMAPFlow utilities.

**Important Note on Workers:** When running the development server (`npm run dev`), the API, Web, and Worker processes run concurrently. Background tasks like sending warmup emails and checking IMAP happen in the `dev:worker` process.

## Pull Request Guidelines

- Ensure your PR is focused on a single feature or bug fix.
- Do not include unrelated changes (e.g., formatting fixes in unrelated files).
- Keep PRs as small as possible to make reviewing easier.
- If your PR introduces a visual change, please include a screenshot or GIF.

## High Priority Areas for Contribution

If you're looking for something to work on, here are a few areas we'd love help with:
- **Exchange/Microsoft OAuth Integration**: Adding native support for Microsoft 365 accounts.
- **Proxy Support**: Routing IMAP/SMTP connections through HTTP/SOCKS5 proxies.
- **Dockerization**: Providing a `docker-compose.yml` for one-click deployments.

Thank you for contributing! 🚀
