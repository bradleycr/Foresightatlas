/**
 * Z-Index Constants
 * 
 * Centralized z-index values to prevent stacking context issues.
 * All modals and overlays should use these constants.
 * 
 * Hierarchy (lowest to highest):
 * - Base content: 0-10
 * - UI elements (buttons, cards): 10-100
 * - Dropdowns, tooltips: 100-1000
 * - Fixed headers, sidebars: 1000-2000
 * - Modals and overlays: 10000+
 */

// Base content and timeline elements
export const Z_INDEX_BASE = 0;
export const Z_INDEX_TIMELINE_BAR = 1; // Timeline bars should be low
export const Z_INDEX_TIMELINE_TOOLTIP = 2; // Tooltips above bars
export const Z_INDEX_TIMELINE_HEADER = 10; // Sticky headers

// UI elements
export const Z_INDEX_DROPDOWN = 100;
export const Z_INDEX_TOOLTIP = 200;

// Fixed elements (header must be above map controls so hamburger receives clicks)
export const Z_INDEX_HEADER = 1000;
export const Z_INDEX_SIDEBAR = 1100;
export const Z_INDEX_MAP_CONTROLS = 1200;
/** Header bar — above map "Open list" so nav and hamburger are clickable */
export const Z_INDEX_HEADER_NAV = 1300;
/** Full-screen mobile sidebar sheet — above header when list is open */
export const Z_INDEX_MOBILE_SIDEBAR_SHEET = 1400;

// Modals and overlays (must be highest)
export const Z_INDEX_MODAL_BACKDROP = 10000;
export const Z_INDEX_MODAL_CONTENT = 10001;
export const Z_INDEX_MODAL_DROPDOWN = 10002; // Dropdowns inside modals

// Loading and error overlays
export const Z_INDEX_LOADING = 10003;
export const Z_INDEX_ERROR = 10004;

