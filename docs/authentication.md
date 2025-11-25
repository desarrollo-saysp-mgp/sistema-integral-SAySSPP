# Authentication and Authorization

## Authentication Strategy

### Recommended: OAuth with Supabase Auth

Supabase provides built-in authentication with multiple providers. For this internal system, we recommend:

**Option 1: Email/Password with Supabase Auth (Simplest)**

- Users created by Admin in the system
- Credentials sent to user's email
- Users can reset password via email
- No external OAuth provider needed

**Option 2: Google OAuth (More Secure)**

- Users authenticate with Google accounts
- Admin pre-authorizes specific email domains
- Seamless login experience
- Better security with 2FA support

**Option 3: Azure AD / Microsoft 365 (For Government)**

- Best for government organizations
- Single Sign-On with existing credentials
- Centralized user management
- Meets compliance requirements

### Implementation with Supabase

```javascript
// Example: Email/Password Authentication
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});

// Sign out
await supabase.auth.signOut();

// Get current user
const {
  data: { user },
} = await supabase.auth.getUser();
```

## Authorization (Role-Based Access Control)

### User Roles

#### Admin Role Permissions

- ✅ Create, read, update, delete users
- ✅ Access admin panel
- ✅ Configure services and causes
- ✅ Create and view complaints
- ✅ Update complaint status
- ✅ Edit all complaint fields
- ✅ View all system data

#### Administrative Role Permissions

- ❌ Cannot access admin panel
- ❌ Cannot manage users
- ❌ Cannot configure services (read-only)
- ✅ Create complaints
- ✅ View complaints
- ✅ Update complaint status
- ✅ Edit complaint details

### Role Enforcement

#### Frontend (Next.js)

```javascript
// middleware.ts - Protect admin routes
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Get user role from database
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .single();

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith("/admin") && user.role !== "Admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
```

#### Backend (Row Level Security)

Database policies ensure data security at the database level. See `database.md` for RLS policies.

## User Session Management

### Session Handling

- Sessions managed by Supabase Auth
- Automatic token refresh
- Secure httpOnly cookies
- Session timeout: 7 days (configurable)

### Login Flow

1. User enters email and password
2. Supabase validates credentials
3. Session token stored in secure cookie
4. User redirected to dashboard
5. Middleware checks authentication on each request

### User Context

```javascript
// Create a context for user data
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUser(session.user);

        // Fetch user profile with role
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setProfile(data);
      } else {
        router.push("/login");
      }

      setLoading(false);
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
```

## Protected Routes

### Route Structure

```
/
├── /login (public)
├── /dashboard (authenticated)
│   ├── /complaints (all users)
│   │   ├── /new (all users)
│   │   └── /[id] (all users)
│   └── /services (all users - read only for Administrative)
├── /admin (Admin only)
│   ├── /users (Admin only)
│   │   ├── /new (Admin only)
│   │   └── /[id] (Admin only)
│   └── /services (Admin only - full CRUD)
```

### Component-Level Protection

```javascript
// Example: AdminOnly component wrapper
export function AdminOnly({ children }) {
  const { profile } = useUser();

  if (profile?.role !== "Admin") {
    return (
      <div className="p-4">
        <p>No tiene permisos para acceder a esta página.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Usage
<AdminOnly>
  <UserManagementPage />
</AdminOnly>;
```

## User Registration (Admin Only)

### Registration Flow

1. Admin navigates to `/admin/users/new`
2. Admin fills form with: full name, email, role
3. System creates user in Supabase Auth
4. System creates user record in `users` table
5. System sends invitation email with temporary password
6. User receives email and sets permanent password

### Implementation

```javascript
// Admin creates new user
async function createUser(userData) {
  // Create auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: userData.email,
      password: generateTemporaryPassword(), // Auto-generated
      email_confirm: true,
    });

  if (authError) throw authError;

  // Create user profile
  const { data, error } = await supabase.from("users").insert({
    id: authData.user.id,
    full_name: userData.fullName,
    email: userData.email,
    role: userData.role,
  });

  if (error) throw error;

  // Send invitation email
  await sendInvitationEmail(userData.email, tempPassword);

  return data;
}
```

## Security Best Practices

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting

- Login attempts: 5 per 15 minutes per IP
- Password reset: 3 per hour per email
- API requests: 100 per minute per user

### Audit Logging

Track important actions:

- User login/logout
- User creation/modification
- Role changes
- Complaint creation/updates

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

## Password Reset Flow

1. User clicks "Forgot Password" on login page
2. User enters email address
3. Supabase sends password reset email
4. User clicks link in email
5. User enters new password
6. User redirected to login page

```javascript
// Request password reset
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});

// Update password
const { error } = await supabase.auth.updateUser({
  password: newPassword,
});
```
