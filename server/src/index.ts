import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  createTimesheetEntryInputSchema,
  updateTimesheetEntryInputSchema,
  stopTimesheetEntryInputSchema,
  getTimesheetEntriesByEmployeeInputSchema,
  deleteTimesheetEntryInputSchema,
  hourlyReportInputSchema,
  dailyReportInputSchema,
  weeklyReportInputSchema,
  monthlyReportInputSchema
} from './schema';

// Import handlers
import { createTimesheetEntry } from './handlers/create_timesheet_entry';
import { stopTimesheetEntry } from './handlers/stop_timesheet_entry';
import { updateTimesheetEntry } from './handlers/update_timesheet_entry';
import { deleteTimesheetEntry } from './handlers/delete_timesheet_entry';
import { getTimesheetEntriesByEmployee } from './handlers/get_timesheet_entries';
import { getAllTimesheetEntries } from './handlers/get_all_timesheet_entries';
import { getHourlyReport } from './handlers/get_hourly_report';
import { getDailyReport } from './handlers/get_daily_report';
import { getWeeklyReport } from './handlers/get_weekly_report';
import { getMonthlyReport } from './handlers/get_monthly_report';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Timesheet Entry Management
  createTimesheetEntry: publicProcedure
    .input(createTimesheetEntryInputSchema)
    .mutation(({ input }) => createTimesheetEntry(input)),

  stopTimesheetEntry: publicProcedure
    .input(stopTimesheetEntryInputSchema)
    .mutation(({ input }) => stopTimesheetEntry(input)),

  updateTimesheetEntry: publicProcedure
    .input(updateTimesheetEntryInputSchema)
    .mutation(({ input }) => updateTimesheetEntry(input)),

  deleteTimesheetEntry: publicProcedure
    .input(deleteTimesheetEntryInputSchema)
    .mutation(({ input }) => deleteTimesheetEntry(input)),

  // Query Operations
  getTimesheetEntriesByEmployee: publicProcedure
    .input(getTimesheetEntriesByEmployeeInputSchema)
    .query(({ input }) => getTimesheetEntriesByEmployee(input)),

  getAllTimesheetEntries: publicProcedure
    .query(() => getAllTimesheetEntries()),

  // Report Generation
  getHourlyReport: publicProcedure
    .input(hourlyReportInputSchema)
    .query(({ input }) => getHourlyReport(input)),

  getDailyReport: publicProcedure
    .input(dailyReportInputSchema)
    .query(({ input }) => getDailyReport(input)),

  getWeeklyReport: publicProcedure
    .input(weeklyReportInputSchema)
    .query(({ input }) => getWeeklyReport(input)),

  getMonthlyReport: publicProcedure
    .input(monthlyReportInputSchema)
    .query(({ input }) => getMonthlyReport(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();