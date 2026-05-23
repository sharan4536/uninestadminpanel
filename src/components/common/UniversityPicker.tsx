import React, { useState } from 'react';
import { UNIVERSITY_LIST, type UniversityConfig } from '../../config/universities';
import { GraduationCap, ChevronRight, Search, MapPin, Sparkles, Lock, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { submitUniversityRequest } from '../../utils/firebase/firestore';

interface UniversityPickerProps {
  onSelect: (university: UniversityConfig) => void;
  /**
   * When true the picker is shown BEFORE account creation.
   * The user gets a confirmation dialog warning them that
   * this choice is permanent and cannot be changed later.
   */
  isPreLogin?: boolean;
}

/**
 * Full-screen university selection page.
 * In `isPreLogin` mode it shows a lock warning and asks
 * the user to confirm their selection before proceeding.
 */
export function UniversityPicker({ onSelect, isPreLogin = false }: UniversityPickerProps) {
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pendingUni, setPendingUni] = useState<UniversityConfig | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestedUniversity, setRequestedUniversity] = useState('');
  const [requestedLocation, setRequestedLocation] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const filtered = UNIVERSITY_LIST.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.shortName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCardClick = (uni: UniversityConfig) => {
    if (isPreLogin) {
      // Show confirmation dialog
      setPendingUni(uni);
    } else {
      onSelect(uni);
    }
  };

  const handleConfirm = () => {
    if (pendingUni) {
      onSelect(pendingUni);
      setPendingUni(null);
    }
  };

  const closeRequestDialog = () => {
    if (isSubmittingRequest) return;
    setShowRequestDialog(false);
  };

  const handleSubmitUniversityRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const universityName = requestedUniversity.trim();
    const location = requestedLocation.trim();

    if (!universityName || !location) {
      toast.error('Please enter both university and location.');
      return;
    }

    setIsSubmittingRequest(true);
    const ok = await submitUniversityRequest({ universityName, location });
    setIsSubmittingRequest(false);

    if (!ok) {
      toast.error('Unable to submit request. Please try again.');
      return;
    }

    toast.success('University request submitted successfully.');
    setRequestedUniversity('');
    setRequestedLocation('');
    setShowRequestDialog(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] flex flex-col items-center overflow-y-auto"
        style={{ background: '#f1f7fb' }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute left-[-12rem] top-[-6rem] h-[38rem] w-[38rem] rounded-full blur-[60px]"
            style={{ background: 'rgba(45, 183, 242, 0.12)' }}
          />
          <div
            className="absolute bottom-[-9rem] right-[-5rem] h-[30rem] w-[30rem] rounded-full blur-[50px]"
            style={{ background: 'rgba(0, 98, 134, 0.08)' }}
          />
        </div>

        <div className="relative z-10 w-full max-w-lg px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-8">
          {/* Header */}
          <div
            className="text-center space-y-3"
            style={{
              animation: 'unipick-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              opacity: 0,
              transform: 'translateY(20px)',
            }}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-[0_18px_36px_rgba(0,98,134,0.12)] border border-slate-100 mb-4 overflow-hidden">
              <img src="/logo.png?v=3" className="h-10 w-10 object-contain" alt="UniNest" />
            </div>
            <h1
              className="text-3xl font-extrabold tracking-tight text-[#293033]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
            >
              Select Your <span className="text-[#2DB7F2]">University</span>
            </h1>
            <p className="text-sm text-[#565C60] max-w-xs mx-auto leading-relaxed">
              Choose your campus to connect with classmates, events, and everything around you.
            </p>

            {/* Pre-login permanent-lock banner */}
            {isPreLogin && (
              <div
                className="mt-2 flex items-center gap-2 justify-center px-4 py-2 rounded-xl"
                style={{ background: 'rgba(0,98,134,0.07)', border: '1px solid rgba(45,183,242,0.2)' }}
              >
                <Lock className="w-3.5 h-3.5 text-[#006286] flex-shrink-0" />
                <p className="text-[11px] font-bold text-[#006286] leading-snug">
                  This choice is permanent — you cannot change your university later.
                </p>
              </div>
            )}
          </div>

          {/* Search */}
          <div
            className="w-full"
            style={{
              animation: 'unipick-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards',
              opacity: 0,
              transform: 'translateY(16px)',
            }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8AEB2]" />
              <input
                type="text"
                placeholder="Search universities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-14 pl-11 pr-4 rounded-xl border-0 bg-[#D5DEE4] text-[#293033] placeholder:text-[#71787B] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
              />
            </div>
          </div>

          {/* University Cards */}
          <div className="w-full flex flex-col gap-3">
            {filtered.map((uni, idx) => (
              <button
                key={uni.id}
                onClick={() => handleCardClick(uni)}
                onMouseEnter={() => setHoveredId(uni.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative w-full text-left rounded-2xl border p-5 transition-all duration-300 active:scale-[0.98] ${
                  hoveredId === uni.id
                    ? 'bg-white border-sky-200 shadow-[0_18px_50px_rgba(0,98,134,0.10)]'
                    : 'bg-white border-slate-100 shadow-[0_8px_24px_rgba(41,48,51,0.04)]'
                }`}
                style={{
                  animation: `unipick-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.25 + idx * 0.08}s forwards`,
                  opacity: 0,
                  transform: 'translateY(16px)',
                }}
              >
                <div className="relative flex items-center gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    hoveredId === uni.id
                      ? 'bg-gradient-to-br from-[#006286] to-[#2DB7F2] shadow-md shadow-sky-200'
                      : 'bg-[#D5DEE4]'
                  }`}>
                    <GraduationCap className={`w-6 h-6 transition-colors ${
                      hoveredId === uni.id ? 'text-white' : 'text-[#006286]'
                    }`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#293033] truncate">{uni.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3 h-3 text-[#A8AEB2]" />
                      <span className="text-xs text-[#565C60]">{uni.campusLabel}</span>
                      <span className="ml-auto px-2 py-0.5 rounded-md bg-sky-50 text-[#006286] text-[10px] font-bold uppercase tracking-wider border border-sky-100">
                        {uni.shortName}
                      </span>
                    </div>
                    {/* Email domain hint */}
                    {uni.domains && uni.domains.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[10px] text-[#71787B] font-medium">
                          @{uni.domains[0]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-[#A8AEB2] group-hover:text-[#2DB7F2] group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div
                className="text-center py-12"
                style={{
                  animation: 'unipick-fade-up 0.4s ease forwards',
                  opacity: 0,
                }}
              >
                <Sparkles className="w-8 h-8 text-[#A8AEB2] mx-auto mb-3" />
                <p className="text-sm text-[#565C60] font-medium">No universities found</p>
                <p className="text-xs text-[#71787B] mt-1">More universities coming soon!</p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div
            className="text-center"
            style={{
              animation: `unipick-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.25 + filtered.length * 0.08 + 0.1}s forwards`,
              opacity: 0,
              transform: 'translateY(10px)',
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#A8AEB2]">
              Don't see your university?{' '}
              <button
                type="button"
                onClick={() => setShowRequestDialog(true)}
                className="text-[#006286] cursor-pointer hover:underline"
              >
                Request it here
              </button>
            </p>
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes unipick-fade-up {
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes unipick-dialog-in {
            from { opacity: 0; transform: scale(0.95) translateY(12px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>

      {/* ── Confirmation dialog (pre-login only) ── */}
      {pendingUni && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setPendingUni(null)}
          />

          {/* Dialog card */}
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-[0_40px_80px_rgba(41,48,51,0.18)] z-10"
            style={{ animation: 'unipick-dialog-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            {/* Close */}
            <button
              onClick={() => setPendingUni(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#A8AEB2] hover:bg-slate-100 transition"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warning icon */}
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-5 border border-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>

            <h2
              className="text-xl font-extrabold text-[#293033] mb-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Confirm Your University
            </h2>
            <p className="text-sm text-[#565C60] leading-relaxed mb-5">
              You're about to join as a student of{' '}
              <span className="font-bold text-[#293033]">{pendingUni.name}</span>.
              <br /><br />
              <span className="font-semibold text-amber-600">⚠️ This cannot be changed later.</span>{' '}
              Your account will be locked to this university and you must use a{' '}
              <span className="font-bold">@{pendingUni.domains?.[0] || pendingUni.shortName.toLowerCase() + '.edu'}</span>{' '}
              email to register.
            </p>

            {/* University badge */}
            <div className="flex items-center gap-3 rounded-2xl bg-[#f1f7fb] border border-sky-100 p-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#006286] to-[#2DB7F2] flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#293033]">{pendingUni.name}</p>
                <p className="text-xs text-[#565C60]">{pendingUni.campusLabel}</p>
              </div>
              <span className="ml-auto px-2 py-0.5 rounded-md bg-sky-50 text-[#006286] text-[10px] font-bold uppercase tracking-wider border border-sky-100">
                {pendingUni.shortName}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setPendingUni(null)}
                className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-bold text-[#565C60] hover:bg-slate-50 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#006286] to-[#2DB7F2] text-sm font-bold text-white shadow-[0_8px_20px_rgba(45,183,242,0.25)] hover:opacity-95 transition active:scale-[0.98]"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── University request dialog ── */}
      {showRequestDialog && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeRequestDialog}
          />

          <div
            className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-[0_40px_80px_rgba(41,48,51,0.18)] z-10"
            style={{ animation: 'unipick-dialog-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <button
              onClick={closeRequestDialog}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#A8AEB2] hover:bg-slate-100 transition"
              aria-label="Close request form"
              type="button"
              disabled={isSubmittingRequest}
            >
              <X className="w-4 h-4" />
            </button>

            <h2
              className="text-xl font-extrabold text-[#293033] mb-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Request University
            </h2>
            <p className="text-sm text-[#565C60] leading-relaxed mb-5">
              Enter your university and campus location. We&apos;ll review and add it soon.
            </p>

            <form onSubmit={handleSubmitUniversityRequest} className="space-y-4">
              <div>
                <label htmlFor="request-university" className="block text-xs font-bold uppercase tracking-[0.08em] text-[#71787B] mb-2">
                  University Name
                </label>
                <input
                  id="request-university"
                  type="text"
                  value={requestedUniversity}
                  onChange={(e) => setRequestedUniversity(e.target.value)}
                  placeholder="e.g., ABC University"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 text-[#293033] placeholder:text-[#A8AEB2] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-200"
                  disabled={isSubmittingRequest}
                />
              </div>

              <div>
                <label htmlFor="request-location" className="block text-xs font-bold uppercase tracking-[0.08em] text-[#71787B] mb-2">
                  Location
                </label>
                <input
                  id="request-location"
                  type="text"
                  value={requestedLocation}
                  onChange={(e) => setRequestedLocation(e.target.value)}
                  placeholder="e.g., Chennai, India"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 text-[#293033] placeholder:text-[#A8AEB2] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-200"
                  disabled={isSubmittingRequest}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeRequestDialog}
                  className="flex-1 h-12 rounded-2xl border border-slate-200 text-sm font-bold text-[#565C60] hover:bg-slate-50 transition disabled:opacity-60"
                  disabled={isSubmittingRequest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#006286] to-[#2DB7F2] text-sm font-bold text-white shadow-[0_8px_20px_rgba(45,183,242,0.25)] hover:opacity-95 transition active:scale-[0.98] disabled:opacity-70"
                  disabled={isSubmittingRequest}
                >
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
