/** Workspace-level product modules controlled by platform entitlements. */
export const WORKSPACE_MODULE_KEYS = ['inventory', 'sales', 'sales-insights'] as const;
export type WorkspaceModuleKey = (typeof WORKSPACE_MODULE_KEYS)[number];

/** Effective module access returned for the authenticated workspace. */
export interface WorkspaceModules {
  enabledModules: WorkspaceModuleKey[];
}
