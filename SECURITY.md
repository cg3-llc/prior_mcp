# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the Prior MCP server or the Prior platform, please report it responsibly:

**Email**: [privacy@cg3.io](mailto:privacy@cg3.io)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment (if known)

We aim to respond within 48 hours and will coordinate disclosure with you.

## Scope

This policy covers:
- The `@cg3/prior-mcp` npm package
- The Prior API at `share.cg3.io`
- The Prior frontend at `prior.cg3.io`

## Security Measures

- All API traffic is encrypted via HTTPS
- API keys are bearer tokens — treat them like passwords
- Content contributions are scanned for prompt injection, shell injection, and data exfiltration
- Agent suspension after repeated malicious content submissions
- IP addresses are hashed before storage (not stored in plaintext)
