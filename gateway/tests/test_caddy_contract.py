"""Stdlib-only static regressions: no Docker, app imports, network or real uploads."""

import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "gateway/tests/validate_caddy_contract.py"
spec = importlib.util.spec_from_file_location("caddy_contract", HELPER)
contract = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = contract
spec.loader.exec_module(contract)

CONFIG = """{
    servers {
        timeouts {
            read_body 30s
        }
    }
}
:80 {
    @game_upload path /api/v1/admin/it/games
    @body_guarded not path /api/v1/admin/it/games
    request_body @game_upload {
        max_size 526385152
    }
    request_body @body_guarded {
        max_size 16MB
    }
}
"""
BUDGET = """from an_uninstalled_application import RequestBudget
_MIB = 1024 * 1024
GAME_UPLOAD_BUDGET = RequestBudget("game-upload", 502 * _MIB, 60.0)
raise RuntimeError("application source must never execute")
"""
GAME_BLOCK = "    request_body @game_upload {\n        max_size 526385152\n    }\n"
FALLBACK_BLOCK = "    request_body @body_guarded {\n        max_size 16MB\n    }\n"


class ByteSizeTests(unittest.TestCase):
    def test_integer_bytes(self):
        for literal in ("526385152", "526385152B"):
            with self.subTest(literal=literal):
                self.assertEqual(contract.byte_size(literal), 526_385_152)

    def test_decimal_mb(self):
        self.assertEqual(contract.byte_size("500MB"), 500_000_000)
        self.assertEqual(contract.byte_size("16MB"), 16_000_000)

    def test_binary_mib(self):
        self.assertEqual(contract.byte_size("502MiB"), 526_385_152)

    def test_invalid_literals_fail_closed(self):
        for literal in ("-502MiB", "-1", "0", "0MB", "502.0MiB", "+526385152", "500mb", "502GB", "{$SIZE}", ""):
            with self.subTest(literal=literal), self.assertRaises(contract.ContractError):
                contract.byte_size(literal)


class BackendBudgetTests(unittest.TestCase):
    def test_positional_ast_without_importing_app(self):
        self.assertEqual(contract.backend_game_budget(BUDGET), 526_385_152)

    def test_annotated_and_keyword_budget(self):
        source = '_MIB: int = 1024 * 1024\nGAME_UPLOAD_BUDGET: RequestBudget = RequestBudget(name="game", max_body_bytes=502 * _MIB)'
        self.assertEqual(contract.backend_game_budget(source), 526_385_152)

    def test_referenced_integer_and_addition(self):
        source = '_MIB = 1024 * 1024\nFILE = 500 * _MIB\nGAME_UPLOAD_BUDGET = RequestBudget("game", FILE + 2 * _MIB)'
        self.assertEqual(contract.backend_game_budget(source), 526_385_152)

    def test_missing_commented_or_duplicate_budget_fails(self):
        for source in ("", "# " + BUDGET.replace("\n", "\n# "), BUDGET + '\nGAME_UPLOAD_BUDGET = RequestBudget("game", 1)'):
            with self.subTest(source=source), self.assertRaises(contract.ContractError):
                contract.backend_game_budget(source)

    def test_negative_or_noninteger_budget_fails(self):
        for expression in ("-502 * _MIB", "-1", "0", "True", '"526385152"', "502.0 * _MIB"):
            with self.subTest(expression=expression), self.assertRaises(contract.ContractError):
                contract.backend_game_budget(BUDGET.replace("502 * _MIB", expression))

    def test_executable_or_unknown_ast_fails(self):
        for expression in ('int("526385152")', '__import__("os").getpid()', "settings.LIMIT", "UNKNOWN", "502 << 20", "502 ** 20"):
            with self.subTest(expression=expression), self.assertRaises(contract.ContractError):
                contract.backend_game_budget(BUDGET.replace("502 * _MIB", expression))

    def test_cyclic_constant_fails(self):
        with self.assertRaisesRegex(contract.ContractError, "cyclic"):
            contract.backend_game_budget(BUDGET.replace("_MIB = 1024 * 1024", "_MIB = _MIB"))

    def test_unrecognized_request_budget_shape_fails(self):
        for call in ('other.RequestBudget("game", 526385152)', 'RequestBudget("game")', 'RequestBudget(*args)', 'RequestBudget("game", 526385152, max_body_bytes=526385152)'):
            source = BUDGET.replace('RequestBudget("game-upload", 502 * _MIB, 60.0)', call)
            with self.subTest(call=call), self.assertRaises(contract.ContractError):
                contract.backend_game_budget(source)

    def test_invalid_python_fails(self):
        with self.assertRaises(contract.ContractError):
            contract.backend_game_budget("GAME_UPLOAD_BUDGET = (")


