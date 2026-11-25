import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./export-dev-schema.sh', import.meta.url));
const root = resolve(script, '../..');
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
const bash = (code, args = [], env = {}) => spawnSync('/bin/bash', ['-c', code, 'fixture', script, ...args], {
  env: { ...cleanEnv, ...env }, encoding: 'utf8', timeout: 10000,
});
const sourced = (code, args = [], env = {}) => bash('source "$1"\nshift\n' + code, args, env);
const fixture = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'native-dev-schema-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// This runner never launches pg_dump or connects anywhere. It only writes fixture bytes.
const mockRunner = `
dev_schema_native() {
  printf '%s\\n' "$@" > "$FIXTURE_ARGS"
  local arg target=''
  for arg in "$@"; do
    case "$arg" in --file=*) target="\${arg#--file=}" ;; esac
  done
  printf '%s\\n' '-- synthetic schema fixture only' > "$target"
  if [[ \${FIXTURE_RACE:-} == file ]]; then
    printf '%s\\n' 'concurrent owner file' > "$DEV_SCHEMA_OUTPUT"
  elif [[ \${FIXTURE_RACE:-} == directory ]]; then
    mkdir "$DEV_SCHEMA_OUTPUT"
  elif [[ \${FIXTURE_RACE:-} == symlink ]]; then
    ln -s "$FIXTURE_ARGS" "$DEV_SCHEMA_OUTPUT"
  fi
  printf '%s\\n' "\${FIXTURE_DIAGNOSTIC:-SYNTHETIC_SECRET_DO_NOT_PRINT}" >&2
  return "\${FIXTURE_EXIT:-0}"
}
`;

test('no arguments and help do not export; no owner run is invoked by this suite', () => {
  for (const args of [[], ['--help']]) {
    const result = spawnSync('/bin/bash', [script, ...args], { env: cleanEnv, encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no export by default/);
    assert.equal(result.stderr, '');
  }
});

test('unsupported target, credential, and executable inputs fail without echoing values', () => {
  for (const option of ['--host', '--db-url', '--password', '--pg-dump', '--test-mode']) {
    const result = spawnSync('/bin/bash', [script, option, 'SYNTHETIC_SECRET_DO_NOT_PRINT'], {
      env: cleanEnv, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_SECRET/);
  }
  assert.notEqual(sourced('dev_schema_main --ca-cert /unused').status, 0);
});

test('TTY guard rejects noninteractive execution before any native tool call', () => {
  const result = sourced('dev_schema_require_tty');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owner-operated TTY/);
});

test('offline check validates local inputs without entering the export path', (t) => {
  const dir = fixture(t);
  const ca = join(dir, 'approved-fixture.pem');
  const output = join(dir, 'dev.restricted.sql');
  const result = sourced(`
    dev_schema_validate_ca() { [[ $1 == "$FIXTURE_CA" ]]; }
    dev_schema_require_version() { return 0; }
    dev_schema_require_tty() { exit 91; }
    dev_schema_native() { exit 92; }
    dev_schema_export() { exit 93; }
    dev_schema_main --check --ca-cert "$1" --output "$2"
  `, [ca, output], { FIXTURE_CA: ca });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No connection or export attempted/);
  assert.deepEqual(readdirSync(dir), []);
  assert.doesNotMatch(result.stdout + result.stderr, /approved-fixture|dev\.restricted/);
});

test('offline check cannot be combined with export or target confirmation', () => {
  for (const args of ['--check --run', '--run --check', '--check --check',
    '--check --confirm-dashboard-target hgomsmhsybrxjdxbgkjy', '--check --ca-cert /unused']) {
    const result = sourced(`dev_schema_require_version() { exit 92; }
      dev_schema_export() { exit 93; }
      dev_schema_main ${args}`);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
});

test('all exported PG overrides are refused without printing values', () => {
  for (const key of ['PGPASSWORD', 'PGSERVICE', 'PGPASSFILE', 'PGHOST', 'PGOPTIONS', 'PGSSLROOTCERT']) {
    const result = sourced('dev_schema_require_clean_env', [], { [key]: 'SYNTHETIC_SECRET_DO_NOT_PRINT' });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /SYNTHETIC_SECRET/);
  }
  assert.equal(sourced('dev_schema_require_clean_env').status, 0);
});

test('CA validation requires an explicit readable certificate, not arbitrary text', (t) => {
  const dir = fixture(t);
  const ca = join(dir, 'bad.pem');
  writeFileSync(ca, 'not a certificate');
  for (const path of ['', 'relative.pem', join(dir, 'absent.pem'), ca]) {
    const result = sourced('dev_schema_validate_ca "$1"', [path]);
    assert.notEqual(result.status, 0);
  }
});

