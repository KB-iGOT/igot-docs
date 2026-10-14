# AI CBP Tool — API Reference

AI-Driven CBP Training Plan Creation System — API documentation. API for managing state centers and training organizations for competency-based program development.

| Property | Value |
|---|---|
| Version | 1.0.0 |
| OpenAPI | 3.1.0 |
| Server (Base URL) | /cbp-tpc-ai |
| Security Scheme | JWT — OAuth2 Password Flow |
| Token URL | /cbp-tpc-ai/api/v1/auth/login |
| Scopes | None |

## Getting started

### Base URL

Every path in this document is relative to the server base path:

`https://<host>/cbp-tpc-ai`

Example: POST https://<host>/cbp-tpc-ai/api/v1/auth/login

### Authorization

Endpoints marked 🔒 require a JWT access token:

`Authorization: Bearer <access_token>`

1. Call POST /api/v1/auth/login with form fields username and password .
- 2. Use access_token from the response in the Authorization header.
3. When the access token expires ( expires_in seconds), call POST /api/v1/auth/refresh with the refresh_token .
4. Call POST /api/v1/auth/logout to end the session.

### Legend

| Symbol | Meaning |
|---|---|
| 🔒 | Requires JWT bearer token |
| 🔓 | Public, no token required |
| * / Yes | Required field or parameter |
| T \| null | Field accepts the type or null (OpenAPI anyOf ) |


### Standard validation error (422)

Any endpoint that accepts parameters or a request body can return 422 Validation Error with an HTTPValidationError body:

```json
{
    "detail": [
      {
        "loc": ["body", "role_mapping_id"],
        "msg": "field required",
        "type": "value_error.missing"
      }
    ]
}
```

## Authentication

### `POST /api/v1/auth/login`

**Login** 🔓

User login endpoint. Authenticates user with username/email and password, creates a session and returns an access token and a refresh token. Includes brute-force protection:

- Tracks failed login attempts
- Locks the account after MAX_LOGIN_ATTEMPTS failed attempts
- Auto-unlocks after LOGIN_LOCKOUT_MINUTES

*Operation ID: login_api_v1_auth_login_post*

**Request Body — application/x-www-form-urlencoded (required) — Body_login_api_v1_auth_login_post**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| username | string | Yes | minLength 3, maxLength 255 | Username or email |
| password | string | Yes | minLength 8 | User password |

**Example request**

```bash
curl -X POST "https://<host>/cbp-tpc-ai/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=<username>&password=<password>"
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | TokenResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600
}
```

### `POST /api/v1/auth/refresh`

**Refresh Token** 🔓

Generates a new access token using a valid refresh token and updates the session in the database with the new access token.

*Operation ID: refresh_token_api_v1_auth_refresh_post*

**Request Body — application/json (required) — RefreshTokenRequest**

| Field | Type | Required | Description |
|---|---|---|---|
| refresh_token | string | Yes | JWT refresh token |

**Example request**

```json
{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RefreshTokenResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600
}
```

### `POST /api/v1/auth/logout`

**Logout** 🔒

Deletes the session from the database. When ENABLE_TOKEN_BLACKLIST is True , deleting the session invalidates both the access and refresh tokens.

*Operation ID: logout_api_v1_auth_logout_post*

**Parameters: None**

**Request Body: None**

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | LogoutResponse |

**Example response — 200**

```json
{
    "message": "Successfully logged out"
}
```

### `POST /api/v1/auth/unlock-account/{username}`

**Unlock Account** 🔒 (Admin only)

Clears all failed login attempts for the specified username, unlocking the account if it was locked.

*Operation ID: unlock_account_api_v1_auth_unlock_account__username__post*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| username | string | Yes | The username to unlock |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — success message | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/auth/account-status/{username}`

**Get Account Status** 🔒 (Admin only)

Returns the current lockout status for the specified username.

*Operation ID: get_account_status_api_v1_auth_account_status__username__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| username | string | Yes | The username to check |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — account lockout status information | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


### `POST /api/v1/auth/cleanup-expired-sessions`

**Cleanup Expired Sessions** 🔒 (Admin only)

Removes sessions whose refresh token has expired. Should be run periodically or on demand.

*Operation ID: cleanup_expired_sessions_api_v1_auth_cleanup_expired_sessions_post*

**Parameters: None**

**Request Body: None**

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — number of expired sessions removed | object (untyped) |


## State Centers

### `GET /api/v1/state-center/`

**Get All State Centers** 🔒

Get all states/centers from the iGOT Karmayogi Portal.

*Operation ID: get_all_state_centers_api_v1_state_center__get*

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| query | string \| null | No | — | Search query for filtering organizations |
| limit | integer | No | 1000 | Number of records to fetch |
| offset | integer | No | 0 | Number of records to skip for pagination |
| sub_org_type | OrgTypeEnum \| null | No | ministry | Organization type: ministry or state |

**Example request**

```http
GET /cbp-tpc-ai/api/v1/state-center/?
query=finance&limit=50&offset=0&sub_org_type=ministry
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of StateCenterResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
[
    {
        "identifier": "01379305664500633640",
        "orgName": "Ministry of Finance",
        "sbOrgType": "ministry",
        "sbOrgSubType": "ministry",
        "parentOrgName": null,
        "orgHierarchyFrameworkId": "org_framework_01",
        "orgHierarchyFrameworkStatus": "Live",
        "isRootOrg": true
    }
]
```

## Departments

### `GET /api/v1/department/state-center/{state_center_id}`

**Get Departments By State Center** 🔒

Get all departments for a specific state/center from the iGOT Karmayogi Portal.

*Operation ID:*

get_departments_by_state_center_api_v1_department_state_center__state_center_id__g et

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | Ministry or State identifier |

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| limit | integer | No | 9999 | Number of records to fetch |
| offset | integer | No | 0 | Number of records to skip for pagination |
| sub_org_type | OrgTypeEnum \| null | No | state | Organization type: ministry or state |
| query | string \| null | No | — | Search text |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of DepartmentResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
[
    {
        "identifier": "01379305900000123456",
        "orgName": "Department of Revenue",
        "description": "Department under Ministry of Finance",
        "parentOrgName": "Ministry of Finance",
        "ministryOrStateId": "01379305664500633640",
        "ministryOrStateType": "ministry",
        "ministryOrStateName": "Ministry of Finance",
        "sbOrgSubType": "department"
    }
]
```

## State Centers Data

### `POST /api/v1/state-center-data/upload_documents_background`

**Upload State Center Documents In Background** 🔒

Upload ACBP Plan and Work Allocation Order PDFs for a state/center. Summaries are generated asynchronously in the background.

*Operation ID:*

upload_state_center_documents_in_background_api_v1_state_center_data_upload_docume nts_background_post

**Request Body — multipart/form-data (required) — Body_upload_state_center_documents_in_background...**

| Field | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | ID of the state/center |
| department_id | string \| null | No | Optional Department ID |
| acbp_plan_pdf | file (binary) | No | ACBP Plan PDF file |
| work_allocation_pdf | file (binary) | No | Work Allocation Order PDF file |

**Example request**

```bash
curl -X POST "https://<host>/cbp-tpc-ai/api/v1/state-center-data/upload_documents_ba
  -H "Authorization: Bearer <token>" \
  -F "state_center_id=01379305664500633640" \
  -F "acbp_plan_pdf=@acbp_plan.pdf" \
  -F "work_allocation_pdf=@work_allocation.pdf"
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response (accepted, processing in background) | FileUploadResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 202**

```json
{
    "message": "Files uploaded. Summaries are being generated in background.",
    "data": {
      "state_center_id": "01379305664500633640",
      "department_id": null,
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "acbp_plan_filename": "acbp_plan.pdf",
      "work_allocation_filename": "work_allocation.pdf",
      "acbp_plan_summary": null,
      "work_allocation_order_summary": null,
      "status": "IN_PROGRESS",
      "error_message": null,
      "created_at": "2026-10-14T09:30:00Z",
      "updated_at": "2026-10-14T09:30:00Z"
    }
}
```

### `GET /api/v1/state-center-data`

**Get State Center Data** 🔒

Get state center data, including document summaries, for a specific state/center.

*Operation ID: get_state_center_data_api_v1_state_center_data_get*

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | State/Center ID |
| department_id | string \| null | No | Optional department ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | StateCenterDataResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "state_center_id": "01379305664500633640",
    "department_id": null,
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "acbp_plan_filename": "acbp_plan.pdf",
    "work_allocation_filename": "work_allocation.pdf",
    "acbp_plan_summary": "The ACBP plan identifies capacity needs in ...",
    "work_allocation_order_summary": "The work allocation order assigns ...",
    "status": "COMPLETED",
    "error_message": null,
    "created_at": "2026-10-14T09:30:00Z",
    "updated_at": "2026-10-14T09:34:12Z"
}
```

### `DELETE /api/v1/state-center-data`

**Delete State Center Data** 🔒

Delete/clear specific summary data for a state center based on type.

*Operation ID: delete_state_center_data_api_v1_state_center_data_delete*

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | State/Center ID |
| type | string | Yes | Type of data to clear: acbp_doc or work_doc |
| department_id | string \| null | No | Optional department ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 204 | Successful Response (no content) | — |
| 422 | Validation Error | HTTPValidationError |

Role Mappings

- A role mapping represents one designation in a state/center (optionally scoped to a department), together with its wing/division/section, role responsibilities, activities and competencies.

Reference example — RoleMappingResponse (used by several endpoints below)

```json
{
    "state_center_id": "01379305664500633640",
    "state_center_name": "Ministry of Finance",
    "department_id": "01379305900000123456",
    "department_name": "Department of Revenue",
    "sector_name": "Finance",
    "instruction": null,
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "designation_name": "Under Secretary",
    "status": "COMPLETED",
    "wing_division_section": "Budget Division",
    "role_responsibilities": [
      "Examine budget proposals of attached offices",
      "Prepare notes for approval of competent authority"
    ],
    "activities": [
      "Scrutinise expenditure statements",
      "Draft replies to parliamentary questions"
    ],
    "competencies": [
      {
        "type": "Behavioral",
        "theme": "Decision Making",
        "sub_theme": "Evidence-based decisions",
        "competency_id": "BEH-007",
        "proficiency_level": "Tactical",
        "proficiency_rationale": "Prepares notes for approval that require weighing op
        "delivery_mode": "Online",
        "delivery_mode_rationale": "Learning requirement is conceptual and the cadre i
      },
      {
        "type": "Domain",
        "theme": "Public Finance",
        "sub_theme": "Budget formulation",
        "competency_id": null,
        "proficiency_level": null,
        "proficiency_rationale": null,
        "delivery_mode": "Offline",
        "delivery_mode_rationale": "Requires hands-on application with budget document
      }
    ],
    "sort_order": 1,
    "igot_designation_name": "Under Secretary",
    "igot_designation_id": "DSG-00123",
    "created_at": "2026-10-14T09:40:00Z",
    "updated_at": "2026-10-14T09:45:00Z",

      "cbp_plans": [],
      "designation_approval": null
  }
```

### `POST /api/v1/role-mapping/generate`

**Generate Role Mapping (v1)** 🔒

Generate role mapping based on state/center data, department and sector. Uses AI to analyze ACBP plan and work allocation data to generate designations, roles, activities and competencies.

*Operation ID: generate_role_mapping_api_v1_role_mapping_generate_post*

**Request Body — multipart/form-data (required) — Body_generate_role_mapping_api_v1_role_mapping_generate_post**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| state_center_id | string | Yes |  | ID of the associated state/center |
| state_center_name | string | Yes |  | Name of the associated state/center |
| department_id | string \| null | No |  | ID of the associated department |
| department_name | string \| null | No |  | Name of the associated department |
| sector_name | string \| null | No | maxLength 255 | Name of the sector |
| instruction | string \| null | No |  | Additional instructions for role mapping generation |
| additional_document | array of file (binary) | No |  | Additional document(s) |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response (accepted, generation runs in background) | RoleMappingBackgroundResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 202**

```json
{
    "is_existing": false,
    "message": "Role mapping generation started",
    "status": "pending",
    "role_mappings": []
}
```

### `POST /api/v2/role-mapping/generate`

**Generate Role Mapping (v2)** 🔒

Same purpose as v1. Adds the mandatory org_type field and accepts form-urlencoded data (no sector_name , no document upload).

*Operation ID: generate_role_mapping_api_v2_role_mapping_generate_post*

**Request Body — application/x-www-form-urlencoded (required) — Body_generate_role_mapping_api_v2_role_mapping_generate_post**

