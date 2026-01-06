/*
  # Create profiles table for user management

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - matches auth.users.id
      - `email` (text, not null) - user email
      - `full_name` (text) - user's full name
      - `avatar_url` (text) - profile picture URL
      - `role` (text, not null, default 'pending') - user role: pending | user | manager | super_admin
      - `created_at` (timestamptz) - account creation timestamp

  2. Security
    - Enable RLS on `profiles` table
    - Add policy for authenticated users to read their own profile
    - Add policy for super_admin users to read all profiles
    - Add policy for super_admin users to update any profile's role
    - Add policy for users to update their own profile (except role)
    
  3. Notes
    - Role defaults to 'pending' for new users
    - Only super_admin can modify roles
    - Profiles are linked to auth.users via id
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'user', 'manager', 'super_admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Super admins can read all profiles
CREATE POLICY "Super admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Super admins can update any profile
CREATE POLICY "Super admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = role
  );

-- Policy: Allow users to insert their own profile on signup
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
