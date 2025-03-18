#!/usr/bin/env node
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

import * as contracts from './operations/contracts.js';
import * as events from './operations/events.js';
import * as transactions from './operations/transactions.js';
import * as tokens from './operations/tokens.js';
import * as blocks from './operations/blocks.js';
import {VERSION} from "./common/version.js";
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
            resources: {},
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
            // Contract Tools
            {
                name: "read_contract",
                description: `Read contract state from a blockchain. important:  
                
                In case of a tuple, don't use type tuple, but specify the inner types (found in the source) in order. For nested structs, include the substructs types.
    
    Example: 
    struct DataTypeA {
    DataTypeB b;
    //the liquidity index. Expressed in ray
    uint128 liquidityIndex;
    }
    
    struct DataTypeB {
    address token;
    }
    
    results in outputs for function with return type DataTypeA (tuple in abi): outputs: [{"type": "address"}, {"type": "uint128"}]`,
                inputSchema: zodToJsonSchema(contracts.ReadContractSchema),
            },
            {
                name: "get_proxy",
                description: "Gets the proxy address for a given network and contract",
                inputSchema: zodToJsonSchema(contracts.GetProxySchema),
            },
            {
                name: "get_abi",
                description: "Gets the ABI for a given contract on a specific network",
                inputSchema: zodToJsonSchema(contracts.GetAbiSchema),
            },
            {
                name: "get_source",
                description: "Gets the source code for a given contract on a specific network",
                inputSchema: zodToJsonSchema(contracts.GetSourceSchema),
            },

            // Event Tools
            {
                name: "get_events",
                description: "Fetches event logs for a given network and filter criteria",
                inputSchema: zodToJsonSchema(events.GetEventLogsSchema),
            },
            {
                name: "build_event_topic",
                description: "Builds an event topic signature based on event name and arguments",
                inputSchema: zodToJsonSchema(events.BuildEventTopicSchema),
            },

            // Transaction Tools
            {
                name: "get_transaction_history_for_user",
                description: "Gets transaction history for a user and optional contract",
                inputSchema: zodToJsonSchema(transactions.TransactionHistorySchema),
            },
            {
                name: "get_transaction_info",
                description: "Gets detailed information about a specific transaction",
                inputSchema: zodToJsonSchema(transactions.TransactionInfoSchema),
            },
            
            // Token Tools
            {
                name: "get_token_balances_on_network",
                description: "Gets all token balances for a given address on a specific network",
                inputSchema: zodToJsonSchema(tokens.TokenBalancesOnNetworkSchema),
            },
            
            // Block Tools
            {
                name: "get_block_info",
                description: "Gets detailed information about a specific block by number or hash",
                inputSchema: zodToJsonSchema(blocks.BlockInfoSchema),
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
            // Contract Tools
            case "read_contract": {
                const args = contracts.ReadContractSchema.parse(request.params.arguments);
                const result = await contracts.readContractState(
                    args.network,
                    args.contract,
                    args.method,
                    args.inputs,
                    args.outputs
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            case "get_proxy": {
                const args = contracts.GetProxySchema.parse(request.params.arguments);
                const result = await contracts.getProxy(
                    args.network,
                    args.contract
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            case "get_abi": {
                const args = contracts.GetAbiSchema.parse(request.params.arguments);
                const result = await contracts.getAbi(
                    args.network,
                    args.contract
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            case "get_source": {
                const args = contracts.GetSourceSchema.parse(request.params.arguments);
                const result = await contracts.getSource(
                    args.network,
                    args.contract
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }

            // Event Tools
            case "get_events": {
                const args = events.GetEventLogsSchema.parse(request.params.arguments);
                const result = await events.getEvents(
                    args.network,
                    args.addresses,
                    args.topic,
                    args.optionalTopics,
                    args.fromBlock,
                    args.toBlock
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            case "build_event_topic": {
                const args = events.BuildEventTopicSchema.parse(request.params.arguments);
                const result = await events.buildEventTopic(
                    args.network,
                    args.name,
                    args.arguments
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }

            // Transaction Tools
            case "get_transaction_history_for_user": {
                const args = transactions.TransactionHistorySchema.parse(request.params.arguments);
                const result = await transactions.getTransactionHistory(
                    args.network,
                    args.user,
                    args.contract,
                    args.methodId,
                    args.startBlock,
                    args.includeData
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            case "get_transaction_info": {
                const args = transactions.TransactionInfoSchema.parse(request.params.arguments);
                const result = await transactions.getTransactionInfo(
                    args.network,
                    args.txHash
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            
            // Token Tools
            case "get_token_balances_on_network": {
                const args = tokens.TokenBalancesOnNetworkSchema.parse(request.params.arguments);
                const result = await tokens.getTokenBalancesOnNetwork(
                    args.network,
                    args.address
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
                };
            }
            
            // Block Tools
            case "get_block_info": {
                const args = blocks.BlockInfoSchema.parse(request.params.arguments);
                const result = await blocks.getBlockInfo(
                    args.network,
                    args.blockId
                );
                return {
                    content: [{type: "text", text: JSON.stringify(result, null, 2)}],
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