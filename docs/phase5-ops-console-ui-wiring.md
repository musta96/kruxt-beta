# Phase 5 Ops Console UI Wiring

Use `createPhase5OpsConsoleUiFlow` as the controller for B2B gym operations actions.

## Operator screen sequence

1. Load classes + booking/waitlist snapshot
2. Create/update class and booking records
3. Promote waitlist members
4. Record check-in + access log evidence
5. Record waiver/contract acceptances
6. Render refreshed snapshot after each mutation

## Runtime contract

- `load(gymId, options?)`
  - returns `{ ok: true, snapshot }` or `{ ok: false, error }`
- `createClass(gymId, input)`
- `updateClass(gymId, classId, input)`
- `setClassStatus(gymId, classId, status)`
- `upsertClassBooking(gymId, input)`
- `updateClassBookingStatus(gymId, bookingId, status, classIdForRefresh)`
- `updateWaitlistEntry(gymId, waitlistEntryId, input, classIdForRefresh)`
- `promoteWaitlistMember(gymId, classId)`
- `recordCheckinAndAccessLog(gymId, input, accessLogOverride?)`
- `recordWaiverAcceptance(gymId, waiverId, input)`
- `recordContractAcceptance(gymId, contractId, input)`

All mutation methods return a refreshed `snapshot` so the console can render server-backed state with no extra request roundtrip.

## Error handling

Error shape:

- `code`
- `step` (`class_management`, `waitlist`, `checkin_access`, `waiver_contract`, `billing_telemetry`)
- `message`
- `recoverable`

Recommended UI behavior:

- if `recoverable = true`, keep the operator in the same module and show retry CTA
- if `recoverable = false` (for example `ADMIN_STAFF_ACCESS_DENIED`), disable controls and route to unauthorized view

## Acceptance mapping

- Class create/update/status, booking upsert/update, and waitlist promotion all refresh the same snapshot contract.
- Check-in recording always writes both `gym_checkins` and `checkins` evidence via one mutation.
- Waiver/contract recording returns acceptance IDs plus refreshed evidence lists.
- Staff access denials remain non-recoverable and block operational mutations.
