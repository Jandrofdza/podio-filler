import { cfg, hasSupabase, hasOpenAI } from "./config.js";
import { runItemFiles } from "./run.js";
import { getItemFiles, ensureAccessToken } from "./podio.js";
import { Command } from "commander";

const program = new Command();

program
  .command("run <itemId>")
  .description("Process a Podio item end-to-end")
  .action(async (itemId) => {
    await ensureAccessToken();
    const files = await getItemFiles(itemId);
    const result = await runItemFiles(files, cfg);
    console.log("Classification result:", result);
  });

program.parse(process.argv);
