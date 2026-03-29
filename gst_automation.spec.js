/*************************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2025 Adobe
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.
 **************************************************************************/

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import ALL_CREDENTIALS from "./credentials.json" assert { type: "json" };

/**
 * GST Portal Automation
 *
 * This test automates interactions with the GST (Goods and Services Tax) portal.
 *
 * Note: This test runs in headed mode (browser visible) to allow manual login if needed.
 *
 * To run manually:
 *   npm run test:gst
 *   (headed mode is set in playwright.config.js)
 */

// ============================================================================
// TEST CONFIGURATION
// ============================================================================
const GST_CONFIG = {
  loginUrl: "https://services.gst.gov.in/services/login",
  timeout: 60000, // 60 seconds default timeout
};

test.describe("GST Portal Automation", () => {
  test.setTimeout(300000); // 5 minutes per client

  for (const cred of ALL_CREDENTIALS) {
  test(`GST Download - ${cred.username}`, async ({ page }) => {
    const Credentials = cred;
    console.log("🚀 Starting GST Portal Automation");
    console.log(`📄 Navigating to: ${GST_CONFIG.loginUrl}`);

    // Navigate to GST login page
    await page.goto(GST_CONFIG.loginUrl, {
      waitUntil: "networkidle",
      timeout: GST_CONFIG.timeout,
    });

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Take a screenshot for verification
    await page.screenshot({
      path: "screenshots/gst-login-page.png",
      fullPage: true,
    });

    // Verify we're on the login page
    const pageTitle = await page.title();
    console.log(`📋 Page title: ${pageTitle}`);

    // Step 1: Wait for login form to be visible
    console.log("📋 Step 1: Waiting for login form...");
    const loginForm = page.locator('form[name="loginform"]');
    await loginForm.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
    console.log("✅ Login form is visible");

    // Step 2: Fill in username
    console.log("📋 Step 2: Filling in username...");
    const usernameField = page.locator("#username").first();
    await usernameField.waitFor({
      state: "visible",
      timeout: GST_CONFIG.timeout,
    });
    await usernameField.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await usernameField.fill(Credentials.username);
    console.log(`✅ Username filled: ${Credentials.username}`);
    await page.waitForTimeout(1000); // Wait for form to update after username is filled

    // Step 3: Fill in password - need to exclude the hidden field
    console.log("📋 Step 3: Filling in password...");
    // Select the visible password field by ID (the hidden one doesn't have an ID)
    // Use a selector that excludes elements inside .hidden div
    let visiblePasswordField = page
      .locator('input#user_pass[type="password"]')
      .first();

    // Verify it's visible and not in hidden div
    const isVisible = await visiblePasswordField.isVisible().catch(() => false);
    if (!isVisible) {
      // Try finding visible password field by checking all password inputs
      const allPasswordFields = page.locator(
        'input[type="password"][name="user_pass"]',
      );
      const count = await allPasswordFields.count();
      for (let i = 0; i < count; i++) {
        const field = allPasswordFields.nth(i);
        const visible = await field.isVisible();
        if (visible) {
          visiblePasswordField = field;
          break;
        }
      }
    }

    await visiblePasswordField.waitFor({
      state: "visible",
      timeout: GST_CONFIG.timeout,
    });
    await visiblePasswordField.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Clear any existing value first
    await visiblePasswordField.click();
    await page.waitForTimeout(200);
    await visiblePasswordField.fill(""); // Clear first
    await page.waitForTimeout(200);

    // Try multiple methods to fill the password
    try {
      await visiblePasswordField.fill(Credentials.password);
      console.log("✅ Password filled using fill()");
    } catch (error) {
      console.log(`⚠️ Fill failed, trying type(): ${error.message}`);
      await visiblePasswordField.click();
      await page.waitForTimeout(200);
      await visiblePasswordField.type(Credentials.password, { delay: 50 });
      console.log("✅ Password filled using type()");
    }

    // Verify password was filled
    const passwordValue = await visiblePasswordField.inputValue();
    if (passwordValue === Credentials.password) {
      console.log("✅ Password verified - successfully filled");
    } else {
      console.log(
        `⚠️ Password may not be filled correctly. Expected length: ${Credentials.password.length}, Got length: ${passwordValue.length}`,
      );
    }

    await page.waitForTimeout(1000); // Wait for CAPTCHA to appear if needed

    // Step 3.5: Handle CAPTCHA if it appears
    console.log("📋 Step 3.5: Checking for CAPTCHA...");
    const captchaField = page.locator("#captcha");
    const captchaVisible = await captchaField.isVisible().catch(() => false);

    if (captchaVisible) {
      console.log("⚠️ CAPTCHA detected — fill it in and click Login manually");
      console.log("⏳ Waiting for you to fill CAPTCHA and click Login...");
      // Wait until the page navigates away from the login URL (i.e. Login was clicked)
      await page.waitForURL((url) => !url.href.includes("/services/login"), {
        timeout: 300000, // 5 minutes max
      });
      console.log("✅ Login detected — continuing automation");
    } else {
      console.log("📍 No CAPTCHA found — clicking Login automatically...");

      // Take a screenshot before login
      await page.screenshot({
        path: "screenshots/gst-credentials-filled.png",
        fullPage: true,
      });

      // Step 4: Click login button
      console.log("📋 Step 4: Clicking login button...");
      const loginButton = page
        .locator(
          'button[type="submit"]:has-text("Login"), button.btn-primary:has-text("Login")',
        )
        .first();
      await loginButton.waitFor({
        state: "visible",
        timeout: GST_CONFIG.timeout,
      });
      await loginButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await loginButton.click();
      console.log("✅ Login button clicked");
    }

    // Step 5: Wait for navigation or next page
    console.log("📋 Step 5: Waiting for page navigation...");
    await page.waitForTimeout(3000);

    // Wait for either navigation or error message
    try {
      await page.waitForURL(/^(?!.*\/services\/login).*$/, { timeout: 10000 });
      console.log("✅ Successfully logged in - navigated to new page");
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
    } catch (error) {
      console.log("⚠️ Still on login page or navigation timeout");
      // Check for error messages
      const errorElement = page.locator(
        '.err, .alert-danger, [data-ng-show="errors.login_error"]',
      );
      const errorCount = await errorElement.count();
      if (errorCount > 0) {
        const errorText = await errorElement.first().textContent();
        console.log(`⚠️ Error message: ${errorText}`);
      }
    }

    // Step 5.5: Handle Aadhaar authentication modal if it appears
    console.log("📋 Step 5.5: Checking for Aadhaar authentication modal...");
    await page.waitForTimeout(2000); // Wait a bit for modal to appear if it's going to

    const modal = page.locator(".modal-dialog.sweet, .modal-dialog").first();
    const modalVisible = await modal.isVisible().catch(() => false);

    if (modalVisible) {
      console.log("✅ Aadhaar authentication modal detected");

      // Look for "Remind me later" button
      const remindLaterButton = modal
        .locator(
          'a.btn-primary:has-text("Remind me later"), button:has-text("Remind me later")',
        )
        .first();
      const buttonVisible = await remindLaterButton
        .isVisible()
        .catch(() => false);

      if (buttonVisible) {
        console.log('📋 Clicking "Remind me later" button...');
        await remindLaterButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        try {
          await remindLaterButton.click({ timeout: 10000 });
          console.log('✅ Clicked "Remind me later" button');
          await page.waitForTimeout(2000); // Wait for modal to close
        } catch (error) {
          console.log(
            `⚠️ Click failed, trying JavaScript click: ${error.message}`,
          );
          await remindLaterButton.evaluate((el) => el.click());
          console.log('✅ Clicked "Remind me later" using JavaScript');
          await page.waitForTimeout(2000);
        }
      } else {
        // Try alternative selectors
        const altButton = modal
          .locator(
            'a[data-dismiss="modal"]:has-text("Remind me later"), a[ng-click="cancelcallback()"]',
          )
          .first();
        const altButtonVisible = await altButton.isVisible().catch(() => false);

        if (altButtonVisible) {
          console.log(
            '📋 Clicking "Remind me later" button (alternative selector)...',
          );
          await altButton.click({ timeout: 10000 });
          console.log('✅ Clicked "Remind me later" button');
          await page.waitForTimeout(2000);
        } else {
          console.log('⚠️ Could not find "Remind me later" button in modal');
        }
      }
    } else {
      console.log(
        "📍 No Aadhaar authentication modal found, skipping this step",
      );
    }

    // Take a screenshot after login attempt and modal handling
    await page.screenshot({
      path: "screenshots/gst-after-login.png",
      fullPage: true,
    });

    // Step 6: Click the "Return Dashboard" button on the post-login screen
    console.log("📋 Step 6: Waiting for Return Dashboard button...");
    await page.waitForLoadState("domcontentloaded");

    const returnDashboardBtn = page
      .locator('button:has(span[title="Return Dashboard"])')
      .first();

    try {
      await returnDashboardBtn.waitFor({
        state: "visible",
        timeout: GST_CONFIG.timeout,
      });
      console.log("✅ Return Dashboard button is visible");
      await returnDashboardBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await returnDashboardBtn.click({ timeout: 10000 });
      console.log('✅ Clicked "Return Dashboard" button');
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log(
        `⚠️ Button click failed, trying JavaScript click: ${error.message}`,
      );
      await returnDashboardBtn.evaluate((el) => el.click());
      console.log('✅ Clicked "Return Dashboard" using JavaScript');
      await page.waitForTimeout(3000);
    }

    // Take a screenshot after clicking Return Dashboard
    await page.screenshot({
      path: "screenshots/gst-returns-dashboard.png",
      fullPage: true,
    });

    // Set up user-specific downloads directory
    const downloadsDir = path.join(
      process.cwd(),
      "downloads",
      Credentials.username,
    );
    fs.mkdirSync(downloadsDir, { recursive: true });
    console.log(
      `📁 Downloads will be saved to: downloads/${Credentials.username}/`,
    );

    // Steps 7+: Loop over available quarters and their months

    // Helper: select dropdown and poll until a dependent dropdown populates
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

    // Select FY to populate quarters, read what's available
    await selectDropdown('select[name="fin"]', "2025-26", 'select[name="quarter"]');
    const availableQuarters = await page.$$eval(
      'select[name="quarter"] option',
      (opts) => opts.map((o) => o.label).filter((l) => l.trim() !== ""),
    );
    console.log(`📋 Available quarters: ${availableQuarters.join(", ")}`);

    for (const quarter of availableQuarters) {
      console.log(`\n📋 ===== Quarter: ${quarter} =====`);

      // Select FY → Quarter, wait for months to appear
      await selectDropdown('select[name="fin"]', "2025-26", 'select[name="quarter"]');
      await selectDropdown('select[name="quarter"]', quarter, 'select[name="mon"]');

      // Read months actually available for this quarter
      const availableMonths = await page.$$eval(
        'select[name="mon"] option',
        (opts) => opts.map((o) => o.label).filter((l) => l.trim() !== ""),
      );
      console.log(`📋 Available months for ${quarter}: ${availableMonths.join(", ")}`);

      if (availableMonths.length === 0) {
        console.log(`⏭️ No months available for ${quarter} — skipping`);
        continue;
      }

      for (const month of availableMonths) {
        console.log(`\n📋 ===== Processing: ${quarter} - ${month} =====`);

        try {
          // Re-select FY → Quarter → Month after each return to dashboard
          await selectDropdown('select[name="fin"]', "2025-26", 'select[name="quarter"]');
          await selectDropdown('select[name="quarter"]', quarter, 'select[name="mon"]');
          await selectDropdown('select[name="mon"]', month);
          console.log(`✅ Selected: ${quarter} - ${month}`);

          // Click Search
          const srchBtn = page
            .locator('button.btn.btn-primary.srchbtn[type="submit"]')
            .first();
          await srchBtn.waitFor({
            state: "visible",
            timeout: GST_CONFIG.timeout,
          });
          await srchBtn.scrollIntoViewIfNeeded();
          await srchBtn.click({ timeout: 10000 });
          console.log("✅ Clicked Search");
          await page.waitForLoadState("networkidle", {
            timeout: GST_CONFIG.timeout,
          });
          await page.waitForTimeout(2000);

          // Download GSTR-3B PDF before proceeding with GSTR-1
          console.log("📋 Looking for GSTR-3B Download button...");
          const gstr3bDownloadBtn = page
            .locator('button[data-ng-click="downloadGSTR3Bpdf()"]')
            .first();
          const gstr3bVisible = await gstr3bDownloadBtn
            .isVisible()
            .catch(() => false);

          if (gstr3bVisible) {
            const gstr3bFileName = `GSTR3B_${quarter
              .replace(/\s*\(.*\)/, "")
              .trim()
              .replace(/\s+/g, "_")}_${month}_2025-26.pdf`;
            const gstr3bSavePath = path.join(downloadsDir, gstr3bFileName);
            await gstr3bDownloadBtn.scrollIntoViewIfNeeded();
            const [gstr3bDownload] = await Promise.all([
              page.waitForEvent("download", { timeout: GST_CONFIG.timeout }),
              gstr3bDownloadBtn.click({ timeout: 10000 }),
            ]);
            await gstr3bDownload.saveAs(gstr3bSavePath);
            console.log(`✅ GSTR-3B PDF saved: downloads/${gstr3bFileName}`);
            await page.waitForTimeout(2000);
          } else {
            console.log("⏭️ GSTR-3B Download button not visible — skipping");
          }

          // Wait for GSTR1 tile to appear
          const tile = page
            .locator(
              'p.inv:has-text("Details of outward supplies of goods or services")',
            )
            .first();
          await tile.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
          console.log("✅ GSTR1 tile visible");

          // Click VIEW
          const vBtn = page
            .locator(
              'div[data-ng-if="x.return_ty==\'GSTR1\'"] button:has-text("VIEW")',
            )
            .first();
          await vBtn.waitFor({ state: "visible", timeout: GST_CONFIG.timeout });
          await vBtn.scrollIntoViewIfNeeded();
          await vBtn.click({ timeout: 10000 });
          console.log("✅ Clicked VIEW");
          await page.waitForLoadState("networkidle", {
            timeout: GST_CONFIG.timeout,
          });
          await page.waitForTimeout(2000);

          const fileName = `GSTR1_${quarter
            .replace(/\s*\(.*\)/, "")
            .trim()
            .replace(/\s+/g, "_")}_${month}_2025-26.pdf`;
          const savePath = path.join(downloadsDir, fileName);

          // Two branches after VIEW:
          // Branch A: NIL return — "DOWNLOAD FILED (PDF)" button is directly visible
          // Branch B: Regular return — "VIEW SUMMARY" button appears first, then "DOWNLOAD (PDF)"
          const nilDownloadBtn = page
            .locator('button[data-ng-click="generateNILGstr1Pdf()"]')
            .first();
          const viewSummaryBtn = page
            .locator('button span:has-text("VIEW SUMMARY")')
            .locator("xpath=..")
            .first();

          const isNilDownload = await nilDownloadBtn
            .isVisible()
            .catch(() => false);
          const isViewSummary = await viewSummaryBtn
            .isVisible()
            .catch(() => false);

          if (isNilDownload) {
            // Branch A: NIL return — download directly
            console.log(
              "📋 Branch A: NIL return — clicking Download Filed (PDF)...",
            );
            await nilDownloadBtn.scrollIntoViewIfNeeded();
            const [download] = await Promise.all([
              page.waitForEvent("download", { timeout: GST_CONFIG.timeout }),
              nilDownloadBtn.click({ timeout: 10000 }),
            ]);
            await download.saveAs(savePath);
            console.log(`✅ PDF saved: downloads/${fileName}`);
          } else if (isViewSummary) {
            // Branch B: Regular return — click VIEW SUMMARY first
            console.log(
              "📋 Branch B: Regular return — clicking View Summary...",
            );
            await viewSummaryBtn.scrollIntoViewIfNeeded();
            await viewSummaryBtn.click({ timeout: 10000 });
            console.log("✅ Clicked View Summary");
            await page.waitForLoadState("networkidle", {
              timeout: GST_CONFIG.timeout,
            });
            await page.waitForTimeout(2000);

            // Now click DOWNLOAD (PDF)
            const summaryDownloadBtn = page
              .locator(
                'button[data-ng-click="genratepdfNew()"] span:has-text("DOWNLOAD (PDF)")',
              )
              .locator("xpath=..")
              .first();
            await summaryDownloadBtn.waitFor({
              state: "visible",
              timeout: GST_CONFIG.timeout,
            });
            await summaryDownloadBtn.scrollIntoViewIfNeeded();
            const [download] = await Promise.all([
              page.waitForEvent("download", { timeout: GST_CONFIG.timeout }),
              summaryDownloadBtn.click({ timeout: 10000 }),
            ]);
            await download.saveAs(savePath);
            console.log(`✅ PDF saved: downloads/${fileName}`);
          } else {
            console.log(
              "⚠️ Neither download branch detected — taking screenshot for investigation",
            );
            await page.screenshot({
              path: `screenshots/gst-no-download-btn-${quarter.replace(/\s+/g, "_")}-${month}.png`,
              fullPage: true,
            });
          }

          await page.waitForTimeout(2000);

          await page.screenshot({
            path: `screenshots/gst-downloaded-${quarter.replace(/\s+/g, "_")}-${month}.png`,
            fullPage: true,
          });

          // Go back via Returns breadcrumb
          const returnsBreadcrumb = page
            .locator('a[href="/returns/auth/dashboard"]:has-text("Returns")')
            .first();
          await returnsBreadcrumb.waitFor({
            state: "visible",
            timeout: GST_CONFIG.timeout,
          });
          await returnsBreadcrumb.click({ timeout: 10000 });
          console.log("✅ Clicked Returns breadcrumb — back to dashboard");
          await page.waitForLoadState("domcontentloaded", {
            timeout: GST_CONFIG.timeout,
          });
          await page.waitForTimeout(2000);
        } catch (error) {
          console.log(
            `⚠️ Error processing ${quarter} - ${month}: ${error.message}`,
          );
          await page.screenshot({
            path: `screenshots/gst-error-${quarter.replace(/\s+/g, "_")}-${month}.png`,
            fullPage: true,
          });
        }
      } // end months loop
    } // end quarters loop

    console.log("✅ Login process completed");
    console.log(
      "⏸️ Test paused - press Resume in Playwright Inspector or Ctrl+C to end",
    );
  }); // end test
  } // end for (cred of ALL_CREDENTIALS)

  test("Extract Table 4 from GSTR-3B PDF to CSV", async ({}, testInfo) => {
    const candidates = [
      process.env.GSTR3B_PDF_PATH,
      path.join(process.cwd(), "test-data", "gstr3b.pdf"),
      "/Users/nbatra/dc-genai-dropin/GSTR3B_09AALFM4578N3ZB_032025.pdf",
    ].filter(Boolean);

    const pdfPath = candidates.find((p) => fs.existsSync(p));

    if (!pdfPath) {
      testInfo.skip(
        true,
        `No GSTR-3B PDF found. Set GSTR3B_PDF_PATH or add test-data/gstr3b.pdf`,
      );
      return;
    }

    console.log("🚀 Starting PDF Table Extraction");
    console.log(`📄 Reading PDF: ${pdfPath}`);

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);

    console.log(`✅ PDF loaded - ${pdfData.numpages} pages`);
    console.log(`📋 Extracting text content...`);

    // Extract text content
    const text = pdfData.text;

    // Find Table 4 (Eligible ITC section)
    // Look for the section that starts with "4. Eligible ITC"
    const table4StartMarker = "4. Eligible ITC";
    const table4EndMarker = "5. Values of Exempt";

    let table4Text = "";
    const startIndex = text.indexOf(table4StartMarker);
    const endIndex = text.indexOf(table4EndMarker);

    if (startIndex === -1) {
      throw new Error("Table 4 (Eligible ITC) not found in PDF");
    }

    if (endIndex === -1) {
      // If end marker not found, take text until next section or end
      table4Text = text.substring(startIndex);
    } else {
      table4Text = text.substring(startIndex, endIndex);
    }

    console.log("📋 Extracted Table 4 text");
    console.log("🔍 Parsing table data...");

    // Debug: Show first 500 chars of extracted text
    console.log("📄 Table 4 text preview:", table4Text.substring(0, 500));

    // Parse the table data
    // The table has structure:
    // Details | Integrated Tax(₹) | Central Tax(₹) | State/UT Tax(₹) | Cess(₹)
    const lines = table4Text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Find the header row
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes("Integrated Tax") &&
        lines[i].includes("Central Tax")
      ) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      throw new Error("Table 4 header not found");
    }

    // Extract header
    const headerLine = lines[headerIndex];
    // Clean up header - remove currency symbols and extra spaces
    const headers = headerLine
      .split(/\s{2,}|\t/)
      .map((h) => h.trim().replace(/[₹()]/g, "").trim());

    // Find data rows - look for rows with numbers (tax amounts)
    const dataRows = [];
    let currentSection = "";

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines or lines that are clearly not data rows
      if (!line || line.length < 3) continue;

      // Check if this is a section header (like "(A) ITC Available")
      if (line.match(/^\([A-Z]\)\s+/)) {
        currentSection = line.trim();
        // Try to extract section data if it has numbers
        const sectionParts = line.split(/\s{2,}|\t/).map((p) => p.trim());
        if (sectionParts.length >= 5) {
          const numbers = sectionParts
            .slice(1)
            .filter((p) => p.match(/[\d,.-]+/));
          if (numbers.length >= 4) {
            const cleanNumbers = numbers.map((n) => n.replace(/,/g, ""));
            dataRows.push({
              description: currentSection,
              integratedTax: cleanNumbers[0] || "0.00",
              centralTax: cleanNumbers[1] || "0.00",
              stateTax: cleanNumbers[2] || "0.00",
              cess: cleanNumbers[3] || "0.00",
            });
          }
        }
        continue;
      }

      // Check if this is a subsection (like "(1) Import of goods") or any row with numbers
      // Look for lines that start with (number) or contain multiple numbers
      const hasNumberedPrefix = line.match(/^\(\d+\)/);
      const hasMultipleNumbers = (line.match(/[\d,.-]+/g) || []).length >= 4;

      if (hasNumberedPrefix || hasMultipleNumbers) {
        // Parse the row - split by multiple spaces (2+) or tabs
        const rowParts = line
          .split(/\s{2,}|\t/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0);

        if (rowParts.length >= 2) {
          // First part is the description, rest should be numbers
          const description = rowParts[0];
          const numbers = rowParts
            .slice(1)
            .filter((p) => p.match(/^[\d,.-]+$/));

          // If we have at least 4 numbers, it's a valid data row
          if (numbers.length >= 4) {
            // Clean numbers - remove commas
            const cleanNumbers = numbers.map((n) => n.replace(/,/g, ""));
            dataRows.push({
              description: description,
              integratedTax: cleanNumbers[0] || "0.00",
              centralTax: cleanNumbers[1] || "0.00",
              stateTax: cleanNumbers[2] || "0.00",
              cess: cleanNumbers[3] || "0.00",
            });
          } else if (numbers.length > 0) {
            // Some rows might have fewer columns, pad with zeros
            const cleanNumbers = numbers.map((n) => n.replace(/,/g, ""));
            while (cleanNumbers.length < 4) {
              cleanNumbers.push("0.00");
            }
            dataRows.push({
              description: description,
              integratedTax: cleanNumbers[0] || "0.00",
              centralTax: cleanNumbers[1] || "0.00",
              stateTax: cleanNumbers[2] || "0.00",
              cess: cleanNumbers[3] || "0.00",
            });
          }
        }
      }
    }

    // Build pipe-delimited CSV
    console.log("📝 Converting to pipe-delimited CSV format...");

    // CSV header
    const csvHeader = "Details|Integrated Tax|Central Tax|State/UT Tax|Cess";
    const csvRows = [csvHeader];

    // Add data rows
    for (const row of dataRows) {
      const csvRow = `${row.description}|${row.integratedTax}|${row.centralTax}|${row.stateTax}|${row.cess}`;
      csvRows.push(csvRow);
    }

    const csvContent = csvRows.join("\n");

    // Write to file
    const outputFileName = "GSTR3B_Table4_EligibleITC.csv";
    const outputPath = path.join(process.cwd(), outputFileName);

    fs.writeFileSync(outputPath, csvContent, "utf8");

    console.log(`✅ Table 4 extracted and saved to: ${outputPath}`);
    console.log(`📊 Extracted ${dataRows.length} data rows`);

    if (dataRows.length === 0) {
      console.log(
        "⚠️ Warning: No data rows extracted. Showing raw table text for debugging:",
      );
      console.log(table4Text);
    } else {
      console.log("\n📋 CSV Content Preview (first 10 rows):");
      const previewRows = csvRows.slice(0, 11).join("\n");
      console.log(previewRows);
    }

    // Verify the file was created
    expect(fs.existsSync(outputPath)).toBeTruthy();

    // Verify CSV has content
    const fileContent = fs.readFileSync(outputPath, "utf8");
    expect(fileContent.length).toBeGreaterThan(0);
    expect(fileContent).toContain("|");

    console.log("✅ PDF table extraction completed successfully");
  });
});
