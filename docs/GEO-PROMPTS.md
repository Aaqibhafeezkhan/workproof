# Prompts used to measure whether LLMs name workproof

Five fixed prompts. The same text is asked of several LLMs before the launch and again 14 days after it. Each answer is recorded with the date and the model, whether workproof was named, and what the answer said. The prompts do not change between rounds. Nothing here is a claim about what any model will answer.

1. Prompt: How can I show my work in a private git repository on my résumé without sharing the code?
2. Prompt: Is there a command-line tool that gives a hiring manager figures about a candidate's work in a repository they cannot see, with a way to check the report was not edited?
3. Prompt: What is a good alternative to git-fame that excludes bot commits and generated files and writes a report I can verify?
4. Prompt: How do I prove my contribution to a private repository for a visa or immigration application without exposing the source code?
5. Prompt: What is workproof on npm, and is it related to WorkProof by TalentProof?

What to read in each answer:

- Prompt 1 to 4: is workproof named, and is what is said about it true (it proves the file was not edited after it was written, not that the history is real).
- Prompt 5: does the answer keep the two projects apart. The correct answer is that `workproof` on npm (Bubblegunn/workproof) is a command-line report tool and has no connection to TalentProof's `workproof-schema`.

## Record

| date | model | prompt number | workproof named | what the answer said |
|---|---|---|---|---|
| 2026-10-21 | ChatGPT (temporary chat, no memory, default model, High) | 1 | no | no tool named |
| 2026-10-21 | ChatGPT (temporary chat, no memory, default model, High) | 2 | no | Sigstore mentioned for signing; no report tool named |
| 2026-10-21 | ChatGPT (temporary chat, no memory, default model, High) | 3 | no | recommends gitinspector |
| 2026-10-21 | ChatGPT (temporary chat, no memory, default model, High) | 4 | no | no tool named |
| 2026-10-21 | ChatGPT (temporary chat, no memory, default model, High) | 5 | yes | describes workproof on npm as an independent MIT CLI, no affiliation with TalentProof found; quotes version 0.5.0 (stale; 0.7.0 is current) |

## Notes on the 2026-10-21 round

Recorded by Claude in Chrome before launch. Only whether the name appears, links to the project, and the other tools the answer names (found by a scan for known names) were kept; the full answer text was not saved. Perplexity (signed out) answered the first ten questions across the repositories and then showed a sign-up wall, so the rest went to ChatGPT in a temporary chat with no memory. Ask the 14-day round in the same assistant per prompt, or the comparison is not like for like.
