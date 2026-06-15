# T-041 Chart Comparison Modal Controls

Status: COMPLETED
Scope: frontend

## Request
Improve the chart comparison modal so users can return to report selection or generate a new filtered report after a comparison is loaded. Improve modal spacing so comparison charts do not feel cramped or overflow the modal.

## Acceptance Criteria
- Loaded comparison view exposes actions to pick another report and generate with a new filter.
- Error view keeps a path back to selection.
- Comparison modal and chart panels have clearer padding and constrained chart rendering.
- Existing comparator data flow remains unchanged.

## Result
- Added in-modal actions for selecting another comparison report or opening the new-filter flow from the comparison view.
- Added modal body spacing, framed panels, and bounded Highcharts render padding.
