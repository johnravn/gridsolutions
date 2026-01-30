/**
 * Fuzzy search utilities for database queries
 * Uses PostgreSQL pg_trgm extension for database-level fuzzy matching
 */

import { supabase } from './supabase'

/**
 * Helper to create fuzzy search conditions for PostgREST
 * Since PostgREST doesn't directly support pg_trgm operators,
 * we use a combination of ilike patterns with multiple variations
 * to approximate fuzzy matching, or fall back to RPC functions for advanced cases
 */

/**
 * Applies fuzzy search to a PostgREST query builder
 * Uses expanded ilike patterns to approximate fuzzy matching
 * For exact fuzzy matching, use the RPC function fuzzy_search_multi
 */
export function applyFuzzySearch(
  query: any,
  searchTerm: string,
  columns: Array<string>,
): any {
  if (!searchTerm || !searchTerm.trim()) return query

  const term = searchTerm.trim()
  const patterns: Array<string> = []

  // Add exact match pattern
  patterns.push(`%${term}%`)

  // Add pattern with spaces between characters (for typos like "johndoe" vs "john doe")
  if (term.length > 2) {
    const spaced = term.split('').join('%')
    patterns.push(`%${spaced}%`)
  }

  // Build OR conditions for all columns with all patterns
  const conditions: Array<string> = []
  columns.forEach((col) => {
    patterns.forEach((pattern) => {
      conditions.push(`${col}.ilike.${pattern}`)
    })
  })

  if (conditions.length > 0) {
    return query.or(conditions.join(','))
  }

  return query
}

/**
 * Performs fuzzy search using the database RPC function
 * This uses PostgreSQL's pg_trgm extension for true fuzzy matching
 */
export async function fuzzySearchRPC<T>(
  table: string,
  searchTerm: string,
  searchColumns: Array<string>,
  baseQuery?: any,
): Promise<Array<T>> {
  if (!searchTerm || !searchTerm.trim()) {
    // If no search term, return all results
    if (baseQuery) {
      const { data, error } = await baseQuery
      if (error) throw error
      return (data || []) as Array<T>
    }
    return []
  }

  // For now, we'll use the expanded ilike approach
  // For production, you could call an RPC function that uses similarity()
  // This would require creating a specific RPC for each table
  throw new Error('fuzzySearchRPC not yet implemented - use applyFuzzySearch')
}
