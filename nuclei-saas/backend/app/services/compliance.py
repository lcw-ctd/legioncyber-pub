import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Comprehensive mapping of framework requirements to OWASP categories and CWEs
FRAMEWORK_REQUIREMENTS: dict[str, list[dict[str, Any]]] = {
    "pci_dss": [
        {
            "requirement_id": "6.2.4",
            "requirement_name": "Prevent Common Software Attacks",
            "owasp_categories": ["A03:2021", "A01:2021", "A02:2021"],
            "cwe_ids": ["CWE-89", "CWE-79", "CWE-78", "CWE-22"],
            "nuclei_tags": ["sqli", "xss", "rce", "lfi"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "6.3.2",
            "requirement_name": "Maintain an Inventory of Custom Software",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve", "outdated"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "6.4.1",
            "requirement_name": "Web-facing Applications Protected Against Attacks",
            "owasp_categories": ["A03:2021", "A07:2021"],
            "cwe_ids": ["CWE-89", "CWE-79", "CWE-307"],
            "nuclei_tags": ["sqli", "xss", "auth"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "8.3.1",
            "requirement_name": "Strong Authentication for Users",
            "owasp_categories": ["A07:2021"],
            "cwe_ids": ["CWE-287", "CWE-306", "CWE-521"],
            "nuclei_tags": ["auth", "default-login", "weak-password"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "10.3.3",
            "requirement_name": "Audit Logs Protected",
            "owasp_categories": ["A09:2021"],
            "cwe_ids": ["CWE-778"],
            "nuclei_tags": ["exposure", "log"],
            "severity_threshold": "medium",
        },
    ],
    "hipaa": [
        {
            "requirement_id": "164.312(a)(2)(i)",
            "requirement_name": "Unique User Identification",
            "owasp_categories": ["A07:2021"],
            "cwe_ids": ["CWE-287", "CWE-306"],
            "nuclei_tags": ["auth", "default-login"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "164.312(a)(2)(iv)",
            "requirement_name": "Encryption and Decryption of ePHI",
            "owasp_categories": ["A02:2021"],
            "cwe_ids": ["CWE-319", "CWE-326", "CWE-327"],
            "nuclei_tags": ["ssl", "tls", "weak-cipher"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "164.312(c)(1)",
            "requirement_name": "Integrity Controls",
            "owasp_categories": ["A08:2021", "A03:2021"],
            "cwe_ids": ["CWE-352", "CWE-89"],
            "nuclei_tags": ["csrf", "sqli"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "164.312(e)(2)(ii)",
            "requirement_name": "Encryption in Transit",
            "owasp_categories": ["A02:2021"],
            "cwe_ids": ["CWE-319"],
            "nuclei_tags": ["ssl", "http-missing-security-headers"],
            "severity_threshold": "medium",
        },
    ],
    "soc2": [
        {
            "requirement_id": "CC6.1",
            "requirement_name": "Logical and Physical Access Controls",
            "owasp_categories": ["A01:2021", "A07:2021"],
            "cwe_ids": ["CWE-284", "CWE-287"],
            "nuclei_tags": ["auth", "idor", "access-control"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "CC6.6",
            "requirement_name": "Security Threats from Outside the Boundaries",
            "owasp_categories": ["A03:2021", "A06:2021"],
            "cwe_ids": ["CWE-89", "CWE-79", "CWE-1104"],
            "nuclei_tags": ["sqli", "xss", "rce", "cve"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "CC7.1",
            "requirement_name": "System Monitoring",
            "owasp_categories": ["A09:2021"],
            "cwe_ids": ["CWE-778"],
            "nuclei_tags": ["exposure", "misconfiguration"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "CC8.1",
            "requirement_name": "Change Management",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["outdated", "cve"],
            "severity_threshold": "medium",
        },
    ],
    "iso27001": [
        {
            "requirement_id": "A.14.2.1",
            "requirement_name": "Secure Development Policy",
            "owasp_categories": ["A03:2021", "A01:2021"],
            "cwe_ids": ["CWE-89", "CWE-79", "CWE-22"],
            "nuclei_tags": ["sqli", "xss", "lfi"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "A.9.4.2",
            "requirement_name": "Secure Log-on Procedures",
            "owasp_categories": ["A07:2021"],
            "cwe_ids": ["CWE-307", "CWE-521"],
            "nuclei_tags": ["auth", "brute-force"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "A.10.1.1",
            "requirement_name": "Policy on the Use of Cryptographic Controls",
            "owasp_categories": ["A02:2021"],
            "cwe_ids": ["CWE-326", "CWE-327"],
            "nuclei_tags": ["ssl", "tls", "weak-cipher"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "A.12.6.1",
            "requirement_name": "Management of Technical Vulnerabilities",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve", "outdated"],
            "severity_threshold": "low",
        },
    ],
    "nist_csf": [
        {
            "requirement_id": "ID.RA-1",
            "requirement_name": "Asset vulnerabilities are identified and documented",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve", "outdated", "misconfiguration"],
            "severity_threshold": "low",
        },
        {
            "requirement_id": "PR.AC-3",
            "requirement_name": "Remote access is managed",
            "owasp_categories": ["A07:2021", "A01:2021"],
            "cwe_ids": ["CWE-287", "CWE-284"],
            "nuclei_tags": ["auth", "vpn", "remote-access"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "PR.DS-2",
            "requirement_name": "Data-in-transit is protected",
            "owasp_categories": ["A02:2021"],
            "cwe_ids": ["CWE-319"],
            "nuclei_tags": ["ssl", "tls"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "DE.CM-8",
            "requirement_name": "Vulnerability scans are performed",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve"],
            "severity_threshold": "medium",
        },
    ],
    "gdpr": [
        {
            "requirement_id": "Art.25",
            "requirement_name": "Data Protection by Design and Default",
            "owasp_categories": ["A01:2021", "A04:2021"],
            "cwe_ids": ["CWE-284", "CWE-359"],
            "nuclei_tags": ["exposure", "idor", "access-control"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "Art.32",
            "requirement_name": "Security of Processing",
            "owasp_categories": ["A02:2021", "A07:2021"],
            "cwe_ids": ["CWE-319", "CWE-287"],
            "nuclei_tags": ["ssl", "auth", "tls"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "Art.33",
            "requirement_name": "Notification of Personal Data Breach",
            "owasp_categories": ["A09:2021"],
            "cwe_ids": ["CWE-778"],
            "nuclei_tags": ["exposure", "leak"],
            "severity_threshold": "high",
        },
    ],
    "cmmc": [
        {
            "requirement_id": "AC.1.001",
            "requirement_name": "Limit information system access to authorized users",
            "owasp_categories": ["A01:2021", "A07:2021"],
            "cwe_ids": ["CWE-284", "CWE-287"],
            "nuclei_tags": ["auth", "access-control", "idor"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "IA.1.076",
            "requirement_name": "Identify information system users",
            "owasp_categories": ["A07:2021"],
            "cwe_ids": ["CWE-287", "CWE-306"],
            "nuclei_tags": ["auth", "default-login"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "SI.1.210",
            "requirement_name": "Identify, report, and correct information system flaws",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve", "outdated"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "SC.3.187",
            "requirement_name": "Implement cryptographic mechanisms",
            "owasp_categories": ["A02:2021"],
            "cwe_ids": ["CWE-326", "CWE-327"],
            "nuclei_tags": ["ssl", "tls", "weak-cipher"],
            "severity_threshold": "medium",
        },
    ],
    "fedramp": [
        {
            "requirement_id": "AC-2",
            "requirement_name": "Account Management",
            "owasp_categories": ["A07:2021", "A01:2021"],
            "cwe_ids": ["CWE-287", "CWE-284"],
            "nuclei_tags": ["auth", "access-control"],
            "severity_threshold": "medium",
        },
        {
            "requirement_id": "RA-5",
            "requirement_name": "Vulnerability Scanning",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve", "outdated"],
            "severity_threshold": "low",
        },
        {
            "requirement_id": "SC-8",
            "requirement_name": "Transmission Confidentiality and Integrity",
            "owasp_categories": ["A02:2021"],
            "cwe_ids": ["CWE-319"],
            "nuclei_tags": ["ssl", "tls"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "SI-2",
            "requirement_name": "Flaw Remediation",
            "owasp_categories": ["A06:2021"],
            "cwe_ids": ["CWE-1104"],
            "nuclei_tags": ["cve"],
            "severity_threshold": "high",
        },
        {
            "requirement_id": "SA-11",
            "requirement_name": "Developer Testing and Evaluation",
            "owasp_categories": ["A03:2021", "A01:2021"],
            "cwe_ids": ["CWE-89", "CWE-79"],
            "nuclei_tags": ["sqli", "xss"],
            "severity_threshold": "medium",
        },
    ],
}


class ComplianceService:
    def map_finding_to_frameworks(self, finding: Any) -> list[dict]:
        """Return list of framework requirements affected by this finding."""
        affected = []
        for framework, requirements in FRAMEWORK_REQUIREMENTS.items():
            for req in requirements:
                if self._finding_matches_requirement(finding, req):
                    affected.append(
                        {
                            "framework": framework,
                            "requirement_id": req["requirement_id"],
                            "requirement_name": req["requirement_name"],
                        }
                    )
        return affected

    def _finding_matches_requirement(self, finding: Any, req: dict) -> bool:
        """Check if a finding matches a compliance requirement."""
        # Check OWASP category
        if finding.owasp_category and finding.owasp_category in req.get("owasp_categories", []):
            return True

        # Check CWE IDs
        finding_cwes = set(finding.cwe_ids or [])
        req_cwes = set(req.get("cwe_ids", []))
        if finding_cwes & req_cwes:
            return True

        # Check nuclei tags (finding tags vs requirement tags)
        finding_tags = set(finding.tags or [])
        req_tags = set(req.get("nuclei_tags", []))
        if finding_tags & req_tags:
            return True

        return False

    async def get_compliance_gaps(
        self,
        org_id: uuid.UUID,
        frameworks: list[str],
        db: AsyncSession,
    ) -> dict[str, list[dict]]:
        """
        For each framework, identify which requirements have open findings.
        Returns {framework: [gap_items]}.
        """
        from app.models.finding import Finding
        from sqlalchemy import select

        result = await db.execute(
            select(Finding).where(
                Finding.org_id == org_id,
                Finding.status == "open",
            )
        )
        open_findings = result.scalars().all()

        gaps: dict[str, list[dict]] = {}
        for framework in frameworks:
            requirements = FRAMEWORK_REQUIREMENTS.get(framework, [])
            framework_gaps = []

            for req in requirements:
                matching_findings = [
                    f for f in open_findings
                    if self._finding_matches_requirement(f, req)
                ]
                if matching_findings:
                    severity_counts: dict[str, int] = {}
                    for f in matching_findings:
                        severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1

                    framework_gaps.append(
                        {
                            "requirement_id": req["requirement_id"],
                            "requirement_name": req["requirement_name"],
                            "finding_count": len(matching_findings),
                            "severity_breakdown": severity_counts,
                            "highest_severity": self._highest_severity(
                                [f.severity for f in matching_findings]
                            ),
                        }
                    )

            gaps[framework] = framework_gaps
        return gaps

    async def get_compliance_score(
        self,
        org_id: uuid.UUID,
        framework: str,
        db: AsyncSession,
    ) -> float:
        """
        Calculate a compliance score (0-100) for the org against a given framework.

        Score = percentage of requirements with no open critical/high findings.
        """
        from app.models.finding import Finding

        requirements = FRAMEWORK_REQUIREMENTS.get(framework, [])
        if not requirements:
            return 100.0

        result = await db.execute(
            select(Finding).where(
                Finding.org_id == org_id,
                Finding.status == "open",
                Finding.severity.in_(["critical", "high", "medium"]),
            )
        )
        open_findings = result.scalars().all()

        passing_requirements = 0
        for req in requirements:
            matching = [
                f for f in open_findings
                if self._finding_matches_requirement(f, req)
            ]
            # Requirement passes if no open high/critical findings
            critical_high = [
                f for f in matching if f.severity in ("critical", "high")
            ]
            if not critical_high:
                passing_requirements += 1

        score = (passing_requirements / len(requirements)) * 100
        return round(score, 1)

    @staticmethod
    def _highest_severity(severities: list[str]) -> str:
        order = ["critical", "high", "medium", "low", "info"]
        for sev in order:
            if sev in severities:
                return sev
        return "info"