| Field | Type | Required | Description |
|---|---|---|---|
| org_type | OrgType | Yes | Organization type: ministry or state |
| state_center_id | string | Yes | ID of the associated state/center |
| state_center_name | string | Yes | Name of the associated state/center |
| department_id | string \| null | No | ID of the associated department |
| department_name | string \| null | No | Name of the associated department |
| instruction | string \| null | No | Additional instructions for role mapping generation |

**Example request**

org_type=ministry&state_center_id=01379305664500633640&state_center_name=Ministry%20

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response | RoleMappingBackgroundResponse |
| 422 | Validation Error | HTTPValidationError |


### `POST /api/v3/role-mapping/generate`

**Generate Role Mapping (v3)** 🔒

Latest version of role mapping generation. Request fields are identical to v2.

*Operation ID: generate_role_mapping_api_v3_role_mapping_generate_post*

**Request Body — application/x-www-form-urlencoded (required) — Body_generate_role_mapping_api_v3_role_mapping_generate_post**

| Field | Type | Required | Description |
|---|---|---|---|
| org_type | OrgType | Yes | Organization type: ministry or state |
| state_center_id | string | Yes | ID of the associated state/center |
| state_center_name | string | Yes | Name of the associated state/center |
| department_id | string \| null | No | ID of the associated department |
| department_name | string \| null | No | Name of the associated department |
| instruction | string \| null | No | Additional instructions for role mapping generation |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response | RoleMappingBackgroundResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 202 (already generated)**

```json
{
    "is_existing": true,
    "message": "Role mappings already exist",
    "status": "success",
    "role_mappings": [ { "...": "RoleMappingResponse — see reference example" } ]
}
```

### `POST /api/v1/role-mapping/match-designations`

**Match Designations With iGOT** 🔒

Match role mapping designations against the iGOT Designation Master and update role mapping records with the matched data.

- Returns cached matches if all designations are already matched.
- Only calls the iGOT API for unmatched designations.

*Operation ID:*

match_designations_with_igot_api_v1_role_mapping_match_designations_post

**Request Body — application/json (required) — matchedDesignationsRequest**

| Field | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | ID of the state/center whose role mappings to match |
| department_id | string \| null | No | Optional department ID to narrow the scope |

**Example request**

```json
{
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | DesignationmatchedResult |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "total_designations": 12,
    "matched_count": 9,
    "already_matched": false,
    "matched_details": [
      {
        "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "igot_designation_name": "Under Secretary",
        "igot_designation_id": "DSG-00123"
      }
    ]
}
```

### `POST /api/v1/role-mapping/add-designation`

**Add Designation To Role Mapping (v1)** 🔒

Add a new designation by copying from an existing role mapping. Returns details of the newly created role mapping.

*Operation ID:*

add_designation_to_role_mapping_api_v1_role_mapping_add_designation_post

**Request Body — application/json (required) — AddDesignationToRoleMappingRequest**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| state_center_id | string | Yes |  | ID of the associated state/center |
| state_center_name | string | Yes |  | Name of the associated state/center |
| department_id | string \| null | No |  | ID of the associated department |
| department_name | string \| null | No |  | Name of the associated department |
| designation_name | string | Yes | minLength 1, maxLength 255 | New designation name |
| instruction | string \| null | No |  | Additional instructions for role mapping generation |

**Example request**

```json
{
    "state_center_id": "01379305664500633640",
    "state_center_name": "Ministry of Finance",
    "department_id": "01379305900000123456",
    "department_name": "Department of Revenue",
    "designation_name": "Assistant Section Officer",
    "instruction": "Focus on GST administration duties"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | RoleMappingWithoutCBP |
| 422 | Validation Error | HTTPValidationError |


### `POST /api/v2/role-mapping/add-designation`

**Add Designation To Role Mapping (v2)** 🔒

Version 2 of add designation. Same request and response contract as v1.

*Operation ID:*

add_designation_to_role_mapping_api_v2_role_mapping_add_designation_post

**Request Body — application/json (required) — AddDesignationToRoleMappingRequest**

(see v1 table above)

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | RoleMappingWithoutCBP |
| 422 | Validation Error | HTTPValidationError |


### `POST /api/v1/role-mapping/search`

**Search Role Mappings** 🔒

Search role mappings by designation name with pagination.

- query — optional substring search on designation_name
- filters.state_center_id / filters.department_id — optional scoping filters filters.match_status — matched or unmatched to filter data by iGOT match status. Omit to return both. Never affects the total / total_matched / total_unmatched counts, which always reflect the full filtered set.
- load_cbp_plans — whether to include CBP plan data in the response
- sort_by — e.g. {"createdOn": "desc"} . Defaults to sort_order ascending. Supported fields: createdOn , updatedOn , designationName , sortOrder .
- total_matched / total_unmatched reflect iGOT designation matching status ( igot_designation_id populated vs empty).

*Operation ID: search_role_mappings_api_v1_role_mapping_search_post*

**Request Body — application/json (required) — RoleMappingSearchRequest**

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| query | string \| null | No | — |  | Search by designation name |
| limit | integer | No | 20 | 1–100 | Number of records to return |
| offset | integer | No | 0 | ≥0 | Number of records to skip |
| load_cbp_plans | boolean | No | false |  | Include CBP plans in the response |
| filters | RoleMappingSearchFilters No \| null |  | — |  | Additional filters |
| filters.state_center_id | string | — | — |  | ID of the associated state/center |
| filters.department_id | string \| null | — | — |  | ID of the associated department |
| filters.match_status | MatchStatus \| null | — | — | matched \| unmatched | Filter data by iGOT match status |
| sort_by | object<string, string> \| null | No | sortOrder asc |  | Sort field and direction |

**Example request**

```json
{
    "query": "secretary",
    "limit": 20,
    "offset": 0,
    "load_cbp_plans": true,
    "filters": {
      "state_center_id": "01379305664500633640",
      "department_id": "01379305900000123456",
      "match_status": "matched"
    },
    "sort_by": { "createdOn": "desc" }
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RoleMappingSearchResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "total": 12,
    "total_matched": 9,
    "total_unmatched": 3,
    "data": [ { "...": "RoleMappingResponse — see reference example" } ]
}
```

### `PUT /api/v1/role-mapping/reorder`

**Reorder Designations** 🔒

Reorder designations via drag and drop. The frontend sends the new order of designations after a drag-and-drop operation; this endpoint updates the sort_order for all affected role mappings and returns the updated list in the new order.

*Operation ID: reorder_designations_api_v1_role_mapping_reorder_put*

**Request Body — application/json (required) — ReorderDesignationsRequest**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| state_center_id | string | Yes |  | ID of the associated state/center |
| department_id | string \| null | No |  | ID of the associated department |
| designations | array of DesignationOrderItem | Yes | minItems 1 | Designations with their new sort orders |
| designations[].id | string (uuid) | Yes |  | Role mapping ID |
| designations[].sort_order | integer | Yes | ≥1 | New sort order position (1- based) |

**Example request**

```json
{
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456",
    "designations": [
      { "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "sort_order": 1 },
      { "id": "16fd2706-8baf-433b-82eb-8c7fada847da", "sort_order": 2 }
    ]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — updated role mappings in new order | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/role-mapping/reorder/list`

**Get Reorder List** 🔒

Lightweight list for the drag-and-drop reorder UI. Returns only id , designation_name , wing_division_section and sort_order for COMPLETED role mappings — no role/activity/competency or CBP plan data.

*Operation ID: get_reorder_list_api_v1_role_mapping_reorder_list_get*

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | ID of the associated state/center |
| department_id | string \| null | No | ID of the associated department |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of RoleMappingReorderListItem |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
[
    {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "designation_name": "Under Secretary",
        "wing_division_section": "Budget Division",
        "sort_order": 1
    }
]
```

### `GET /api/v1/role-mapping/{role_mapping_id}`

**Get Role Mapping** 🔒

Get a specific role mapping by ID.

*Operation ID: get_role_mapping_api_v1_role_mapping__role_mapping_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | Role mapping ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RoleMappingWithoutCBP |
| 422 | Validation Error | HTTPValidationError |


### `PUT /api/v1/role-mapping/{role_mapping_id}`

**Update Role Mapping** 🔒

Update an existing role mapping. Only the fields supplied are updated.

*Operation ID: update_role_mapping_api_v1_role_mapping__role_mapping_id__put*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | UUID of the role mapping to update |

**Request Body — application/json (required) — RoleMappingUpdate**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| sector_name | string \| null | No | maxLength 255 | Name of the sector |
| instruction | string \| null | No |  | Additional instructions |
| designation_name | string \| null | No | maxLength 255 | Name of the designation from iGOT portal |
| igot_designation_id | string \| null | No | maxLength 255 | ID of the designation from iGOT portal |
| wing_division_section | string \| null | No | maxLength 255 | Wing/Division/Section name |
| role_responsibilities | array of string \| null | No |  | List of role responsibilities |
| activities | array of string \| null | No |  | List of activities |
| competencies | array of Competency- Input \| null | No |  | List of competencies |
| sort_order | integer \| null | No |  | Sort order for hierarchical arrangement |

**Example request**

```json
{
     "wing_division_section": "Budget Division",
     "role_responsibilities": [
       "Examine budget proposals of attached offices"
     ],
     "competencies": [
       {
         "type": "Functional",
         "theme": "Financial Management",
         "sub_theme": "Budgeting",
         "competency_id": "FUN-012",
         "proficiency_level": "Operational",
         "proficiency_rationale": "Routinely scrutinises expenditure statements",
         "delivery_mode": "Blended",
         "delivery_mode_rationale": "Needs both concepts and supervised practice"
       }
     ]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RoleMappingWithoutCBP |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/role-mapping/{role_mapping_id}`

**Delete Role Mapping** 🔒

Delete a role mapping. ( force_delete — force deletion even with references — is reserved for future use.)

*Operation ID: delete_role_mapping_api_v1_role_mapping__role_mapping_id__delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | UUID of the role mapping to delete |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 204 | Successful Response (no content) | — |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/role-mapping/state-center/{state_center_id}`

**Get Role Mappings By State Center** 🔒

Get all role mappings for a specific state/center.

*Operation ID:*

get_role_mappings_by_state_center_api_v1_role_mapping_state_center__state_center_i d__get

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | State/center ID |

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| load_cbp_plans | boolean | No | false | Include CBP plans in the response |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of RoleMappingResponse |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/role-mapping/state-center/{state_center_id}/department/{department_id}`

**Get Role Mappings By State Center And Department** 🔒

Get all role mappings for a specific state/center and department.

*Operation ID:*

get_role_mappings_by_state_center_and_department_api_v1_role_mapping_state_center_ _state_center_id__department__department_id__get

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | State/center ID |
| department_id | string | Yes | Department ID |

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| load_cbp_plans | boolean | No | false | Include CBP plans in the response |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of RoleMappingResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/role-mapping`

**Delete Role Mappings By State Center And Department** 🔒

Delete role mappings by state_center_id with an optional department_id filter. Returns a JSON response with the deletion count and context.

*Operation ID:*

delete_role_mappings_by_state_center_and_department_api_v1_role_mapping_delete

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | ID of the state/center |
| department_id | string \| null | No | Optional department ID to filter deletions |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | object |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "message": "Role mappings deleted successfully",
    "deleted_count": 12,
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456"
}
```

## Course Recommendations

### `POST /api/v1/course-recommendations/generate`

**Generate Course Recommendations** 🔒

Generate AI course recommendations for a role mapping. Processing is asynchronous.

*Operation ID:*

generate_course_recommendations_api_v1_course_recommendations_generate_post

**Request Body — application/json (required) — RecommendCourseCreate**

| Field | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | ID of the associated role mapping |

**Example request**

```json
{
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response (accepted) | RecommendedCourseResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 202**

```json
{
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "filtered_courses": [],
    "id": "9b2e1c3d-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "status": "IN_PROGRESS",
    "is_existing": false,
    "created_at": "2026-10-14T10:00:00Z",
    "updated_at": "2026-10-14T10:00:00Z"
}
```

### `GET /api/v1/course-recommendations/bulk-status`

**Get Bulk Course Recommendation Status** 🔒

Get the status of all in-progress course recommendations for a state/center (and optional department).

*Operation ID:*

get_bulk_course_recommendation_status_api_v1_course_recommendations_bulk_status_ge t

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | ID of the associated state/center |
| department_id | string \| null | No | ID of the associated department |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | BulkRecommendationStatusResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
     "items": [
       {
         "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
         "recommendation_id": "9b2e1c3d-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
         "status": "IN_PROGRESS"
       }
     ]
}
```

### `GET /api/v1/course-recommendations`

**Get Course Recommendations** 🔒

Get the generated course recommendations for a role mapping.

*Operation ID: get_course_recommendations_api_v1_course_recommendations_get*

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string | Yes | Role Mapping ID to fetch recommended courses |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RecommendedCourseResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
     "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
     "filtered_courses": [
       {
         "identifier": "do_11389487235614720011",
         "name": "Fundamentals of Public Financial Management",
         "relevancy": 92,
         "rationale": "Covers budget formulation required for the role"
       }
     ],
     "id": "9b2e1c3d-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
     "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
     "status": "COMPLETED",
     "is_existing": true,
     "created_at": "2026-10-14T10:00:00Z",
     "updated_at": "2026-10-14T10:03:20Z"
}
```

filtered_courses items are untyped objects in the spec; the fields shown are illustrative.

### `DELETE /api/v1/course-recommendations/role-mapping/{role_mapping_id}`

**Delete Course Recommendations By Role Mapping** 🔒

Delete all course recommendations for a specific role mapping. Removes:

1. All recommendation records from the table
2. Associated vector embeddings and course data

*Operation ID:*

delete_course_recommendations_by_role_mapping_api_v1_course_recommendations_role_m apping__role_mapping_id__delete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | UUID of the role mapping |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — deletion summary with counts and details | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/course-recommendations/{role_mapping_id}/course/{course_id}`

**Delete Course** 🔒

Delete a course. The course type is determined automatically by checking, in order:

1. Recommendations

2. Suggestions

3. User-added courses

*Operation ID:*

delete_course_api_v1_course_recommendations__role_mapping_id__course__course_id__d elete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | Role mapping ID (required to identify the context) |
| course_id | string | Yes | Course identifier — UUID for user-added courses, or identifier for recommendations/suggestions |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — deletion confirmation | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


## Course Suggestions

### `POST /api/v1/course/suggestions`

**Fetch Course From iGOT Platform** 🔒

Fetch courses from the iGOT platform. Returns course suggestions with pagination info. The request body is passed through to the iGOT search API.

*Operation ID: fetch_course_from_igot_platform_api_v1_course_suggestions_post*

**Request Body — application/json (required) — object (free-form)**

Example request (illustrative iGOT search body)

```json
{
    "request": {
      "filters": { "primaryCategory": ["Course"], "status": ["Live"] },
      "query": "public finance",
      "limit": 20,
      "offset": 0
    }
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — course suggestions with pagination info | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


### `POST /api/v1/course/suggestions/save`

**Save Course Suggestions** 🔒

Save course suggestions for a role mapping. Handles both new suggestions and updates to existing suggestions.

*Operation ID: save_course_suggestions_api_v1_course_suggestions_save_post*

**Request Body — application/json (required) — CourseSuggestionSave**

| Field | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | Role mapping ID |
| course_identifiers | array of string | Yes | List of selected course identifiers/IDs |

**Example request**

```json
{
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "course_identifiers": ["do_11389487235614720011", "do_11390012345678900022"]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created/updated) | CourseSuggestionSaveResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "course_identifiers": ["do_11389487235614720011", "do_11390012345678900022"],
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "created_at": "2026-10-14T10:10:00Z",
    "updated_at": "2026-10-14T10:10:00Z"
}
```

### `GET /api/v1/course/suggestions/{role_mapping_id}`

**Get Course Suggestions** 🔒

Get existing course suggestions for a role mapping.

*Operation ID:*

get_course_suggestions_api_v1_course_suggestions__role_mapping_id__get

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | Role mapping ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of CourseSuggestionRespose |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
[
    {
        "identifier": "do_11389487235614720011",
        "name": "Fundamentals of Public Financial Management",
        "keywords": ["budget", "public finance"],
        "description": "Introduces the budget cycle in Government of India",
        "competencies_v6": [
          {
            "competencyAreaName": "Functional",
            "competencyThemeName": "Financial Management",
            "competencySubThemeName": "Budgeting"
          }
        ],
        "language": ["english"],
        "organisation": ["Institute of Government Accounts and Finance"],
        "duration": "7200",
        "relevancy": 90
    }
]
```