test('pure version report validation needs no installed native binary', () => {
  for (const [version, expected] of [
    ['pg_dump (PostgreSQL) 17.7 (Homebrew)', 0],
    ['pg_dump (PostgreSQL) 16.9', 1],
    ['pg_dump (PostgreSQL) 18.0', 1],
    ['pg_dump (PostgreSQL) 170.7', 1],
    ['pg_dump (PostgreSQL) 17.invalid', 1],
    ['pg_dump (PostgreSQL) 17.7\nuntrusted extra line', 1],
  ]) {
    const result = sourced('dev_schema_native() { exit 99; }\ndev_schema_validate_version_report "$FIXTURE_VERSION"', [], {
      FIXTURE_VERSION: version,
    });
    assert.equal(result.status, expected);
  }
});

test('runtime guard refuses a missing binary before attempting a native command', (t) => {
  const dir = fixture(t);
  const copy = join(dir, 'helper.sh');
  const marker = join(dir, 'native-was-called');
  const source = readFileSync(script, 'utf8');
  const declaration = "readonly DEV_SCHEMA_PG_DUMP='/opt/homebrew/opt/postgresql@17/bin/pg_dump'";
  assert.ok(source.includes(declaration));
  // Only this disposable source fixture has a different fixed path. Production
  // retains its readonly Homebrew path and exposes no executable override.
  writeFileSync(copy, source.replace(declaration, "readonly DEV_SCHEMA_PG_DUMP='/nonexistent/native-dev-schema-fixture/pg_dump'"));
  const result = bash('source "$2"\ndev_schema_native() { : > "$FIXTURE_MARKER"; }\ndev_schema_require_version', [copy], {
    FIXTURE_MARKER: marker,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixed native PostgreSQL 17 pg_dump executable is unavailable/);
  assert.equal(existsSync(marker), false);
});

test('output must be new, restricted, external, and not a symlink or directory', (t) => {
  const dir = fixture(t);
  const output = join(dir, 'dev.restricted.sql');
  assert.equal(sourced('dev_schema_validate_output "$1"', [output]).status, 0);
  for (const path of ['relative.restricted.sql', join(dir, 'dev.sql'), join(root, 'dev.restricted.sql')]) {
    assert.notEqual(sourced('dev_schema_validate_output "$1"', [path]).status, 0);
  }
  writeFileSync(output, 'existing');
  assert.notEqual(sourced('dev_schema_validate_output "$1"', [output]).status, 0);
  rmSync(output);
  symlinkSync(join(dir, 'missing'), output);
  assert.notEqual(sourced('dev_schema_validate_output "$1"', [output]).status, 0);
  rmSync(output);
  mkdirSync(output);
  assert.notEqual(sourced('dev_schema_validate_output "$1"', [output]).status, 0);
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { mode: 0o755 });
  assert.notEqual(sourced('dev_schema_validate_output "$1"', [join(publicDir, 'dev.restricted.sql')]).status, 0);
});

test('other Git repositories are rejected even with inherited Git overrides', (t) => {
  const dir = fixture(t);
  const init = spawnSync('/usr/bin/git', ['init', '--quiet', dir], { encoding: 'utf8' });
  assert.equal(init.status, 0);
  const result = sourced('dev_schema_validate_output "$1"', [join(dir, 'dev.restricted.sql')], {
    GIT_DIR: '/nonexistent', GIT_WORK_TREE: '/nonexistent',
  });
  assert.notEqual(result.status, 0);
});

test('mock export retains required flags, publishes 0600, and deletes staging/diagnostics', (t) => {
  const dir = fixture(t);
  const output = join(dir, 'dev.restricted.sql');
  const args = join(dir, 'args');
  const result = sourced(mockRunner + '\ndev_schema_validate_output "$1" && dev_schema_export', [output], {
    FIXTURE_ARGS: args,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.equal(readFileSync(output, 'utf8'), '-- synthetic schema fixture only\n');
  const flags = readFileSync(args, 'utf8').trim().split('\n');
  assert.deepEqual(flags.slice(0, -1), [
    '--host=db.hgomsmhsybrxjdxbgkjy.supabase.co', '--port=5432', '--dbname=postgres', '--username=postgres',
    '--password', '--schema-only', '--format=plain', '--quote-all-identifiers', '--lock-wait-timeout=10s',
  ]);
  assert.match(flags.at(-1), /^--file=.*\/schema\.sql$/);
  assert.deepEqual(readdirSync(dir).sort(), ['args', 'dev.restricted.sql']);
  assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_SECRET/);
});

test('session export pins the dashboard endpoint, tenant username and unchanged schema flags', (t) => {
  const dir = fixture(t);
  const output = join(dir, 'dev.restricted.sql');
  const args = join(dir, 'args');
  const result = sourced(mockRunner + '\ndev_schema_validate_output "$1" && dev_schema_export session', [output], {
    FIXTURE_ARGS: args,
  });
  assert.equal(result.status, 0, result.stderr);
  const flags = readFileSync(args, 'utf8').trim().split('\n');
  assert.deepEqual(flags.slice(0, -1), [
    '--host=aws-1-eu-central-1.pooler.supabase.com', '--port=5432', '--dbname=postgres',
    '--username=postgres.hgomsmhsybrxjdxbgkjy', '--password', '--schema-only', '--format=plain',
    '--quote-all-identifiers', '--lock-wait-timeout=10s',
  ]);
  assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_SECRET/);
});

