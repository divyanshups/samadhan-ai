# Land encroachment grievance / भूमि अतिक्रमण की शिकायत

Department: Revenue / राजस्व विभाग
Category ID: `encroachment`
SOP version: prototype-1.0
Owner: Tehsildar

**Illustrative prototype procedure, not an approved government SOP or statutory deadline.**

## Expected timeline
7–30 calendar days from submission for assessment and routine action. This is an estimate, not a guaranteed outcome. Missing information, permissions, procurement, weather or major work can extend it. Urgent field assessment must not wait for this routine target.

## Required information
Issue description, house or public landmark, area, known ward, district, locality, duration, pincode, verified contact. Citizen remarks and photos are optional. Staff may request case-specific documents separately; do not upload sensitive identity documents as complaint photos.

## Procedure
1. Acknowledge the complaint and verify jurisdiction and location.
2. Assign a named employee and record the initial remark.
3. Verify jurisdiction and submitted details; arrange the authorised revenue assessment; communicate the recorded decision.
4. Record progress and explain any delays in the complaint history.
5. Add completion remarks and request citizen confirmation.
6. Reopen the same complaint if the citizen reports that it is not resolved.
7. Close after seven days without feedback, recording the automatic-closure reason.

## Overdue review
When the estimated upper date passes and work is still open, alert the citizen, officers and admin once. The responsible officer adds a follow-up remark. This does not create a promised revised date.

## Software reference
The estimate is read directly from `backend/app/catalog.json`, using the category ID. Its dates, reference and version are saved with the complaint. Update the catalogue and this procedure together. No RAG, document search or AI timeline prediction is involved.
