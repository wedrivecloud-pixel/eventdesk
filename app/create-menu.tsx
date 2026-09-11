'use client';

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Link,
  Plus,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function CreateMenu({
  disabled,
  onEvent,
  onAppointment,
  onBookingLinks,
}: {
  disabled: boolean;
  onEvent: (status: 'lead' | 'proposal' | 'confirmed') => void;
  onAppointment: () => void;
  onBookingLinks: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="primary global-create-trigger"
        disabled={disabled}
        aria-label="Create new"
      >
        <Plus size={17} aria-hidden="true" />
        <span>Create</span>
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="global-create-menu">
        <DropdownMenuItem onClick={() => onEvent('lead')}>
          <Users aria-hidden="true" />
          <span>
            <strong>New lead</strong>
            <small>Save an inquiry for follow-up</small>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEvent('proposal')}>
          <FileText aria-hidden="true" />
          <span>
            <strong>New proposal</strong>
            <small>Prepare an offer for a client</small>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEvent('confirmed')}>
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>New booking</strong>
            <small>Record a confirmed event</small>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAppointment}>
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>New appointment</strong>
            <small>Schedule a meeting</small>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onBookingLinks}>
          <Link aria-hidden="true" />
          <span>
            <strong>Booking links</strong>
            <small>Online booking and package links</small>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
