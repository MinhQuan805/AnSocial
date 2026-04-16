# Google Auth + Multi-Provider Implementation Guide

## 📋 Overview

This refactor replaces Session-based auth with **Google OAuth as primary auth** + **Provider Registry Pattern** for multi-platform integrations.

### Key Benefits
- ✅ Mandatory Google login (enterprise-grade auth)
- ✅ Extensible provider system (add TikTok, Instagram, YouTube in minutes)
- ✅ Decoupled provider logic (no more monolithic auth)
- ✅ Future-proof architecture (scales from 2 to 100+ providers)

---

## 🚀 Implementation Steps

### Phase 1: Database Migration

```bash
# 1. Backup existing database
# 2. Run schema migration in Supabase
# - Replace old schema with: supabase/schema_v2_google_auth.sql
# OR manually execute:

-- Delete old tables (after data migration)
-- Drop tables: sessions, notion_integrations, facebook_integrations

-- Create new tables:
-- CREATE TABLE users (...)
-- CREATE TABLE provider_connections (...)
-- CREATE TABLE insight_snapshots (user_id references users)
-- CREATE TABLE auto_schedule_configs (user_id references users)
```

### Phase 2: Environment Configuration

Add to `.env.local`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_JWT_SECRET=your-jwt-secret-key

# OAuth Redirect URIs
REDIRECT_GOOGLE=http://localhost:3000/api/auth/google/callback
REDIRECT_FACEBOOK=http://localhost:3000/api/providers/facebook/callback
REDIRECT_NOTION=http://localhost:3000/api/auth/notion/callback

# Optional: TikTok (for future support)
TIKTOK_CLIENT_ID=your-tiktok-app-id
TIKTOK_CLIENT_SECRET=your-tiktok-app-secret
REDIRECT_TIKTOK=http://localhost:3000/api/providers/tiktok/callback
```

### Phase 3: Update Entry Point

In `app/layout.tsx`:

```typescript
import { initializeServices } from "@/lib/services/factory";

// Initialize services on app load
if (typeof window === "undefined") {
  initializeServices();
}
```

### Phase 4: Update Console App

Replace Session checks with Google Auth:

```typescript
// BEFORE
const sessionId = await sessionService.requireFromServerComponent();

// AFTER
const token = cookies().get("auth_token")?.value;
const userId = services.googleAuthService.validateToken(token)?.sub;
if (!userId) redirect("/login");
```

### Phase 5: Create Login Page

Create `app/login/page.tsx`:

```typescript
export default function LoginPage() {
  return (
    <div>
      <h1>Ana Social Dashboard</h1>
      <p>Sign in with Google to continue</p>
      <a href="/api/auth/google/start" className="btn-primary">
        Login with Google
      </a>
    </div>
  );
}
```

### Phase 6: Update Middleware (optional)

Create `middleware.ts` to enforce auth:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services/factory";

const protectedRoutes = ["/console", "/api/providers"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip auth for login and auth routes
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check auth for protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }
}

export const config = {
  matcher: ["/console/:path*", "/api/providers/:path*"],
};
```

---

## 📦 API Endpoints

### Authentication

```
GET  /api/auth/google/start
     → Initiates Google OAuth flow

GET  /api/auth/google/callback
     → Google OAuth callback handler
     ← Sets auth_token cookie
```

### Provider Management

```
POST /api/providers/connect
     Body: { flowMode: 'popup' | 'redirect' }
     ← { authorizeUrl, state }

GET  /api/providers/:type/callback
     → Provider OAuth callback
     ← HTML with postMessage to opener

GET  /api/providers
     ← { available: [], connected: {...} }

DELETE /api/providers/:type
     ← Disconnects provider
```

---

## 🔧 Adding a New Provider (e.g., TikTok)

### Step 1: Implement Provider Class

```typescript
// lib/services/providers/tiktok-provider.ts
export class TikTokProvider extends BaseProvider {
  readonly type = "tiktok";
  
  buildAuthorizeUrl(state: string): string {
    // Return TikTok OAuth URL
  }
  
  async executeAuth(code: string): Promise<ProviderConnectionPayload> {
    // Exchange code for token, fetch user info
  }
}
```

### Step 2: Register in Factory

```typescript
// lib/services/factory.ts
if (env.TIKTOK_CLIENT_ID && env.TIKTOK_CLIENT_SECRET) {
  const tiktokProvider = new TikTokProvider(connectionRepository, stateService);
  providerRegistry.register('tiktok', tiktokProvider);
}
```

### Step 3: Users Can Immediately Connect!

No UI changes needed - `/api/providers` will show TikTok in available list.

---

## 🔐 Security Considerations

