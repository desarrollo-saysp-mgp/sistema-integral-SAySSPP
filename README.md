# Community Services Complaint Management System

An internal web portal for municipal secretary offices to manage citizen complaints. Register, track, and resolve complaints with role-based access control, automatic backup to Google Sheets, and real-time status updates.

## Documentation

- [Documentation index](docs/README.md) — links to every reference under `/docs`.
- [Core functions overview](docs/core_functionality.md) — complaint workflows, user management, and services configuration.
- [Database reference](docs/database.md) — tables, relationships, ERD diagram, and SQL scripts.
- [Authentication guide](docs/authentication.md) — OAuth setup, RBAC, and security policies.
- [UI specifications](docs/ui_specifications.md) — page layouts, components, and responsive design.
- [Google Sheets integration](docs/google_sheets_integration.md) — backup system and Apps Script setup.

## Prerequisites

- **Node.js**: Version 18 or higher
- **Package manager**: npm (included with Node.js) or yarn
- **Supabase account**: For PostgreSQL database and authentication

## Quick Start

```bash

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations
npm run db:migrate

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Verification

After setup, verify the installation is working correctly:

1. **Check the development server**: Visit http://localhost:3000 and ensure the login page loads
2. **Test database connection**: Try creating a test user through the admin interface
3. **Verify authentication**: Test login/logout functionality
4. **Run tests**: Execute `npm test` to ensure all tests pass

The app includes the following routes:

- `/` — Home/Dashboard with complaint statistics
- `/login` — Authentication page
- `/dashboard/complaints` — View all complaints
- `/dashboard/complaints/new` — Create new complaint
- `/dashboard/complaints/[id]` — View/edit complaint details
- `/admin/users` — User management (Admin only)
- `/admin/services` — Service and cause configuration (Admin only)

## Development

### Available Scripts

- **`npm run dev`** — Start the development server with hot reload (default port: 3000)
- **`npm run build`** — Build the application for production
- **`npm start`** — Run the production build locally
- **`npm test`** — Run the test suite
- **`npm run test:watch`** — Run tests in watch mode for active development
- **`npm run lint`** — Check and auto-fix linting issues (ESLint)
- **`npm run format`** — Format code using Prettier
- **`npm run type-check`** — Run TypeScript compiler checks without emitting files
- **`npm run db:generate`** — Generate migration files from schema changes
- **`npm run db:migrate`** — Apply pending migrations to the database

### Development Workflow

1. Create a feature branch: `git checkout -b feat/<feature-name>`
2. Make your changes following the project patterns
3. Run linting and formatting: `npm run lint && npm run format`
4. Run type checks: `npm run type-check`
5. Write and run tests: `npm test`
6. Commit using conventional commits: `type(scope): description`
7. Push your branch and create a pull request

### Database Migrations

The application uses Supabase (PostgreSQL) for database management. All schema definitions and migrations are version-controlled.

#### First-time Setup

When cloning the repository for the first time:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Configure environment variables** in `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Run migrations** — Use the SQL scripts in `docs/database.md` to set up your database:
   - Copy the schema creation scripts
   - Run them in the Supabase SQL Editor
   - Verify tables and policies are created

#### Making Schema Changes

When modifying the database schema:

