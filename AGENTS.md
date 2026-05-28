<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SyllabusAI — Agent Guidelines

## Stack
- Next.js 16 App Router (no Pages Router)
- Supabase (@supabase/ssr — never @supabase/auth-helpers, it is deprecated)
- Tailwind CSS for all styling
- JavaScript (no TypeScript)

## Next.js 16 Specific Rules
- Use proxy.js in the project root, NOT middleware.js (renamed in Next.js 16)
- The exported function must be named `proxy`, not `middleware`
- Always use the App Router. Files go in /app, not /pages.
- Prefer Server Components by default. Only add "use client" when the
  component needs interactivity (onClick, useState, etc.)
- Use next/navigation for routing (useRouter, redirect), not next/router.
- API routes go in app/api/[route]/route.js and export named functions
  (GET, POST) — not a default export.

## Supabase Rules
- Use @supabase/ssr for all Supabase client creation.
- Server components and API routes use createServerClient from @supabase/ssr.
- Client components use createBrowserClient from @supabase/ssr.
- Never import from @supabase/auth-helpers-nextjs.
- Always check for a session before returning data. Use RLS as the
  primary security layer.
- Environment variables:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - ANTHROPIC_API_KEY (server only — no NEXT_PUBLIC prefix)

## Auth Rules
- Protect routes by checking session in the layout or page server component.
- Redirect unauthenticated users to /login.
- Use Supabase Auth for all authentication — no custom auth.

## Data Rules
- Every table has a user_id column linked to auth.users.
- RLS is enabled on every table.
- FK chain: auth.users → classes → uploads → events / syllabus_info.

## Anthropic Rules
- Claude API calls happen only in API routes (server-side).
- Use model: "claude-haiku-4-5-20251001" for fast tasks.
- Use model: "claude-sonnet-4-6" for the main syllabus parse.
- Always prompt Claude to return JSON when inserting into the database.

## Style Rules
- Use Tailwind utility classes only — no custom CSS files beyond globals.css.
- No inline styles.
- Mobile-first responsive design.