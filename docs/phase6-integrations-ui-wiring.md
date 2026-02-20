# Phase 6 Integrations UI Wiring

Use `createPhase6IntegrationsUiFlow` as the single mobile controller for Apple Health and Garmin activation.

## Screen sequence

1. Provider selection (`apple_health`, `garmin`)
2. Connect/disconnect provider
3. Queue sync job for connected provider
4. Render imported activity + mapping telemetry
5. Validate activation readiness report

## Runtime contract

- `load(userId, provider?)`
  - returns `{ ok: true, snapshot }` or `{ ok: false, error }`
- `connectProvider(userId, provider, input?)`
- `disconnectProvider(userId, provider)`
- `queueSync(userId, { connectionId, jobType?, cursor?, sourceWebhookEventId? })`
- `validateActivation(userId)`

All mutation methods return refreshed snapshot state so the UI can reconcile connections, sync jobs, and imports without extra fetch calls.

## Snapshot highlights

- `providerStates` includes per-provider connection state, latest sync job, cursor, and mapped/unmapped import counts.
- `duplicateImportGroups` exposes any `(provider, externalActivityId)` collisions for idempotency validation.
- `mappedImportCount` and `unmappedImportCount` expose end-to-end activity-to-workout mapping progress.
- `hiddenUnsupportedConnectionCount`/`hiddenUnsupportedImportCount` hide dark-launched providers in UI while preserving telemetry visibility.

## Activation validation report

`validateActivation(userId)` returns:

- `connectedProviders` and `missingProviders` for Apple/Garmin readiness
- `queuedOrRunningSyncJobCount` backlog signal
- `duplicateImportGroups` idempotency signal
- `mappingCoverage` ratio (`mapped / total imports`)
- `ready` boolean (`all providers connected`, `no duplicate groups`, `no queued/running backlog`)

## Error handling

Error shape:

- `code`
- `step` (`provider_selection`, `connection_management`, `sync_queue`, `import_mapping`)
- `message`
- `recoverable`

Recommended UI behavior:

- if `recoverable = true`, stay in current module and show retry CTA
- if `recoverable = false` (`INTEGRATION_PROVIDER_UNSUPPORTED`), restrict provider selector to active connectors only
