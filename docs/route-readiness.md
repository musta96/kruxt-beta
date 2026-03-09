# KRUXT Route Readiness

Last updated: 2026-03-09

## Web app (`apps/web`)

### Production-ready or close
- `/`
  - auth landing works
  - role-based redirect works
- `/accept-invite`
  - invite acceptance works
  - sign-in/sign-up fallback works
- `/profile`
  - real member profile load/save works
  - Supabase avatar upload/remove works
  - gym memberships render
- `/admin/gyms`
  - founder-only access works
  - create/edit/delete flow works
  - gym lookup/autocomplete support exists
- `/admin/users`
  - founder-only user membership management works
  - profile search -> UUID selection works
- `/admin/invites`
  - founder invite flow works
  - resend/revoke works
- `/admin/classes`
  - founder class scheduling works
  - recurring scheduling works
  - class catalog/templates work
- `/org/users`
  - gym leadership user management works
- `/org/invites`
  - gym leadership invite flow works
- `/org/classes`
  - gym leadership class scheduling works
- `/feed`
  - live feed events render from Supabase
  - reactions work
  - comments work
- `/log`
  - live exercise search works
  - minimal workout submission works through `log_workout_atomic`
- `/guild`
  - live home-gym / roster / upcoming class view works
- `/rank`
  - live leaderboards and challenge join/leave work

### Functional but still scaffold-level
- `/admin`
  - founder access works
  - overview page is still a summary shell, not a full KPI dashboard
- `/org`
  - org access works
  - overview page is still a shell, not a complete operations dashboard

### Not rebuilt yet in the new web app
- any other old Lovable-only public/member routes not present under `apps/web/app`

## Native mobile app (`apps/mobile`)

### Working baseline
- native auth landing
- native feed screen with live `feed_events` read
- native profile screen with real save flow
- native avatar upload/remove via Supabase storage
- native invite acceptance via deep link token
- native minimal workout submit flow (one selected exercise + one set)
- persistent Supabase auth session via AsyncStorage

### Still not ready
- full onboarding flow in native UI
- full native proof/social interactions UI
- full multi-block workout logger UI
- guild/rank native surfaces
- TestFlight QA and App Store release preparation

## Practical conclusion
No, not every page and section is ready yet.

The founder/org backoffice is mostly functional.

The member web surface now has a working baseline, but it still lacks richer proof/media, moderation, and deeper social flows.

The native mobile surface now has a real baseline, but it is not yet feature-complete enough to call the whole product finished.
