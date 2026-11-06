"use client";

import { useTransition } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  fullName: string;
  email: string;
  role: Role;
};

export function UserMenu({ fullName, email, role }: UserMenuProps) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="gap-2 px-2 sm:px-3" aria-label="Menu du compte" />}
      >
        <UserRound className="size-5" aria-hidden />
        <span className="hidden max-w-40 truncate sm:inline">{fullName}</span>
        <Badge variant="secondary" className="hidden md:inline-flex">
          {ROLE_LABELS[role]}
        </Badge>
        <ChevronDown className="size-4 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="text-sm font-medium text-foreground">{fullName}</span>
            <span className="truncate text-xs">{email}</span>
            <span className="text-xs">{ROLE_LABELS[role]}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut aria-hidden />
          {pending ? "Déconnexion…" : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
