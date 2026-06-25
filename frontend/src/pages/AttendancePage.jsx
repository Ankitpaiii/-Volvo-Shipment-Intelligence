import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { useAI } from '../hooks/useAI';
import AttendanceAlert from '../components/ai/AttendanceAlert';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import { CalendarCheck, ShieldAlert, Award, BarChart2 } from 'lucide-react';

export default function AttendancePage() {
  const { user } = useAuth();
  const { loading, checkAttendanceRisk } = useAI();
  const [analysisResult, setAnalysisResult] = useState(null);

  const subjects = user?.subjects || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    const attendanceData = subjects.map((subject, idx) => ({
      subject,
      attended: parseInt(data[`attended_${idx}`], 10),
      total: parseInt(data[`total_${idx}`], 10),
    }));

    const invalid = attendanceData.find(item => item.attended > item.total);
    if (invalid) {
      toast.error(`Attended cannot exceed total for ${invalid.subject}.`);
      return;
    }

    try {
      const result = await checkAttendanceRisk(attendanceData);
      setAnalysisResult(result);
      toast.success('Attendance analysis complete! 📊');
    } catch (err) {
      // handled in hook
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/25 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Attendance Risk</h1>
          <p className="text-sm text-white/35 mt-0.5">
            Calculate subject-wise risk against the 75% B.Tech threshold.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Form Panel */}
        <div className="glass-card p-6">
          <div className="section-header">
            <ShieldAlert className="section-header-icon" />
            Enter Attendance Records
          </div>

          {subjects.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-white/35 leading-relaxed">
                No subjects configured. Re-register with active subjects.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {subjects.map((subject, idx) => {
                  const attendedName = `attended_${idx}`;
                  const totalName = `total_${idx}`;
                  return (
                    <div
                      key={subject}
                      className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <span className="text-sm font-semibold text-white/75 md:max-w-[160px] truncate">
                        {subject}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <input
                            type="number"
                            placeholder="Attended"
                            min="0"
                            className="input-premium text-center text-xs py-2 px-2"
                            {...register(attendedName, {
                              required: 'Required',
                              min: { value: 0, message: '≥ 0' },
                            })}
                          />
                          {errors[attendedName] && (
                            <p className="text-[10px] text-rose-400 text-center mt-1">
                              {errors[attendedName].message}
                            </p>
                          )}
                        </div>
                        <span className="text-white/20 font-bold text-xs">/</span>
                        <div className="w-24">
                          <input
                            type="number"
                            placeholder="Total"
                            min="1"
                            className="input-premium text-center text-xs py-2 px-2"
                            {...register(totalName, {
                              required: 'Required',
                              min: { value: 1, message: '≥ 1' },
                            })}
                          />
                          {errors[totalName] && (
                            <p className="text-[10px] text-rose-400 text-center mt-1">
                              {errors[totalName].message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? <Spinner size="sm" /> : <><BarChart2 className="w-4 h-4" /> Analyze Risk</>}
              </button>
            </form>
          )}
        </div>

        {/* Results Panel */}
        <div>
          {analysisResult ? (
            <AttendanceAlert
              alerts={analysisResult.alerts}
              overallTip={analysisResult.overallTip}
            />
          ) : (
            <div className="glass-card p-10 text-center min-h-[300px] flex flex-col justify-center items-center border-dashed">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-4">
                <Award className="w-7 h-7 text-white/15" />
              </div>
              <p className="text-sm font-medium text-white/30 max-w-xs leading-relaxed">
                Enter your attendance numbers and click Analyze Risk to see your subject-wise safety.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
