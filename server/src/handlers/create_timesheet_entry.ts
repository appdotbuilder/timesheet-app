import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type CreateTimesheetEntryInput, type TimesheetEntry } from '../schema';

export const createTimesheetEntry = async (input: CreateTimesheetEntryInput): Promise<TimesheetEntry> => {
  try {
    // Insert new timesheet entry record with current timestamp as start_time
    const result = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: input.employee_name,
        start_time: new Date(), // Current timestamp when 'Mulai' is clicked
        end_time: null, // No end time initially - entry is still in progress
        category: input.category,
        ticket_number: input.ticket_number || null,
        line_items: input.line_items, // Default value handled by Zod schema
        duration_minutes: null, // Will be calculated when entry is stopped
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Timesheet entry creation failed:', error);
    throw error;
  }
};