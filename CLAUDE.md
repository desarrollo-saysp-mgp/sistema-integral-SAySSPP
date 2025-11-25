# Project Context for Claude Code

This document provides context and guidelines for implementing features in the Complaint Management System.

## Project Overview

An internal web portal for municipal secretary offices to manage citizen complaints. The system uses Next.js 14, Supabase (PostgreSQL), and includes automatic backup to Google Sheets.

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (OAuth)
- **Hosting**: Vercel
- **Backup**: Google Apps Script + Google Sheets

## Documentation

All detailed documentation is in the `/docs` folder:

- [Core Functions Overview](docs/core_functionality.md) — Feature specifications and workflows
- [Database Reference](docs/database.md) — Schema, ERD, and SQL scripts
- [Authentication Guide](docs/authentication.md) — OAuth, RBAC, and security
- [UI Specifications](docs/ui_specifications.md) — Page layouts and components
- [Google Sheets Integration](docs/google_sheets_integration.md) — Backup system setup

## Task List

Work through these tasks in order. Mark completed tasks with `[x]`.

### Phase 1: Project Setup & Infrastructure

- [x] Initialize Next.js 14 project with TypeScript
- [x] Configure Tailwind CSS and shadcn/ui
- [x] Set up Supabase client and environment variables
- [x] Create database schema in Supabase using scripts from `docs/database.md`
- [x] Set up Row Level Security (RLS) policies
- [x] Configure authentication with Supabase Auth
- [x] Create user context and authentication hooks
- [x] Set up protected routes middleware
- [x] Create base layout components (header, sidebar, footer)

### Phase 2: Authentication & User Management

- [x] Implement login page with email/password
- [x] Implement password reset flow
- [ ] Create user context provider with role detection
- [ ] Implement protected route middleware for admin/administrative roles
- [x] Create admin user management page (`/admin/users`)
- [x] Implement user creation form with role assignment
- [x] Implement user editing functionality
- [x] Add user list table with search and filters
- [ ] Create invitation email system for new users

### Phase 3: Service & Cause Configuration

- [ ] Create services management page (`/admin/services`)
- [ ] Implement service creation and editing
- [ ] Implement cause management (add, edit, delete)
- [ ] Create cascading dropdown for service → causes relationship
- [ ] Add validation for service and cause names

### Phase 4: Complaint Management - Core Features

- [ ] Create complaint form page (`/dashboard/complaints/new`)
- [ ] Implement auto-generated complaint number (SASP-R format)
- [ ] Create cascading service/cause dropdowns in form
- [ ] Implement form validation with proper error messages
- [ ] Create complaint save functionality
- [ ] Implement complaints table page (`/dashboard/complaints`)
- [ ] Add search functionality (by number, name, address)
- [ ] Add filter functionality (status, service, date range)
- [ ] Implement inline status editing in table
- [ ] Create complaint detail/edit page (`/dashboard/complaints/[id]`)
- [ ] Implement complaint update functionality
- [ ] Add complaint deletion (admin only)

### Phase 5: Dashboard & Reporting

- [ ] Create dashboard home page with statistics
- [ ] Implement complaint count cards (total, in progress, resolved, unresolved)
- [ ] Create recent complaints widget
- [ ] Add quick action buttons (new complaint, view all)

### Phase 6: Google Sheets Integration

- [ ] Set up Google Apps Script in Google Sheets
- [ ] Implement complaint sync function
- [ ] Configure scheduled triggers (15-minute intervals)
- [ ] Test real-time sync with Supabase webhooks (optional)
- [ ] Add error notification system for sync failures

### Phase 7: Polish & Testing

- [ ] Write unit tests for complaint CRUD operations
- [ ] Write unit tests for user management functions
- [ ] Write unit tests for authentication flows
- [ ] Add loading states to all async operations
- [ ] Add success/error toast notifications
- [ ] Implement proper error boundaries
- [ ] Test responsive design on different screen sizes
- [ ] Verify accessibility (keyboard navigation, ARIA labels)
- [ ] Add audit logging for important actions

### Phase 8: Deployment & Documentation

- [ ] Configure Vercel deployment
- [ ] Set up environment variables in Vercel
- [ ] Test production build locally
- [ ] Deploy to production
- [ ] Update README with production URL
- [ ] Create user guide for end users

## Development Workflow

When implementing a task, follow these phases:

### PHASE 1: TASK SELECTION & PLANNING

