"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { Role } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";

/** Drawer navigation for tablets and small screens (hidden on lg and up). */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu" />
        }
      >
        <Menu className="size-6" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4 data-[side=left]:w-72">
        <SheetHeader className="p-0 pb-2">
          <SheetTitle className="text-lg">Boutique</SheetTitle>
        </SheetHeader>
        <NavLinks role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
