import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type StopTimesheetEntryInput } from '../schema';
import { stopTimesheetEntry } from '../handlers/stop_timesheet_entry';
import { eq } from 'drizzle-orm';

describe('stopTimesheetEntry', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should stop an active timesheet entry', async () => {
    // Create an active timesheet entry first
    const startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'John Doe',
        start_time: startTime,
        end_time: null, // Active entry
        category: 'Ticket',
        ticket_number: 'TASK-123',
        line_items: 5,
        duration_minutes: null
      })
      .returning()
      .execute();

    const entryId = insertResult[0].id;
    const testInput: StopTimesheetEntryInput = { id: entryId };

    const beforeStop = Date.now();
    const result = await stopTimesheetEntry(testInput);
    const afterStop = Date.now();

    // Verify the returned result
    expect(result.id).toEqual(entryId);
    expect(result.employee_name).toEqual('John Doe');
    expect(result.start_time).toEqual(startTime);
    expect(result.end_time).toBeInstanceOf(Date);
    expect(result.category).toEqual('Ticket');
    expect(result.ticket_number).toEqual('TASK-123');
    expect(result.line_items).toEqual(5);
    expect(result.duration_minutes).toBeGreaterThan(25); // Should be around 30 minutes
    expect(result.duration_minutes).toBeLessThan(35);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify end_time is within reasonable bounds
    expect(result.end_time!.getTime()).toBeGreaterThanOrEqual(beforeStop);
    expect(result.end_time!.getTime()).toBeLessThanOrEqual(afterStop);
  });

  it('should save stopped entry to database correctly', async () => {
    // Create an active timesheet entry
    const startTime = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'Jane Smith',
        start_time: startTime,
        end_time: null,
        category: 'Meeting',
        ticket_number: null,
        line_items: 0
      })
      .returning()
      .execute();

    const entryId = insertResult[0].id;
    const testInput: StopTimesheetEntryInput = { id: entryId };

    await stopTimesheetEntry(testInput);

    // Query the database directly to verify the update
    const updatedEntries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, entryId))
      .execute();

    expect(updatedEntries).toHaveLength(1);
    const updatedEntry = updatedEntries[0];

    expect(updatedEntry.id).toEqual(entryId);
    expect(updatedEntry.employee_name).toEqual('Jane Smith');
    expect(updatedEntry.start_time).toEqual(startTime);
    expect(updatedEntry.end_time).toBeInstanceOf(Date);
    expect(updatedEntry.category).toEqual('Meeting');
    expect(updatedEntry.ticket_number).toBeNull();
    expect(updatedEntry.line_items).toEqual(0);
    expect(updatedEntry.duration_minutes).toBeGreaterThan(40);
    expect(updatedEntry.duration_minutes).toBeLessThan(50);
    expect(updatedEntry.updated_at).toBeInstanceOf(Date);
  });

  it('should calculate duration correctly for different time spans', async () => {
    // Test with 2 hours ago
    const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'Test Employee',
        start_time: startTime,
        end_time: null,
        category: 'Development & Testing',
        ticket_number: 'DEV-456',
        line_items: 10
      })
      .returning()
      .execute();

    const entryId = insertResult[0].id;
    const testInput: StopTimesheetEntryInput = { id: entryId };

    const result = await stopTimesheetEntry(testInput);

    // Should be approximately 120 minutes (2 hours)
    expect(result.duration_minutes).toBeGreaterThan(115);
    expect(result.duration_minutes).toBeLessThan(125);
  });

  it('should throw error for non-existent timesheet entry', async () => {
    const testInput: StopTimesheetEntryInput = { id: 99999 };

    await expect(stopTimesheetEntry(testInput)).rejects.toThrow(/not found/i);
  });

  it('should throw error for already stopped timesheet entry', async () => {
    // Create a completed timesheet entry
    const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const endTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'Already Stopped Employee',
        start_time: startTime,
        end_time: endTime, // Already has end_time
        category: 'Other',
        ticket_number: null,
        line_items: 2,
        duration_minutes: 30
      })
      .returning()
      .execute();

    const entryId = insertResult[0].id;
    const testInput: StopTimesheetEntryInput = { id: entryId };

    await expect(stopTimesheetEntry(testInput)).rejects.toThrow(/already stopped/i);
  });

  it('should handle entries with different categories correctly', async () => {
    // Test with 'Koordinasi & kegiatan pendukung lainnya' category
    const startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
    const insertResult = await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'Koordinasi Employee',
        start_time: startTime,
        end_time: null,
        category: 'Koordinasi & kegiatan pendukung lainnya',
        ticket_number: null,
        line_items: 1
      })
      .returning()
      .execute();

    const entryId = insertResult[0].id;
    const testInput: StopTimesheetEntryInput = { id: entryId };

    const result = await stopTimesheetEntry(testInput);

    expect(result.category).toEqual('Koordinasi & kegiatan pendukung lainnya');
    expect(result.duration_minutes).toBeGreaterThan(10);
    expect(result.duration_minutes).toBeLessThan(20);
  });
});