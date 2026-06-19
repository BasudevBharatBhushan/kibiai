"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiClient } from "@/utils/apiClient";
import { useCompany } from "@/components/providers/CompanyProvider";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PermissionAction =
  | "generate_report"
  | "modify_template"
  | "create_template"
  | "delete_template"
  | "generate_charts"
  | "analyze_charts";

export interface ModuleAccess {
  module_id: string;
  module_name: string;
  module_code: string;
}

export interface TemplatePermission {
  report_template_id: string;
  module_id: string;
  can_generate_report: boolean;
  can_modify_template: boolean;
  can_create_template: boolean;
  can_delete_template: boolean;
  can_generate_charts: boolean;
  can_analyze_charts: boolean;
}

export interface UserRole {
  role_id: string | null;
  role_name: string;
  is_super_admin: boolean;
}

export type ViewMode = "admin" | "user";

export interface AccessControlContextType {
  /** The logged-in user's user_id in the users table */
  userId: string | null;
  /** account_id from auth_accounts / Supabase Auth */
  accountId: string | null;
  /** Role details */
  role: UserRole | null;
  /** Convenience flag — true only when role.is_super_admin */
  isSuperAdmin: boolean;
  /**
   * True when the user is superadmin OR has at least one admin-level
   * permission (modify / create / delete / analyze charts) on any template.
   */
  isAdmin: boolean;
  /** While permissions are being fetched */
  isLoading: boolean;
  /** Modules the user has been granted access to */
  moduleAccess: ModuleAccess[];
  /** Granular permissions per template */
  templatePermissions: TemplatePermission[];
  /**
   * Check a permission. If no templateId is provided, returns true when the
   * user holds that permission on at least one template.
   */
  can: (action: PermissionAction, templateId?: string) => boolean;
  /** Whether the user has access to a given module */
  hasModuleAccess: (moduleId: string) => boolean;
  /** The currently active view for the templates page */
  activeView: ViewMode;
  /** Switch view (only effective for admin/superadmin users) */
  setActiveView: (view: ViewMode) => void;
}

// ── Permission field mapping ───────────────────────────────────────────────────

const ACTION_FIELD_MAP: Record<PermissionAction, keyof TemplatePermission> = {
  generate_report: "can_generate_report",
  modify_template: "can_modify_template",
  create_template: "can_create_template",
  delete_template: "can_delete_template",
  generate_charts: "can_generate_charts",
  analyze_charts: "can_analyze_charts",
};

// ── Context ───────────────────────────────────────────────────────────────────

