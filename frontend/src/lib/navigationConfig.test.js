import { buildNavigationGroups } from "@/lib/navigationConfig";

const t = (key) => key;

test.each(["international", "arabic"])("Programs navigation is available in the %s section", (schoolSection) => {
  const groups = buildNavigationGroups({ t, quarter: 1, schoolSection, roleName: "Teacher" });
  const programs = groups.find((group) => group.id === "programs");

  expect(programs).toBeTruthy();
  expect(programs.items.map((item) => item.to)).toEqual([
    "/remedial-plans",
    "/rewards",
    "/lesson-plan-generator",
  ]);
});
