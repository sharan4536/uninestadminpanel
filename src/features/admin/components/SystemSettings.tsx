import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import { getSemesterDates, setSemesterDates, clearAllMessages, clearAllEvents, clearAllAds } from '../../../utils/firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { UNIVERSITY_LIST } from '../../../config/universities';

export function SystemSettings() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUniversityId, setSelectedUniversityId] = useState(UNIVERSITY_LIST[0].id);

  useEffect(() => {
    async function fetchDates() {
      setLoading(true);
      try {
        const dates = await getSemesterDates(selectedUniversityId);
        if (dates) {
          setStartDate(dates.startDate);
          setEndDate(dates.endDate);
        } else {
          setStartDate('');
          setEndDate('');
        }
      } catch (err) {
        console.error('Failed to load semester dates', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDates();
  }, [selectedUniversityId]);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast.error('Both start and end dates are required');
      return;
    }
    setSaving(true);
    try {
      await setSemesterDates(selectedUniversityId, startDate, endDate);
      toast.success('Semester dates saved successfully');
    } catch (err) {
      toast.error('Failed to save dates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle>Semester Configuration</CardTitle>
          <CardDescription>
            Set the start and end dates for the current semester. 
            The timetable will only be accessible during this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading settings...</p>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                <label className="text-sm font-semibold text-slate-700">Target University</label>
                <Select value={selectedUniversityId} onValueChange={setSelectedUniversityId}>
                  <SelectTrigger className="rounded-xl border-slate-200 w-full md:w-[400px]">
                    <SelectValue placeholder="Select a university" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {UNIVERSITY_LIST.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>
                        {uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Semester Start Date</label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Semester End Date</label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="rounded-xl border-slate-200"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="mt-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl"
              >
                {saving ? 'Saving...' : 'Save Dates'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-3xl border-rose-100 bg-rose-50/30">
        <CardHeader>
          <CardTitle className="text-rose-700">System Maintenance</CardTitle>
          <CardDescription>
            High-risk operations. These actions cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-rose-100">
            <div>
              <p className="text-sm font-bold text-slate-800">Clear All Chat History</p>
              <p className="text-xs text-slate-500 mt-1">
                Deletes all messages from all conversations. Useful for resolving encryption mismatches.
                Existing conversations will be preserved but their messages will be wiped.
              </p>
            </div>
            <Button 
              variant="destructive"
              className="rounded-xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100"
              onClick={async () => {
                if (window.confirm('CRITICAL: Are you absolutely sure you want to delete ALL messages for ALL users? This cannot be undone.')) {
                  toast.loading('Clearing all messages...');
                  try {
                    const result = await clearAllMessages();
                    toast.dismiss();
                    toast.success(`Successfully cleared history for ${result?.conversationsProcessed || 0} conversations`);
                  } catch (err) {
                    toast.dismiss();
                    toast.error('Failed to clear messages');
                    console.error(err);
                  }
                }
              }}
            >
              Clear All Messages
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-rose-100">
            <div>
              <p className="text-sm font-bold text-slate-800">Clear All Campus Events</p>
              <p className="text-xs text-slate-500 mt-1">
                Wipes all events from the database. Use this to remove old/seeded data.
              </p>
            </div>
            <Button 
              variant="destructive"
              className="rounded-xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete ALL events?')) {
                  toast.loading('Clearing events...');
                  try {
                    const result = await clearAllEvents();
                    toast.dismiss();
                    toast.success(`Successfully deleted ${result?.count || 0} events`);
                  } catch (err) {
                    toast.dismiss();
                    toast.error('Failed to clear events');
                  }
                }
              }}
            >
              Clear All Events
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-rose-100">
            <div>
              <p className="text-sm font-bold text-slate-800">Clear All Advertisement Campaigns</p>
              <p className="text-xs text-slate-500 mt-1">
                Wipes all ads from the map and list views. 
              </p>
            </div>
            <Button 
              variant="destructive"
              className="rounded-xl bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100"
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete ALL ad campaigns?')) {
                  toast.loading('Clearing ads...');
                  try {
                    const result = await clearAllAds();
                    toast.dismiss();
                    toast.success(`Successfully deleted ${result?.count || 0} campaigns`);
                  } catch (err) {
                    toast.dismiss();
                    toast.error('Failed to clear ads');
                  }
                }
              }}
            >
              Clear All Ads
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
