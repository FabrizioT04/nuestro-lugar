import { Link } from "react-router";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <Card className="mt-6 animate-fade-up px-6 py-10 text-center">
      <h1 className="text-2xl">Este rincón no existe</h1>
      <Link to="/" className={buttonClass("secondary", "mt-5")}>
        Volver al inicio
      </Link>
    </Card>
  );
}
