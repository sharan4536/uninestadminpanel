import React, { useState, useEffect } from 'react';
import { Flag, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  getReports,
  updateReportStatus,
  getAllUsersAdmin,
  type Report,
  type UserProfile
} from '../../../utils/firebase/firestore';
import { toast } from 'sonner';

export function ReportManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedReports = await getReports();
        setReports(fetchedReports);
        
        getAllUsersAdmin((users) => {
          const map: Record<string, UserProfile> = {};
          users.forEach(u => {
            if (u.uid) map[u.uid] = u;
          });
          setUsersMap(map);
          setLoading(false);
        });
      } catch (e) {
        console.error("Error fetching reports", e);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdateStatus = async (reportId: string, newStatus: 'pending' | 'reviewed' | 'resolved') => {
    try {
      await updateReportStatus(reportId, newStatus);
      setReports(reports.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      toast.success(`Report marked as ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const pendingReports = reports.filter(r => r.status === 'pending');
  const otherReports = reports.filter(r => r.status !== 'pending');

  const ReportCard = ({ report }: { report: Report }) => {
    const reportedUser = usersMap[report.reportedUserId];
    const reporterUser = usersMap[report.reporterId];

    return (
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-4 sm:gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={report.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                  {report.status === 'pending' ? <Clock size={12} className="mr-1" /> : <CheckCircle size={12} className="mr-1" />}
                  {report.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-slate-400">
                  {new Date(report.createdAt).toLocaleString()}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 text-sm">
                <p>
                  <span className="font-semibold text-slate-700">Reported User:</span>{' '}
                  <span className="text-slate-900 font-bold">{reportedUser?.name || reportedUser?.displayName || report.reportedUserId}</span>
                  <span className="text-slate-400 text-xs ml-2">({report.reportedUserId})</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Reported By:</span>{' '}
                  <span className="text-slate-600">{reporterUser?.name || reporterUser?.displayName || report.reporterId}</span>
                  <span className="text-slate-400 text-xs ml-2">({report.reporterId})</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-6">
              {report.status === 'pending' ? (
                <Button 
                  size="sm" 
                  className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => report.id && handleUpdateStatus(report.id, 'reviewed')}
                >
                  <CheckCircle size={16} className="mr-2" />
                  Mark Reviewed
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="w-full sm:w-auto rounded-xl"
                  onClick={() => report.id && handleUpdateStatus(report.id, 'pending')}
                >
                  <Clock size={16} className="mr-2" />
                  Re-open
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Flag size={20} className="text-amber-500" />
          Pending Reports ({pendingReports.length})
        </h2>
        {pendingReports.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No pending reports.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingReports.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <CheckCircle size={20} className="text-emerald-500" />
          Reviewed Reports ({otherReports.length})
        </h2>
        {otherReports.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No reviewed reports.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {otherReports.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
