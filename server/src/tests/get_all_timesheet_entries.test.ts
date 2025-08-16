import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type CreateTimesheetEntryInput } from '../schema';
import { getAllTimesheetEntries } from '../handlers/get_all_timesheet_entries';

// Test input data
const testEntry1: CreateTimesheetEntryInput = {
  employee_name: 'John Doe',
  category: 'Ticket',
  ticket_number: 'TASK-001',
  line_items: 5
};

const testEntry2: CreateTimesheetEntryInput = {
  employee_name: 'Jane Smith',
  category: 'Meeting',
  ticket_number: null,
  line_items: 0
};

const testEntry3: CreateTimesheetEntryInput = {
  employee_name: 'Bob Wilson',
  category: 'Development & Testing',
  ticket_number: 'DEV-123',
  line_items: 10
};

describe('getAllTimesheetEntries', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no entries exist', async () => {
    const result = await getAllTimesheetEntries();

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all timesheet entries', async () => {
    // Create test entries
    const now = new Date();
    await db.insert(timesheetEntriesTable)
      .values([
        {
          employee_name: testEntry1.employee_name,
          start_time: now,
          category: testEntry1.category,
          ticket_number: testEntry1.ticket_number,
          line_items: testEntry1.line_items
        },
        {
          employee_name: testEntry2.employee_name,
          start_time: new Date(now.getTime() + 1000), // 1 second later
          category: testEntry2.category,
          ticket_number: testEntry2.ticket_number,
          line_items: testEntry2.line_items
        },
        {
          employee_name: testEntry3.employee_name,
          start_time: new Date(now.getTime() + 2000), // 2 seconds later
          category: testEntry3.category,
          ticket_number: testEntry3.ticket_number,
          line_items: testEntry3.line_items
        }
      ])
      .execute();

    const result = await getAllTimesheetEntries();

    expect(result).toHaveLength(3);
    
    // Verify all entries are returned with correct data
    expect(result.some(entry => entry.employee_name === 'John Doe')).toBe(true);
    expect(result.some(entry => entry.employee_name === 'Jane Smith')).toBe(true);
    expect(result.some(entry => entry.employee_name === 'Bob Wilson')).toBe(true);
    
    // Verify essential fields are present
    result.forEach(entry => {
      expect(entry.id).toBeDefined();
      expect(entry.employee_name).toBeDefined();
      expect(entry.start_time).toBeInstanceOf(Date);
      expect(entry.category).toBeDefined();
      expect(entry.line_items).toBeTypeOf('number');
      expect(entry.created_at).toBeInstanceOf(Date);
      expect(entry.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return entries ordered by start_time descending (newest first)', async () => {
    const baseTime = new Date();
    const entry1Time = new Date(baseTime.getTime() - 2000); // 2 seconds ago
    const entry2Time = new Date(baseTime.getTime() - 1000); // 1 second ago
    const entry3Time = new Date(baseTime.getTime()); // now

    // Insert entries in chronological order
    await db.insert(timesheetEntriesTable)
      .values([
        {
          employee_name: 'First Employee',
          start_time: entry1Time,
          category: 'Ticket',
          ticket_number: 'OLDEST',
          line_items: 1
        },
        {
          employee_name: 'Second Employee',
          start_time: entry2Time,
          category: 'Meeting',
          ticket_number: 'MIDDLE',
          line_items: 2
        },
        {
          employee_name: 'Third Employee',
          start_time: entry3Time,
          category: 'Development & Testing',
          ticket_number: 'NEWEST',
          line_items: 3
        }
      ])
      .execute();

    const result = await getAllTimesheetEntries();

    expect(result).toHaveLength(3);
    
    // Verify ordering - newest first
    expect(result[0].ticket_number).toEqual('NEWEST');
    expect(result[1].ticket_number).toEqual('MIDDLE');
    expect(result[2].ticket_number).toEqual('OLDEST');
    
    // Verify start_time ordering
    expect(result[0].start_time >= result[1].start_time).toBe(true);
    expect(result[1].start_time >= result[2].start_time).toBe(true);
  });

  it('should handle entries with different categories', async () => {
    const now = new Date();
    
    // Create entries with all different categories
    const categories = [
      'Ticket',
      'Koordinasi & kegiatan pendukung lainnya',
      'Meeting',
      'Adhoc/Project',
      'Development & Testing',
      'Other'
    ] as const;

    await db.insert(timesheetEntriesTable)
      .values(
        categories.map((category, index) => ({
          employee_name: `Employee ${index + 1}`,
          start_time: new Date(now.getTime() + index * 1000),
          category,
          ticket_number: `TASK-${index}`,
          line_items: index
        }))
      )
      .execute();

    const result = await getAllTimesheetEntries();

    expect(result).toHaveLength(6);
    
    // Verify all categories are present
    const resultCategories = result.map(entry => entry.category);
    categories.forEach(category => {
      expect(resultCategories).toContain(category);
    });
  });

  it('should handle entries with null values correctly', async () => {
    const now = new Date();
    
    // Create entries with null end_time, ticket_number, and duration_minutes
    await db.insert(timesheetEntriesTable)
      .values([
        {
          employee_name: 'Test Employee',
          start_time: now,
          end_time: null, // Active entry - not finished
          category: 'Meeting',
          ticket_number: null, // Meeting without ticket
          line_items: 0,
          duration_minutes: null // Not calculated yet
        }
      ])
      .execute();

    const result = await getAllTimesheetEntries();

    expect(result).toHaveLength(1);
    expect(result[0].employee_name).toEqual('Test Employee');
    expect(result[0].end_time).toBeNull();
    expect(result[0].ticket_number).toBeNull();
    expect(result[0].duration_minutes).toBeNull();
    expect(result[0].line_items).toEqual(0);
  });
});