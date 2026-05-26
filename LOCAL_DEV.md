# Local Development Guide - Hub Community Stack

This guide explains how to set up and run the entire Hub Community ecosystem (Backend, BFF, and Frontend) locally using Docker.

## 🚀 Quick Start

1. **Navigate to the frontend directory:**
   ```bash
   cd hub-community-frontend
   ```

2. **Start the stack:**
   ```bash
   docker compose -f docker-compose.hub.yml up --build
   ```

## 🌍 Services Summary

| Service | Local URL | Description |
|---------|-----------|-------------|
| **Frontend** | [http://localhost:4010](http://localhost:4010) | Next.js Application |
| **BFF** | [http://localhost:4001/graphql](http://localhost:4001/graphql) | GraphQL Layer |
| **Backend** | [http://localhost:1340/admin](http://localhost:1340/admin) | Strapi CMS |
| **Database** | `localhost:3307` | MySQL 8.0 |

---

## 🔑 Required Initial Setup

Since you are starting with a fresh local database, you must configure Strapi to allow the BFF to communicate with it.

### 1. Initialize Strapi Admin
- Go to [http://localhost:1340/admin](http://localhost:1340/admin).
- Create your local administrator account.

### 2. Generate API Token
The BFF needs a "Full Access" token to fetch data from the backend.
- In the Strapi Admin sidebar, go to **Settings** -> **API Tokens**.
- Click **+ Create new API Token**.
- **Name:** `Local Dev`
- **Token duration:** `Unlimited`
- **Token type:** `Full Access`
- Click **Save**.
- **Copy the token** immediately (it will only be shown once).

### 3. Update Docker Configuration
- Open `hub-community-frontend/docker-compose.hub.yml`.
- Find the `hub-bff` service.
- Update the `MANAGER_TOKEN_INTEGRATION` environment variable with your new token.

### 4. Restart the BFF
```bash
docker compose -f docker-compose.hub.yml up -d hub-bff
```

---

## 🛠️ Features & Development

### CPF Field (Brazil)
The signup form now includes a **CPF** field. 
- **Backend:** Mapped to `social_security_number` in the User content-type.
- **Validation:** The frontend includes a mathematical validation and mask (000.000.000-00).

### Troubleshooting
- **Port Conflicts:** If port 3306 is busy, the database is mapped to **3307** on your host.
- **Hot Reload:** Changes made to files in `src/` directories will automatically trigger a reload inside the containers.
- **Database Persistence:** Data is stored in the `hub-community-frontend_hub-db-data` volume. To start fresh, run `docker compose -f docker-compose.hub.yml down -v`.
