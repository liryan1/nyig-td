# Guide 5: Deployment

Cloud Run and Firebase deployment for the Go Tournament System.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Firebase Hosting│  │   Cloud Run     │  │   Cloud Run     │
│   React App     │  │  TypeScript API │  │  nyig-td-api    │
│                 │  │                 │  │  (FastAPI)      │
└─────────────────┘  └────────┬────────┘  └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  MongoDB Atlas  │
                     └─────────────────┘
```

## Prerequisites

- Google Cloud account with billing enabled
- Firebase project
- MongoDB Atlas account
- gcloud CLI installed
- Firebase CLI installed
- GitHub repository for CI/CD

---

## Part 1: GCP Project Setup

### Create Project

```bash
# Create new project
gcloud projects create nyig-tournament --name="NYIG Tournament"

# Set as current project
gcloud config set project nyig-tournament

# Enable billing (required for Cloud Run)
# Do this in the Cloud Console: https://console.cloud.google.com/billing

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com
```

### Create Artifact Registry

```bash
# Create Docker repository
gcloud artifacts repositories create nyig-images \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker images for NYIG Tournament"
```

### Configure Docker Authentication

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## Part 2: MongoDB Atlas Setup

### Create Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster (or paid for production)
3. Choose cloud provider: Google Cloud
4. Choose region: us-central1 (same as Cloud Run)

### Create Database User

1. Go to Database Access
2. Add New Database User
3. Authentication Method: Password
4. Username: `nyig-app`
5. Password: Generate secure password (save it!)
6. Database User Privileges: Read and write to any database

### Configure Network Access

1. Go to Network Access
2. Add IP Address
3. For Cloud Run, allow access from anywhere: `0.0.0.0/0`
   - Note: For production, use VPC peering or Private Link

### Get Connection String

1. Go to Clusters
2. Click "Connect"
3. Choose "Connect your application"
4. Copy the connection string:

```
mongodb+srv://nyig-app:<password>@cluster0.xxxxx.mongodb.net/nyig-tournament?retryWrites=true&w=majority
```

---

## Part 3: Secret Management

### Store Secrets in Secret Manager

```bash
# Store MongoDB URI
echo -n "mongodb+srv://nyig-app:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/nyig-tournament?retryWrites=true&w=majority" | \
  gcloud secrets create mongodb-uri --data-file=-

# Store any other secrets as needed
```

### Grant Cloud Run Access to Secrets

```bash
# Get the project number
PROJECT_NUMBER=$(gcloud projects describe nyig-tournament --format="value(projectNumber)")

# Grant access
gcloud secrets add-iam-policy-binding mongodb-uri \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Part 4: Deploy nyig-td-api (FastAPI)

### Prepare Dockerfile

In the `nyig-td-api` directory, ensure you have:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy project files
COPY pyproject.toml .
COPY src/ src/

# Install dependencies
RUN uv pip install --system .

