# Phase 3 implementation notes (internal scratch)

## What exists
- ValidationWidget with approve button + checkbox: EXISTS in AssistantContent.tsx
- handleApprovePlan listener: EXISTS in LeftPanel.tsx (calls /api/plan)
- plan stored in Zustand: EXISTS
- ReactFlow plan view: EXISTS in CenterPanel.tsx (PlanCanvas)

## What changes

### 1. Remove all mock code (devSeed.ts + Header.tsx DevSeedButton)
- Delete devSeed.ts
- Strip DevSeedButton from Header.tsx

### 2. Approval gate visual state
- Add `approved` to store selectors in CenterPanel + RightPanel
- If !approved and validation exists → show "Pending Review" overlay on BlocksCanvas + CodeView
- If approved → show real rendered content

### 3. Milestone 1 scoping of renderers
- After plan arrives, filter assignments to components in milestone[0].description
- Actually: milestone 1 is always "wire first component" — we scope to ALL m1 components
  because the plan doesn't know specific component names from our validated list
- So: M1 scope = show all current validated assignments (they ARE already M1 since we only render M1)
  The milestone plan just needs to be visible as the node graph — renderers stay same

### 4. Module H — Real approval gate label
- CenterPanel: show "PENDING REVIEW" overlay on BlocksCanvas until approved=true
- RightPanel CodeView: show "PENDING REVIEW" overlay until approved=true
- Both overlays disappear on approval click

### 5. Plan node graph improvements
- Left-to-right horizontal layout (x increments, y fixed)
- Highlight current milestone (first) node in secondary color
- Make milestone 1 clearly marked as "Active"

### 6. Input re-enable after approval
- After approval, re-enable the input box with new placeholder "Ask about milestone 1..."
- Stage: option_selected → after approval → new stage "approved"
