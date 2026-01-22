# PrintForge - 3D Print Quote Calculator

A complete 3D printing quote calculator that can be embedded on Shopify pages. Supports file upload, 3D preview, material selection, and instant price estimates.

## Features

### Customer Widget
- 📤 Upload STL, 3MF, or OBJ files (up to 100MB)
- 🖥️ Interactive 3D model viewer with pan/rotate/zoom
- 📏 Automatic dimension detection
- 🎨 Material and colour selection
- ⚡ Instant price estimates
- ✉️ Email confirmation

### Admin Dashboard
- 📊 Dashboard with stats and charts
- 📋 Submissions management
- 💰 Configurable pricing (rates, margins, discounts)
- 🖨️ 3D model preview for submissions
- 📧 Email notifications

## Architecture

```
printforge/
├── apps/
│   ├── api/          # Fastify backend API
│   ├── widget/       # React + Vite embeddable widget
│   └── admin/        # Next.js admin dashboard
├── packages/
│   └── shared/       # Shared types and schemas
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for local development)

### Development Setup

1. **Clone and install dependencies:**

```bash
git clone <repo-url>
cd printforge
pnpm install
```

2. **Start local services with Docker:**

```bash
docker compose up -d postgres redis minio minio-setup
```

3. **Set up environment variables:**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
```

4. **Run database migrations:**

```bash
pnpm db:migrate
pnpm db:seed
```

5. **Start development servers:**

```bash
pnpm dev
```

This starts:
- Widget: http://localhost:3000
- API: http://localhost:3001
- Admin: http://localhost:3002

### Demo Credentials

- Email: `admin@example.com`
- Password: `admin123`

## Shopify Integration

Add this code to a Shopify page using a Custom Liquid block:

```html
<div id="printforge-quote-widget" data-shop-id="your-shop.myshopify.com"></div>
<script src="https://your-domain.com/widget.js" defer></script>
```

## Configuration

### Pricing Settings

Configure in Admin Dashboard → Pricing:

| Setting | Default | Description |
|---------|---------|-------------|
| Labour Rate | $30/hr | Hourly rate for handling |
| Machine Rate | $5/hr | Hourly rate for machine time |
| Setup Fee | $5 | Fixed fee per order |
| Minimum Charge | $15 | Minimum order total |
| Markup | 20% | Profit margin |
| Estimate Variance | ±10% | Price range variance |

### Material Rates

| Material | Rate ($/g) | Waste Factor |
|----------|-----------|--------------|
| PLA | $0.03 | 10% |
| PETG | $0.04 | 12% |
| ABS | $0.04 | 15% |
| ASA | $0.05 | 12% |
| TPU | $0.06 | 15% |
| Nylon | $0.08 | 15% |
| Resin | $0.10 | 20% |

### Quality Profiles

| Profile | Layer Height | Multiplier |
|---------|-------------|------------|
| Draft | 0.28mm | 0.9× |
| Standard | 0.20mm | 1.0× |
| Fine | 0.12mm | 1.2× |

## Environment Variables

### API (`apps/api/.env`)

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/printforge

# JWT Secret (min 32 chars)
JWT_SECRET=your-super-secret-jwt-key

# S3/R2 Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=printforge-uploads
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=auto

# SendGrid (optional)
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=quotes@yourdomain.com

# URLs
API_URL=http://localhost:3001
ADMIN_URL=http://localhost:3002
WIDGET_URL=http://localhost:3000

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

### Admin (`apps/admin/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Deployment

### Using Render

1. Create a new Web Service for the API
2. Create a PostgreSQL database
3. Set environment variables
4. Deploy from GitHub

### Using Fly.io

```bash
# Install Fly CLI
flyctl launch

# Set secrets
flyctl secrets set DATABASE_URL=... JWT_SECRET=...

# Deploy
flyctl deploy
```

### Using Docker

```bash
# Build images
docker compose build

# Run production
docker compose -f docker-compose.prod.yml up -d
```

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/config/public` | Get widget configuration |
| POST | `/v1/quotes/init-upload` | Initialize file upload |
| POST | `/v1/quotes/analyze` | Analyze uploaded file |
| POST | `/v1/quotes/submit` | Submit quote request |
| GET | `/health` | Health check |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/admin/login` | Admin login |
| GET | `/v1/admin/me` | Get current user |
| GET | `/v1/admin/submissions` | List submissions |
| GET | `/v1/admin/submissions/:id` | Get submission |
| PATCH | `/v1/admin/submissions/:id` | Update status |
| DELETE | `/v1/admin/submissions/:id` | Delete submission |
| GET | `/v1/admin/pricing` | Get pricing config |
| PATCH | `/v1/admin/pricing` | Update pricing |
| GET | `/v1/admin/stats` | Get dashboard stats |

## Testing

```bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter @printforge/api test

# Watch mode
pnpm --filter @printforge/api test:watch
```

## Project Structure

```
apps/api/
├── src/
│   ├── config/         # Environment configuration
│   ├── db/             # Database connection & migrations
│   ├── routes/         # API routes (public, admin)
│   ├── services/       # Business logic
│   │   ├── pricing.ts  # Price calculation engine
│   │   ├── slicer.ts   # PrusaSlicer integration
│   │   ├── storage.ts  # S3/R2 file storage
│   │   └── email.ts    # SendGrid integration
│   └── index.ts        # Server entry point

apps/widget/
├── src/
│   ├── components/     # React components
│   │   ├── FileUpload.tsx
│   │   ├── StlViewer.tsx
│   │   ├── QuoteForm.tsx
│   │   └── ...
│   ├── hooks/          # Custom hooks
│   └── Widget.tsx      # Main widget component

apps/admin/
├── src/
│   ├── app/            # Next.js app router
│   │   ├── dashboard/
│   │   ├── submissions/
│   │   ├── pricing/
│   │   └── settings/
│   ├── components/     # React components
│   └── lib/            # Utilities

packages/shared/
├── src/
│   ├── types/          # TypeScript interfaces
│   └── schemas/        # Zod validation schemas
```

## Price Calculation

The pricing engine calculates quotes using this formula:

```
material_cost = grams × rate_per_gram × (1 + waste_factor)
time_cost = print_hours × machine_rate
labour_cost = setup_fee
subtotal = (material_cost + time_cost + labour_cost) × quality_multiplier
discount = subtotal × quantity_discount_percent
total = max(minimum_charge, (subtotal - discount) × (1 + markup_percent))
estimate_range = total × (1 ± variance)
```

## Security

- All file uploads validated by extension and size
- Signed URLs for secure file downloads
- JWT authentication for admin routes
- Rate limiting on public endpoints
- CORS configured for specific origins
- Password hashing with Argon2

## Licence

MIT
