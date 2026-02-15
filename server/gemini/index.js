#!/usr/bin/env node

/**
 * Claude Delegator - Gemini MCP Bridge
 * 
 * A zero-dependency MCP server that wraps the Gemini CLI.
 * Speaks JSON-RPC 2.0 over stdio.
 */

import { spawn, execSync } from "node:child_process";

const DEFAULT_MODEL = "gemini-2.0-flash";

// --- MCP Protocol Helpers ---

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({
    jsonrpc: "2.0",
    id,
    result
  }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message }
  }) + "\n");
}

// --- Gemini CLI Wrapper ---

async function runGemini(args, cwd) {
  return new Promise((resolve, reject) => {
    // Force JSON output for reliable parsing
    const geminiArgs = [...args, "-o", "json"];
    const geminiProcess = spawn("gemini", geminiArgs, {
      env: process.env,
      shell: false,
      cwd: cwd || process.cwd() // Ensure we run in the requested directory
    });
    
    let stdout = "";
    let stderr = "";

    geminiProcess.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("Gemini CLI not found. Please install it with 'npm install -g @google/gemini-cli'."));
      } else {
        reject(err);
      }
    });

    geminiProcess.stdout.on("data", (data) => { stdout += data.toString(); });
    geminiProcess.stderr.on("data", (data) => { stderr += data.toString(); });

    geminiProcess.on("close", (code) => {
      if (code !== 0 && !stdout) {
        return reject(new Error(stderr.trim() || `Gemini exited with code ${code}`));
      }

      try {
        // Extract JSON block (ignoring potential terminal noise)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON response found");
        
        const data = JSON.parse(jsonMatch[0]);
        resolve({
          response: data.response || "(No output)",
          threadId: data.session_id || "unknown"
        });
      } catch (e) {
        reject(new Error(`Parse error: ${e.message}\nRaw output was: ${stdout}`));
      }
    });
  });
}

// --- Request Handlers ---

const handlers = {
  "initialize": (id) => {
    sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "claude-delegator-gemini", version: "1.2.1" }
    });
  },

  "tools/list": (id) => {
    sendResponse(id, {
      tools: [
        {
          name: "gemini",
          description: "Start a new Gemini expert session",
          inputSchema: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "The delegation prompt" },
              "developer-instructions": { type: "string", description: "Expert system instructions" },
              sandbox: { type: "string", enum: ["read-only", "workspace-write"], default: "read-only" },
              cwd: { type: "string", description: "Current working directory" },
              model: { type: "string", default: DEFAULT_MODEL }
            },
            required: ["prompt"]
          }
        },
        {
          name: "gemini-reply",
          description: "Continue an existing Gemini session",
          inputSchema: {
            type: "object",
            properties: {
              threadId: { type: "string", description: "Session ID", default: "latest" },
              prompt: { type: "string", description: "Follow-up prompt" },
              sandbox: { type: "string", enum: ["read-only", "workspace-write"], default: "read-only" },
              cwd: { type: "string" }
            },
            required: ["prompt"]
          }
        }
      ]
    });
  },

  "tools/call": async (id, params) => {
    const { name, arguments: args } = params;
    try {
      const geminiArgs = [];
      if (name === "gemini") {
        geminiArgs.push("-m", args.model || DEFAULT_MODEL);
        if (args.sandbox === "workspace-write") geminiArgs.push("-s");
        let prompt = args.prompt;
        if (args["developer-instructions"]) prompt = `${args["developer-instructions"]}\n\n${prompt}`;
        geminiArgs.push("-p", prompt);
      } else if (name === "gemini-reply") {
        geminiArgs.push("--resume", args.threadId || "latest");
        if (args.sandbox === "workspace-write") geminiArgs.push("-s");
        geminiArgs.push("-p", args.prompt);
      } else {
        return sendError(id, -32601, `Tool not found: ${name}`);
      }

      const { response, threadId } = await runGemini(geminiArgs, args.cwd);
      
      // Return metadata (threadId) at the top level for orchestration rules,
      // and standard content array for the UI.
      sendResponse(id, {
        content: [{ type: "text", text: response }],
        threadId: threadId 
      });
    } catch (e) {
      sendResponse(id, {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true
      });
    }
  },

  "notifications/initialized": () => {} 
};

// --- Main Loop (Robust JSON-RPC stream handling) ---

let buffer = "";
process.stdin.on("data", async (chunk) => {
  buffer += chunk.toString();
  let lines = buffer.split("\n");
  buffer = lines.pop(); // Keep partial line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const request = JSON.parse(line);
      const handler = handlers[request.method];
      if (handler) {
        await handler(request.id, request.params);
      } else if (request.id) {
        sendError(request.id, -32601, `Method not found: ${request.method}`);
      }
    } catch (e) {
      // Ignore parse errors from noise
    }
  }
});

// Startup Check
try {
  execSync("gemini --version", { stdio: "ignore" });
} catch (e) {
  console.error("Gemini CLI not found. Please install it first.");
  process.exit(1);
}