# Run server
EXPOSE 8080
CMD ["uvicorn", "nyig_td_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Build and Push Image

```bash
cd nyig-td-api

# Build image
docker build -t us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-td-api:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-td-api:latest
```

### Deploy to Cloud Run

```bash
gcloud run deploy nyig-td-api \
  --image us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-td-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80
```

### Get Service URL

```bash
NYIG_TD_API_URL=$(gcloud run services describe nyig-td-api \
  --region us-central1 \
  --format="value(status.url)")

echo "nyig-td-api URL: $NYIG_TD_API_URL"
```

### Verify Deployment

```bash
curl "$NYIG_TD_API_URL/health"
# Should return: {"status":"healthy","version":"0.1.0"}
```

---

## Part 5: Deploy TypeScript API

### Prepare Dockerfile

In the `nyig-tournament-api` directory:

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# Production image
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Run
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/index.js"]
```

### Build and Push Image

```bash
cd nyig-tournament-api

# Build image
docker build -t us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-tournament-api:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-tournament-api:latest
```

### Deploy to Cloud Run

```bash
gcloud run deploy nyig-tournament-api \
  --image us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-tournament-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --set-secrets "MONGODB_URI=mongodb-uri:latest" \
  --set-env-vars "NYIG_TD_API_URL=$NYIG_TD_API_URL,NODE_ENV=production"
```

### Get Service URL

```bash
API_URL=$(gcloud run services describe nyig-tournament-api \
  --region us-central1 \
  --format="value(status.url)")

echo "API URL: $API_URL"
```

### Verify Deployment

```bash
curl "$API_URL/health"
# Should return: {"status":"healthy","timestamp":"..."}
```

---

## Part 6: Deploy React App to Firebase

### Initialize Firebase Project

```bash
cd nyig-tournament-app

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting
```

Select:
- Create a new project or use existing
- Public directory: `dist`
- Single-page app: Yes
- Automatic builds with GitHub: No (we'll set up CI/CD separately)

### Configure Environment

Create `.env.production`:

```env
VITE_API_URL=https://nyig-tournament-api-xxxxx-uc.a.run.app/api
```

Replace with your actual API URL.

### Build and Deploy

```bash
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

### Get Hosting URL

The URL will be shown after deployment:
```
https://nyig-tournament.web.app
```

---

## Part 7: CI/CD with GitHub Actions

### Directory Structure

Create `.github/workflows/` in your repository root.

### Workflow: Deploy nyig-td-api

`.github/workflows/deploy-nyig-td-api.yml`:

```yaml
name: Deploy nyig-td-api

on:
  push:
    branches: [main]
    paths:
      - 'nyig-td-api/**'
      - '.github/workflows/deploy-nyig-td-api.yml'
  workflow_dispatch:

env:
  PROJECT_ID: nyig-tournament
  REGION: us-central1
  SERVICE_NAME: nyig-td-api
  IMAGE: us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-td-api

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker us-central1-docker.pkg.dev

      - name: Build and Push
        working-directory: nyig-td-api
        run: |
          docker build -t ${{ env.IMAGE }}:${{ github.sha }} .
          docker push ${{ env.IMAGE }}:${{ github.sha }}
          docker tag ${{ env.IMAGE }}:${{ github.sha }} ${{ env.IMAGE }}:latest
          docker push ${{ env.IMAGE }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image ${{ env.IMAGE }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed
```

### Workflow: Deploy TypeScript API

`.github/workflows/deploy-typescript-api.yml`:

```yaml
name: Deploy TypeScript API

on:
  push:
    branches: [main]
    paths:
      - 'nyig-tournament-api/**'
      - '.github/workflows/deploy-typescript-api.yml'
  workflow_dispatch:

env:
  PROJECT_ID: nyig-tournament
  REGION: us-central1
  SERVICE_NAME: nyig-tournament-api
  IMAGE: us-central1-docker.pkg.dev/nyig-tournament/nyig-images/nyig-tournament-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: nyig-tournament-api/package-lock.json

      - name: Install dependencies
        working-directory: nyig-tournament-api
        run: npm ci

      - name: Run tests
        working-directory: nyig-tournament-api
        run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker us-central1-docker.pkg.dev

      - name: Build and Push
        working-directory: nyig-tournament-api
        run: |
          docker build -t ${{ env.IMAGE }}:${{ github.sha }} .
          docker push ${{ env.IMAGE }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image ${{ env.IMAGE }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed
```

### Workflow: Deploy React App

`.github/workflows/deploy-react-app.yml`:

```yaml
name: Deploy React App

on:
  push:
    branches: [main]
    paths:
      - 'nyig-tournament-app/**'
      - '.github/workflows/deploy-react-app.yml'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: nyig-tournament-app/package-lock.json

      - name: Install dependencies
        working-directory: nyig-tournament-app
        run: npm ci

      - name: Build
        working-directory: nyig-tournament-app
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: nyig-tournament
          channelId: live
          entryPoint: nyig-tournament-app
```

### Set Up GitHub Secrets

In your GitHub repository settings, add these secrets:

1. **GCP_SA_KEY**: Service account key JSON for GCP
   ```bash
   # Create service account
   gcloud iam service-accounts create github-actions \
     --display-name="GitHub Actions"

   # Grant permissions
   gcloud projects add-iam-policy-binding nyig-tournament \
     --member="serviceAccount:github-actions@nyig-tournament.iam.gserviceaccount.com" \
     --role="roles/run.admin"

   gcloud projects add-iam-policy-binding nyig-tournament \
     --member="serviceAccount:github-actions@nyig-tournament.iam.gserviceaccount.com" \
     --role="roles/storage.admin"

   gcloud projects add-iam-policy-binding nyig-tournament \
     --member="serviceAccount:github-actions@nyig-tournament.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"

   # Create and download key
   gcloud iam service-accounts keys create key.json \
     --iam-account=github-actions@nyig-tournament.iam.gserviceaccount.com

   # Copy contents of key.json to GitHub secret
   cat key.json
   ```

2. **FIREBASE_SERVICE_ACCOUNT**: Firebase service account JSON
   - Go to Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Copy JSON to GitHub secret

3. **VITE_API_URL**: Your API URL
   ```
   https://nyig-tournament-api-xxxxx-uc.a.run.app/api
   ```

---

## Part 8: Custom Domain (Optional)

### Cloud Run Custom Domain

```bash
# Map custom domain
gcloud beta run domain-mappings create \
  --service nyig-tournament-api \
  --domain api.yourdomain.com \
  --region us-central1
```

Follow the DNS verification steps provided.

### Firebase Custom Domain

1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Follow DNS verification steps

---

## Part 9: Monitoring and Logging

### View Cloud Run Logs

```bash
# Stream logs
gcloud run services logs read nyig-tournament-api --region us-central1 --stream

# View in browser
gcloud run services logs read nyig-tournament-api --region us-central1 --format json | head
```

### Cloud Monitoring

1. Go to Cloud Console > Monitoring
2. Create dashboard for Cloud Run services
3. Set up alerts for:
   - High error rate (>1%)
   - High latency (>2s p95)
   - Container crashes

### Error Reporting

Errors are automatically captured. View at:
Cloud Console > Error Reporting

---

## Part 10: Cost Optimization

### Cloud Run Settings

For low-traffic applications:

```bash
# Set minimum instances to 0 (scale to zero)
gcloud run services update nyig-tournament-api \
  --region us-central1 \
  --min-instances 0

# Use lower CPU allocation during idle
gcloud run services update nyig-tournament-api \
  --region us-central1 \
  --cpu-throttling
```

### MongoDB Atlas

- Use M0 (free tier) for development
- M2/M5 for low-traffic production
- Enable auto-scaling for production

### Firebase Hosting

- Free tier includes:
  - 10 GB storage
  - 360 MB/day transfer
  - Custom domain + SSL

---

## Deployment Checklist

### Pre-Deployment

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with proper permissions
- [ ] Network access configured (0.0.0.0/0 or VPC peering)
- [ ] GCP project created with billing enabled
- [ ] Required APIs enabled
- [ ] Secrets stored in Secret Manager

### Deploy Services

- [ ] nyig-td-api deployed and healthy
- [ ] nyig-tournament-api deployed and healthy
- [ ] API can connect to MongoDB
- [ ] APIs can communicate with each other

### Deploy Frontend

- [ ] React app built with production API URL
- [ ] Firebase hosting configured
- [ ] App deployed and accessible

### CI/CD

- [ ] GitHub secrets configured
- [ ] Workflows tested
- [ ] Automatic deployments working

### Post-Deployment

- [ ] End-to-end test completed
- [ ] Monitoring alerts configured
- [ ] Backup strategy in place (MongoDB Atlas)
- [ ] Documentation updated with production URLs

---

## Troubleshooting

### Cloud Run Deployment Fails

```bash
# Check build logs
gcloud builds list --limit=5

# View specific build
gcloud builds log BUILD_ID
```

### Container Crashes

```bash
# View logs
gcloud run services logs read SERVICE_NAME --region us-central1

# Check container health
curl https://SERVICE_URL/health
```

### MongoDB Connection Issues

1. Verify connection string format
2. Check Network Access in Atlas (IP whitelist)
3. Verify database user credentials
4. Test connection locally first

### CORS Issues

Ensure your API has proper CORS configuration for your frontend domain.

---

## Success Criteria

1. All three services deployed and running
2. Health checks passing
3. End-to-end tournament flow works
4. CI/CD pipelines functional
5. Logs accessible in Cloud Console
6. Custom domains configured (if applicable)
