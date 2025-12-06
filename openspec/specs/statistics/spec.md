## Purpose

Provides statistical data analysis and visualization for SiYuan Note usage. Users can view statistics about their documents, words, blocks, tags, backlinks, and daily writing progress through multiple view modes (day/week/month/year). The module also supports theme customization with default and GitHub-style visual options.

## Requirements

### ADDED: Theme Configuration Setting
The plugin SHALL add a new configuration option `statisticsTheme` to the PluginSettings interface with type `'default' | 'github'` and default value `'default'`.

#### Scenario: First plugin load
- **WHEN** the plugin initializes and loads settings
- **THEN** `statisticsTheme` SHALL default to `'default'`

#### Scenario: Theme persistence after page refresh
- **WHEN** user has switched to GitHub theme and refreshes the page
- **THEN** theme SHALL remain as GitHub theme

#### Scenario: Upgrade from old version
- **WHEN** user upgrades from version without `statisticsTheme` setting
- **THEN** plugin SHALL use default value `'default'` without errors

### ADDED: Theme Toggle Button
The StatisticsPanel SHALL include a theme toggle button in the panel header adjacent to the refresh button.

#### Scenario: Click theme toggle button
- **WHEN** current theme is default and user clicks toggle button
- **THEN** theme SHALL immediately switch to GitHub style
- **AND** button text SHALL update to show "GitHub"

#### Scenario: Toggle back to default
- **WHEN** current theme is GitHub and user clicks toggle button again
- **THEN** theme SHALL switch back to default style
- **AND** button text SHALL update to show "默认"

### ADDED: GitHub Theme Styling
The plugin SHALL implement GitHub-style visual design when `statisticsTheme` is set to `'github'`.

#### Scenario: Apply GitHub theme
- **WHEN** user switches to GitHub theme
- **THEN** all cards SHALL use solid colors without gradients
- **AND** background SHALL use `var(--b3-theme-background)`
- **AND** card backgrounds SHALL use `var(--b3-theme-surface)`
- **AND** accent color SHALL be `#0969da` (GitHub blue)

#### Scenario: GitHub theme readability
- **WHEN** GitHub theme is enabled
- **THEN** all text SHALL have sufficient contrast in both light and dark themes

### MODIFIED: Simplified Panel Layout
The StatisticsPanel SHALL remove the hot tags cloud and recent documents sections while preserving core statistics display.

#### Scenario: View simplified panel
- **WHEN** user opens statistics panel
- **THEN** hot tags cloud section SHALL NOT be displayed
- **AND** recent documents section SHALL NOT be displayed

#### Scenario: Core functionality verification
- **WHEN** panel is simplified
- **THEN** all core statistics (notes count, words count, blocks count, etc.) SHALL display normally

### MODIFIED: Statistics Data Optimization
The Statistics.ts SHALL optimize data fetching by removing unnecessary API calls for top tags and recent documents.

#### Scenario: Performance optimization
- **WHEN** loading statistics data after simplification
- **THEN** SHALL NOT request hot tags data
- **AND** SHALL NOT request recent documents data

### REMOVED: Hot Tags Cloud Module
The hot tags cloud functionality SHALL be completely removed from the codebase.

- HTML template: Remove `.tag-cloud-section` element
- CSS styles: Remove `.tag-cloud-section` related styles
- JavaScript: Remove `getTopTags()` data fetching logic
- TypeScript: Mark `topTags` as optional in StatisticsData interface

#### Scenario: Confirm removal
- **WHEN** codebase is searched after implementation
- **THEN** NO references to `.tag-cloud-section` SHALL exist

### REMOVED: Recent Documents Module
The recent documents functionality SHALL be completely removed from the codebase.

- HTML template: Remove `.recent-docs-section` element
- CSS styles: Remove `.recent-docs-section` related styles
- JavaScript: Remove `getRecentDocs()` data fetching logic
- TypeScript: Mark `recentDocs` as optional in StatisticsData interface
- Functions: Remove `openDocument()` if only used for this feature

#### Scenario: Confirm removal
- **WHEN** codebase is searched after implementation
- **THEN** NO references to `.recent-docs-section` SHALL exist
