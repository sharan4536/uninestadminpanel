import React, { useState } from 'react';
import { Eye, EyeOff, Mail, GraduationCap, Lock } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectLabel, SelectGroup } from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { auth, db, isFirebaseConfigured } from '../../../utils/firebase/client';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { formatEmailToName } from '../../../utils/nameUtils';
import type { UniversityConfig } from '../../../config/universities';

export function LoginPage({
  onLogin,
  selectedUniversity,
}: {
  onLogin: (profile: any) => void;
  selectedUniversity?: UniversityConfig | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [major, setMajor] = useState('');
  const [majorOther, setMajorOther] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeCommunity, setAgreeCommunity] = useState(false);

  type PolicyType = 'privacy' | 'terms' | 'community' | null;
  const [openPolicy, setOpenPolicy] = useState<PolicyType>(null);

  const getPolicyUrl = (type: PolicyType) => {
    switch(type) {
      case 'privacy': return '/privacy.html';
      case 'terms': return '/terms.html';
      case 'community': return '/community.html';
      default: return '';
    }
  };

  const getPolicyTitle = (type: PolicyType) => {
    switch(type) {
      case 'privacy': return 'Privacy Policy';
      case 'terms': return 'Terms & Conditions';
      case 'community': return 'Community Guidelines';
      default: return '';
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setInfo('Password reset email sent! Check your inbox.');
      setError('');
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address');
      } else {
        setError('Error sending password reset email. Please try again.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

      // Admin Bypass for Testing
      if (email.trim().toLowerCase() === 'admin@uninest.edu' && password === 'admin123') {
        const adminProfile = {
          uid: 'admin-dev-id',
          id: 'admin-dev-id',
          name: 'System Admin',
          email: 'admin@uninest.edu',
          university: 'UniNest HQ',
          isAdmin: true,
          isDevelopmentUser: true
        };
        onLogin(adminProfile);
        setLoading(false);
        return;
      }

    try {
      if (isSignUp) {
        if (!agreePrivacy || !agreeTerms || !agreeCommunity) {
          setError('Please agree to all the required policies to create an account.');
          setLoading(false);
          return;
        }

        const emailLc = email.trim().toLowerCase();
        // Validate against the selected university's email domain
        const allowedDomains = (selectedUniversity as any)?.domains || [];
        if (allowedDomains.length > 0) {
          const isDomainValid = allowedDomains.some((d: string) => emailLc.endsWith(`@${d.toLowerCase()}`));
          if (!isDomainValid) {
            setError(`Only ${selectedUniversity?.name} emails are allowed. Please use an email ending with one of: ${allowedDomains.join(', ')}`);
            setLoading(false);
            return;
          }
        }
        // Fallback: if no domain configured, keep generic check
        if (allowedDomains.length === 0 && !emailLc.includes('@') ) {
          setError('Please enter a valid university email address.');
          setLoading(false);
          return;
        }
      }

      if (isFirebaseConfigured) {
        try {
          if (isSignUp) {
            const creds = await createUserWithEmailAndPassword(auth, email, password);
            
            try {
              await updateProfile(creds.user, { displayName: name });
            } catch (e) {
              console.error('Failed to update auth profile', e);
            }

            // Store signup data in sessionStorage. App.tsx's onAuthStateChanged
            // will create Firestore docs ONLY after emailVerified === true.
            try {
              sessionStorage.setItem('uninest_pending_profile', JSON.stringify({
                name: name || formatEmailToName(email),
                email: email,
                year: year,
                major: major === 'OTHER' ? majorOther : major,
                university: selectedUniversity?.name || '',
                universityId: selectedUniversity?.id || '',
              }));
            } catch (e) {
              console.error('Failed to store pending profile', e);
            }

            await sendEmailVerification(creds.user);
            setInfo('Verification email sent. Please verify your email to continue.');
            return;
          }

          const creds = await signInWithEmailAndPassword(auth, email, password);
          try {
            await creds.user.reload();
          } catch (e) {
            console.error('Failed to refresh user after sign in:', e);
          }
          const refreshedUser = auth.currentUser || creds.user;
          if (!refreshedUser.emailVerified) {
            setError('Please verify your email address. Check your inbox for a verification email.');
            return;
          }
            const uid = refreshedUser.uid;
            const snap = await getDoc(doc(db, 'profiles', uid));
            const profile = snap.exists() ? snap.data() : { 
              id: uid, 
              name: formatEmailToName(refreshedUser.displayName || refreshedUser.email)
            };
            onLogin(profile);
          return;
        } catch (firebaseError: any) {
          console.error('Firebase auth error:', firebaseError);

          if (firebaseError.code === 'auth/invalid-credential') {
            setError('Invalid email or password. Please try again.');
          } else if (firebaseError.code === 'auth/user-not-found') {
            setError('No account found with this email. Please sign up first.');
          } else if (firebaseError.code === 'auth/wrong-password') {
            setError('Incorrect password. Please try again.');
          } else if (firebaseError.code === 'auth/email-already-in-use') {
            setError('This email is already registered. Please sign in instead.');
          } else if (firebaseError.code === 'auth/weak-password') {
            setError('Password is too weak. Please use a stronger password.');
          } else if (firebaseError.code === 'auth/network-request-failed') {
            setError('Network error. Please check your internet connection.');
          } else {
            setError(`Authentication error: ${firebaseError.message}`);
          }

          if (firebaseError.code && firebaseError.code.startsWith('auth/')) {
            setLoading(false);
            return;
          }

          throw firebaseError;
        }
      }

      setError('Authentication service not configured. Please configure Firebase.');
      setLoading(false);
      return;
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Unable to authenticate. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-y-auto bg-[#f1f7fb] px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-[#293033]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-6rem] h-[38rem] w-[38rem] rounded-full bg-sky-300/20 blur-[60px]" />
        <div className="absolute bottom-[-9rem] right-[-5rem] h-[30rem] w-[30rem] rounded-full bg-sky-200/20 blur-[50px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[30rem] flex-col items-center justify-start py-8 sm:justify-center">
        <div className="w-full max-w-[30rem]">
          <div className="flex flex-col items-center pb-8">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_18px_36px_rgba(0,98,134,0.12)] overflow-hidden border border-slate-100">
                <img src="/logo.png?v=3" className="h-full w-full object-contain" alt="UniNest Logo" />
              </div>
              <h1 className="text-center font-['Plus_Jakarta_Sans'] text-4xl font-extrabold leading-10 tracking-tight">
                <span className="text-[#293033]">Uni</span>
                <span className="text-[#2DB7F2]">Nest</span>
              </h1>
            </div>
          </div>

          {/* University badge — shown when a university was pre-selected */}
          {selectedUniversity && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 border border-sky-100" style={{ background: 'rgba(241,247,251,0.9)' }}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-sky-600 uppercase tracking-[0.1em]">Your University</p>
                <p className="text-sm font-bold text-slate-800 truncate">{selectedUniversity.name}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Lock className="w-3 h-3 text-[#A8AEB2]" />
                <span className="text-[10px] font-bold text-[#A8AEB2] uppercase tracking-wider">Locked</span>
              </div>
            </div>
          )}

          <div className="rounded-[2rem] bg-white p-10 shadow-[0_32px_64px_rgba(56,189,248,0.06)] border border-sky-100">
            {/* Custom Running Penguins Welcoming Header Illustration */}
            <div className="mb-6 w-full h-44 rounded-2xl overflow-hidden border border-sky-100/50 shadow-inner">
              <img src="/images/running_penguins.jpg" className="w-full h-full object-cover" alt="Welcome Penguins" />
            </div>

            <div className="mb-8 text-left">
              <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold leading-8 text-slate-800">Welcome to UniNest</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your credentials to access
                <br />
                your academic nest.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 text-left">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700 text-left">
                  {info}
                </div>
              )}

              {isSignUp && (
                <>
                  <Field label="FULL NAME">
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-14 rounded-xl border border-sky-100 bg-white px-5 text-base shadow-sm placeholder:text-[#71787B] focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-300 text-slate-800"
                    />
                  </Field>

                  <Field label="PASSING YEAR">
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger aria-label="Passing Year" className="h-14 rounded-xl border border-sky-100 bg-white px-5 text-left shadow-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2027">2027</SelectItem>
                        <SelectItem value="2028">2028</SelectItem>
                        <SelectItem value="2029">2029</SelectItem>
                        <SelectItem value="2030">2030</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="PROGRAM">
                    <Select value={major} onValueChange={setMajor}>
                      <SelectTrigger aria-label="Select Major" className="h-14 rounded-xl border border-sky-100 bg-white px-5 text-left shadow-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200">
                        <SelectValue placeholder="Select B.Tech Course" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectGroup>
                          <SelectLabel>Popular B.Tech</SelectLabel>
                          <SelectItem value="CSE">Computer Science and Engineering (CSE)</SelectItem>
                          <SelectItem value="ECE">Electronics and Communication (ECE)</SelectItem>
                          <SelectItem value="EEE">Electrical and Electronics (EEE)</SelectItem>
                          <SelectItem value="MECH">Mechanical Engineering</SelectItem>
                          <SelectItem value="CIVIL">Civil Engineering</SelectItem>
                          <SelectItem value="CHE">Chemical Engineering</SelectItem>
                          <SelectItem value="IT">Information Technology</SelectItem>
                          <SelectItem value="AIML">AI & ML</SelectItem>
                          <SelectItem value="DS">Data Science</SelectItem>
                          <SelectItem value="BIOTECH">Biotechnology</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectItem value="OTHER">Other...</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {major === 'OTHER' && (
                      <div className="mt-2">
                        <Input
                          id="major-custom"
                          placeholder="Enter your branch"
                          value={majorOther}
                          onChange={(e) => setMajorOther(e.target.value)}
                          className="h-14 rounded-xl border border-sky-100 bg-white px-5 shadow-sm text-slate-800"
                        />
                      </div>
                    )}
                  </Field>
                </>
              )}

              <Field label="EMAIL ADDRESS">
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder={selectedUniversity?.domains && selectedUniversity.domains.length > 0 ? `student@${selectedUniversity.domains[0]}` : 'student@university.edu'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-14 rounded-xl border border-sky-100 bg-white px-5 pe-12 text-base shadow-sm placeholder:text-[#71787B] focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-300 text-slate-800"
                  />
                  <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-400" />
                </div>
                {isSignUp && selectedUniversity?.domains && selectedUniversity.domains.length > 0 && (
                  <p className="mt-1.5 px-1 text-[11px] font-medium text-slate-500 text-left">
                    Must end with <span className="font-bold text-sky-600">@{selectedUniversity.domains.join(' or @')}</span>
                  </p>
                )}
              </Field>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.1em] text-sky-600">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 hover:text-sky-500 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-14 rounded-xl border border-sky-100 bg-white px-5 pe-12 text-base shadow-sm placeholder:text-[#71787B] focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-300 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-400"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-3 px-1 py-2 text-left">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded-md border border-sky-200 bg-white text-sky-500 focus:ring-sky-200"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      I agree to the <button type="button" onClick={() => setOpenPolicy('privacy')} className="text-sky-500 hover:underline font-bold">Privacy Policy</button>
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded-md border border-sky-200 bg-white text-sky-500 focus:ring-sky-200"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      I agree to the <button type="button" onClick={() => setOpenPolicy('terms')} className="text-sky-500 hover:underline font-bold">Terms & Conditions</button>
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreeCommunity}
                      onChange={(e) => setAgreeCommunity(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded-md border border-sky-200 bg-white text-sky-500 focus:ring-sky-200"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      I agree to the <button type="button" onClick={() => setOpenPolicy('community')} className="text-sky-500 hover:underline font-bold">Community Guidelines</button>
                    </span>
                  </label>
                </div>
              )}

              {!isSignUp && (
                <label className="flex items-center gap-3 px-1 text-left">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded-md border border-sky-200 bg-white text-sky-500 focus:ring-sky-200"
                  />
                  <span className="text-sm font-medium text-slate-600">Keep me signed in</span>
                </label>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-14 w-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500 text-base font-bold text-white shadow-[0_12px_24px_rgba(56,189,248,0.2)] hover:opacity-95"
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>

            </form>
          </div>

          <div className="pt-10 text-center">
            <div className="flex justify-center gap-1 text-sm">
              <span className="font-medium text-[#565C60]">
                {isSignUp ? 'Already have an academic account?' : "Don't have an academic account?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp((prev) => !prev);
                  setError('');
                  setInfo('');
                }}
                className="font-bold text-[#006286]"
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6">
              <button onClick={() => setOpenPolicy('privacy')} type="button" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#A8AEB2] hover:text-[#006286] transition-colors">PRIVACY</button>
              <button onClick={() => setOpenPolicy('terms')} type="button" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#A8AEB2] hover:text-[#006286] transition-colors">TERMS</button>
              <button onClick={() => setOpenPolicy('community')} type="button" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#A8AEB2] hover:text-[#006286] transition-colors">COMMUNITY</button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!openPolicy} onOpenChange={(open) => !open && setOpenPolicy(null)}>
        <DialogContent className="max-w-3xl w-[90vw] h-[85vh] flex flex-col p-0 overflow-hidden bg-white rounded-[2rem] border-0 shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-xl font-bold font-['Plus_Jakarta_Sans']">{getPolicyTitle(openPolicy)}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-50/50 p-0 overflow-hidden">
            {openPolicy && (
              <iframe 
                src={getPolicyUrl(openPolicy)} 
                className="w-full h-full border-0 bg-white"
                title={getPolicyTitle(openPolicy)}
              />
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0 bg-white">
            <Button onClick={() => setOpenPolicy(null)} className="rounded-xl px-8 h-10 font-bold bg-[#006286] hover:bg-[#004e6c] text-white">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#006286]">{label}</Label>
      {children}
    </div>
  );
}
