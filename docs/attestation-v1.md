# workproof attestation predicate, version 1

This file is the `predicateType` of the in-toto statements that `workproof attest` writes and that
the GitHub Action signs with `cosign attest-blob`:

```
https://github.com/Bubblegunn/workproof/blob/main/docs/attestation-v1.md
```

## The statement

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{ "name": "workproof-report", "digest": { "sha256": "<report hash>" } }],
  "predicateType": "https://github.com/Bubblegunn/workproof/blob/main/docs/attestation-v1.md",
  "predicate": { ... }
}
```

The subject digest is the report's own `hash` field: sha256 over the RFC 8785 canonical JSON of the
report's `params` and `repositories`. `workproof check report.json` recomputes it offline. The figures
are not in the predicate; they are behind the digest.

## The predicate

| field | what it holds |
|---|---|
| `tool.name` | always `workproof` |
| `tool.version` | the workproof version that wrote the report |
| `generatedAt` | the report's ISO 8601 timestamp |
| `params` | the report's parameters, without `ignoreRevsFile` (a path on the signer's machine) |
| `repositories[].head` | the commit the figures were computed at |
| `repositories[].fingerprint` | the repository fingerprint as written in the report |
| `repositories[].fingerprintKeyed` | true when the fingerprint is an HMAC under a key the report does not carry |
| `repositories[].identity.names` | the author names the report covers; never email addresses |
| `repositories[].environment` | git version, blame flags, ignore-revs file name and sample seed |
| `repositories[].excluded` | bot commits and files removed before any figure was computed |

The predicate carries no figures, no paths, no remote URL and no email address.
`test/attest.test.ts` checks that.

## Earlier statements

Statements written by workproof 0.5.1 and earlier carry the predicate type
`https://workproof.dev/attestation/v1`. The project never registered that domain, so the URI was
moved here in 0.6.0. The predicate's fields did not change. To verify a Sigstore bundle written
before 0.6.0, pass that older value to `cosign verify-blob-attestation --type`.