test('connection selector rejects transaction, arbitrary targets and duplicate options without echoing them', () => {
  for (const args of ['--connection transaction', '--connection SYNTHETIC_SECRET',
    '--connection session --connection direct', '--connection', '--port 6543']) {
    const result = sourced(`dev_schema_export() { exit 93; }\ndev_schema_main --check ${args}`);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_SECRET/);
  }
});

test('main routes explicit session opt-in to the exporter after owner confirmation only', () => {
  const result = sourced(`
    dev_schema_require_tty() { return 0; }
    dev_schema_validate_ca() { return 0; }
    dev_schema_validate_output() { return 0; }
    dev_schema_require_version() { return 0; }
    dev_schema_export() { [[ $1 == session ]] && printf 'fixture-session-selected\\n'; }
    dev_schema_main --run --connection session --confirm-dashboard-target hgomsmhsybrxjdxbgkjy \\
      --ca-cert /fixture.pem --output /fixture.restricted.sql <<< 'EXPORT hgomsmhsybrxjdxbgkjy'
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'fixture-session-selected\n');
  assert.match(result.stderr, /DEV session pooler:/);
});

test('failed mocked dump removes partial output and never prints captured diagnostics', (t) => {
  const dir = fixture(t);
  const output = join(dir, 'dev.restricted.sql');
  const result = sourced(mockRunner + '\ndev_schema_validate_output "$1" && dev_schema_export', [output], {
    FIXTURE_ARGS: join(dir, 'args'), FIXTURE_EXIT: '1',
  });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(output), false);
  assert.deepEqual(readdirSync(dir), ['args']);
  assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_SECRET/);
});

test('failed export emits only fixed hints and cleans up for every category', (t) => {
  const dir = fixture(t);
  const output = join(dir, 'dev.restricted.sql');
  for (const [diagnostic, hint] of [
    ['password authentication failed', 'Database password rejected.'],
    ['no password supplied', 'No database password was supplied.'],
    ['certificate verify failed', 'TLS verification or negotiation failed.'],
    ['Network is unreachable', 'Could not reach the direct database endpoint.'],
    ['permission denied', 'Database access or export permission denied.'],
    ['server version mismatch', 'PostgreSQL tool/server version mismatch.'],
    ['lock timeout', 'Database lock wait timed out.'],
    ['unknown reason', 'Unclassified pg_dump failure.'],
  ]) {
    const result = sourced(mockRunner + '\ndev_schema_validate_output "$1" && dev_schema_export', [output], {
      FIXTURE_ARGS: join(dir, 'args'), FIXTURE_EXIT: '1',
      FIXTURE_DIAGNOSTIC: `pg_dump: error: ${diagnostic} SYNTHETIC_SECRET_DO_NOT_PRINT`,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `Export refused: ${hint} Partial output removed; raw diagnostics withheld.\n`);
    assert.deepEqual(readdirSync(dir), ['args']);
  }
});

test('atomic publication never overwrites a raced file, directory, or symlink', (t) => {
  for (const kind of ['file', 'directory', 'symlink']) {
    const dir = fixture(t);
    const output = join(dir, 'dev.restricted.sql');
    const result = sourced(mockRunner + '\ndev_schema_validate_output "$1" && dev_schema_export', [output], {
      FIXTURE_ARGS: join(dir, 'args'), FIXTURE_RACE: kind,
    });
    assert.notEqual(result.status, 0);
    assert.equal(readdirSync(dir).some((name) => name.startsWith('.native-dev-schema.')), false);
    if (kind === 'file') assert.equal(readFileSync(output, 'utf8'), 'concurrent owner file\n');
    if (kind === 'directory') assert.deepEqual(readdirSync(output), []);
  }
});

test('a successful mock without a nonempty artifact cannot publish', (t) => {
  const dir = fixture(t);
  const output = join(dir, 'dev.restricted.sql');
  const result = sourced('dev_schema_native() { return 0; }\ndev_schema_validate_output "$1" && dev_schema_export', [output]);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(output), false);
  assert.deepEqual(readdirSync(dir), []);
});

test('production runner is fixed, uses clean environment and verified TLS, with no secret inputs', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /readonly DEV_SCHEMA_PG_DUMP='\/opt\/homebrew\/opt\/postgresql@17\/bin\/pg_dump'/);
  assert.match(source, /\/usr\/bin\/env -i PATH=\/usr\/bin:\/bin LC_ALL=C HOME=\/nonexistent/);
  assert.match(source, /PGPASSFILE=\/dev\/null PGSSLMODE=verify-full PGSSLROOTCERT="\$DEV_SCHEMA_CA"/);
  assert.match(source, /PGOPTIONS='-c default_transaction_read_only=on'/);
  assert.doesNotMatch(source, /PGPASSWORD=|--no-owner|--no-privileges|--data-only|pg_dumpall/);
  assert.ok(source.indexOf('dev_schema_require_tty || return 1') < source.indexOf('dev_schema_require_version || return 1'));
});
