import type { Metadata } from "next";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { PROFILE_COLUMNS, requireSection, toProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell/page-header";
import { CreateUserForm } from "./create-user-form";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const me = await requireSection("users");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load profiles: ${error.message}`);
  const users = (data ?? []).map(toProfile);

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Gérez les comptes, les rôles et l'accès des employés."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comptes</CardTitle>
            <CardDescription>
              Un compte désactivé ne peut plus accéder aux données de la boutique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Rôle et accès</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="py-3">
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-sm text-muted-foreground md:hidden">{user.email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "secondary" : "destructive"}>
                        {user.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.id === me.id ? (
                        <span className="text-muted-foreground">
                          {ROLE_LABELS[user.role]} (vous)
                        </span>
                      ) : (
                        <UserRowActions
                          userId={user.id}
                          fullName={user.fullName}
                          role={user.role}
                          isActive={user.isActive}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau compte</CardTitle>
            <CardDescription>
              Le compte est actif immédiatement. L&apos;employé se connecte avec l&apos;email et le
              mot de passe provisoire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
