# Document Navigation

## Purpose

Local Crew treats markdown headings as the compact navigation layer for recurring documents. The runtime generates a sitemap and per-document outline sidecars so operators and automation can work from stable section references instead of rewriting whole files.

## Runtime Files

- `.localcrew/system/secure/orchestrator/navigation/document-sitemap.md`: human-readable sitemap of indexed markdown files and their copyable heading references.
- `.localcrew/system/secure/orchestrator/navigation/document-outline-index.json`: machine-readable outline index consumed by explorer/tooling.
- `.localcrew/system/secure/orchestrator/navigation/outlines/system/...`: generated outline sidecars for `.localcrew/system/` documents.
- `.localcrew/system/secure/orchestrator/navigation/outlines/external-memory/...`: generated outline sidecars for committed `external-memory/` documents.

## Update Contract

- Use `WRITE[...]` only for brand new files or intentional whole-document regeneration.
- Use `UPDATE[...]` for targeted revisions.
- For markdown, prefer `HEADING: Parent > Child` selectors in `SEARCH` or `ANCHOR` blocks.
- Use `replace-section` when one section should be regenerated without touching the rest of the document.
- Use `insert-after` or `insert-before` with heading selectors when adding content under or between existing sections.

## Example

```text
UPDATE[internal][daily-work.md][insert-after]
ANCHOR
HEADING: Daily Work Document > Research & Discovery
ENDANCHOR
CONTENT
- Added a new observation from the latest marathon run.
ENDCONTENT
ENDUPDATE
```

## Heading Rules

- Keep headings stable and functional. Decorative heading churn weakens outline references.
- If two sections reuse the same heading text, rely on the full trail (`Parent > Child`) to disambiguate them.
- Prefer incremental section updates over broad document rewrites for recurring memory and briefing docs.
