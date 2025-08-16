import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type DeleteTimesheetEntryInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function deleteTimesheetEntry(input: DeleteTimesheetEntryInput): Promise<{ success: boolean }> {
  try {
    // Delete the timesheet entry by ID
    const result = await db.delete(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, input.id))
      .returning({ id: timesheetEntriesTable.id })
      .execute();

    // Check if any rows were deleted
    if (result.length === 0) {
      // Entry not found - still return success to be idempotent
      return { success: true };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete timesheet entry failed:', error);
    throw error;
  }
}