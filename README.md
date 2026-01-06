# Google OAuth Login with Supabase Auth

A clean Next.js 14 App Router implementation of Google OAuth authentication using Supabase Auth with `@supabase/ssr`.

## Features

- ✅ Google OAuth login via Supabase Auth
- ✅ Dynamic redirect URLs using `window.location.origin` (works on any domain)
- ✅ Protected routes with server-side authentication checks
- ✅ No hardcoded URLs or localhost references
- ✅ Clean TypeScript implementation with Next.js 14 App Router
- ✅ Modern UI with TailwindCSS and shadcn/ui

## Project Structure

```
app/
├── page.tsx                    # Root page (redirects to /auth)
├── auth/
│   ├── page.tsx               # Login page with Google OAuth button
│   ├── callback/
│   │   └── route.ts          # OAuth callback handler (exchanges code for session)
│   └── signout/
│       └── route.ts          # Sign out handler
└── profile/
    └── page.tsx              # Protected profile page (shows user info)

lib/
└── supabase/
    ├── client.ts             # Browser client for client components
    └── server.ts             # Server client for Route Handlers and Server Components
```

## Prerequisites

1. **Supabase Project**
   - Create a project at [supabase.com](https://supabase.com)
   - Get your project URL and anon key from Project Settings > API

2. **Google OAuth Provider Setup**
   - In your Supabase Dashboard, go to Authentication > Providers
   - Enable Google provider
   - Create a Google OAuth Client ID:
     - Go to [Google Cloud Console](https://console.cloud.google.com/)
     - Create a new project or select existing one
     - Enable Google+ API
     - Go to Credentials > Create Credentials > OAuth Client ID
     - Application type: Web application
     - Add authorized redirect URIs:
       - For development: `https://your-project-ref.supabase.co/auth/v1/callback`
       - For production: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase Google provider settings

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** Replace with your actual Supabase project credentials from Project Settings > API.

### 3. Configure Supabase Redirect URLs

In your Supabase Dashboard:
- Go to Authentication > URL Configuration
- Add your site URLs to the list of allowed redirect URLs:
  - Development: `http://localhost:3000/auth/callback`
  - Production: `https://yourdomain.com/auth/callback`

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` - you'll be redirected to `/auth` where you can sign in with Google.

### 5. Build for Production

```bash
npm run build
npm start
```

## How It Works

### Authentication Flow

1. **Root Page (`/`)**: Immediately redirects to `/auth`

2. **Login Page (`/auth`)**:
   - Displays "Continue with Google" button
   - Uses `signInWithOAuth` with `redirectTo: window.location.origin/auth/callback`
   - No hardcoded URLs - works on any domain

3. **Callback Handler (`/auth/callback/route.ts`)**:
   - Receives OAuth `code` from Google
   - Calls `exchangeCodeForSession` to create Supabase session
   - Redirects to `/profile` on success
   - Redirects to `/auth?error=...` on failure

4. **Profile Page (`/profile`)**:
   - Server Component that checks authentication
   - Redirects to `/auth` if no session
   - Displays user info (name, email, avatar) if authenticated
   - Includes sign out button

### Dynamic Redirect URLs

The key to making this work across all environments is using `window.location.origin`:

```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})
```

This automatically adapts to:
- Local development: `http://localhost:3000/auth/callback`
- Staging: `https://staging.yourdomain.com/auth/callback`
- Production: `https://yourdomain.com/auth/callback`

## Deployment

### Netlify / Vercel / Other Platforms

1. Push your code to GitHub/GitLab
2. Connect your repository to your hosting platform
3. Add environment variables in the platform's dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Update Supabase redirect URLs to include your production domain
5. Deploy!

The authentication will work automatically because `window.location.origin` adapts to the deployment URL.

## Troubleshooting

### "Invalid redirect URL" Error
- Ensure your callback URL is added to Supabase's allowed redirect URLs
- Format should be: `https://yourdomain.com/auth/callback`

### Not Redirecting After Login
- Check that Google OAuth is properly configured in Supabase
- Verify environment variables are set correctly
- Check browser console for errors

### Session Not Persisting
- Ensure cookies are enabled in your browser
- Check that your domain is properly configured
- Verify `@supabase/ssr` is installed (not old auth helpers)

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **Authentication**: Supabase Auth with `@supabase/ssr`
- **OAuth Provider**: Google

## License

MIT