class CaddyContractTests(unittest.TestCase):
    def assert_invalid(self, config, budget=BUDGET):
        with self.assertRaises(contract.ContractError):
            contract.validate_contract(config, budget)

    def test_valid_fixture(self):
        self.assertEqual(contract.validate_contract(CONFIG, BUDGET), (526_385_152, 526_385_152))

    def test_game_byte_boundaries_and_units(self):
        for literal in ("526385152B", "502MiB", "527MB"):
            with self.subTest(literal=literal):
                contract.validate_contract(CONFIG.replace("526385152", literal), BUDGET)
        for literal in ("500MB", "526MB", "500MiB", "501MiB", "526385151"):
            with self.subTest(literal=literal):
                self.assert_invalid(CONFIG.replace("526385152", literal))

    def test_fallback_order_does_not_select_its_size(self):
        reordered = CONFIG.replace(GAME_BLOCK + FALLBACK_BLOCK, FALLBACK_BLOCK + GAME_BLOCK)
        self.assertEqual(contract.validate_contract(reordered, BUDGET)[0], 526_385_152)
        self.assert_invalid(reordered.replace("526385152", "500MB").replace("16MB", "600MB"))

    def test_missing_fallback_fails(self):
        self.assert_invalid(CONFIG.replace(FALLBACK_BLOCK, ""))

    def test_changed_fallback_fails(self):
        for literal in ("16MiB", "500MB", "15MB"):
            with self.subTest(literal=literal):
                self.assert_invalid(CONFIG.replace("max_size 16MB", f"max_size {literal}"))

    def test_missing_game_body_fails(self):
        self.assert_invalid(CONFIG.replace(GAME_BLOCK, ""))

    def test_wrong_matcher_definition_fails(self):
        for original, replacement in (
            ("@game_upload path", "@game_upload not path"),
            ("@game_upload path /api/v1/admin/it/games", "@game_upload path /api/v1/admin/it/games/*"),
            ("@body_guarded not path", "@body_guarded path"),
            ("@body_guarded not path /api/v1/admin/it/games", "@body_guarded not path /api/v1/admin/it/game"),
            ("@game_upload path /api/v1/admin/it/games", "@game_upload path /api/v1/admin/it/games /other"),
        ):
            with self.subTest(replacement=replacement):
                self.assert_invalid(CONFIG.replace(original, replacement))

    def test_wrong_body_matcher_fails(self):
        for replacement in ("request_body @typo", "request_body @body_guarded", "request_body"):
            with self.subTest(replacement=replacement):
                self.assert_invalid(CONFIG.replace("request_body @game_upload", replacement))

    def test_negative_game_literal_fails(self):
        for literal in ("-526385152", "-502MiB"):
            with self.subTest(literal=literal):
                self.assert_invalid(CONFIG.replace("526385152", literal))

    def test_comments_cannot_satisfy_directives(self):
        for directive in ("@game_upload path", "@body_guarded not path", "max_size 526385152", "max_size 16MB", "read_body 30s"):
            with self.subTest(directive=directive):
                self.assert_invalid(CONFIG.replace(directive, "# " + directive))

    def test_comment_size_decoy_cannot_cover_low_game_limit(self):
        decoy = "# max_size 502MiB\n# request_body @game_upload { max_size 526385152 }\n"
        self.assert_invalid(decoy + CONFIG.replace("526385152", "500MB"))

    def test_unrelated_block_cannot_supply_game_maximum(self):
        candidate = CONFIG.replace("        max_size 526385152\n", "")
        candidate = candidate.replace(":80 {", ":80 {\n    handle {\n        max_size 526385152\n    }")
        self.assert_invalid(candidate)

    def test_extra_global_or_nested_guard_fails(self):
        for extra in ("    request_body {\n        max_size 16MB\n    }\n", "    handle {\n" + GAME_BLOCK + "    }\n"):
            with self.subTest(extra=extra):
                self.assert_invalid(CONFIG.replace(":80 {\n", ":80 {\n" + extra))

    def test_duplicate_maximum_or_matcher_fails(self):
        self.assert_invalid(CONFIG.replace("max_size 526385152", "max_size 526385152\n        max_size 600MB"))
        self.assert_invalid(CONFIG.replace("@game_upload path", "@game_upload path /api/v1/admin/it/games\n    @game_upload path"))

    def test_body_read_timeout_is_preserved(self):
        for replacement in ("read_body 60s", "read_body 0", "read_body 30s\n            read_body 60s"):
            with self.subTest(replacement=replacement):
                self.assert_invalid(CONFIG.replace("read_body 30s", replacement))

    def test_changed_backend_budget_fails_without_skip(self):
        with self.assertRaisesRegex(contract.ContractError, "527433728B"):
            contract.validate_contract(CONFIG, BUDGET.replace("502 * _MIB", "503 * _MIB"))
        self.assert_invalid(CONFIG, BUDGET.replace("GAME_UPLOAD_BUDGET", "OLD_UPLOAD_BUDGET"))
        self.assert_invalid(CONFIG, BUDGET.replace("502 * _MIB", "settings.GAME_BYTES"))

    def test_quoted_hash_braces_and_inline_comments(self):
        candidate = CONFIG.replace("read_body 30s", "read_body 30s # budget } {")
        candidate = candidate.replace(":80 {", ':80 {\n    header X-Test "quoted # and {braces}"')
        contract.validate_contract(candidate, BUDGET)

    def test_unbalanced_or_inline_block_fails(self):
        for candidate in (CONFIG + "}\n", CONFIG.rstrip()[:-1], CONFIG.replace(GAME_BLOCK, "    request_body @game_upload { max_size 526385152 }\n")):
            with self.subTest(candidate=candidate):
                self.assert_invalid(candidate)