### `DELETE /api/v1/course/suggestions/{role_mapping_id}`

**Delete Course Suggestions By Role Mapping** 🔒

Delete all course suggestions for a specific role mapping.

*Operation ID:*

delete_course_suggestions_by_role_mapping_api_v1_course_suggestions__role_mapping_ id__delete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | UUID of the role mapping |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | object (untyped) |
| 422 ⚠️ The endpoint declares | Validation Error description states "204 No Content 200. | HTTPValidationError on successful deletion", but the spec |


### `DELETE /api/v1/course/suggestions/{role_mapping_id}/course/{course_identifier}`

**Delete Course Suggestion** 🔒

Delete a single course from an existing course suggestion for a role mapping.

*Operation ID:*

delete_course_suggestion_api_v1_course_suggestions__role_mapping_id__course__cours e_identifier__delete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | ID of the role mapping |
| course_identifier | string | Yes | Identifier of the course to delete |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


## User Added Courses

### `POST /api/v1/user-added-courses`

**Create User Added Course** 🔒

Add a new course from external sources (Coursera, edX, Udemy, etc.) for a specific role mapping. The course is associated with the role mapping for the current user.

*Operation ID: create_user_added_course_api_v1_user_added_courses_post*

**Request Body — application/json (required) — UserAddedCourseCreate**

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| role_mapping_id | string (uuid) | Yes |  |  | ID of the associated role mapping |
| name | string | Yes |  | minLength 1, Full maxLength 500 course | name of the |
| platform | string | Yes |  | minLength 1, maxLength 100 | Platform where the course is hosted |
| public_link | string | Yes |  |  | Public URL to the specific course |
| relevancy | integer \| null | No | 90 | 0–100 | Relevancy score |
| rationale | string \| null | No |  |  | Brief explanation of why this course is essential |
| language | string \| null | No |  | maxLength 10 | Language of the course (e.g. en , hi ) |
| competencies | array of CompetencyBase \| null | No |  |  | Array of competency objects |

**Example request**

```json
{
     "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
     "name": "Financial Management for Public Sector",
     "platform": "Coursera",
     "public_link": "https://www.coursera.org/learn/example-course",
     "relevancy": 85,
     "rationale": "Strengthens budgeting and expenditure control skills",
     "language": "en",
     "competencies": [
       {
         "competencyAreaName": "Functional",
         "competencyThemeName": "Financial Management",
         "competencySubThemeName": "Budgeting"
       }
     ]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | UserAddedCourseResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "name": "Financial Management for Public Sector",
    "platform": "Coursera",
    "public_link": "https://www.coursera.org/learn/example-course",
    "relevancy": 85,
    "rationale": "Strengthens budgeting and expenditure control skills",
    "language": "en",
    "competencies": [
      {
        "competencyAreaName": "Functional",
        "competencyThemeName": "Financial Management",
        "competencySubThemeName": "Budgeting"
      }
    ],
    "id": "5d6e7f80-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
    "identifier": "5d6e7f80-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "created_at": "2026-10-14T10:20:00Z",
    "updated_at": "2026-10-14T10:20:00Z"
}
```

### `GET /api/v1/user-added-courses/role-mapping/{role_mapping_id}`

**Get User Added Courses By Role Mapping** 🔒

Retrieve all courses that the current user has added from external sources for a specific role mapping.

*Operation ID:*

