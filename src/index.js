#!/usr/bin/env node
import { Command } from "commander";
import { runItemFiles } from "./run.js";
import { appAuth, getItemFiles } from "./podio.js";
import cfg from "./config.js";

const program = new Command();

program
  .command("run <itemId>")
  .description("Process a Podio item (fetch files, send to OpenAI, write back)")
  .action(async (itemId) => {
    try {
      console.log("Processing item:", itemId);

      // Authenticate with Podio
      await appAuth();

      // Get files attached to item
      const files = await getItemFiles(itemId);
      console.log("Got files:", files.map(f => f.name));

      // Run classification pipeline
      const result = await runItemFiles(files, cfg);

      console.log("Classification result:", JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("Error in run command:", err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
