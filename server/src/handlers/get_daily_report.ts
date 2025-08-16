import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type DailyReportInput, type DailyReport } from '../schema';
import { eq, and, gte, lt, isNotNull } from 'drizzle-orm';

export async function getDailyReport(input: DailyReportInput): Promise<DailyReport> {
  try {
    // Calculate start and end of the day in UTC
    const startOfDay = new Date(input.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(input.date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Query completed timesheet entries for the specific employee and date
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(and(
        eq(timesheetEntriesTable.employee_name, input.employee_name),
        gte(timesheetEntriesTable.start_time, startOfDay),
        lt(timesheetEntriesTable.start_time, endOfDay),
        isNotNull(timesheetEntriesTable.end_time), // Only completed entries
        isNotNull(timesheetEntriesTable.duration_minutes) // Must have calculated duration
      ))
      .execute();

    // Calculate totals
    let totalMinutes = 0;
    entries.forEach(entry => {
      if (entry.duration_minutes !== null) {
        totalMinutes += entry.duration_minutes;
      }
    });

    const totalHours = totalMinutes / 60; // Convert to decimal hours
    const entriesCount = entries.length;

    return {
      date: input.date,
      total_hours: totalHours,
      total_minutes: totalMinutes,
      entries_count: entriesCount
    };
  } catch (error) {
    console.error('Daily report generation failed:', error);
    throw error;
  }
}