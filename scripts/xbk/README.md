# XBK Automation Scripts

- `seed.py`: truncate and seed `xbk_students`, `xbk_courses`, `xbk_selections`.
- `import_samples.py`: generate import sample xlsx files and a manifest.
- `smoke.py`: run import/preview/update/delete/export smoke checks and save report.
- `run_all.py`: one-click `seed + import_samples + smoke`.

## Quick Start

```bash
python scripts/xbk/run_all.py
```

Artifacts:
- `test-results/xbk/seed-summary.json`
- `test-results/xbk-import-samples/manifest.json`
- `test-results/xbk/xbk-smoke-report.json`
- `test-results/xbk-smoke-report.json` (compat)
- `test-results/xbk-exports/*.xlsx`