**Mindset: Project Manager / Technical Lead**

1. Identify the next unchecked task in the task list above
2. Analyze the task requirements:
   - Review relevant documentation (in `/docs`)
   - Check existing code patterns
   - Identify files to modify or create
   - Plan test requirements
3. Mark task as in progress (add note in "Current Status" section)

### PHASE 2: IMPLEMENTATION

**Mindset: Backend/Frontend Architect (contextual based on task)**

1. **Create feature branch** following gitflow:

   ```bash
   git checkout -b feat/<task-description>
   ```

   Examples:
   - `feat/complaint-form`
   - `feat/user-management`
   - `feat/google-sheets-sync`

2. **Implement the solution** following project patterns:
   - **For database**: Follow schema patterns from `docs/database.md`, use RLS policies
   - **For API routes**: Follow Next.js App Router API patterns, proper error handling
   - **For frontend**: Follow Next.js 14 App Router patterns, TypeScript interfaces, component structure
   - **For authentication**: Follow Supabase Auth patterns from `docs/authentication.md`
   - Use existing patterns found in the codebase

3. **Make atomic commits** with conventional commit messages:

   ```bash
   git add <relevant files>
   git commit -m "type(scope): description"
   ```

   Examples:
   - `feat(complaints): add complaint creation form`
   - `feat(auth): implement protected routes middleware`
   - `fix(complaints): correct status update validation`
   - `refactor(ui): extract reusable table component`

   **IMPORTANT RULE: Commit After Each Task**
   - After completing EACH task from the task list, create a commit
   - Do NOT batch multiple tasks into one commit
   - Each task = one logical unit of work = one commit
   - Immediately update CLAUDE.md after the commit
   - This ensures granular version control and clear progress tracking

4. **Ensure code follows project standards**:
   - TypeScript strict mode compliance
   - ESLint rules satisfied
   - Prettier formatting applied
   - Proper error handling
   - Spanish language for user-facing messages

### PHASE 3: TESTING

**Mindset: QA Engineer / Test Automation Specialist**

1. **Write comprehensive unit tests** for all new/modified code:
   - Test happy paths
   - Test edge cases
   - Test error conditions
   - Ensure good coverage of business logic
   - Place tests next to the code with `.test.ts` or `.test.tsx` suffix

2. **Run the test suite**:

   ```bash
   npm test
   ```

3. **If tests fail**:
   - Analyze the error messages
   - Fix the implementation or tests as needed
   - Re-run tests (maximum 3 attempts)
   - If still failing after 3 attempts, pause and ask for assistance

4. **Run linting and formatting**:

   ```bash
   npm run lint
   npm run format
   npm run type-check
   ```

5. **Verify all checks pass** before moving to next phase

### PHASE 4: REVIEW & FINALIZATION

**Mindset: Senior Engineer / Code Reviewer**

1. **Self-review the complete implementation**:
   - Check for code smells
   - Verify best practices
   - Ensure documentation/comments where needed (in English)
   - Validate that task requirements are met
   - Check Spanish translations for user-facing text

2. **Run final test suite** to ensure everything is green:

   ```bash
   npm test
   ```

3. **Push the feature branch** to remote:

   ```bash
   git push origin feat/<task-description>
   ```

4. **Generate PR description** with:
   - Summary of changes
   - Task completed from checklist
   - Testing notes
   - Any deployment considerations or breaking changes

5. **Mark task as complete**:
   - Update this file: mark task with `[x]`
   - Update "Current Status" section with progress
   - Note any important observations or blockers

6. **Provide completion summary**:
   - Branch name created
   - Number of commits made
   - Tests added/passed
   - Ready for manual PR creation

### Git Branch Strategy

- **Feature branches**: `feat/<task-description>`
- **Bug fixes**: `fix/<issue-description>`
- **Refactoring**: `refactor/<component-name>`
- **Documentation**: `docs/<topic>`

Always branch from `main` unless specified otherwise.

## Conventional Commits

**Format**: `type(scope): description`

### Commit Types

- **`feat`** — New feature for the user
- **`fix`** — Bug fix for the user
- **`refactor`** — Code change that neither fixes a bug nor adds a feature
- **`docs`** — Documentation changes
- **`test`** — Adding or updating tests
- **`chore`** — Maintenance tasks (dependencies, config)
- **`build`** — Build system or external dependencies
- **`ci`** — CI configuration changes
- **`perf`** — Performance improvements
- **`style`** — Code style changes (formatting, no logic change)
- **`revert`** — Reverting a previous commit

