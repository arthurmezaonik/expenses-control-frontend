# Personal Finance Frontend

React + TypeScript frontend for the personal finance tracker API.

## Development

```sh
npm install
cp .env.example .env.local
npm run dev
```

## GitHub Pages deployment

The repository deploys to GitHub Pages from `main` using `.github/workflows/deploy.yml`. In the repository settings, open **Pages** and set the source to **GitHub Actions**. The workflow builds the app at `/expenses-control-frontend/`, which is the project-site path for this repository.

After the backend is deployed, add a repository variable named `VITE_API_BASE_URL` with the backend's HTTPS origin (for example, `https://your-api.onrender.com`). Push a commit or run the workflow manually to rebuild the frontend with that API URL. Until the variable is set, the frontend uses the local development default and cannot reach the deployed API.

For local development, set `VITE_API_BASE_URL` to the Spring Boot API origin. The current controllers expose `/transactions`, `/categories`, and `/summary` directly, without a shared `/api` prefix.

The API client and response types are in `src/api`. The backend issues a short-lived JWT after login; the frontend sends it as an `Authorization: Bearer` header and stores it in `sessionStorage` so a reload in the same tab does not require signing in again.

## Authentication storage decision

This project accepts the `sessionStorage` tradeoff for a personal, single-account app: JavaScript running on this origin can read the access token, so an XSS vulnerability could steal it. The choice reflects the app's current use and data value, rather than treating browser storage as risk-free. The access token expires after 15 minutes by default. Closing the tab clears the stored token, and signing out removes it from this tab. There is no refresh token or server-side revocation, so a copied token remains usable until it expires. Use HTTPS when the app is reachable beyond a trusted local network.
