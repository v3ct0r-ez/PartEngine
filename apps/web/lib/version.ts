// Single source of truth for the version shown in the web UI. The desktop build
// reports its real (tag-derived) version through `window.partengine.version`;
// this constant is the fallback used in the browser / dev. Keep it in sync with
// the workspace package.json versions.
export const APP_VERSION = '0.0.1';
