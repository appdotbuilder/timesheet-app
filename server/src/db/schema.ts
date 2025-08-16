import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

// Define the category enum for PostgreSQL
export const categoryEnum = pgEnum('category', [
  'Ticket',
  'Koordinasi & kegiatan pendukung lainnya',
  'Meeting',
  'Adhoc/Project',
  'Development & Testing',
  'Other'
]);

export const timesheetEntriesTable = pgTable('timesheet_entries', {
  id: serial('id').primaryKey(),
  employee_name: text('employee_name').notNull(),
  start_time: timestamp('start_time', { withTimezone: true }).notNull(),
  end_time: timestamp('end_time', { withTimezone: true }), // Nullable - entry can be started but not finished
  category: categoryEnum('category').notNull(),
  ticket_number: text('ticket_number'), // Nullable - not all activities have ticket numbers
  line_items: integer('line_items').notNull().default(0), // Default to 0 if not specified
  duration_minutes: integer('duration_minutes'), // Nullable - calculated when end_time is set
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// TypeScript types for the table schema
export type TimesheetEntry = typeof timesheetEntriesTable.$inferSelect; // For SELECT operations
export type NewTimesheetEntry = typeof timesheetEntriesTable.$inferInsert; // For INSERT operations

// Important: Export all tables and relations for proper query building
export const tables = { 
  timesheetEntries: timesheetEntriesTable 
};