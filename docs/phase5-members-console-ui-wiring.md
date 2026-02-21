# Phase 5 Members Console UI Wiring

Use `createPhase5MembersConsoleUiFlow` as the controller for Prompt 5 admin Members Console.

## Flow contract

- `load(gymId, options)`:
  - Loads queue snapshot via `createPhase2StaffConsoleUiFlow.load(...)`.
  - Loads profile + billing + check-in signals.
  - Returns segmented/searchable rows, column preset visibility, queue summary, and selected profile panel timeline.
- `assignRole(gymId, membershipId, role, auditNote, options)`:
  - Requires non-empty audit note.
  - Uses phase2 assignment mutation contract.
  - Reloads full members snapshot.
- `setStatus(gymId, membershipId, status, options)`:
  - Uses phase2 membership status mutation for `trial|active|paused|cancelled`.
  - Uses `B2BOpsService.upsertMemberSubscription(...)` for `past_due`.
  - Reloads full members snapshot.
- `bulkAssignRole(...)` and `bulkSetStatus(...)`:
  - Process selected memberships.
  - Return both `updatedMembershipIds` and `failedMembershipIds`.
  - Reload full snapshot after execution.

## UI requirements mapped

- Member search: `options.search`
- Segmented filters: `options.segment` (`all`, `pending`, `trial`, `active`, `past_due`, `paused`, `cancelled`)
- Role filters: `options.roles`
- Column visibility presets: `options.columnPreset` (`default`, `operations`, `billing`, `compliance`)
- Profile side panel timeline: `snapshot.selectedProfilePanel.timeline`
- Sticky header + bulk actions + audit-note gate:
  - `snapshot.tableUx.stickyHeader`
  - `snapshot.tableUx.supportsBulkActions`
  - `snapshot.tableUx.requiresAuditNoteForRoleChange`

## Error handling

- All operations return explicit `ok: false` with:
  - `error.code`
  - `error.step`
  - `error.message`
  - `error.recoverable`

Common UI-targeted codes:

- `MEMBERS_CONSOLE_AUDIT_NOTE_REQUIRED`
- `MEMBERS_CONSOLE_MEMBERSHIP_NOT_FOUND`
- `ADMIN_STAFF_ACCESS_DENIED`
- `ADMIN_AUTH_REQUIRED`
