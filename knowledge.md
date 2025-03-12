# Bankless Onchain MCP Server: Project Knowledge Document

## Project Overview

The `onchain-mcp` submodule implements a Model Context Protocol (MCP) server for Bankless Onchain. This server serves as a middleware between AI models (LLMs) and blockchain data, allowing LLMs to read contract state, fetch events, and access transaction information across multiple blockchain networks.

## Technical Architecture

### Core Components

1. **MCP Server Implementation**
    - Built using TypeScript
    - Uses the `@modelcontextprotocol/sdk` for implementing the MCP standard
    - Exposes a standardized API for blockchain operations

2. **Server Transport**
    - Implemented as a stdio server transport interface
    - Communication with LLMs is handled through stdin/stdout

3. **Operational Modules**
    - Contracts: Reading contract state, fetching ABIs, proxies, and source code
    - Events: Fetching blockchain event logs and building event topic signatures
    - Transactions: Fetching transaction history and detailed transaction information

### Dependencies

- **Runtime Dependencies**
    - `@modelcontextprotocol/sdk`: Core SDK for implementing MCP
    - `axios`: HTTP client for API requests
    - `zod`: Schema validation
    - `zod-to-json-schema`: Converts Zod schemas to JSON Schema for tool documentation

- **Dev Dependencies**
    - `typescript`: For static type checking
    - `shx`: For cross-platform shell commands in npm scripts

## Key Functionality

### Contract Operations

1. **Read Contract State**
    - Allows reading state from any contract on supported blockchain networks
    - Supports method calls with typed inputs and outputs
    - Schema: `ReadContractSchema`

2. **Get Proxy Implementation**
    - Retrieves the implementation address for proxy contracts
    - Schema: `GetProxySchema`

3. **Get Contract ABI**
    - Fetches the Application Binary Interface (ABI) for a contract
    - Schema: `GetAbiSchema`

4. **Get Contract Source**
    - Retrieves the source code and compilation metadata for a contract
    - Schema: `GetSourceSchema`

### Event Operations

1. **Get Event Logs**
    - Fetches event logs filtered by contract addresses and event topics
    - Supports optional additional topic filters
    - Schema: `GetEventLogsSchema`

2. **Build Event Topic**
    - Creates an event signature hash (topic0) based on event name and parameter types
    - Schema: `BuildEventTopicSchema`

### Transaction Operations

1. **Get Transaction History**
    - Retrieves transaction history for a specific address
    - Supports optional filtering by contract, method ID, and starting block
    - Schema: `TransactionHistorySchema`

2. **Get Transaction Info**
    - Fetches detailed information about a specific transaction
    - Includes execution status, gas usage, and transaction receipt
    - Schema: `TransactionInfoSchema`

## API Integration

- **API Authentication**: Requires a Bankless API token stored in the `BANKLESS_API_TOKEN` environment variable
- **Base URL**: https://api.bankless.com/
- **Error Handling**: Comprehensive error handling with specific error classes:
    - `BanklessError`: Base error class
    - `BanklessValidationError`: For input validation errors
    - `BanklessAuthenticationError`: For authentication failures
    - `BanklessRateLimitError`: For rate limit issues (includes reset timestamp)
    - `BanklessResourceNotFoundError`: For 404 not found errors

## Request/Response Flow

1. **Tool Registration**
    - On startup, the server registers available tools with descriptions and input schemas
    - Uses `zodToJsonSchema` to convert Zod validation schemas to JSON Schema format

2. **Request Handling**
    - Receives tool call requests from the LLM
    - Validates input parameters using Zod schemas
    - Makes API calls to the Bankless API
    - Returns structured results to the LLM

3. **Error Formatting**
    - Formats errors in a user-friendly way for the LLM to understand
    - Preserves error type information to help LLMs retry or provide better guidance

## Usage Patterns

### Authentication

The server requires a Bankless API token set as an environment variable:

```typescript
const token = process.env.BANKLESS_API_TOKEN;
if (!token) {
  throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
}
```

### API Request Pattern

All API requests follow a similar pattern:

```typescript
try {
  const response = await axios.post/get(
    endpoint,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-BANKLESS-TOKEN': `${token}`
      }
    }
  );
  return response.data;
} catch (error) {
  // Standardized error handling
}
```

### Tool Invocation

LLMs can invoke tools using the MCP protocol:

```
<function_calls>
<invoke name="read_contract">
<parameter name="network">ethereum