const AccessControlContext = createContext<AccessControlContextType | null>(
  null
);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AccessControlProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { company, isLoading: isCompanyLoading } = useCompany();
  const [userId, setUserId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess[]>([]);
  const [templatePermissions, setTemplatePermissions] = useState<
    TemplatePermission[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveViewState] = useState<ViewMode>("user");
  const [lastActivity, setLastActivity] = useState(Date.now());

  const IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    const load = async () => {
      if (isCompanyLoading) return;
      
      setIsLoading(true);
      try {
        const url = company?.id 
          ? `/api/user/permissions?company_id=${company.id}`
          : "/api/user/permissions";

        const res = await apiClient.get<{
          success: boolean;
          user: {
            user_id: string;
            account_id: string;
            role: UserRole;
            module_access: ModuleAccess[];
            template_permissions: TemplatePermission[];
          };
        }>(url);

        if (res.success && res.user) {
          const { user } = res;
          setUserId(user.user_id);
          setAccountId(user.account_id);
          setRole(user.role);
          setModuleAccess(user.module_access);
          setTemplatePermissions(user.template_permissions);

          // Default view: admin if superadmin or has any admin-level permission
          const hasSuperAdmin = user.role?.is_super_admin === true;
          const hasAdminPerm = user.template_permissions.some(
            (p) =>
              p.can_modify_template ||
              p.can_create_template ||
              p.can_delete_template ||
              p.can_analyze_charts
          );
          if (hasSuperAdmin || hasAdminPerm) {
            setActiveViewState("admin");
          }
        } else {
          // Permissions API returned but success=false — try auth/me fallback
          await fallbackToAuthMe();
        }
      } catch (err: any) {
        console.error(
          "AccessControlContext: /api/user/permissions failed —",
          err?.message || err
        );
        // API threw (401/404/500 etc.) — fall back to /api/auth/me
        // so the user at least gets the correct admin/superadmin view
        await fallbackToAuthMe();
      } finally {
        setIsLoading(false);
      }
    };

    /**
     * Fallback: read is_super_admin from /api/auth/me.
     * This sets the view to "admin" for superadmins even when the full
     * permissions API is unavailable, preventing the blank user-view bug.
     */
    const fallbackToAuthMe = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !data.user) return;

        const { user } = data;
        // Set minimal role info so isSuperAdmin/isAdmin compute correctly
        if (user.is_super_admin || user.accountType === "platform_admin") {
          setRole({
            role_id: user.role_id ?? null,
            role_name: "Superadmin",
            is_super_admin: true,
          });
          setActiveViewState("admin");
        }
      } catch (fallbackErr) {
        console.error(
          "AccessControlContext: fallback /api/auth/me also failed",
          fallbackErr
        );
      }
    };

    load();
  }, [company?.id, isCompanyLoading]);

  // ── Idle Detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, []);

  // ── Periodic Session Validation ──────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      
      // If idle for too long, validate session
      if (now - lastActivity > IDLE_THRESHOLD_MS) {
        try {
          const isValid = await apiClient.validateSession();
          if (!isValid) {
            window.location.href = "/login?reason=idle";
          }
        } catch (e) {
          // Ignore network errors, but 401 will be caught by apiClient anyway
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastActivity]);


  // ── Derived flags ─────────────────────────────────────────────────────────

  const isSuperAdmin = useMemo(
    () => role?.is_super_admin === true,
    [role]
  );

  const isAdmin = useMemo(() => {
    if (isSuperAdmin) return true;
    return templatePermissions.some(
      (p) =>
        p.can_modify_template ||
        p.can_create_template ||
        p.can_delete_template ||
        p.can_analyze_charts
    );
  }, [isSuperAdmin, templatePermissions]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const can = useCallback(
    (action: PermissionAction, templateId?: string): boolean => {
      if (isSuperAdmin) return true;
      const field = ACTION_FIELD_MAP[action];
      if (templateId) {
        const perm = templatePermissions.find(
          (p) => p.report_template_id === templateId
        );
        return perm ? Boolean(perm[field]) : false;
      }
      // No specific template: true if the user holds this permission on ANY template
      return templatePermissions.some((p) => Boolean(p[field]));
    },
    [isSuperAdmin, templatePermissions]
  );

  const hasModuleAccess = useCallback(
    (moduleId: string): boolean => {
      if (isSuperAdmin) return true;
      return moduleAccess.some((m) => m.module_id === moduleId);
    },
    [isSuperAdmin, moduleAccess]
  );

  const setActiveView = useCallback(
    (view: ViewMode) => {
      // Only admin/superadmin users may switch views
      if (isAdmin) {
        setActiveViewState(view);
      }
    },
    [isAdmin]
  );

  // ── Context value ─────────────────────────────────────────────────────────

  const value = useMemo<AccessControlContextType>(
    () => ({
      userId,
      accountId,
      role,
      isSuperAdmin,
      isAdmin,
      isLoading,
      moduleAccess,
      templatePermissions,
      can,
      hasModuleAccess,
      activeView,
      setActiveView,
    }),
    [
      userId,
      accountId,
      role,
      isSuperAdmin,
      isAdmin,
      isLoading,
      moduleAccess,
      templatePermissions,
      can,
      hasModuleAccess,
      activeView,
      setActiveView,
    ]
  );

  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAccessControl(): AccessControlContextType {
  const ctx = useContext(AccessControlContext);
  if (!ctx) {
    throw new Error(
      "useAccessControl must be used within an AccessControlProvider"
    );
  }
  return ctx;
}
