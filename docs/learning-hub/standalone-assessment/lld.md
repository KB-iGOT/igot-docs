# Standalone Assessment — Low-Level Design

## Details that matter when debugging

| Mechanic | Behaviour |
|---|---|
| Question fetch separation | The shell read never includes answers; question reads are made per section as needed — a paper cannot be scraped in one call |
| Version skew | submit/result exist at v2–v5; the player picks by content version — when results look wrong, first check which version pair served the attempt |
| Progress linkage | Completion writes through `user/realTimeProgress/update`, the same channel as content — assessments and courses share one progress model |
| Retake policy | Enforced server-side per assessment id via the retake endpoint, not in the player |
