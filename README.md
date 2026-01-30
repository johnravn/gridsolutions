# Grid

A comprehensive business management platform designed for Ekte Lyd AS, an audio production and event services company. Grid provides an all-in-one solution for managing jobs, crew, inventory, vehicles, customers, and scheduling operations.

> **Note**: This is a test deployment workflow change.

## Overview

Grid is a full-stack web application that streamlines business operations for production companies. It enables teams to efficiently manage projects, track equipment inventory, schedule crew and resources, coordinate vehicles, maintain customer relationships, and handle internal communications—all from a single, modern interface.

## Features

- **Dashboard**: Real-time overview of operations, inventory status, crew availability, and upcoming jobs
- **Jobs Management**: Comprehensive job tracking with detailed information, scheduling, and resource allocation
- **Calendar**: Visual calendar interface for scheduling jobs, crew assignments, and resource reservations
- **Crew Management**: Track crew members, their roles, availability, and assignments
- **Inventory Management**: Monitor equipment, stock levels, and track inventory usage across jobs
- **Vehicle Fleet**: Manage company vehicles, track availability, and assign to jobs
- **Customer Management**: Maintain customer database and relationships
- **Matters**: Internal communication and discussion system for teams
- **Company Settings**: Configure company information, roles, and permissions
- **Multi-Company Support**: Support for multiple companies with role-based access control
- **Latest Activity**: Activity feed to track recent changes and updates

## Tech Stack

### Frontend

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and development server
- **TanStack Router** - Type-safe routing
- **TanStack React Query** - Server state management and data fetching
- **TanStack React Table** - Data table components

### UI & Styling

- **Radix UI Themes** - Component library and design system
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **FullCalendar** - Calendar and scheduling components
- **Iconoir React** - Icon library
- **React Icons** - Additional icon sets

### Backend & Database

- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Storage

### Utilities

- **libphonenumber-js** - Phone number formatting and validation
- **react-phone-number-input** - Phone input component
- **norwegian-postalcodes-mapper** - Norwegian postal code utilities
- **next-themes** - Theme management (light/dark mode)
- **temporal-polyfill** - Temporal API polyfill

### Development Tools

- **Vitest** - Unit testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Supabase CLI** - Database migrations and management

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Supabase account (for remote development) or Docker (for local Supabase)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd subb
```

2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Set up environment variables:
   Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT_REF=your-project-ref
```

4. Link to Supabase project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

5. Generate TypeScript types from database:

```bash
npm run db:types:remote
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Building

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run serve
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run serve` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run check` - Format and lint with auto-fix
- `npm run db:types` - Generate TypeScript types from local database
- `npm run db:types:remote` - Generate TypeScript types from remote database
- `npm run db:diff` - Generate database migration diff
- `npm run db:reset` - Reset local database
- `npm run db:push` - Push migrations to remote database

## Project Structure

```
src/
├── app/              # Application-wide configuration
│   ├── config/       # Environment configuration
│   ├── hooks/        # Shared hooks
│   ├── layout/       # Layout components
│   ├── providers/    # Context providers
│   └── router/       # Routing configuration
├── components/       # Shared components
├── features/         # Feature modules
│   ├── calendar/     # Calendar functionality
│   ├── company/      # Company management
│   ├── crew/         # Crew management
│   ├── customers/    # Customer management
│   ├── inventory/    # Inventory management
│   ├── jobs/         # Job management
│   ├── matters/      # Internal messaging
│   └── vehicles/     # Vehicle management
└── shared/           # Shared utilities and types
    ├── api/          # API clients
    ├── auth/         # Authentication utilities
    └── types/        # TypeScript types
```

## Authentication & Permissions

The application uses Supabase Authentication with role-based access control. Users can have different roles:

- **Global Superuser**: Full access to all features
- **Owner**: Full access within a company
- **Super User**: Full access within a company
- **Employee**: Standard access (excludes company settings)
- **Freelancer**: Limited access (jobs and calendar only)

## Database

The project uses Supabase (PostgreSQL) for data storage. Database schema is managed through migrations located in `supabase/migrations/`.

**⚠️ IMPORTANT: All database schema changes MUST go through the migration workflow. See `CONTRIBUTING.md` for the complete migration workflow.**

### Quick Migration Reference

1. Create migration: `npm run db:migrate descriptive_name`
2. Test locally: `npm run db:reset`
3. Push to production: `npm run db:push`
4. Update types: `npm run db:types:remote`

## Deployment

The application is deployed to **gridsolutions.app** via Vercel. The `main` branch auto-deploys to production.

**⚠️ IMPORTANT: See `DEPLOYMENT_WORKFLOW.md` for complete deployment and branch strategy.**

### Quick Deployment Reference

- **Production**: Merges to `main` auto-deploy to gridsolutions.app
- **Feature Branches**: Create from `main`, test locally, merge via PR
- **Migrations**: Push backward-compatible migrations before merging code

For detailed instructions, see:

- `DEPLOYMENT_WORKFLOW.md` - Complete deployment workflow, branch strategy, and migration timing
- `CONTRIBUTING.md` - Complete migration workflow and best practices
- `supabase/DEVELOPMENT_WORKFLOW.md` - Detailed Supabase development guide
- `SUPABASE_SETUP.md` - Database setup instructions

## License

Private - All rights reserved.

---

Built for Ekte Lyd AS
