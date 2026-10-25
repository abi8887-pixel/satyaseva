# ☁️ Google Cloud Run Deployment Guide — Satyaseva Sisters Backend

This step-by-step guide walks you through deploying the Satyaseva Sisters backend to **Google Cloud Run** using the **Google Cloud Console (Web GUI)**.

---

## 📋 What Was Prepared in Your Codebase

1. **[Dockerfile](file:///home/jc/AB/fun/sscs/Dockerfile)**: Lightweight Python 3.11 container configured for Cloud Run.
2. **[.dockerignore](file:///home/jc/AB/fun/sscs/.dockerignore)**: Excludes local caches, secrets, test scripts, and Git metadata from the build.
3. **[scripts/serve.py](file:///home/jc/AB/fun/sscs/scripts/serve.py)**: Updated to read Google Cloud's `$PORT` environment variable (`8080`), bind to `0.0.0.0`, and dynamically allow Cloud Run domains (`*.run.app`) in CORS.
4. **Data Sync**: [`communities.json`](file:///home/jc/AB/fun/sscs/site/data/communities.json), [`communities-data.js`](file:///home/jc/AB/fun/sscs/site/data/communities-data.js), and [`sscs.db`](file:///home/jc/AB/fun/sscs/scripts/data/sscs.db) are completely synced.

---

## 🧭 Step-by-Step Google Cloud Console Walkthrough

### Step 1: Open Google Cloud Console & Create/Select Project
1. Open your browser and go to: **[https://console.cloud.google.com](https://console.cloud.google.com)**
2. Sign in with your Google Account.
3. In the top navigation bar, click the **Project Dropdown** (next to the "Google Cloud" logo).
4. Click **New Project** (or select an existing project).
   - **Project Name**: `sscs-portal` (or `satyaseva-sisters`)
   - Click **Create** and ensure it is selected.

---

### Step 2: Enable Required APIs
In the top search bar of the Cloud Console, search and click **Enable** for:
1. **Cloud Run Admin API**
2. **Cloud Build API** (used to automatically build the Dockerfile from source)

*(If prompted to enable billing, attach your Google Cloud Free Tier or billing account. Cloud Run includes 2 million free requests and 180,000 vCPU-seconds free every month).*

---

### Step 3: Deploy to Cloud Run from GitHub (Web GUI)

1. In the left navigation menu (or search bar), go to **Cloud Run**.
2. Click the **＋ Create Service** button at the top.
3. Under **Deployment platform**:
   - Select **"Continuously deploy from a repository"** (Set up with Cloud Build).
   - Click **Set up Cloud Build**.
   - Select **GitHub** as the provider and authenticate your account.
   - Choose your repository (e.g. `sscs` or `satyaseva-sisters`) and click **Next**.
   - **Build Configuration**:
     - Branch: `^main$` (or `master`)
     - Build Type: Select **Dockerfile**
     - Source location: `/Dockerfile`
   - Click **Save**.

*(Alternative without GitHub: You can open the built-in **Cloud Shell** icon `>_` at the top right of the Console, and run `gcloud run deploy sscs-backend --source .`)*

---

### Step 4: Configure Service Settings

Back on the **Create Service** page:

1. **Service name**: `sscs-backend`
2. **Region**: Select a region close to your users:
   - India: `asia-south1` (Mumbai)
   - Europe: `europe-west1` (Belgium) or `europe-central2` (Warsaw)
   - US: `us-central1` (Iowa)
3. **CPU allocation and pricing**:
   - Select **"CPU is only allocated during request processing"** (enables scale-to-zero so you pay $0 when idle).
4. **Revision scaling**:
   - **Minimum number of instances**: `0`
   - **Maximum number of instances**: `2` (or `5` to prevent unexpected costs)
5. **Authentication**:
   - Select **"Allow unauthenticated invocations"** (Required so the public web portal and sisters can access the API).

---

### Step 5: Container Port & Environment Variables

Scroll down and expand **"Container, Networking, Security"**:

1. Under the **Container** tab:
   - **Container port**: `8080`
   - **Memory**: `512 MiB` (or `1 GiB`)
   - **CPU**: `1`
2. Under **Environment variables**, click **Add Variable** for each:
   - `PORT` = `8080`
   - `ADMIN_EMAIL` = `faikhakkaunt@gmail.com` (or your preferred admin recovery email)
   - `ALLOWED_ORIGINS` = `https://satyasevasisters.org,https://www.satyasevasisters.org`

---

### Step 6: (Optional) Persistent Storage for SQLite & Uploads

Cloud Run revisions are stateless by default. If sisters upload new photos directly in the live cloud backend, you can attach persistent storage using **Cloud Storage FUSE volume mount**:

1. In Cloud Console, navigate to **Cloud Storage** ➔ **Buckets** ➔ **Create Bucket**:
   - Name: `sscs-archive-storage` (globally unique)
   - Location type: `Region` (same region as your Cloud Run service)
   - Storage class: `Standard`
   - Click **Create**.
2. Go back to your Cloud Run service configuration:
   - Click the **Volumes** tab ➔ **Add Volume**.
   - Volume type: **Cloud Storage bucket**.
   - Volume name: `archive-volume`.
   - Bucket: Select `sscs-archive-storage`.
   - Under **Container** tab ➔ **Volume Mounts**:
     - Mount path: `/app/scripts/data` (for SQLite database)
     - or `/app/site/images/communities` (for uploaded photos)
3. Click **Create** / **Deploy** at the bottom of the page!

---

### Step 7: Verify and Test Your Live Backend

Cloud Build will compile your container and Cloud Run will deploy it within 1–2 minutes.

Once deployed, Google Cloud will provide a secure HTTPS URL at the top of the service page:
```
https://sscs-backend-xxxxxxxxxx-xx.a.run.app
```

#### Test your live endpoints:
- **Health & Communities API**:
  `https://your-service-url.a.run.app/api/communities`
- **Database Status**:
  `https://your-service-url.a.run.app/api/db/status`
- **Admin Portal**:
  `https://your-service-url.a.run.app/admin.html`
- **Station Uploads API**:
  `https://your-service-url.a.run.app/api/station-uploads`

---

### Step 8: Custom Domain (Optional)
If you want to use a custom domain like `api.satyasevasisters.org`:
1. In Cloud Run, click **Manage Custom Domains** (top action bar).
2. Click **Add Mapping**.
3. Select your service (`sscs-backend`) and enter your domain name.
4. Add the provided DNS CNAME record in your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.). Google will automatically issue and renew a free managed SSL certificate.
