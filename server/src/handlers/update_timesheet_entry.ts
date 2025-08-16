import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type UpdateTimesheetEntryInput, type TimesheetEntry } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateTimesheetEntry(input: UpdateTimesheetEntryInput): Promise<TimesheetEntry> {
  try {
    // First, check if the entry exists
    const existingEntry = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, input.id))
      .execute();

    if (existingEntry.length === 0) {
      throw new Error(`Timesheet entry with id ${input.id} not found`);
    }

    const current = existingEntry[0];

    // Prepare the update values
    const updateValues: Partial<typeof timesheetEntriesTable.$inferInsert> = {
      updated_at: new Date()
    };

    // Add optional fields if provided
    if (input.employee_name !== undefined) {
      updateValues.employee_name = input.employee_name;
    }

    if (input.category !== undefined) {
      updateValues.category = input.category;
    }

    if (input.ticket_number !== undefined) {
      updateValues.ticket_number = input.ticket_number;
    }

    if (input.line_items !== undefined) {
      updateValues.line_items = input.line_items;
    }

    if (input.end_time !== undefined) {
      updateValues.end_time = input.end_time;
      
      // Recalculate duration_minutes if end_time is being updated
      const startTime = current.start_time;
      const endTime = input.end_time;
      
      if (endTime && startTime) {
        const durationMs = endTime.getTime() - startTime.getTime();
        updateValues.duration_minutes = Math.round(durationMs / (1000 * 60)); // Convert to minutes
      } else {
        updateValues.duration_minutes = null;
      }
    }

    // Perform the update
    const result = await db.update(timesheetEntriesTable)
      .set(updateValues)
      .where(eq(timesheetEntriesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Update timesheet entry failed:', error);
    throw error;
  }
}