### 1. Token Encryption
Tokens are encrypted in database using `TokenCryptoService`:
```typescript
const encryptedToken = tokenCrypto.encrypt(accessToken);
// Stored in DB
const decryptedToken = tokenCrypto.decrypt(encryptedToken);
```

### 2. CSRF Protection
All OAuth flows use state validation:
```typescript
const state = provider.issueState({ response });
// Later: provider.completeAuth({ ..., state })
```

### 3. Token Expiration
Long-lived tokens tracked:
```typescript
if (connection.expiresAt < now) {
  // Refresh token
  await provider.refreshToken?.(connection);
}
```

### 4. User Isolation
Users can only access their own provider connections via `userId` FK.

---

## 📊 Database Schema Changes

### Old (Session-based)
```
sessions (session_id UUID)
  ├─ notion_integrations
  ├─ facebook_integrations
  └─ insight_snapshots
```

### New (User + Provider Registry)
```
users (id UUID, google_id TEXT UNIQUE)
  ├─ provider_connections (provider_type, provider_id)
  ├─ insight_snapshots (user_id)
  └─ auto_schedule_configs (user_id)
```

---

## 🧪 Testing

### 1. Test Google Auth
```bash
# Start dev server
npm run dev

# Visit http://localhost:3000/login
# Should redirect to Google OAuth
# After auth, should land on /console
```

### 2. Test Provider Connection
```bash
# GET /api/providers
# Should return available: ['facebook', 'notion']

# POST /api/providers/connect
# Should return authorizeUrl for provider
```

### 3. Test Provider Callback
```bash
# After OAuth callback, provider should be in:
# GET /api/providers → connected: { facebook: {...} }
```

---

## 🎯 Migration Checklist

- [ ] Backup database
- [ ] Run schema_v2_google_auth.sql migration
- [ ] Add Google OAuth credentials to env
- [ ] Update factory.ts for service initialization
- [ ] Update layout.tsx to call initializeServices()
- [ ] Create /login page
- [ ] Update console to use Google auth
- [ ] Update API routes for auth checks
- [ ] Test Google login flow
- [ ] Test provider connection (Facebook/Notion)
- [ ] Remove old SessionService usage
- [ ] Deploy to production
- [ ] Monitor auth errors in logs

---

## 🚧 Future Extensions

### Add Instagram Provider
```typescript
const instagramProvider = new InstagramProvider(...);
providerRegistry.register('instagram', instagramProvider);
// ✅ Immediately available via /api/providers
```

### Add YouTube Provider
```typescript
const youtubeProvider = new YouTubeProvider(...);
providerRegistry.register('youtube', youtubeProvider);
// ✅ Immediately available
```

### Multi-Account Support (Per Provider)
Currently: 1 connection per user per provider
Future: Allow multiple YouTube channels per user
```typescript
// Change constraint from:
// UNIQUE(user_id, provider_type)
// To: 
// UNIQUE(user_id, provider_type, provider_user_id)
```

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `lib/core/auth.types.ts` | All TypeScript interfaces |
| `lib/services/auth/google-auth.service.ts` | Google OAuth logic |
| `lib/services/provider-registry.ts` | Factory pattern implementation |
| `lib/services/providers/base-provider.ts` | Base class for providers |
| `lib/services/providers/facebook-provider.ts` | Facebook implementation |
| `lib/services/auth/notion-auth.service.ts` | Legacy Notion OAuth implementation |
| `lib/services/auth-middleware.ts` | Auth validation middleware |
| `lib/repositories/google-auth.repository.ts` | User + Connection repos |
| `supabase/schema_v2_google_auth.sql` | Database schema |

---

## 🐛 Debugging

### Google Token Invalid
```
Error: "Invalid authentication token"

→ Check: Is GOOGLE_JWT_SECRET set correctly?
→ Check: Is auth_token cookie being set?
→ Check: Is token being validated with correct secret?
```

### Provider Not Found
```
Error: "Provider 'tiktok' not found"

→ Is TIKTOK_CLIENT_ID and TIKTOK_CLIENT_SECRET set?
→ Check factory.ts: Is TikTokProvider registered?
→ Is environment check passing?
```

### Token Encryption Error
```
Error: "Decryption failed"

→ Check: Is TOKEN_ENCRYPTION_KEY correct?
→ Was token encrypted with same key?
→ Token rotation needed?
```

---

## 📞 Support

For issues with:
- **Google OAuth**: Check Google Cloud Console > OAuth consent screen
- **Providers**: Verify API credentials and redirect URIs
- **Database**: Check Supabase schema and RLS policies
- **Tokens**: Verify TokenCryptoService key is correct

