import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type WeeklyReportInput, type CreateTimesheetEntryInput } from '../schema';
import { getWeeklyReport } from '../handlers/get_weekly_report';

// Test input for weekly report
const testInput: WeeklyReportInput = {
  employee_name: 'John Doe',
  week_start: new Date('2024-01-01T00:00:00Z') // Monday
};

// Helper function to create a timesheet entry with specific dates
const createTestEntry = async (
  employee_name: string,
  startTime: Date,
  endTime: Date,
  category: 'Ticket' | 'Meeting' = 'Ticket',
  durationMinutes: number
) => {
  const result = await db.insert(timesheetEntriesTable)
    .values({
      employee_name,
      start_time: startTime,
      end_time: endTime,
      category,
      ticket_number: 'TEST-123',
      line_items: 1,
      duration_minutes: durationMinutes
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('getWeeklyReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate weekly report with no entries', async () => {
    const result = await getWeeklyReport(testInput);

    expect(result.week_start).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    expect(result.week_end).toEqual(new Date('2024-01-07T23:59:59.999Z'));
    expect(result.total_hours).toBe(0);
    expect(result.total_minutes).toBe(0);
    expect(result.entries_count).toBe(0);
    expect(result.daily_breakdown).toHaveLength(7);

    // Check each day has zero values
    result.daily_breakdown.forEach((day, index) => {
      const expectedDate = new Date('2024-01-01T00:00:00.000Z');
      expectedDate.setDate(expectedDate.getDate() + index);
      expect(day.date).toEqual(expectedDate);
      expect(day.total_hours).toBe(0);
      expect(day.total_minutes).toBe(0);
      expect(day.entries_count).toBe(0);
    });
  });

  it('should calculate weekly report with single completed entry', async () => {
    // Create entry for 2 hours (120 minutes) on Monday
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      'Ticket',
      120
    );

    const result = await getWeeklyReport(testInput);

    expect(result.total_hours).toBe(2);
    expect(result.total_minutes).toBe(120);
    expect(result.entries_count).toBe(1);
    expect(result.daily_breakdown).toHaveLength(7);

    // Monday should have the entry
    expect(result.daily_breakdown[0].total_hours).toBe(2);
    expect(result.daily_breakdown[0].total_minutes).toBe(120);
    expect(result.daily_breakdown[0].entries_count).toBe(1);

    // Other days should be zero
    for (let i = 1; i < 7; i++) {
      expect(result.daily_breakdown[i].total_hours).toBe(0);
      expect(result.daily_breakdown[i].total_minutes).toBe(0);
      expect(result.daily_breakdown[i].entries_count).toBe(0);
    }
  });

  it('should calculate weekly report with multiple entries across different days', async () => {
    // Monday: 2 hours
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      'Ticket',
      120
    );

    // Tuesday: 3 hours
    await createTestEntry(
      'John Doe',
      new Date('2024-01-02T10:00:00Z'),
      new Date('2024-01-02T13:00:00Z'),
      'Meeting',
      180
    );

    // Friday: 4 hours
    await createTestEntry(
      'John Doe',
      new Date('2024-01-05T08:00:00Z'),
      new Date('2024-01-05T12:00:00Z'),
      'Ticket',
      240
    );

    const result = await getWeeklyReport(testInput);

    // Total should be 9 hours (540 minutes)
    expect(result.total_hours).toBe(9);
    expect(result.total_minutes).toBe(540);
    expect(result.entries_count).toBe(3);

    // Check specific days
    expect(result.daily_breakdown[0].total_hours).toBe(2); // Monday
    expect(result.daily_breakdown[0].total_minutes).toBe(120);
    expect(result.daily_breakdown[0].entries_count).toBe(1);

    expect(result.daily_breakdown[1].total_hours).toBe(3); // Tuesday
    expect(result.daily_breakdown[1].total_minutes).toBe(180);
    expect(result.daily_breakdown[1].entries_count).toBe(1);

    expect(result.daily_breakdown[4].total_hours).toBe(4); // Friday
    expect(result.daily_breakdown[4].total_minutes).toBe(240);
    expect(result.daily_breakdown[4].entries_count).toBe(1);

    // Other days should be zero
    [2, 3, 5, 6].forEach(dayIndex => {
      expect(result.daily_breakdown[dayIndex].total_hours).toBe(0);
      expect(result.daily_breakdown[dayIndex].total_minutes).toBe(0);
      expect(result.daily_breakdown[dayIndex].entries_count).toBe(0);
    });
  });

  it('should only include completed entries with end_time and duration', async () => {
    // Completed entry
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      'Ticket',
      120
    );

    // Incomplete entry (no end_time)
    await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'John Doe',
        start_time: new Date('2024-01-01T14:00:00Z'),
        end_time: null,
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: null
      })
      .execute();

    // Entry with end_time but no duration
    await db.insert(timesheetEntriesTable)
      .values({
        employee_name: 'John Doe',
        start_time: new Date('2024-01-01T16:00:00Z'),
        end_time: new Date('2024-01-01T17:00:00Z'),
        category: 'Ticket',
        ticket_number: 'TEST-456',
        line_items: 1,
        duration_minutes: null
      })
      .execute();

    const result = await getWeeklyReport(testInput);

    // Should only count the completed entry
    expect(result.total_hours).toBe(2);
    expect(result.total_minutes).toBe(120);
    expect(result.entries_count).toBe(1);
  });

  it('should handle entries from different employees correctly', async () => {
    // Entry for John Doe
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      'Ticket',
      120
    );

    // Entry for Jane Smith (should be ignored)
    await createTestEntry(
      'Jane Smith',
      new Date('2024-01-01T10:00:00Z'),
      new Date('2024-01-01T12:00:00Z'),
      'Meeting',
      120
    );

    const result = await getWeeklyReport(testInput);

    // Should only include John Doe's entry
    expect(result.total_hours).toBe(2);
    expect(result.total_minutes).toBe(120);
    expect(result.entries_count).toBe(1);
  });

  it('should handle entries outside the week range correctly', async () => {
    // Entry within the week
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      'Ticket',
      120
    );

    // Entry before the week (December 31, 2023)
    await createTestEntry(
      'John Doe',
      new Date('2023-12-31T09:00:00Z'),
      new Date('2023-12-31T11:00:00Z'),
      'Meeting',
      120
    );

    // Entry after the week (January 8, 2024)
    await createTestEntry(
      'John Doe',
      new Date('2024-01-08T09:00:00Z'),
      new Date('2024-01-08T11:00:00Z'),
      'Ticket',
      120
    );

    const result = await getWeeklyReport(testInput);

    // Should only include the entry within the week
    expect(result.total_hours).toBe(2);
    expect(result.total_minutes).toBe(120);
    expect(result.entries_count).toBe(1);
  });

  it('should handle fractional hours correctly', async () => {
    // Entry for 90 minutes (1.5 hours)
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T10:30:00Z'),
      'Ticket',
      90
    );

    const result = await getWeeklyReport(testInput);

    expect(result.total_hours).toBe(1.5);
    expect(result.total_minutes).toBe(90);
    expect(result.entries_count).toBe(1);
    expect(result.daily_breakdown[0].total_hours).toBe(1.5);
    expect(result.daily_breakdown[0].total_minutes).toBe(90);
  });

  it('should handle multiple entries on the same day', async () => {
    // First entry: 2 hours
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T09:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      'Ticket',
      120
    );

    // Second entry on same day: 1 hour
    await createTestEntry(
      'John Doe',
      new Date('2024-01-01T14:00:00Z'),
      new Date('2024-01-01T15:00:00Z'),
      'Meeting',
      60
    );

    const result = await getWeeklyReport(testInput);

    expect(result.total_hours).toBe(3);
    expect(result.total_minutes).toBe(180);
    expect(result.entries_count).toBe(2);

    // Monday should have both entries
    expect(result.daily_breakdown[0].total_hours).toBe(3);
    expect(result.daily_breakdown[0].total_minutes).toBe(180);
    expect(result.daily_breakdown[0].entries_count).toBe(2);
  });
});