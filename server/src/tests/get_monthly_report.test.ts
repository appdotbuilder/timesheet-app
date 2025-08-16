import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type MonthlyReportInput } from '../schema';
import { getMonthlyReport } from '../handlers/get_monthly_report';

// Test data for comprehensive monthly report testing
const testEmployee = 'John Doe';
const testYear = 2024;
const testMonth = 3; // March 2024

const createTestEntry = (
  employee_name: string,
  start_time: Date,
  end_time: Date | null,
  category: 'Ticket' | 'Meeting' | 'Development & Testing' = 'Ticket',
  duration_minutes?: number
) => ({
  employee_name,
  start_time,
  end_time,
  category,
  ticket_number: 'TEST-123',
  line_items: 1,
  duration_minutes: duration_minutes ?? (end_time ? Math.floor((end_time.getTime() - start_time.getTime()) / 60000) : null)
});

describe('getMonthlyReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testInput: MonthlyReportInput = {
    employee_name: testEmployee,
    year: testYear,
    month: testMonth
  };

  it('should return empty report for employee with no entries', async () => {
    const result = await getMonthlyReport(testInput);

    expect(result.year).toEqual(testYear);
    expect(result.month).toEqual(testMonth);
    expect(result.total_hours).toEqual(0);
    expect(result.total_minutes).toEqual(0);
    expect(result.entries_count).toEqual(0);
    expect(result.weekly_breakdown).toEqual([]);
  });

  it('should calculate monthly totals correctly', async () => {
    // Create test entries in March 2024
    const march1 = new Date(2024, 2, 1, 9, 0); // March 1, 9:00 AM
    const march1End = new Date(2024, 2, 1, 17, 0); // March 1, 5:00 PM (8 hours = 480 minutes)
    
    const march15 = new Date(2024, 2, 15, 10, 0); // March 15, 10:00 AM
    const march15End = new Date(2024, 2, 15, 14, 30); // March 15, 2:30 PM (4.5 hours = 270 minutes)

    const entries = [
      createTestEntry(testEmployee, march1, march1End),
      createTestEntry(testEmployee, march15, march15End)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.year).toEqual(testYear);
    expect(result.month).toEqual(testMonth);
    expect(result.total_minutes).toEqual(750); // 480 + 270
    expect(result.total_hours).toEqual(12.5); // 750 / 60
    expect(result.entries_count).toEqual(2);
  });

  it('should exclude incomplete entries (without end_time)', async () => {
    const march1 = new Date(2024, 2, 1, 9, 0);
    const march1End = new Date(2024, 2, 1, 17, 0);
    const march2 = new Date(2024, 2, 2, 9, 0);

    const entries = [
      createTestEntry(testEmployee, march1, march1End), // Complete entry
      createTestEntry(testEmployee, march2, null) // Incomplete entry - should be excluded
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.entries_count).toEqual(1); // Only complete entry counted
    expect(result.total_minutes).toEqual(480); // Only complete entry's duration
  });

  it('should only include entries from specified month', async () => {
    const february28 = new Date(2024, 1, 28, 9, 0); // February 28, 2024
    const february28End = new Date(2024, 1, 28, 17, 0);
    
    const march1 = new Date(2024, 2, 1, 9, 0); // March 1, 2024
    const march1End = new Date(2024, 2, 1, 17, 0);
    
    const april1 = new Date(2024, 3, 1, 9, 0); // April 1, 2024
    const april1End = new Date(2024, 3, 1, 17, 0);

    const entries = [
      createTestEntry(testEmployee, february28, february28End),
      createTestEntry(testEmployee, march1, march1End),
      createTestEntry(testEmployee, april1, april1End)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.entries_count).toEqual(1); // Only March entry
    expect(result.total_minutes).toEqual(480); // Only March entry's duration
  });

  it('should filter by employee name correctly', async () => {
    const march1 = new Date(2024, 2, 1, 9, 0);
    const march1End = new Date(2024, 2, 1, 17, 0);

    const entries = [
      createTestEntry('John Doe', march1, march1End),
      createTestEntry('Jane Smith', march1, march1End)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.entries_count).toEqual(1); // Only John Doe's entry
    expect(result.total_minutes).toEqual(480);
  });

  it('should generate weekly breakdown correctly', async () => {
    // March 2024: starts on Friday (March 1st)
    // Week 1: Feb 26 - Mar 3 (includes Mar 1-3)
    // Week 2: Mar 4 - Mar 10
    // Week 3: Mar 11 - Mar 17
    // etc.
    
    const march1 = new Date(2024, 2, 1, 9, 0); // Friday, March 1
    const march1End = new Date(2024, 2, 1, 13, 0); // 4 hours
    
    const march4 = new Date(2024, 2, 4, 10, 0); // Monday, March 4
    const march4End = new Date(2024, 2, 4, 18, 0); // 8 hours

    const entries = [
      createTestEntry(testEmployee, march1, march1End),
      createTestEntry(testEmployee, march4, march4End)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.weekly_breakdown.length).toBeGreaterThan(0);
    
    // Check that weekly totals add up to monthly total
    const weeklyTotalMinutes = result.weekly_breakdown.reduce(
      (sum, week) => sum + week.total_minutes, 0
    );
    expect(weeklyTotalMinutes).toEqual(result.total_minutes);
    
    // Check that weekly entry counts add up
    const weeklyTotalEntries = result.weekly_breakdown.reduce(
      (sum, week) => sum + week.entries_count, 0
    );
    expect(weeklyTotalEntries).toEqual(result.entries_count);
  });

  it('should generate daily breakdown within weekly breakdown', async () => {
    const march4 = new Date(2024, 2, 4, 9, 0); // Monday, March 4
    const march4End = new Date(2024, 2, 4, 13, 0); // 4 hours
    
    const march5 = new Date(2024, 2, 5, 14, 0); // Tuesday, March 5
    const march5End = new Date(2024, 2, 5, 18, 0); // 4 hours

    const entries = [
      createTestEntry(testEmployee, march4, march4End),
      createTestEntry(testEmployee, march5, march5End)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.weekly_breakdown.length).toBeGreaterThan(0);
    
    const weekWithEntries = result.weekly_breakdown.find(week => week.entries_count > 0);
    expect(weekWithEntries).toBeDefined();
    
    if (weekWithEntries) {
      expect(weekWithEntries.daily_breakdown).toHaveLength(7); // 7 days per week
      
      // Check that daily totals add up to weekly total
      const dailyTotalMinutes = weekWithEntries.daily_breakdown.reduce(
        (sum, day) => sum + day.total_minutes, 0
      );
      expect(dailyTotalMinutes).toEqual(weekWithEntries.total_minutes);
      
      // Check that some days have entries
      const daysWithEntries = weekWithEntries.daily_breakdown.filter(day => day.entries_count > 0);
      expect(daysWithEntries.length).toEqual(2); // March 4 and 5
    }
  });

  it('should handle edge case of single day with multiple entries', async () => {
    const march1Morning = new Date(2024, 2, 1, 9, 0);
    const march1MorningEnd = new Date(2024, 2, 1, 12, 0); // 3 hours
    
    const march1Afternoon = new Date(2024, 2, 1, 13, 0);
    const march1AfternoonEnd = new Date(2024, 2, 1, 17, 0); // 4 hours

    const entries = [
      createTestEntry(testEmployee, march1Morning, march1MorningEnd),
      createTestEntry(testEmployee, march1Afternoon, march1AfternoonEnd)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(testInput);

    expect(result.total_minutes).toEqual(420); // 3 + 4 hours = 420 minutes
    expect(result.entries_count).toEqual(2);
    
    // Find the week containing March 1st
    const weekWithEntries = result.weekly_breakdown.find(week => week.entries_count > 0);
    expect(weekWithEntries).toBeDefined();
    
    if (weekWithEntries) {
      // Find March 1st in the daily breakdown
      const march1Report = weekWithEntries.daily_breakdown.find(day => {
        return day.date.getDate() === 1 && day.date.getMonth() === 2;
      });
      
      expect(march1Report).toBeDefined();
      if (march1Report) {
        expect(march1Report.total_minutes).toEqual(420);
        expect(march1Report.entries_count).toEqual(2);
      }
    }
  });

  it('should handle months with different lengths correctly', async () => {
    // Test February (shorter month)
    const februaryInput: MonthlyReportInput = {
      employee_name: testEmployee,
      year: 2024,
      month: 2 // February
    };

    const feb29 = new Date(2024, 1, 29, 9, 0); // Leap year - Feb 29 exists
    const feb29End = new Date(2024, 1, 29, 17, 0);
    
    const march1 = new Date(2024, 2, 1, 9, 0); // Should not be included
    const march1End = new Date(2024, 2, 1, 17, 0);

    const entries = [
      createTestEntry(testEmployee, feb29, feb29End),
      createTestEntry(testEmployee, march1, march1End)
    ];

    await db.insert(timesheetEntriesTable).values(entries).execute();

    const result = await getMonthlyReport(februaryInput);

    expect(result.month).toEqual(2);
    expect(result.entries_count).toEqual(1); // Only February entry
  });
});