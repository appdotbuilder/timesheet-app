import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type DeleteTimesheetEntryInput } from '../schema';
import { deleteTimesheetEntry } from '../handlers/delete_timesheet_entry';
import { eq } from 'drizzle-orm';

describe('deleteTimesheetEntry', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete an existing timesheet entry', async () => {
    // Create a test entry first
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T10:30:00Z'),
        category: 'Development & Testing',
        ticket_number: 'TICKET-123',
        line_items: 5,
        duration_minutes: 90
      })
      .returning({ id: timesheetEntriesTable.id })
      .execute();

    const entryId = insertResult[0].id;

    // Delete the entry
    const input: DeleteTimesheetEntryInput = { id: entryId };
    const result = await deleteTimesheetEntry(input);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify entry no longer exists in database
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, entryId))
      .execute();

    expect(entries).toHaveLength(0);
  });

  it('should return success when deleting non-existent entry (idempotent)', async () => {
    const nonExistentId = 99999;
    const input: DeleteTimesheetEntryInput = { id: nonExistentId };
    
    const result = await deleteTimesheetEntry(input);

    expect(result.success).toBe(true);
  });

  it('should delete only the specified entry and leave others intact', async () => {
    // Create multiple test entries
    const insertResults = await db.insert(timesheetEntriesTable)
      .values([
        {
          employee_name: 'John Doe',
          start_time: new Date('2024-01-15T09:00:00Z'),
          end_time: new Date('2024-01-15T10:00:00Z'),
          category: 'Development & Testing',
          ticket_number: 'TICKET-123',
          line_items: 3,
          duration_minutes: 60
        },
        {
          employee_name: 'Jane Smith',
          start_time: new Date('2024-01-15T10:00:00Z'),
          end_time: new Date('2024-01-15T11:30:00Z'),
          category: 'Meeting',
          ticket_number: null,
          line_items: 1,
          duration_minutes: 90
        },
        {
          employee_name: 'Bob Wilson',
          start_time: new Date('2024-01-15T14:00:00Z'),
          category: 'Ticket',
          ticket_number: 'TICKET-456',
          line_items: 2
        }
      ])
      .returning({ id: timesheetEntriesTable.id })
      .execute();

    const entryToDelete = insertResults[1].id; // Delete Jane's entry
    const input: DeleteTimesheetEntryInput = { id: entryToDelete };

    // Delete the middle entry
    const result = await deleteTimesheetEntry(input);
    expect(result.success).toBe(true);

    // Verify only the specified entry was deleted
    const remainingEntries = await db.select()
      .from(timesheetEntriesTable)
      .execute();

    expect(remainingEntries).toHaveLength(2);
    
    // Verify the correct entries remain
    const remainingIds = remainingEntries.map(entry => entry.id);
    expect(remainingIds).toContain(insertResults[0].id); // John's entry
    expect(remainingIds).toContain(insertResults[2].id); // Bob's entry
    expect(remainingIds).not.toContain(entryToDelete); // Jane's entry deleted

    // Verify specific content of remaining entries
    const johnEntry = remainingEntries.find(e => e.employee_name === 'John Doe');
    const bobEntry = remainingEntries.find(e => e.employee_name === 'Bob Wilson');
    
    expect(johnEntry).toBeDefined();
    expect(johnEntry?.ticket_number).toBe('TICKET-123');
    expect(johnEntry?.duration_minutes).toBe(60);
    
    expect(bobEntry).toBeDefined();
    expect(bobEntry?.ticket_number).toBe('TICKET-456');
    expect(bobEntry?.end_time).toBeNull(); // Still incomplete entry
  });

  it('should handle deletion of incomplete timesheet entries', async () => {
    // Create an incomplete entry (no end_time, no duration)
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'Active Worker',
        start_time: new Date('2024-01-15T09:00:00Z'),
        category: 'Development & Testing',
        ticket_number: 'ACTIVE-001',
        line_items: 1
        // end_time and duration_minutes are null (incomplete entry)
      })
      .returning({ id: timesheetEntriesTable.id })
      .execute();

    const entryId = insertResult[0].id;
    const input: DeleteTimesheetEntryInput = { id: entryId };

    // Delete the incomplete entry
    const result = await deleteTimesheetEntry(input);
    expect(result.success).toBe(true);

    // Verify entry was deleted
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, entryId))
      .execute();

    expect(entries).toHaveLength(0);
  });
});