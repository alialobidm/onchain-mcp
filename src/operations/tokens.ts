import { z } from 'zod';
import axios from 'axios';
import { BanklessAuthenticationError, BanklessRateLimitError, BanklessResourceNotFoundError, BanklessValidationError } from '../common/banklessErrors.js';

const BASE_URL = 'https://api.bankless.com/mcp';

// Schema for native balance request
export const NativeBalanceSchema = z.object({
  network: z.string().describe('The blockchain network (e.g., "ethereum", "base")'),
  address: z.string().describe('The address to check the balance for')
});

/**
 * Fetches the native token balance for a given address on a specified blockchain.
 * 
 * @param network - The blockchain network (e.g., "ethereum")
 * @param address - The address to check the balance for
 * @returns The native token balance as a BigInt
 */
export async function getNativeBalance(
  network: string,
  address: string
): Promise<bigint> {
  const token = process.env.BANKLESS_API_TOKEN;
  
  if (!token) {
    throw new BanklessAuthenticationError('BANKLESS_API_TOKEN environment variable is not set');
  }

  const endpoint = `${BASE_URL}/chains/${network}/balance/${address}`;
  
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

    return BigInt(response.data.toString());
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 'unknown';
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 401 || statusCode === 403) {
        throw new BanklessAuthenticationError(`Authentication Failed: ${errorMessage}`);
      } else if (statusCode === 404) {
        throw new BanklessResourceNotFoundError(`Address not found: ${address}`);
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
    throw new Error(`Failed to get native balance: ${error instanceof Error ? error.message : String(error)}`);
  }
}