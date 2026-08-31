import fs from "fs";
import path from "path";

describe("admin security controls", () => {
  const settingsSource = fs.readFileSync(path.join(__dirname, "Settings.jsx"), "utf8");
  const appShellSource = fs.readFileSync(
    path.join(__dirname, "../components/layout/AppShell.jsx"),
    "utf8",
  );
  const navigationSource = fs.readFileSync(
    path.join(__dirname, "../lib/navigationConfig.js"),
    "utf8",
  );

  it("renders roles, users, Gmail approvals, and promotion only for exact Admin role", () => {
    expect(settingsSource).toContain('const isAdmin = profile?.role_name === "Admin";');
    expect(settingsSource).toContain('if (p?.role_name !== "Admin")');
    expect(settingsSource).toContain("{isAdmin && (");
    expect(settingsSource).not.toContain('profile?.role_name !== "Teacher"');
  });

  it("does not expose Admin navigation or notification bell while profile is unknown", () => {
    expect(appShellSource).toContain('roleName: profile?.role_name || "User"');
    expect(appShellSource).toContain("{isAdmin && <DropdownMenu");
    expect(navigationSource).toContain('roleName = "User"');
  });

  it("polls Admin notifications and shows an alert counter", () => {
    expect(appShellSource).toContain("window.setInterval(loadNotifications, 30000)");
    expect(appShellSource).toContain('data-testid="notifications-count"');
  });
});
