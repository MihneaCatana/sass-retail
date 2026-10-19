# Tickets

Work is tracked as lightweight markdown tickets in this folder. Copy them
into GitHub Issues / Jira / Linear as needed - the IDs here are stable
reference points (also used in commit messages, e.g. `TICKET-101: ...`).

## Files

| File | Contents |
|---|---|
| [DONE.md](DONE.md) | Retrospective tickets for completed work (Phases 1-4.5 + hardening), with verification evidence |
| [BACKLOG.md](BACKLOG.md) | Open, actionable tickets (Phase 5 + Phase 6 hardening + TECH_DEBT items) |

## Conventions

- Ticket ID: `TICKET-<n>`; done tickets use 1-99, backlog tickets start at 100.
- Security/quality debt keeps its `TECH_DEBT.md` ID (e.g. INFRA-002) and
  references it; `TECH_DEBT.md` remains the debt ledger, tickets are the work items.
- Status values: `done`, `open`, `in-progress`.
- Each done ticket lists how it was verified (script + live evidence).
- Each backlog ticket lists acceptance criteria that must be verifiable
  (preferably by an existing or new verification script).

## Quick status (2026-10-18)

| Area | Status |
|---|---|
| Monorepo + Docker skeleton | done (TICKET-001..004) |
| Multi-tenancy core (schema-per-tenant) | done (TICKET-006, 007, 011) |
| IAM / auth (Keycloak + Angular + API) | done (TICKET-005, 008, 015) |
| DB security hardening | done (TICKET-009) |
| Onboarding flow | done (TICKET-010) |
| CI / tests / reliability | done (TICKET-012, 013, 014) |
| Platform admin console | done (TICKET-111) |
| First business module | open (TICKET-101) |
| Production hardening (Phase 6) | open (TICKET-102..110) |
