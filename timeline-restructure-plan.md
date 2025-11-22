# Timeline Restructure Plan: Location-Based Gantt Chart

## Overview
Restructure the timeline view to show a location-based Gantt chart where:
- **Y-axis (left side)**: Shows locations (cities or nodes) based on active filters
- **X-axis (top)**: Shows time periods (months for year view, weeks for month view, days for week view)
- **Bars**: Show people at those locations during time periods, colored by role type, with names visible
- **Interaction**: Clicking a bar opens sidebar with person details

## Current Structure
- Left column: Person names
- Timeline area: Horizontal bars showing travel windows
- Side panel: Person details when selected

## New Structure
- Left column: Location names (cities or nodes)
- Timeline area: Multiple people bars per location row, showing who's where and when
- Side panel: Person details when bar is clicked

## Implementation Plan

### 1. Determine Location Rows
**File: `src/components/TimelineView.tsx`**

Create logic to determine which locations to show:
- If `filters.cities` has selections → show those cities
- If `filters.nodes` has selections → show those nodes (group people by their `primaryNode`)
- If both have selections → prioritize cities, but could show both
- If neither has selections → show all unique cities from `filteredTravelWindows`

For each location row, collect:
- Location name (city name or node name)
- All people who have travel windows at that location (or are based there if showing nodes)
- Their travel windows for that location

### 2. Group Travel Windows by Location
**File: `src/components/TimelineView.tsx`**

Create a `useMemo` hook that:
- Groups `filteredTravelWindows` by location (city or node)
- For each location, creates an array of `{ person, travelWindow }` entries
- Handles both travel windows and current locations (for nodes view)
- Sorts locations alphabetically or by filter selection order

### 3. Create Location Rows
**File: `src/components/TimelineView.tsx`**

Replace person-based rows with location-based rows:
- Each row represents one location (city or node)
- Row header shows location name
- Row body contains timeline bars for all people at that location

### 4. Render People Bars in Location Rows
**File: `src/components/TimelineView.tsx`**

For each location row:
- Calculate bar positions for each person's travel windows at that location
- Handle overlapping bars (stack vertically or show side-by-side)
- Color bars using `getRoleGradient(person.roleType)`
- Display person's name on/in the bar
- Ensure bars are touch-friendly (minimum height for mobile)

### 5. Update Bar Styling
**File: `src/components/TimelineView.tsx`**

- Bars should be tall enough to show person name clearly
- Use role-based gradient colors (already implemented)
- Add hover states for better interaction
- Ensure text is readable (contrast, size)
- Handle long names (truncate with ellipsis or tooltip)

### 6. Update Click Handler
**File: `src/components/TimelineView.tsx`**

- When a bar is clicked, set `selectedTravel` with the person and travel window
- Keep existing sidebar/Sheet component for showing details
- Sidebar should show person details (same as current implementation)

### 7. Handle Edge Cases
**File: `src/components/TimelineView.tsx`**

- Multiple people at same location/time: Stack bars vertically or show side-by-side
- Person at multiple locations: Show separate bars in different location rows
- No travel windows: Show empty row or hide location
- Current location vs travel windows: For nodes, show people's current locations if they match the node

### 8. Mobile Optimization
**File: `src/components/TimelineView.tsx`**

- Keep mobile Gantt chart structure (already implemented)
- Ensure location names are readable in narrow left column
- Make bars touch-friendly (minimum 44px height)
- Ensure horizontal scrolling works smoothly

### 9. Update Time Axis
**File: `src/components/TimelineView.tsx`**

- Keep existing time axis calculation logic
- Ensure it shows months clearly for year view
- Maintain week/day views for other granularities

## Data Structure Changes

### New Data Structure
```typescript
interface LocationRow {
  locationName: string; // City name or Node name
  locationType: 'city' | 'node';
  people: Array<{
    person: Person;
    travelWindow: TravelWindow | null; // null if showing current location
    isCurrentLocation: boolean;
  }>;
}
```

## Key Functions to Create/Modify

1. **`getLocationRows()`**: Groups travel windows by location based on filters
2. **`calculateBarPosition()`**: Keep existing, but ensure it works for new structure
3. **`renderLocationRow()`**: New function to render each location row with people bars
4. **`handleBarClick()`**: Update to work with new structure

## Files to Modify

1. **`src/components/TimelineView.tsx`**
   - Restructure component to use location-based rows
   - Update data grouping logic
   - Modify rendering to show locations on left, people bars in timeline
   - Keep sidebar/Sheet functionality

## Testing Considerations

- Test with city filters selected
- Test with node filters selected
- Test with both filters selected
- Test with no filters (show all cities)
- Test overlapping travel windows (same person, same location, overlapping times)
- Test multiple people at same location/time
- Test mobile responsiveness
- Test different granularities (Year, Month, Week)
- Test "All time" view

## Design Decisions

1. **Location Priority**: Cities take priority over nodes when both are selected
2. **Bar Overlapping**: Stack vertically when multiple people at same location/time
3. **Name Display**: Show person name inside bar, truncate if too long
4. **Empty Locations**: Hide locations with no people in the time range
5. **Current Location**: For nodes, include people whose current location matches the node

