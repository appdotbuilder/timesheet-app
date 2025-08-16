import { db } from '../db';
import { timesheetEntriesTable } from '../db/schema';
import { type HourlyReportInput, type HourlyReport } from '../schema';
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm';

export async function getHourlyReport(input: HourlyReportInput): Promise<HourlyReport[]> {
  try {
    // Calculate date range for the specific date (start and end of day)
    const startOfDay = new Date(input.date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(input.date);
    endOfDay.setHours(23, 59, 59, 999);

    // Query timesheet entries for the employee on the specified date
    // Only include entries that have both start_time and end_time (completed entries)
    const entries = await db.select()
      .from(timesheetEntriesTable)
      .where(
        and(
          eq(timesheetEntriesTable.employee_name, input.employee_name),
          gte(timesheetEntriesTable.start_time, startOfDay),
          lte(timesheetEntriesTable.start_time, endOfDay),
          isNotNull(timesheetEntriesTable.end_time),
          isNotNull(timesheetEntriesTable.duration_minutes)
        )
      )
      .execute();

    // Create a map to store hourly data
    const hourlyData = new Map<number, {
      total_minutes: number;
      activities: Map<string, { minutes: number; entries: number }>;
    }>();

    // Process each entry to calculate hourly breakdown
    entries.forEach(entry => {
      if (!entry.end_time || entry.duration_minutes === null) return;

      const startTime = new Date(entry.start_time);
      const endTime = new Date(entry.end_time);
      const totalMinutes = entry.duration_minutes;

      // Calculate which hours this entry spans
      const startHour = startTime.getHours();
      const endHour = endTime.getHours();

      if (startHour === endHour) {
        // Entry is within a single hour
        const hour = startHour;
        
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, {
            total_minutes: 0,
            activities: new Map()
          });
        }

        const hourData = hourlyData.get(hour)!;
        hourData.total_minutes += totalMinutes;

        // Update activity breakdown
        const activityKey = entry.category;
        const currentActivity = hourData.activities.get(activityKey) || { minutes: 0, entries: 0 };
        currentActivity.minutes += totalMinutes;
        currentActivity.entries += 1;
        hourData.activities.set(activityKey, currentActivity);
      } else {
        // Entry spans multiple hours - distribute minutes proportionally
        const startMinute = startTime.getMinutes();
        const endMinute = endTime.getMinutes();
        
        for (let hour = startHour; hour <= endHour; hour++) {
          let minutesInThisHour: number;
          
          if (hour === startHour) {
            // First hour: from start minute to end of hour
            minutesInThisHour = 60 - startMinute;
          } else if (hour === endHour) {
            // Last hour: from start of hour to end minute
            minutesInThisHour = endMinute;
          } else {
            // Middle hours: full 60 minutes
            minutesInThisHour = 60;
          }

          if (minutesInThisHour > 0) {
            if (!hourlyData.has(hour)) {
              hourlyData.set(hour, {
                total_minutes: 0,
                activities: new Map()
              });
            }

            const hourData = hourlyData.get(hour)!;
            hourData.total_minutes += minutesInThisHour;

            // Update activity breakdown
            const activityKey = entry.category;
            const currentActivity = hourData.activities.get(activityKey) || { minutes: 0, entries: 0 };
            currentActivity.minutes += minutesInThisHour;
            // Only count the entry once in the first hour it appears
            if (hour === startHour) {
              currentActivity.entries += 1;
            }
            hourData.activities.set(activityKey, currentActivity);
          }
        }
      }
    });

    // Convert the map to the required format and sort by hour
    const result: HourlyReport[] = Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        total_minutes: data.total_minutes,
        activities: Array.from(data.activities.entries())
          .map(([category, activityData]) => ({
            category: category as any, // TypeScript will validate this matches the enum
            minutes: activityData.minutes,
            entries: activityData.entries
          }))
          .sort((a, b) => b.minutes - a.minutes) // Sort activities by minutes descending
      }))
      .sort((a, b) => a.hour - b.hour); // Sort by hour ascending

    return result;
  } catch (error) {
    console.error('Hourly report generation failed:', error);
    throw error;
  }
}