class RepositoryBudgetTests(unittest.TestCase):
    def test_game_request_body_covers_multipart_budget(self):
        source = (ROOT / "gateway/Caddyfile").read_text(encoding="utf-8")
        match = re.search(
            r"(?m)^\s*request_body @game_upload \{\s*\n"
            r"[ \t]*max_size ([0-9]+)(MB|MiB|B)?[ \t]*\n[ \t]*\}",
            source,
        )
        self.assertIsNotNone(match, "missing active game-upload request_body")
        limit = int(match[1]) * {None: 1, "B": 1, "MB": 1_000_000, "MiB": 1_048_576}[match[2]]
        self.assertGreaterEqual(limit, 502 * 1024 * 1024)

    def test_real_config_against_real_backend_ast(self):
        config = (ROOT / "gateway/Caddyfile").read_text(encoding="utf-8")
        budget = (ROOT / "backend/app/core/request_budget.py").read_text(encoding="utf-8")
        actual, required = contract.validate_contract(config, budget)
        self.assertGreaterEqual(actual, required)

    def test_shell_calls_static_helper_before_docker(self):
        shell = (ROOT / "gateway/tests/test_caddy_config.sh").read_text(encoding="utf-8")
        prefix = shell[:shell.index("\ndocker run")]
        self.assertRegex(prefix, r'(?m)^python3 -I -B "\$\{ROOT_DIR\}/gateway/tests/validate_caddy_contract\.py"')
        self.assertIn('"${ROOT_DIR}/backend/app/core/request_budget.py"', prefix)
        self.assertNotIn("awk '", prefix)
        self.assertNotIn("IT_GAME_MAX_UPLOAD_BYTES", prefix)


class CommandLineTests(unittest.TestCase):
    def run_helper(self, config=CONFIG, budget=BUDGET):
        with tempfile.TemporaryDirectory(prefix="wangsh-caddy-contract-") as directory:
            root = Path(directory)
            (root / "Caddyfile").write_text(config, encoding="utf-8")
            if budget is not None:
                (root / "budget.py").write_text(budget, encoding="utf-8")
            return subprocess.run(
                [sys.executable, "-I", "-B", str(HELPER), str(root / "Caddyfile"), str(root / "budget.py")],
                check=False, capture_output=True, text=True,
            )

    def test_valid_cli(self):
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("game 526385152B >= 526385152B", result.stdout)

    def test_low_limit_cli_is_nonzero(self):
        result = self.run_helper(CONFIG.replace("526385152", "500MB"))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("500000000B", result.stderr)
        self.assertIn("526385152B", result.stderr)

    def test_backend_increase_cli_is_nonzero(self):
        result = self.run_helper(budget=BUDGET.replace("502 * _MIB", "503 * _MIB"))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("527433728B", result.stderr)

    def test_missing_backend_cli_is_nonzero(self):
        result = self.run_helper(budget=None)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("FAIL", result.stderr)
        self.assertNotIn("PASS", result.stdout)


if __name__ == "__main__":
    unittest.main()
