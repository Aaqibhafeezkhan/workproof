# workproof countersignature predicate, version 1

This file is the `predicateType` of the in-toto statements that `workproof countersign` writes:

```
https://github.com/Bubblegunn/workproof/blob/main/docs/countersignature-v1.md
```

A countersignature is made by a second person, from their own clone of the same repository, after
`workproof countersign` has recomputed every figure of the author's report and found them all equal.

## How it is made

1. The author runs `workproof` and keeps the fingerprint key the run prints on stderr (it is not
   stored in the report).
2. The author sends `workproof-report.json` and the fingerprint key to the colleague.
3. The colleague checks out the commit the report names (`HEAD` in the report) in a full clone of the
   same repository and runs one command:

   ```
   workproof countersign workproof-report.json --key ~/.ssh/id_ed25519 --fingerprint-key <hex>
   ```

4. The colleague sends back the `.dsse.json` file it names. Nothing else leaves their machine.

`countersign` refuses, and signs nothing, unless the report checks, the keyed fingerprint matches the
clone, the clone is at the report's commit, and every figure is equal.

## The statement

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{ "name": "workproof-report", "digest": { "sha256": "<report hash>" } }],
  "predicateType": "https://github.com/Bubblegunn/workproof/blob/main/docs/countersignature-v1.md",
  "predicate": { ... }
}
```

The subject digest is the report's own `hash` field, the same digest `workproof attest` signs.

## The predicate

| field | what it holds |
|---|---|
| `tool.name`, `tool.version` | `workproof` and the version the countersigner ran |
| `countersignedAt` | ISO 8601 time on the countersigner's clock |
| `claim` | the fixed sentence the signature stands for: the figures of the subject report were recomputed from the signer's own clone of the same repository, at the same commit, and came out the same |
| `report.hash`, `report.generatedAt`, `report.toolVersion` | what the report says about itself |
| `repositories[].head` | the commit the clone was at |
| `repositories[].fingerprint` | the keyed repository fingerprint as written in the report |
| `repositories[].figuresRecomputed` | how many figures were recomputed for that repository |
| `signer.label` | what the countersigner typed with `--as`; self-declared and not verified |

The predicate carries no figures, no paths, no remote URL and no email address.

## The signature

The statement bytes are signed with `ssh-keygen -Y sign` in the namespace `workproof-countersign`. This
is not the `workproof` namespace that `attest --local` uses, so a signature made for one purpose is
rejected for the other. The detached signature is wrapped with the statement in a DSSE envelope
(`<report>.countersign-<id>.dsse.json`).

A reader checks it with:

```
workproof check workproof-report.json \
  --countersign workproof-report.countersign-<id>.dsse.json \
  --allowed-signers allowed_signers
```

where `allowed_signers` holds one line per key the reader trusts, `cem@example.com ssh-ed25519 AAAA...`,
for example the key GitHub serves at `https://github.com/<user>.keys`. Without `--allowed-signers`,
`check` still verifies the signature but can only name the key, not a person. The equivalent
`ssh-keygen` command is:

```
ssh-keygen -Y verify -f allowed_signers -I cem@example.com -n workproof-countersign \
  -s workproof-report.countersign-<id>.intoto.json.sig < workproof-report.countersign-<id>.intoto.json
```

## What a countersignature does not prove

It does not prove who holds the key unless the reader supplies keys they trust. It does not prove
that the countersigner and the author did not agree beforehand: two people can build a repository
that never existed and both sign it. It does not prove that the history is honest or that the figures
measure anything worth measuring. A report with no countersignature is normal and is not suspect.
The [threat model](THREAT-MODEL.md) has the full list.
