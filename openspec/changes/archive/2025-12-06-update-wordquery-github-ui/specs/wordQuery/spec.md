## MODIFIED Requirements

### Requirement: Word Query Panel UI Design
The WordQueryPanel component SHALL adopt GitHub's design language for all visual elements while maintaining existing functionality.

#### Scenario: GitHub-style tab navigation
- **WHEN** the component renders the mode tabs (word query/translate)
- **THEN** the tabs SHALL use GitHub's underline style indicator with no background color
- **AND** the active tab SHALL have a blue (#0969da) bottom border
- **AND** hover states SHALL show subtle background color changes

#### Scenario: GitHub-style input fields
- **WHEN** rendering input fields for word search and translation
- **THEN** inputs SHALL have flat white backgrounds with gray borders
- **AND** focus states SHALL show blue border (#0969da) with no shadows
- **AND** placeholder text SHALL use GitHub's gray color (#656d76)

#### Scenario: GitHub-style buttons
- **WHEN** rendering action buttons (copy, favorite, play, export)
- **THEN** buttons SHALL have flat backgrounds without gradients
- **AND** primary actions SHALL use GitHub blue (#0969da)
- **AND** hover states SHALL provide subtle background darkening
- **AND** no box shadows SHALL be used

#### Scenario: GitHub-style cards and containers
- **WHEN** rendering result panels, history panels, or favorites
- **THEN** containers SHALL have flat white backgrounds
- **AND** borders SHALL use GitHub's gray (#d0d7de)
- **AND** no drop shadows SHALL be applied
- **AND** border radius SHALL be 6px (GitHub standard)

#### Scenario: GitHub-style loading states
- **WHEN** showing loading indicators
- **THEN** spinners SHALL use GitHub blue (#0969da)
- **AND** animations SHALL match GitHub's timing (ease-in-out, 1s duration)
- **AND** no glowing effects or shadows SHALL be used

#### Scenario: GitHub-style color usage
- **WHEN** applying colors to different UI elements
- **THEN** primary actions SHALL use blue (#0969da)
- **AND** success states SHALL use green (#1a7f37)
- **AND** danger states SHALL use red (#cf222e)
- **AND** warning states SHALL use yellow (#9a6700)
- **AND** gradients SHALL NOT be used

#### Scenario: GitHub-style typography
- **WHEN** rendering text content
- **THEN** font family SHALL be -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif
- **AND** base font size SHALL be 14px
- **AND** font weights SHALL use 400 (normal), 500 (medium), or 600 (semibold)
- **AND** line height SHALL be 1.5

#### Scenario: GitHub-style spacing
- **WHEN** applying spacing between elements
- **THEN** base spacing unit SHALL be 8px
- **AND** padding SHALL use multiples of 8px
- **AND** margins SHALL use multiples of 8px
- **AND** consistent spacing SHALL be maintained throughout

#### Scenario: Maintaining functionality
- **WHEN** users interact with any UI element
- **THEN** all existing functionality SHALL remain unchanged
- **AND** all event handlers SHALL work as before
- **AND** keyboard navigation SHALL be preserved
- **AND** accessibility features SHALL be maintained or improved