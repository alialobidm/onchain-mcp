#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import * as bankless from './operations/bankless.js';
import { VERSION } from "./common/version.js";
import { 
    BanklessError,
    BanklessValidationError,
    BanklessResourceNotFoundError,
    BanklessAuthenticationError,
    BanklessRateLimitError,
    isBanklessError
} from './common/banklessErrors.js';

const server = new Server(
    {
        name: "bankless-onchain-mcp-server",
        version: VERSION,
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

function formatBanklessError(error: BanklessError): string {
  let message = `Bankless API Error: ${error.message}`;
  
  if (error instanceof BanklessValidationError) {
    message = `Validation Error: ${error.message}`;
    if (error.response) {
      message += `\nDetails: ${JSON.stringify(error.response)}`;
    }
  } else if (error instanceof BanklessResourceNotFoundError) {
    message = `Not Found: ${error.message}`;
  } else if (error instanceof BanklessAuthenticationError) {
    message = `Authentication Failed: ${error.message}`;
  } else if (error instanceof BanklessRateLimitError) {
    message = `Rate Limit Exceeded: ${error.message}\nResets at: ${error.resetAt.toISOString()}`;
  }

  return message;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_contract",
                description: "Read contract state from a blockchain",
                inputSchema: zodToJsonSchema(bankless.ReadContractSchema),
            },
            {
                name: "get_proxy",
                description: "Gets the proxy address for a given network and contract",
                inputSchema: zodToJsonSchema(bankless.GetProxySchema),
            }
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (!request.params.arguments) {
            throw new Error("Arguments are required");
        }

        switch (request.params.name) {
            case "read_contract": {
                const args = bankless.ReadContractSchema.parse(request.params.arguments);
                const result = await bankless.readContractState(
                    args.network,
                    args.contract,
                    args.method,
                    args.inputs,
                    args.outputs
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "get_proxy": {
                const args = bankless.GetProxySchema.parse(request.params.arguments);
                const result = await bankless.getProxy(
                    args.network,
                    args.contract
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${request.params.name}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid input: ${JSON.stringify(error.errors)}`);
        }
        if (isBanklessError(error)) {
            throw new Error(formatBanklessError(error));
        }
        throw error;
    }
});

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Bankless Onchain MCP Server running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});