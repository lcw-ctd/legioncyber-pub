"""
Nuclei scanner service — wraps the nuclei binary to run security scans.

Supports: OWASP Top 10, CVEs, APIs, frameworks, authenticated scans.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncGenerator, Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ScanConfig:
    scan_id: str
    targets: list[str]
    template_tags: list[str]
    severity_filter: list[str]
    rate_limit: int
    timeout: int
    credentials: list[dict]
    exclude_tags: list[str]
    custom_headers: dict
    scan_mode: str  # blackbox / graybox / whitebox
    max_host_error: int = 30
    retries: int = 1
    output_dir: Optional[str] = None
    extra_args: list[str] = field(default_factory=list)


@dataclass
class NucleiResult:
    template_id: str
    template_name: str
    severity: str
    matched_at: str
    request: Optional[str]
    response: Optional[str]
    curl_command: Optional[str]
    extracted_results: list[str]
    tags: list[str]
    metadata: dict
    timestamp: str


@dataclass
class ScanEvent:
    event_type: str  # "progress" | "finding" | "error" | "done"
    scan_id: str
    data: dict
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------------------------------------------------------------------------
# OWASP Top 10 2021 mapping
# ---------------------------------------------------------------------------

_OWASP_TAG_MAP: dict[str, str] = {
    # A01 — Broken Access Control
    "idor": "A01:2021",
    "broken-access-control": "A01:2021",
    "path-traversal": "A01:2021",
    "lfi": "A01:2021",
    "access-control": "A01:2021",
    "traversal": "A01:2021",
    # A02 — Cryptographic Failures
    "crypto": "A02:2021",
    "tls": "A02:2021",
    "hsts": "A02:2021",
    "ssl": "A02:2021",
    "cleartext": "A02:2021",
    # A03 — Injection
    "injection": "A03:2021",
    "sqli": "A03:2021",
    "xss": "A03:2021",
    "ssti": "A03:2021",
    "rce": "A03:2021",
    "command-injection": "A03:2021",
    "xxe": "A03:2021",
    # A04 — Insecure Design
    "insecure-design": "A04:2021",
    "rate-limit": "A04:2021",
    "business-logic": "A04:2021",
    # A05 — Security Misconfiguration
    "misconfig": "A05:2021",
    "default-login": "A05:2021",
    "exposure": "A05:2021",
    "panel": "A05:2021",
    "directory-listing": "A05:2021",
    "headers": "A05:2021",
    "cors": "A05:2021",
    # A06 — Vulnerable and Outdated Components
    "cve": "A06:2021",
    "outdated": "A06:2021",
    "tech": "A06:2021",
    "version": "A06:2021",
    # A07 — Identification and Authentication Failures
    "auth": "A07:2021",
    "jwt": "A07:2021",
    "session": "A07:2021",
    "weak-password": "A07:2021",
    "default-password": "A07:2021",
    # A08 — Software and Data Integrity Failures
    "deserialization": "A08:2021",
    "integrity": "A08:2021",
    "ci-exposure": "A08:2021",
    # A09 — Security Logging and Monitoring Failures
    "log-injection": "A09:2021",
    "log-exposure": "A09:2021",
    "monitoring": "A09:2021",
    # A10 — SSRF
    "ssrf": "A10:2021",
}

_OWASP_TEMPLATE_PREFIX_MAP: dict[str, str] = {
    "a01": "A01:2021",
    "a02": "A02:2021",
    "a03": "A03:2021",
    "a04": "A04:2021",
    "a05": "A05:2021",
    "a06": "A06:2021",
    "a07": "A07:2021",
    "a08": "A08:2021",
    "a09": "A09:2021",
    "a10": "A10:2021",
}

# Severity → base CVSS 3.1 score bands
_SEVERITY_CVSS_BASE: dict[str, tuple[float, float]] = {
    "critical": (9.0, 10.0),
    "high": (7.0, 8.9),
    "medium": (4.0, 6.9),
    "low": (0.1, 3.9),
    "info": (0.0, 0.0),
    "unknown": (0.0, 0.0),
}

# Business impact templates keyed by OWASP category
_OWASP_IMPACT: dict[str, str] = {
    "A01:2021": (
        "Attackers may access, modify, or delete data belonging to other users or privileged "
        "functions, leading to unauthorized data disclosure, account takeover, or privilege "
        "escalation. Impact scales with the sensitivity of data exposed."
    ),
    "A02:2021": (
        "Weak or absent cryptographic controls may allow network adversaries to intercept "
        "sensitive data (credentials, PII, financial information) in transit or recover "
        "plaintext from stored ciphertext, resulting in data breach and regulatory liability."
    ),
    "A03:2021": (
        "Injection flaws can allow attackers to execute arbitrary commands, read or modify "
        "the database, traverse the file system, or pivot to internal systems — potentially "
        "resulting in full system compromise and data exfiltration."
    ),
    "A04:2021": (
        "Insecure design flaws are architectural and cannot be patched alone; they may permit "
        "business-logic abuse such as bypassing payment, manipulating quantities, or exploiting "
        "workflow assumptions, leading to financial loss and reputational damage."
    ),
    "A05:2021": (
        "Security misconfigurations expose unintended attack surfaces — admin panels, default "
        "credentials, verbose errors — enabling attackers to gain footholds, escalate privileges, "
        "or enumerate internal infrastructure."
    ),
    "A06:2021": (
        "Use of components with known vulnerabilities gives attackers a catalogue of existing "
        "exploits to apply directly, significantly lowering the bar for compromise and reducing "
        "the window between vulnerability disclosure and active exploitation."
    ),
    "A07:2021": (
        "Authentication and session management failures allow attackers to assume another "
        "user's identity, bypass authentication entirely, or hijack active sessions, leading "
        "to account takeover and unauthorised data access."
    ),
    "A08:2021": (
        "Integrity failures around software updates, CI/CD pipelines, or serialized objects "
        "may allow supply-chain attacks or remote code execution through malicious payloads "
        "that bypass integrity verification."
    ),
    "A09:2021": (
        "Insufficient logging and monitoring delays detection and response to active attacks, "
        "extends breach dwell time, impairs forensic investigation, and may result in "
        "regulatory non-compliance for industries requiring audit trails."
    ),
    "A10:2021": (
        "Server-Side Request Forgery allows attackers to induce the server to make requests "
        "to internal services, cloud metadata APIs, or arbitrary hosts — enabling cloud "
        "credential theft, internal network pivoting, and remote code execution."
    ),
}


# ---------------------------------------------------------------------------
# Main scanner class
# ---------------------------------------------------------------------------


class NucleiScanner:
    """
    Wraps the nuclei binary to run security scans.
    Supports: OWASP Top 10, CVEs, APIs, frameworks, authenticated scans.
    """

    def __init__(self) -> None:
        self.binary: str = settings.NUCLEI_BINARY_PATH
        self.templates_path: str = settings.NUCLEI_TEMPLATES_PATH
        self.custom_templates_path: str = settings.NUCLEI_CUSTOM_TEMPLATES_PATH
        self.output_base_dir: str = settings.NUCLEI_OUTPUT_DIR

    # ------------------------------------------------------------------
    # Command building
    # ------------------------------------------------------------------

    def build_command(self, scan: ScanConfig) -> list[str]:
        """Build the nuclei CLI command from a ScanConfig."""
        output_dir = scan.output_dir or self.output_base_dir
        os.makedirs(output_dir, exist_ok=True)
        json_output = os.path.join(output_dir, f"{scan.scan_id}.json")

        cmd: list[str] = [self.binary]

        # Targets
        if len(scan.targets) == 1:
            cmd += ["-target", scan.targets[0]]
        else:
            # Write targets to a temporary file; caller is responsible for cleanup
            target_file = os.path.join(output_dir, f"{scan.scan_id}-targets.txt")
            with open(target_file, "w") as fh:
                fh.write("\n".join(scan.targets))
            cmd += ["-list", target_file]

        # Template selection
        if scan.template_tags:
            cmd += ["-tags", ",".join(scan.template_tags)]

        # Custom templates directory (always include)
        cmd += ["-templates", self.custom_templates_path]

        # Severity filter
        if scan.severity_filter:
            cmd += ["-severity", ",".join(scan.severity_filter)]

        # Exclude tags (avoid DoS/destructive templates in blackbox mode)
        exclude = list(scan.exclude_tags)
        if scan.scan_mode == "blackbox" and "dos" not in exclude:
            exclude.append("dos")
        if exclude:
            cmd += ["-exclude-tags", ",".join(exclude)]

        # Rate limiting and reliability
        cmd += ["-rate-limit", str(scan.rate_limit)]
        cmd += ["-timeout", str(scan.timeout)]
        cmd += ["-retries", str(scan.retries)]
        cmd += ["-max-host-error", str(scan.max_host_error)]

        # Output — JSON export for structured parsing
        cmd += ["-o", json_output]
        cmd += ["-json-export", json_output]

        # Suppress colour codes; always use JSON lines on stdout as well
        cmd += ["-jsonl"]
        cmd += ["-silent"]

        # Custom headers (from scan config)
        for header_name, header_value in scan.custom_headers.items():
            cmd += ["-H", f"{header_name}: {header_value}"]

        # Auth headers built from credentials
        for credential in scan.credentials:
            cmd += self.build_authenticated_args(credential)

        # Extra user-supplied args (whitebox / graybox may pass cookies, vars, etc.)
        cmd += scan.extra_args

        return cmd

    # ------------------------------------------------------------------
    # Auth argument construction
    # ------------------------------------------------------------------

    def build_authenticated_args(self, credential: dict) -> list[str]:
        """
        Build nuclei auth-related CLI args from a credential dict.

        Expected keys: auth_type, and type-specific fields documented below.
        """
        auth_type: str = credential.get("auth_type", "")
        args: list[str] = []

        if auth_type == "basic_auth":
            username = credential.get("username", "")
            password = credential.get("password", "")
            raw = f"{username}:{password}"
            b64 = base64.b64encode(raw.encode()).decode()
            args += ["-H", f"Authorization: Basic {b64}"]

        elif auth_type == "bearer_token":
            token = credential.get("token", "")
            args += ["-H", f"Authorization: Bearer {token}"]

        elif auth_type == "cookie":
            # cookie_string should be fully-formed, e.g. "session=abc; csrf=xyz"
            cookie_string = credential.get("cookie_string", "")
            args += ["-H", f"Cookie: {cookie_string}"]

        elif auth_type == "api_key":
            header_name = credential.get("header_name", "X-API-Key")
            api_key = credential.get("api_key", "")
            # Some APIs use query-param auth; we handle header variant here
            args += ["-H", f"{header_name}: {api_key}"]

        elif auth_type == "form_login":
            # form_login requires a nuclei workflow; we pass it as a var so
            # the workflow template can consume it.
            username = credential.get("username", "")
            password = credential.get("password", "")
            login_url = credential.get("login_url", "")
            args += [
                "-var", f"form_username={username}",
                "-var", f"form_password={password}",
                "-var", f"form_login_url={login_url}",
            ]

        elif auth_type == "oauth2":
            # Exchange credentials for a bearer token before scanning.
            # Token exchange is performed synchronously here; scanning is async.
            token = self._exchange_oauth2_token(credential)
            if token:
                args += ["-H", f"Authorization: Bearer {token}"]
            else:
                logger.warning("OAuth2 token exchange failed; scanning without auth.")

        else:
            logger.warning("Unknown auth_type '%s'; skipping credential.", auth_type)

        return args

    def _exchange_oauth2_token(self, credential: dict) -> Optional[str]:
        """
        Perform a synchronous OAuth2 client-credentials token exchange.
        Returns the access token string or None on failure.
        """
        import urllib.request
        import urllib.parse

        token_url = credential.get("token_url", "")
        client_id = credential.get("client_id", "")
        client_secret = credential.get("client_secret", "")
        scope = credential.get("scope", "")

        if not (token_url and client_id and client_secret):
            logger.error("OAuth2 credential missing token_url, client_id, or client_secret.")
            return None

        payload = urllib.parse.urlencode({
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": scope,
        }).encode()

        try:
            req = urllib.request.Request(
                token_url,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = json.loads(resp.read())
                return body.get("access_token")
        except Exception as exc:
            logger.error("OAuth2 token exchange error: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Output parsing
    # ------------------------------------------------------------------

    def parse_nuclei_output(self, line: str) -> Optional[NucleiResult]:
        """
        Parse a single JSON line from nuclei -jsonl output.

        Returns a NucleiResult or None if the line is not a valid finding.
        """
        line = line.strip()
        if not line:
            return None

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            # Non-JSON status lines (progress bars, etc.) are ignored
            return None

        # nuclei JSON output shape varies between v2 and v3; handle both
        template_id: str = data.get("template-id", data.get("templateID", "unknown"))
        info: dict = data.get("info", data.get("template", {}).get("info", {}))
        template_name: str = info.get("name", template_id)
        severity: str = info.get("severity", "unknown").lower()
        matched_at: str = data.get("matched-at", data.get("host", ""))
        tags_raw = info.get("tags", [])
        tags: list[str] = tags_raw if isinstance(tags_raw, list) else [t.strip() for t in tags_raw.split(",")]
        metadata: dict = {
            "template_path": data.get("template-path", ""),
            "type": data.get("type", ""),
            "ip": data.get("ip", ""),
            "owasp_id": self.map_to_owasp(tags, template_id),
            "cvss_score": self.calculate_cvss(severity, data),
            "classification": info.get("classification", {}),
            "reference": info.get("reference", []),
        }

        # Request / response (may be under different keys in v2 vs v3)
        raw_req: Optional[str] = None
        raw_resp: Optional[str] = None
        curl: Optional[str] = None

        interaction = data.get("interaction", {})
        if interaction:
            raw_req = interaction.get("request")
            raw_resp = interaction.get("response")

        request_block = data.get("request")
        if request_block:
            raw_req = request_block

        response_block = data.get("response")
        if response_block:
            raw_resp = response_block

        curl = data.get("curl-command", data.get("curl_command"))

        extracted: list[str] = data.get("extracted-results", []) or []

        timestamp: str = data.get(
            "timestamp",
            datetime.now(timezone.utc).isoformat(),
        )

        return NucleiResult(
            template_id=template_id,
            template_name=template_name,
            severity=severity,
            matched_at=matched_at,
            request=raw_req,
            response=raw_resp,
            curl_command=curl,
            extracted_results=extracted,
            tags=tags,
            metadata=metadata,
            timestamp=timestamp,
        )

    # ------------------------------------------------------------------
    # Async scan execution
    # ------------------------------------------------------------------

    async def run_scan(
        self,
        scan_config: ScanConfig,
    ) -> AsyncGenerator[ScanEvent, None]:
        """
        Run nuclei as a subprocess and yield ScanEvent objects.

        Event types:
            "progress"  — periodic heartbeat with elapsed time
            "finding"   — a parsed NucleiResult (as dict)
            "error"     — stderr line or exception message
            "done"      — scan completed with summary
        """
        cmd = self.build_command(scan_config)
        logger.info("Starting nuclei scan %s: %s", scan_config.scan_id, " ".join(cmd))

        start_time = time.monotonic()
        finding_count = 0
        error_count = 0
        process: Optional[asyncio.subprocess.Process] = None

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            assert process.stdout is not None
            assert process.stderr is not None

            # Read stdout (JSON findings) and stderr concurrently
            async def drain_stderr() -> None:
                nonlocal error_count
                assert process is not None and process.stderr is not None
                async for raw_line in process.stderr:
                    line = raw_line.decode(errors="replace").strip()
                    if line:
                        logger.debug("[nuclei stderr] %s", line)
                        error_count += 1

            stderr_task = asyncio.create_task(drain_stderr())

            # Yield progress events every 5 seconds while reading stdout
            last_progress = time.monotonic()

            async for raw_line in process.stdout:
                now = time.monotonic()
                if now - last_progress >= 5.0:
                    last_progress = now
                    yield ScanEvent(
                        event_type="progress",
                        scan_id=scan_config.scan_id,
                        data={
                            "elapsed_seconds": round(now - start_time, 1),
                            "findings_so_far": finding_count,
                        },
                    )

                line = raw_line.decode(errors="replace")
                result = self.parse_nuclei_output(line)
                if result is None:
                    continue

                finding_count += 1
                result.metadata["business_impact"] = self.get_business_impact(
                    result, {"targets": scan_config.targets}
                )

                yield ScanEvent(
                    event_type="finding",
                    scan_id=scan_config.scan_id,
                    data={
                        "template_id": result.template_id,
                        "template_name": result.template_name,
                        "severity": result.severity,
                        "matched_at": result.matched_at,
                        "request": result.request,
                        "response": result.response,
                        "curl_command": result.curl_command,
                        "extracted_results": result.extracted_results,
                        "tags": result.tags,
                        "metadata": result.metadata,
                        "timestamp": result.timestamp,
                    },
                )

            await stderr_task
            await process.wait()
            elapsed = round(time.monotonic() - start_time, 1)

            yield ScanEvent(
                event_type="done",
                scan_id=scan_config.scan_id,
                data={
                    "return_code": process.returncode,
                    "elapsed_seconds": elapsed,
                    "total_findings": finding_count,
                    "error_lines": error_count,
                },
            )

        except asyncio.CancelledError:
            if process and process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    process.kill()
            yield ScanEvent(
                event_type="error",
                scan_id=scan_config.scan_id,
                data={"message": "Scan cancelled.", "findings_before_cancel": finding_count},
            )
            raise

        except asyncio.TimeoutError:
            if process and process.returncode is None:
                process.kill()
            yield ScanEvent(
                event_type="error",
                scan_id=scan_config.scan_id,
                data={"message": "Scan timed out.", "findings_before_timeout": finding_count},
            )

        except Exception as exc:
            logger.exception("Unexpected error during scan %s", scan_config.scan_id)
            if process and process.returncode is None:
                process.kill()
            yield ScanEvent(
                event_type="error",
                scan_id=scan_config.scan_id,
                data={"message": str(exc), "findings_before_error": finding_count},
            )

    # ------------------------------------------------------------------
    # OWASP mapping
    # ------------------------------------------------------------------

    def map_to_owasp(self, template_tags: list[str], template_id: str) -> Optional[str]:
        """
        Map nuclei template tags / ID to the OWASP Top 10 2021 category.

        Returns a string like "A03:2021" or None if no mapping is found.
        """
        # 1. Check template ID prefix (e.g. "a01-broken-access-control")
        tid_lower = template_id.lower()
        for prefix, category in _OWASP_TEMPLATE_PREFIX_MAP.items():
            if tid_lower.startswith(prefix):
                return category

        # 2. Check tags
        for tag in template_tags:
            tag_lower = tag.lower().strip()
            if tag_lower in _OWASP_TAG_MAP:
                return _OWASP_TAG_MAP[tag_lower]

        return None

    # ------------------------------------------------------------------
    # CVSS estimation
    # ------------------------------------------------------------------

    def calculate_cvss(self, nuclei_severity: str, finding_data: dict) -> float:
        """
        Estimate a CVSS 3.1 base score from nuclei severity + contextual data.

        Uses the classification block when present; falls back to a midpoint of
        the severity band otherwise.
        """
        # Prefer an explicit score from the template's classification block
        info = finding_data.get("info", {})
        classification = info.get("classification", {})
        explicit_score = classification.get("cvss-score")
        if explicit_score is not None:
            try:
                return float(explicit_score)
            except (TypeError, ValueError):
                pass

        # Fall back to midpoint of severity band
        severity = nuclei_severity.lower()
        low, high = _SEVERITY_CVSS_BASE.get(severity, (0.0, 0.0))
        if low == high:
            return low
        # Use midpoint as a reasonable default
        return round((low + high) / 2, 1)

    # ------------------------------------------------------------------
    # Business impact
    # ------------------------------------------------------------------

    def get_business_impact(self, finding: NucleiResult, target_info: dict) -> str:
        """
        Generate a business impact statement based on the finding's OWASP
        category, severity, and target context.
        """
        owasp_id: Optional[str] = finding.metadata.get("owasp_id") or self.map_to_owasp(
            finding.tags, finding.template_id
        )

        # Generic impact by severity when OWASP category is unknown
        if not owasp_id:
            severity = finding.severity.lower()
            if severity == "critical":
                return (
                    "This critical finding may allow an attacker to fully compromise the "
                    "affected system, leading to data breach, service disruption, and "
                    "significant reputational and regulatory impact."
                )
            if severity == "high":
                return (
                    "This high-severity finding could be exploited by an attacker to "
                    "access sensitive data or functionality without authorisation, posing "
                    "a significant risk to data integrity and confidentiality."
                )
            if severity == "medium":
                return (
                    "This medium-severity issue increases the attack surface and, when "
                    "combined with other weaknesses, may contribute to a more serious "
                    "compromise. Remediation is recommended within standard patching cycles."
                )
            return (
                "This informational or low-severity finding provides an attacker with "
                "reconnaissance data that could aid in planning more targeted attacks."
            )

        base_impact = _OWASP_IMPACT.get(owasp_id, "")

        # Enrich with target context when available
        targets = target_info.get("targets", [])
        target_str = targets[0] if targets else "the target"

        # Prepend a finding-specific prefix
        prefix = (
            f"Affecting {target_str} ({finding.matched_at}), this {finding.severity}-severity "
            f"{owasp_id} finding has been detected via template '{finding.template_id}'. "
        )

        return prefix + base_impact


# ---------------------------------------------------------------------------
# Convenience factory
# ---------------------------------------------------------------------------


def create_scan_config(
    targets: list[str],
    scan_plan: str = "owasp_top10",
    credentials: Optional[list[dict]] = None,
    custom_headers: Optional[dict] = None,
    scan_mode: str = "blackbox",
    rate_limit: Optional[int] = None,
    timeout: Optional[int] = None,
    severity_filter: Optional[list[str]] = None,
    exclude_tags: Optional[list[str]] = None,
    extra_args: Optional[list[str]] = None,
) -> ScanConfig:
    """
    Create a ScanConfig from high-level parameters, resolving template tag
    groups from tag-groups definitions.
    """
    _TAG_GROUPS: dict[str, list[str]] = {
        "owasp_top10": ["owasp", "injection", "xss", "sqli", "ssrf", "idor", "auth", "crypto", "misconfig"],
        "full_scan": ["owasp", "cve", "exposure", "misconfig", "default-login", "panel", "takeover", "tech", "vuln"],
        "api_scan": ["api", "graphql", "rest", "swagger", "oauth", "jwt", "cors"],
        "compliance_pci": ["owasp", "injection", "misconfig", "crypto", "auth", "exposure"],
        "light_scan": ["misconfig", "exposure", "headers", "tech"],
        "custom": [],
    }

    _DEFAULT_SEVERITY: dict[str, list[str]] = {
        "owasp_top10": ["critical", "high", "medium"],
        "full_scan": ["critical", "high", "medium", "low"],
        "api_scan": ["critical", "high", "medium"],
        "compliance_pci": ["critical", "high", "medium"],
        "light_scan": ["medium", "low", "info"],
        "custom": ["critical", "high", "medium", "low"],
    }

    _SAFE_EXCLUDE_TAGS = ["dos", "fuzz"]

    tags = _TAG_GROUPS.get(scan_plan, [])
    sev = severity_filter or _DEFAULT_SEVERITY.get(scan_plan, ["critical", "high", "medium"])
    excl = exclude_tags if exclude_tags is not None else list(_SAFE_EXCLUDE_TAGS)

    return ScanConfig(
        scan_id=str(uuid.uuid4()),
        targets=targets,
        template_tags=tags,
        severity_filter=sev,
        rate_limit=rate_limit or settings.SCAN_RATE_LIMIT,
        timeout=timeout or 30,
        credentials=credentials or [],
        exclude_tags=excl,
        custom_headers=custom_headers or {},
        scan_mode=scan_mode,
        extra_args=extra_args or [],
    )
