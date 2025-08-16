import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trpc } from '@/utils/trpc';
import { CalendarIcon, Clock, Edit2, Trash2 } from 'lucide-react';
// Using built-in date formatting instead of date-fns for compatibility
import type { 
  TimesheetEntry, 
  CreateTimesheetEntryInput, 
  Category,
  HourlyReport,
  DailyReport,
  WeeklyReport,
  MonthlyReport
} from '../../server/src/schema';

const categories: Category[] = [
  'Ticket',
  'Koordinasi & kegiatan pendukung lainnya',
  'Meeting',
  'Adhoc/Project',
  'Development & Testing',
  'Other'
];

interface CurrentEntry {
  id: number;
  employee_name: string;
  start_time: Date;
  category: Category;
  ticket_number: string | null;
  line_items: number;
}

function App() {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<CurrentEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());

  // Form state
  const [formData, setFormData] = useState<CreateTimesheetEntryInput>({
    employee_name: '',
    category: 'Ticket',
    ticket_number: null,
    line_items: 0
  });

  // Report states
  const [hourlyReport, setHourlyReport] = useState<HourlyReport[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const result = await trpc.getAllTimesheetEntries.query();
      setEntries(result);
    } catch (error) {
      console.error('Failed to load entries:', error);
      // Show user-friendly message since handlers are stubs
      console.log('Note: Server handlers are stub implementations. Real database integration needed.');
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const formatDateTime = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const calculateDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    return `${hours}j ${minutes}m`;
  };

  const handleStart = async () => {
    if (!formData.employee_name || !formData.category) return;
    
    setIsLoading(true);
    try {
      const response = await trpc.createTimesheetEntry.mutate(formData);
      setCurrentEntry({
        id: response.id || Date.now(), // Fallback ID since stub returns 0
        employee_name: response.employee_name,
        start_time: response.start_time,
        category: response.category,
        ticket_number: response.ticket_number,
        line_items: response.line_items
      });
      console.log('✅ Entry started successfully');
    } catch (error) {
      console.error('Failed to start entry:', error);
      // Fallback for stub implementation
      const mockEntry = {
        id: Date.now(),
        employee_name: formData.employee_name,
        start_time: new Date(),
        category: formData.category,
        ticket_number: formData.ticket_number,
        line_items: formData.line_items
      };
      setCurrentEntry(mockEntry);
      console.log('⚠️ Using fallback entry due to stub implementation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!currentEntry) return;
    
    setIsLoading(true);
    try {
      await trpc.stopTimesheetEntry.mutate({ id: currentEntry.id });
      setCurrentEntry(null);
      await loadEntries();
      console.log('✅ Entry stopped successfully');
    } catch (error) {
      console.error('Failed to stop entry:', error);
      // Simulate stopping for demo
      const stoppedEntry: TimesheetEntry = {
        id: currentEntry.id,
        employee_name: currentEntry.employee_name,
        start_time: currentEntry.start_time,
        end_time: new Date(),
        category: currentEntry.category,
        ticket_number: currentEntry.ticket_number,
        line_items: currentEntry.line_items,
        duration_minutes: Math.floor((Date.now() - currentEntry.start_time.getTime()) / 60000),
        created_at: currentEntry.start_time,
        updated_at: new Date()
      };
      setEntries((prev: TimesheetEntry[]) => [stoppedEntry, ...prev]);
      setCurrentEntry(null);
      console.log('⚠️ Using fallback stop logic due to stub implementation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingEntry) return;
    
    setIsLoading(true);
    try {
      await trpc.updateTimesheetEntry.mutate({
        id: editingEntry.id,
        employee_name: editingEntry.employee_name,
        category: editingEntry.category,
        ticket_number: editingEntry.ticket_number,
        line_items: editingEntry.line_items
      });
      setEditingEntry(null);
      await loadEntries();
    } catch (error) {
      console.error('Failed to update entry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    try {
      await trpc.deleteTimesheetEntry.mutate({ id });
      await loadEntries();
      console.log('✅ Entry deleted successfully');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      // Fallback delete for demo
      setEntries((prev: TimesheetEntry[]) => prev.filter((entry: TimesheetEntry) => entry.id !== id));
      console.log('⚠️ Using fallback delete logic due to stub implementation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      employee_name: '',
      category: 'Ticket',
      ticket_number: null,
      line_items: 0
    });
    setCurrentEntry(null);
    setEditingEntry(null);
  };

  const loadReports = async () => {
    if (!selectedEmployee) return;

    try {
      const hourly = await trpc.getHourlyReport.query({
        employee_name: selectedEmployee,
        date: reportDate
      });
      setHourlyReport(hourly);

      const daily = await trpc.getDailyReport.query({
        employee_name: selectedEmployee,
        date: reportDate
      });
      setDailyReport(daily);

      const weekStart = new Date(reportDate);
      weekStart.setDate(reportDate.getDate() - reportDate.getDay());
      const weekly = await trpc.getWeeklyReport.query({
        employee_name: selectedEmployee,
        week_start: weekStart
      });
      setWeeklyReport(weekly);

      const monthly = await trpc.getMonthlyReport.query({
        employee_name: selectedEmployee,
        year: reportDate.getFullYear(),
        month: reportDate.getMonth() + 1
      });
      setMonthlyReport(monthly);
    } catch (error) {
      console.error('Failed to load reports:', error);
      // Create mock data for demo since handlers are stubs
      const mockHourly = [
        {
          hour: 9,
          total_minutes: 120,
          activities: [
            { category: 'Ticket' as Category, minutes: 90, entries: 2 },
            { category: 'Meeting' as Category, minutes: 30, entries: 1 }
          ]
        },
        {
          hour: 11,
          total_minutes: 60,
          activities: [
            { category: 'Development & Testing' as Category, minutes: 60, entries: 1 }
          ]
        }
      ];
      setHourlyReport(mockHourly);

      const mockDaily = {
        date: reportDate,
        total_hours: 7.5,
        total_minutes: 450,
        entries_count: 5
      };
      setDailyReport(mockDaily);

      const mockWeekly = {
        week_start: new Date(reportDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        week_end: reportDate,
        total_hours: 37.5,
        total_minutes: 2250,
        entries_count: 25,
        daily_breakdown: [mockDaily]
      };
      setWeeklyReport(mockWeekly);

      const mockMonthly = {
        year: reportDate.getFullYear(),
        month: reportDate.getMonth() + 1,
        total_hours: 160,
        total_minutes: 9600,
        entries_count: 100,
        weekly_breakdown: [mockWeekly]
      };
      setMonthlyReport(mockMonthly);

      console.log('⚠️ Using mock report data due to stub implementation');
    }
  };

  const uniqueEmployees = [...new Set(entries.map(entry => entry.employee_name))];
  
  // Add sample employees for demo if no real data exists
  const demoEmployees = ['Ahmad Budiman', 'Sarah Wijaya', 'Budi Santoso', 'Indira Sari'];
  const allEmployees = uniqueEmployees.length > 0 ? uniqueEmployees : demoEmployees;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-2 mb-8">
        <Clock className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">⏰ Timesheet Application</h1>
      </div>

      {/* Development Notice */}
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <div className="text-yellow-600">⚠️</div>
            <div className="text-yellow-800">
              <p className="font-semibold">Development Mode</p>
              <p className="text-sm">Server handlers are currently stub implementations. Real database integration is needed for full functionality. Frontend demonstrates the complete user interface and workflow.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timesheet" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
          <TabsTrigger value="reports">Laporan</TabsTrigger>
        </TabsList>

        <TabsContent value="timesheet" className="space-y-6">
          <Card className="timesheet-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📝 Input Timesheet
                {currentEntry && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Sedang Berjalan
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee-name">👤 Nama Karyawan</Label>
                  <Input
                    id="employee-name"
                    value={formData.employee_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateTimesheetEntryInput) => ({ ...prev, employee_name: e.target.value }))
                    }
                    placeholder="Masukkan nama karyawan"
                    disabled={!!currentEntry}
                  />
                </div>

                <div>
                  <Label htmlFor="category">📋 Kategori</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: Category) =>
                      setFormData((prev: CreateTimesheetEntryInput) => ({ ...prev, category: value }))
                    }
                    disabled={!!currentEntry}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ticket-number">🎫 Nomor Tiket</Label>
                  <Input
                    id="ticket-number"
                    value={formData.ticket_number || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateTimesheetEntryInput) => ({
                        ...prev,
                        ticket_number: e.target.value || null
                      }))
                    }
                    placeholder="Nomor tiket (opsional)"
                    disabled={!!currentEntry}
                  />
                </div>

                <div>
                  <Label htmlFor="line-items">📊 Jumlah Line Items</Label>
                  <Input
                    id="line-items"
                    type="number"
                    value={formData.line_items}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateTimesheetEntryInput) => ({
                        ...prev,
                        line_items: parseInt(e.target.value) || 0
                      }))
                    }
                    min="0"
                    disabled={!!currentEntry}
                  />
                </div>
              </div>

              {currentEntry && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-900">Waktu Mulai:</p>
                        <p className="text-blue-700">{formatDateTime(currentEntry.start_time)}</p>
                      </div>
                      <Badge className="running-badge">⏱️ Sedang Berjalan</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3 pt-4">
                {!currentEntry ? (
                  <Button 
                    onClick={handleStart} 
                    disabled={isLoading || !formData.employee_name || !formData.category}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    ▶️ Mulai
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStop} 
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    ⏹️ Selesai
                  </Button>
                )}
                
                <Button 
                  onClick={handleClear} 
                  variant="outline"
                  disabled={isLoading}
                >
                  🔄 Keluar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="timesheet-card">
            <CardHeader>
              <CardTitle>📋 Daftar Timesheet</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  📝 Belum ada data timesheet. Mulai dengan membuat entry baru!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>👤 Nama</TableHead>
                        <TableHead>📋 Kategori</TableHead>
                        <TableHead>🎫 Tiket</TableHead>
                        <TableHead>⏰ Mulai</TableHead>
                        <TableHead>⏱️ Selesai</TableHead>
                        <TableHead>⏳ Durasi</TableHead>
                        <TableHead>📊 Items</TableHead>
                        <TableHead>⚙️ Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry: TimesheetEntry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.employee_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="category-badge">{entry.category}</Badge>
                          </TableCell>
                          <TableCell>{entry.ticket_number || '-'}</TableCell>
                          <TableCell>{formatDateTime(entry.start_time)}</TableCell>
                          <TableCell>
                            {entry.end_time ? (
                              formatDateTime(entry.end_time)
                            ) : (
                              <Badge className="running-badge">
                                🔄 Berjalan
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.end_time ? (
                              calculateDuration(entry.start_time, entry.end_time)
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{entry.line_items}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setEditingEntry(entry)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>✏️ Edit Entry</DialogTitle>
                                  </DialogHeader>
                                  {editingEntry && (
                                    <div className="space-y-4">
                                      <div>
                                        <Label>Nama Karyawan</Label>
                                        <Input
                                          value={editingEntry.employee_name}
                                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setEditingEntry((prev: TimesheetEntry | null) => 
                                              prev ? { ...prev, employee_name: e.target.value } : null
                                            )
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label>Kategori</Label>
                                        <Select
                                          value={editingEntry.category}
                                          onValueChange={(value: Category) =>
                                            setEditingEntry((prev: TimesheetEntry | null) => 
                                              prev ? { ...prev, category: value } : null
                                            )
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {categories.map((category) => (
                                              <SelectItem key={category} value={category}>
                                                {category}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Nomor Tiket</Label>
                                        <Input
                                          value={editingEntry.ticket_number || ''}
                                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setEditingEntry((prev: TimesheetEntry | null) => 
                                              prev ? { ...prev, ticket_number: e.target.value || null } : null
                                            )
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label>Jumlah Line Items</Label>
                                        <Input
                                          type="number"
                                          value={editingEntry.line_items}
                                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setEditingEntry((prev: TimesheetEntry | null) => 
                                              prev ? { ...prev, line_items: parseInt(e.target.value) || 0 } : null
                                            )
                                          }
                                          min="0"
                                        />
                                      </div>
                                      <Button onClick={handleSave} disabled={isLoading}>
                                        💾 Simpan
                                      </Button>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>🗑️ Hapus Entry</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Apakah Anda yakin ingin menghapus entry ini? Aksi ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(entry.id)}>
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 Filter Laporan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>👤 Pilih Karyawan</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                      {allEmployees.map((employee) => (
                        <SelectItem key={employee} value={employee}>
                          {employee}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>📅 Pilih Tanggal</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportDate.toLocaleDateString('id-ID')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={reportDate}
                        onSelect={(date: Date | undefined) => date && setReportDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button onClick={loadReports} disabled={!selectedEmployee}>
                🔍 Tampilkan Laporan
              </Button>
            </CardContent>
          </Card>

          {dailyReport && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  📅 Laporan Harian
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                    Demo Data
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.floor(dailyReport.total_minutes / 60)}j {dailyReport.total_minutes % 60}m
                    </p>
                    <p className="text-sm text-gray-600">Total Waktu</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{dailyReport.entries_count}</p>
                    <p className="text-sm text-gray-600">Jumlah Aktivitas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {dailyReport.date.toLocaleDateString('id-ID')}
                    </p>
                    <p className="text-sm text-gray-600">Tanggal</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {hourlyReport.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  ⏰ Laporan Per Jam
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                    Demo Data
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>🕐 Jam</TableHead>
                        <TableHead>⏱️ Total Menit</TableHead>
                        <TableHead>📋 Aktivitas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hourlyReport.map((report) => (
                        <TableRow key={report.hour}>
                          <TableCell>{String(report.hour).padStart(2, '0')}:00</TableCell>
                          <TableCell>{report.total_minutes} menit</TableCell>
                          <TableCell>
                            {report.activities.map((activity, idx) => (
                              <Badge key={idx} variant="outline" className="mr-1 mb-1">
                                {activity.category}: {activity.minutes}m
                              </Badge>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {weeklyReport && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  📅 Laporan Mingguan
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                    Demo Data
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.floor(weeklyReport.total_minutes / 60)}j {weeklyReport.total_minutes % 60}m
                      </p>
                      <p className="text-sm text-gray-600">Total Waktu</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{weeklyReport.entries_count}</p>
                      <p className="text-sm text-gray-600">Jumlah Aktivitas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">
                        {weeklyReport.week_start.toLocaleDateString('id-ID')} - {weeklyReport.week_end.toLocaleDateString('id-ID')}
                      </p>
                      <p className="text-sm text-gray-600">Periode</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {monthlyReport && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  📅 Laporan Bulanan
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                    Demo Data
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.floor(monthlyReport.total_minutes / 60)}j {monthlyReport.total_minutes % 60}m
                    </p>
                    <p className="text-sm text-gray-600">Total Waktu</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{monthlyReport.entries_count}</p>
                    <p className="text-sm text-gray-600">Jumlah Aktivitas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{monthlyReport.month}</p>
                    <p className="text-sm text-gray-600">Bulan</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{monthlyReport.year}</p>
                    <p className="text-sm text-gray-600">Tahun</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;