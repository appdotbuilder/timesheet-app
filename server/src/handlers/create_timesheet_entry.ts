import { type CreateTimesheetEntryInput, type TimesheetEntry } from '../schema';

export async function createTimesheetEntry(input: CreateTimesheetEntryInput): Promise<TimesheetEntry> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to start a new timesheet entry (clicking 'Mulai' button).
    // It should record the current timestamp as start_time and create a new entry in the database.
    // The entry will not have an end_time initially (nullable field).
    return Promise.resolve({
        id: 0, // Placeholder ID
        employee_name: input.employee_name,
        start_time: new Date(), // Current timestamp when 'Mulai' is clicked
        end_time: null, // No end time initially
        category: input.category,
        ticket_number: input.ticket_number || null,
        line_items: input.line_items || 0,
        duration_minutes: null, // Will be calculated when entry is stopped
        created_at: new Date(),
        updated_at: new Date()
    } as TimesheetEntry);
}