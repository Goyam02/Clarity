import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { LogOut, ChevronDown, User as UserIcon } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'Student';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User profile menu"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] border border-[#1F2420]/15 bg-[#FAF6F0] hover:bg-[#1F2420]/5 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 transition-colors cursor-pointer"
      >
        <div className="w-7 h-7 rounded-full bg-[#1F2420] text-[#FAF6F0] flex items-center justify-center text-[11px] font-mono font-bold tracking-wider">
          {initials}
        </div>
        <span className="text-[13px] font-medium text-[#1F2420] max-w-[120px] truncate hidden sm:inline">
          {user.firstName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#1F2420]/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-[10px] bg-[#FAF6F0] border border-[#1F2420]/12 shadow-[0_8px_30px_rgba(31,36,32,0.12)] p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-2 border-b border-[#1F2420]/8 mb-1">
            <div className="flex items-center gap-2 mb-1">
              <UserIcon className="w-3.5 h-3.5 text-[#C1592B]" />
              <p className="text-[13.5px] font-semibold text-[#1F2420] truncate">{fullName}</p>
            </div>
            <p className="text-[12px] font-mono text-[#1F2420]/60 truncate">{user.email}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-[#C1592B] hover:bg-[#C1592B]/10 rounded-[6px] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};
