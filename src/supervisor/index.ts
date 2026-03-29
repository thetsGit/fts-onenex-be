import { bytesToMb } from "@/core/file";

import { isMemoryUsageSignal } from "@/types/supervisor";

import {
  MEMORY_LIMIT_BYTES,
  RESTART_DELAY_MS,
  validateEnvironment,
} from "@/config";

// Validate environment variables at startup
validateEnvironment();

let child: ReturnType<typeof Bun.spawn>;
let isShuttingDown = false;

const startServer = () => {
  console.log("[supervisor] Starting server...");

  child = Bun.spawn({
    cmd: ["bun", "src/index.ts"],
    stdout: "inherit",
    stderr: "inherit",
    ipc(message) {
      if (isMemoryUsageSignal(message)) {
        const rssBytes = message.rss;
        const rssMB = bytesToMb(rssBytes);
        console.log(
          `[supervisor] Child memory: ${rssMB}MB / ${bytesToMb(MEMORY_LIMIT_BYTES)}MB limit`,
        );

        if (rssBytes > MEMORY_LIMIT_BYTES) {
          console.log("[supervisor] Memory limit exceeded. Restarting...");
          child?.kill();
        }
      }
    },
    onExit(_, exitCode, signal) {
      console.log(
        `[supervisor] Server exited (code: ${exitCode}, signal: ${signal})`,
      );

      // Auto restart the server on memory limit exceeds or process killed somehow
      if (!isShuttingDown) {
        console.log(`[supervisor] Restarting in ${RESTART_DELAY_MS}ms...`);
        setTimeout(startServer, RESTART_DELAY_MS);
      }
    },
  });

  console.log(`[supervisor] Server started (pid: ${child.pid})`);
};

/**
 * Graceful shutdown child on parent killed
 */

// Interrupt from keyboard (e.g Ctrl+C)
process.on("SIGINT", () => {
  console.log("\n[supervisor] Shutting down...");
  isShuttingDown = true;
  child?.kill();
  process.exit(0);
});

// Termination signal
process.on("SIGTERM", () => {
  console.log("[supervisor] Received SIGTERM. Shutting down...");
  isShuttingDown = true;
  child?.kill();
  process.exit(0);
});

// Start the web server
startServer();
