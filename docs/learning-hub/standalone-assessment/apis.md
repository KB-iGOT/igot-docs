# Standalone Assessment — APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `assessment/v5/read` (legacy `assessment/read`) | Assessment shell — sections, duration, rules |
| POST | `question/v5/read` (legacy `question/read`) | Question bodies by id |
| POST | `assessment/save` | Auto-save the in-flight attempt |
| POST | `user/evaluate/assessment/submit/v2…v5` | Submit — v5 current; earlier versions serve older content |
| POST | `user/assessment/v4/result` · `v5/result` | Result read |
| GET | `user/assessment/retake/:id` · `v5/retake/:id` | Retake eligibility / grant |
| GET | `scroing/getTemplate/:id` | Scoring template (path spelling is literal in code) |
