# Phase 2 Admin Console UI Wiring

Use `createPhase2StaffConsoleUiFlow` as the controller for gym staff membership operations.

## Operator screen sequence

1. Access gate (`require staff membership`)
2. Membership queue (`pending` first)
3. Approve/reject actions
4. Role assignment actions
5. Refreshed snapshot render

## Runtime contract

- `load(gymId)`
  - returns `{ ok: true, snapshot }` or `{ ok: false, error }`
- `approvePendingMembership(gymId, membershipId)`
- `rejectPendingMembership(gymId, membershipId)`
- `setMembershipStatus(gymId, membershipId, status)`
- `assignMembershipRole(gymId, membershipId, role)`

All mutation methods return a full refreshed snapshot so UI reflects latest state without extra calls.

## Error handling

Error shape:

- `code`
- `step` (`access`, `queue`, `membership_status`, `role_assignment`, `snapshot_refresh`)
- `message`
- `recoverable`

Recommended UI behavior:

- if `recoverable = true`, keep operator on current screen and show retry CTA
- if `recoverable = false` (for example staff access denied), block action controls and route to unauthorized view

## Acceptance mapping

- Non-staff users cannot execute staff actions (`ADMIN_STAFF_ACCESS_DENIED`)
- Staff can approve pending members (`approvePendingMembership`)
- Staff can change member role (`assignMembershipRole`)
- UI reflects latest state after every mutation (`snapshot` returned on success)
