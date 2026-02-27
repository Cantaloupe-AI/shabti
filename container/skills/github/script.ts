#!/usr/bin/env bun

import { $ } from "bun";

// Parse command line arguments
const args = process.argv.slice(2);
const params: Record<string, string> = {};

for (const arg of args) {
  const match = arg.match(/^--(\w+)(?:=(.*))?$/);
  if (match) {
    params[match[1]] = match[2] ?? "true";
  }
}

const action = params.action;

// BLOCKED ACTIONS - These are hard-blocked per GitHub Rules
const BLOCKED_ACTIONS: Record<string, string> = {
  "merge-pr": "BLOCKED: Seshat cannot merge PRs - humans must merge",
  "approve-pr": "BLOCKED: Seshat cannot approve PRs - humans must approve",
};

if (!action) {
  console.error("Error: --action is required");
  console.error("\nAvailable actions:");
  console.error("  PR Operations:");
  console.error("    --action=create-pr --title='...' --body='...' [--base=main] [--head=branch]");
  console.error("    --action=list-prs [--state=open|closed|all]");
  console.error("    --action=view-pr --number=123");
  console.error("    --action=pr-diff --number=123");
  console.error("    --action=pr-checks --number=123");
  console.error("    --action=comment-pr --number=123 --body='...'");
  console.error("    --action=close-pr --number=123");
  console.error("    --action=checkout-pr --number=123");
  console.error("\n  Repo Operations:");
  console.error("    --action=repo-info");
  console.error("    --action=clone --repo=owner/repo [--dir=dirname]");
  process.exit(1);
}

// Check for blocked actions
if (BLOCKED_ACTIONS[action]) {
  console.error(BLOCKED_ACTIONS[action]);
  process.exit(1);
}

async function run() {
  try {
    switch (action) {
      // === PR Operations ===

      case "create-pr": {
        const title = params.title;
        const body = params.body ?? "";
        const base = params.base ?? "main";
        const head = params.head;

        if (!title) {
          console.error("Error: --title is required for create-pr");
          process.exit(1);
        }

        const args = ["pr", "create", "--title", title, "--body", body, "--base", base];
        if (head) args.push("--head", head);

        const result = await $`gh ${args}`.text();
        console.log(result);
        break;
      }

      case "list-prs": {
        const state = params.state ?? "open";
        const result = await $`gh pr list --state ${state}`.text();
        console.log(result || "No pull requests found.");
        break;
      }

      case "view-pr": {
        const number = params.number;
        if (!number) {
          console.error("Error: --number is required for view-pr");
          process.exit(1);
        }
        const result = await $`gh pr view ${number}`.text();
        console.log(result);
        break;
      }

      case "pr-diff": {
        const number = params.number;
        if (!number) {
          console.error("Error: --number is required for pr-diff");
          process.exit(1);
        }
        const result = await $`gh pr diff ${number}`.text();
        console.log(result);
        break;
      }

      case "pr-checks": {
        const number = params.number;
        if (!number) {
          console.error("Error: --number is required for pr-checks");
          process.exit(1);
        }
        const result = await $`gh pr checks ${number}`.text();
        console.log(result);
        break;
      }

      case "comment-pr": {
        const number = params.number;
        const body = params.body;
        if (!number) {
          console.error("Error: --number is required for comment-pr");
          process.exit(1);
        }
        if (!body) {
          console.error("Error: --body is required for comment-pr");
          process.exit(1);
        }
        const result = await $`gh pr comment ${number} --body ${body}`.text();
        console.log(result || "Comment added.");
        break;
      }

      case "close-pr": {
        const number = params.number;
        if (!number) {
          console.error("Error: --number is required for close-pr");
          process.exit(1);
        }
        const result = await $`gh pr close ${number}`.text();
        console.log(result || `PR #${number} closed.`);
        break;
      }

      case "checkout-pr": {
        const number = params.number;
        if (!number) {
          console.error("Error: --number is required for checkout-pr");
          process.exit(1);
        }
        const result = await $`gh pr checkout ${number}`.text();
        console.log(result || `Checked out PR #${number}.`);
        break;
      }

      // === Repo Operations ===

      case "repo-info": {
        const result = await $`gh repo view`.text();
        console.log(result);
        break;
      }

      case "clone": {
        const repo = params.repo;
        const dir = params.dir;
        if (!repo) {
          console.error("Error: --repo is required for clone (format: owner/repo)");
          process.exit(1);
        }
        const args = ["repo", "clone", repo];
        if (dir) args.push(dir);
        const result = await $`gh ${args}`.text();
        console.log(result || `Cloned ${repo}.`);
        break;
      }

      default:
        console.error(`Error: Unknown action '${action}'`);
        process.exit(1);
    }
  } catch (error: any) {
    // Handle bun shell errors
    if (error.exitCode !== undefined) {
      console.error(error.stderr?.toString() || error.message);
      process.exit(error.exitCode);
    }
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();