get_user_added_courses_by_role_mapping_api_v1_user_added_courses_role_mapping__rol e_mapping_id__get

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | UUID of the role mapping |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of UserAddedCourseResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/user-added-courses/role-mapping/{role_mapping_id}`

**Delete All User Added Courses By Role Mapping** 🔒

Remove all courses that the current user has added from external sources for a specific role mapping.

*Operation ID:*

delete_all_user_added_courses_by_role_mapping_api_v1_user_added_courses_role_mappi ng__role_mapping_id__delete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | UUID of the role mapping |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | BulkDeleteResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "message": "All user-added courses deleted",
    "deleted_count": 3,
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

### `GET /api/v1/user-added-courses/{course_id}`

**Get User Added Course** 🔒

Get a specific user-added course by ID.

*Operation ID: get_user_added_course_api_v1_user_added_courses__course_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| course_id | string (uuid) | Yes | UUID of the user-added course |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserAddedCourseResponse |
| 422 | Validation Error | HTTPValidationError |


### `PUT /api/v1/user-added-courses/{course_id}`

**Update User Added Course** 🔒

Update a user-added course. Only supplied fields are updated.

*Operation ID: update_user_added_course_api_v1_user_added_courses__course_id__put*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| course_id | string (uuid) | Yes | UUID of the course to update |

**Request Body — application/json (required) — UserAddedCourseUpdate**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| name | string \| null | No | minLength 1, maxLength 500 | Full name of the course |
| platform | string \| null | No | minLength 1, maxLength 100 | Platform where the course is hosted |
| public_link | string \| null | No |  | Public URL to the specific course |
| relevancy | integer \| null | No | 0–100 | Relevancy score |
| rationale | string \| null | No |  | Why this course is essential |
| language | string \| null | No | maxLength 10 | Language of the course |
| competencies | array of CompetencyBase \| null | No |  | Competency objects |

**Example request**

```json
{
    "relevancy": 95,
    "rationale": "Directly aligned with budget scrutiny activities"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserAddedCourseResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/user-added-courses/{course_id}`

**Delete User Added Course** 🔒

Delete a specific user-added course.

*Operation ID: delete_user_added_course_api_v1_user_added_courses__course_id__delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| course_id | string (uuid) | Yes | UUID of the course to delete |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | CourseDeleteResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "message": "Course deleted successfully",
    "course_id": "5d6e7f80-1a2b-3c4d-5e6f-7a8b9c0d1e2f"
}
```

## CBP Plans

### `POST /api/v1/cbp-plan/save`

**Save CBP Plan** 🔒

Save a CBP (Competency-Based Program) plan with selected courses. This endpoint:

1. Fetches the latest recommendation for the role mapping

2. Extracts selected courses from filtered_courses based on course_identifiers

3. Creates the CBP plan with selected course details
4. Stores it in the table

*Operation ID: save_cbp_plan_api_v1_cbp_plan_save_post*

**Request Body — application/json (required) — CBPPlanSaveRequest**

| Field | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | Role mapping ID |
| recommended_course_id | string (uuid) | Yes | ID of the course recommendation record (spec description reads "Role mapping ID") |
| course_identifiers | array of string | Yes | Selected course identifiers/IDs from recommendations |

**Example request**

```json
{
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "recommended_course_id": "9b2e1c3d-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
    "course_identifiers": [
      "do_11389487235614720011",
      "5d6e7f80-1a2b-3c4d-5e6f-7a8b9c0d1e2f"
    ]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | CBPPlanSaveResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
     "id": "c0ffee00-1234-4abc-9def-0123456789ab",
     "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
     "created_at": "2026-10-14T10:30:00Z",
     "updated_at": "2026-10-14T10:30:00Z",
     "selected_courses": [
       {
         "identifier": "do_11389487235614720011",
         "name": "Fundamentals of Public Financial Management"
       }
     ]
}
```

### `GET /api/v1/cbp-plan`

**Get CBP Plan** 🔒

Get CBP plan details by role mapping ID.

*Operation ID: get_cbp_plan_api_v1_cbp_plan_get*

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string | Yes | Role Mapping ID to fetch CBP plan |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | CBPPlanSaveResponse |
| 422 | Validation Error | HTTPValidationError |


### `PUT /api/v1/cbp-plan/{cbp_plan_id}`

**Update CBP Plan** 🔒

Update CBP plan details. Currently supports replacing the selected courses (re-extracted from the latest recommendations).

*Operation ID: update_cbp_plan_api_v1_cbp_plan__cbp_plan_id__put*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| cbp_plan_id | string | Yes | CBP plan identifier |

**Request Body — application/json (required) — CBPPlanUpdateRequest**

| Field | Type | Required | Description |
|---|---|---|---|
| course_identifiers | array of string | Yes | Selected course identifiers/IDs from recommendations |

**Example request**

```json
{
    "course_identifiers": ["do_11389487235614720011"]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | CBPPlanSaveResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/cbp-plan/{cbp_plan_id}/course/{course_identifier}`

**Delete Course From CBP Plan** 🔒

Delete an individual course from selected_courses in a CBP plan. Returns the updated CBP plan details.

*Operation ID:*

delete_course_from_cbp_plan_api_v1_cbp_plan__cbp_plan_id__course__course_identifie r__delete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| cbp_plan_id | string (uuid) | Yes | UUID of the CBP plan |
| course_identifier | string | Yes | Identifier of the course to remove (UUID or do_xxx format) |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — updated CBP plan | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/cbp-plan/role-mapping/{role_mapping_id}`

**Delete CBP Plan By Role Mapping** 🔒

Delete the CBP plan(s) of a role mapping.

*Operation ID:*

delete_cbp_plan_by_role_mapping_api_v1_cbp_plan_role_mapping__role_mapping_id__del ete

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | ID of the role mapping |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | CBPPlanDeleteResponse |
| 404 | Role mapping not found / not owned by the user, or it has no CBP plan | — |
| 422 | Validation Error | HTTPValidationError |
| 500 | Deletion failed | — |

**Example response — 200**

```json
{
    "message": "CBP plan deleted successfully",
    "role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "deleted_count": 1
}
```

## Roles

### `POST /api/v1/roles`

**Create Role** 🔒

Create a new role with permissions. Role names must be unique across the system.

*Operation ID: create_role_api_v1_roles_post*

**Request Body — application/json (required) — RoleCreate**

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| role_name | string | Yes |  | minLength 1, maxLength 100 | Unique role name |
| description | string \| null | No |  |  | Role description |
| permissions | object \| null | No |  |  | Permission map |
| is_active | boolean | No | true |  | Active flag |

**Example request**

```json
{
    "role_name": "CBP_PLANNER",
    "description": "Creates role mappings and CBP plans",
    "permissions": { "role_mapping": ["create", "read", "update"], "cbp_plan": ["creat
    "is_active": true
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | RoleResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "role_name": "CBP_PLANNER",
    "description": "Creates role mappings and CBP plans",
    "permissions": { "role_mapping": ["create", "read", "update"], "cbp_plan": ["creat
    "is_active": true,
    "role_id": "aa11bb22-cc33-4dd4-8ee5-ff6677889900",
    "created_at": "2026-10-14T08:00:00Z",
    "updated_at": "2026-10-14T08:00:00Z"
}
```

### `GET /api/v1/roles`

**Get Roles** 🔒

Retrieve all roles in the system with user counts, with optional filtering.

*Operation ID: get_roles_api_v1_roles_get*

**Query Parameters**

| Name | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| is_active | boolean \| null | No | true |  | Filter by active status |
| skip | integer | No | 0 | ≥0 | Number of records to skip |
| limit | integer | No | 100 | 1–1000 | Maximum number of records |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of RoleResponse |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/roles/{role_id}`

**Get Role** 🔒

Get a specific role by ID.

*Operation ID: get_role_api_v1_roles__role_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_id | string (uuid) | Yes | Role ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RoleResponse |
| 422 | Validation Error | HTTPValidationError |


### `PUT /api/v1/roles/{role_id}`

**Update Role** 🔒

Update a role.

*Operation ID: update_role_api_v1_roles__role_id__put*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_id | string (uuid) | Yes | Role ID |

**Request Body — application/json (required) — RoleUpdate**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| role_name | string \| null | No | minLength 1, maxLength 100 | Role name |
| description | string \| null | No |  | Description |
| permissions | object \| null | No |  | Permission map |
| is_active | boolean \| null | No |  | Active flag |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RoleResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/roles/{role_id}`

**Delete Role** 🔒

Delete a role. Only allowed if no users are assigned to it.

*Operation ID: delete_role_api_v1_roles__role_id__delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_id | string (uuid) | Yes | Role ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


## Users

### `POST /api/v1/users`

**Create User** 🔒

Create a new user with an assigned role and optional organizational assignment.

*Operation ID: create_user_api_v1_users_post*

**Request Body — application/json (required) — UserCreate**

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| username | string | Yes |  | minLength 3, maxLength 100 | Username |
| email | string (email) | Yes |  |  | Email address |
| phone | string \| null | No |  | maxLength 20 | Phone number |
| role_id | string (uuid) | Yes |  |  | Assigned role |
| state_center_id | string \| null | No |  |  | State/center assignment |
| department_id | string \| null | No |  |  | Department assignment |
| organization_ids | array of string | No | [] |  | Organization IDs |
| is_active | boolean | No | true |  | Active flag |
| password | string | Yes |  | minLength 8 | Password (min 8 characters) |
| created_by | string (uuid) \| null | No |  |  | Creator user ID |

**Example request**

```json
{
    "username": "john.doe",
    "email": "user@example.com",
    "phone": "9876543210",
    "role_id": "aa11bb22-cc33-4dd4-8ee5-ff6677889900",
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456",
    "organization_ids": [],
    "is_active": true,
    "password": "<password>"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | UserResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "username": "john.doe",
    "email": "user@example.com",
    "phone": "9876543210",
    "role_id": "aa11bb22-cc33-4dd4-8ee5-ff6677889900",
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456",
    "organization_ids": [],
    "is_active": true,
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "last_login": null,
    "created_at": "2026-10-14T08:05:00Z",
    "updated_at": "2026-10-14T08:05:00Z",
    "role_info": { "role_name": "CBP_PLANNER" },
    "creator_info": { "username": "admin" }
}
```

### `GET /api/v1/users`

**List Users** 🔒

List users with pagination.

*Operation ID: list_users_api_v1_users_get*

**Query Parameters**

| Name | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| offset | integer | No | 0 | ≥0 | Number of items to skip |
| limit | integer | No | 10 | 1–1000 | Maximum number of items to return (page size) |
| is_active | boolean \| null | No | — |  | Filter by active status |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | PaginatedUserResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "total": 42,
    "limit": 10,
    "offset": 0,
    "data": [ { "...": "UserResponse" } ]
}
```

### `GET /api/v1/users/me`

**Get Current User** 🔒

Get the profile of the currently authenticated user.

*Operation ID: get_user_api_v1_users_me_get*

**Parameters: None**

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserResponse |


### `GET /api/v1/users/{user_id}`

**Get User** 🔒

Get a specific user by ID.

*Operation ID: get_user_api_v1_users__user_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| user_id | string (uuid) | Yes | User ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserResponse |
| 422 | Validation Error | HTTPValidationError |


### `PUT /api/v1/users/{user_id}`

**Update User** 🔒

Update a user.

*Operation ID: update_user_api_v1_users__user_id__put*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| user_id | string (uuid) | Yes | User ID |

**Request Body — application/json (required) — UserUpdate**

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| username | string \| null | No |  | minLength 3, maxLength 100 |
| email | string (email) \| null | No |  |  |
| phone | string \| null | No |  | maxLength 20 |
| role_id | string (uuid) \| null | No |  |  |
| state_center_id | string \| null | No |  |  |
| department_id | string \| null | No |  |  |
| is_active | boolean \| null | No |  |  |
| organization_ids | array of string | No | [] |  |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/users/{user_id}`

**Delete User** 🔒

Soft delete a user by setting is_active to false .

*Operation ID: delete_user_api_v1_users__user_id__delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| user_id | string (uuid) | Yes | User ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | object (untyped) |
| 422 | Validation Error | HTTPValidationError |

Documents Reference example — DocumentResponse

```json
{
    "file_id": "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
    "filename": "work_allocation_order_2026.pdf",
    "document_type": "Work Allocation Order",
    "document_name": "Work Allocation Order 2026",
    "uploader_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456",
    "summary_status": "COMPLETED",
    "last_summary_request_id": "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    "summary_text": "The order allocates the following subjects ...",
    "summary_error": null,
    "created_at": "2026-10-14T09:00:00Z",
    "updated_at": "2026-10-14T09:02:30Z"
}
```

### `POST /api/v1/files`

**Upload Files** 🔒

Upload multiple PDF files (1–10 files). Validation errors fail the entire request. Storage errors are tracked per file.

*Operation ID: upload_files_api_v1_files_post*

**Request Body — multipart/form-data (required) — Body_upload_files_api_v1_files_post**

| Field | Type | Required | Description |
|---|---|---|---|
| state_center_id | string | Yes | State/center ID |
| department_id | string \| null | No | Department ID |
| document_type | DocumentType | Yes | Work Allocation Order , Annual Reports or Other Document |
| files | array of file (binary) | Yes | 1–10 PDF files |

**Example request**

```bash
curl -X POST "https://<host>/cbp-tpc-ai/api/v1/files" \
  -H "Authorization: Bearer <token>" \
  -F "state_center_id=01379305664500633640" \
  -F "department_id=01379305900000123456" \
  -F "document_type=Work Allocation Order" \
  -F "files=@work_allocation_order_2026.pdf" \
  -F "files=@annexure.pdf"
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response | BatchUploadResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "status": "partial_success",
    "message": "1 of 2 files uploaded",
    "total_files": 2,
    "successful_count": 1,
    "failed_count": 1,
    "successful_uploads": [ { "...": "DocumentResponse" } ],
    "failed_uploads": [
      { "filename": "annexure.pdf", "error": "Storage write failed" }
    ]
}
```

### `GET /api/v1/files`

**List Files** 🔒

List uploaded files with filters.

*Operation ID: list_files_api_v1_files_get*

**Query Parameters**

| Name | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| state_center_id | string \| null | No |  |  | State/center ID |
| department_id | string \| null | No |  |  | Department ID |
| filename | string \| null | No |  |  | Exact filename filter |
| document_type | DocumentType \| null | No |  |  | Exact document type filter |
| document_name | string \| null | No |  |  | Exact document name filter |
| uploader_id | string (uuid) \| null | No |  |  | Filter by uploader |
| summary_status | string \| null | No |  |  | Summary status filter |
| include_summary | boolean | No | false |  | Include summary text |
| skip | integer | No | 0 | ≥0 | Records to skip |
| limit | integer | No | 50 | 1–200 | Records to return |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | DocumentListResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "items": [ { "...": "DocumentResponse" } ],
    "total": 5
}
```

### `GET /api/v1/files/{file_id}`

**Get File** 🔒

Get details of a single file.

*Operation ID: get_file_api_v1_files__file_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| file_id | string (uuid) | Yes | File ID |

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| include_summary | boolean | No | false | Include summary text in response |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | DocumentResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/files/{file_id}`

**Delete File** 🔒

Delete a file and its storage. Cannot delete while a summary is in progress. Meta-summaries that only referenced this file are also deleted.

*Operation ID: delete_file_api_v1_files__file_id__delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| file_id | string (uuid) | Yes | File ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | DocumentDeleteResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "message": "File deleted successfully",
    "file_id": "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
    "filename": "work_allocation_order_2026.pdf",
    "deleted_meta_summaries": ["6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e"]
}
```

### `GET /api/v1/files/{file_id}/download`

**Download File** 🔒

Download a file by file_id (reads bytes from the storage service).

*Operation ID: download_file_api_v1_files__file_id__download_get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| file_id | string (uuid) | Yes | File ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — file bytes | binary (declared as untyped JSON in spec) |
| 422 | Validation Error | HTTPValidationError |


### `POST /api/v1/files/{file_id}/summary`

**Trigger Summary** 🔒

Trigger summary generation for a file. Idempotent.

*Operation ID: trigger_summary_api_v1_files__file_id__summary_post*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| file_id | string (uuid) | Yes | File ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response (accepted) | SummaryTriggerResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 202**

```json
{
    "file_id": "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
    "request_id": "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    "summary_status": "IN_PROGRESS"
}
```

### `DELETE /api/v1/files/{file_id}/summary`

**Delete Summary** 🔒

Delete only the summary of a file, keeping the file itself.

*Operation ID: delete_summary_api_v1_files__file_id__summary_delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| file_id | string (uuid) | Yes | File ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | SummaryDeleteResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "message": "Summary deleted",
    "file_id": "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
    "filename": "work_allocation_order_2026.pdf"
}
```

### `PATCH /api/v1/files/document-type`

**Update Document Type** 🔒

Change the document_type of an already-uploaded file (Manage Document screen). Validates that the file belongs to the caller. Does not affect the summary.

*Operation ID: update_document_type_api_v1_files_document_type_patch*

**Request Body — application/x-www-form-urlencoded (required) — Body_update_document_type_api_v1_files_document_type_patch**

| Field | Type | Required | Description |
|---|---|---|---|
| file_id | string (uuid) | Yes | File ID |
| document_type | DocumentType | Yes | New document type |

**Example request**

file_id=f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b&document_type=Annual%20Reports

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | DocumentResponse |
| 422 | Validation Error | HTTPValidationError |


## Meta Summaries

### `POST /api/v1/meta-summaries`

**Create Meta Summary** 🔒

Create an aggregated summary across multiple documents. Processing is asynchronous.

*Operation ID: create_meta_summary_api_v1_meta_summaries_post*

**Request Body — application/json (required) — MetaSummaryCreateRequest**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| file_ids | array of string (uuid) | Yes | minItems 1 | List of document IDs to aggregate |

**Example request**

```json
{
    "file_ids": [
      "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
      "a9b8c7d6-e5f4-4321-9a8b-7c6d5e4f3a2b"
    ]
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 202 | Successful Response (accepted) | MetaSummaryResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 202**

```json
{
    "request_id": "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e",
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456",
    "status": "PENDING",
    "file_ids": [
      "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b",
      "a9b8c7d6-e5f4-4321-9a8b-7c6d5e4f3a2b"
    ],
    "summary_text": null,
    "error_message": null,
    "created_at": "2026-10-14T09:10:00Z",
    "updated_at": "2026-10-14T09:10:00Z"
}
```

### `GET /api/v1/meta-summaries`

**List Meta Summaries** 🔒

List all meta-summary requests with filtering and pagination.

*Operation ID: list_meta_summaries_api_v1_meta_summaries_get*

**Query Parameters**

| Name | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| status | string \| null | No |  |  | PENDING , IN_PROGRESS , COMPLETED , FAILED |
| state_center_id | string \| null | No |  |  | Filter by state center ID |
| department_id | string \| null | No |  |  | Filter by department ID |
| skip | integer | No | 0 | ≥0 | Number of items to skip |
| limit | integer | No | 50 | 1–200 | Number of items to return |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | MetaSummaryListResponse |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/meta-summaries/{request_id}`

**Get Meta Summary** 🔒

Get a single meta-summary.

*Operation ID: get_meta_summary_api_v1_meta_summaries__request_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| request_id | string (uuid) | Yes | Meta-summary request ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | MetaSummaryResponse |
| 422 | Validation Error | HTTPValidationError |


### `DELETE /api/v1/meta-summaries/{request_id}`

**Delete Meta Summary** 🔒

Delete a meta-summary by request_id .

*Operation ID: delete_meta_summary_api_v1_meta_summaries__request_id__delete*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| request_id | string (uuid) | Yes | Meta-summary request ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | MetaSummaryDeleteResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "message": "Meta summary deleted",
    "request_id": "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e"
}
```

## Dashboard

### `POST /api/v1/dashboard/cbp-summary-trends`

**CBP Summary Trends** 🔒

CBP plan count trend over time, grouped by state/center and department.

*Operation ID: cbp_summary_trends_api_v1_dashboard_cbp_summary_trends_post*

**Request Body — application/json (required) — CBPSummaryTrendRequest**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| filters | CBPSummaryTrendFilters Yes |  |  | Trend filters |
| filters.state_center_id | string \| null | No |  | State/center ID |
| filters.department_org_ids | array of string | No | [] | Department IDs |
| filters.date_range | DateRange \| null | No |  | from / to dates |
| filters.trend_granularity | string enum | No | Monthly | Monthly or Quarterly |

**Example request**

```json
{
    "filters": {
      "state_center_id": "01379305664500633640",
      "department_org_ids": ["01379305900000123456"],
      "date_range": { "from": "2026-01-01", "to": "2026-09-30" },
      "trend_granularity": "Quarterly"
    }
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | Array of CBPSummaryTrendResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
[
    {
        "state_center_id": "01379305664500633640",
        "state_center_name": "Ministry of Finance",
        "department_org_name": "Department of Revenue",
        "trend": [
          { "period": "2026-Q1", "cbp_count": 14 },
          { "period": "2026-Q2", "cbp_count": 27 },
          { "period": "2026-Q3", "cbp_count": 31 }
        ]
    }
]
```

### `POST /api/v1/dashboard/cbp-dashboard-metrics`

**Get CBP Dashboard Metrics** 🔒

System-wide CBP dashboard metrics.

*Operation ID: get_cbp_dashboard_metrics_api_v1_dashboard_cbp_dashboard_metrics_post*

**Request Body — application/json (required) — CBPDashboardFilters**

| Field | Type | Required | Description |
|---|---|---|---|
| ministries | array of string \| null | No | Ministry/state IDs |
| departments | array of string \| null | No | Department IDs |
| date_range | DateRange \| null | No | from / to dates |

**Example request**

```json
{
     "ministries": ["01379305664500633640"],
     "departments": null,
     "date_range": { "from": "2026-04-01", "to": "2026-09-30" }
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | CBPDashboardMetricsResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
     "total_users": 120,
     "users_with_role_mappings": 64,
     "total_role_mappings": 980,
     "unique_role_mappings": 410,
     "role_mappings_with_recommendations": 720,
     "saved_recommended_courses_count": 3150,
     "ministry_count": 18,
     "department_count": 52,
     "total_documents": 230,
     "total_cbp_plan_count": 600,
     "behavioral_competencies_count": 2400,
     "functional_competencies_count": 2900,
     "domain_competencies_count": 1800
}
```

### `POST /api/v1/dashboard/gap-analysis`

**Get Gap Analysis** 🔒

System-wide count of competencies that have no courses mapped.

*Operation ID: get_gap_analysis_api_v1_dashboard_gap_analysis_post*

**Request Body — application/json (required) — GapAnalysisFilters**

| Field | Type | Required | Description |
|---|---|---|---|
| ministries | array of string \| null | No | Ministry/state IDs |
| departments | array of string \| null | No | Department IDs |
| date_range | DateRange \| null | No | from / to dates |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | GapAnalysisResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "competencies_without_courses": 145,
    "behavioral_without_courses": 20,
    "functional_without_courses": 55,
    "domain_without_courses": 70
}
```

### `POST /api/v1/dashboard/my-dashboard-metrics`

**Get My Dashboard Metrics** 🔒

Metrics scoped to the logged-in user's own role mappings and CBP plans. The user ID is taken from the JWT token. Optionally filter by ministry and/or department; if omitted, all are included.

*Operation ID: get_my_dashboard_metrics_api_v1_dashboard_my_dashboard_metrics_post*

**Request Body — application/json (required) — UserDashboardFilters**

| Field | Type | Required | Description |
|---|---|---|---|
| ministries | array of string \| null | No | Ministry/state IDs |
| departments | array of string \| null | No | Department IDs |
| date_range | DateRange \| null | No | from / to dates |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserDashboardMetricsResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
     "total_role_mappings": 40,
     "unique_role_mappings": 22,
     "role_mappings_with_recommendations": 30,
     "saved_recommended_courses_count": 120,
     "ministry_count": 1,
     "department_count": 3,
     "total_documents": 9,
     "total_cbp_plan_count": 25,
     "behavioral_competencies_count": 90,
     "functional_competencies_count": 110,
     "domain_competencies_count": 70
}
```

### `POST /api/v1/dashboard/my-gap-analysis`

**Get My Gap Analysis** 🔒

Gap analysis scoped to the logged-in user's own role mappings.

*Operation ID: get_my_gap_analysis_api_v1_dashboard_my_gap_analysis_post*

**Request Body — application/json (required) — UserDashboardFilters (same fields as above)**

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | UserGapAnalysisResponse |
| 422 | Validation Error | HTTPValidationError |

Reports All report endpoints return a PDF file (declared as untyped JSON in the spec). Supported language codes: en (English, default), hi (Hindi), te (Telugu), kn (Kannada), mr (Marathi), ta (Tamil), gu (Gujarati), ml (Malayalam), or (Odia), pa (Punjabi), bn (Bengali), as (Assamese)

### `GET /api/v1/reports/course-recommendations/download`

**Download Course Recommendation Report** 🔒

Download a course recommendation report as a PDF.

*Operation ID:*

download_course_recommendation_report_api_v1_reports_course_recommendations_downlo ad_get

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| role_mapping_id | string (uuid) | Yes | Role mapping ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — PDF | binary |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/reports/cbp-plan/download`

**Download CBP Plan** 🔒

Generate and download the CBP report as a PDF with language support.

*Operation ID: download_cbp_plan_api_v1_reports_cbp_plan_download_get*

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| state_center_id | string | Yes |  | State/center ID |
| department_id | string \| null | No |  | Department ID |
| language | string | No | en | Language code for the report |

**Example request**

```http
GET /cbp-tpc-ai/api/v1/reports/cbp-plan/download?
state_center_id=01379305664500633640&language=hi
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — PDF | binary |
| 422 | Validation Error | HTTPValidationError |


### `GET /api/v1/reports/acbp-plan/download`

**Download ACBP Plan** 🔒

Generate and download the ACBP report as a PDF with language support.

*Operation ID: download_acbp_plan_api_v1_reports_acbp_plan_download_get*

**Query Parameters**

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| state_center_id | string | Yes |  | State/center ID |
| department_id | string \| null | No |  | Department ID |
| language | string | No | en | Language code for the report |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — PDF | binary |
| 422 | Validation Error | HTTPValidationError |


## Approval Requests

### `POST /api/v1/approval-requests/send`

**Send For Approval** 🔒

Submit selected role mappings for MDO Admin/Leader approval. Validates:

- All role_mapping_ids belong to the current user
- All role mappings have status COMPLETED
- All role mappings have saved CBP plans
- None are already in a pending/in-review request

Creates a snapshot of role mapping + CBP plan data in approval_request_items .

*Operation ID: send_for_approval_api_v1_approval_requests_send_post*

**Request Body — application/json (required) — SendForApprovalRequest**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| state_center_id | string | Yes | minLength 1 | State/center ID |
| department_id | string \| null | No |  | Department ID |
| role_mapping_ids | array of string (uuid) | Yes | minItems 1 | At least one role mapping must be selected |
| mdo_id | string | Yes | minLength 1 | MDO Admin/Leader ID who will receive the request |
| request_name | string | Yes | minLength 1, maxLength 100 | Request name |

**Example request**

```json
{
    "state_center_id": "01379305664500633640",
    "department_id": "01379305900000123456",
    "role_mapping_ids": [
      "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "16fd2706-8baf-433b-82eb-8c7fada847da"
    ],
    "mdo_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "request_name": "Revenue Dept CBP — Q3 2026"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | SendForApprovalResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "id": "e1d2c3b4-a5f6-4789-8abc-def012345678",
    "status": "pending",
    "designation_count": 2,
    "created_at": "2026-10-14T11:00:00Z",
    "message": "Approval request submitted successfully"
}
```

### `GET /api/v1/approval-requests/list`

**List Approval Requests** 🔒

List all approval requests submitted by the current user.

- Pagination (default 10 per page)
- Search by request_name (partial match)
- Filter by status (case-insensitive)
- Filter by date range ( from_date and to_date , inclusive)
- Default sort: latest first

*Operation ID: list_approval_requests_api_v1_approval_requests_list_get*

**Query Parameters**

| Name | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| page | integer | No | 1 | ≥1 | Page number |
| page_size | integer | No | 10 | 1–100 | Page size |
| search | string \| null | No |  | maxLength 200 | Partial match on request name |
| status | ApprovalStatus \| null | No |  |  | failed , draft , pending , approved , rejected |
| from_date | string (date) \| null | No |  | YYYY-MM- DD | From date (inclusive) |
| to_date | string (date) \| null | No |  | YYYY-MM- DD | To date (inclusive) |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | ApprovalRequestListResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "total": 3,
    "page": 1,
    "page_size": 10,
    "total_pages": 1,
    "items": [
      {
        "id": "e1d2c3b4-a5f6-4789-8abc-def012345678",
        "request_name": "Revenue Dept CBP — Q3 2026",
        "user": {
          "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
          "username": "john.doe",
          "email": "user@example.com"
        },
        "designation_count": 2,
        "status": "pending",
        "reviewer_comments": null,
        "created_at": "2026-10-14T11:00:00Z"
      }
    ]
}
```

### `GET /api/v1/approval-requests/{request_id}`

**Get Approval Request** 🔒

View full details of a submitted approval request, including all designation snapshots and course recommendations.

*Operation ID: get_approval_request_api_v1_approval_requests__request_id__get*

**Path Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| request_id | string (uuid) | Yes | Approval request ID |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | ApprovalRequestResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "id": "e1d2c3b4-a5f6-4789-8abc-def012345678",
    "request_name": "Revenue Dept CBP — Q3 2026",
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "user": {
      "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
      "username": "john.doe",
      "email": "user@example.com"
    },
    "org_type": "ministry",
    "state_center_id": "01379305664500633640",
    "state_center_name": "Ministry of Finance",
    "department_id": "01379305900000123456",
    "department_name": "Department of Revenue",
    "mdo_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "designation_count": 1,
    "status": "pending",
    "published_by": null,
    "rejected_at": null,
    "revoked_at": null,
    "created_at": "2026-10-14T11:00:00Z",
    "reviewer_comments": null,
    "items": [
      {
        "id": "0f9e8d7c-6b5a-4392-8a1b-0c9d8e7f6a5b",
        "source_role_mapping_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "designation_name": "Under Secretary",
        "wing_division_section": "Budget Division",
        "role_responsibilities": ["Examine budget proposals of attached offices"],
        "activities": ["Scrutinise expenditure statements"],
        "competencies": [
          { "type": "Behavioral", "theme": "Decision Making", "sub_theme": "Evidence-b
        ],
        "sort_order": 1,
        "igot_designation_name": "Under Secretary",
        "igot_designation_id": "DSG-00123",
        "status": "pending",
        "rejected_at": null,
        "reviewer_comments": null,
        "created_at": "2026-10-14T11:00:00Z",
        "cbp_plan_data": { "selected_courses": [] }
      }
    ]
}
```

### `POST /api/v1/approval-requests/revoke`

**Revoke Approval Request** 🔒

Revoke a pending approval request.

- Only allowed when status = pending
- Changes status to draft
- Cannot revoke approved/rejected requests

*Operation ID: revoke_approval_request_api_v1_approval_requests_revoke_post*

**Request Body — application/json (required) — RevokeApprovalRequest**

| Field | Type | Required | Description |
|---|---|---|---|
| request_id | string (uuid) | Yes | The approval request UUID |

**Example request**

```json
{
    "request_id": "e1d2c3b4-a5f6-4789-8abc-def012345678"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | RevokeApprovalResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "id": "e1d2c3b4-a5f6-4789-8abc-def012345678",
    "status": "draft",
    "revoked_at": "2026-10-14T11:15:00Z",
    "message": "Approval request revoked"
}
```

### `POST /api/v1/approval-requests/mdo-admins`

**Fetch MDO Admins** 🔒

Retrieve MDO (Ministry/Department/Organization) admins and leaders from the iGOT portal. Fetches users with MDO_ADMIN or MDO_LEADER roles for a specific department.

*Operation ID: fetch_mdo_admins_api_v1_approval_requests_mdo_admins_post*

**Request Body — application/json (optional) — object**

Default body

```json
{
     "request": {
       "filters": {
         "status": 1,
         "organisations.roles": ["MDO_LEADER", "MDO_ADMIN"],
         "rootOrgId": "department_id_placeholder"
       },
       "fields": ["firstName", "lastName", "id", "rootOrgId", "organisations", "roles"]
     }
}
```

Replace rootOrgId with the target department ID.

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | MDOAdminListResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
     "admins": [
       {
         "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
         "first_name": "Priya",
         "last_name": "Sharma",
         "role_type": "MDO_ADMIN",
         "department_name": "Department of Revenue"
       }
     ],
     "count": 1
}
```

## Designations

### `POST /api/v1/kb/designation/search`

**Search Designations** 🔒

Search iGOT designations via the Karmayogi Bharat portal API.

*Operation ID: search_designations_api_v1_kb_designation_search_post*

**Request Body — application/json (optional) — object**

Default body

```json
{
     "filterCriteriaMap": { "status": "Active" },
     "requestedFields": [],
     "pageNumber": 0,
     "pageSize": 50
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response — iGOT designation search result | object (untyped) |
| 422 | Validation Error | HTTPValidationError |


## Designation Approval

### `POST /api/v1/designation-approval/create`

**Create Designation Approval** 🔒

Send a designation name for approval (used for designations not found in the iGOT master). Duplicate check: the same rolemapping_id + user_id + designation_name + wing_division_section returns 409 Conflict.

*Operation ID: create_designation_approval_api_v1_designation_approval_create_post*

**Request Body — application/json (required) — DesignationApprovalCreate**

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| rolemapping_id | string (uuid) | Yes |  | ID of the unmatched role mapping |
| designation_name | string | Yes | minLength 1, maxLength 255 | Designation name |
| wing_division_section | string | Yes | minLength 1, maxLength 255 | Division/Wing name |

**Example request**

```json
{
    "rolemapping_id": "16fd2706-8baf-433b-82eb-8c7fada847da",
    "designation_name": "GST Facilitation Officer",
    "wing_division_section": "GST Policy Wing"
}
```

**Responses**

| Code | Description | Schema |
|---|---|---|
| 201 | Successful Response (created) | DesignationApprovalResponse |
| 409 | Duplicate designation approval request | — |
| 422 | Validation Error | HTTPValidationError |

**Example response — 201**

```json
{
    "id": "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
    "rolemapping_id": "16fd2706-8baf-433b-82eb-8c7fada847da",
    "user_id": "2c1b4f6e-8f0a-4d3a-9b1e-6a7d5c4e3f21",
    "designation_name": "GST Facilitation Officer",
    "wing_division_section": "GST Policy Wing",
    "status": "pending",
    "reviewer_comments": null,
    "actioned_by": null,
    "created_at": "2026-10-14T11:30:00Z",
    "updated_at": null
}
```

### `GET /api/v1/designation-approval/search`

**Search Designation Approvals** 🔒

Search/filter designation approval requests. All filters are optional. Always returns paginated table data.

*Operation ID: search_designation_approvals_api_v1_designation_approval_search_get*

**Query Parameters**

| Name | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| designation_name | string \| null | No |  |  | Filter by designation name (partial match) |
| status | string \| null | No |  |  | pending , approved or rejected |
| from_date | string (date) \| null | No |  | YYYY-MM- DD | From date |
| to_date | string (date) \| null | No |  | YYYY-MM- DD | To date |
| page | integer | No | 1 | ≥1 | Page number |
| page_size | integer | No | 10 | 1–100 | Page size |

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | DesignationApprovalListResponse |
| 422 | Validation Error | HTTPValidationError |

**Example response — 200**

```json
{
    "total": 1,
    "page": 1,
    "page_size": 10,
    "requests": [ { "...": "DesignationApprovalResponse" } ]
}
```

## Health

### `GET /api/v1/health`

**Health** 🔓

Service health check.

*Operation ID: health_api_v1_health_get*

**Parameters: None**

**Responses**

| Code | Description | Schema |
|---|---|---|
| 200 | Successful Response | HealthCheck |

**Example response — 200**

```json
{
     "status": "healthy",
     "version": "1.0.0",
     "timestamp": "2026-10-14T12:00:00Z"
}
```

## Schemas

Field types follow OpenAPI notation. T | null = nullable. Req = required.

### Enums

- **ApprovalStatus** — string — failed · draft · pending · approved · rejected
- **DocumentType** — string — Work Allocation Order · Annual Reports · Other Document
- **MatchStatus** — string — matched · unmatched
- **OrgType** — string — ministry · state
- **OrgTypeEnum** — string — ministry · state

### Authentication Schemas

#### Body_login_api_v1_auth_login_post

| Field | Type | Req | Constraints |
|---|---|---|---|
| username | string | ✔ | 3–255 chars |
| password | string | ✔ | min 8 chars |


#### TokenResponse

| Field | Type | Req | Description |
|---|---|---|---|
| access_token | string | ✔ | JWT access token |
| refresh_token | string | ✔ | JWT refresh token |
| token_type | string |  | Token type (default bearer ) |
| expires_in | integer | ✔ | Access token expiry time in seconds |


#### RefreshTokenRequest

| Field | Type | Req | Description |
|---|---|---|---|
| refresh_token | string | ✔ | JWT refresh token |


#### RefreshTokenResponse

| Field | Type | Req | Description |
|---|---|---|---|
| access_token | string | ✔ | New JWT access token |
| token_type | string |  | Default bearer |
| expires_in | integer | ✔ | Access token expiry time in seconds |


#### LogoutResponse

| Field | Type | Req | Description |
|---|---|---|---|
| message | string | ✔ | Logout confirmation message |


### Organisation Schemas

#### StateCenterResponse

| Field | Type | Req | Description |
|---|---|---|---|
| identifier | string | ✔ | Unique organization identifier |
| orgName | string | ✔ | Organization name |
| sbOrgType | string | ✔ | Organization type (ministry/state) |
| sbOrgSubType | string \| null |  | Organization sub-type |
| parentOrgName | string \| null |  | Parent organization name |
| orgHierarchyFrameworkId | string \| null |  | Organization hierarchy framework ID |
| orgHierarchyFrameworkStatus | string \| null |  | Hierarchy framework status |
| isRootOrg | boolean \| null |  | Is root organization |


#### DepartmentResponse

| Field | Type | Req | Description |
|---|---|---|---|
| identifier | string | ✔ | Unique department identifier |
| orgName | string | ✔ | Department/Organization name |
| description | string \| null |  | Department description |
| parentOrgName | string \| null |  | Parent organization name |
| ministryOrStateId | string \| null |  | Ministry or State ID |
| ministryOrStateType | string \| null |  | Type: ministry or state |
| ministryOrStateName | string \| null |  | Ministry or State name |
| sbOrgSubType | string \| null |  | Organization sub-type |


### State Center Data Schemas

Body_upload_state_center_documents_in_background_api_v1_state_center_data_upload_d ocuments_background_post

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | ID of the state/center |
| department_id | string \| null |  | Optional Department ID |
| acbp_plan_pdf | binary |  | ACBP Plan PDF file |
| work_allocation_pdf | binary |  | Work Allocation Order PDF file |


#### StateCenterDataResponse

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | ID of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| id | uuid | ✔ | Unique identifier |
| acbp_plan_filename | string \| null |  | ACBP Plan PDF filename |
| work_allocation_filename | string \| null |  | Work Allocation Order PDF filename |
| acbp_plan_summary | string \| null |  | AI-generated summary of ACBP Plan |
| work_allocation_order_summary | string \| null |  | AI-generated summary of Work Allocation Order |
| status | string | ✔ | Processing status |
| error_message | string \| null |  | Error details |
| created_at | date-time | ✔ | Creation timestamp |
| updated_at | date-time | ✔ | Last update timestamp |


#### FileUploadResponse

| Field | Type | Req | Description |
|---|---|---|---|
| message | string | ✔ | Upload status message |
| data | StateCenterDataResponse | ✔ | Created/updated state center data |


### Role Mapping Schemas

#### Body_generate_role_mapping_api_v1_role_mapping_generate_post

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | ID of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| state_center_name | string | ✔ | Name of the associated state/center |
| department_name | string \| null |  | Name of the associated department |
| sector_name | string \| null (≤255) |  | Name of the sector |
| instruction | string \| null |  | Additional instructions |
| additional_document | array of binary |  | Additional document(s) |


#### Body_generate_role_mapping_api_v2_role_mapping_generate_post

| Field | Type | Req | Description |
|---|---|---|---|
| org_type | OrgType | ✔ | Organization type: ministry or state |
| state_center_id | string | ✔ | ID of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| state_center_name | string | ✔ | Name of the associated state/center |
| department_name | string \| null |  | Name of the associated department |
| instruction | string \| null |  | Additional instructions |

Body_generate_role_mapping_api_v3_role_mapping_generate_post Identical to v2 body.

#### AddDesignationToRoleMappingRequest

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | ID of the associated state/center |
| state_center_name | string | ✔ | Name of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| department_name | string \| null |  | Name of the associated department |
| designation_name | string (1–255) | ✔ | New designation name |
| instruction | string \| null |  | Additional instructions |

src__schemas__role_mapping__Competency (Competency as returned in role mapping responses)

| Field | Type | Req | Description |
|---|---|---|---|
| type | string | ✔ | Type of competency (Behavioral, Functional, Domain) |
| theme | string | ✔ | Theme of the competency |
| sub_theme | string | ✔ | Sub-theme of the competency |
| competency_id | string \| null |  | KCM competency id (e.g. BEH-007 ); absent for Domain competencies |
| proficiency_level | string \| null |  | Best-fit proficiency level (Operational, Tactical, Strategic); absent for Domain |
| proficiency_rationale | string \| null |  | Justification citing the responsibility or activity that determined the level; absent for Domain |
| delivery_mode | string \| null |  | Online, Offline or Blended (Blended applies to Functional only) |
| delivery_mode_rationale | string \| null |  | Justification naming the deciding factor (learning requirement, level of application, cadre scale or institutional capability) |

Competency-Input (Competency as accepted in RoleMappingUpdate) — same fields as src__schemas__role_mapping__Competency. src__schemas__comman__Competency (Competency snapshot in approval request items)

| Field | Type | Req | Description |
|---|---|---|---|
| type | string | ✔ | Behavioral, Functional or Domain |
| theme | string | ✔ | Theme of the competency |
| sub_theme | string | ✔ | Sub-theme of the competency |


#### RoleMappingResponse

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | ID of the associated state/center |
| state_center_name | string | ✔ | Name of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| department_name | string \| null |  | Name of the associated department |
| sector_name | string \| null (≤255) |  | Name of the sector |
| instruction | string \| null |  | Additional instructions |
| id | uuid | ✔ | Unique identifier |
| user_id | uuid | ✔ | User ID |
| designation_name | string (min 1) | ✔ | Name of the designation |
| status | string | ✔ | Status |
| wing_division_section | string | ✔ | Wing/Division/Section name |
| role_responsibilities | array of string |  | Default [] |
| activities | array of string |  | Default [] |
| competencies | array of Competency |  | Default [] |
| sort_order | integer \| null |  | Sort order for hierarchical arrangement |
| igot_designation_name | string \| null |  | Designation name as in the iGOT portal |
| igot_designation_id | string \| null |  | Designation ID from the iGOT portal |
| created_at | date-time | ✔ | Creation timestamp |
| updated_at | date-time | ✔ | Last update timestamp |
| cbp_plans | array of CBPPlan |  | CBP plans for this role mapping (default [] ) |
| designation_approval | DesignationApprovalInfo \| null |  | Designation approval status |

RoleMappingWithoutCBP Same as RoleMappingResponse without cbp_plans and designation_approval . RoleMappingUpdate All fields optional.

| Field | Type | Description |
|---|---|---|
| sector_name | string \| null (≤255) | Name of the sector |
| instruction | string \| null | Additional instructions |
| designation_name | string \| null (≤255) | Name of the designation from iGOT portal |
| igot_designation_id | string \| null (≤255) | ID of the designation from iGOT portal |
| wing_division_section | string \| null (≤255) | Wing/Division/Section name |
| role_responsibilities | array of string \| null | List of role responsibilities |
| activities | array of string \| null | List of activities |
| competencies | array of Competency-Input \| null | List of competencies |
| sort_order | integer \| null | Sort order |


#### RoleMappingBackgroundResponse

| Field | Type | Req | Description |
|---|---|---|---|
| is_existing | boolean | ✔ | Whether the role mapping already existed (true) or was newly generated (false) |
| message | string | ✔ | Success or error message |
| status | string | ✔ | Operation status (e.g. success , failed , pending ) |
| role_mappings | array of RoleMappingResponse |  | Role mapping objects |


#### RoleMappingSearchFilters

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string |  | ID of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| match_status | MatchStatus \| null |  | Filter data by iGOT match status; does not affect totals |


#### RoleMappingSearchRequest

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| query | string \| null |  |  | Search by designation name |
| limit | integer (1–100) |  | 20 | Number of records to return |
| offset | integer (≥0) |  | 0 | Number of records to skip |
| load_cbp_plans | boolean |  | false | Include CBP plans |
| filters | RoleMappingSearchFilters \| null |  |  | Additional filters |
| sort_by | object<string,string> \| null |  | sortOrder asc | e.g. {"createdOn":"desc"} ; fields: createdOn, updatedOn, designationName, sortOrder |


#### RoleMappingSearchResponse

| Field | Type | Req | Description |
|---|---|---|---|
| total | integer | ✔ | Total role mappings matching query/filters |
| total_matched | integer | ✔ | Total matched with an iGOT designation |
| total_unmatched | integer | ✔ | Total not yet matched |
| data | array of RoleMappingResponse |  | Page of results |


#### RoleMappingReorderListItem

| Field | Type | Req | Description |
|---|---|---|---|
| id | uuid | ✔ | Role mapping ID |
| designation_name | string | ✔ | Name of the designation |
| wing_division_section | string | ✔ | Wing/Division/Section name |
| sort_order | integer \| null |  | Sort order |


#### DesignationOrderItem

| Field | Type | Req | Description |
|---|---|---|---|
| id | uuid | ✔ | Role mapping ID |
| sort_order | integer (≥1) | ✔ | New sort order position (1-based) |


#### ReorderDesignationsRequest

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | ID of the associated state/center |
| department_id | string \| null |  | ID of the associated department |
| designations | array of DesignationOrderItem (min 1) | ✔ | Designations with new sort orders |

matchedDesignationsRequest

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string | ✔ | State/center whose role mappings to match |
| department_id | string \| null |  | Optional department ID |


#### MatchedDesignationDetail

| Field | Type | Req |
|---|---|---|
| role_mapping_id | string | ✔ |
| igot_designation_name | string | ✔ |
| igot_designation_id | string | ✔ |


#### DesignationmatchedResult

| Field | Type | Req | Description |
|---|---|---|---|
| total_designations | integer | ✔ | Total unique designations from role mappings |
| matched_count | integer | ✔ | Number found in the iGOT portal |
| already_matched | boolean |  | True when all were already matched (default false ) |
| matched_details | array of MatchedDesignationDetail |  | Matched details |


### Designation Approval Schemas

#### DesignationApprovalCreate

| Field | Type | Req | Description |
|---|---|---|---|
| rolemapping_id | uuid | ✔ | ID of the unmatched role mapping |
| designation_name | string (1–255) | ✔ | Designation name |
| wing_division_section | string (1–255) | ✔ | Division/Wing name |


#### DesignationApprovalResponse

| Field | Type | Req |
|---|---|---|
| id | uuid | ✔ |
| rolemapping_id | uuid | ✔ |
| user_id | uuid | ✔ |
| designation_name | string | ✔ |
| wing_division_section | string | ✔ |
| status | string | ✔ |
| reviewer_comments | string \| null |  |
| actioned_by | string \| null |  |
| created_at | date-time | ✔ |
| updated_at | date-time \| null |  |


#### DesignationApprovalListResponse

| Field | Type | Req |
|---|---|---|
| total | integer | ✔ |
| page | integer | ✔ |
| page_size | integer | ✔ |
| requests | array of DesignationApprovalResponse | ✔ |


#### DesignationApprovalInfo

| Field | Type | Req | Description |
|---|---|---|---|
| rolemapping_id | uuid | ✔ | Role mapping ID |
| status | string | ✔ | pending, approved or rejected |
| reviewer_comments | string \| null |  | Reviewer comments |


### Course Schemas

#### RecommendCourseCreate

| Field | Type | Req | Description |
|---|---|---|---|
| role_mapping_id | uuid | ✔ | ID of the associated role mapping |


#### RecommendedCourseResponse

| Field | Type | Req | Description |
|---|---|---|---|
| role_mapping_id | uuid | ✔ | ID of the associated role mapping |
| filtered_courses | array of object |  | Filtered course recommendations (default [] ) |
| id | uuid | ✔ | Unique identifier |
| user_id | uuid | ✔ | User ID |
| status | string | ✔ | Status |
| is_existing | boolean |  | Whether the recommendation already existed (default false ) |
| created_at | date-time | ✔ | Creation timestamp |
| updated_at | date-time | ✔ | Last update timestamp |


#### BulkRecommendationStatusItem

| Field | Type | Req | Description |
|---|---|---|---|
| role_mapping_id | uuid | ✔ | ID of the associated role mapping |
| recommendation_id | uuid | ✔ | ID of the recommended course record |
| status | string | ✔ | Current recommendation status |


#### BulkRecommendationStatusResponse

| Field | Type | Req | Description |
|---|---|---|---|
| items | array of BulkRecommendationStatusItem |  | In-progress recommendations (default [] ) |


#### CompetencyBase

| Field | Type | Req |
|---|---|---|
| competencyAreaName | string \| null |  |
| competencyThemeName | string \| null |  |
| competencySubThemeName | string \| null |  |


#### CourseSuggestionSave

| Field | Type | Req | Description |
|---|---|---|---|
| role_mapping_id | uuid | ✔ | Role mapping ID |
| course_identifiers | array of string | ✔ | Selected course identifiers/IDs |


#### CourseSuggestionSaveResponse

| Field | Type | Req | Description |
|---|---|---|---|
| role_mapping_id | uuid | ✔ | Role mapping ID |
| course_identifiers | array of string | ✔ | Selected course identifiers |
| id | uuid | ✔ | Suggestion record ID |
| user_id | uuid | ✔ | User ID |
| created_at | date-time | ✔ | Creation timestamp |
| updated_at | date-time | ✔ | Last update timestamp |


#### CourseSuggestionRespose

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| identifier | string \| null |  |  | Course identifier |
| name | string \| null |  |  | Course name |
| keywords | array of string |  | [] | Keywords |
| description | string \| null |  |  | Description |
| competencies_v6 | array of CompetencyBase |  | [] | Competencies |
| language | array of string |  | [] | Languages |
| organisation | array of string |  | [] | Providing organisations |
| duration | string \| null |  |  | Duration |
| relevancy | integer (0–100) \| null |  | 90 | Relevancy score |


#### UserAddedCourseCreate

| Field | Type | Req | Default | Description |
|---|---|---|---|---|
| role_mapping_id | uuid | ✔ |  | ID of the associated role mapping |
| name | string (1–500) | ✔ |  | Full name of the course |
| platform | string (1–100) | ✔ |  | Platform where the course is hosted |
| public_link | string | ✔ |  | Public URL to the course |
| relevancy | integer (0–100) \| null |  | 90 | Relevancy score |
| rationale | string \| null |  |  | Why this course is essential |
| language | string (≤10) \| null |  |  | Language (e.g. en, hi) |
| competencies | array of CompetencyBase \| null |  |  | Competency objects |

UserAddedCourseUpdate Same fields as UserAddedCourseCreate except role_mapping_id ; all optional and nullable; no default for relevancy . UserAddedCourseResponse All fields of UserAddedCourseCreate, plus:

| Field | Type | Req | Description |
|---|---|---|---|
| id | uuid | ✔ | Unique identifier |
| identifier | uuid | ✔ | Course identifier |
| user_id | uuid | ✔ | User who added the course |
| created_at | date-time | ✔ | Creation timestamp |
| updated_at | date-time | ✔ | Last update timestamp |


#### BulkDeleteResponse

| Field | Type | Req | Description |
|---|---|---|---|
| message | string | ✔ | Delete operation message |
| deleted_count | integer | ✔ | Number of courses deleted |
| role_mapping_id | string | ✔ | Role mapping ID |


#### CourseDeleteResponse

| Field | Type | Req | Description |
|---|---|---|---|
| message | string | ✔ | Delete operation message |
| course_id | string | ✔ | Deleted course ID |


### CBP Plan Schemas

#### CBPPlanSaveRequest

| Field | Type | Req | Description |
|---|---|---|---|
| role_mapping_id | uuid | ✔ | Role mapping ID |
| recommended_course_id | uuid | ✔ | Recommendation record ID (spec description says "Role mapping ID") |
| course_identifiers | array of string | ✔ | Selected course identifiers/IDs |


#### CBPPlanUpdateRequest

| Field | Type | Req | Description |
|---|---|---|---|
| course_identifiers | array of string | ✔ | Selected course identifiers/IDs |


#### CBPPlan

| Field | Type | Req | Description |
|---|---|---|---|
| id | uuid | ✔ | Unique identifier |
| user_id | uuid | ✔ | User ID |
| created_at | date-time | ✔ | Creation timestamp |
| updated_at | date-time | ✔ | Last update timestamp |
| selected_courses | array of object | ✔ | Selected course details |

CBPPlanSaveResponse Same fields as CBPPlan.

#### CBPPlanDeleteResponse

| Field | Type | Req | Description |
|---|---|---|---|
| message | string | ✔ | Delete operation message |
| role_mapping_id | string | ✔ | Role mapping ID |
| deleted_count | integer | ✔ | Number of CBP plans deleted |


### Approval Request Schemas

#### SendForApprovalRequest

| Field | Type | Req | Description |
|---|---|---|---|
| state_center_id | string (min 1) | ✔ | State/center ID |
| department_id | string \| null |  | Department ID |
| role_mapping_ids | array of uuid (min 1) | ✔ | Role mappings to submit |
| mdo_id | string (min 1) | ✔ | MDO Admin/Leader ID who will receive the request |
| request_name | string (1–100) | ✔ | Request name |


#### SendForApprovalResponse

| Field | Type | Req |
|---|---|---|
| id | uuid | ✔ |
| status | ApprovalStatus | ✔ |
| designation_count | integer | ✔ |
| created_at | date-time | ✔ |
| message | string | ✔ |


#### RevokeApprovalRequest

| Field | Type | Req | Description |
|---|---|---|---|
| request_id | uuid | ✔ | The approval request UUID |


#### RevokeApprovalResponse

| Field | Type | Req |
|---|---|---|
| id | uuid | ✔ |
| status | ApprovalStatus | ✔ |
| revoked_at | date-time | ✔ |
| message | string | ✔ |


#### UserInfo

| Field | Type | Req |
|---|---|---|
| user_id | uuid | ✔ |
| username | string | ✔ |
| email | string | ✔ |


#### ApprovalRequestListItem

| Field | Type | Req |
|---|---|---|
| id | uuid | ✔ |
| request_name | string | ✔ |
| user | UserInfo \| null |  |
| designation_count | integer | ✔ |
| status | ApprovalStatus | ✔ |
| reviewer_comments | string \| null |  |
| created_at | date-time | ✔ |


#### ApprovalRequestListResponse

| Field | Type | Req |
|---|---|---|
| total | integer | ✔ |
| page | integer | ✔ |
| page_size | integer | ✔ |
| total_pages | integer | ✔ |
| items | array of ApprovalRequestListItem | ✔ |


#### ApprovalRequestItemResponse

| Field | Type | Req | Description |
|---|---|---|---|
| id | uuid | ✔ | Item ID |
| source_role_mapping_id | uuid | ✔ | Original role mapping |
| designation_name | string (min 1) | ✔ | Name of the designation |
| wing_division_section | string | ✔ | Wing/Division/Section name |
| role_responsibilities | array of string |  | Default [] |
| activities | array of string |  | Default [] |
| competencies | array of Competency |  | Default [] |
| sort_order | integer \| null |  | Sort order |
| igot_designation_name | string \| null |  | iGOT designation name |
| igot_designation_id | string \| null |  | iGOT designation ID |
| status | ApprovalStatus | ✔ | Item status |
| rejected_at | date-time \| null |  | Rejection time |
| reviewer_comments | string \| null |  | Reviewer comments |
| created_at | date-time | ✔ | Creation timestamp |
| cbp_plan_data | any \| null |  | CBP plan snapshot |


#### ApprovalRequestResponse

| Field | Type | Req | Description |
|---|---|---|---|
| id | uuid | ✔ | Request ID |
| request_name | string | ✔ | Request name |
| user_id | uuid | ✔ | Submitter |
| user | UserInfo \| null |  | Submitter details |
| org_type | string \| null |  | ministry or state |
| state_center_id | string | ✔ | State/center ID |
| state_center_name | string | ✔ | State/center name |
| department_id | string \| null |  | Department ID |
| department_name | string \| null |  | Department name |
| mdo_id | string | ✔ | Approver ID |
| designation_count | integer | ✔ | Number of designations |
| status | ApprovalStatus | ✔ | Request status |
| published_by | string \| null |  | Approver who published |
| rejected_at | date-time \| null |  | Rejection time |
| revoked_at | date-time \| null |  | Revocation time |
| created_at | date-time | ✔ | Creation timestamp |
| reviewer_comments | string \| null |  | Reviewer comments |
| items | array of ApprovalRequestItemResponse |  | Default [] |


#### MDOAdmin

| Field | Type | Req | Description |
|---|---|---|---|
| id | string | ✔ | User ID |
| first_name | string | ✔ | First name |
| last_name | string | ✔ | Last name |
| role_type | string | ✔ | MDO_ADMIN or MDO_LEADER |
| department_name | string | ✔ | Department/Organization name |


#### MDOAdminListResponse

| Field | Type | Req | Description |
|---|---|---|---|
| admins | array of MDOAdmin |  | Default [] |
| count | integer | ✔ | Total count of admins |


### Document Schemas

#### Body_upload_files_api_v1_files_post

| Field | Type | Req |
|---|---|---|
| state_center_id | string | ✔ |
| department_id | string \| null |  |
| document_type | DocumentType | ✔ |
| files | array of binary | ✔ |


#### Body_update_document_type_api_v1_files_document_type_patch

| Field | Type | Req |
|---|---|---|
| file_id | uuid | ✔ |
| document_type | DocumentType | ✔ |


#### DocumentResponse

| Field | Type | Req |
|---|---|---|
| file_id | uuid | ✔ |
| filename | string | ✔ |
| document_type | DocumentType \| null |  |
| document_name | string \| null |  |
| uploader_id | uuid \| null |  |
| state_center_id | string | ✔ |
| department_id | string \| null | ✔ (nullable) |
| summary_status | string | ✔ |
| last_summary_request_id | uuid \| null |  |
| summary_text | string \| null |  |
| summary_error | string \| null |  |
| created_at | date-time | ✔ |
| updated_at | date-time | ✔ |


#### DocumentListResponse

| Field | Type | Req |
|---|---|---|
| items | array of DocumentResponse | ✔ |
| total | integer | ✔ |


#### UploadFailure

| Field | Type | Req |
|---|---|---|
| filename | string | ✔ |
| error | string | ✔ |


#### BatchUploadResponse

| Field | Type | Req |
|---|---|---|
| status | string | ✔ |
| message | string | ✔ |
| total_files | integer | ✔ |
| successful_count | integer | ✔ |
| failed_count | integer | ✔ |
| successful_uploads | array of DocumentResponse | ✔ |
| failed_uploads | array of UploadFailure | ✔ |


#### DocumentDeleteResponse

| Field | Type | Req | Description |
|---|---|---|---|
| message | string | ✔ |  |
| file_id | uuid | ✔ |  |
| filename | string | ✔ |  |
| deleted_meta_summaries | array of string |  | Meta-summary IDs deleted because they only referenced this file (default [] ) |


#### SummaryTriggerResponse

| Field | Type | Req |
|---|---|---|
| file_id | uuid | ✔ |
| request_id | uuid | ✔ |
| summary_status | string | ✔ |


#### SummaryDeleteResponse

| Field | Type | Req |
|---|---|---|
| message | string | ✔ |
| file_id | uuid | ✔ |
| filename | string | ✔ |


#### MetaSummaryCreateRequest

| Field | Type | Req | Description |
|---|---|---|---|
| file_ids | array of uuid (min 1) | ✔ | Document IDs to aggregate |


#### MetaSummaryResponse

| Field | Type | Req |
|---|---|---|
| request_id | uuid | ✔ |
| state_center_id | string | ✔ |
| department_id | string \| null | ✔ (nullable) |
| status | string | ✔ |
| file_ids | array of uuid | ✔ |
| summary_text | string \| null |  |
| error_message | string \| null |  |
| created_at | date-time | ✔ |
| updated_at | date-time | ✔ |

MetaSummaryListItem Same as MetaSummaryResponse without error_message .

#### MetaSummaryListResponse

| Field | Type | Req |
|---|---|---|
| items | array of MetaSummaryListItem \| null | ✔ |
| total | integer | ✔ |


#### MetaSummaryDeleteResponse

| Field | Type | Req |
|---|---|---|
| message | string | ✔ |
| request_id | uuid | ✔ |


### Dashboard Schemas

#### DateRange

| Field | Type | Req |
|---|---|---|
| from | date | ✔ |
| to | date | ✔ |

CBPDashboardFilters / GapAnalysisFilters / UserDashboardFilters <a id="cbpdashboardfilters"></a><a id="gapanalysisfilters"></a><a id="userdashboardfilters"> </a>

| Field | Type | Req |
|---|---|---|
| ministries | array of string \| null |  |
| departments | array of string \| null |  |
| date_range | DateRange \| null |  |


#### CBPSummaryTrendFilters

| Field | Type | Req | Default |
|---|---|---|---|
| state_center_id | string \| null |  |  |
| department_org_ids | array of string |  | [] |
| date_range | DateRange \| null |  |  |
| trend_granularity | Monthly \| Quarterly |  | Monthly |


#### CBPSummaryTrendRequest

| Field | Type | Req |
|---|---|---|
| filters | CBPSummaryTrendFilters | ✔ |

TrendPoint

| Field | Type | Req |
|---|---|---|
| `period` | string | ✔ |
| `cbp_count` | integer | ✔ |

CBPSummaryTrendResponse

| Field | Type | Req |
|---|---|---|
| `state_center_id` | string | ✔ |
| `state_center_name` | string | ✔ |
| `department_org_name` | string \| null | ✔ (nullable) |
| `trend` | array of [TrendPoint](#trendpoint) | ✔ |

CBPDashboardMetricsResponse All fields are required integers: total_users , users_with_role_mappings , total_role_mappings , unique_role_mappings , role_mappings_with_recommendations , saved_recommended_courses_count , ministry_count , department_count , total_documents , total_cbp_plan_count , behavioral_competencies_count , functional_competencies_count , domain_competencies_count . UserDashboardMetricsResponse Same as CBPDashboardMetricsResponse without total_users and users_with_role_mappings . GapAnalysisResponse / UserGapAnalysisResponse <a id="usergapanalysisresponse"></a> All fields are required integers: competencies_without_courses , behavioral_without_courses , functional_without_courses , domain_without_courses .

### Administration Schemas

RoleCreate

| Field | Type | Req | Default |
|---|---|---|---|
| `role_name` | string (1–100) | ✔ | |
| `description` | string \| null | | |
| `permissions` | object \| null | | |
| `is_active` | boolean | | `true` |

RoleUpdate All optional: role_name (string 1–100 | null), description (string | null), permissions (object | null), is_active (boolean | null). RoleResponse All fields of RoleCreate, plus:

| Field | Type | Req |
|---|---|---|
| `role_id` | uuid | ✔ |
| `created_at` | date-time | ✔ |
| `updated_at` | date-time | ✔ |

UserCreate

| Field | Type | Req | Default |
|---|---|---|---|
| `username` | string (3–100) | ✔ | |
| `email` | email | ✔ | |
| `phone` | string (≤20) \| null | | |
| `role_id` | uuid | ✔ | |
| `state_center_id` | string \| null | | |
| `department_id` | string \| null | | |
| `organization_ids` | array of string | | `[]` |
| `is_active` | boolean | | `true` |
| `password` | string (min 8) | ✔ | |
| `created_by` | uuid \| null | | |

UserUpdate All optional: username , email , phone , role_id , state_center_id , department_id , is_active , organization_ids (default [] ). Same constraints as UserCreate. UserResponse

| Field | Type | Req | Description |
|---|---|---|---|
| `username` | string (3–100) | ✔ | |
| `email` | email | ✔ | |
| `phone` | string \| null | | |
| `role_id` | uuid | ✔ | |
| `state_center_id` | string \| null | | |
| `department_id` | string \| null | | |
| `organization_ids` | array of string | | Default `[]` |
| `is_active` | boolean | | Default `true` |
| `user_id` | uuid | ✔ | |
| `last_login` | date-time \| null | | |
| `created_at` | date-time | ✔ | |
| `updated_at` | date-time | ✔ | |
| `role_info` | object \| null | | Role details |
| `creator_info` | object<string,string> \| null | | Creator details |

PaginatedUserResponse

| Field | Type | Req |
|---|---|---|
| `total` | integer | ✔ |
| `limit` | integer | ✔ |
| `offset` | integer | ✔ |
| `data` | array of [UserResponse](#userresponse) | ✔ |

### System Schemas

HealthCheck

| Field | Type | Req |
|---|---|---|
| `status` | string | ✔ |
| `version` | string | ✔ |
| `timestamp` | string | ✔ |

HTTPValidationError

| Field | Type | Req |
|---|---|---|
| `detail` | array of [ValidationError](#validationerror) | |

ValidationError

| Field | Type | Req | Description |
|---|---|---|---|
| `loc` | array of (string \| integer) | ✔ | Location of the error (e.g. `["body","name"]`) |
| `msg` | string | ✔ | Message |
| `type` | string | ✔ | Error type |

## Error Handling

| Code | Meaning | When |
|---|---|---|
| 200 | OK | Successful read/update/delete |
| 201 | Created | Resource created (users, roles, uploads, courses, approvals) |
| 202 | Accepted | Background job started (role mapping generation, course recommendations, summaries, meta-summaries, state center uploads) |
| 204 | No Content | Successful delete with no body |
| 401 | Unauthorized | Missing, expired or invalid token |
| 404 | Not Found | Resource not found or not owned by the caller |
| 409 | Conflict | Duplicate designation approval request |
| 422 | Unprocessable Entity | Request validation failed — see [HTTPValidationError] (#httpvalidationerror) |
| 500 | Internal Server Error | Unexpected failure (e.g. CBP plan deletion failed) |

401 is not declared in the spec but applies to all 🔒 endpoints.

### Asynchronous operations

Endpoints returning 202 start background work. Poll the matching GET endpoint until the status field is complete:

| Start | Poll |
|---|---|
| `POST /api/v3/role-mapping/generate` | `POST /api/v1/role-mapping/search` or `GET /api/v1/role-mapping/state-center/{id}` |
| `POST /api/v1/course-recommendations/generate` | `GET /api/v1/course-recommendations/bulk-status` or `GET /api/v1/course-recommendations` |
| `POST /api/v1/files/{file_id}/summary` | `GET /api/v1/files/{file_id}` |
| `POST /api/v1/meta-summaries` | `GET /api/v1/meta-summaries/{request_id}` |
| `POST /api/v1/state-center-data/upload_documents_background` | `GET /api/v1/state-center-data` |

### Known spec inconsistencies

1. GET /api/v1/state-center/ — docstring says default limit 200 and mentions sbOrgType / status_filter ; actual default is 1000 and the parameter is sub_org_type .
2. Course suggestion deletes describe 204 but declare 200.
3. CBPPlanSaveRequest.recommended_course_id description reads "Role mapping ID".
4. Approval list description mentions published and in_review , which are not in the ApprovalStatus enum.
5. Schema name typo: CourseSuggestionRespose .
6. Add designation description says "copying from an existing role mapping," but the request carries no source role mapping ID.
7. Several responses (reports, downloads, deletes, iGOT pass-throughs) are declared as empty schemas.

