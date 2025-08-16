import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type MonthlyReportInput, type MonthlyReport, type WeeklyReport, type DailyReport } from '../schema';
import { eq, and, gte, lt, isNotNull } from 'drizzle-orm';

export async function getMonthlyReport(input: MonthlyReportInput): Promise<MonthlyReport> {
  try {
    const { employee_name, year, month } = input;

    // Calculate month boundaries
    const monthStart = new Date(year, month - 1, 1); // month is 1-based, Date constructor is 0-based
    const monthEnd = new Date(year, month, 1); // First day of next month

    // Query completed timesheet entries for the month
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(and(
        eq(timesheetEntriesTable.employee_name, employee_name),
        gte(timesheetEntriesTable.start_time, monthStart),
        lt(timesheetEntriesTable.start_time, monthEnd),
        isNotNull(timesheetEntriesTable.end_time),
        isNotNull(timesheetEntriesTable.duration_minutes)
      ))
      .execute();

    // Calculate monthly totals
    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
    const totalHours = totalMinutes / 60;
    const entriesCount = entries.length;

    // Generate weekly breakdown only if there are entries
    const weeklyBreakdown = entriesCount > 0 
      ? generateWeeklyBreakdown(entries, monthStart, monthEnd, employee_name)
      : [];

    return {
      year,
      month,
      total_hours: totalHours,
      total_minutes: totalMinutes,
      entries_count: entriesCount,
      weekly_breakdown: weeklyBreakdown
    };
  } catch (error) {
    console.error('Monthly report generation failed:', error);
    throw error;
  }
}

function generateWeeklyBreakdown(
  entries: any[],
  monthStart: Date,
  monthEnd: Date,
  employee_name: string
): WeeklyReport[] {
  const weeks: WeeklyReport[] = [];
  
  // Start from the Monday of the first week that includes monthStart
  let weekStart = getWeekStart(monthStart);
  
  while (weekStart < monthEnd) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Filter entries for this week
    const weekEntries = entries.filter(entry => {
      const startTime = new Date(entry.start_time);
      return startTime >= weekStart && startTime <= weekEnd;
    });
    
    // Calculate weekly totals
    const weeklyMinutes = weekEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
    const weeklyHours = weeklyMinutes / 60;
    
    // Generate daily breakdown for the week
    const dailyBreakdown = generateDailyBreakdown(weekEntries, weekStart, weekEnd);
    
    weeks.push({
      week_start: new Date(weekStart),
      week_end: new Date(weekEnd),
      total_hours: weeklyHours,
      total_minutes: weeklyMinutes,
      entries_count: weekEntries.length,
      daily_breakdown: dailyBreakdown
    });
    
    // Move to next week
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }
  
  return weeks;
}

function generateDailyBreakdown(
  weekEntries: any[],
  weekStart: Date,
  weekEnd: Date
): DailyReport[] {
  const dailyReports: DailyReport[] = [];
  
  // Generate reports for each day of the week
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    
    // Filter entries for this day
    const dayEntries = weekEntries.filter(entry => {
      const startTime = new Date(entry.start_time);
      return startTime >= dayStart && startTime <= dayEnd;
    });
    
    // Calculate daily totals
    const dailyMinutes = dayEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
    const dailyHours = dailyMinutes / 60;
    
    dailyReports.push({
      date: new Date(dayStart),
      total_hours: dailyHours,
      total_minutes: dailyMinutes,
      entries_count: dayEntries.length
    });
  }
  
  return dailyReports;
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Make Monday the start of week
  result.setDate(result.getDate() - daysToSubtract);
  result.setHours(0, 0, 0, 0);
  return result;
}