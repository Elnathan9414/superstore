import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <Alert variant={ok ? "default" : "destructive"} role={ok ? "status" : "alert"}>
      {ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
