import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type GetTimesheetEntriesByEmployeeInput } from '../schema';
import { getTimesheetEntriesByEmployee } from '../handlers/get_timesheet_entries';

describe('getTimesheetEntriesByEmployee', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test data for multiple employees
  const createTestEntries = async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: 'John Doe',
        start_time: now,
        end_time: oneHourAgo,
        category: 'Ticket',
        ticket_number: 'TICK-001',
        line_items: 5,
        duration_minutes: 60
      },
      {
        employee_name: 'John Doe',
        start_time: yesterday,
        end_time: null,
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: null
      },
      {
        employee_name: 'John Doe',
        start_time: twoDaysAgo,
        end_time: twoHoursAgo,
        category: 'Development & Testing',
        ticket_number: 'TICK-002',
        line_items: 10,
        duration_minutes: 120
      },
      {
        employee_name: 'Jane Smith',
        start_time: now,
        end_time: oneHourAgo,
        category: 'Other',
        ticket_number: null,
        line_items: 3,
        duration_minutes: 60
      }
    ]).execute();
  };

  it('should get all entries for an employee ordered by start_time desc', async () => {
    await createTestEntries();

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'John Doe'
    };

    const results = await getTimesheetEntriesByEmployee(input);

    expect(results).toHaveLength(3);
    expect(results[0].employee_name).toEqual('John Doe');
    expect(results[1].employee_name).toEqual('John Doe');
    expect(results[2].employee_name).toEqual('John Doe');

    // Verify ordering - newest first (results are ordered by start_time desc)
    expect(results[0].start_time >= results[1].start_time).toBe(true);
    expect(results[1].start_time >= results[2].start_time).toBe(true);

    // Verify different categories are present
    const categories = results.map(r => r.category);
    expect(categories).toContain('Ticket');
    expect(categories).toContain('Meeting');
    expect(categories).toContain('Development & Testing');
  });

  it('should return empty array for non-existent employee', async () => {
    await createTestEntries();

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'Non Existent'
    };

    const results = await getTimesheetEntriesByEmployee(input);

    expect(results).toHaveLength(0);
  });

  it('should filter by start_date when provided', async () => {
    await createTestEntries();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'John Doe',
      start_date: yesterday
    };

    const results = await getTimesheetEntriesByEmployee(input);

    // Should exclude entries from two days ago
    expect(results.length).toBeLessThan(3);
    results.forEach(entry => {
      expect(entry.start_time >= yesterday).toBe(true);
    });
  });

  it('should filter by end_date when provided', async () => {
    await createTestEntries();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'John Doe',
      end_date: yesterday
    };

    const results = await getTimesheetEntriesByEmployee(input);

    // Should only include entries from two days ago or earlier
    results.forEach(entry => {
      expect(entry.start_time <= yesterday).toBe(true);
    });
  });

  it('should filter by both start_date and end_date when provided', async () => {
    await createTestEntries();

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'John Doe',
      start_date: threeDaysAgo,
      end_date: oneDayAgo
    };

    const results = await getTimesheetEntriesByEmployee(input);

    // Should include entries within the date range
    results.forEach(entry => {
      expect(entry.start_time >= threeDaysAgo).toBe(true);
      expect(entry.start_time <= oneDayAgo).toBe(true);
    });
  });

  it('should handle entries with null values correctly', async () => {
    await createTestEntries();

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'John Doe'
    };

    const results = await getTimesheetEntriesByEmployee(input);

    // Find the meeting entry which has null end_time and ticket_number
    const meetingEntry = results.find(entry => entry.category === 'Meeting');
    expect(meetingEntry).toBeDefined();
    expect(meetingEntry!.end_time).toBeNull();
    expect(meetingEntry!.ticket_number).toBeNull();
    expect(meetingEntry!.duration_minutes).toBeNull();
    expect(meetingEntry!.line_items).toEqual(0);
  });

  it('should return results with correct data types', async () => {
    await createTestEntries();

    const input: GetTimesheetEntriesByEmployeeInput = {
      employee_name: 'John Doe'
    };

    const results = await getTimesheetEntriesByEmployee(input);

    expect(results.length).toBeGreaterThan(0);
    
    const entry = results[0];
    expect(typeof entry.id).toBe('number');
    expect(typeof entry.employee_name).toBe('string');
    expect(entry.start_time).toBeInstanceOf(Date);
    expect(typeof entry.category).toBe('string');
    expect(typeof entry.line_items).toBe('number');
    expect(entry.created_at).toBeInstanceOf(Date);
    expect(entry.updated_at).toBeInstanceOf(Date);
    
    // Optional fields can be null
    if (entry.end_time !== null) {
      expect(entry.end_time).toBeInstanceOf(Date);
    }
    if (entry.duration_minutes !== null) {
      expect(typeof entry.duration_minutes).toBe('number');
    }
  });
});