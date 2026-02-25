# GitHub Pages Deployment Guide

This project is configured for automatic deployment to GitHub Pages using GitHub Actions.

## Quick Setup with GitHub CLI

If you have the GitHub CLI (`gh`) installed, you can set everything up with these commands:

```bash
# 1. Initialize git repository (if not already done)
git init

# 2. Create a new GitHub repository and push your code
gh repo create foresightmap --public --source=. --remote=origin --push

# 3. Enable GitHub Pages in the repository settings
gh api repos/:owner/:repo/pages -X POST -f source='{"branch":"gh-pages","path":"/root"}' || echo "Note: You may need to enable Pages manually in Settings > Pages"

# Actually, GitHub Actions will handle the deployment automatically
# Just enable Pages in the repository settings:
gh repo view --web
# Then go to Settings > Pages and select "GitHub Actions" as the source
```

## Manual Setup Steps

1. **Create a GitHub repository** (if you haven't already):
   - Go to https://github.com/new
   - Create a new repository named `foresightmap` (or your preferred name)
   - Don't initialize with README, .gitignore, or license (if you already have local files)

2. **Push your code to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/foresightmap.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click on **Settings** > **Pages**
   - Under "Source", select **"GitHub Actions"** (not "Deploy from a branch")
   - The workflow will automatically deploy on every push to `main`

4. **Access your site**:
   - Your site will be available at: `https://YOUR_USERNAME.github.io/foresightmap/`
   - Note: It may take a few minutes for the first deployment to complete

## How It Works

- The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:
  - Builds your Vite app when you push to `main` with `VITE_BASE_PATH=/${{ repo name }}/`
  - Deploys the `dist/` output to GitHub Pages
- The app uses **base-path-aware routing** (`src/utils/router.ts`), so links and history work correctly at e.g. `https://username.github.io/Foresightmap/`.
- **Deep links**: Visiting a path that doesn’t exist as a file (e.g. `.../Foresightmap/berlin`) triggers GitHub’s 404 page. The included `404.html` redirects to the app root and stores the path in `sessionStorage` so the SPA can restore the route (e.g. Berlin page) without a second load.

## Local Development

For local development, the app runs normally:
```bash
pnpm install
pnpm run dev
```

The base path is only applied during the GitHub Pages build.

## Troubleshooting

- **404 errors**: Make sure the base path in `vite.config.ts` matches your repository name
- **Build fails**: Check the Actions tab in your GitHub repository for error details
- **Site not updating**: Wait a few minutes and check the Actions tab to see if deployment completed







