import { Command } from "commander";
import { runItemFiles } from "./run.js";
import { getItemFiles } from "./podio.js";   // ✅ only import what exists
import { cfg } from "./config.js";

const program = new Command();

program
  .command("run <itemId>")
  .description("Process files from a Podio item")
  .action(async (itemId) => {
    try {
      console.log("Fetching files for item:", itemId);
      const files = await getItemFiles(itemId);
      console.log("Got files:", files.length);

      await runItemFiles(files, cfg);
      console.log("Done processing item:", itemId);
    } catch (err) {
      console.error("Run failed:", err);
      process.exit(1);
    }
  });

program.parse(process.argv);
