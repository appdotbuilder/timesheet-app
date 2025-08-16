import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type WeeklyReportInput, type WeeklyReport, type DailyReport } from '../schema';
import { and, eq, gte, lte, isNotNull } from 'drizzle-orm';

export const getWeeklyReport = async (input: WeeklyReportInput): Promise<WeeklyReport> => {
  try {
    // Calculate week end date (6 days after start)
    const weekEnd = new Date(input.week_start);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Set start time to beginning of day
    const weekStart = new Date(input.week_start);
    weekStart.setHours(0, 0, 0, 0);

    // Query all completed timesheet entries for the employee within the week
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(
        and(
          eq(timesheetEntriesTable.employee_name, input.employee_name),
          gte(timesheetEntriesTable.start_time, weekStart),
          lte(timesheetEntriesTable.start_time, weekEnd),
          isNotNull(timesheetEntriesTable.end_time),
          isNotNull(timesheetEntriesTable.duration_minutes)
        )
      )
      .execute();

    // Calculate totals for the week
    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
    const totalHours = Math.floor(totalMinutes / 60) + (totalMinutes % 60) / 60;

    // Generate daily breakdown for all 7 days
    const dailyBreakdown: DailyReport[] = [];
    
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Filter entries for this specific day
      const dayEntries = entries.filter(entry => {
        const entryDate = new Date(entry.start_time);
        return entryDate >= dayStart && entryDate <= dayEnd;
      });

      // Calculate daily totals
      const dayMinutes = dayEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
      const dayHours = Math.floor(dayMinutes / 60) + (dayMinutes % 60) / 60;

      dailyBreakdown.push({
        date: new Date(dayStart),
        total_hours: dayHours,
        total_minutes: dayMinutes,
        entries_count: dayEntries.length
      });
    }

    return {
      week_start: new Date(weekStart),
      week_end: new Date(weekEnd),
      total_hours: totalHours,
      total_minutes: totalMinutes,
      entries_count: entries.length,
      daily_breakdown: dailyBreakdown
    };
  } catch (error) {
    console.error('Weekly report generation failed:', error);
    throw error;
  }
};