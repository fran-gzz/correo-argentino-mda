import { test, expect } from "@playwright/test";

test.describe("Office badge copy behavior", () => {
  test("clicking the office code badge copies text and does not expand row", async ({ page }) => {
    await page.goto("/oficinas");
    await page.waitForSelector("[data-master-detail-sort-item]");

    // Find the first CopyButton inside an office master row
    const badge = page.locator("[data-office-master-row] [data-copy-control]").first();
    await expect(badge).toBeVisible();

    // Get the parent row for verifying toggle state
    const row = page.locator("[data-office-master-row]").first();
    const rowAriaExpandedBefore = await row.getAttribute("aria-expanded");

    // Click the badge to trigger copy
    await badge.click();

    // Wait for the success feedback (ring-success class appears on the button)
    await expect(badge).toHaveClass(/ring-success/);

    // Verify row was NOT toggled (aria-expanded unchanged)
    const rowAriaExpandedAfter = await row.getAttribute("aria-expanded");
    expect(rowAriaExpandedAfter).toBe(rowAriaExpandedBefore);

    // Verify the checkmark icon is visible after click
    const checkIcon = badge.locator("[data-copy-icon-success]");
    await expect(checkIcon).toBeVisible();

    // Wait for the feedback timeout (1800ms + buffer)
    await page.waitForTimeout(2200);

    // Verify the checkmark icon is hidden again after reset
    await expect(checkIcon).toBeHidden();

    // Verify the label text is visible again (not invisible)
    const label = badge.locator("[data-copy-label]");
    await expect(label).not.toHaveClass(/invisible/);
  });
});
