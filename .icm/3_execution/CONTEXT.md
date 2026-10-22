# Stage 3: Execution (`3_execution`)

## Stage Scope
This directory tracks active implementation runs, direct theme modifications, changelog artifacts, and verification results for `ron-hajewski-shopify-portfolio`.

## Responsibilities & Execution Rules
- **Direct JSON Template & Config Editing:** Write directly to target `.json` files in `templates/` and `config/` (such as `templates/product.*.json` and `config/settings_data.json`) following the approved plans from `2_planning/`.
- **Tokyo Night Styling Application:** Apply the standard Tokyo Night hex constants (`#1a1b26`, `#16161e`, `#c0caf5`, `#7aa2f7`, `#bb9af7`, `#7dcfff`, `#9ece6a`, `#f7768e`) accurately across theme color schemes and CSS assets.
- **Validation & Reality Checks:** Ensure all JSON templates are syntactically valid, every referenced section exists in `sections/`, and block structures match section `{% schema %}` definitions.

## Expected Outputs
- Execution logs, diff summaries, validation reports, and post-implementation verification notes.
