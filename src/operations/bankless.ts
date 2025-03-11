import { z } from 'zod';
import axios from 'axios';
import { BanklessAuthenticationError, BanklessRateLimitError, BanklessResourceNotFoundError, BanklessValidationError } from '../common/banklessErrors.js';

const BASE_URL = 'https://api.bankless.com/';

// Schema for Input and Output types
export const InputSchema = z.object({
  type: z.string().describe('The type of the input parameter'),
  value: z.any().describe('The value of the input parameter')
});

export const OutputSchema = z.object({
  type: z.string().describe('The expected output type')
});

// Schema for read contract request
export const ReadContractSchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "polygon")'),
  contract: z.string().describe('The contract address'),
  method: z.string().describe('The contract method to call'),
  inputs: z.array(InputSchema).describe('Input parameters for the method call'),
  outputs: z.array(OutputSchema).describe('Expected output types')
});

// Schema for proxy request
export const GetProxySchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  contract: z.string().describe('The contract address'),
});

// Schema for event logs request
export const GetEventLogsSchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  addresses: z.array(z.string()).describe('List of contract addresses to filter events'),
  topic: z.string().describe('Primary topic to filter events'),
  optionalTopics: z.array(z.string().nullable()).optional().describe('Optional additional topics')
});

// Schema for building event topic
export const BuildEventTopicSchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  name: z.string().describe('Event name (e.g., "Transfer(address,address,uint256)")'),
  arguments: z.array(OutputSchema).describe('Event arguments types')
});

// Schema for get ABI request
export const GetAbiSchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  contract: z.string().describe('The contract address'),
});

// Schema for get source request
export const GetSourceSchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  contract: z.string().describe('The contract address'),
});

// Schema for transaction history request
export const TransactionHistorySchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  user: z.string().describe('The user address'),
  contract: z.string().nullable().optional().describe('The contract address (optional)'),
  methodId: z.string().nullable().optional().describe('The method ID to filter by (optional)'),
  startBlock: z.string().nullable().optional().describe('The starting block number (optional)'),
  includeData: z.boolean().default(true).describe('Whether to include transaction data')
});

// Result types
export type ContractCallResult = {
  value: any;
  type: string;
};

// Proxy type
export type Proxy = {
  implementation: string;
};

// Log result type
export type LogResult = {
  removed: boolean;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  address: string;
  data: string;
  type?: string;
  topics: string[];
  transactionIndexRaw: string;
  logIndexRaw: string;
  blockNumberRaw: string;
};

// EthLog type
export type EthLog = {
  id?: number;
  jsonrpc?: string;
  result: LogResult[];
  error?: any;
  rawResponse?: any;
  logs?: LogResult[];
};

// Contract ABI Response type
export type ContractAbiResponse = {
  status: string;
  message: string;
  result: string;
};

// Contract Source Result type
export type ContractSourceResult = {
  sourceCode: string;
  abi: string;
  contractName: string;
  compilerVersion: string;
  optimizationUsed: string;
  runs: string;
  constructorArguments: string;
  evmVersion: string;
  library: string;
  licenseType: string;
  proxy: string;
  implementation: string;
  swarmSource: string;
};

// Contract Source Response type
export type ContractSourceResponse = {
  status: string;
  message: string;
  result: ContractSourceResult[];
};

// Transaction History Response type
export type SimplifiedTransactionVO = {
  hash: string;
  data: string;
  network: string;
  timestamp: string;
};

/**
 * Read contract state from a blockchain
 */
export async function readContractState(
  network: string,
  contract: string,
  method: string,
  inputs: z.infer<typeof InputSchema>[],
  outputs: z.infer<typeof OutputSchema>[]
): Promise<ContractCallResult[]> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/contract/read`;
  
  try {
    const response = await axios.post(
      endpoint,
      {
        contract,
        method,
        inputs,
        outputs
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to read contract state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets the proxy address for a given network and contract.
 */
export async function getProxy(
  network: string,
  contract: string
): Promise<Proxy> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/contract/${contract}/find-proxy`;
  
  try {
    const response = await axios.get(
      endpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to get proxy information: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetches event logs for a given network and filter criteria.
 */
export async function getEvents(
  network: string,
  addresses: string[],
  topic: string,
  optionalTopics: (string | null)[] = []
): Promise<EthLog> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/events/logs`;
  
  try {
    const response = await axios.post(
      endpoint,
      {
        addresses,
        topic,
        optionalTopics: optionalTopics || []
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to fetch event logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Builds an event topic signature based on event name and arguments.
 */
export async function buildEventTopic(
  network: string,
  name: string,
  arguments_: z.infer<typeof OutputSchema>[]
): Promise<string> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/contract/build-event-topic`;
  
  try {
    const response = await axios.post(
      endpoint,
      {
        name,
        arguments: arguments_
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to build event topic: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets the ABI for a contract.
 */
export async function getAbi(
  network: string,
  contract: string
): Promise<ContractAbiResponse> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/get_abi/${contract}`;
  
  try {
    const response = await axios.get(
      endpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to get contract ABI: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets the source code for a contract.
 */
export async function getSource(
  network: string,
  contract: string
): Promise<ContractSourceResponse> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/get_source/${contract}`;
  
  try {
    const response = await axios.get(
      endpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to get contract source: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets transaction history for a user and optional contract.
 */
export async function getTransactionHistory(
  network: string,
  user: string,
  contract?: string | null,
  methodId?: string | null,
  startBlock?: string | null,
  includeData: boolean = true
): Promise<SimplifiedTransactionVO[]> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/internal/chains/${network}/transaction-history`;
  
  try {
    const response = await axios.post(
      endpoint,
      {
        user,
        contract,
        methodId,
        startBlock,
        includeData
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-BANKLESS-TOKEN': `${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Not Found: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new BanklessValidationError(`Validation Error: ${errorMessage}`, error.response?.data);
      } else if (statusCode === 429) {
        // Extract reset timestamp or default to 60 seconds from now
        const resetAt = new Date();
        resetAt.setSeconds(resetAt.getSeconds() + 60);
        throw new BanklessRateLimitError(`Rate Limit Exceeded: ${errorMessage}`, resetAt);
      }
      
      throw new Error(`Bankless API Error (${statusCode}): ${errorMessage}`);
    }
    throw new Error(`Failed to get transaction history: ${error instanceof Error ? error.message : String(error)}`);
  }
}