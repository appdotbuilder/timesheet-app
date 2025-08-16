import { type StopTimesheetEntryInput, type TimesheetEntry } from '../schema';

export async function stopTimesheetEntry(input: StopTimesheetEntryInput): Promise<TimesheetEntry> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to stop/complete a timesheet entry (clicking 'Selesai' button).
    // It should update the entry with the current timestamp as end_time and calculate duration_minutes.
    // Duration should be calculated as the difference between start_time and end_time in minutes.
    return Promise.resolve({
        id: input.id,
        employee_name: "Placeholder Employee",
        start_time: new Date(Date.now() - 60000), // 1 minute ago as placeholder
        end_time: new Date(), // Current timestamp when 'Selesai' is clicked
        category: 'Ticket',
        ticket_number: null,
        line_items: 0,
        duration_minutes: 1, // Calculated duration in minutes
        created_at: new Date(),
        updated_at: new Date()
    } as TimesheetEntry);
}