import { pool } from "../db/database";

export interface CreditPackage {
  id: string;
  code: string;
  name: string;
  credits: number;
  amountPaise: number;
  currency: string;
  active: boolean;
  isTest?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Retrieve all currently active credit packages from the database.
 * If includeTest is false, returns only non-test public packages.
 */
export async function getActivePackages(includeTest = false): Promise<CreditPackage[]> {
  const query = includeTest
    ? `SELECT id, code, name, credits, amount_paise as "amountPaise",
              currency, active, is_test as "isTest", created_at as "createdAt", updated_at as "updatedAt"
       FROM credit_packages
       WHERE active = TRUE
       ORDER BY amount_paise ASC`
    : `SELECT id, code, name, credits, amount_paise as "amountPaise",
              currency, active, is_test as "isTest", created_at as "createdAt", updated_at as "updatedAt"
       FROM credit_packages
       WHERE active = TRUE AND is_test = FALSE
       ORDER BY amount_paise ASC`;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Look up a specific package by its unique code identifier.
 */
export async function getPackageByCode(code: string): Promise<CreditPackage | null> {
  const result = await pool.query(
    `SELECT id, code, name, credits, amount_paise as "amountPaise",
            currency, active, is_test as "isTest", created_at as "createdAt", updated_at as "updatedAt"
     FROM credit_packages
     WHERE code = $1`,
    [code]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

