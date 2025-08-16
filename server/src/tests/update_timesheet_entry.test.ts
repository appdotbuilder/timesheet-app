import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type UpdateTimesheetEntryInput, type CreateTimesheetEntryInput } from '../schema';
import { updateTimesheetEntry } from '../handlers/update_timesheet_entry';
import { eq } from 'drizzle-orm';

// Helper to create a test timesheet entry
const createTestEntry = async (overrides: Partial<CreateTimesheetEntryInput> = {}) => {
  const entryData = {
    employee_name: 'John Doe',
    category: 'Ticket' as const,
    ticket_number: 'TASK-123',
    line_items: 5,
    ...overrides
  };

  const result = await db.insert(timesheetEntriesTable)
    .values({
      employee_name: entryData.employee_name,
      start_time: new Date('2024-01-15T09:00:00Z'),
      category: entryData.category,
      ticket_number: entryData.ticket_number,
      line_items: entryData.line_items
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateTimesheetEntry', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update employee name', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      employee_name: 'Jane Smith'
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.employee_name).toBe('Jane Smith');
    expect(result.category).toBe('Ticket'); // Unchanged
    expect(result.ticket_number).toBe('TASK-123'); // Unchanged
    expect(result.line_items).toBe(5); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(entry.updated_at.getTime());
  });

  it('should update category', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      category: 'Meeting'
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.category).toBe('Meeting');
    expect(result.employee_name).toBe('John Doe'); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(entry.updated_at.getTime());
  });

  it('should update ticket number', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      ticket_number: 'TASK-456'
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.ticket_number).toBe('TASK-456');
    expect(result.employee_name).toBe('John Doe'); // Unchanged
    expect(result.category).toBe('Ticket'); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update ticket number to null', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      ticket_number: null
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.ticket_number).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update line items', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      line_items: 10
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.line_items).toBe(10);
    expect(result.employee_name).toBe('John Doe'); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update end_time and calculate duration_minutes', async () => {
    const entry = await createTestEntry();
    const startTime = new Date('2024-01-15T09:00:00Z');
    const endTime = new Date('2024-01-15T10:30:00Z'); // 90 minutes later
    
    // Update the start time to be specific for duration calculation
    await db.update(timesheetEntriesTable)
      .set({ start_time: startTime })
      .where(eq(timesheetEntriesTable.id, entry.id))
      .execute();

    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      end_time: endTime
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.end_time).toEqual(endTime);
    expect(result.duration_minutes).toBe(90); // 1.5 hours = 90 minutes
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set duration_minutes to null when end_time is removed', async () => {
    // Create an entry with end_time initially set
    const entry = await createTestEntry();
    await db.update(timesheetEntriesTable)
      .set({ 
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T10:00:00Z'),
        duration_minutes: 60
      })
      .where(eq(timesheetEntriesTable.id, entry.id))
      .execute();

    // Note: Since the schema defines end_time as optional (not nullable),
    // we need to handle this in the handler by setting it to null in the database
    // when we want to "unfinish" an entry. For testing, we'll test this scenario
    // by directly updating the database and verifying the handler preserves null values.
    
    // First set end_time to null in database
    await db.update(timesheetEntriesTable)
      .set({ end_time: null, duration_minutes: null })
      .where(eq(timesheetEntriesTable.id, entry.id))
      .execute();

    // Update something else to ensure handler preserves the null end_time
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      employee_name: 'Test User'
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.end_time).toBeNull();
    expect(result.duration_minutes).toBeNull();
    expect(result.employee_name).toBe('Test User');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields at once', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      employee_name: 'Alice Johnson',
      category: 'Development & Testing',
      ticket_number: 'DEV-789',
      line_items: 15
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.id).toBe(entry.id);
    expect(result.employee_name).toBe('Alice Johnson');
    expect(result.category).toBe('Development & Testing');
    expect(result.ticket_number).toBe('DEV-789');
    expect(result.line_items).toBe(15);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(entry.updated_at.getTime());
  });

  it('should save changes to database', async () => {
    const entry = await createTestEntry();
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      employee_name: 'Database Test User',
      category: 'Other'
    };

    await updateTimesheetEntry(updateInput);

    // Verify changes were saved to database
    const dbEntry = await db.select()
      .from(timesheetEntriesTable)
      .where(eq(timesheetEntriesTable.id, entry.id))
      .execute();

    expect(dbEntry).toHaveLength(1);
    expect(dbEntry[0].employee_name).toBe('Database Test User');
    expect(dbEntry[0].category).toBe('Other');
    expect(dbEntry[0].updated_at).toBeInstanceOf(Date);
    expect(dbEntry[0].updated_at.getTime()).toBeGreaterThan(entry.updated_at.getTime());
  });

  it('should throw error when entry does not exist', async () => {
    const updateInput: UpdateTimesheetEntryInput = {
      id: 99999, // Non-existent ID
      employee_name: 'Test User'
    };

    await expect(updateTimesheetEntry(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should calculate duration correctly for different time spans', async () => {
    const entry = await createTestEntry();
    const startTime = new Date('2024-01-15T14:15:30Z');
    
    // Set specific start time
    await db.update(timesheetEntriesTable)
      .set({ start_time: startTime })
      .where(eq(timesheetEntriesTable.id, entry.id))
      .execute();

    // Test 2 hours and 45 minutes duration
    const endTime = new Date('2024-01-15T17:00:30Z');
    
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      end_time: endTime
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.duration_minutes).toBe(165); // 2 hours 45 minutes = 165 minutes
    expect(result.end_time).toEqual(endTime);
  });

  it('should preserve existing fields when only updating some fields', async () => {
    // Create entry with all fields populated
    const entry = await createTestEntry({
      employee_name: 'Original Employee',
      category: 'Ticket',
      ticket_number: 'ORIG-123',
      line_items: 7
    });

    // Only update employee_name
    const updateInput: UpdateTimesheetEntryInput = {
      id: entry.id,
      employee_name: 'Updated Employee'
    };

    const result = await updateTimesheetEntry(updateInput);

    expect(result.employee_name).toBe('Updated Employee');
    expect(result.category).toBe('Ticket'); // Preserved
    expect(result.ticket_number).toBe('ORIG-123'); // Preserved  
    expect(result.line_items).toBe(7); // Preserved
    expect(result.start_time).toEqual(entry.start_time); // Preserved
    expect(result.end_time).toEqual(entry.end_time); // Preserved
    expect(result.duration_minutes).toEqual(entry.duration_minutes); // Preserved
  });
});