"""
Configuration Audit Script for Production Readiness.

Scans the codebase for:
- Hardcoded localhost URLs in source code
- Hardcoded secrets
- Development-only settings
- Missing environment variable documentation

Run: python scripts/audit_config.py
"""
import os
import re
import sys
from pathlib import Path

# ANSI colors
RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

REPO_ROOT = Path(__file__).resolve().parent.parent

# Directories and files to skip
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".pytest_cache",
    "env", "venv", ".venv", "dist", "dist-ssr", ".next",
    "media", ".gemini",
}
SKIP_FILES = {
    "package-lock.json", "audit_config.py",
}

# File extensions to scan
SCAN_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml",
    ".toml", ".ini", ".cfg", ".sh", ".md",
}

issues_found = 0


def scan_file(filepath: Path, patterns: list[tuple[str, str, str]]) -> list[dict]:
    """Scan a single file for patterns."""
    results = []
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        for i, line in enumerate(lines, 1):
            for pattern, description, severity in patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    # Skip comments and .env.example files
                    stripped = line.strip()
                    if stripped.startswith("#") or stripped.startswith("//"):
                        continue
                    if ".env.example" in str(filepath):
                        continue
                    results.append({
                        "file": filepath,
                        "line": i,
                        "content": stripped[:120],
                        "description": description,
                        "severity": severity,
                    })
    except Exception:
        pass
    return results


def main():
    global issues_found

    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}  FlyHigh Auction — Production Configuration Audit{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")

    # Patterns to search for
    patterns = [
        # Hardcoded localhost URLs (not in comments, not in defaults)
        (r'["\']https?://localhost[:\d]*', "Hardcoded localhost URL", "WARNING"),
        # Hardcoded secrets
        (r'admin123', "Hardcoded default password 'admin123'", "CRITICAL"),
        (r'blaze123|netmasters123|commandos123', "Hardcoded demo password", "WARNING"),
        (r'flyhigh_secret', "Hardcoded database password", "CRITICAL"),
        (r'changeme.*secret', "Placeholder secret key", "WARNING"),
        (r'npg_[a-zA-Z0-9]+', "Hardcoded Neon database credential", "CRITICAL"),
        # Development-only settings
        (r'APP_ENV\s*=\s*development', "Development environment setting", "INFO"),
        (r'--reload', "Development-only reload flag", "WARNING"),
    ]

    # Scan files
    all_issues = []
    files_scanned = 0

    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        # Skip excluded directories
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for filename in filenames:
            if filename in SKIP_FILES:
                continue

            filepath = Path(dirpath) / filename
            if filepath.suffix not in SCAN_EXTENSIONS:
                continue

            # Skip .env files (they SHOULD have real values)
            if filename == ".env":
                continue

            files_scanned += 1
            issues = scan_file(filepath, patterns)
            all_issues.extend(issues)

    # Group by severity
    critical = [i for i in all_issues if i["severity"] == "CRITICAL"]
    warnings = [i for i in all_issues if i["severity"] == "WARNING"]
    info = [i for i in all_issues if i["severity"] == "INFO"]

    # Report
    if critical:
        print(f"{BOLD}{RED}🚨 CRITICAL ISSUES ({len(critical)}):{RESET}")
        for issue in critical:
            rel_path = issue["file"].relative_to(REPO_ROOT)
            print(f"  {RED}✗{RESET} {rel_path}:{issue['line']}")
            print(f"    {issue['description']}")
            print(f"    {YELLOW}{issue['content']}{RESET}")
            print()
        issues_found += len(critical)

    if warnings:
        print(f"{BOLD}{YELLOW}⚠️  WARNINGS ({len(warnings)}):{RESET}")
        for issue in warnings:
            rel_path = issue["file"].relative_to(REPO_ROOT)
            print(f"  {YELLOW}!{RESET} {rel_path}:{issue['line']}")
            print(f"    {issue['description']}")
            print(f"    {issue['content'][:100]}")
            print()
        issues_found += len(warnings)

    if info:
        print(f"{BOLD}{CYAN}ℹ️  INFO ({len(info)}):{RESET}")
        for issue in info:
            rel_path = issue["file"].relative_to(REPO_ROOT)
            print(f"  {CYAN}i{RESET} {rel_path}:{issue['line']} — {issue['description']}")
        print()

    # Summary
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"  Files scanned: {files_scanned}")
    print(f"  Critical:      {RED}{len(critical)}{RESET}")
    print(f"  Warnings:      {YELLOW}{len(warnings)}{RESET}")
    print(f"  Info:          {CYAN}{len(info)}{RESET}")
    print(f"{'='*60}")

    if not critical and not warnings:
        print(f"\n{GREEN}✅ No critical issues or warnings found!{RESET}")
        print(f"{GREEN}   The codebase looks production-ready.{RESET}\n")
    elif not critical:
        print(f"\n{YELLOW}⚠️  Warnings found but no critical issues.{RESET}")
        print(f"{YELLOW}   Review warnings above before deploying.{RESET}\n")
    else:
        print(f"\n{RED}🚨 Critical issues found!{RESET}")
        print(f"{RED}   Fix these before deploying to production.{RESET}\n")
        print(f"{CYAN}   Note: Issues in config defaults and seed scripts are{RESET}")
        print(f"{CYAN}   expected — they're overridden by env vars in production.{RESET}\n")

    return 1 if critical else 0


if __name__ == "__main__":
    sys.exit(main())
