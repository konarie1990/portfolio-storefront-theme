# Stage 2: Planning (`2_planning`)

## Stage Scope
This directory contains architectural specs, implementation blueprints, and styling token mappings prior to modifying theme code in `ron-hajewski-shopify-portfolio`.

## Responsibilities & Inputs
- **Direct JSON Template Blueprints:** Design the structure, section order, and block IDs for custom templates (e.g., `templates/product.<custom-handle>.json`) cloned or adapted from `templates/product.json`.
- **Tokyo Night Theme Mapping:** Specify exact CSS variable and Shopify color scheme mappings using the Tokyo Night palette:
  - Background: `#1a1b26`
  - Dark Background: `#16161e`
  - Foreground / Text: `#c0caf5`
  - Accent / Primary Blue: `#7aa2f7`
  - Purple / Secondary: `#bb9af7`
  - Cyan / Highlight: `#7dcfff`
  - Green / Success: `#9ece6a`
  - Red / Error: `#f7768e`
- **Liquid Section & Snippet Specifications:** Define schema settings, blocks, and responsive markup changes before touching production theme files.

## Expected Outputs
- Actionable implementation plans, JSON schema drafts, and verification checklists ready for `3_execution/`.
