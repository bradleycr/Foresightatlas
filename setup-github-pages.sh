#!/bin/bash

# GitHub Pages Setup Script
# This script sets up your repository for GitHub Pages deployment using GitHub CLI

set -e

echo "🚀 Setting up GitHub Pages deployment..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "   Run: gh auth login"
    exit 1
fi

# Get repository name from current directory or ask user
REPO_NAME=$(basename "$(pwd)")

echo "📦 Repository name: $REPO_NAME"

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit"
fi

# Check if remote exists
if ! git remote get-url origin &> /dev/null; then
    echo "🔗 Creating GitHub repository..."
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
else
    echo "✅ Remote already exists, pushing to origin..."
    git push -u origin main 2>/dev/null || git push -u origin master 2>/dev/null || echo "⚠️  Could not push. You may need to push manually."
fi

echo ""
echo "✅ Repository setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Go to your repository on GitHub:"
echo "      $(gh repo view --web 2>/dev/null || echo "https://github.com/$(gh api user --jq .login)/$REPO_NAME")"
echo ""
echo "   2. Enable GitHub Pages:"
echo "      - Click 'Settings' > 'Pages'"
echo "      - Under 'Source', select 'GitHub Actions'"
echo "      - Save"
echo ""
echo "   3. Your site will be available at:"
echo "      https://$(gh api user --jq .login).github.io/$REPO_NAME/"
echo ""
echo "   The GitHub Actions workflow will automatically deploy on every push to main."
echo ""



