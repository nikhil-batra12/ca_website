import { test } from "@playwright/test";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import ALL_CREDENTIALS from "./credentials.json" with { type: "json" };

const GST_CONFIG = {
  loginUrl: "https://services.gst.gov.in/services/login",
  timeout: 60000,
};

test.describe("GSTR1 Offline Download Automation", () => {
  test.setTimeout(300000);

  for (const cred of ALL_CREDENTIALS) {
    test(`GSTR1 Offline Download - ${cred.username}`, async ({ page }) => {
      const Credentials = cred;

      // ── Login ──────────────────────────────────────────────────────────────
      await page.goto(GST_CONFIG.loginUrl, {
        waitUntil: "networkidle",
        timeout: GST_CONFIG.timeout,
      });
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const loginForm = page.locator('form[name="loginform"]');
      await loginForm.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });

      const usernameField = page.locator("#username").first();
      await usernameField.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
      await usernameField.fill(Credentials.username);
      await page.waitForTimeout(1000);

      let visiblePasswordField = page.locator('input#user_pass[type="password"]').first();
      if (!(await visiblePasswordField.isVisible().catch(() => false))) {
        const all = page.locator('input[type="password"][name="user_pass"]');
        const count = await all.count();
        for (let i = 0; i < count; i++) {
          const f = all.nth(i);
          if (await f.isVisible()) { visiblePasswordField = f; break; }
        }
      }
      await visiblePasswordField.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
      await visiblePasswordField.fill(Credentials.password);
      await page.waitForTimeout(1000);

      // CAPTCHA handling
      const captchaVisible = await page.locator("#captcha").isVisible().catch(() => false);
      if (captchaVisible) {
        console.log("⚠️ CAPTCHA detected — fill it in and click Login manually");
        await page.waitForURL((url) => !url.href.includes("/services/login"), {
          timeout: 300000,
        });
        console.log("✅ Login detected — continuing");
      } else {
        const loginButton = page
          .locator('button[type="submit"]:has-text("Login"), button.btn-primary:has-text("Login")')
          .first();
        await loginButton.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
        await loginButton.click();
        console.log("✅ Login button clicked");
      }

      await page.waitForTimeout(3000);
      await page.waitForURL(/^(?!.*\/services\/login).*$/, { timeout: 10000 }).catch(() => {});

      // Aadhaar modal
      const modal = page.locator(".modal-dialog.sweet, .modal-dialog").first();
      if (await modal.isVisible().catch(() => false)) {
        const remindBtn = modal
          .locator('a.btn-primary:has-text("Remind me later"), button:has-text("Remind me later"), a[ng-click="cancelcallback()"]')
          .first();
        if (await remindBtn.isVisible().catch(() => false)) {
          await remindBtn.click({ timeout: 10000 }).catch(() => remindBtn.evaluate((el) => el.click()));
          await page.waitForTimeout(2000);
        }
      }

      // ── Return Dashboard ───────────────────────────────────────────────────
      await page.waitForLoadState("domcontentloaded");
      const returnDashboardBtn = page.locator('button:has(span[title="Return Dashboard"])').first();
      try {
        await returnDashboardBtn.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
        await returnDashboardBtn.click({ timeout: 10000 });
        console.log('✅ Clicked Return Dashboard');
        await page.waitForTimeout(3000);
      } catch (error) {
        await returnDashboardBtn.evaluate((el) => el.click());
        await page.waitForTimeout(3000);
      }

      // ── Downloads directory ────────────────────────────────────────────────
      const downloadsDir = path.join(process.cwd(), "downloads", Credentials.username);
      fs.mkdirSync(downloadsDir, { recursive: true });
      console.log(`📁 Saving to: downloads/${Credentials.username}/`);

      // ── Dropdown helper ────────────────────────────────────────────────────
      const selectDropdown = async (selector, label, waitForSelector = null) => {
        const el = page.locator(selector).first();
        await el.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
        await el.selectOption({ label });
        if (waitForSelector) {
          await page.waitForFunction(
            (sel) => (document.querySelector(sel)?.options.length ?? 0) >= 1,
            waitForSelector,
            { timeout: GST_CONFIG.timeout },
          );
        }
        await page.waitForTimeout(1000);
      };

      // ── Quarter / Month loop ───────────────────────────────────────────────
      await selectDropdown('select[name="fin"]', "2025-26", 'select[name="quarter"]');
      const availableQuarters = await page.$$eval(
        'select[name="quarter"] option',
        (opts) => opts.map((o) => o.label).filter((l) => l.trim() !== ""),
      );
      console.log(`📋 Available quarters: ${availableQuarters.join(", ")}`);

      for (const quarter of availableQuarters) {
        console.log(`\n📋 ===== Quarter: ${quarter} =====`);

        await selectDropdown('select[name="fin"]', "2025-26", 'select[name="quarter"]');
        await selectDropdown('select[name="quarter"]', quarter, 'select[name="mon"]');

        const availableMonths = await page.$$eval(
          'select[name="mon"] option',
          (opts) => opts.map((o) => o.label).filter((l) => l.trim() !== ""),
        );
        console.log(`📋 Months: ${availableMonths.join(", ")}`);

        if (availableMonths.length === 0) {
          console.log(`⏭️ No months for ${quarter} — skipping`);
          continue;
        }

        for (const month of availableMonths) {
          console.log(`\n📋 ===== Processing: ${quarter} - ${month} =====`);

          try {
            await selectDropdown('select[name="fin"]', "2025-26", 'select[name="quarter"]');
            await selectDropdown('select[name="quarter"]', quarter, 'select[name="mon"]');
            await selectDropdown('select[name="mon"]', month);
            console.log(`✅ Selected: ${quarter} - ${month}`);

            // Click Search
            const srchBtn = page.locator('button.btn.btn-primary.srchbtn[type="submit"]').first();
            await srchBtn.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
            await srchBtn.scrollIntoViewIfNeeded();
            await srchBtn.click({ timeout: 10000 });
            console.log("✅ Clicked Search");
            await page.waitForLoadState("networkidle", { timeout: GST_CONFIG.timeout });
            await page.waitForTimeout(2000);

            // ── Click Download button on GSTR1 tile ───────────────────────
            console.log("📋 Waiting for GSTR1 Download button...");
            const downloadBtn = page
              .locator('div[data-ng-if="x.return_ty===\'GSTR1\'"] button:has-text("Download")')
              .first();
            await downloadBtn.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
            await downloadBtn.scrollIntoViewIfNeeded();
            await downloadBtn.click({ timeout: 10000 });
            console.log("✅ Clicked Download — waiting for next page...");
            await page.waitForLoadState("networkidle", { timeout: GST_CONFIG.timeout });
            await page.waitForTimeout(2000);

            await page.screenshot({
              path: `screenshots/gstr1-download-${quarter.replace(/\s+/g, "_")}-${month}.png`,
              fullPage: true,
            });

            // ── Click "Generate JSON File to Download" ────────────────────
            console.log("📋 Clicking Generate JSON File to Download...");
            const generateJsonBtn = page
              .locator('button[data-ng-click="download()"]:has-text("Generate JSON File to Download")')
              .first();
            await generateJsonBtn.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
            await generateJsonBtn.scrollIntoViewIfNeeded();
            await generateJsonBtn.click({ timeout: 10000 });
            console.log("✅ Clicked Generate JSON — waiting for download links...");
            await page.waitForTimeout(3000);

            // Check if "in progress" message appeared — if so, go back immediately
            const inProgressAck = page.locator(
              'text=Your request for generation of json file to download is acknowledged',
            );
            const inProgressAlert = page.locator(
              'div.alert-danger:has-text("File generation is in progress")',
            );
            const isInProgress =
              (await inProgressAck.first().isVisible().catch(() => false)) ||
              (await inProgressAlert.first().isVisible().catch(() => false));

            if (isInProgress) {
              console.log("⏭️ File generation in progress (up to 20 min) — skipping this month");
            } else {
              // Wait up to 30s for download links to appear
              const downloadLinkLocator = page.locator(
                'div[data-ng-if="download_json"] a[href*="/offline/download/url"]',
              );
              const linksAppeared = await downloadLinkLocator
                .first()
                .waitFor({ state: "visible", timeout: 30000 })
                .then(() => true)
                .catch(() => false);

              if (!linksAppeared) {
                console.log("⏭️ No download links appeared — skipping this month");
              } else {
                // Click all file links (File 1, File 2, etc.)
                const linkCount = await downloadLinkLocator.count();
                console.log(`📋 Found ${linkCount} download link(s)`);
                for (let f = 0; f < linkCount; f++) {
                  const link = downloadLinkLocator.nth(f);
                  const linkText = (await link.textContent())?.trim() ?? `File ${f + 1}`;
                  const jsonFileName = `GSTR1_${quarter.replace(/\s*\(.*\)/, "").trim().replace(/\s+/g, "_")}_${month}_2025-26_file${f + 1}.zip`;
                  const jsonSavePath = path.join(downloadsDir, jsonFileName);

                  const [download] = await Promise.all([
                    page.waitForEvent("download", { timeout: GST_CONFIG.timeout }),
                    link.click({ timeout: 10000 }),
                  ]);
                  await download.saveAs(jsonSavePath);
                  console.log(`✅ Saved [${linkText}]: downloads/${Credentials.username}/${jsonFileName}`);

                  // Extract the zip (cross-platform)
                  const extractDir = jsonSavePath.replace(".zip", "");
                  fs.mkdirSync(extractDir, { recursive: true });
                  const zip = new AdmZip(jsonSavePath);
                  zip.extractAllTo(extractDir, true);
                  console.log(`📂 Extracted to: downloads/${Credentials.username}/${path.basename(extractDir)}/`);
                  await page.waitForTimeout(1000);
                }
              }
            }

            // ── Go back via Returns breadcrumb ────────────────────────────
            const returnsBreadcrumb = page
              .locator('a[href="/returns/auth/dashboard"]:has-text("Returns")')
              .first();
            await returnsBreadcrumb.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
            await returnsBreadcrumb.click({ timeout: 10000 });
            console.log("✅ Back to Returns Dashboard");
            await page.waitForLoadState("domcontentloaded", { timeout: GST_CONFIG.timeout });
            await page.waitForTimeout(2000);

          } catch (error) {
            console.log(`⚠️ Error on ${quarter} - ${month}: ${error.message}`);
            await page.screenshot({
              path: `screenshots/gstr1-error-${quarter.replace(/\s+/g, "_")}-${month}.png`,
              fullPage: true,
            });
          }
        }
      }

      console.log("✅ All done");
    });
  }
});
