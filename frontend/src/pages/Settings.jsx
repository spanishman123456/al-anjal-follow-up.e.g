import { useEffect, useRef, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const emptyRoleForm = { name: "", description: "", permissions: "" };
const emptyUserForm = { name: "", email: "", role_id: "", username: "", password: "" };
const emptyProfileForm = { name: "", email: "", avatar_base64: "", phone: "", username: "", password: "" };
const PERMISSIONS = [
  { key: "students:view", labelKey: "students" },
  { key: "scores:edit", labelKey: "edit_scores" },
  { key: "remedial:manage", labelKey: "remedial_plans" },
  { key: "reports:view", labelKey: "reports" },
  { key: "timetable:manage", labelKey: "timetable" },
];

const ROLE_TEMPLATES = {
  Admin: {
    name: "Admin",
    description: "Full access",
    permissions: "all",
  },
  Teacher: {
    name: "Teacher",
    description: "Manage classes and students",
    permissions: "students:view, scores:edit, remedial:manage, reports:view, timetable:manage",
  },
  Counselor: {
    name: "Counselor",
    description: "Remedial and rewards",
    permissions: "remedial, rewards, reports",
  },
};

export default function Settings() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const location = useLocation();
  const profileRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [profile, setProfile] = useState(null);
  const [roleTemplate, setRoleTemplate] = useState("");
  const [promotionEnabled, setPromotionEnabled] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");

  const getPermissionLabel = (key) => {
    const found = PERMISSIONS.find((item) => item.key === key);
    return found ? t(found.labelKey) : key;
  };

  const loadData = async () => {
    try {
      const profileRes = await api.get("/users/profile");
      const p = profileRes.data;
      setProfile(p);
      setProfileForm({
        name: p?.name ?? "",
        email: p?.email ?? "",
        avatar_base64: p?.avatar_base64 ?? "",
        phone: p?.phone ?? "",
        username: p?.username ?? "",
        password: "",
      });
      if (p?.role_name === "Teacher") return;
      const [rolesRes, usersRes, promotionRes] = await Promise.all([
        api.get("/roles"),
        api.get("/users"),
        api.get("/settings/promotion"),
      ]);
      setRoles(rolesRes.data);
      setUsers(usersRes.data);
      setPromotionEnabled(Boolean(promotionRes.data?.enabled));
    } catch (error) {
      const msg = error?.response?.status === 401
        ? "Please log in again to load settings."
        : "Failed to load settings. Check that the backend is running.";
      toast.error(msg);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.search.includes("section=profile")) {
      profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.search]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({ ...prev, avatar_base64: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    const name = (profileForm.name || "").trim();
    const email = (profileForm.email || "").trim();
    const username = (profileForm.username || "").trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }
    if (!email) {
      toast.error("Email is required.");
      return;
    }
    if (!username) {
      toast.error("Username is required.");
      return;
    }
    try {
      const payload = {
        name,
        email,
        phone: (profileForm.phone || "").trim() || undefined,
        avatar_base64: profileForm.avatar_base64 || undefined,
        username,
      };
      const pwd = (profileForm.password || "").trim();
      if (pwd) payload.password = pwd;
      const response = await api.put("/users/profile/update", payload);
      const p = response.data;
      setProfile(p);
      setProfileForm({
        name: p?.name ?? "",
        email: p?.email ?? "",
        avatar_base64: p?.avatar_base64 ?? "",
        phone: p?.phone ?? "",
        username: p?.username ?? "",
        password: "",
      });
      toast.success(t("profile_updated"));
      window.dispatchEvent(new Event("profile-updated"));
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      let msg = t("profile_failed");
      if (status === 401) {
        msg = "Please log in again (backend must be running) and try saving.";
      } else if (detail && typeof detail === "string") {
        msg = detail;
      } else if (detail && Array.isArray(detail) && detail[0]?.msg) {
        msg = detail[0].msg;
      }
      toast.error(msg);
    }
  };

  const handlePromotionToggle = async (enabled) => {
    try {
      const response = await api.post("/settings/promotion", { enabled });
      setPromotionEnabled(Boolean(response.data?.enabled));
      toast.success(t("promotion_updated"));
    } catch (error) {
      toast.error(t("promotion_failed"));
    }
  };

  const openPermissionsDialog = (user) => {
    setSelectedUser(user);
    setPermissionDraft(user.permissions || []);
    setPermissionsDialogOpen(true);
  };

  const togglePermission = (permissionKey) => {
    setPermissionDraft((prev) =>
      prev.includes(permissionKey)
        ? prev.filter((item) => item !== permissionKey)
        : [...prev, permissionKey],
    );
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    try {
      await api.put(`/users/${selectedUser.id}`, { permissions: permissionDraft });
      toast.success(t("permissions_updated"));
      setPermissionsDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(t("permissions_failed"));
    }
  };

  const handleRoleCreate = async () => {
    try {
      await api.post("/roles", {
        name: roleForm.name,
        description: roleForm.description,
        permissions: roleForm.permissions
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      toast.success("Role created");
      setRoleDialogOpen(false);
      setRoleForm(emptyRoleForm);
      setRoleTemplate("");
      loadData();
    } catch (error) {
      toast.error("Failed to create role");
    }
  };

  const handleUserCreate = async () => {
    try {
      await api.post("/users", {
        name: userForm.name,
        email: userForm.email,
        role_id: userForm.role_id,
        username: userForm.username,
        password: userForm.password,
      });
      toast.success("User added");
      setUserDialogOpen(false);
      setUserForm(emptyUserForm);
      loadData();
    } catch (error) {
      toast.error("Failed to add user");
    }
  };

  const openResetDialog = (user) => {
    setSelectedUser(user);
    setResetPassword("");
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    try {
      await api.put(`/users/${selectedUser.id}/password`, { password: resetPassword });
      toast.success(t("password_updated"));
      setResetDialogOpen(false);
    } catch (error) {
      toast.error(t("password_update_failed"));
    }
  };

  const deleteRole = async (roleId) => {
    await api.delete(`/roles/${roleId}`);
    loadData();
  };

  const deleteUser = async (userId) => {
    await api.delete(`/users/${userId}`);
    loadData();
  };

  return (
    <div className="space-y-8" data-testid="settings-page">
      <PageHeader
        title={t("settings")}
        subtitle={t("overview")}
        testIdPrefix="settings"
      />

      <section className="grid gap-6" data-testid="settings-sections">
        <Card data-testid="profile-card" ref={profileRef}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("profile_settings")}</CardTitle>
            <Button
              variant="success"
              onClick={handleProfileSave}
              data-testid="profile-save-button"
            >
              {t("save_profile")}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[140px_1fr]">
            <div className="space-y-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => avatarInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && avatarInputRef.current?.click()}
                className="h-28 w-28 overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/80 transition-colors"
                data-testid="profile-avatar"
                title={t("upload_avatar")}
              >
                {profileForm.avatar_base64 ? (
                  <img
                    src={profileForm.avatar_base64}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    data-testid="profile-avatar-image"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground" data-testid="profile-avatar-placeholder">
                    {(profileForm.name || "A").charAt(0)}
                  </span>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                data-testid="profile-avatar-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                data-testid="profile-avatar-label"
              >
                {profileForm.avatar_base64 ? t("change_photo") : t("upload_avatar")}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder={t("name")}
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, name: event.target.value }))
                }
                data-testid="profile-name-input"
              />
              <Input
                placeholder={t("email")}
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                }
                data-testid="profile-email-input"
              />
              <Input
                placeholder={t("username")}
                value={profileForm.username}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, username: event.target.value }))
                }
                data-testid="profile-username-input"
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={profileForm.password}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, password: event.target.value }))
                }
                data-testid="profile-password-input"
              />
              <Input
                placeholder={t("phone")}
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                data-testid="profile-phone-input"
              />
              <Input
                value={profile?.role_name || "Admin"}
                readOnly
                data-testid="profile-role-input"
              />
            </div>
          </CardContent>
        </Card>

        {profile?.role_name !== "Teacher" && (
        <>
        <Card data-testid="promotion-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("manage_promotion")}</CardTitle>
            <div className="flex items-center gap-2" data-testid="promotion-toggle">
              <span className="text-sm text-muted-foreground">{t("promotion_enabled")}</span>
              <Switch
                checked={promotionEnabled}
                onCheckedChange={handlePromotionToggle}
                data-testid="promotion-switch"
              />
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("role_management")}</CardTitle>
            <Button onClick={() => setRoleDialogOpen(true)} data-testid="add-role-button">
              {t("add_role")}
            </Button>
          </CardHeader>
          <CardContent>
            <Table data-testid="roles-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("permissions")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id} data-testid={`role-row-${role.id}`}>
                    <TableCell data-testid={`role-name-${role.id}`}>{role.name}</TableCell>
                    <TableCell data-testid={`role-permissions-${role.id}`}>
                      {role.permissions?.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteRole(role.id)}
                        data-testid={`role-delete-${role.id}`}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("user_management")}</CardTitle>
            <Button onClick={() => setUserDialogOpen(true)} data-testid="add-user-button">
              {t("add_user")}
            </Button>
          </CardHeader>
          <CardContent>
            <Table data-testid="users-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("username")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("permissions_list")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell data-testid={`user-name-${user.id}`}>{user.name}</TableCell>
                    <TableCell data-testid={`user-username-${user.id}`}>{user.username || "—"}</TableCell>
                    <TableCell data-testid={`user-email-${user.id}`}>{user.email}</TableCell>
                    <TableCell data-testid={`user-role-${user.id}`}>{user.role_name}</TableCell>
                    <TableCell data-testid={`user-permissions-${user.id}`}>
                      <div className="flex flex-wrap gap-1">
                        {(user.permissions || []).map((permission) => (
                          <Badge key={permission} variant="secondary">
                            {getPermissionLabel(permission)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPermissionsDialog(user)}
                          data-testid={`user-permissions-edit-${user.id}`}
                        >
                          {t("edit_permissions")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openResetDialog(user)}
                          data-testid={`user-reset-${user.id}`}
                        >
                          {t("reset_password")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteUser(user.id)}
                          data-testid={`user-delete-${user.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </div>
        </>
        )}
      </section>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent data-testid="role-dialog">
          <DialogHeader>
            <DialogTitle>{t("add_role")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Select
              value={roleTemplate}
              onValueChange={(value) => {
                setRoleTemplate(value);
                const template = ROLE_TEMPLATES[value];
                if (template) {
                  setRoleForm({
                    name: template.name,
                    description: template.description,
                    permissions: template.permissions,
                  });
                }
              }}
            >
              <SelectTrigger data-testid="role-template-select">
                <SelectValue placeholder={t("select_role_type")} />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ROLE_TEMPLATES).map((key) => (
                  <SelectItem key={key} value={key} data-testid={`role-template-${key}`}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t("role")}
              value={roleForm.name}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
              data-testid="role-name"
            />
            <Input
              placeholder="Description"
              value={roleForm.description}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, description: event.target.value }))
              }
              data-testid="role-description"
            />
            <Input
              placeholder={t("permissions")}
              value={roleForm.permissions}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, permissions: event.target.value }))
              }
              data-testid="role-permissions"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} data-testid="role-cancel">
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleRoleCreate} data-testid="role-submit">
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent data-testid="user-dialog">
          <DialogHeader>
            <DialogTitle>{t("add_user")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              placeholder={t("name")}
              value={userForm.name}
              onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
              data-testid="user-name"
            />
            <Input
              placeholder={t("username")}
              value={userForm.username}
              onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
              data-testid="user-username"
            />
            <Input
              placeholder={t("email")}
              value={userForm.email}
              onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
              data-testid="user-email"
            />
            <Input
              type="password"
              placeholder={t("password")}
              value={userForm.password}
              onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
              data-testid="user-password"
            />
            <Select
              value={userForm.role_id}
              onValueChange={(value) => setUserForm((prev) => ({ ...prev, role_id: value }))}
            >
              <SelectTrigger data-testid="user-role-select">
                <SelectValue placeholder={t("role")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id} data-testid={`user-role-${role.id}`}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)} data-testid="user-cancel">
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleUserCreate} data-testid="user-submit">
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent data-testid="reset-password-dialog">
          <DialogHeader>
            <DialogTitle>{t("reset_password")}</DialogTitle>
            <DialogDescription>
              {selectedUser ? `${selectedUser.name} (${selectedUser.username})` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              type="password"
              placeholder={t("password")}
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              data-testid="reset-password-input"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              data-testid="reset-password-cancel"
            >
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleResetPassword} data-testid="reset-password-submit">
              {t("save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent data-testid="permissions-dialog">
          <DialogHeader>
            <DialogTitle>{t("edit_permissions")}</DialogTitle>
            <DialogDescription data-testid="permissions-description">
              {t("permissions_list")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {PERMISSIONS.map((permission) => (
              <label
                key={permission.key}
                className="flex items-center gap-2 text-sm"
                data-testid={`permission-option-${permission.key}`}
              >
                <input
                  type="checkbox"
                  checked={permissionDraft.includes(permission.key)}
                  onChange={() => togglePermission(permission.key)}
                  data-testid={`permission-checkbox-${permission.key}`}
                />
                {t(permission.labelKey)}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPermissionsDialogOpen(false)}
              data-testid="permissions-cancel"
            >
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={savePermissions} data-testid="permissions-save">
              {t("save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
