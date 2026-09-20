import React, { useState, useRef, useEffect } from 'react';
import { Target, Calendar, Building2, Check, Sparkles, Briefcase } from 'lucide-react';
import { UserGoals } from '../types';
import { TOP_COMPANIES, TIMELINE_OPTIONS, CompanySuggestion } from '../data/companies';

interface GoalsStepProps {
  goals: UserGoals;
  onChange: (goals: UserGoals) => void;
}

export const GoalsStep: React.FC<GoalsStepProps> = ({ goals, onChange }) => {
  const [companyInput, setCompanyInput] = useState(goals.dreamCompany || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCompanyInput(goals.dreamCompany || '');
  }, [goals.dreamCompany]);

  // Filter suggestions based on typed input
  const filteredCompanies = TOP_COMPANIES.filter((comp) =>
    comp.name.toLowerCase().includes(companyInput.toLowerCase())
  );

  const handleSelectCompany = (companyName: string) => {
    setCompanyInput(companyName);
    onChange({
      ...goals,
      dreamCompany: companyName,
    });
    setShowSuggestions(false);
  };

  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCompanyInput(val);
    onChange({
      ...goals,
      dreamCompany: val,
    });
    setShowSuggestions(true);
  };

  const handleSelectTimeline = (timelineId: string) => {
    let days = 14;
    if (timelineId === 'immediate') days = 14;
    else if (timelineId.includes('autumn')) days = 42;
    else if (timelineId.includes('summer')) days = 90;
    else days = 120;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    onChange({
      ...goals,
      placementTimeline: timelineId,
      daysLeft: goals.daysLeft ?? days,
      oaDate: goals.oaDate ?? futureDate.toISOString(),
    });
  };

  const popularChips = ['Google', 'Microsoft', 'Amazon', 'Atlassian', 'Goldman Sachs', 'Uber', 'Meta'];

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-7 text-left">
      {/* Step Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#5B6B4D]/15 text-[#5B6B4D] text-[11px] font-semibold uppercase tracking-wider">
          <Target className="w-3 h-3" />
          <span>Step 3 · Target Calibration</span>
        </div>
        <h2
          className="text-[26px] sm:text-[30px] font-normal tracking-[-0.02em] leading-tight text-[#1F2420]"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          Target company & placement timeline
        </h2>
        <p className="text-[14px] text-[#1F2420]/70 font-normal leading-relaxed">
          Your goals directly weight the diagnostic engine. We prioritize recurring patterns, OA frequency, and high-yield interview tags for your exact destination.
        </p>
      </div>

      {/* Field 1: Dream Company with Autocomplete & Chips */}
      <div className="space-y-2.5 relative" ref={dropdownRef}>
        <label
          htmlFor="input-dream-company"
          className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#C1592B]" />
            <span>Primary Dream Company</span>
            <span className="text-[#C1592B]">*</span>
          </span>
          {goals.dreamCompany && (
            <span className="text-[11px] text-[#5B6B4D] font-medium">Selected: {goals.dreamCompany}</span>
          )}
        </label>

        <div className="relative">
          <input
            id="input-dream-company"
            type="text"
            value={companyInput}
            onChange={handleCompanyInputChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Type any company (e.g. Google, Stripe, or your target firm)"
            autoComplete="off"
            className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
          />

          {/* Autocomplete dropdown if typing */}
          {showSuggestions && companyInput && filteredCompanies.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] shadow-lg max-h-56 overflow-y-auto z-30">
              {filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCompany(c.name)}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#1F2420]/5 flex items-center justify-between text-[13px] text-[#1F2420] transition-colors cursor-pointer border-b border-[#1F2420]/5 last:border-0"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[11px] text-[#1F2420]/50 font-mono">{c.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="pt-1">
          <span className="text-[11.5px] text-[#1F2420]/60 mr-2">Quick pick:</span>
          <div className="inline-flex flex-wrap gap-1.5 mt-1">
            {popularChips.map((name) => {
              const isSelected = goals.dreamCompany?.toLowerCase() === name.toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectCompany(name)}
                  className={`px-2.5 py-1 rounded-[4px] text-[12px] font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1F2420] text-[#FAF6F0] border-[#1F2420]'
                      : 'bg-[#FAF6F0] text-[#1F2420]/75 border-[#1F2420]/15 hover:border-[#C1592B] hover:text-[#C1592B]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Field 2: Target Role */}
      <div className="space-y-2">
        <label className="text-[13px] font-medium text-[#1F2420] flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-[#5B6B4D]" />
          <span>Target Role Discipline</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { id: 'sde', label: 'Software Engineer (General)' },
            { id: 'backend', label: 'Backend / Distributed' },
            { id: 'frontend', label: 'Frontend / Full Stack' },
            { id: 'quant', label: 'Quant / Systems Engineering' },
            { id: 'data_ai', label: 'AI / Data Engineering' },
            { id: 'intern', label: 'Engineering Intern' },
          ].map((role) => {
            const isSelected = (goals.targetRole || 'sde') === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onChange({ ...goals, targetRole: role.id })}
                className={`p-2 rounded-[4px] text-[12px] font-medium text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1F2420]/5 border-[#C1592B] text-[#1F2420] font-semibold'
                    : 'bg-[#FAF6F0] border-[#1F2420]/15 text-[#1F2420]/70 hover:border-[#1F2420]/30 hover:text-[#1F2420]'
                }`}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Field 3: Expected Placement Season / Timeline (Clean Segmented Cards) */}
      <div className="space-y-2.5">
        <label className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C1592B]" />
            <span>Placement Timeline & Urgency</span>
            <span className="text-[#C1592B]">*</span>
          </span>
        </label>

        <div className="space-y-2">
          {TIMELINE_OPTIONS.map((opt) => {
            const isSelected = goals.placementTimeline === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleSelectTimeline(opt.id)}
                className={`p-3 rounded-[6px] border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#1F2420]/4 border-[#C1592B] ring-1 ring-[#C1592B]'
                    : 'bg-[#FAF6F0] border-[#1F2420]/12 hover:border-[#1F2420]/25'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[#1F2420]">
                      {opt.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-[3px] font-semibold uppercase tracking-wider ${
                        opt.urgency === 'high'
                          ? 'bg-[#C1592B]/15 text-[#C1592B]'
                          : 'bg-[#5B6B4D]/15 text-[#5B6B4D]'
                      }`}
                    >
                      {opt.tag}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#1F2420]/60">
                    {opt.description}
                  </p>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-[#C1592B] bg-[#C1592B] text-[#FAF6F0]'
                      : 'border-[#1F2420]/20 bg-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
