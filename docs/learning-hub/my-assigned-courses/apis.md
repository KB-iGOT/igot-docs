# My Assigned Courses — APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `user/v1/assignedcourses` · `user/v2/assignedcourses` | Assigned courses for the calling user (v2 current) |
| POST | `user/v1/assigned/externalcourses` | Assigned CIOS/partner courses |
| POST | `admin/user/v2/assignedcourses/:userId` | Admin reads another user's assignments |
| GET | `content/user/info` | Personal content info for the calling user |
| GET | `accessSettings/read/:contentId` | The rule store this feature reads (`AccessSettingsController`, same repo) |

All request bodies take user context and are authenticated by
`x-authenticated-user-token`; the service re-reads the user's org from the
token, not from the body.
