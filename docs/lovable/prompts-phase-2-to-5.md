# Lovable Prompt Pack (Phases 2-6)

Use these prompts in order. Keep each generation isolated and commit after each module.

## Prompt 1: App shell + guild visual system

Create a mobile-first app shell named `KRUXT` with iOS-first navigation and dark premium performance style.

Requirements:
- Bottom tab bar with 5 tabs: `Proof Feed`, `Log`, `Guild Hall`, `Rank Ladder`, `Profile`
- Brand tone: short declarative copy (`Proof counts`, `Rank is earned weekly`, `Protect the chain`)
- Design tokens:
  - Background `#0E1116`
  - Surface `#171C24`
  - Accent `#35D0FF`
  - Primary text `#F4F6F8`
  - Secondary text `#A7B1C2`
- Typography:
  - Headlines: condensed sans (Oswald-like)
  - Body: clean grotesk (Sora-like)
  - Stats numbers: monospaced
- Card style: squared/chamfered panel look, subtle steel borders, no glassmorphism overload
- Accessibility: dynamic type-friendly sizing, AA contrast

## Prompt 2: Workout logger (sub-60 second flow)

Create component `WorkoutLogger` using card-based workflow optimized for one-thumb operation.

Requirements:
- Steps:
  1. Select workout type (`strength`, `functional`, `hyrox`, `crossfit`, `conditioning`)
  2. Add exercises with search/autocomplete
  3. Add sets (`reps`, `weight_kg`, `rpe`, optional `duration_seconds`, `distance_m`)
  4. Select visibility (`public`, `followers`, `gym`, `private`)
  5. Submit `Post Proof`
- Include support for block types: `straight_set`, `superset`, `circuit`, `emom`, `amrap`
- Add sticky primary CTA button `Log to claim`
- Add optimistic loading states and inline validation
- Expose payload object ready for Supabase RPC `log_workout_atomic`

## Prompt 3: Proof feed + interaction layer

Create `ProofFeed` page with social cards driven by workouts and feed events.

Requirements:
- Feed card fields:
  - user avatar + display name
  - gym badge
  - workout title + type + duration
  - total sets + volume + PR indicator
  - caption
- Actions:
  - Reaction picker (`fist`, `fire`, `shield`, `clap`, `crown`)
  - Comment thread with reply support
  - `Post Proof` equivalent action for new log entry
- Include blocked-user handling placeholder state
- Support infinite scroll and pull-to-refresh
- Visual behavior should feel fast, direct, athletic, and non-gimmicky

## Prompt 4: Guild Hall + B2B core operations screens

Create `GuildHall` module for both members and staff with role-based views.

Requirements:
- Member view:
  - active membership plan
  - upcoming classes
  - waivers status
  - check-in history
- Staff view:
  - member list with status filters (`active`, `paused`, `cancelled`)
  - class scheduler with capacity and waitlist
  - waitlist promotion actions
  - check-in/access log monitor
  - waiver document manager
- Keep copy direct and rule-based (`Proof first`, `Roster updates weekly`)
- Ensure desktop admin responsiveness with dense data tables

## Prompt 5: Rank Ladder + Trials

Create `RankLadder` and `Trials` modules.

Requirements:
- Rank ladder tabs: `Global`, `Guild`, `Lift`, `Challenge`
- Leaderboard row: rank, avatar, display name, score, recent trend
- Trials list with join/leave and progress indicator
- Weekly rank reset visual cues and `Legend is rare` microcopy
- Keep design consistent with existing sigil/banner language

## Prompt 6: Integrations (Apple + Garmin first)

Create `IntegrationsHub` with two sections: `Connected Devices` and `Sync Activity`.

Requirements:
- Connected devices cards:
  - providers shown in order: `apple_health`, `garmin`, then disabled providers (`fitbit`, `huawei_health`, `suunto`, `oura`, `whoop`)
  - each card shows status (`active`, `revoked`, `expired`, `error`), last sync timestamp, and last error if present
  - CTA labels:
    - active: `Sync now`
    - inactive/error: `Reconnect`
    - disabled providers: `Coming soon`
- Sync activity panel:
  - recent sync jobs table (`status`, `retry_count`, `started_at`, `finished_at`)
  - imported activities list (`activity_type`, `duration`, `distance`, `imported_at`)
  - cursor snapshot badge (`last_webhook_event_id`, `last_synced_at`)
- Use direct KRUXT copy:
  - `Proof from devices still needs receipts.`
  - `Only verified providers can advance rank data.`
- Wire actions to runtime contracts:
  - `IntegrationService.upsertConnection`
  - `IntegrationService.queueSyncJob`
  - `createPhase6IntegrationsFlow.load`
