import { z } from 'zod';

// Category enum schema
export const categorySchema = z.enum([
  'Ticket',
  'Koordinasi & kegiatan pendukung lainnya',
  'Meeting',
  'Adhoc/Project',
  'Development & Testing',
  'Other'
]);

export type Category = z.infer<typeof categorySchema>;

// Timesheet entry schema
export const timesheetEntrySchema = z.object({
  id: z.number(),
  employee_name: z.string(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date().nullable(),
  category: categorySchema,
  ticket_number: z.string().nullable(),
  line_items: z.number().int().nonnegative(),
  duration_minutes: z.number().int().nullable(), // Duration in minutes, calculated from start/end times
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type TimesheetEntry = z.infer<typeof timesheetEntrySchema>;

// Input schema for creating timesheet entries (start recording)
export const createTimesheetEntryInputSchema = z.object({
  employee_name: z.string().min(1, 'Employee name is required'),
  category: categorySchema,
  ticket_number: z.string().nullable(),
  line_items: z.number().int().nonnegative().default(0)
});

export type CreateTimesheetEntryInput = z.infer<typeof createTimesheetEntryInputSchema>;

// Input schema for updating timesheet entries (stop recording)
export const updateTimesheetEntryInputSchema = z.object({
  id: z.number(),
  employee_name: z.string().min(1).optional(),
  end_time: z.coerce.date().optional(),
  category: categorySchema.optional(),
  ticket_number: z.string().nullable().optional(),
  line_items: z.number().int().nonnegative().optional()
});

export type UpdateTimesheetEntryInput = z.infer<typeof updateTimesheetEntryInputSchema>;

// Input schema for stopping/completing a timesheet entry
export const stopTimesheetEntryInputSchema = z.object({
  id: z.number()
});

export type StopTimesheetEntryInput = z.infer<typeof stopTimesheetEntryInputSchema>;

// Query input schemas
export const getTimesheetEntriesByEmployeeInputSchema = z.object({
  employee_name: z.string(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional()
});

export type GetTimesheetEntriesByEmployeeInput = z.infer<typeof getTimesheetEntriesByEmployeeInputSchema>;

export const deleteTimesheetEntryInputSchema = z.object({
  id: z.number()
});

export type DeleteTimesheetEntryInput = z.infer<typeof deleteTimesheetEntryInputSchema>;

// Report schemas
export const hourlyReportInputSchema = z.object({
  employee_name: z.string(),
  date: z.coerce.date()
});

export type HourlyReportInput = z.infer<typeof hourlyReportInputSchema>;

export const dailyReportInputSchema = z.object({
  employee_name: z.string(),
  date: z.coerce.date()
});

export type DailyReportInput = z.infer<typeof dailyReportInputSchema>;

export const weeklyReportInputSchema = z.object({
  employee_name: z.string(),
  week_start: z.coerce.date() // Start of the week
});

export type WeeklyReportInput = z.infer<typeof weeklyReportInputSchema>;

export const monthlyReportInputSchema = z.object({
  employee_name: z.string(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12)
});

export type MonthlyReportInput = z.infer<typeof monthlyReportInputSchema>;

// Report response schemas
export const hourlyReportSchema = z.object({
  hour: z.number().int().min(0).max(23),
  total_minutes: z.number().int(),
  activities: z.array(z.object({
    category: categorySchema,
    minutes: z.number().int(),
    entries: z.number().int()
  }))
});

export type HourlyReport = z.infer<typeof hourlyReportSchema>;

export const dailyReportSchema = z.object({
  date: z.coerce.date(),
  total_hours: z.number(),
  total_minutes: z.number().int(),
  entries_count: z.number().int()
});

export type DailyReport = z.infer<typeof dailyReportSchema>;

export const weeklyReportSchema = z.object({
  week_start: z.coerce.date(),
  week_end: z.coerce.date(),
  total_hours: z.number(),
  total_minutes: z.number().int(),
  entries_count: z.number().int(),
  daily_breakdown: z.array(dailyReportSchema)
});

export type WeeklyReport = z.infer<typeof weeklyReportSchema>;

export const monthlyReportSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  total_hours: z.number(),
  total_minutes: z.number().int(),
  entries_count: z.number().int(),
  weekly_breakdown: z.array(weeklyReportSchema)
});

export type MonthlyReport = z.infer<typeof monthlyReportSchema>;