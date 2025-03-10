import { z } from 'zod';
import axios from 'axios';
import { BanklessAuthenticationError, BanklessRateLimitError, BanklessResourceNotFoundError, BanklessValidationError } from '../common/banklessErrors.js';

const BASE_URL = 'https://api.bankless.com/internal/chains';

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

// Result type
export type ContractCallResult = {
  value: any;
  type: string;
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

  const endpoint = `${BASE_URL}/${network}/contract/read`;
  
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
          'Authorization': `Bearer ${token}`
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
