import asyncio
import hashlib
import logging
import secrets
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

VERIFICATION_FILE_PATH = "/.well-known/security-scanner-verification.txt"
HTTP_TIMEOUT = 15.0


class DomainVerificationService:
    def generate_verification_token(self, domain_id: str) -> str:
        """Generate a cryptographically random verification token tied to the domain ID."""
        random_bytes = secrets.token_bytes(24)
        combined = f"{domain_id}:{random_bytes.hex()}"
        token = hashlib.sha256(combined.encode()).hexdigest()[:40]
        return f"nuclei-scanner-verify={token}"

    def get_dns_txt_record(self, domain: str, token: str) -> dict:
        """Return instructions for adding a DNS TXT verification record."""
        return {
            "record_type": "TXT",
            "record_name": f"_nuclei-scanner-verification.{domain}",
            "record_value": token,
            "ttl": 300,
            "instruction": (
                f"Add a DNS TXT record to your domain:\n"
                f"  Name:  _nuclei-scanner-verification.{domain}\n"
                f"  Type:  TXT\n"
                f"  Value: {token}\n"
                f"  TTL:   300\n"
                f"DNS propagation may take up to 48 hours."
            ),
        }

    def get_http_file_content(self, token: str) -> str:
        """Return the content to place at the verification file URL."""
        return f"{token}\n"

    async def verify_dns(self, domain: str, token: str) -> bool:
        """
        Verify domain ownership by checking for the expected TXT record.
        Uses dnspython if available, falls back to subprocess dig.
        """
        record_name = f"_nuclei-scanner-verification.{domain}"
        try:
            import dns.resolver  # type: ignore

            resolver = dns.resolver.Resolver()
            resolver.timeout = 10.0
            resolver.lifetime = 10.0
            try:
                answers = resolver.resolve(record_name, "TXT")
                for rdata in answers:
                    for txt_string in rdata.strings:
                        txt_value = txt_string.decode("utf-8", errors="ignore")
                        if txt_value == token:
                            return True
                return False
            except dns.resolver.NXDOMAIN:
                return False
            except dns.resolver.NoAnswer:
                return False
            except dns.exception.DNSException as exc:
                logger.warning("DNS resolution error for %s: %s", record_name, exc)
                return False
        except ImportError:
            return await self._verify_dns_subprocess(record_name, token)

    async def _verify_dns_subprocess(self, record_name: str, token: str) -> bool:
        """Fallback DNS verification using subprocess dig."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "dig",
                "+short",
                "TXT",
                record_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15.0)
            output = stdout.decode("utf-8", errors="ignore")
            # dig wraps TXT values in quotes
            return token in output.replace('"', "")
        except (asyncio.TimeoutError, FileNotFoundError, OSError) as exc:
            logger.warning("dig subprocess failed: %s", exc)
            return False

    async def verify_http(self, domain: str, token: str) -> bool:
        """
        Verify domain ownership by fetching the verification file via HTTPS/HTTP.
        """
        for scheme in ("https", "http"):
            url = f"{scheme}://{domain}{VERIFICATION_FILE_PATH}"
            try:
                async with httpx.AsyncClient(
                    timeout=HTTP_TIMEOUT,
                    follow_redirects=True,
                    verify=False,  # allow self-signed certs during verification
                ) as client:
                    response = await client.get(url)
                    if response.status_code == 200:
                        content = response.text.strip()
                        if content == token.strip():
                            return True
            except httpx.RequestError as exc:
                logger.debug("HTTP verification attempt failed for %s: %s", url, exc)
                continue
        return False

    async def verify_meta_tag(self, domain: str, token: str) -> bool:
        """
        Verify domain ownership by checking for a meta tag in the root HTML page.
        """
        for scheme in ("https", "http"):
            url = f"{scheme}://{domain}/"
            try:
                async with httpx.AsyncClient(
                    timeout=HTTP_TIMEOUT,
                    follow_redirects=True,
                    verify=False,
                ) as client:
                    response = await client.get(url)
                    if response.status_code == 200:
                        content = response.text
                        needle = f'content="{token}"'
                        if needle in content:
                            return True
            except httpx.RequestError as exc:
                logger.debug("Meta tag verification failed for %s: %s", url, exc)
                continue
        return False

    async def schedule_reverification(self, domain_id: str) -> None:
        """Queue a reverification task via Celery."""
        try:
            from app.workers.scan_tasks import verify_domain
            verify_domain.apply_async(args=[domain_id], countdown=3600)
        except Exception as exc:
            logger.warning("Failed to schedule reverification for domain %s: %s", domain_id, exc)
