# RLS Infinite Recursion Fix

**Date**: 2025-11-26
**Issue**: `infinite recursion detected in policy for relation "users"`
**Status**: ✅ Fixed

## Problem

When trying to access the application after deployment, users encountered an infinite recursion error:

```
Error fetching user profile: infinite recursion detected in policy for relation "users"
```

This error prevented:
- User profile loading
- Admin role verification
- Access to protected routes
- Services and causes management

## Root Cause

The RLS (Row Level Security) policies on the `users` table were creating infinite recursion by querying the `users` table within their own policy definitions:

```sql
-- ❌ PROBLEMATIC POLICY
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users  -- ⚠️ Recursion here!
            WHERE users.id = auth.uid()
            AND users.role = 'Admin'
        )
    );
```

**What happens:**
1. User tries to query the `users` table to load their profile
2. RLS policy checks if user is Admin by querying `users` table
3. That query triggers the same RLS policy again
4. Step 2 repeats infinitely → PostgreSQL detects recursion and throws error

The same issue affected policies on:
- `users` table (3 policies)
- `services` table (1 policy)
- `causes` table (1 policy)

## Solution

Create a **SECURITY DEFINER** function that bypasses RLS when checking user roles, then update all policies to use this helper function instead of direct queries.

### How SECURITY DEFINER Works

- Normal functions run with the permissions of the **caller**
- `SECURITY DEFINER` functions run with the permissions of the **function owner**
- When the function owner has full database access, the function can bypass RLS
- This breaks the recursion loop

### Implementation

**Step 1: Create Helper Function**

```sql
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- ← Bypasses RLS
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = user_id
        AND role = 'Admin'
    );
$$;
```

**Step 2: Update Policies to Use Helper**

```sql
-- ✅ FIXED POLICY
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));  -- ← Uses helper function
```

## How to Apply This Fix

### Option 1: Run Migration in Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/fix_rls_infinite_recursion.sql`
4. Paste into the SQL editor
5. Click **Run**
6. Verify no errors in the results panel

### Option 2: Use Supabase CLI

```bash
# Make sure you're in the project directory
cd /path/to/gestion_reclamos

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

## Verification Steps

After applying the fix, verify it works:

### 1. Test Login and Profile Loading

```bash
# Open the application
# Navigate to /login
# Log in with an Admin account
# Check browser console for errors
# You should see your profile load without recursion errors
```

### 2. Test Admin Role Check

```bash
# Navigate to /admin/services (Admin-only route)
# If you're an Admin, you should see the services page
# If you're not Admin, you should be redirected to /dashboard
# No infinite recursion errors should appear
```

### 3. Verify in Supabase

```sql
-- Run this query in Supabase SQL Editor
-- Should return true for Admin users, false for others
SELECT public.is_admin(auth.uid());
```

### 4. Check Services and Causes

```bash
# Navigate to /admin/services
# Try creating a new service
# Try creating a new cause
# Both should work without RLS errors
```

## Files Modified

1. **`supabase/migrations/fix_rls_infinite_recursion.sql`** (NEW)
   - Contains the complete SQL migration to fix all policies

2. **`docs/database.md`** (UPDATED)
   - Added `is_admin()` helper function documentation
   - Updated all RLS policies to use the helper function
   - Now serves as the reference for correct RLS configuration

## Technical Details

### Why Use SECURITY DEFINER?

**Alternatives considered:**

1. **JWT token claims**: Store role in JWT and check `auth.jwt() ->> 'role'`
   - ❌ Requires custom JWT claims setup
   - ❌ Adds complexity to authentication flow
   - ❌ Role changes require token refresh

2. **Service role key on client**: Use service role to bypass RLS
   - ❌ **EXTREMELY DANGEROUS** - exposes full database access to client
   - ❌ Violates security best practices
   - ❌ Never do this!

3. **SECURITY DEFINER function**: ✅ **BEST OPTION**
   - ✅ Simple to implement
   - ✅ Maintains security boundaries
   - ✅ Follows PostgreSQL best practices
   - ✅ Easy to understand and maintain
   - ✅ Role changes take effect immediately

### Security Considerations

The `is_admin()` function is safe because:
- It only checks a single boolean condition (is user Admin?)
- It doesn't expose sensitive data
- It's marked `STABLE` (result doesn't change within a transaction)
- It can only be called by authenticated users
- The function owner (postgres/supabase) has necessary permissions

### Performance Impact

- Minimal: The function is marked `STABLE`, so PostgreSQL can cache the result within a transaction
- The query is simple and uses the primary key index
- No significant overhead compared to the original (broken) approach

## Related Issues

- **Middleware Error Investigation**: See `docs/MIDDLEWARE_ERROR_INVESTIGATION.md`
  - Initial 500 error was due to missing environment variables, not RLS
  - Middleware code was correct and didn't need changes

## References

- [PostgreSQL SECURITY DEFINER documentation](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Supabase RLS documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
