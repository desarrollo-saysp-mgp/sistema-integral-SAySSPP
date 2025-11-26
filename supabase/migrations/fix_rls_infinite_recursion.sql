-- Fix RLS Infinite Recursion Issue
--
-- Problem: RLS policies on the users table were querying the users table itself
-- to check if the current user is an Admin, causing infinite recursion.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS when checking
-- user roles, then update all policies to use this function.

-- Step 1: Create helper function to check if user is Admin
-- This function uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = user_id
        AND role = 'Admin'
    );
$$;

-- Step 2: Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can manage services" ON services;
DROP POLICY IF EXISTS "Admins can manage causes" ON causes;

-- Step 3: Create new policies using the helper function

-- Users Table Policies
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update users"
    ON users FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- Services Table Policy
CREATE POLICY "Admins can manage services"
    ON services FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- Causes Table Policy
CREATE POLICY "Admins can manage causes"
    ON causes FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()));
