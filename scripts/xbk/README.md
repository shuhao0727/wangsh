# XBK Automation Scripts

- `seed.py`: seed `xbk_students`, `xbk_courses`, `xbk_selections`; default preserves existing rows.
- `import_samples.py`: generate import sample xlsx files and a manifest.
- `smoke.py`: run import/preview/update/delete/export smoke checks and save report.
- `run_all.py`: one-click `seed + import_samples + smoke`.
- `_active_duplicate_common.py`: shared helper module (not an entry point). Owns DSN parsing,
  the production target guard and the duplicate-detection query that mirrors migration
  `20260914_0001_xbk_active_selection_unique`.
- `audit_active_duplicates.py`: **read-only** audit of historical active XBK duplicates; prints
  one entry per `(year, term, student_no)` group and can export the decision sheet to CSV.
- `resolve_active_duplicates.py`: applies a **complete CSV human decision** to soft-delete the
  surplus rows. It keeps the audit row snapshot and rejects stale/missing/new records instead of
  accepting id-only decisions. Dry-run is the default **behaviour** — there is no `--dry-run`
  flag, and omitting `--apply` writes nothing. A real write requires
  `--apply --confirm-stop-writes`.

## Historical active duplicates (manual adjudication)

Which of the conflicting rows is correct is a **business decision** — code cannot infer it.
Never let a tool or a script guess it.

**Check whether the group is one student or two before deciding.** The unique index is
`(year, term, student_no)` and **omits `grade`**, while the raw 学号 is only unique *within* a
grade — so two different students can collide on one 学号. The audit prints `grade` and `name`
per row and warns when a group spans more than one name; its CSV carries a `grade` column.
If a group's names differ, deleting either row destroys another student's valid selection, and
the usual fix is cleaning up stale unprefixed rows, not picking a winner. See the
[XBK feature doc](../../docs/features/XBK.md) for the source-data cross-check.
The resolver enforces this boundary again: if any row has an empty `name`/`grade`, or the rows in
one group do not all have the same non-empty `name` and `grade`, ordinary `keep=yes` adjudication
is rejected as a possible student-number collision.

```bash
# 1) read-only audit; exit code 3 means duplicates were found and need adjudication
python scripts/xbk/audit_active_duplicates.py \
  --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test \
  --output test-results/xbk/active-duplicates.csv

# 2) business side marks exactly one `keep=yes` per group; do not delete or rewrite snapshot columns

# 3) dry-run first — prints the plan, writes nothing
python scripts/xbk/resolve_active_duplicates.py \
  --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test \
  --decisions test-results/xbk/active-duplicates.csv

# 4) real run, only after the approved write stop, backup and review
python scripts/xbk/resolve_active_duplicates.py \
  --dsn postgresql://user:pass@127.0.0.1:5432/wangsh_dup_test \
  --decisions test-results/xbk/active-duplicates.csv \
  --apply --confirm-stop-writes
```

`--keep` is intentionally unsupported: an id list cannot prove that every current duplicate row was
reviewed or that the reviewed business data is still current. Both dry-run and apply require the
full audit CSV. The resolver checks `year`, `term`, `student_no`, `id`, `grade`, `name`,
`course_code`, `group_size`, and the complete-microsecond `created_at` / `updated_at` values; any
mismatch requires a fresh audit. `course_name` remains in the CSV for human review but is a derived
display field, not a strong consistency fingerprint, so a catalog display-name change alone does
not invalidate an otherwise current decision. Headers are normalized with trim + lowercase before
parsing; empty headers and collisions such as `keep` / `Keep` or `name` / ` name` are rejected
instead of accepting an unbound column or silently overwriting a column.

For a real write, one database transaction performs **LOCK → reread current groups and rows →
validate the complete snapshot → soft-delete → pre-commit validation → COMMIT**. Before commit it
proves that each adjudicated group has exactly the selected original keeper, every planned delete
is soft-deleted, and the migration-equivalent duplicate query is empty. Any validation or write
failure before commit raises and rolls the whole transaction back. A connection loss during the
commit round trip has an unknowable outcome: the resolver uses explicit transaction
`start` / `commit`, returns **exit code 6**, and requires a fresh read-only audit rather than
claiming that the transaction was not committed. A connection-close failure after an already
determined result is only a warning and does not replace that result.
If a pre-commit failure is followed by a rollback-confirmation failure, the resolver returns `5`
but explicitly requires a fresh read-only audit instead of claiming that rollback was confirmed.
Connection close is bounded by a timeout; close failure, timeout, or cancellation remains a warning
and cannot replace an already determined result.

Resolver exit codes are: `0` success, `2` parameter/connection setup error, `4` incomplete,
ambiguous, stale or identity-conflicting adjudication, `5` write/pre-commit failure with no COMMIT
request sent, and `6` unknown COMMIT outcome.

Connection strings come only from `--dsn` or `XBK_DUPLICATE_DSN`. These scripts deliberately
**never read the project `.env`**, so they cannot silently connect to production. Targets that
are not `loopback + test-named database` require `--allow-production` plus an interactive
confirmation. A DSN carrying **any query string** also requires it: asyncpg honours parameters
such as `?host=` / `?port=` / `?service=` when the netloc host is empty, which would otherwise
let a remote database masquerade as a loopback test target. See
[XBK feature doc](../../docs/features/XBK.md) for the full process contract.

## Quick Start

```bash
python scripts/xbk/run_all.py
```

The default flow is idempotent and does not truncate existing XBK data. Use
`python scripts/xbk/run_all.py --reset` only in a confirmed local/test database.

Artifacts:
- `test-results/xbk/seed-summary.json`
- `test-results/xbk-import-samples/manifest.json`
- `test-results/xbk/xbk-smoke-report.json`
- `test-results/xbk-smoke-report.json` (compat)
- `test-results/xbk-exports/*.xlsx`
