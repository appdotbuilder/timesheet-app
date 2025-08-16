import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type CreateTimesheetEntryInput } from '../schema';
import { createTimesheetEntry } from '../handlers/create_timesheet_entry';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateTimesheetEntryInput = {
  employee_name: 'John Doe',
  category: 'Ticket',
  ticket_number: 'T-123',
  line_items: 5
};

// Test input with minimal required fields
const minimalInput: CreateTimesheetEntryInput = {
  employee_name: 'Jane Smith',
  category: 'Meeting',
  ticket_number: null,
  line_items: 0 // Will use default from Zod schema
};

describe('createTimesheetEntry', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a timesheet entry with all fields', async () => {
    const result = await createTimesheetEntry(testInput);

    // Basic field validation
    expect(result.employee_name).toEqual('John Doe');
    expect(result.category).toEqual('Ticket');
    expect(result.ticket_number).toEqual('T-123');
    expect(result.line_items).toEqual(5);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);
    
    // Time-related fields
    expect(result.start_time).toBeInstanceOf(Date);
    expect(result.end_time).toBeNull();
    expect(result.duration_minutes).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a timesheet entry with minimal required fields', async () => {
    const result = await createTimesheetEntry(minimalInput);

    expect(result.employee_name).toEqual('Jane Smith');
    expect(result.category).toEqual('Meeting');
    expect(result.ticket_number).toBeNull();
    expect(result.line_items).toEqual(0);
    expect(result.id).toBeDefined();
    expect(result.start_time).toBeInstanceOf(Date);
    expect(result.end_time).toBeNull();
    expect(result.duration_minutes).toBeNull();
  });

  it('should save timesheet entry to database', async () => {
    const result = await createTimesheetEntry(testInput);

    // Query the database to verify the entry was saved
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, result.id))
      .execute();

    expect(entries).toHaveLength(1);
    const savedEntry = entries[0];
    
    expect(savedEntry.employee_name).toEqual('John Doe');
    expect(savedEntry.category).toEqual('Ticket');
    expect(savedEntry.ticket_number).toEqual('T-123');
    expect(savedEntry.line_items).toEqual(5);
    expect(savedEntry.start_time).toBeInstanceOf(Date);
    expect(savedEntry.end_time).toBeNull();
    expect(savedEntry.duration_minutes).toBeNull();
    expect(savedEntry.created_at).toBeInstanceOf(Date);
    expect(savedEntry.updated_at).toBeInstanceOf(Date);
  });

  it('should create entry with current timestamp as start_time', async () => {
    const beforeCreation = new Date();
    const result = await createTimesheetEntry(testInput);
    const afterCreation = new Date();

    // Verify start_time is within reasonable range of current time
    expect(result.start_time.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000); // Allow 1 second tolerance
    expect(result.start_time.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000);
  });

  it('should handle different category types', async () => {
    const categories = [
      'Ticket',
      'Koordinasi & kegiatan pendukung lainnya',
      'Meeting',
      'Adhoc/Project',
      'Development & Testing',
      'Other'
    ] as const;

    for (const category of categories) {
      const input: CreateTimesheetEntryInput = {
        employee_name: 'Test Employee',
        category: category,
        ticket_number: null,
        line_items: 1
      };

      const result = await createTimesheetEntry(input);
      expect(result.category).toEqual(category);
    }
  });

  it('should create multiple entries for same employee', async () => {
    const input1: CreateTimesheetEntryInput = {
      employee_name: 'Alice Johnson',
      category: 'Ticket',
      ticket_number: 'T-001',
      line_items: 2
    };

    const input2: CreateTimesheetEntryInput = {
      employee_name: 'Alice Johnson',
      category: 'Meeting',
      ticket_number: null,
      line_items: 0
    };

    const result1 = await createTimesheetEntry(input1);
    const result2 = await createTimesheetEntry(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.employee_name).toEqual(result2.employee_name);
    expect(result1.category).not.toEqual(result2.category);

    // Verify both entries exist in database
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.employee_name, 'Alice Johnson'))
      .execute();

    expect(entries).toHaveLength(2);
  });

  it('should handle null ticket_number correctly', async () => {
    const inputWithNullTicket: CreateTimesheetEntryInput = {
      employee_name: 'Bob Wilson',
      category: 'Other',
      ticket_number: null,
      line_items: 3
    };

    const result = await createTimesheetEntry(inputWithNullTicket);
    expect(result.ticket_number).toBeNull();

    // Verify in database
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, result.id))
      .execute();

    expect(entries[0].ticket_number).toBeNull();
  });
});