import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type HourlyReportInput } from '../schema';
import { getHourlyReport } from '../handlers/get_hourly_report';

describe('getHourlyReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testInput: HourlyReportInput = {
    employee_name: 'John Doe',
    date: new Date('2024-01-15T00:00:00.000Z')
  };

  it('should return empty array when no entries exist', async () => {
    const result = await getHourlyReport(testInput);

    expect(result).toEqual([]);
  });

  it('should return empty array when employee has no entries for the date', async () => {
    // Create entry for different employee
    await db.insert(timesheetEntriesTable).values({
      employee_name: 'Jane Smith',
      start_time: new Date('2024-01-15T09:00:00.000Z'),
      end_time: new Date('2024-01-15T10:30:00.000Z'),
      category: 'Ticket',
      ticket_number: 'TK-123',
      line_items: 5,
      duration_minutes: 90
    }).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toEqual([]);
  });

  it('should return empty array when employee has no entries for the specific date', async () => {
    // Create entry for different date
    await db.insert(timesheetEntriesTable).values({
      employee_name: 'John Doe',
      start_time: new Date('2024-01-16T09:00:00.000Z'),
      end_time: new Date('2024-01-16T10:30:00.000Z'),
      category: 'Ticket',
      ticket_number: 'TK-123',
      line_items: 5,
      duration_minutes: 90
    }).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toEqual([]);
  });

  it('should generate hourly report for single completed entry within one hour', async () => {
    // Create a 90-minute entry from 9:00 to 10:30
    await db.insert(timesheetEntriesTable).values({
      employee_name: 'John Doe',
      start_time: new Date('2024-01-15T09:00:00.000Z'),
      end_time: new Date('2024-01-15T09:30:00.000Z'),
      category: 'Ticket',
      ticket_number: 'TK-123',
      line_items: 5,
      duration_minutes: 30
    }).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      hour: 9,
      total_minutes: 30,
      activities: [{
        category: 'Ticket',
        minutes: 30,
        entries: 1
      }]
    });
  });

  it('should generate hourly report for entry spanning multiple hours', async () => {
    // Create a 90-minute entry from 9:30 to 11:00 (spans 2 hours: 9, 10)
    await db.insert(timesheetEntriesTable).values({
      employee_name: 'John Doe',
      start_time: new Date('2024-01-15T09:30:00.000Z'),
      end_time: new Date('2024-01-15T11:00:00.000Z'),
      category: 'Meeting',
      ticket_number: null,
      line_items: 0,
      duration_minutes: 90
    }).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(2);
    
    // Hour 9: 30 minutes (from 9:30 to 10:00)
    expect(result[0]).toEqual({
      hour: 9,
      total_minutes: 30,
      activities: [{
        category: 'Meeting',
        minutes: 30,
        entries: 1 // Entry counted only in first hour
      }]
    });

    // Hour 10: 60 minutes (full hour from 10:00 to 11:00)
    expect(result[1]).toEqual({
      hour: 10,
      total_minutes: 60,
      activities: [{
        category: 'Meeting',
        minutes: 60,
        entries: 0 // Entry not counted again
      }]
    });
  });

  it('should aggregate multiple activities within the same hour', async () => {
    // Create two entries in the same hour
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T09:00:00.000Z'),
        end_time: new Date('2024-01-15T09:30:00.000Z'),
        category: 'Ticket',
        ticket_number: 'TK-123',
        line_items: 5,
        duration_minutes: 30
      },
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T09:35:00.000Z'),
        end_time: new Date('2024-01-15T09:50:00.000Z'),
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 15
      }
    ]).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(1);
    expect(result[0].hour).toBe(9);
    expect(result[0].total_minutes).toBe(45);
    expect(result[0].activities).toHaveLength(2);

    // Should be sorted by minutes descending
    expect(result[0].activities[0]).toEqual({
      category: 'Ticket',
      minutes: 30,
      entries: 1
    });
    expect(result[0].activities[1]).toEqual({
      category: 'Meeting',
      minutes: 15,
      entries: 1
    });
  });

  it('should aggregate same category activities within the same hour', async () => {
    // Create two Ticket entries in the same hour
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T09:00:00.000Z'),
        end_time: new Date('2024-01-15T09:20:00.000Z'),
        category: 'Ticket',
        ticket_number: 'TK-123',
        line_items: 5,
        duration_minutes: 20
      },
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T09:25:00.000Z'),
        end_time: new Date('2024-01-15T09:50:00.000Z'),
        category: 'Ticket',
        ticket_number: 'TK-456',
        line_items: 3,
        duration_minutes: 25
      }
    ]).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      hour: 9,
      total_minutes: 45,
      activities: [{
        category: 'Ticket',
        minutes: 45,
        entries: 2
      }]
    });
  });

  it('should handle entries across different hours and sort by hour', async () => {
    // Create entries in different hours
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T14:00:00.000Z'),
        end_time: new Date('2024-01-15T14:30:00.000Z'),
        category: 'Development & Testing',
        ticket_number: 'TK-789',
        line_items: 10,
        duration_minutes: 30
      },
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T08:15:00.000Z'),
        end_time: new Date('2024-01-15T08:45:00.000Z'),
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 30
      },
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T11:00:00.000Z'),
        end_time: new Date('2024-01-15T12:00:00.000Z'),
        category: 'Adhoc/Project',
        ticket_number: null,
        line_items: 2,
        duration_minutes: 60
      }
    ]).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(3);
    
    // Should be sorted by hour ascending
    expect(result[0].hour).toBe(8);
    expect(result[1].hour).toBe(11);
    expect(result[2].hour).toBe(14);

    // Verify each hour's data
    expect(result[0].total_minutes).toBe(30);
    expect(result[0].activities[0].category).toBe('Meeting');

    expect(result[1].total_minutes).toBe(60);
    expect(result[1].activities[0].category).toBe('Adhoc/Project');

    expect(result[2].total_minutes).toBe(30);
    expect(result[2].activities[0].category).toBe('Development & Testing');
  });

  it('should exclude incomplete entries without end_time', async () => {
    // Create one complete and one incomplete entry
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T09:00:00.000Z'),
        end_time: new Date('2024-01-15T09:30:00.000Z'),
        category: 'Ticket',
        ticket_number: 'TK-123',
        line_items: 5,
        duration_minutes: 30
      },
      {
        employee_name: 'John Doe',
        start_time: new Date('2024-01-15T10:00:00.000Z'),
        end_time: null, // Incomplete entry
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: null
      }
    ]).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(1);
    expect(result[0].hour).toBe(9);
    expect(result[0].total_minutes).toBe(30);
    expect(result[0].activities).toHaveLength(1);
    expect(result[0].activities[0].category).toBe('Ticket');
  });

  it('should handle all category types', async () => {
    const categories = [
      'Ticket',
      'Koordinasi & kegiatan pendukung lainnya',
      'Meeting',
      'Adhoc/Project',
      'Development & Testing',
      'Other'
    ] as const;

    // Create entries for each category
    const entries = categories.map((category, index) => ({
      employee_name: 'John Doe',
      start_time: new Date(`2024-01-15T${String(9 + index).padStart(2, '0')}:00:00.000Z`),
      end_time: new Date(`2024-01-15T${String(9 + index).padStart(2, '0')}:15:00.000Z`),
      category,
      ticket_number: category === 'Ticket' ? 'TK-123' : null,
      line_items: index + 1,
      duration_minutes: 15
    }));

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getHourlyReport(testInput);

    expect(result).toHaveLength(6);

    // Verify each category is represented
    const resultCategories = result.flatMap(hour => hour.activities.map(a => a.category));
    categories.forEach(category => {
      expect(resultCategories).toContain(category);
    });
  });
});