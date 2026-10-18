# SAT12 Stage 3 authentication setup

Task 4 implements Supabase email/password authentication with cookie-backed SSR. The application uses only the browser-safe Supabase URL and publishable key. It does not create a service-role client.

## Local environment

Keep these values in the ignored `.env.local` file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` is the single trusted origin used to construct signup, recovery, and callback redirects. Production requires an explicit HTTPS origin. Request `Host` and forwarded-host headers are not used to construct authentication redirects.

## Supabase Dashboard settings required for later verification

Do not change these settings without a separately approved remote operation. When verification is authorized in the Development project:

1. In **Authentication > Providers > Email**, enable email/password and require email confirmation.
2. In **Authentication > URL Configuration**, set the Development Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect allow list.
3. Keep Google and other OAuth providers disabled for Stage 3.
4. In **Authentication > Multi-Factor Authentication**, enable TOTP factors.
5. Configure development email delivery and templates so confirmation and recovery links return through `/auth/callback`. Production requires a separately reviewed SMTP sender/domain, URLs, rate limits, and abuse controls.

## Security behavior

- Protected pages and Server Actions verify JWT claims, then call `auth.getUser()` to confirm that the Auth identity is still active, and finally load the authoritative profile role under RLS.
- Signup accepts only `full_name` metadata. New roles remain database-controlled; a client cannot request `owner_agent` or `admin`.
- Admin authorization requires the database `admin` role, an `aal2` JWT, and a TOTP authentication event no older than 15 minutes. An AAL1 or stale-AAL2 administrator is routed to the TOTP challenge and remains denied by database helpers.
- Authenticator replacement enrolls and verifies the new factor before removing the old one. A failed verification leaves the old factor untouched; a failed old-factor removal leaves both factors active and reports the failure.
- Return paths accept only same-origin relative paths. Callback responses are built from `NEXT_PUBLIC_SITE_URL`, preventing host-header and external-return redirects.
- Password recovery always returns a generic response so account existence is not disclosed.

## Verification still blocked by local-only scope

This task does not create Auth users or change remote Auth settings. End-to-end confirmation email, recovery email, cookie refresh, TOTP enrollment/challenge, disabled-user rejection, and AAL2 browser verification therefore remain pending a separately approved Development-project test run. Production deployment remains blocked until AAL2 enforcement and the administrator recovery procedure are proven in a non-production environment.

Real customer image uploads remain disabled. The deferred Storage API suite must first add `profiles` and `legal_holds` cleanup verification and pass all nine authorized scenarios.
