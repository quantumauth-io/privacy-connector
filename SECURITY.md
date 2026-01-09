# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not** open a public GitHub issue for security-sensitive reports.

Instead, please contact:

- Email: security@quantumauth.io

Include as much detail as possible:
- A description of the issue
- Steps to reproduce (if applicable)
- Potential impact
- Any proof-of-concept or suggested mitigation

We aim to acknowledge reports within **72 hours**.

## Scope

This project is a **client-side wallet connector library**.

Out of scope:
- Vulnerabilities in third-party wallets or RPC providers
- Issues caused by incorrect application-level usage
- Social engineering attacks

In scope:
- Unexpected network requests or data exfiltration
- Incorrect connector transparency reporting
- Unsafe defaults that could lead to privacy or security degradation

## Network & Privacy Expectations

This library is designed to:
- Make no outbound network requests beyond wallet/RPC communication
- Avoid embedded analytics, telemetry, or tracking
- Rely only on user-triggered wallet discovery

Any deviation from these guarantees is considered a **security issue**.

## Disclosure

We follow a coordinated disclosure process. Public disclosure will occur after a fix is released or an agreed timeline has passed.