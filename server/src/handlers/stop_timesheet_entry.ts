import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type StopTimesheetEntryInput, type TimesheetEntry } from '../schema';
import { eq } from 'drizzle-orm';

export const stopTimesheetEntry = async (input: StopTimesheetEntryInput): Promise<TimesheetEntry> => {
  try {
    const endTime = new Date();

    // First, get the current entry to calculate duration
    const existingEntries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, input.id))
      .execute();

    if (existingEntries.length === 0) {
      throw new Error(`Timesheet entry with id ${input.id} not found`);
    }

    const existingEntry = existingEntries[0];

    // Check if entry is already stopped
    if (existingEntry.end_time) {
      throw new Error(`Timesheet entry with id ${input.id} is already stopped`);
    }

    // Calculate duration in minutes
    const startTime = new Date(existingEntry.start_time);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Update the entry with end_time, duration, and updated_at
    const result = await db.update(timesheetEntriesTable)
      .set({
        end_time: endTime,
        duration_minutes: durationMinutes,
        updated_at: endTime
      })
      .where(eq(timesheetEntriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Failed to update timesheet entry with id ${input.id}`);
    }

    return result[0];
  } catch (error) {
    console.error('Stop timesheet entry failed:', error);
    throw error;
  }
};