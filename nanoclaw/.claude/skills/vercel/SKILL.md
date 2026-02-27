# Vercel CLI Skill

Manage Vercel deployments for the Shabti dashboard.

## Auth

All commands use `--token $VERCEL_KEY` (stored in `.env`). Read the token before running commands:

```bash
VERCEL_KEY=$(grep '^VERCEL_KEY=' /home/joshuaanderson/shabti/.env | cut -d= -f2)
```

The project ID is set in `.env` as `VERCEL_PROJECT_ID`.

## Commands

### List deployments
```bash
vercel ls --token "$VERCEL_KEY"
```

### Inspect a deployment
```bash
vercel inspect <deployment-url> --token "$VERCEL_KEY"
```

### View deployment logs
```bash
vercel logs <deployment-url> --token "$VERCEL_KEY"
```

### List environment variables
```bash
vercel env ls --token "$VERCEL_KEY"
```

### Add an environment variable
```bash
echo "<value>" | vercel env add <name> production --token "$VERCEL_KEY"
```

### Deploy to production
```bash
cd /home/joshuaanderson/shabti/dashboard && vercel --prod --token "$VERCEL_KEY"
```

### Deploy preview
```bash
cd /home/joshuaanderson/shabti/dashboard && vercel --token "$VERCEL_KEY"
```

### Local dev server
```bash
cd /home/joshuaanderson/shabti/dashboard && vercel dev --token "$VERCEL_KEY"
```

## Dashboard

The dashboard is a Next.js app at `dashboard/`. It connects to the Shabti API at `http://35.184.13.242:3001`.

### Environment variables (set on Vercel project)
- `SHABTI_API_URL` — API base URL (e.g., `http://35.184.13.242:3001`)
- `SHABTI_API_KEY` — API key for authentication

### Redeploy after changes
```bash
cd /home/joshuaanderson/shabti/dashboard && vercel --prod --token "$VERCEL_KEY"
```