1. **Update schema documentation** in `docs/database.md`
2. **Create migration SQL** for the changes
3. **Test migration** in a development Supabase project
4. **Apply to production** via Supabase dashboard
5. **Commit changes** to version control

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Sheets Integration (Optional)
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=your-private-key
```

**Note**: The `.env.local` file is gitignored and should never be committed.

## Browser Support

**Desktop-first design**: This application is optimized for desktop browsers and large screens.

**Recommended browsers**:

- Google Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Mobile support**: Responsive design included but optimized for desktop workflows.

## Project Structure

```
complaint-management-system/
├── app/                    # Next.js 14 App Router pages and API routes
│   ├── (auth)/            # Authentication pages (login, reset-password)
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── complaints/    # Complaint management pages
│   │   └── admin/         # Admin-only pages (users, services)
│   ├── api/               # API endpoints
│   │   ├── complaints/    # Complaint CRUD operations
│   │   ├── users/         # User management
│   │   ├── services/      # Service configuration
│   │   └── auth/          # Authentication handlers
│   ├── __tests__/         # App-level tests
│   ├── layout.tsx         # Root layout with header and navigation
│   ├── page.tsx           # Home/dashboard page
│   └── globals.css        # Global styles and Tailwind imports
├── components/            # Reusable React components
│   ├── ui/               # UI components (shadcn/ui)
│   ├── forms/            # Form components (complaint, user, service)
│   ├── tables/           # Data table components
│   └── layout/           # Layout components (header, sidebar, footer)
├── lib/                   # Utility functions and configurations
│   ├── supabase/         # Supabase client and utilities
│   ├── validations/      # Zod schemas for form validation
│   └── utils.ts          # Helper functions
├── hooks/                 # Custom React hooks
│   ├── useUser.ts        # User context and authentication
│   ├── useComplaints.ts  # Complaint data fetching
│   └── useServices.ts    # Service data fetching
├── types/                 # TypeScript type definitions
│   ├── database.ts       # Supabase database types
│   └── index.ts          # Shared types
├── docs/                  # Project documentation
│   ├── README.md         # Documentation index
│   ├── core_functionality.md
│   ├── database.md
│   ├── authentication.md
│   ├── ui_specifications.md
│   └── google_sheets_integration.md
├── public/                # Static assets (images, icons)
├── .env.example          # Example environment variables
├── .env.local            # Local environment variables (gitignored)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration (with @/* path alias)
├── tailwind.config.ts    # Tailwind CSS configuration
└── next.config.js        # Next.js configuration
```

**Note**: The `@/*` path alias is configured in `tsconfig.json` to allow clean imports like:

```typescript
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Complaint } from "@/types/database";
```

## Key Features

### Complaint Management

- Create complaints with auto-generated numbers (SASP-R000000 format)
- Track status: En proceso → Resuelto/No resuelto
- Link complaints to services and causes
- Record contact method and complainant details
- View complaint history and audit trail

### User Management (Admin Only)

- Create users with role assignment (Admin/Administrative)
- Manage user permissions and access levels
- Send invitation emails with temporary passwords

### Service Configuration (Admin Only)

- Create and manage service categories
- Define causes for each service
- Cascading dropdowns in complaint forms

### Data Backup

- Automatic synchronization with Google Sheets
- Real-time or scheduled updates (configurable)
- Backup retention for disaster recovery

### Security

- Row-level security (RLS) policies in Supabase
- Role-based access control (RBAC)
- OAuth authentication with Supabase Auth
- Secure session management

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- **Unit tests**: Component and utility function tests
- **Integration tests**: API endpoint tests
- **E2E tests**: Full user workflow tests (future enhancement)

## Deployment

### Vercel Deployment (Recommended)

1. **Connect repository** to Vercel
2. **Configure environment variables** in Vercel dashboard
3. **Deploy** — Automatic deployments on push to main branch

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues

**Development server won't start**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Database connection issues**

- Verify Supabase URL and keys in `.env.local`
- Check if RLS policies are properly configured
- Ensure your Supabase project is active

**Authentication not working**

- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correctly set
- Check Supabase Auth configuration
- Ensure cookies are enabled in browser

**Build fails with TypeScript errors**

```bash
# Run type checking to see detailed errors
npm run type-check

# Clear Next.js cache
rm -rf .next
npm run build
```

**Tests failing**

```bash
# Update test snapshots if component changes are intentional
npm test -- --updateSnapshot

# Run specific test file
npm test -- ComponentName.test.tsx
```

### Getting Help

If you encounter issues not covered above:

1. Check the [documentation](docs/) for detailed guides
2. Review the error logs for specific error messages
3. Verify environment variables are correctly configured
4. Contact the development team with the full error message and steps to reproduce

## Contributing

1. Follow the development workflow above
2. Write tests for new features
3. Update documentation for significant changes
4. Follow conventional commit messages
5. Ensure all checks pass before submitting PR

## Support

For issues, questions, or feature requests, please contact the development team or create an issue in the repository.

## License

Internal use only - Proprietary software for municipal secretary offices
