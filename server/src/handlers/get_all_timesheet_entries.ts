import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { desc } from 'drizzle-orm';
import { type TimesheetEntry } from '../schema';

export const getAllTimesheetEntries = async (): Promise<TimesheetEntry[]> => {
  try {
    // Fetch all timesheet entries ordered by start_time descending (newest first)
    const results = await db
      .select()
      .from(timesheetEntriesTable)
      .orderBy(desc(timesheetEntriesTable.start_time))
      .execute();

    // Return results - no numeric conversions needed for timesheet entries
    return results;
  } catch (error) {
    console.error('Failed to fetch all timesheet entries:', error);
    throw error;
  }
};