### Commit Examples

```bash
# Features
feat(complaints): add complaint creation form
feat(auth): implement protected routes middleware
feat(dashboard): add statistics cards with counts

# Bug fixes
fix(complaints): correct status update validation
fix(auth): resolve login redirect loop
fix(users): prevent duplicate email registration

# Refactoring
refactor(ui): extract reusable table component
refactor(api): simplify error handling logic

# Tests
test(complaints): add unit tests for form validation
test(auth): add edge cases for role verification

# Documentation
docs(readme): update setup instructions
docs(database): add RLS policy examples
```

### Important Rules

- **Never include Claude or any AI assistant as Co-Author in commits**
- Keep commit messages concise but descriptive
- Use present tense ("add feature" not "added feature")
- Reference issues in PR description, not in commit messages
- Make atomic commits (one logical change per commit)
- Write commit messages in English
- Scope should match the feature area (complaints, auth, users, services, etc.)

## Project Structure

```
app/
├── (auth)/              # Public authentication pages
│   ├── login/
│   └── reset-password/
├── (dashboard)/         # Protected dashboard routes
│   ├── complaints/      # Complaint management
│   │   ├── new/
│   │   ├── [id]/
│   │   └── page.tsx     # Complaints table
│   └── page.tsx         # Dashboard home
├── admin/               # Admin-only routes
│   ├── users/
│   └── services/
├── api/                 # API routes
│   ├── complaints/
│   ├── users/
│   └── services/
└── layout.tsx           # Root layout

components/
├── ui/                  # shadcn/ui components
├── forms/               # Form components
├── tables/              # Table components
└── layout/              # Layout components

lib/
├── supabase/            # Supabase client
├── validations/         # Zod schemas
└── utils.ts             # Helper functions

hooks/
├── useUser.ts           # User authentication
├── useComplaints.ts     # Complaint data
└── useServices.ts       # Service data

types/
├── database.ts          # Database types
└── index.ts             # Shared types
```

## Testing Requirements

### Test Coverage Requirements

- **Unit tests are REQUIRED** for all business logic and new code paths
- **Integration tests are OPTIONAL** where they add significant value
- **End-to-end tests are OUT OF SCOPE** for this project

### Test Guidelines

1. **Coverage targets**:
   - Aim for >80% coverage on new code
   - 100% coverage on critical business logic (complaint calculations, status changes, etc.)

2. **Test types to write**:
   - **Happy path tests**: Test normal, expected behavior
   - **Edge case tests**: Test boundary conditions, empty inputs, max values
   - **Error condition tests**: Test validation failures, network errors, unauthorized access

3. **Test file organization**:
   - Place test files next to the code being tested
   - Use `.test.ts` or `.test.tsx` suffix
   - Mirror the structure of your source files

4. **Test naming convention**:
   ```typescript
   describe("Component/Function name", () => {
     it("should describe the expected behavior", () => {
       // test implementation
     });
   });
   ```

### Test Examples

**Form validation test**:

```typescript
import { describe, it, expect } from "vitest";
import { complaintSchema } from "@/lib/validations/complaint";

describe("Complaint Form Validation", () => {
  it("should validate required fields", () => {
    const result = complaintSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(8); // number of required fields
  });

  it("should accept valid complaint data", () => {
    const validData = {
      complainant_name: "Juan Pérez",
      address: "Calle Principal",
      street_number: "123",
      service_id: 1,
      cause_id: 1,
      zone: "Centro",
      since_when: new Date(),
      contact_method: "Email",
      details: "Descripción del reclamo",
      status: "En proceso",
    };
    const result = complaintSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid contact method", () => {
    const invalidData = {
      contact_method: "InvalidMethod",
    };
    const result = complaintSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

**Utility function test**:

```typescript
import { describe, it, expect } from "vitest";
import { generateComplaintNumber } from "@/lib/utils/complaint";

