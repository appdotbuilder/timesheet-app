import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type DailyReportInput } from '../schema';
import { getDailyReport } from '../handlers/get_daily_report';

describe('getDailyReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testEmployee = 'John Doe';
  const testDate = new Date('2024-01-15T00:00:00Z');

  it('should return empty report when no entries exist', async () => {
    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(0);
    expect(result.total_minutes).toEqual(0);
    expect(result.entries_count).toEqual(0);
  });

  it('should calculate report with single completed entry', async () => {
    // Create a completed timesheet entry (2 hours = 120 minutes)
    await db.insert(timesheetEntriesTable).values({
      employee_name: testEmployee,
      start_time: new Date('2024-01-15T09:00:00Z'),
      end_time: new Date('2024-01-15T11:00:00Z'),
      category: 'Ticket',
      ticket_number: 'TKT-001',
      line_items: 5,
      duration_minutes: 120 // 2 hours
    }).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(2);
    expect(result.total_minutes).toEqual(120);
    expect(result.entries_count).toEqual(1);
  });

  it('should calculate report with multiple completed entries', async () => {
    // Create multiple completed timesheet entries
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        category: 'Ticket',
        ticket_number: 'TKT-001',
        line_items: 5,
        duration_minutes: 120 // 2 hours
      },
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T13:00:00Z'),
        end_time: new Date('2024-01-15T14:30:00Z'),
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 90 // 1.5 hours
      },
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T15:00:00Z'),
        end_time: new Date('2024-01-15T15:45:00Z'),
        category: 'Development & Testing',
        ticket_number: 'TKT-002',
        line_items: 3,
        duration_minutes: 45 // 0.75 hours
      }
    ]).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(4.25); // 120 + 90 + 45 = 255 minutes = 4.25 hours
    expect(result.total_minutes).toEqual(255);
    expect(result.entries_count).toEqual(3);
  });

  it('should exclude incomplete entries (no end_time)', async () => {
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        category: 'Ticket',
        ticket_number: 'TKT-001',
        line_items: 5,
        duration_minutes: 120 // Complete entry
      },
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T13:00:00Z'),
        end_time: null, // Incomplete entry
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: null
      }
    ]).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(2);
    expect(result.total_minutes).toEqual(120);
    expect(result.entries_count).toEqual(1); // Only completed entry counted
  });

  it('should exclude entries from other employees', async () => {
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        category: 'Ticket',
        ticket_number: 'TKT-001',
        line_items: 5,
        duration_minutes: 120
      },
      {
        employee_name: 'Jane Smith', // Different employee
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T12:00:00Z'),
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 180
      }
    ]).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(2);
    expect(result.total_minutes).toEqual(120);
    expect(result.entries_count).toEqual(1); // Only testEmployee's entry counted
  });

  it('should exclude entries from other dates', async () => {
    await db.insert(timesheetEntriesTable).values([
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-15T09:00:00Z'), // Target date
        end_time: new Date('2024-01-15T11:00:00Z'),
        category: 'Ticket',
        ticket_number: 'TKT-001',
        line_items: 5,
        duration_minutes: 120
      },
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-14T09:00:00Z'), // Previous day
        end_time: new Date('2024-01-14T12:00:00Z'),
        category: 'Meeting',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 180
      },
      {
        employee_name: testEmployee,
        start_time: new Date('2024-01-16T09:00:00Z'), // Next day
        end_time: new Date('2024-01-16T10:00:00Z'),
        category: 'Other',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 60
      }
    ]).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(2);
    expect(result.total_minutes).toEqual(120);
    expect(result.entries_count).toEqual(1); // Only entry from target date counted
  });

  it('should handle entries spanning across day boundaries correctly', async () => {
    // Entry that starts on target date but may end on next day
    await db.insert(timesheetEntriesTable).values({
      employee_name: testEmployee,
      start_time: new Date('2024-01-15T23:30:00Z'), // Late evening on target date
      end_time: new Date('2024-01-16T01:00:00Z'), // Early morning next day
      category: 'Adhoc/Project',
      ticket_number: 'TKT-003',
      line_items: 2,
      duration_minutes: 90 // 1.5 hours
    }).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(1.5);
    expect(result.total_minutes).toEqual(90);
    expect(result.entries_count).toEqual(1);
  });

  it('should handle zero duration entries correctly', async () => {
    await db.insert(timesheetEntriesTable).values({
      employee_name: testEmployee,
      start_time: new Date('2024-01-15T09:00:00Z'),
      end_time: new Date('2024-01-15T09:00:00Z'), // Same time = 0 duration
      category: 'Other',
      ticket_number: null,
      line_items: 0,
      duration_minutes: 0
    }).execute();

    const input: DailyReportInput = {
      employee_name: testEmployee,
      date: testDate
    };

    const result = await getDailyReport(input);

    expect(result.date).toEqual(testDate);
    expect(result.total_hours).toEqual(0);
    expect(result.total_minutes).toEqual(0);
    expect(result.entries_count).toEqual(1); // Entry is counted even with 0 duration
  });
});