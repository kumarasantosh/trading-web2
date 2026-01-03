# GitHub Actions Setup for Automated Data Capture

This project uses GitHub Actions to automatically capture market data every 5 minutes during market hours (9:15 AM - 3:30 PM IST, Monday-Friday).

## Setup Instructions

### Step 1: Deploy to Vercel (without cron)

First, deploy your app to Vercel:

```bash
# Remove cron from vercel.json (already done)
vercel --prod
```

After deployment, note your Vercel URL (e.g., `https://trading-website.vercel.app`)

### Step 2: Push to GitHub

```bash
# Create a new repository on GitHub (https://github.com/new)
# Then push your code:

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 3: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Secret Name | Value |
|------------|-------|
| `VERCEL_URL` | Your Vercel deployment URL (e.g., `https://trading-website.vercel.app`) |
| `CRON_SECRET` | Same value as in your `.env.local` |

### Step 4: Enable GitHub Actions

1. Go to **Actions** tab in your repository
2. Click **"I understand my workflows, go ahead and enable them"**
3. The workflow will start running automatically!

### Step 5: Verify It's Working

1. Go to **Actions** tab
2. Click on **"Capture Market Data"** workflow
3. You should see runs every 5 minutes during market hours
4. Click on a run to see the logs
5. Check your Supabase dashboard to verify data is being saved

## Manual Trigger

You can manually trigger the workflow:

1. Go to **Actions** tab
2. Click **"Capture Market Data"**
3. Click **"Run workflow"**
4. Click the green **"Run workflow"** button

## Schedule Details

The workflow runs:
- **Every 5 minutes** from 9:15 AM to 3:30 PM IST
- **Monday to Friday** only
- Automatically converts IST to UTC for GitHub Actions

## Monitoring

- Check **Actions** tab for workflow runs
- Each run shows success/failure status
- Click on a run to see detailed logs
- Failures will be highlighted in red

## Cost

✅ **Completely FREE!**
- GitHub Actions provides 2,000 free minutes/month
- This workflow uses ~1 minute per day
- Well within free tier limits

## Troubleshooting

**Workflow not running:**
- Check that GitHub Actions is enabled in repository settings
- Verify secrets are added correctly
- Check the Actions tab for any error messages

**401 Unauthorized error:**
- Verify `CRON_SECRET` matches your `.env.local`
- Check `VERCEL_URL` is correct (no trailing slash)

**No data in Supabase:**
- Check Vercel deployment logs
- Verify Supabase environment variables are set in Vercel
- Test the endpoint manually: `./test-cron.sh`

## Alternative: Vercel Cron (Paid)

If you upgrade to Vercel Pro ($20/month), you can use Vercel's built-in cron instead:

1. Uncomment the `crons` section in `vercel.json`
2. Redeploy to Vercel
3. Disable GitHub Actions workflow

---

🎉 **Your automated data capture is now running on GitHub Actions!**
