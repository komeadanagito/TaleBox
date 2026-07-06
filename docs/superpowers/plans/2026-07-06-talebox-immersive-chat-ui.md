# TaleBox Immersive Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the existing TaleBox Pencil file into a rounded, milky-white immersive chat-novel mobile interface.

**Architecture:** Modify only `docs/pen_file/talebox.pen` through Pencil MCP tools. Rebuild the four existing top-level frames with a shared visual language and validate each screen after editing.

**Tech Stack:** Pencil `.pen` design file, Pencil MCP `batch_design`, `snapshot_layout`, and `get_screenshot`.

---

### Task 1: Establish Shared Design Language

**Files:**
- Modify: `docs/pen_file/talebox.pen`

- [ ] Create semantic variables for surface, text, border, accent, chat bubble, muted icon, and rounded corner values.
- [ ] Use milky-white background, dark ink text, muted metadata text, and soft violet accents.
- [ ] Use rounded values for cards, search fields, buttons, avatars, and tab bar.

### Task 2: Redesign Dialogue Screen

**Files:**
- Modify: `docs/pen_file/talebox.pen`

- [ ] Replace the existing absolute-positioned Dialogue screen content with a cleaner rounded layout.
- [ ] Add status/header region, rounded search, a pinned small chat card, normal private conversation rows, and rounded floating tab bar.
- [ ] Verify the screen has no clipped content and the active tab is Dialogue.

### Task 3: Redesign Bookshelf Screen

**Files:**
- Modify: `docs/pen_file/talebox.pen`

- [ ] Replace the Bookshelf screen with private story-management rows and rounded utility cards.
- [ ] Keep update reminder, world setting, and three story rows.
- [ ] Verify no social or public discovery patterns appear.

### Task 4: Redesign AI Creation Screen

**Files:**
- Modify: `docs/pen_file/talebox.pen`

- [ ] Replace clipped text with shorter wrapped descriptions.
- [ ] Present story generation and local import as rounded creation cards.
- [ ] Add a private draft row and verify all text fits.

### Task 5: Redesign Me Screen

**Files:**
- Modify: `docs/pen_file/talebox.pen`

- [ ] Replace social-profile framing with private reading records and settings.
- [ ] Keep stats and a small set of settings rows, using rounded cards and quiet metadata.
- [ ] Remove creation/draft management from the Me page; keep creation on the AI Creation page.
- [ ] Verify the page does not imply public profile, follower, feed, or achievement behavior.

### Task 6: Final Verification

**Files:**
- Inspect: `docs/pen_file/talebox.pen`

- [ ] Run `snapshot_layout` for layout problems.
- [ ] Capture a document screenshot.
- [ ] Fix any clipped, collapsed, or misaligned nodes directly in place.
