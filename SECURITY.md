<p align="center">
  <strong>English</strong> | <a href="SECURITY.ru.md">Русский</a>
</p>

# Security Policy

## Supported versions

| Version | Support |
|---------|---------|
| 0.5.x   | ✅       |
| < 0.5   | ❌       |

## Reporting a vulnerability

**Do not open a public issue for a vulnerability.** Contact us directly:

- GitHub Security Advisories: https://github.com/Griln/Trel/security/advisories/new
- or the repository security page: https://github.com/Griln/Trel/security

Please describe:

1. What is vulnerable and in which component
2. Steps to reproduce
3. Trel version, OS, Java
4. Impact (what an attacker gains)

## What happens next

- A reply within **7 days**
- Confirmation that the vulnerability was accepted, with a time estimate
- A fix and a public release
- A credit mention in the changelog, if you want it (optional)

## What counts as a vulnerability

- Arbitrary code execution without user consent
- Downloading files over non-HTTPS or without hash verification
- Leakage of Microsoft account credentials
- File access permissions outside the game directory
- Privilege escalation in Electron (for example, `nodeIntegration` in the renderer process)

## What is NOT a vulnerability

- Missing signature on the Windows installer (SmartScreen) — expected for an open source project
- Running Minecraft without a license
- Installing mods from unverified sources
- Vulnerabilities in QEMU, Android-x86 and scrcpy — report them to those projects' maintainers
