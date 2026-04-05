# Phase 12 — Security & Trust Layer

## Status: ✅ COMPLETE

## Objective
Advanced security scanning, trust scores, approval workflows, supply chain security.
Extends basic scanning from Phase 9.4.

## Dependencies
- Phase 9 (basic scanner foundation), Phase 11 (dept-level approval config)

## Tasks
- [ ] 12.1 Advanced security scanning (extends 9.4: LLM detection, hook analysis, periodic re-scan)
- [ ] 12.2 Trust scores and provenance (score formula, chain of custody, visual indicators)
- [ ] 12.3 Approval workflows (configurable per dept, review queue, diff view)
- [ ] 12.4 Supply chain security (upstream monitoring, fork detection, dependency scanning)

## Trust Score Formula
```
trust_score = (
  author_reputation * 0.2 +
  scan_results * 0.3 +
  usage_count * 0.15 +
  age_days * 0.1 +
  review_score * 0.15 +
  provenance_verified * 0.1
)
```
Levels: A (90+), B (70-89), C (50-69), D (<50)

## Scanning Patterns
| Category | Detection Method |
|----------|-----------------|
| Prompt injection | Known attack strings + LLM classification |
| Credential leaks | Regex (API keys, tokens, passwords) |
| Dangerous commands | Pattern matching (rm -rf, curl\|bash, eval) |
| Malicious URLs | Domain allowlist/blocklist |
| MCP config risks | Transport validation, cert pinning |
| Hook escalation | Static analysis of hook scripts |

## Skill Guidelines Active
- **api-security-best-practices**: all patterns, OWASP awareness

## Work Log
- 12.1 ✅ Type-specific scanner: MCP config (transport validation, domain allowlisting, credential exposure, env hardcoding), hook (privilege escalation, network exfil, filesystem writes), settings (safety disabling). Scan history on AssetDocument.
- 12.2 ✅ Trust score engine: 6-component weighted formula (security 30%, provenance 25%, usage 15%, age 10%, author 10%, recency 10%). Grades A-D. ProvenanceRecord with chain of custody.
- 12.3 ✅ Approval workflows: 3 modes (auto_approve, single_review, multi_review). ApprovalRequest with decisions[]. No self-review, no duplicates. API: GET/POST /api/approvals, POST /api/approvals/[requestId]/review.
- 12.4 ✅ Supply chain: upstream monitoring (fingerprint comparison), fork detection (cross-team duplicate identification), plugin bundle scanning (aggregate safety). 12 new tests. Build verified.

## Lessons Learned
- MCP configs are the highest-sensitivity asset type — need special handling. Domain allowlisting is critical for enterprise.
- Trust scores should be ADVISORY not BLOCKING — defense in depth, not binary gates.
- Approval workflows must prevent self-review (easy mistake that undermines the whole system).
