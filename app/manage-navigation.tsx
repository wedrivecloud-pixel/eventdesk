'use client';
import { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { manageGroups } from '@/lib/manage-config';
export function ManageMenu({
  onNavigate,
}: {
  onNavigate: (s: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="sales-menu-trigger">
        Manage <ChevronDown size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="sales-menu">
        {manageGroups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map((name) => (
              <DropdownMenuItem key={name} onClick={() => onNavigate(name)}>
                {name}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
