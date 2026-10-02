# Benefit application delay / लाभ आवेदन में देरी

Department: Women & Child / महिला एवं बाल विकास
Category ID: `benefit`
SOP version: prototype-1.0
Owner: Child Development Project Officer

**Illustrative prototype procedure, not an approved government SOP or statutory deadline.**

## Scope
Complaints categorised as benefit application delay in the selected district. Verify asset ownership and jurisdiction before work.

## Expected timeline
7–14 calendar days from submission. This is an estimate for assessment and routine action, not a guaranteed outcome. Major work, procurement, permissions, weather, or missing information can extend it. This target must not delay urgent field assessment. This portal is not an emergency dispatch service.

## Procedure
1. Acknowledge the complaint, verify location, and check jurisdiction.
2. Assign a named employee and record an initial remark.
3. Verify application and documents; contact processing office; communicate decision or outstanding requirements.
4. Record progress and any delay reasons in the complaint history.
5. Add completion remarks explaining action taken; request citizen confirmation.
6. If the citizen reports that it is not resolved, reopen the same complaint for further work.
7. If no feedback arrives within seven days of completion, close automatically, recording that closure was due to no response.

## Overdue review
When the estimated upper date passes with work still open, flag the complaint as overdue and notify the responsible officers and admin once. The officer should explain the delay in a progress remark. No automatic promise of a revised date is made.

## Closure evidence
Employee name, work remarks, completion timestamp, and citizen feedback or automatic-closure reason.

## Software reference
The application reads the matching category in `backend/app/catalog.json` by ID. It snapshots the estimate, version, and this SOP reference at submission. No document retrieval, embeddings, or model inference is used for timelines. Update this file and catalog.json together when changing an estimate.
