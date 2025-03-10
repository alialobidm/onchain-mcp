# Bankless Onchain MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-0.6.2-blue)

MCP (Model Context Protocol) server for blockchain data interaction through the Bankless API.

## Overview

The Bankless Onchain MCP Server provides a framework for interacting with on-chain data via the Bankless API. It implements the Model Context Protocol (MCP) to allow AI models to access blockchain state and event data in a structured way.

## Features

- Read blockchain contract state
- Get proxy implementation addresses
- Fetch event logs from smart contracts
- Build event topic signatures for filtering

## Tools

- **read_contract**
    - Read contract state from a blockchain
    - Input:
        - `network` (string, required): The blockchain network (e.g., "ethereum", "polygon")
        - `contract` (string, required): The contract address
        - `method` (string, required): The contract method to call
        - `inputs` (array, required): Input parameters for the method call, each containing:
            - `type` (string): The type of the input parameter (e.g., "address", "uint256")
            - `value` (any): The value of the input parameter
        - `outputs` (array, required): Expected output types, each containing:
            - `type` (string): The expected output type
    - Returns an array of contract call results

- **get_proxy**
    - Gets the proxy address for a given network and contract
    - Input:
        - `network` (string, required): The blockchain network (e.g., "ethereum", "base")
        - `contract` (string, required): The contract address
    - Returns the implementation address for the proxy contract

- **get_events**
    - Fetches event logs for a given network and filter criteria
    - Input:
        - `network` (string, required): The blockchain network (e.g., "ethereum", "base")
        - `addresses` (array, required): List of contract addresses to filter events
        - `topic` (string, required): Primary topic to filter events
        - `optionalTopics` (array, optional): Optional additional topics (can include null values)
    - Returns an object containing event logs matching the filter criteria

- **build_event_topic**
    - Builds an event topic signature based on event name and arguments
    - Input:
        - `network` (string, required): The blockchain network (e.g., "ethereum", "base")
        - `name` (string, required): Event name (e.g., "Transfer(address,address,uint256)")
        - `arguments` (array, required): Event arguments types, each containing:
            - `type` (string): The argument type (e.g., "address", "uint256")
    - Returns a string containing the keccak256 hash of the event signature

## Installation

```bash
npm install @bankless/onchain-mcp-server
```

## Usage

### Environment Setup

Before using the server, set your Bankless API token:

```bash
export BANKLESS_API_TOKEN=your_api_token_here
```

### Running the Server

The server can be run directly from the command line:

```bash
npx bankless-onchain-mcp-server
```

### Usage with LLM Tools

This server implements the Model Context Protocol (MCP), which allows it to be used as a tool provider for compatible AI models. Here are some example calls for each tool:

#### read_contract

```javascript
// Example call
{
  "name": "read_contract",
  "arguments": {
    "network": "ethereum",
    "contract": "0x1234...",
    "method": "balanceOf",
    "inputs": [
      { "type": "address", "value": "0xabcd..." }
    ],
    "outputs": [
      { "type": "uint256" }
    ]
  }
}

// Example response
[
  {
    "value": "1000000000000000000",
    "type": "uint256"
  }
]
```

#### get_proxy

```javascript
// Example call
{
  "name": "get_proxy",
  "arguments": {
    "network": "ethereum",
    "contract": "0x1234..."
  }
}

// Example response
{
  "implementation": "0xefgh..."
}
```

#### get_events

```javascript
// Example call
{
  "name": "get_events",
  "arguments": {
    "network": "ethereum",
    "addresses": ["0x1234..."],
    "topic": "0xabcd...",
    "optionalTopics": ["0xef01...", null]
  }
}

// Example response
{
  "result": [
    {
      "removed": false,
      "logIndex": 5,
      "transactionIndex": 2,
      "transactionHash": "0x123...",
      "blockHash": "0xabc...",
      "blockNumber": 12345678,
      "address": "0x1234...",
      "data": "0x...",
      "topics": ["0xabcd...", "0xef01...", "0x..."]
    }
  ]
}
```

#### build_event_topic

```javascript
// Example call
{
  "name": "build_event_topic",
  "arguments": {
    "network": "ethereum",
    "name": "Transfer(address,address,uint256)",
    "arguments": [
      { "type": "address" },
      { "type": "address" },
      { "type": "uint256" }
    ]
  }
}

// Example response
"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/Bankless/onchain-mcp.git
cd onchain-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Debug Mode

```bash
npm run debug
```

### Watch Mode (for development)

```bash
npm run watch
```

### Integration with AI Models

To integrate this server with AI applications that support MCP, add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "bankless": {
      "command": "node",
      "args": [
        "{ABSOLUTE PATH TO FILE HERE}/dist/src/index.js"
      ]
    }
  }
}
```

## Error Handling

The server provides specific error types for different scenarios:

- `BanklessValidationError`: Invalid input parameters
- `BanklessAuthenticationError`: API token issues
- `BanklessResourceNotFoundError`: Requested resource not found
- `BanklessRateLimitError`: API rate limit exceeded

## License

MIT