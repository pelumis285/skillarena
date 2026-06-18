import { chromium } from "playwright";

const BASE_URL = process.env.SKILLARENA_PWA_URL || "https://pwa-ebon-mu.vercel.app";

const stamp = Date.now();
const userOne = {
  email: `live-alpha-${stamp}@example.com`,
  username: `livealpha${stamp}`,
  password: "secret123",
  displayName: "Live Alpha",
};

const userTwo = {
  email: `live-beta-${stamp}@example.com`,
  username: `livebeta${stamp}`,
  password: "secret123",
  displayName: "Live Beta",
};

const browser = await chromium.launch({ headless: true });

const issues = [];
const seenIssues = new Set();

function recordIssue(message) {
  if (seenIssues.has(message)) return;
  seenIssues.add(message);
  issues.push(message);
}

function trackPage(page, label) {
  page.on("pageerror", (error) => {
    recordIssue(`${label} pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.text().includes("[realtime]")) {
      console.log(`${label} ${message.type()} ${message.text()}`);
    }
    if (message.type() === "error") {
      recordIssue(`${label} console error: ${message.text()}`);
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/auth/")) {
      console.log(`${label} auth ${response.status()} ${url}`);
    }
    if (!url.includes("/api/")) return;
    if (response.status() < 400) return;
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "<unreadable>";
    }
    recordIssue(`${label} API ${response.status()} ${url} ${body}`);
  });
}

async function clickButtonByText(page, text) {
  const button = page.getByRole("button", { name: text, exact: true });
  await button.click();
}

async function registerUser(page, user, label) {
  console.log(`\n[${label}] Opening ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByText("Welcome back to the parlor.").waitFor({ timeout: 30000 });

  console.log(`[${label}] Starting account creation`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await clickButtonByText(page, "Continue");

  console.log(`[${label}] Passing verification`);
  await clickButtonByText(page, "Paste demo code");

  console.log(`[${label}] Completing onboarding`);
  await page.getByLabel("Display name").fill(user.displayName);
  await clickButtonByText(page, "Enter the Arena");

  try {
    await page
      .getByText("Your stake-ready arena for Ludo, Chess, Whot, WordForge and Scrabble.")
      .waitFor({ timeout: 30000 });
  } catch (error) {
    const body = await page.locator("body").innerText().catch(() => "<unreadable>");
    console.log(`[${label}] Body after Enter the Arena:\n${body.slice(0, 2500)}`);
    throw error;
  }
  await page.getByText(user.displayName).first().waitFor({ timeout: 30000 });
  console.log(`[${label}] Reached dashboard`);
}

async function openPlayLobby(page, label) {
  console.log(`[${label}] Opening Play lobby`);
  await clickButtonByText(page, "Play");
  await page.getByText("Clear rooms. Clear stakes. Clear next steps.").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Create challenge", exact: true }).waitFor({ timeout: 30000 });

  try {
    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll("button")];
      const createButton = buttons.find((button) => button.textContent?.trim() === "Create challenge");
      return Boolean(createButton) && !createButton.hasAttribute("disabled");
    }, undefined, { timeout: 90000 });
  } catch (error) {
    const body = await page.locator("body").innerText().catch(() => "<unreadable>");
    console.log(`[${label}] Lobby body while waiting for the live lobby to unlock:\n${body.slice(0, 2500)}`);
    throw error;
  }

  const lobbyTextFlags = await page.evaluate(() => ({
    hasLiveServer: document.body.innerText.includes("Live server"),
    hasLocalPreview: document.body.innerText.includes("Local preview"),
    hasUnavailable: document.body.innerText.includes("Live server unavailable"),
    hasConnecting: document.body.innerText.includes("Connecting"),
  }));
  console.log(`[${label}] Lobby flags ${JSON.stringify(lobbyTextFlags)}`);

  console.log(`[${label}] Create challenge button is enabled`);
}

async function createPublicChessChallenge(page) {
  console.log("[User 1] Opening challenge composer");
  await clickButtonByText(page, "Create challenge");
  await page.getByRole("button", { name: "Post challenge", exact: true }).waitFor({ timeout: 30000 });

  console.log("[User 1] Posting public chess challenge");
  await clickButtonByText(page, "Post challenge");

  await page.getByText("Your rooms").first().waitFor({ timeout: 30000 });
  await page.getByText("Your room").first().waitFor({ timeout: 30000 });
  console.log("[User 1] Challenge posted");
}

async function acceptChallengeFromCreator(page, creatorName) {
  console.log("[User 2] Looking for posted challenge");
  const card = page.locator("div").filter({ hasText: creatorName }).filter({ hasText: "Accept & play" }).first();
  await card.waitFor({ timeout: 30000 });
  await card.getByRole("button", { name: "Accept & play" }).click();

  console.log("[User 2] Accepting and waiting for board");
  await page.getByText("Challenge board").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Lock seat & start" }).waitFor({ timeout: 30000 });
  console.log("[User 2] Challenge board opened");
}

try {
  const contextOne = await browser.newContext();
  const pageOne = await contextOne.newPage();
  trackPage(pageOne, "user-one");

  await registerUser(pageOne, userOne, "User 1");
  await openPlayLobby(pageOne, "User 1");
  await createPublicChessChallenge(pageOne);

  const contextTwo = await browser.newContext();
  const pageTwo = await contextTwo.newPage();
  trackPage(pageTwo, "user-two");

  await registerUser(pageTwo, userTwo, "User 2");
  await openPlayLobby(pageTwo, "User 2");
  await acceptChallengeFromCreator(pageTwo, userOne.displayName);

  if (issues.length) {
    console.log("\nLive flow completed, but issues were captured:");
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\nLive flow passed: signup, onboarding, challenge post, and challenge acceptance worked.");
  }
} catch (error) {
  if (issues.length) {
    console.log("\nCaptured issues before failure:");
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
  }
  throw error;
} finally {
  await browser.close();
}
