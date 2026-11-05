# Personal Finance Frontend

React + TypeScript frontend for the personal finance tracker API.

## Development

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_API_BASE_URL` to the Spring Boot API origin. The current controllers expose `/transactions`, `/categories`, and `/summary` directly; update this value if the backend later adds a shared `/api` prefix.

The API client and response types are in `src/api`. Authentication should be completed before exposing the API publicly.