describe("Complaint Number Generation", () => {
  it("should generate complaint number in SASP-R format", () => {
    const number = generateComplaintNumber(123);
    expect(number).toBe("SASP-R000123");
  });

  it("should pad numbers with leading zeros", () => {
    expect(generateComplaintNumber(1)).toBe("SASP-R000001");
    expect(generateComplaintNumber(999)).toBe("SASP-R000999");
    expect(generateComplaintNumber(1000)).toBe("SASP-R001000");
  });
});
```

**Component test**:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComplaintCard } from '@/components/complaints/ComplaintCard'

describe('ComplaintCard', () => {
  const mockComplaint = {
    complaint_number: 'SASP-R000123',
    complainant_name: 'Juan Pérez',
    status: 'En proceso',
    created_at: new Date('2024-01-15')
  }

  it('should render complaint information', () => {
    render(<ComplaintCard complaint={mockComplaint} />)

    expect(screen.getByText('SASP-R000123')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('En proceso')).toBeInTheDocument()
  })

  it('should apply correct status styling', () => {
    const { container } = render(<ComplaintCard complaint={mockComplaint} />)
    const statusBadge = container.querySelector('[data-status="En proceso"]')

    expect(statusBadge).toHaveClass('bg-yellow-100')
  })
})
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for active development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- ComplaintCard.test.tsx

# Run tests matching a pattern
npm test -- --grep="Complaint"
```

### Test Failure Protocol

1. **First failure**: Analyze error message, fix issue, re-run
2. **Second failure**: Review test logic and implementation, fix, re-run
3. **Third failure**: Check for environmental issues, dependencies, re-run
4. **After 3 failures**: Stop and ask for human assistance with:
   - Full error message
   - Code being tested
   - Test code
   - What you've tried

## Important Guidelines

### Security (Critical)

1. **Row Level Security (RLS)**: All database tables must have RLS policies enabled (see `docs/database.md`)
2. **Role checks**: Always verify user role on both client and server
3. **Input validation**: Validate all user input with Zod schemas
4. **API routes**: Protect all API routes with authentication checks

### Code Quality Standards

1. **TypeScript**: Strict mode compliance, proper typing
2. **Linting**: ESLint rules must pass
3. **Formatting**: Prettier formatting applied
4. **Error handling**: Proper try-catch and error messages
5. **Comments**: Write in English, Spanish for user-facing text

### When to Ask for Help

- Test failures persist after 3 fix attempts
- Task requirements are unclear or conflicting
- Architectural decisions needed (new patterns, breaking changes)
- External dependencies or APIs need configuration
- Database schema changes required
- Performance issues or complex optimization needed
- Security concerns or sensitive data handling

## Progress Tracking

After completing each task:

1. Mark the task as complete with `[x]` in the task list above
2. Commit the changes
3. Move to the next task in the list
4. If all tasks in a phase are complete, note any blockers or observations

## Current Status

**Last Updated**: 2025-11-25

**Current Phase**: Phase 2 - Authentication & User Management

**Completed Tasks**:

- ✅ Phase 1 complete: 9/9 tasks (100%)
- ⏳ Phase 2: 6/9 tasks (67%)

**Latest Completed**: Password reset flow (feat/password-reset-flow)

- ✅ Password reset request page (/reset-password) with email validation
- ✅ Password reset confirmation page (/reset-password/confirm) with session validation
- ✅ Password visibility toggles for new password fields
- ✅ "Forgot password" link added to login page
- ✅ Comprehensive unit tests (16 new tests: 7 for request page, 9 for confirm page)
- ✅ All user-facing text in Spanish
- ✅ 51/51 tests passing (100% coverage)
- ✅ Integration with Supabase Auth (resetPasswordForEmail, updateUser)

**Previous Completions**:

- Admin user management system (feat/admin-user-management)
  - Complete CRUD API routes, useUsers hook, UserTable, UserForm components
  - 36/36 tests passing with 18 new tests

**Next Task**: Options for Phase 2 -

1. Create user context provider with role detection (may be partially complete)
2. Implement protected route middleware for admin/administrative roles
3. Create invitation email system for new users

**Phase 1 Completions**:

- ✅ Next.js 15, TypeScript, Tailwind CSS, and shadcn/ui configured
- ✅ Supabase clients and authentication infrastructure set up
- ✅ Database schema and RLS policies fully configured
- ✅ Login page implemented with email/password authentication
- ✅ User context and authentication hooks
- ✅ Session management middleware in place
- ✅ Base layout components with institutional colors (#5CADEB, #0E3F75, #88C1ED)

**Notes**:

- 🎉 Phase 1 infrastructure is complete!
- 📊 Database is ready with full schema and security policies
- 🔐 Authentication system is functional
- ➡️ Ready to implement user management and complaint features
