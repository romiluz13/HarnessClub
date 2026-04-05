# Phase 7 — Performance, Security & Polish

## Status: ❌ CANCELLED (ADR-009)

## Reason
V2 pivot (ADR-009) absorbed all Phase 7 audit work into Phase 15 (Performance, Polish & Launch).
Phase 15 is a superset: covers everything Phase 7 planned PLUS landing page, public API, docs, Chrome extension.

## Relocated To
- **Phase 15.1**: Performance audit (Core Web Vitals, MongoDB explain(), bundle analysis)
- **Phase 15.2**: Dashboard UI polish (WCAG 2.1 AA, dark mode, responsive, skeletons)
- **Phase 15.3**: Security audit (now also covered by Phase 13 Security & Trust Layer)
- **Phase 15.4**: Accessibility audit
- **Phase 15.7**: E2E tests

## Original Checklists Preserved Below (for Phase 15 reference)

## Objective
Final optimization pass using ALL skill guidelines as audit checklists.

## Tasks
- [ ] 7.1 Performance Audit
- [ ] 7.2 MongoDB Performance Audit
- [ ] 7.3 Security Hardening
- [ ] 7.4 Accessibility Final Audit
- [ ] 7.5 E2E Tests

## Skill Guidelines Active This Phase (ALL)
- **vercel-react-best-practices**: Full 62-rule audit. Waterfall elimination. Bundle size. Server perf.
- **mongodb-query-optimizer**: explain() all queries. No COLLSCAN. Index coverage.
- **mongodb-connection**: Pool sizing verification. Monitor connections.
- **mongodb-schema-design**: Document size monitoring. No unbounded arrays.
- **frontend-patterns**: WCAG 2.1 AA full pass. Keyboard. Screen reader. Contrast. Focus.

## Audit Checklists (to be filled during audit)

### Performance
- [ ] No sequential awaits for independent operations
- [ ] No barrel file imports
- [ ] Heavy components lazy-loaded
- [ ] Lists virtualized if >50 items
- [ ] Images lazy-loaded below fold

### MongoDB
- [ ] All queries use indexes (no COLLSCAN)
- [ ] No documents approaching 16MB
- [ ] Connection pool verified for M0
- [ ] No unnecessary $lookups

### Security
- [ ] All server actions authenticated
- [ ] All inputs validated
- [ ] Rate limiting on API routes
- [ ] CSP headers configured
- [ ] gitleaks clean

### Accessibility
- [ ] Keyboard navigation complete
- [ ] Color contrast ≥4.5:1
- [ ] All interactive elements have focus visible
- [ ] No user-scalable=no
- [ ] Screen reader tested

## Work Log
(Updated as tasks complete)

## Lessons Learned
(Updated after phase completion)
