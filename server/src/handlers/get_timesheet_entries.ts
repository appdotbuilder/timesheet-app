import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type GetTimesheetEntriesByEmployeeInput, type TimesheetEntry } from '../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getTimesheetEntriesByEmployee(input: GetTimesheetEntriesByEmployeeInput): Promise<TimesheetEntry[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Always filter by employee_name
    conditions.push(eq(timesheetEntriesTable.employee_name, input.employee_name));

    // Add optional date range filters
    if (input.start_date !== undefined) {
      conditions.push(gte(timesheetEntriesTable.start_time, input.start_date));
    }

    if (input.end_date !== undefined) {
      conditions.push(lte(timesheetEntriesTable.start_time, input.end_date));
    }

    // Build the complete query in one go to avoid TypeScript issues
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const results = await db.select()
      .from(timesheetEntriesTable)
      .where(whereCondition)
      .orderBy(desc(timesheetEntriesTable.start_time))
      .execute();

    // Return results (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Failed to get timesheet entries by employee:', error);
    throw error;
  }
}